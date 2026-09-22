
import axios from "axios";
import { cropToRatio, applySurgicalComposite, padToRatio, processImageForApi, generateAlgorithmicSkyMask, dilateMask } from "./imageUtils";
import { ImagePreAnalysis } from "../types";

/**
 * PMD Studio - AI Service Layer
 * Proxies requests to the backend server to protect API keys.
 */

const api = axios.create({
    baseURL: '/api',
    timeout: 300000 // 5 minutes
});

export const stringifyError = (err: any): string => {
  if (!err) return "Unknown Error";
  if (typeof err === 'string') return err;
  
  try {
    const target = err.response?.data || err.error || err;
    if (target instanceof Error) return target.message;
    if (typeof target === 'string') return target;
    
    const message = target.message || 
                    (typeof target.error === 'string' ? target.error : target.error?.message) ||
                    target.statusText || 
                    (typeof target === 'object' ? JSON.stringify(target) : String(target));
                    
    if (message && message !== '{}' && message !== '[object Object]') return message;
    
    return "An unexpected error occurred. Check console for details.";
  } catch (e) {
    return "Failed to parse error message.";
  }
};

export const enhancePrompt = async (rawPrompt: string): Promise<string> => {
  if (!rawPrompt.trim()) return '';
  try {
    const response = await api.post('/enhance-prompt', { prompt: rawPrompt });
    return response.data.enhancedPrompt;
  } catch (e) {
    console.error("Prompt enhancement failed", e);
    return rawPrompt;
  }
};

export interface BundledAnalysis {
  listingDescription: string;
  roomType: string;
  keyFeatures: string[];
  suggestedStyles: string[];
}

export const generateBundledListing = async (imageBase64: string, mimeType: string): Promise<BundledAnalysis> => {
  try {
    const optimized = await processImageForApi(`data:${mimeType};base64,${imageBase64}`, 512);
    const response = await api.post('/generate-bundled-listing', { base64: optimized.base64, mimeType: optimized.mimeType });
    return response.data;
  } catch (e) {
    console.error("Bundled generation failed", e);
    throw e;
  }
};

/**
 * Option 2: AI-Powered Pre-Analysis (Gemini Vision)
 * Inspects room type, scene attributes, clutter items, lighting, flooring,
 * and recommends optimal studio tools & virtual staging configuration.
 */
export const analyzeImageVision = async (imageBase64: string, mimeType: string = 'image/jpeg'): Promise<ImagePreAnalysis> => {
  try {
    const optimized = await processImageForApi(`data:${mimeType};base64,${imageBase64}`, 768);
    const response = await api.post('/pre-analysis', { 
      base64: optimized.base64, 
      mimeType: optimized.mimeType 
    });
    return response.data;
  } catch (e) {
    console.error("AI Pre-Analysis failed:", e);
    throw e;
  }
};

export interface LuxuryMarketingPack {
  mlsDescription: string;
  socialMediaPack: {
    facebook: string;
    linkedIn: string;
    tiktokStories: string;
    pinterest: string;
    xTwitter: string;
  };
  emailBlast: string;
  uniqueSellingPoints: string[];
}

export const generateLuxuryMarketingCopy = async (images: { base64: string, mimeType: string }[]): Promise<LuxuryMarketingPack> => {
  try {
    const optimizedImages = await Promise.all(images.map(img => 
      processImageForApi(`data:${img.mimeType};base64,${img.base64}`, 512)
    ));
    const response = await api.post('/generate-luxury-copy', { images: optimizedImages });
    return response.data;
  } catch (e) {
    console.error("Luxury copy generation failed", e);
    throw e;
  }
};

