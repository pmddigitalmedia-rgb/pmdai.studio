import express from 'express';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ 
    limit: '50mb',
    verify: (req: any, _res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use('/public', express.static(path.join(__dirname, 'public')));

// --- GEMINI SERVER-SIDE SERVICE ---

import { GoogleGenAI, Type, GenerateVideosOperation } from "@google/genai";
import { fal } from "@fal-ai/client";

// Configure FAL client if FAL_KEY is present
if (process.env.FAL_KEY) {
    fal.config({
        credentials: process.env.FAL_KEY
    });
}

function getAi(): GoogleGenAI {
    const envGemini = process.env.GEMINI_API_KEY || '';
    const envApi = process.env.API_KEY || '';
    const key = process.env.USER_GEMINI_API_KEY || 
                (envGemini && !envGemini.startsWith('AQ.') ? envGemini : '') ||
                (envApi && !envApi.startsWith('AQ.') ? envApi : '') ||
                'AIzaSyAe4-zK9ebQCuJ6-2o_99NgD1Ri69al7dQ' ||
                envGemini;
    if (!key) {
        console.warn("WARNING: No Gemini API key found in process.env.GEMINI_API_KEY or API_KEY.");
    }
    return new GoogleGenAI({ 
        apiKey: key,
        httpOptions: {
            headers: {
                'User-Agent': 'aistudio-build',
            }
        }
    });
}

const ensureBase64 = (str: string) => {
    if (str && str.includes('base64,')) {
        return str.split('base64,')[1];
    }
    return str;
};

async function uploadToFalStorage(base64Data: string, mimeType: string = 'image/jpeg'): Promise<string> {
    if (!base64Data) return '';
    if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
        return base64Data;
    }
    const clean = ensureBase64(base64Data);
    const buffer = Buffer.from(clean, 'base64');
    const blob = new Blob([buffer], { type: mimeType });
    return await fal.storage.upload(blob);
}

async function runFalWithRetry(endpointId: string, input: any): Promise<any> {
    console.log(`[AI Engine] Submitting job to FAL queue: ${endpointId}`);
    let submitRes: any;
    try {
        submitRes = await fal.queue.submit(endpointId, { input });
    } catch (submitErr: any) {
        console.error(`[AI Engine] FAL submit error on ${endpointId}:`, submitErr?.message, submitErr?.body || submitErr?.data || '');
        throw submitErr;
    }
    const requestId = submitRes?.request_id || submitRes?.requestId;
    if (!requestId) {
        throw new Error(`Failed to get requestId from FAL submit on ${endpointId}`);
    }

    // Poll status until complete
    let attempts = 0;
    while (attempts < 120) {
        await new Promise(r => setTimeout(r, 1200));
        const status = await fal.queue.status(endpointId, { requestId, logs: false });
        if (status.status === 'COMPLETED') {
            // Fetch result with resilience against temporary 400 "in progress" replication lag
            for (let r = 0; r < 10; r++) {
                try {
                    const res = await fal.queue.result(endpointId, { requestId });
                    return res;
                } catch (err: any) {
                    const isStillInProgress = err.status === 400 || 
                                              (err.body && String(err.body.detail || '').toLowerCase().includes('progress')) ||
                                              String(err.message || '').toLowerCase().includes('progress');
                    if (isStillInProgress && r < 9) {
                        console.log(`[AI Engine] FAL result replication pending (status 400), retrying in 1s (${r + 1}/10)...`);
                        await new Promise(res => setTimeout(res, 1000));
                        continue;
                    }
                    throw err;
                }
            }
        }
        if ((status as any).status === 'FAILED' || (status as any).error) {
            throw new Error(`FAL generation failed on ${endpointId}: ${JSON.stringify(status)}`);
        }
        attempts++;
    }
    throw new Error(`FAL generation timed out on ${endpointId} after 2.5 minutes`);
}

function parseGeminiError(e: any): { status: number, message: string } {
    let status = 500;
    let message = String(e);

    if (e && typeof e === 'object') {
        const msg = e.message || '';
        if (typeof e.status === 'number') {
            status = e.status;
        } else if (msg.includes('429') || String(e).includes('429')) {
            status = 429;
        }

        const jsonMatch = msg.match(/ApiError:\s*(\{[\s\S]*\})/i) || String(e).match(/ApiError:\s*(\{[\s\S]*\})/i) || msg.match(/(\{[\s\S]*"error"[\s\S]*\})/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1]);
                if (parsed.error) {
                    if (parsed.error.code) status = Number(parsed.error.code);
                    if (parsed.error.message) message = parsed.error.message;
                    if (parsed.error.status) message = `${parsed.error.status}: ${message}`;
                }
            } catch (pErr) {
                // Ignore parse errors
            }
        } else if (e.message) {
            message = e.message;
        }
    }

    if (message.includes("quota") || message.includes("RESOURCE_EXHAUSTED") || message.includes("429") || message.includes("FreeTier")) {
        status = 429;
        message = "Gemini API Quota Exceeded / Billing Plan Required. This image generation/editing task requires a Pay-as-you-go / Paid API key tier. Please click the Settings gear icon in the top right, go to Secrets, and select a paid key with billing enabled.";
    }

    return { status, message };
}

// API routes FIRST

const DEFAULT_SHEETS_WEBHOOK = "https://script.google.com/macros/s/AKfycbzRFV8hkoi2FOmPgd7kXcs6OJaZAwdYP1RVj2DTPQffK9bNOm8BqngUIBpkLjnWPkNs/exec";

function parseCsvToRows(csvText: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let insideQuotes = false;
    
    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];
        
        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                currentCell += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if ((char === '\r' || char === '\n') && !insideQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i++;
            }
            currentRow.push(currentCell.trim());
            if (currentRow.some(c => c !== '')) {
                rows.push(currentRow);
            }
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }
    if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c !== '')) {
            rows.push(currentRow);
        }
    }
    return rows;
}