export const generateVideoFromImage = async (
    imageBase64: string,
    prompt: string,
    aspectRatio: '16:9' | '9:16' = '16:9',
    toolId?: string
): Promise<string> => {
    try {
        let inputDataUrl = `data:image/png;base64,${imageBase64}`;
        const targetNumericRatio = aspectRatio === '9:16' ? (9 / 16) : (16 / 9);
        try {
            inputDataUrl = await cropToRatio(inputDataUrl, targetNumericRatio);
        } catch (cropErr) {
            console.warn("Pre-cropping for video aspect ratio failed, proceeding with original:", cropErr);
        }

        const optimized = await processImageForApi(inputDataUrl, 1024);
        
        const startRes = await api.post('/generate-video', {
            base64: optimized.base64,
            mimeType: optimized.mimeType,
            prompt,
            aspectRatio,
            toolId
        });
        
        // Direct video response returned by synchronous / subscribed fal models (Wan/Kling video)
        if (startRes.data?.videoUrl) {
            return startRes.data.videoUrl;
        }

        const { operationName } = startRes.data;
        if (!operationName) {
            throw new Error("Failed to start video generation operation.");
        }

        const startTime = Date.now();
        const timeoutMs = 300000; // 5 minute max timeout
        let isDone = false;

        while (Date.now() - startTime < timeoutMs) {
            await new Promise(res => setTimeout(res, 5000));
            const statusRes = await api.post('/video-status', { operationName });
            
            if (statusRes.data.error) {
                const errObj = statusRes.data.error;
                throw new Error(typeof errObj === 'string' ? errObj : errObj.message || "Video generation operation failed.");
            }

            if (statusRes.data.done) {
                isDone = true;
                break;
            }
        }

        if (!isDone) {
            throw new Error("Video generation timed out after 5 minutes.");
        }

        const downloadRes = await api.post('/video-download', { operationName });
        if (!downloadRes.data.videoUrl) {
            throw new Error("Download completed but no video payload was returned.");
        }

        return downloadRes.data.videoUrl;
    } catch (e) {
        console.error("Video generation failed", e);
        throw new Error(stringifyError(e));
    }
};

export const generateDawnToDuskVideo = async (
    imageBase64: string,
    prompt: string,
    aspectRatio: '16:9' | '9:16' = '16:9'
): Promise<string> => {
    return generateVideoFromImage(imageBase64, prompt, aspectRatio, 'dawn_to_dusk_video');
};

export const generateSunnySkiesVideo = async (
    imageBase64: string,
    prompt: string,
    aspectRatio: '16:9' | '9:16' = '16:9'
): Promise<string> => {
    return generateVideoFromImage(imageBase64, prompt, aspectRatio, 'sunny_skies_video');
};

export const generateFurnitureBuildVideo = async (
    imageBase64: string,
    prompt: string,
    aspectRatio: '16:9' | '9:16' = '16:9'
): Promise<string> => {
    return generateVideoFromImage(imageBase64, prompt, aspectRatio, 'furniture_build_video');
};

export const generateCustomVideo = async (
    imageBase64: string,
    prompt: string,
    aspectRatio: '16:9' | '9:16' = '16:9'
): Promise<string> => {
    return generateVideoFromImage(imageBase64, prompt, aspectRatio, 'custom_video');
};

/**
 * Generates a surgical mask identifying specific areas.
 */
export const generateSurgicalMask = async (imageBase64: string, mimeType: string, target: 'sky' | 'surfaces' | 'clutter' | 'windows' = 'sky'): Promise<string> => {
    try {
        // Optimization: Image masks do not require high resolutions; downsampling to 512px saves massive input tokens while maintaining high accuracy.
        const optimized = await processImageForApi(`data:${mimeType};base64,${imageBase64}`, 512);
        const response = await api.post('/generate-mask', { base64: optimized.base64, mimeType: optimized.mimeType, target });
        const rawMaskDataUrl = `data:image/png;base64,${response.data.data}`;

        if (target === 'clutter') {
            try {
                // Morphological dilation expands the mask by 20px to capture object contact shadows and edges
                const dilated = await dilateMask(rawMaskDataUrl, 20);
                console.log(`[AI Engine] Clutter mask dilated by 20px. Mask Coverage: ${(dilated.coverageRatio * 100).toFixed(2)}% (${dilated.whitePixelCount} px)`);
                return dilated.dilatedDataUrl;
            } catch (dErr) {
                console.warn("Clutter mask dilation failed, returning raw mask:", dErr);
            }
        }

        return rawMaskDataUrl;
    } catch (e) {
        if (target === 'sky') {
            console.warn("AI mask generation failed or timed out, applying algorithmic sky isolation mask to guarantee architectural lock.", e);
            return await generateAlgorithmicSkyMask(`data:${mimeType};base64,${imageBase64}`);
        }
        throw new Error(stringifyError(e));
    }
};

/**
 * Detects personal photos and generates a surgical binary mask (pure black for locked background, pure white for detected personal photos/frames).
 * Guarantees that 100% of wall colors and 100% of furniture outside the frames remain mathematically identical to the original photo.
 */
export const generateDepersonalizeMask = async (
    imageBase64: string,
    mimeType: string,
    width?: number,
    height?: number
): Promise<string | null> => {
    try {
        const response = await api.post('/detect-personal-photos', { base64: imageBase64, mimeType });
        const boxes = response.data?.boxes || [];
        if (!boxes || boxes.length === 0) {
            return null;
        }

        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const w = width || img.naturalWidth || img.width;
                const h = height || img.naturalHeight || img.height;
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) return resolve(null);

                // Fill black (100% locked)
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, w, h);

                // Fill white for each detected personal photo / frame
                ctx.fillStyle = '#ffffff';
                for (const item of boxes) {
                    const box = item.box_2d;
                    if (!box || box.length < 4) continue;
                    const [ymin, xmin, ymax, xmax] = box;
                    const x = (xmin / 1000) * w;
                    const y = (ymin / 1000) * h;
                    const bw = ((xmax - xmin) / 1000) * w;
                    const bh = ((ymax - ymin) / 1000) * h;
                    const padX = Math.max(2, bw * 0.03);
                    const padY = Math.max(2, bh * 0.03);
                    ctx.fillRect(
                        Math.max(0, x - padX),
                        Math.max(0, y - padY),
                        Math.min(w - x + padX, bw + padX * 2),
                        Math.min(h - y + padY, bh + padY * 2)
                    );
                }
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => resolve(null);
            img.src = `data:${mimeType};base64,${imageBase64}`;
        });
    } catch (err) {
        console.warn("Failed to generate depersonalize surgical mask:", err);
        return null;
    }
};

/**
 * Calculates the best supported generation ratio for the Gemini model.
 */
const getClosestAspectRatio = (width: number, height: number): { name: "1:1" | "3:4" | "4:3" | "9:16" | "16:9", val: number } => {
  const ratio = width / height;
  const targets: { name: "1:1" | "3:4" | "4:3" | "9:16" | "16:9", val: number }[] = [
    { name: "1:1", val: 1 },
    { name: "3:4", val: 3 / 4 },
    { name: "4:3", val: 4 / 3 },
    { name: "9:16", val: 9 / 16 },
    { name: "16:9", val: 16 / 9 },
  ];
  
  return targets.reduce((prev, curr) => 
    Math.abs(curr.val - ratio) < Math.abs(prev.val - ratio) ? curr : prev
  );
};