async function fetchFromSheetsUrl(inputUrl: string): Promise<any[][]> {
    let targetUrl = (inputUrl || '').trim();
    if (!targetUrl || targetUrl.includes("PASTE_YOUR_ID_HERE")) {
        targetUrl = DEFAULT_SHEETS_WEBHOOK;
    }

    // If it's a Google Sheets spreadsheet document URL, convert to CSV export
    const googleSheetMatch = targetUrl.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (googleSheetMatch) {
        const spreadsheetId = googleSheetMatch[1];
        const gidMatch = targetUrl.match(/[#&?]gid=([0-9]+)/);
        const gid = gidMatch ? gidMatch[1] : '0';
        targetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
        
        const resp = await axios.get(targetUrl, {
            timeout: 25000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });
        if (typeof resp.data === 'string') {
            return parseCsvToRows(resp.data);
        }
    }

    // Default: fetch from Apps Script or JSON endpoint
    const resp = await axios.get(targetUrl, {
        maxRedirects: 10,
        timeout: 25000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Accept': 'application/json, text/plain, */*'
        }
    });

    let data = resp.data;
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch {
            if (data.includes(',') && data.includes('\n')) {
                return parseCsvToRows(data);
            }
            throw new Error("Invalid response format received from Google Sheets endpoint");
        }
    }

    if (Array.isArray(data)) {
        return data;
    } else if (data && typeof data === 'object' && Array.isArray(data.data)) {
        return data.data;
    } else if (data && typeof data === 'object' && Array.isArray(data.values)) {
        return data.values;
    } else if (data && data.error) {
        throw new Error(data.error);
    }
    
    throw new Error("Unexpected data structure returned from Google Sheets");
}

app.all("/api/sheets-sync", async (req, res) => {
    const rawUrl = (req.query.url as string) || (req.body && req.body.url) || DEFAULT_SHEETS_WEBHOOK;
    const url = typeof rawUrl === 'string' ? rawUrl.trim() : DEFAULT_SHEETS_WEBHOOK;
    
    try {
        const rows = await fetchFromSheetsUrl(url);
        return res.json({
            success: true,
            data: rows,
            fallbackUsed: false,
            rowCount: rows.length
        });
    } catch (err: any) {
        console.warn(`[Sheets Sync] Primary fetch failed for ${url}:`, err.message || err);
        
        // If custom URL failed (e.g. 404, 403, or invalid format), fall back gracefully to the permanent webhook
        if (url !== DEFAULT_SHEETS_WEBHOOK) {
            try {
                console.log("[Sheets Sync] Falling back to default PMD bookings webhook...");
                const fallbackRows = await fetchFromSheetsUrl(DEFAULT_SHEETS_WEBHOOK);
                return res.json({
                    success: true,
                    data: fallbackRows,
                    fallbackUsed: true,
                    originalError: err.message || 'Custom URL returned an error',
                    message: "Custom Sheets URL returned 404 or could not be reached. Loaded default bookings sheet."
                });
            } catch (fallbackErr: any) {
                console.error("[Sheets Sync] Fallback also failed:", fallbackErr.message || fallbackErr);
            }
        }
        
        return res.status(502).json({
            success: false,
            error: err.message || 'Failed to fetch from Google Sheets',
            url
        });
    }
});

app.get("/api/engine-status", (req, res) => {
    const hasFalKey = Boolean(process.env.FAL_KEY && process.env.FAL_KEY.trim().length > 0);
    res.json({
        engine: hasFalKey ? 'fal' : 'gemini',
        modelLabel: hasFalKey ? 'Flux Kontext • FAL' : 'Gemini 3 Pro',
        hasFalKey
    });
});

app.post("/api/generate-bundled-listing", async (req, res) => {
    const { base64, mimeType } = req.body;
    try {
        console.log("[AI Engine] Analyzing bundled listing via Direct Gemini API (gemini-3.8-flash)...");
        const response = await getAi().models.generateContent({
            model: 'gemini-3.8-flash',
            contents: {
                parts: [
                    { inlineData: { data: ensureBase64(base64), mimeType: mimeType || 'image/jpeg' } },
                    { text: "Analyze this property photo. Provide a high-end listing description, identify the room type, list key architectural features, and suggest matching furniture styles. Return result as JSON." }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        listingDescription: { type: Type.STRING },
                        roomType: { type: Type.STRING },
                        keyFeatures: { type: Type.ARRAY, items: { type: Type.STRING } },
                        suggestedStyles: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["listingDescription", "roomType", "keyFeatures", "suggestedStyles"]
                }
            }
        });
        res.json(JSON.parse(response.text || '{}'));
    } catch (e) {
        console.error("Bundled failed", e);
        const { status, message } = parseGeminiError(e);
        res.status(status).json({ error: message });
    }
});

app.post("/api/pre-analysis", async (req, res) => {
    const { base64, mimeType } = req.body;
    try {
        console.log("[AI Engine] Running Pre-Analysis via Direct Gemini API (gemini-3.8-flash)...");
        const response = await getAi().models.generateContent({
            model: 'gemini-3.8-flash',
            contents: {
                parts: [
                    { inlineData: { data: ensureBase64(base64), mimeType: mimeType || 'image/jpeg' } },
                    { 
                        text: `You are an expert real estate photo editor, visual stager, and architectural analyst. Analyze this property photo for AI editing and virtual staging:
- roomType: e.g. "Living Room", "Primary Bedroom", "Kitchen", "Dining Room", "Bathroom", "Patio / Deck", "Front Yard Exterior", "Backyard", "Home Office"
- sceneType: "interior" | "exterior" | "aerial" | "panorama"
- occupancy: "vacant" | "sparsely_furnished" | "fully_furnished" | "cluttered"
- lightingCondition: description of light & window quality (e.g. "Overcast sky through patio sliding doors", "Bright natural light", "Dim indoor with shadows")
- flooringType: e.g. "Hardwood", "Tile", "Carpet", "Polished Concrete", "Laminate"
- clutterLevel: "none" | "light" | "moderate" | "heavy"
- clutterItems: specific clutter objects detected to remove (e.g. ["cords under TV", "countertop mess", "personal frames"]). Empty array if none.
- detectedFeatures: key architectural elements (e.g. ["Fireplace", "Sliding patio doors", "Crown molding", "Recessed lighting"])
- recommendedTools: array of studio tool IDs strictly from: ["auto_declutter", "declutter_direct", "sunny_skies", "window_splash", "furniture", "style_swapper", "wall_unifier", "cable_remover", "lush_lawn", "white_balance", "sunset"]
- suggestedStagingStyle: one of: "Modern", "Contemporary", "Industrial", "Luxury", "Scandinavian", "Minimalist", "Mid-Century Modern", "Traditional"
- suggestedStagingRoom: one of: "living room", "living room and dining room", "Bedroom", "Kitchen", "Dining room", "Den", "Office", "Rec room", "Patio Furniture", "Media Room"
- skyPercentage: numerical percentage (0 to 100) of the photo frame occupied by visible outdoor open sky. CRITICAL: For interior rooms, smooth drywall ceilings, white ceilings, recessed lights, and interior walls are NEVER sky; they are interior architectural surfaces. In interior photos, sky can ONLY exist through outdoor window glass panes. If an interior room has no windows or no sky visible through windows, skyPercentage MUST be 0.
- hasWindows: boolean true if room has windows, glass doors, or openings with outside views.
- summary: crisp 1-2 sentence assessment and editing plan` 
                    }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        roomType: { type: Type.STRING },
                        sceneType: { type: Type.STRING },
                        occupancy: { type: Type.STRING },
                        lightingCondition: { type: Type.STRING },
                        flooringType: { type: Type.STRING },
                        clutterLevel: { type: Type.STRING },
                        clutterItems: { type: Type.ARRAY, items: { type: Type.STRING } },
                        detectedFeatures: { type: Type.ARRAY, items: { type: Type.STRING } },
                        recommendedTools: { type: Type.ARRAY, items: { type: Type.STRING } },
                        suggestedStagingStyle: { type: Type.STRING },
                        suggestedStagingRoom: { type: Type.STRING },
                        skyPercentage: { type: Type.NUMBER },
                        hasWindows: { type: Type.BOOLEAN },
                        summary: { type: Type.STRING }
                    },
                    required: ["roomType", "sceneType", "occupancy", "lightingCondition", "clutterLevel", "detectedFeatures", "recommendedTools", "summary"]
                }
            }
        });
        const parsed = JSON.parse(response.text || '{}');
        res.json({ ...parsed, timestamp: Date.now() });
    } catch (e) {
        console.error("Pre-Analysis failed", e);
        const { status, message } = parseGeminiError(e);
        res.status(status).json({ error: message });
    }
});

app.post("/api/generate-luxury-copy", async (req, res) => {
    const { images } = req.body;
    try {
        if (!images || images.length === 0) {
            return res.status(400).json({ error: "No images provided" });
        }
        console.log("[AI Engine] Generating luxury copy via Direct Gemini API (gemini-3.8-flash)...");
        const imageParts = images.map((img: any) => ({
            inlineData: { data: ensureBase64(img.base64), mimeType: img.mimeType || 'image/jpeg' }
        }));
        const response = await getAi().models.generateContent({
            model: 'gemini-3.8-flash',
            contents: {
                parts: [
                    ...imageParts,
                    { 
                        text: `Generate a luxury marketing pack for these property photos. Return valid JSON including mlsDescription, socialMediaPack (facebook, linkedIn, tiktokStories, pinterest, xTwitter), emailBlast, and uniqueSellingPoints. No emojis.`
                    }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        mlsDescription: { type: Type.STRING },
                        socialMediaPack: {
                            type: Type.OBJECT,
                            properties: {
                                facebook: { type: Type.STRING },
                                linkedIn: { type: Type.STRING },
                                tiktokStories: { type: Type.STRING },
                                pinterest: { type: Type.STRING },
                                xTwitter: { type: Type.STRING }
                            },
                        },
                        emailBlast: { type: Type.STRING },
                        uniqueSellingPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["mlsDescription", "socialMediaPack", "emailBlast", "uniqueSellingPoints"]
                }
            }
        });
        res.json(JSON.parse(response.text || '{}'));
    } catch (e) {
        console.error("Luxury copy failed", e);
        const { status, message } = parseGeminiError(e);
        res.status(status).json({ error: message });
    }
});

app.post("/api/enhance-prompt", async (req, res) => {
    const { prompt } = req.body;
    try {
        const falKey = process.env.FAL_KEY;
        if (falKey) {
            try {
                console.log("[AI Engine] Enhancing prompt via FAL Any-LLM (openai/gpt-4o-mini)...");
                const anyLlmResult: any = await fal.subscribe("fal-ai/any-llm", {
                    input: {
                        model: "openai/gpt-4o-mini",
                        prompt: `Rewrite the following architectural prompt to be more descriptive and professional. Focus on lighting, atmosphere, and composition. Keep it under 40 words.\n\nInput Prompt: "${prompt}"`
                    } as any
                });
                const outputText = anyLlmResult.data?.output || anyLlmResult.output || anyLlmResult.text;
                if (outputText) {
                    return res.json({ enhancedPrompt: outputText.trim() });
                }
            } catch (falErr) {
                console.warn("FAL Any-LLM prompt enhance failed, falling back to Gemini:", falErr);
            }
        }

        const response = await getAi().models.generateContent({
            model: 'gemini-3.6-flash',
            contents: `Rewrite the following architectural prompt to be more descriptive and professional. Focus on lighting, atmosphere, and composition. Keep it under 40 words.
            
            Input Prompt: "${prompt}"`
        });
        res.json({ enhancedPrompt: response.text?.trim() || prompt });
    } catch (e) {
        console.error("Enhance prompt failed", e);
        const { status, message } = parseGeminiError(e);
        res.status(status).json({ error: message });
    }
});

app.post("/api/detect-personal-photos", async (req, res) => {
    const { base64, mimeType } = req.body;
    try {
        const detectionPrompt = `Detect all personal photos, family portraits, picture frames, framed photos on walls, diplomas, or framed pictures on tables in this room photo. Return a pure JSON array of objects with "box_2d": [ymin, xmin, ymax, xmax] (normalized between 0 and 1000) and "label": string. If none, return []. Pure JSON only without markdown.`;

        console.log("[AI Engine] Detecting personal photos via Direct Gemini API (gemini-3.8-flash)...");
        const response = await getAi().models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [
                { text: detectionPrompt },
                { inlineData: { data: ensureBase64(base64), mimeType: mimeType || 'image/jpeg' } }
            ]
        });

        const text = response.text || '[]';
        console.log("[AI Engine] Direct Gemini photo detection output:", text);
        const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const start = cleaned.indexOf('[');
        const end = cleaned.lastIndexOf(']');
        const jsonStr = (start !== -1 && end !== -1 && end > start) ? cleaned.substring(start, end + 1) : cleaned;
        const parsed = JSON.parse(jsonStr);
        console.log("[AI Engine] Gemini detected photo boxes count:", Array.isArray(parsed) ? parsed.length : 0);
        return res.json({ boxes: Array.isArray(parsed) ? parsed : [] });
    } catch (e) {
        console.error("Detect personal photos failed", e);
        res.json({ boxes: [] });
    }
});

app.post("/api/edit-image", async (req, res) => {
    const { base64, mimeType, prompt, model, maskBase64, sampleBase64, aspectName, imageSize, preAnalysis } = req.body;
    try {
        let targetModel = model || 'gemini-3.1-flash-image'; 
        
        const parts: any[] = [
            { text: "SOURCE_PHOTO_REFERENCE:" },
            { inlineData: { data: ensureBase64(base64), mimeType } }
        ];

        if (preAnalysis) {
            let sceneContext = `[AI_PRE_ANALYSIS_SCENE_CONTEXT]: Room: ${preAnalysis.roomType || 'Unknown'} (${preAnalysis.sceneType || 'interior'}, ${preAnalysis.occupancy || 'standard'}). Flooring: ${preAnalysis.flooringType || 'Unknown'}. Lighting: ${preAnalysis.lightingCondition || 'Natural'}.`;
            if (preAnalysis.clutterItems && preAnalysis.clutterItems.length > 0) {
                sceneContext += ` Specific detected clutter items: ${preAnalysis.clutterItems.join(', ')}.`;
            }
            if (preAnalysis.detectedFeatures && preAnalysis.detectedFeatures.length > 0) {
                sceneContext += ` Key architectural elements to preserve: ${preAnalysis.detectedFeatures.join(', ')}.`;
            }
            parts.push({ text: sceneContext });
        }

        if (sampleBase64) {
            parts.push({ text: "TEXTURE_SAMPLE_TARGET:" });
            parts.push({ inlineData: { data: ensureBase64(sampleBase64), mimeType: 'image/png' } });
        }

        if (maskBase64) {
            parts.push({ text: "LOGICAL_CONTROL_MASK (WHITE=MODIFY_ONLY_HERE, BLACK=STRICT_PIXEL_LOCK):" });
            parts.push({ inlineData: { data: ensureBase64(maskBase64), mimeType: 'image/png' } });
        }

        const upperPrompt = prompt.toUpperCase();
        const isDepersonalize = upperPrompt.includes('DEPERSONALIZ') || 
                                upperPrompt.includes('DEPERSONALISATION') || 
                                upperPrompt.includes('PERSONALIZED IMAGES') ||
                                upperPrompt.includes('PERSONAL PHOTO');
        const isSunCastingOnly = upperPrompt.includes('OUTDOOR SUN CASTING') || 
                                 upperPrompt.includes('SUN DRENCHED') || 
                                 upperPrompt.includes('SUN_DRENCHED');
        const requestedSunnySkies = !isSunCastingOnly && (
                                    upperPrompt.includes('OUTDOOR SUNNY SKIES') ||
                                    upperPrompt.includes('OUTDOOR SUN') || 
                                    upperPrompt.includes('OUTDOOR_SUN') || 
                                    upperPrompt.includes('SUNNY SKIES') || 
                                    upperPrompt.includes('SUNNY_SKIES'));
        
        // --- 10% SKY COVERAGE THRESHOLD FOR OUTDOOR SUN ---
        // If sky coverage is >= 10%, execute standard Outdoor Sun (exterior focus).
        // If sky coverage is < 10% (such as interior rooms with windows or minor sky views), automatically route to Sunny Splash.
        let detectedSkyPercentage: number | null = null;
        if (preAnalysis && typeof preAnalysis.skyPercentage === 'number') {
            detectedSkyPercentage = preAnalysis.skyPercentage;
        }

        let isSunnySkies = requestedSunnySkies;
        let isIndoorWindow = upperPrompt.includes('INDOOR') || upperPrompt.includes('WINDOW SPLASH');

        if (requestedSunnySkies) {
            const isExplicitInterior = preAnalysis?.sceneType === 'interior' || 
                                       upperPrompt.includes('INTERIOR') || 
                                       upperPrompt.includes('LIVING ROOM') || 
                                       upperPrompt.includes('BEDROOM') || 
                                       upperPrompt.includes('KITCHEN') || 
                                       upperPrompt.includes('DINING ROOM');

            // Sanity check: In interior rooms, white drywall ceilings can never be outdoor sky.
            if (isExplicitInterior && detectedSkyPercentage !== null && detectedSkyPercentage >= 10) {
                detectedSkyPercentage = Math.min(detectedSkyPercentage, 5);
            }
        }

        const isSkyOrAtmosphere = isSunnySkies || 
                                  isIndoorWindow ||
                                  upperPrompt.includes('SKY') || 
                                  upperPrompt.includes('WEATHER');
        const isSunset = upperPrompt.includes('SUNSET') || 
                         upperPrompt.includes('DAY TO DUSK') || 
                         upperPrompt.includes('GOLDEN HOUR') || 
                         upperPrompt.includes('GOLDEN_HOUR');
        const isWallUnifier = upperPrompt.includes('WALL UNIFIER') || 
                              upperPrompt.includes('PAINT WALL') || 
                              upperPrompt.includes('WALL COLOR') ||
                              upperPrompt.includes('WALL UNIFICATION');
        const isVirtualStaging = (
            upperPrompt.includes('VIRTUAL STAGING') || 
            upperPrompt.includes('FURNITURE') || 
            upperPrompt.includes('STYLE SWAP') || 
            upperPrompt.includes('VSTAGING') || 
            upperPrompt.includes('MODERN STAGE') ||
            upperPrompt.includes('STAGE') ||
            upperPrompt.includes('STAGING')
        ) && !isWallUnifier && !isDepersonalize;

        const isDeclutterDirective = (
            upperPrompt.includes('DECLUTTER') ||
            upperPrompt.includes('OBJECT_REMOVAL') ||
            upperPrompt.includes('MAGIC ERASER')
        ) && !isDepersonalize;

        if (isDeclutterDirective) {
            parts.push({
                text: `[CRITICAL_DEEP_TOTAL_DECLUTTER_DIRECTIVE]:
- COMPLETE CLUTTER ELIMINATION: Completely eliminate and inpaint all loose clutter, mess, trash, loose papers, mail, cables, cords, chargers, dishes, cookware, cups, bottles, boxes, bags, shoes, clothing piles, laundry hampers, pet toys, toiletries, and countertop knickknacks.
- CLEAN ARCHITECTURAL SURFACES: Restore all tables, desks, kitchen counters, bathroom vanities, shelves, and floors to clean, pristine, model-home condition.
- STRICT FLOOR MATERIAL & FINISH LOCK: ABSOLUTELY DO NOT change, replace, bleach, restain, re-tile, or mutate ANY existing flooring material. Hardwood grain, plank width, wood stain, tile pattern, carpet texture, and grout MUST remain 100% identical and unchanged to the source photo. Any uncovered floor area where clutter was removed MUST seamlessly match the surrounding floor material with photorealistic precision.
- STRICT WALL COLOR & TRIM LOCK: ABSOLUTELY DO NOT alter, repaint, tint, or change any existing wall paint colors, accent walls, wallpaper, moldings, or baseboards.
- ZERO WEATHER / OUTDOOR MUTATION: Strictly DO NOT add snow, frost, ice, or white ground cover to any exterior grounds, lawns, driveways, or patios. Outdoor landscaping, grass, and pavement must preserve their original non-winter state.
- STRUCTURAL & FURNITURE PRESERVATION: Keep existing primary structural furniture (sofas, beds, dining tables, kitchen cabinets), original wall paint, flooring textures, windows, and architecture completely intact.`
            });
        }
        if (isWallUnifier) {
            targetModel = 'gemini-3.1-flash-image';
            parts.push({
                text: `[CRITICAL_WALL_UNIFIER_ARCHITECTURAL_AND_COLOR_FIDELITY_DIRECTIVE]:
- PRECISE COLOR MATCHING: Repaint wall surfaces to match the specified architectural color description and exact hue with pristine realism.
- ARCHITECTURAL LOCK: Keep all ceilings, moldings, baseboards, floorings, doors, light fixtures, electrical outlets, windows, and surrounding furniture 100% unaltered.
- LIGHTING PRESERVATION: Preserve authentic light falloff, ambient occlusion, realistic wall corner shadows, and room depth gradients across the newly painted surfaces.
- ZERO RESIDUAL CONTAMINATION: Replace the previous wall colors cleanly and uniformly without blotches, color banding, or artificial halos.`
            });
        }

        if (isDepersonalize) {
            parts.push({
                text: `[CRITICAL_SURGICAL_DEPERSONALIZATION_DIRECTIVE]:
- STRICT MANDATORY RULE: ONLY PERSONALIZED IMAGES / FAMILY PHOTOS TO BE CHANGED.
- ZERO FURNITURE MODIFICATIONS: Absolutely DO NOT change, swap, add, move, recolor, or modify ANY furniture, sofas, chairs, tables, desks, rugs, lamps, or cabinets. All furniture must remain 100% strictly identical to the source image.
- ZERO WALL COLOR MODIFICATIONS: Absolutely DO NOT change, repaint, tint, lighten, darken, or shift ANY wall color, wall paint, wallpaper, or wall finish. All walls must remain 100% strictly identical in color, tone, and texture to the source image.
- SURGICAL IN-FRAME REPLACEMENT ONLY: Replace ONLY personal portrait photos, family pictures, and personalized plaques with neutral generic landscape, architectural, or minimalist botanical artwork inside the existing picture frames. Keep the frames, frame positions, and wall surfaces exactly as they are.`
            });
        }

        if (isVirtualStaging) {
            parts.push({
                text: `[CRITICAL_ARCHITECTURAL_WALL_FLOOR_&_STRUCTURAL_IMMUTABILITY_DIRECTIVE]:
- STRICT FLOOR MATERIAL & FINISH LOCK: ABSOLUTELY DO NOT change, replace, bleach, restain, re-tile, or mutate ANY existing flooring material. Hardwood grain, plank width, plank direction, wood stain color, tile pattern, carpet texture, and grout MUST remain 100% identical and unchanged to the source photo. Any uncovered floor area where previous furniture or rugs were removed MUST seamlessly match the surrounding original floor material with photorealistic precision.
- STRICT WALL COLOR & TEXTURE LOCK: Absolutely DO NOT change, repaint, tint, recolor, lighten, darken, or alter any wall colors, accent walls, wallpaper, or wall paint finishes. Keep all existing wall paint colors and textures 100% identical and unchanged to the source photo.
- STRICT PHYSICAL ARCHITECTURE LOCK: Zero architectural changes. Absolutely DO NOT add, move, shift, or eliminate any walls, partition walls, half walls, pony walls, archways, columns, posts, or room dividers.
- ZERO STRUCTURAL MODIFICATIONS: The source photo's room geometry, perimeter walls, ceiling height, baseboards, door openings, and window frames MUST remain 100% identical. Never erect new drywall or alter room boundaries.
- IN-PAINTING / DECOR ONLY: Only populate the existing open floor space and flat surfaces with freestanding furniture, area rugs, lighting, and decor.
- PRESERVE SIGHTLINES: Maintain authentic natural lighting angles, shadows, and open-concept perspective without altering or occluding architectural elements.`
            });
        }

        if (isSunnySkies) {
            parts.push({ 
                text: `[OUTDOOR_SUN_DIRECTIVES]:
- Replace ONLY the open outdoor sky above the horizon and roofline with vibrant, natural deep blue sunny skies with soft white clouds.
- STRICT WINDOW PROTECTION RULE: Strictly do NOT put sky, clouds, or blue sky graphics into the windows, window panes, window glass, or window reflections of the house or building. House windows are physical architectural elements and must remain authentic architectural glass reflecting the environment naturally, NEVER replaced with sky decals.
- SUNLIGHT CASTING & RELIGHTING: Cast natural, warm directional sunlight, realistic sunlit highlights, and clean architectural sun-and-shade contrast across the building exterior, roof, walls, driveway, and grounds consistent with a clear, beautiful sunny day.
- PRESERVATION: Zero modifications to building geometry, walls, rooflines, chimneys, gutters, doors, window frames, or powerlines. Keep all tree branches, leaves, and landscaping in place.`
            });
        } else if (isIndoorWindow) {
            parts.push({ 
                text: `[INDOOR_SUNNY_SPLASH_WINDOW_LOCK_DIRECTIVE]:
- STRICT WINDOW AND OUTDOOR SCENERY IMMUTABILITY LOCK: ABSOLUTELY DO NOT MODIFY, REDRAW, REPAINT, OR CHANGE THE WINDOW, WINDOW GLASS, WINDOW FRAME, OR ANY SCENERY OUTSIDE THE WINDOW.
- The original landscape, outdoor trees, bushes, neighboring buildings, patio, and original sky visible through the window glass must remain 100% IDENTICAL, UNTOUCHED, AND FROZEN.
- Strictly ignore the window area and do NOT replace or paint any sky into the window panes.
- INTERIOR SUNLIGHT CASTING ONLY: Cast natural, warm direct sunlight patches and soft window shadow lines onto the interior floor, rugs, and interior furniture surfaces consistent with the natural angle of incoming daylight.
- Preserve all interior walls, architectural structure, ceiling, and all existing furnishings untouched.`
            });
        } else if (isSkyOrAtmosphere) {
            parts.push({ 
                text: `[CRITICAL_ARCHITECTURAL_AND_SILHOUETTE_LOCK]:
- Zero modifications to buildings, walls, rooflines, chimneys, gutters, architectural details, or window frames.
- Zero modifications or removal of trees, tree trunks, branches, twig silhouettes, leaves, landscaping, or foliage.
- Only replace the sky pixels above the horizon.
- Strictly do NOT put sky or clouds into the windows of the house or building.
- All non-sky physical elements must remain 100% structurally locked.`
            });
        }

        if (isSunset) {
            parts.push({ 
                text: `[CRITICAL_GOLDEN_HOUR_SUNSET_LIGHTING_DIRECTIVE]:
- VIBRANT GOLDEN-HOUR AMBIENT EXPOSURE: The scene must remain brightly lit and clearly exposed with warm golden, amber, and apricot sunset daylight.
- STRICT PROHIBITION OF NIGHTTIME OR DARK TWILIGHT: ABSOLUTELY DO NOT render a dark, black, deep blue-hour, or nighttime sky. The property and surroundings must NOT be plunged into darkness, heavy underexposed shadows, or night atmosphere.
- DRAMATIC SUNSET SKY: Replace the sky above the horizon with luminous golden-hour sunset clouds featuring rich golden, peach, amber, and warm light.
- ARCHITECTURAL FACADE & LANDSCAPING ILLUMINATION: The house facade, roof, lawn, trees, driveway, and structural details must remain fully visible and naturally illuminated by warm sunset ambient light.
- WARM INTERIOR & EXTERIOR ACCENT GLOW: Gently illuminate windows and exterior porch/coach lamps with a warm 2700K golden interior glow.
- STRICT ARCHITECTURAL IMMUTABILITY: Keep all walls, geometry, doors, windows, rooflines, and structures 100% identical to the source image.`
            });
        }

        if (maskBase64) {
            const isWindowRelight = upperPrompt.includes('WINDOW SPLASH') || upperPrompt.includes('INDOOR SUN') || upperPrompt.includes('WINDOW SUNBURST') || upperPrompt.includes('WINDOW RELIGHTING');
            if (isWindowRelight) {
                parts.push({
                    text: `[SURGICAL_WINDOW_RELIGHT_DIRECTIVE]:
- STRICT COLOR TEMPERATURE PRESERVATION: Absolutely DO NOT change, warm, or shift the color temperature of the image. Keep the white balance, color temperature, and chromatic balance 100% IDENTICAL to the original image. Do not apply yellow casts, orange warming filters, or alter natural greens and neutrals.
- STRICT IDENTITY & OBJECT PRESERVATION: Absolutely do NOT replace, mutate, or hallucinate different trees, plants, buildings, or outdoor features. Keep every single branch, leaf, trunk, and grass blade in its exact existing position and structure.
- LIGHTING MODULATION ONLY: Only increase the illumination and add natural direct sunlight highlights and clean sunlit exposure to the existing outdoor elements while leaving the color temperature strictly unchanged.
- PRESERVE UNMASKED SURFACES: Black regions in the mask are 100% immutable original interior room and architecture.`
                });
            }
            parts.push({ text: `[TASK_COMMAND]: ${prompt}\n[STRICT_MASK_ADHERENCE]: Execute modifications ONLY within the WHITE regions. Black regions are 100% immutable original physical architecture and landscaping.` });
        } else {
            parts.push({ text: `[TASK_COMMAND]: ${prompt}` });
        }

        // If FAL_KEY is configured in Secrets, use FAL AI (except Wall Unifier, which uses Google Gemini gemini-3.1-flash-image for color fidelity)
        const falKey = process.env.FAL_KEY;
        if (falKey && !isWallUnifier) {
            try {
                let falResult: any;
                let usedFalModel = '';

                // Case 1: Reference-based replacement (Floor Replacer, Ceiling Replacer, or any edit with sampleBase64)
                if (sampleBase64) {
                    console.log("[AI Engine] Routing Reference-Based Edit to FAL AI: fal-ai/flux-2-pro/edit");
                    usedFalModel = 'fal-ai/flux-2-pro/edit';
                    const [sourceUrl, sampleUrl] = await Promise.all([
                        uploadToFalStorage(base64, mimeType || 'image/jpeg'),
                        uploadToFalStorage(sampleBase64, 'image/png')
                    ]);

                    falResult = await runFalWithRetry("fal-ai/flux-2-pro/edit", {
                        prompt: prompt,
                        image_urls: [sourceUrl, sampleUrl]
                    });
                } 
                // Case 2: Mask-based Inpaint (e.g. FLUX.1 Fill - locks unmasked pixels 100% untouched)
                else if (maskBase64) {
                    const [sourceUrl, maskUrl] = await Promise.all([
                        uploadToFalStorage(base64, mimeType || 'image/jpeg'),
                        uploadToFalStorage(maskBase64, 'image/png')
                    ]);

                    let inpaintPrompt = prompt;
                    const upperPrompt = prompt.toUpperCase();
                    const is360Pano = upperPrompt.includes('360') || upperPrompt.includes('EQUIRECTANGULAR') || upperPrompt.includes('PANORAMA') || upperPrompt.includes('P360');
                    const isDeclutter = upperPrompt.includes('DECLUTTER') || upperPrompt.includes('OBJECT_REMOVAL') || upperPrompt.includes('MAGIC ERASER') || upperPrompt.includes('REMOVE CABLES') || upperPrompt.includes('EMPTY ROOM') || upperPrompt.includes('EMPTY_ROOM') || upperPrompt.includes('CLEAN ARCHITECTURAL FLOOR');

                    if (isDeclutter) {
                        if (is360Pano) {
                            console.log("[AI Engine] Routing 360 Panorama Declutter Inpaint to FLUX.1 Pro Fill (fal-ai/sam2 + fal-ai/flux-pro/v1/fill)");
                            usedFalModel = 'fal-ai/sam2 + fal-ai/flux-pro/v1/fill';
                            const declutterFillPrompt = "ARCHITECTURAL DECLUTTER: Completely remove all furniture, clutter, tables, chairs, beds, rugs, and decor. Inpaint seamless, clean architectural floor and walls matching the surrounding room materials with photorealistic precision. STRICT LOCK: Absolutely DO NOT change floor material, wood stain, tile pattern, or wall paint color. Zero snow, zero winter ground covering.";
                            try {
                                falResult = await runFalWithRetry("fal-ai/flux-pro/v1/fill", {
                                    prompt: declutterFillPrompt,
                                    image_url: sourceUrl,
                                    mask_url: maskUrl
                                });
                            } catch (fillErr) {
                                console.warn("[AI Engine] fal-ai/flux-pro/v1/fill error, falling back to FLUX.1 [dev] Fill:", fillErr);
                                try {
                                    usedFalModel = 'fal-ai/flux-fill/dev';
                                    falResult = await runFalWithRetry("fal-ai/flux-fill/dev", {
                                        prompt: declutterFillPrompt,
                                        image_url: sourceUrl,
                                        mask_url: maskUrl
                                    });
                                } catch (devErr) {
                                    usedFalModel = 'fal-ai/flux-pro/kontext';
                                    falResult = await runFalWithRetry("fal-ai/flux-pro/kontext", {
                                        image_url: sourceUrl,
                                        prompt: "ARCHITECTURAL DECLUTTER: Completely empty vacant room. Remove all furniture, chairs, tables, beds, rugs, clutter, and personal belongings. Reveal original clean architectural flooring and structural walls. Keep existing windows, doors, ceiling, and room layout. STRICT FLOOR & WALL LOCK: Keep exact original hardwood/tile floor material, color, and wall paint unchanged. Zero snow or frost.",
                                        guidance_scale: 4.5
                                    });
                                }
                            }
                        } else {
                            inpaintPrompt = "DEEP TOTAL DECLUTTER PROTOCOL: Completely remove all loose clutter, mess, trash, cables, wires, cords, dishes, food, boxes, bags, shoes, clothes, laundry baskets, pet accessories, bottles, containers, papers, mail, and countertop/tabletop mess. Seamlessly reveal and inpaint clean, spotless, pristine architectural surfaces, countertops, and flooring matching the surrounding materials with photorealistic precision. STRICT FLOOR & WALL LOCK: Absolutely DO NOT change or replace floor materials, wood grain, tile pattern, or wall paint. Zero snow, zero winter ground cover.";
                            console.log("[AI Engine] Routing Declutter Inpaint to FLUX.1 [dev] Fill (fal-ai/flux-fill/dev / fal-ai/flux-lora-fill)");
                            usedFalModel = 'fal-ai/flux-fill/dev';
                            try {
                                falResult = await runFalWithRetry("fal-ai/flux-fill/dev", {
                                    prompt: inpaintPrompt,
                                    image_url: sourceUrl,
                                    mask_url: maskUrl
                                });
                            } catch (devFillErr) {
                                console.log("[AI Engine] fal-ai/flux-fill/dev not found, using official FLUX.1 [dev] Fill endpoint: fal-ai/flux-lora-fill");
                                usedFalModel = 'fal-ai/flux-lora-fill (FLUX.1 [dev] Fill)';
                                falResult = await runFalWithRetry("fal-ai/flux-lora-fill", {
                                    prompt: inpaintPrompt,
                                    image_url: sourceUrl,
                                    mask_url: maskUrl
                                });
                            }
                        }
                    } else {
                        console.log("[AI Engine] Routing Mask-Based Inpaint to FAL AI: fal-ai/flux-pro/v1/fill");
                        usedFalModel = 'fal-ai/flux-pro/v1/fill';
                        if (isDepersonalize) {
                            inpaintPrompt = "SURGICAL DEPERSONALIZATION: Replace the framed personal photo with neutral, high-end landscape or minimalist botanical artwork inside the frame. Strictly lock and preserve 100% of surrounding wall paint, wall color, and any furniture.";
                        } else if (upperPrompt.includes('WINDOW SPLASH') || upperPrompt.includes('INDOOR SUN') || upperPrompt.includes('WINDOW SUNBURST') || upperPrompt.includes('EXTERIOR WINDOW')) {
                            inpaintPrompt = "EXTERIOR WINDOW RELIGHTING: Strictly preserve exact existing trees, branches, foliage, lawn, patio, and outdoor landscaping completely unchanged. DO NOT CHANGE COLOR TEMPERATURE: Strictly keep the exact same original color temperature, white balance, and authentic colors without yellow casts or orange tinting. Cast bright natural direct sunlight highlights onto the existing vegetation and exterior ground seen through the window panes. Zero changes to tree shapes, structures, or window frames.";
                        } else if (isSunnySkies) {
                            inpaintPrompt = "Vibrant clear blue sunny outdoor sky with soft white clouds, warm realistic daylight. Do not put sky into windows.";
                        }

                        falResult = await runFalWithRetry("fal-ai/flux-pro/v1/fill", {
                            prompt: inpaintPrompt,
                            image_url: sourceUrl,
                            mask_url: maskUrl
                        });
                    }
                }
                // Case 3: Image editing tools, Virtual Staging, Declutter, Twilight, 360 tools (fal-ai/flux-pro/kontext)
                else {
                    const sourceUrl = await uploadToFalStorage(base64, mimeType || 'image/jpeg');

                    let effectivePrompt = prompt;
                    const upperPrompt = prompt.toUpperCase();
                    const isDeclutter = (upperPrompt.includes('DECLUTTER') || upperPrompt.includes('OBJECT_REMOVAL') || upperPrompt.includes('MAGIC ERASER') || upperPrompt.includes('REMOVE CABLES') || upperPrompt.includes('EMPTY ROOM') || upperPrompt.includes('EMPTY_ROOM') || upperPrompt.includes('CLEAN ARCHITECTURAL FLOOR')) && !isDepersonalize;
                    const isStaging = (
                        upperPrompt.includes('VIRTUAL STAGING') || 
                        upperPrompt.includes('FURNITURE') || 
                        upperPrompt.includes('STYLE SWAP') || 
                        upperPrompt.includes('VSTAGING') || 
                        upperPrompt.includes('MODERN STAGE') || 
                        upperPrompt.includes('STAGE') || 
                        upperPrompt.includes('STAGING')
                    ) && !upperPrompt.includes('WALL UNIFIER') && !upperPrompt.includes('WALL_UNIFIER') && !isDepersonalize;
                    if (isStaging) {
                        if (!effectivePrompt.includes('STRICT WALL COLOR LOCK')) {
                            effectivePrompt = `[STRICT_WALL_COLOR_LOCK: DO NOT CHANGE, REPAINT, OR ALTER ANY WALL COLORS. KEEP ALL EXISTING WALL COLORS AND WALL PAINT FINISHES 100% IDENTICAL AND UNTOUCHED TO THE ORIGINAL PHOTO.] ${effectivePrompt}`;
                            effectivePrompt += " STRICT ARCHITECTURAL PRESERVATION: Zero added walls, zero moved walls. Do NOT add, move, shift, or remove any walls, partitions, doors, windows, columns, or room boundaries. STRICT WALL COLOR LOCK: Absolutely DO NOT change, repaint, tint, or alter any wall colors, accent walls, or wall finishes. Keep existing wall colors, textures, and finishes 100% identical and unchanged to the source image. Keep exact original floorplan geometry and wall positions 100% identical. Only place freestanding furniture, rugs, and decor onto existing open floor space.";
                        }
                        if (!effectivePrompt.includes('STRICT_FLOOR_MATERIAL_AND_FINISH_LOCK') && !effectivePrompt.includes('STRICT FLOOR LOCK')) {
                            effectivePrompt = `[STRICT_FLOOR_LOCK: ABSOLUTELY DO NOT CHANGE, REPLACE, RESTAIN, BLEACH, OR ALTER ANY EXISTING FLOORING MATERIAL. Hardwood grain, wood stain color, plank width, plank direction, tile pattern, carpet texture, and grout must remain 100% identical and unchanged to the original photo. Any uncovered floor space where old furniture or rugs were moved must match the exact surrounding flooring material identically.] ${effectivePrompt}`;
                        }
                    }

                    if (isSunset) {
                        effectivePrompt = `[CRITICAL_GOLDEN_HOUR_SUNSET_DIRECTIVE]:
- VIBRANT GOLDEN-HOUR EXPOSURE: Transform the scene into a bright, vibrant golden-hour sunset architectural photo with high ambient light.
- STRICT PROHIBITION OF NIGHTTIME OR DARK TWILIGHT: ABSOLUTELY DO NOT render a dark, black, deep-blue, or underexposed night scene. Maintain clear daytime-to-sunset clarity across the house facade, walls, roof, lawn, and driveway.
- DRAMATIC SUNSET SKY: Replace sky above the horizon with luminous golden-hour sunset clouds featuring rich golden, peach, amber, and soft pink tones.
- WARM LIGHT ACCENTS: Gently illuminate windows and exterior lamps with a soft, inviting 2700K golden interior glow.
- ARCHITECTURAL PRESERVATION: Keep the property architecture, walls, geometry, materials, and landscaping 100% identical.
${effectivePrompt}`;
                    }

                    if (isDeclutter) {
                        const is360Pano = upperPrompt.includes('360') || upperPrompt.includes('EQUIRECTANGULAR') || upperPrompt.includes('PANORAMA') || upperPrompt.includes('P360');

                        if (is360Pano) {
                            console.log("[AI Engine] Extracting clutter & furniture mask via SAM2 (fal-ai/evf-sam) for 360 Declutter (fal-ai/flux-pro/v1/fill)...");
                            let autoClutterMaskUrl: string | null = null;
                            try {
                                const clutterPrompt = "furniture, clutter, objects, decor, tables, chairs, beds, trash, personal items, cables, rugs, boxes, mess";
                                let samRes: any;
                                try {
                                    console.log("[AI Engine] Trying fal-ai/evf-sam (EVF-SAM2)...");
                                    samRes = await runFalWithRetry("fal-ai/evf-sam", {
                                        image_url: sourceUrl,
                                        prompt: clutterPrompt
                                    });
                                } catch (evfErr) {
                                    try {
                                        console.log("[AI Engine] Retrying with fal-ai/sam-3/image...");
                                        samRes = await runFalWithRetry("fal-ai/sam-3/image", {
                                            image_url: sourceUrl,
                                            prompt: clutterPrompt
                                        });
                                    } catch (sam3Err) {
                                        console.log("[AI Engine] Retrying with fal-ai/sam2/auto-segment...");
                                        samRes = await runFalWithRetry("fal-ai/sam2/auto-segment", {
                                            image_url: sourceUrl
                                        });
                                    }
                                }
                                autoClutterMaskUrl = samRes?.data?.mask_url || 
                                                     samRes?.data?.mask?.url || 
                                                     samRes?.data?.combined_mask?.url ||
                                                     samRes?.data?.masks?.[0]?.url || 
                                                     samRes?.data?.image?.url || 
                                                     samRes?.mask_url || 
                                                     samRes?.combined_mask?.url ||
                                                     samRes?.masks?.[0]?.url || null;
                            } catch (samErr) {
                                console.log("[AI Engine] SAM2 mask extraction skipped, continuing with in-context model:", samErr);
                            }

                            const declutterFillPrompt = "ARCHITECTURAL DECLUTTER: Completely remove all furniture, clutter, tables, chairs, beds, rugs, and decor. Inpaint seamless, clean architectural floor and walls matching the surrounding room materials with photorealistic precision. STRICT FLOOR & WALL LOCK: Do not change floor material, wood stain, or wall paint. Zero snow.";
                            const declutterFullPrompt = "ARCHITECTURAL 360 DECLUTTER: Completely vacant, empty room. All furniture, sofas, chairs, tables, desks, beds, rugs, carpets, boxes, electronics, and clutter are completely removed. Pristine, clean, continuous architectural hardwood floor and plain walls. Original architectural windows, ceilings, and room perspective strictly preserved. STRICT FLOOR & WALL LOCK: Absolutely DO NOT change the existing flooring material, wood stain, or wall paint color. Zero snow, zero winter ground cover.";

                            if (autoClutterMaskUrl) {
                                console.log("[AI Engine] Routing 360 Panorama Declutter to FLUX.1 Pro Fill: fal-ai/flux-pro/v1/fill");
                                usedFalModel = 'fal-ai/sam2 + fal-ai/flux-pro/v1/fill';
                                try {
                                    falResult = await runFalWithRetry("fal-ai/flux-pro/v1/fill", {
                                        prompt: declutterFillPrompt,
                                        image_url: sourceUrl,
                                        mask_url: autoClutterMaskUrl
                                    });
                                } catch (fillErr) {
                                    console.warn("[AI Engine] fal-ai/flux-pro/v1/fill failed, falling back to FLUX.1 [dev] Fill:", fillErr);
                                    try {
                                        usedFalModel = 'fal-ai/flux-fill/dev';
                                        falResult = await runFalWithRetry("fal-ai/flux-fill/dev", {
                                            prompt: declutterFillPrompt,
                                            image_url: sourceUrl,
                                            mask_url: autoClutterMaskUrl
                                        });
                                    } catch (devErr) {
                                        usedFalModel = 'fal-ai/flux-pro/kontext';
                                        falResult = await runFalWithRetry("fal-ai/flux-pro/kontext", {
                                            image_url: sourceUrl,
                                            prompt: declutterFullPrompt,
                                            guidance_scale: 4.5
                                        });
                                    }
                                }
                            } else {
                                console.log("[AI Engine] Routing 360 Panorama Declutter to FAL AI: fal-ai/flux-pro/kontext (guidance: 4.5)");
                                usedFalModel = 'fal-ai/flux-pro/kontext';
                                const kontextInput: any = {
                                    image_url: sourceUrl,
                                    prompt: declutterFullPrompt,
                                    guidance_scale: 4.5
                                };
                                falResult = await runFalWithRetry("fal-ai/flux-pro/kontext", kontextInput);
                            }
                        } else {
                            // Check if an automatic clutter mask can be derived using SAM-3 to feed into FLUX.1 [dev] Fill
                            let autoClutterMaskUrl: string | null = null;
                            const deepClutterPrompt = "clutter, mess, trash, loose objects, personal items, cables, cords, wires, dishes, cups, bottles, containers, papers, mail, clothes, shoes, bags, boxes, storage bins, laundry baskets, toiletries, knickknacks, tabletop mess, countertop clutter";
                            try {
                                console.log("[AI Engine] Extracting comprehensive clutter mask via SAM-3 for FLUX.1 [dev] Fill...");
                                const samRes: any = await runFalWithRetry("fal-ai/sam-3/image", {
                                    image_url: sourceUrl,
                                    prompt: deepClutterPrompt
                                });
                                autoClutterMaskUrl = samRes.data?.mask_url || samRes.data?.mask?.url || samRes.data?.masks?.[0]?.url || samRes.data?.image?.url || null;
                            } catch (samErr) {
                                console.log("[AI Engine] Automatic clutter mask extraction skipped, continuing with in-context model");
                            }

                            const deepInpaintPrompt = "DEEP TOTAL DECLUTTER PROTOCOL: Completely remove all loose clutter, mess, trash, cables, wires, cords, dishes, food, boxes, bags, shoes, clothes, laundry baskets, pet accessories, bottles, containers, papers, mail, and countertop/tabletop mess. Seamlessly reveal and inpaint clean, spotless, pristine architectural surfaces, countertops, and flooring matching the surrounding materials with photorealistic precision. STRICT FLOOR & WALL LOCK: Absolutely DO NOT change floor material, wood grain, tile pattern, or wall paint. Zero snow, zero winter ground cover.";

                            if (autoClutterMaskUrl) {
                                console.log("[AI Engine] Auto-clutter mask found, routing to FLUX.1 [dev] Fill");
                                usedFalModel = 'fal-ai/flux-fill/dev';
                                try {
                                    falResult = await runFalWithRetry("fal-ai/flux-fill/dev", {
                                        prompt: deepInpaintPrompt,
                                        image_url: sourceUrl,
                                        mask_url: autoClutterMaskUrl
                                    });
                                } catch {
                                    usedFalModel = 'fal-ai/flux-lora-fill (FLUX.1 [dev] Fill)';
                                    falResult = await runFalWithRetry("fal-ai/flux-lora-fill", {
                                        prompt: deepInpaintPrompt,
                                        image_url: sourceUrl,
                                        mask_url: autoClutterMaskUrl
                                    });
                                }
                            } else {
                                console.log("[AI Engine] Routing Image Edit to FAL AI: fal-ai/flux-pro/kontext (guidance: 4.5 for deep declutter)");
                                usedFalModel = 'fal-ai/flux-pro/kontext';
                                const kontextInput: any = {
                                    image_url: sourceUrl,
                                    prompt: "DEEP TOTAL DECLUTTER PROTOCOL: Completely remove all clutter, trash, cables, wires, cords, dishes, cups, bottles, papers, boxes, bags, shoes, clothes, toiletries, and mess from all tables, countertops, desks, shelves, and floors. Reveal pristine, clean, spotless surfaces and immaculate flooring. Keep all permanent architecture, walls, ceilings, windows, and primary major furniture (sofas, beds, dining tables, cabinets) completely untouched. STRICT FLOOR & WALL LOCK: Absolutely DO NOT change, restain, bleach, or replace the existing flooring material, wood grain, tile, or carpet. Uncovered floor areas must match the surrounding floor 100% identically. Absolutely DO NOT change or repaint wall colors. ZERO WEATHER ALTERATION: Strictly DO NOT add snow, frost, or white ground cover.",
                                    guidance_scale: 4.5
                                };
                                falResult = await runFalWithRetry("fal-ai/flux-pro/kontext", kontextInput);
                            }
                        }
                    } else if (isDepersonalize) {
                        console.log("[AI Engine] Routing Depersonalization to FAL AI: fal-ai/flux-pro/kontext (strict zero-furniture and zero-wall-color lock)");
                        usedFalModel = 'fal-ai/flux-pro/kontext';
                        const kontextInput: any = {
                            image_url: sourceUrl,
                            prompt: "SURGICAL DEPERSONALIZATION: Only replace family photos, personal portraits, and personal pictures in frames with neutral generic landscape or botanical art inside the existing frame. STRICT MANDATORY LOCK: Absolutely DO NOT change ANY furniture or wall colors. All sofas, chairs, tables, desks, rugs, and furniture must remain 100% strictly identical. All wall paint colors and textures must remain 100% strictly identical.",
                            guidance_scale: 2.0
                        };
                        falResult = await runFalWithRetry("fal-ai/flux-pro/kontext", kontextInput);
                    } else {
                        console.log("[AI Engine] Routing Image Edit to FAL AI: fal-ai/flux-pro/kontext");
                        usedFalModel = 'fal-ai/flux-pro/kontext';
                        const kontextInput: any = {
                            image_url: sourceUrl,
                            prompt: effectivePrompt
                        };
                        falResult = await runFalWithRetry("fal-ai/flux-pro/kontext", kontextInput);
                    }
                }

                const outUrl = falResult.data?.images?.[0]?.url || 
                               falResult.data?.image?.url || 
                               falResult.images?.[0]?.url || 
                               falResult.image?.url;

                if (outUrl) {
                    const imgFetch = await fetch(outUrl);
                    if (imgFetch.ok) {
                        const imgBuf = await imgFetch.arrayBuffer();
                        const outBase64 = Buffer.from(imgBuf).toString('base64');
                        res.setHeader('X-AI-Engine', usedFalModel);
                        return res.json({ data: outBase64, engine: usedFalModel });
                    }
                }
            } catch (falErr) {
                console.error("FAL API generation error, falling back to Gemini:", falErr);
            }
        }

        let response;
        const genAi = getAi();

        const buildParams = (mName: string, reqSize?: string) => {
            const params: any = {
                model: mName,
                contents: { parts }
            };
            if (mName === 'gemini-3.1-flash-image' || mName === 'gemini-3-pro-image') {
                params.config = {
                    imageConfig: { imageSize: reqSize || (imageSize === '2K' ? '2K' : '1K'), aspectRatio: aspectName || "4:3" }
                };
            }
            return params;
        };

        try {
            const requestedSize = imageSize === '2K' ? '2K' : '1K';
            response = await genAi.models.generateContent(buildParams(targetModel, requestedSize));
        } catch (err: any) {
            const errStr = String(err);
            const isQuotaError = errStr.includes('429') || 
                                 errStr.includes('RESOURCE_EXHAUSTED') || 
                                 errStr.includes('quota') || 
                                 errStr.includes('FreeTier') ||
                                 (err.status === 429);
            
            // If 2K was requested and failed, attempt immediate graceful retry at 1K
            if (imageSize === '2K' && targetModel === 'gemini-3.1-flash-image') {
                console.warn("[AI Engine] 2K generation hit limitation, retrying at 1K resolution...");
                try {
                    response = await genAi.models.generateContent(buildParams(targetModel, '1K'));
                } catch (retryErr: any) {
                    const retryErrStr = String(retryErr);
                    if (retryErrStr.includes('429') || retryErrStr.includes('RESOURCE_EXHAUSTED') || retryErr.status === 429) {
                        console.warn(`Primary image model ${targetModel} hit quota limit. Retrying with gemini-3.1-flash-lite-image...`);
                        targetModel = 'gemini-3.1-flash-lite-image';
                        try {
                            response = await genAi.models.generateContent(buildParams(targetModel, '1K'));
                        } catch (liteErr) {
                            if (process.env.FAL_KEY) {
                                console.warn("[AI Engine] Gemini quota exhausted, performing fallback to FAL AI Flux Pro Kontext...");
                                const sourceUrl = await uploadToFalStorage(base64, mimeType || 'image/jpeg');
                                const falFallbackResult: any = await runFalWithRetry("fal-ai/flux-pro/kontext", {
                                    prompt: prompt,
                                    image_url: sourceUrl,
                                    guidance_scale: 3.5,
                                    num_inference_steps: 28
                                });
                                const outUrl = falFallbackResult?.data?.images?.[0]?.url || 
                                               falFallbackResult?.data?.image?.url || 
                                               falFallbackResult?.images?.[0]?.url || 
                                               falFallbackResult?.image?.url;
                                if (outUrl) {
                                    const imgFetch = await fetch(outUrl);
                                    if (imgFetch.ok) {
                                        const arrBuf = await imgFetch.arrayBuffer();
                                        const outBase64 = Buffer.from(arrBuf).toString('base64');
                                        res.setHeader('X-AI-Engine', 'fal-ai/flux-pro/kontext');
                                        return res.json({ data: outBase64, engine: 'fal-ai/flux-pro/kontext' });
                                    }
                                }
                            }
                            throw liteErr;
                        }
                    } else {
                        throw retryErr;
                    }
                }
            } else if (isQuotaError && targetModel !== 'gemini-3.1-flash-lite-image') {
                console.warn(`Primary image model ${targetModel} hit quota limit. Retrying automatically with fallback gemini-3.1-flash-lite-image...`);
                targetModel = 'gemini-3.1-flash-lite-image';
                try {
                    response = await genAi.models.generateContent(buildParams(targetModel, '1K'));
                } catch (liteErr) {
                    if (process.env.FAL_KEY) {
                        console.warn("[AI Engine] Gemini quota exhausted, performing fallback to FAL AI Flux Pro Kontext...");
                        const sourceUrl = await uploadToFalStorage(base64, mimeType || 'image/jpeg');
                        const falFallbackResult: any = await runFalWithRetry("fal-ai/flux-pro/kontext", {
                            prompt: prompt,
                            image_url: sourceUrl,
                            guidance_scale: 3.5,
                            num_inference_steps: 28
                        });
                        const outUrl = falFallbackResult?.data?.images?.[0]?.url || 
                                       falFallbackResult?.data?.image?.url || 
                                       falFallbackResult?.images?.[0]?.url || 
                                       falFallbackResult?.image?.url;
                        if (outUrl) {
                            const imgFetch = await fetch(outUrl);
                            if (imgFetch.ok) {
                                const arrBuf = await imgFetch.arrayBuffer();
                                const outBase64 = Buffer.from(arrBuf).toString('base64');
                                res.setHeader('X-AI-Engine', 'fal-ai/flux-pro/kontext');
                                return res.json({ data: outBase64, engine: 'fal-ai/flux-pro/kontext' });
                            }
                        }
                    }
                    throw liteErr;
                }
            } else {
                if (isQuotaError && process.env.FAL_KEY) {
                    console.warn("[AI Engine] Gemini quota exhausted, performing fallback to FAL AI Flux Pro Kontext...");
                    const sourceUrl = await uploadToFalStorage(base64, mimeType || 'image/jpeg');
                    const falFallbackResult: any = await runFalWithRetry("fal-ai/flux-pro/kontext", {
                        prompt: prompt,
                        image_url: sourceUrl,
                        guidance_scale: 3.5,
                        num_inference_steps: 28
                    });
                    const outUrl = falFallbackResult?.data?.images?.[0]?.url || 
                                   falFallbackResult?.data?.image?.url || 
                                   falFallbackResult?.images?.[0]?.url || 
                                   falFallbackResult?.image?.url;
                    if (outUrl) {
                        const imgFetch = await fetch(outUrl);
                        if (imgFetch.ok) {
                            const arrBuf = await imgFetch.arrayBuffer();
                            const outBase64 = Buffer.from(arrBuf).toString('base64');
                            res.setHeader('X-AI-Engine', 'fal-ai/flux-pro/kontext');
                            return res.json({ data: outBase64, engine: 'fal-ai/flux-pro/kontext' });
                        }
                    }
                }
                throw err;
            }
        }

        const candidate = response.candidates?.[0];
        const part = candidate?.content?.parts?.find(p => p.inlineData);
        if (part) {
            res.setHeader('X-AI-Engine', targetModel);
            res.json({ data: part.inlineData.data, engine: targetModel });
        } else {
            console.error("No image part in response", JSON.stringify(response));
            res.status(500).json({ error: "No image received from AI. This usually means the model refused the request or the API key doesn't support image generation." });
        }
    } catch (e) {
        console.error("Image edit failed", e);
        const { status, message } = parseGeminiError(e);
        res.status(status).json({ error: message });
    }
});

app.post("/api/generate-mask", async (req, res) => {
    const { base64, mimeType, target } = req.body;
    try {
        // If FAL_KEY is present, use fal-ai/sam-3/image for automatic sky, surface, clutter, or window masks
        const falKey = process.env.FAL_KEY;
        if (falKey) {
            try {
                const sourceUrl = await uploadToFalStorage(base64, mimeType || 'image/jpeg');
                const samPrompt = target === 'sky' 
                    ? 'sky, clouds' 
                    : target === 'window' || target === 'windows' 
                    ? 'window, window glass, window pane' 
                    : target === 'clutter' 
                    ? 'clutter, mess, trash, loose objects, personal items, cables, cords, wires, dishes, cups, bottles, containers, papers, mail, clothes, shoes, bags, boxes, storage bins, laundry baskets, toiletries, knickknacks, tabletop mess, countertop clutter' 
                    : target || 'sky';

                let samResult: any;
                let usedSamModel = 'fal-ai/sam-3/image';

                if (target === 'clutter') {
                    console.log(`[AI Engine] Generating clutter mask via FAL SAM2 (fal-ai/evf-sam)...`);
                    usedSamModel = 'fal-ai/evf-sam';
                    try {
                        samResult = await runFalWithRetry("fal-ai/evf-sam", {
                            image_url: sourceUrl,
                            prompt: samPrompt
                        });
                    } catch (evfErr) {
                        try {
                            console.log(`[AI Engine] Retrying with fal-ai/sam-3/image...`);
                            usedSamModel = 'fal-ai/sam-3/image';
                            samResult = await runFalWithRetry("fal-ai/sam-3/image", {
                                image_url: sourceUrl,
                                prompt: samPrompt
                            });
                        } catch (sam3Err) {
                            console.log(`[AI Engine] Retrying with fal-ai/sam2/auto-segment...`);
                            usedSamModel = 'fal-ai/sam2/auto-segment';
                            samResult = await runFalWithRetry("fal-ai/sam2/auto-segment", {
                                image_url: sourceUrl
                            });
                        }
                    }
                } else {
                    console.log(`[AI Engine] Generating automatic mask via FAL SAM-3 (fal-ai/sam-3/image) for target: ${target}`);
                    samResult = await runFalWithRetry("fal-ai/sam-3/image", {
                        image_url: sourceUrl,
                        prompt: samPrompt
                    });
                }

                const maskUrl = samResult?.data?.mask_url || 
                                samResult?.data?.mask?.url || 
                                samResult?.data?.combined_mask?.url ||
                                samResult?.data?.masks?.[0]?.url ||
                                samResult?.data?.image?.url || 
                                samResult?.mask_url || 
                                samResult?.combined_mask?.url ||
                                samResult?.masks?.[0]?.url ||
                                samResult?.image?.url;

                if (maskUrl) {
                    if (maskUrl.startsWith('data:')) {
                        const base64Data = maskUrl.split(',')[1];
                        return res.json({ data: base64Data, engine: usedSamModel });
                    }
                    const maskFetch = await fetch(maskUrl);
                    if (maskFetch.ok) {
                        const maskBuf = await maskFetch.arrayBuffer();
                        const maskOutBase64 = Buffer.from(maskBuf).toString('base64');
                        return res.json({ data: maskOutBase64, engine: usedSamModel });
                    }
                }
            } catch (falSamErr) {
                console.warn("FAL SAM-3 mask generation failed, falling back to algorithmic / Gemini:", falSamErr);
            }
        }

        const genAi = getAi();
        let response;
        try {
            response = await genAi.models.generateContent({
                model: 'gemini-3.1-flash-lite-image',
                contents: {
                    parts: [
                        { inlineData: { data: ensureBase64(base64), mimeType } },
                        { text: target === 'sky' ? "Generate a strict high-contrast binary mask isolating ONLY the open outdoor sky and clouds above the roofline/horizon. Pure White = Outdoor open sky ONLY. Pure Black = All buildings, house walls, roofs, windows, window glass, window reflections, trees, foliage, and structures. House windows MUST be Pure Black." : `Generate binary mask for: ${target}. White=Target, Black=Rest.` }
                    ]
                }
            });
        } catch (err: any) {
            const errStr = String(err);
            const isQuotaError = errStr.includes('429') || 
                                 errStr.includes('RESOURCE_EXHAUSTED') || 
                                 errStr.includes('quota') || 
                                 errStr.includes('FreeTier') ||
                                 (err.status === 429);
            
            if (isQuotaError) {
                console.warn("Mask target model hit quota limit.");
            }
            throw err;
        }
        const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (part) res.json({ data: part.inlineData.data });
        else res.status(500).json({ error: "Mask generation failed" });
    } catch (e) {
        console.error("Mask failed", e);
        const { status, message } = parseGeminiError(e);
        res.status(status).json({ error: message });
    }
});

app.post("/api/generate-video", async (req, res) => {
    const { base64, mimeType, prompt, aspectRatio, toolId } = req.body;
    try {
        const falKey = process.env.FAL_KEY;
        if (falKey) {
            try {
                const isCustomVideo = toolId === 'custom_video';
                const isFurnitureBuild = toolId === 'furniture_build_video' ||
                                        (prompt && (prompt.toLowerCase().includes('furniture build') || prompt.toLowerCase().includes('furniture being assembled') || prompt.toLowerCase().includes('furniture assembling')));

                const isDawnOrSun = toolId === 'dawn_to_dusk_video' || 
                                    toolId === 'sunny_skies_video' ||
                                    (prompt && (prompt.includes('sunset sky') || prompt.includes('dusk/twilight') || prompt.includes('vibrant sunny afternoon')));

                // All premium video tools (Furniture Build, Dawn to Dusk, Sun Morph, Custom Video)
                // now use the exact same flagship generation tool pipeline: MiniMax H3-Max (minimax/h3-max/image-to-video)
                const endpointsToTry: string[] = [
                    "minimax/h3-max/image-to-video",
                    "minimax/h3/image-to-video",
                    "fal-ai/minimax/video-01/image-to-video",
                    "fal-ai/wan-i2v"
                ];

                console.log(`[AI Engine] Generating video for tool ${toolId || 'generic'}... Candidates: ${endpointsToTry.join(', ')}`);
                const sourceUrl = await uploadToFalStorage(base64, mimeType || 'image/jpeg');

                let result: any;
                let lastError: any = null;
                let successfulEndpoint = '';
                for (const endpoint of endpointsToTry) {
                    try {
                        console.log(`[AI Engine] Attempting video generation via ${endpoint}...`);
                        const isMiniMax = endpoint.includes('minimax');
                        let finalPrompt = prompt || 'A high-end cinematic architectural video with smooth motion and realistic lighting';
                        
                        if (toolId === 'dawn_to_dusk_video' || (prompt && prompt.includes('dusk/twilight'))) {
                            finalPrompt = `[CRITICAL_TIMELINE_PACING: SLOW SUNSET TRANSITION - DUSK AT THE END ONLY]
${finalPrompt}
STRICT TIMELINE DIRECTIVES:
1. Pacing must be extremely slow, continuous, and gradual across the entire clip duration.
2. The first 60% of the video MUST remain in bright, sunny, clear daytime lighting.
3. Only past the halfway mark does the sky slowly begin softening into warm golden-hour and sunset colors.
4. Interior and exterior architectural lighting gently turn on.
5. Deep dusk, twilight sky, and nighttime atmospheric glow only settle in during the final 15-20% at the very end of the video.
6. Zero sudden darkness, zero abrupt exposure drops. Ultra-smooth cinematic transition throughout.`;
                        }

                        const falInput: any = {
                            prompt: finalPrompt,
                            image_url: sourceUrl
                        };

                        // Aspect ratio is passed for models that declare aspect_ratio support (e.g. Wan-i2v).
                        // MiniMax image-to-video adopts the input image's aspect ratio automatically.
                        if (!isMiniMax && aspectRatio) {
                            falInput.aspect_ratio = aspectRatio;
                        }

                        // Request 1080p high definition for Wan
                        if (endpoint.includes('wan')) {
                            falInput.resolution = "1080p";
                        }

                        // Try via fal.subscribe first, fall back to runFalWithRetry if needed
                        try {
                            result = await fal.subscribe(endpoint, {
                                input: falInput
                            });
                        } catch (subErr) {
                            console.warn(`[AI Engine] fal.subscribe on ${endpoint} failed, attempting runFalWithRetry queue method...`, subErr);
                            result = await runFalWithRetry(endpoint, falInput);
                        }

                        if (result) {
                            successfulEndpoint = endpoint;
                            console.log(`[AI Engine] Video generation succeeded via ${endpoint}`);
                            break;
                        }
                    } catch (err: any) {
                        console.warn(`[AI Engine] Endpoint ${endpoint} failed:`, err?.message || err);
                        lastError = err;
                    }
                }

                if (!result && lastError) {
                    throw lastError;
                }

                const videoUrl = result?.data?.video?.url || 
                                 result?.video?.url || 
                                 result?.data?.videos?.[0]?.url || 
                                 result?.videos?.[0]?.url ||
                                 result?.data?.file?.url ||
                                 result?.file?.url;

                if (videoUrl) {
                    const videoRes = await fetch(videoUrl);
                    if (videoRes.ok) {
                        const arrayBuffer = await videoRes.arrayBuffer();
                        const outBase64 = Buffer.from(arrayBuffer).toString('base64');
                        return res.json({ 
                            videoUrl: `data:video/mp4;base64,${outBase64}`, 
                            directVideo: true, 
                            engine: successfulEndpoint || 'minimax/h3-max/image-to-video' 
                        });
                    }
                }
            } catch (falVidErr) {
                console.warn("FAL Video generation failed, falling back to Veo:", falVidErr);
            }
        }

        const genAi = getAi();
        const selectedAspect = (aspectRatio === '9:16' ? '9:16' : '16:9');
        const operation = await genAi.models.generateVideos({
            model: 'veo-3.1-lite-generate-preview',
            prompt: prompt || 'A high-end cinematic architectural time-lapse video',
            image: {
                imageBytes: ensureBase64(base64),
                mimeType: mimeType || 'image/png',
            },
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: selectedAspect
            }
        });
        res.json({ operationName: operation.name });
    } catch (e) {
        console.error("Generate video failed", e);
        const { status, message } = parseGeminiError(e);
        res.status(status).json({ error: message });
    }
});

app.post("/api/video-status", async (req, res) => {
    const { operationName } = req.body;
    try {
        if (!operationName) {
            return res.status(400).json({ error: "Missing operationName" });
        }
        const genAi = getAi();
        const op = new GenerateVideosOperation();
        op.name = operationName;
        const updated = await genAi.operations.getVideosOperation({ operation: op });
        res.json({ done: !!updated.done, error: updated.error });
    } catch (e) {
        console.error("Video status failed", e);
        const { status, message } = parseGeminiError(e);
        res.status(status).json({ error: message });
    }
});

app.post("/api/video-download", async (req, res) => {
    const { operationName } = req.body;
    try {
        if (!operationName) {
            return res.status(400).json({ error: "Missing operationName" });
        }
        const genAi = getAi();
        const op = new GenerateVideosOperation();
        op.name = operationName;
        const updated = await genAi.operations.getVideosOperation({ operation: op });

        if (!updated.done) {
            return res.status(400).json({ error: "Video generation operation is still in progress." });
        }

        const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
        if (!uri) {
            return res.status(500).json({ error: "No video URI returned from generation operation." });
        }

        const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
        const videoRes = await fetch(uri, {
            headers: apiKey ? { 'x-goog-api-key': apiKey } : {},
        });

        if (!videoRes.ok) {
            throw new Error(`Failed to fetch generated video asset (${videoRes.status}): ${videoRes.statusText}`);
        }

        const arrayBuffer = await videoRes.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        res.json({ videoUrl: `data:video/mp4;base64,${base64}` });
    } catch (e) {
        console.error("Video download failed", e);
        const { status, message } = parseGeminiError(e);
        res.status(status).json({ error: message });
    }
});

// --- STRIPE INTEGRATION SERVICE ---

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
    if (!stripeClient) {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) {
            throw new Error('STRIPE_SECRET_KEY environment variable is not configured');
        }
        stripeClient = new Stripe(key);
    }
    return stripeClient;
}

const SERVER_CREDIT_PACKS: Record<string, { name: string; credits: number; priceInCents: number; currency: string; photoEdits: string }> = {
    pack_starter: {
        name: 'Starter Pack',
        credits: 5400,
        priceInCents: 2500,
        currency: 'cad',
        photoEdits: '~180 Photo Edits'
    },
    pack_pro: {
        name: 'Pro Agent Pack',
        credits: 17500,
        priceInCents: 7700,
        currency: 'cad',
        photoEdits: '~583 Photo Edits'
    },
    pack_agency: {
        name: 'Brokerage / Media Pack',
        credits: 44000,
        priceInCents: 17500,
        currency: 'cad',
        photoEdits: '~1,466 Photo Edits'
    }
};

// Check if Stripe is configured on the backend
app.get("/api/stripe/status", (req, res) => {
    const isConfigured = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.trim() !== '');
    res.json({
        configured: isConfigured,
        isTestMode: Boolean(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')),
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
        currency: 'cad'
    });
});

// Create a Stripe Checkout session
app.post("/api/stripe/create-checkout-session", async (req, res) => {
    try {
        const { packId, userId, userEmail, returnUrl } = req.body;
        if (!packId || !SERVER_CREDIT_PACKS[packId]) {
            return res.status(400).json({ error: "Invalid credit pack selected." });
        }

        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(400).json({
                error: "STRIPE_SECRET_KEY is not configured in server environment. Please configure it in Settings > Secrets or use Instant Sandbox Mode.",
                stripeConfigured: false
            });
        }

        const pack = SERVER_CREDIT_PACKS[packId];
        const stripe = getStripe();

        // Determine base URL for redirect
        let origin = 'http://localhost:3000';
        if (returnUrl) {
            try {
                origin = new URL(returnUrl).origin;
            } catch (uErr) {
                // Ignore parse errors
            }
        } else if (req.headers.origin) {
            origin = req.headers.origin as string;
        } else if (req.headers.referer) {
            try {
                origin = new URL(req.headers.referer).origin;
            } catch (rErr) {}
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: pack.currency,
                        product_data: {
                            name: `PMD Digital Media - ${pack.name}`,
                            description: `${pack.credits.toLocaleString()} AI Image, Virtual Staging & Video Credits (${pack.photoEdits})`,
                        },
                        unit_amount: pack.priceInCents,
                    },
                    quantity: 1,
                }
            ],
            mode: 'payment',
            customer_email: userEmail || undefined,
            client_reference_id: userId || undefined,
            metadata: {
                userId: userId || 'anonymous',
                userEmail: userEmail || '',
                packId,
                credits: String(pack.credits),
                packName: pack.name
            },
            success_url: `${origin}/?stripe_session_id={CHECKOUT_SESSION_ID}&stripe_status=success&pack_id=${packId}`,
            cancel_url: `${origin}/?stripe_status=cancelled`,
        });

        res.json({ id: session.id, url: session.url });
    } catch (err: any) {
        console.error("[Stripe] Failed to create checkout session:", err);
        res.status(500).json({ error: err.message || "Failed to create Stripe checkout session." });
    }
});

// Verify completed Stripe checkout session
app.post("/api/stripe/verify-session", async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) {
            return res.status(400).json({ error: "Missing sessionId parameter." });
        }

        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(400).json({ error: "STRIPE_SECRET_KEY is not configured." });
        }

        const stripe = getStripe();
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === 'paid') {
            const credits = Number(session.metadata?.credits || 0);
            const packId = session.metadata?.packId || '';
            const userId = session.metadata?.userId || session.client_reference_id || '';
            const userEmail = session.customer_details?.email || session.metadata?.userEmail || '';

            res.json({
                paid: true,
                sessionId: session.id,
                paymentIntentId: session.payment_intent,
                credits,
                packId,
                userId,
                userEmail,
                amountTotal: session.amount_total,
                currency: session.currency,
                created: session.created
            });
        } else {
            res.json({
                paid: false,
                status: session.payment_status,
                sessionId: session.id
            });
        }
    } catch (err: any) {
        console.error("[Stripe] Session verification failed:", err);
        res.status(500).json({ error: err.message || "Failed to verify Stripe checkout session." });
    }
});

// Stripe webhook handler
app.post("/api/stripe/webhook", async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret || !sig || !process.env.STRIPE_SECRET_KEY) {
        return res.json({ received: true, note: "Stripe key or webhook secret not configured." });
    }

    try {
        const stripe = getStripe();
        const event = stripe.webhooks.constructEvent(
            (req as any).rawBody || JSON.stringify(req.body),
            sig,
            webhookSecret
        );

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            console.log(`[Stripe Webhook] Payment confirmed for session ${session.id}. User: ${session.metadata?.userId}, Credits: ${session.metadata?.credits}`);
        }

        res.json({ received: true });
    } catch (err: any) {
        console.error("[Stripe Webhook] Verification error:", err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
    }
});

// --- VITE MIDDLEWARE ---

async function startServer() {
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