export const editImageWeather = async (
  imageBase64: string,
  mimeType: string,
  prompt: string,
  model: string = 'gemini-3.1-flash-image',
  maskBase64?: string | null,
  dims?: { width: number; height: number },
  sampleBase64?: string | null,
  highClarity?: boolean,
  preAnalysis?: ImagePreAnalysis
): Promise<string> => {
    const originalW = dims?.width || 3;
    const originalH = dims?.height || 2;
    const originalRatio = originalW / originalH;
    const closestRatioConfig = getClosestAspectRatio(originalW, originalH);

    // Resolution optimization:
    // All standard perspective tools (non-360) operate at high-resolution 2048px (2K) for razor-sharp clarity with zero extra cost.
    // 360 panorama tools use their specialized spherical projection pipeline resolution.
    const is360Tool = prompt.includes('360') || prompt.includes('EQUIRECTANGULAR') || prompt.includes('PANORAMA') || prompt.includes('P360');
    const targetMaxDim = !is360Tool ? 2048 : (highClarity || (dims && Math.max(dims.width, dims.height) >= 2048) ? 2048 : 1024);
    const optimized = await processImageForApi(`data:${mimeType};base64,${imageBase64}`, targetMaxDim);

    // SURGICAL PADDING PROTOCOL:
    // We pad the source image to match the closest supported AI ratio.
    const paddedSourceUrl = await padToRatio(optimized.dataUrl, closestRatioConfig.val);
    const paddedSourceBase64 = paddedSourceUrl.split(',')[1];

    let cleanSample: string | null = null;
    if (sampleBase64) {
      // Downscale reference samples aggressively to 512px as texture references do not need high resolution.
      const optimizedSample = await processImageForApi(sampleBase64, 512);
      const paddedSampleUrl = await padToRatio(optimizedSample.dataUrl, closestRatioConfig.val);
      cleanSample = paddedSampleUrl.split(',')[1];
    }

    let cleanMask: string | null = null;
    if (maskBase64) {
      const maskDataUrl = maskBase64.startsWith('data:') ? maskBase64 : `data:image/png;base64,${maskBase64}`;
      try {
        // Load the padded source image to acquire its exact target dimensions
        const sourceImg = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = paddedSourceUrl;
        });

        const maskImg = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = maskDataUrl;
        });

        const targetW = sourceImg.naturalWidth || sourceImg.width;
        const targetH = sourceImg.naturalHeight || sourceImg.height;

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = targetW;
        maskCanvas.height = targetH;
        const maskCtx = maskCanvas.getContext('2d');
        if (maskCtx) {
          maskCtx.fillStyle = 'black';
          maskCtx.fillRect(0, 0, targetW, targetH);
          maskCtx.imageSmoothingEnabled = true;
          maskCtx.imageSmoothingQuality = 'high';
          maskCtx.drawImage(maskImg, 0, 0, targetW, targetH);
          cleanMask = maskCanvas.toDataURL('image/png').split(',')[1];
        }
      } catch (alignErr) {
        console.warn("Mask pixel alignment failed, using standard padding:", alignErr);
        const optimizedMask = await processImageForApi(maskDataUrl, targetMaxDim);
        const paddedMaskUrl = await padToRatio(optimizedMask.dataUrl, closestRatioConfig.val, 'black');
        cleanMask = paddedMaskUrl.split(',')[1];
      }
    }

    try {
        const response = await api.post('/edit-image', {
            base64: paddedSourceBase64,
            mimeType: 'image/png', // padToRatio returns PNG
            prompt,
            model,
            maskBase64: cleanMask,
            sampleBase64: cleanSample,
            aspectName: closestRatioConfig.name,
            imageSize: !is360Tool ? '2K' : (highClarity ? '2K' : '1K'),
            preAnalysis
        });

        const rawAiResultUrl = `data:image/png;base64,${response.data.data}`;
        const resizedAiResultUrl = await cropToRatio(rawAiResultUrl, originalRatio, dims?.width, dims?.height);

        if (maskBase64) {
            const originalUrl = `data:${mimeType};base64,${imageBase64}`;
            const maskUrl = `data:image/png;base64,${maskBase64}`;
            return await applySurgicalComposite(originalUrl, resizedAiResultUrl, maskUrl);
        }

        return resizedAiResultUrl;
    } catch (e) {
        console.error("Proxy edit failed", e);
        throw e;
    }
};
