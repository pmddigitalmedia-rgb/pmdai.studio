
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { SocialAssets } from '../types';
import { assetStore } from '../utils/persistence';
import JSZip from 'jszip';

type AspectRatio = '9:16' | '16:9' | '1:1';

interface GoogleEarthEditorProps {
    assets: SocialAssets;
    brandingColor: string;
    selectedData?: any;
    mode?: string;
}

// Fix: Added missing drawRoundedRect utility function for canvas rendering
const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    const safeR = Math.max(0, r);
    if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, safeR);
    } else {
        ctx.beginPath();
        ctx.moveTo(x + safeR, y);
        ctx.arcTo(x + w, y, x + w, y + h, safeR);
        ctx.arcTo(x + w, y + h, x, y + h, safeR);
        ctx.arcTo(x, y + h, x, y, safeR);
        ctx.arcTo(x, y, x + w, y, safeR);
        ctx.closePath();
    }
};

export const GoogleEarthEditor: React.FC<GoogleEarthEditorProps> = ({ assets, brandingColor: propBrandingColor, selectedData: propSelectedData, mode: propMode }) => {
    const [csvData, setCsvData] = useState<string[][]>([]);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [selectedRowIndex, setSelectedRowIndex] = useState(0);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
    const [brandingColor, setBrandingColor] = useState(propBrandingColor);
    const [batchStatus, setBatchStatus] = useState<string>("");
    const [isCleanFeed, setIsCleanFeed] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    
    const [activeHeadshotImg, setActiveHeadshotImg] = useState<HTMLImageElement | null>(null);
    const [activeLogoImg, setActiveLogoImg] = useState<HTMLImageElement | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const requestRef = useRef<number>(0);

    useEffect(() => {
        setBrandingColor(propBrandingColor);
    }, [propBrandingColor]);

    useEffect(() => {
        const restoreState = async () => {
            const savedData = localStorage.getItem('pmd_csv_data');
            const savedHeaders = localStorage.getItem('pmd_csv_headers');
            const savedIndex = localStorage.getItem('pmd_selected_row_index');
            
            if (savedData && savedHeaders) {
                try {
                    const parsedData = JSON.parse(savedData);
                    const parsedHeaders = JSON.parse(savedHeaders);
                    setCsvData(parsedData);
                    setCsvHeaders(parsedHeaders);
                    if (savedIndex !== null) setSelectedRowIndex(parseInt(savedIndex));
                } catch (e) { console.error("Failed to load CSV", e); }
            }

            const savedRatio = localStorage.getItem('pmd_ge_aspect_ratio');
            if (savedRatio) setAspectRatio(savedRatio as AspectRatio);

            const savedCleanFeed = localStorage.getItem('pmd_ge_clean_feed');
            if (savedCleanFeed) setIsCleanFeed(savedCleanFeed === 'true');

            try {
                const storedBlob = await assetStore.get('pmd_ge_video_blob');
                if (storedBlob) {
                    const url = URL.createObjectURL(storedBlob);
                    setVideoUrl(url);
                }
            } catch (e) { console.error("Failed to restore video from cache", e); }
        };
        restoreState();
    }, []);

    const selectedData = useMemo(() => {
        if (propSelectedData) return propSelectedData;
        if (csvData.length === 0 || selectedRowIndex < 0 || selectedRowIndex >= csvData.length) return {};
        const row = csvData[selectedRowIndex];
        const obj: any = {};
        csvHeaders.forEach((h, i) => {
            obj[h] = row[i];
            const key = h.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!obj[key]) obj[key] = row[i];
        });
        // Explicitly map column AI (index 34) and column AJ (index 35)
        if (row[34]) {
            obj['col34'] = row[34];
            obj['ai'] = row[34];
        }
        if (row[35]) {
            obj['col35'] = row[35];
            obj['aj'] = row[35];
        }
        if (!obj.realtor && obj.agent) obj.realtor = obj.agent;
        if (!obj.unit) {
            if (obj.apt) obj.unit = obj.apt;
            else if (obj.suite) obj.unit = obj.suite;
        }
        return obj;
    }, [csvData, csvHeaders, selectedRowIndex, propSelectedData]);

    useEffect(() => {
        const findAsset = (refName?: string) => {
            if (!refName || typeof refName !== 'string') return null;
            const val = String(refName).trim();
            if (!val) return null;
            if (val.startsWith('http') || val.startsWith('data:') || val.startsWith('blob:')) return val;
            if (!assets.assetLibrary) return null;
            const cleanRef = val.toLowerCase().split('.')[0];
            const matchKey = Object.keys(assets.assetLibrary).find(k => k.toLowerCase().split('.')[0] === cleanRef);
            return matchKey ? assets.assetLibrary[matchKey] : null;
        };

        const getVal = (keys: string[]) => {
            for (const k of keys) {
                const normalized = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (selectedData[k]) return selectedData[k];
                if (selectedData[normalized]) return selectedData[normalized];
            }
            return null;
        };

        const headshotSrc = findAsset(getVal(['headshot', 'ai', 'col34', '@Headshot', 'agent_image', 'agent_photo', 'photo', 'r_headshot', 'remote_headshot', 'r'])) || assets.headshot;
        const logoSrc = findAsset(getVal(['logo', 'aj', 'col35', '@Logo', 'brokerage_logo', 'brand_logo', 'brand', 'r_logo', 'remote_logo', 'brand_url'])) || assets.logo;

        const loadImg = (src: string | null, setter: (img: HTMLImageElement | null) => void) => {
            if (!src) { setter(null); return; }
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => setter(img);
            img.onerror = () => setter(null);
            img.src = src;
        };

        loadImg(headshotSrc, setActiveHeadshotImg);
        loadImg(logoSrc, setActiveLogoImg);
    }, [selectedData, assets]);

    const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
        let file: File | null = null;
        if ('files' in e && (e as any).files) file = (e as any).files[0];
        else if ('dataTransfer' in e && e.dataTransfer.files) file = e.dataTransfer.files[0];
        else if ('target' in e && (e.target as HTMLInputElement).files) file = (e.target as HTMLInputElement).files![0];

        if (file && file.type.startsWith('video/')) {
            const url = URL.createObjectURL(file);
            setVideoUrl(url);
            setIsPlaying(false);
            try {
                await assetStore.save('pmd_ge_video_blob', file);
            } catch (err) {
                console.error("Failed to cache video file", err);
            }
        }
    };

    const handleRatioChange = (newRatio: AspectRatio) => {
        setAspectRatio(newRatio);
        localStorage.setItem('pmd_ge_aspect_ratio', newRatio);
    };

    const handleCleanFeedToggle = () => {
        const newState = !isCleanFeed;
        setIsCleanFeed(newState);
        localStorage.setItem('pmd_ge_clean_feed', String(newState));
    };

    const drawFrameInternal = useCallback((targetRatio: AspectRatio) => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        const ctx = canvas.getContext('2d')!;

        let targetW = video.videoWidth || 1920;
        let targetH = video.videoHeight || 1080;
        if (targetRatio === '9:16') targetW = Math.round(targetH * (9/16));
        else if (targetRatio === '1:1') targetW = targetH;
        else if (targetRatio === '16:9') targetH = Math.round(targetW * (9/16));

        if (canvas.width !== targetW) canvas.width = targetW;
        if (canvas.height !== targetH) canvas.height = targetH;

        const scale = Math.max(targetW / video.videoWidth, targetH / video.videoHeight);
        const vidX = (targetW - video.videoWidth * scale) / 2;
        const vidY = (targetH - video.videoHeight * scale) / 2;
        ctx.drawImage(video, vidX, vidY, video.videoWidth * scale, video.videoHeight * scale);

        // --- BRANDING LAYER ---
        // If Clean Feed is active, we skip all subsequent drawing calls
        if (isCleanFeed) return;

        ctx.save();
        const w = targetW;
        const h = targetH;
        const cx = w / 2;
        const isWide = targetRatio !== '9:16';

        // --- TOP BADGE ---
        const HEADING = (propMode || selectedData.mode || "Property Showcase").toUpperCase();
        const badgeY = h * 0.06;
        const badgeW = isWide ? w * 0.25 : w * 0.55;
        const badgeH = isWide ? h * 0.07 : h * 0.05;
        
        ctx.save();
        ctx.fillStyle = brandingColor;
        drawRoundedRect(ctx, cx - badgeW / 2, badgeY, badgeW, badgeH, 60);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `900 ${isWide ? h * 0.035 : h * 0.025}px 'Plus Jakarta Sans', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(HEADING, cx, badgeY + badgeH / 2);
        ctx.restore();

        // --- LOWER THIRDS GRADIENT ---
        const gr = ctx.createLinearGradient(0, h * 0.65, 0, h);
        gr.addColorStop(0, 'rgba(0,0,0,0)');
        gr.addColorStop(1, 'rgba(0,0,0,0.8)');
        ctx.fillStyle = gr;
        ctx.fillRect(0, h * 0.6, w, h * 0.4);

        // --- LOWER THIRDS BOX ---
        const hPadding = isWide ? w * 0.03 : w * 0.06;
        const vPadding = isWide ? h * 0.03 : h * 0.03;
        const lineSpacing = isWide ? h * 0.01 : h * 0.01;

        const priceFont = `bold ${isWide ? h * 0.07 : h * 0.055}px 'Plus Jakarta Sans', sans-serif`;
        const addrFont = `bold ${isWide ? h * 0.03 : h * 0.025}px 'Plus Jakarta Sans', sans-serif`;
        const cityFont = `${isWide ? h * 0.022 : h * 0.02}px 'Plus Jakarta Sans', sans-serif`;
        const specsFont = `bold ${isWide ? h * 0.025 : h * 0.022}px 'Plus Jakarta Sans', sans-serif`;

        const displayAddrLine = selectedData.unit ? `${selectedData.unit} - ${selectedData.address || ''}` : (selectedData.address || '');
        const stateVal = selectedData.state || selectedData.province || '';
        const zipVal = selectedData.zip || selectedData.zipcode || selectedData.postalcode || '';
        const cityStateZip = [selectedData.city, stateVal, zipVal].filter(Boolean).join(', ');
        
        const vBedCount = String(selectedData.bed || selectedData.beds || selectedData.bedroom || selectedData.bedrooms || '');
        const vBathCount = String(selectedData.bath || selectedData.baths || selectedData.bathroom || selectedData.bathrooms || '');
        const vSqftSize = String(selectedData.totallivingareasqft || selectedData.sqft || selectedData.squarefeet || selectedData.sq_ft || '');
        const ss = [vBedCount ? `${vBedCount} Bed` : '', vBathCount ? `${vBathCount} Bath` : '', vSqftSize ? `${vSqftSize} SqFt` : ''].filter(Boolean).join('  •  ');

        const lines: {text: string, font: string, color: string, height: number}[] = [];
        const addLine = (text: string, font: string, color: string, height: number) => {
            if (!text) return;
            lines.push({ text: String(text), font, color, height });
        };

        addLine(selectedData.price, priceFont, '#fff', isWide ? h * 0.07 : h * 0.055);
        addLine(displayAddrLine, addrFont, '#fff', isWide ? h * 0.03 : h * 0.025);
        addLine(cityStateZip, cityFont, '#e0e0e0', isWide ? h * 0.022 : h * 0.02);
        addLine(ss, specsFont, brandingColor, isWide ? h * 0.025 : h * 0.022);

        if (lines.length > 0) {
            let maxWidth = 0;
            let totalHeight = 0;
            lines.forEach(line => {
                ctx.font = line.font;
                const measure = ctx.measureText(line.text).width;
                if (measure > maxWidth) maxWidth = measure;
                totalHeight += line.height + lineSpacing;
            });
            totalHeight -= lineSpacing;

            const boxW = Math.min(w * 0.92, maxWidth + hPadding * 2);
            const boxH = totalHeight + vPadding * 2;
            const boxX = (w - boxW) / 2;
            const boxY = h - boxH - (isWide ? h * 0.05 : h * 0.18);

            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.65)';
            drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 40);
            ctx.fill();

            let currentY = boxY + vPadding;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            lines.forEach(line => {
                ctx.font = line.font;
                ctx.fillStyle = line.color;
                ctx.fillText(line.text, cx, currentY);
                currentY += line.height + lineSpacing;
            });
            ctx.restore();

            // --- ASSETS (Headshot & Logo) ---
            const assetSize = isWide ? h * 0.12 : h * 0.08;
            const assetMargin = w * 0.02;
            const verticalGap = h * 0.02;

            // Headshot
            if (activeHeadshotImg) {
                const drawX = isWide ? boxX - assetMargin - assetSize : (w - assetSize) / 2;
                const drawY = isWide ? boxY + (boxH - assetSize) / 2 : boxY - assetSize - verticalGap;
                
                ctx.save();
                ctx.beginPath();
                ctx.arc(drawX + assetSize / 2, drawY + assetSize / 2, assetSize / 2, 0, Math.PI * 2);
                ctx.clip();
                
                // Cover logic for headshot
                const hAspect = activeHeadshotImg.width / activeHeadshotImg.height;
                let sx, sy, sWidth, sHeight;
                if (hAspect > 1) {
                    sHeight = activeHeadshotImg.height;
                    sWidth = activeHeadshotImg.height;
                    sx = (activeHeadshotImg.width - sWidth) / 2;
                    sy = 0;
                } else {
                    sWidth = activeHeadshotImg.width;
                    sHeight = activeHeadshotImg.width;
                    sx = 0;
                    sy = (activeHeadshotImg.height - sHeight) / 2;
                }
                ctx.drawImage(activeHeadshotImg, sx, sy, sWidth, sHeight, drawX, drawY, assetSize, assetSize);
                ctx.restore();
                
                ctx.strokeStyle = brandingColor;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(drawX + assetSize / 2, drawY + assetSize / 2, assetSize / 2, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Logo
            if (activeLogoImg) {
                // Contain logic for logo
                const lAspect = activeLogoImg.width / activeLogoImg.height;
                const maxLogoW = isWide ? assetSize * 2.5 : w * 0.4;
                const maxLogoH = assetSize;
                
                let logoW = maxLogoH * lAspect;
                let logoH = maxLogoH;
                
                if (logoW > maxLogoW) {
                    logoW = maxLogoW;
                    logoH = logoW / lAspect;
                }
                
                const drawX = isWide ? boxX + boxW + assetMargin : (w - logoW) / 2;
                const drawY = isWide ? (boxY + (boxH - logoH) / 2) : (boxY + boxH + verticalGap);
                ctx.drawImage(activeLogoImg, drawX, drawY, logoW, logoH);
            }
        }

        // --- PROGRESS BAR ---
        const videoDuration = videoRef.current?.duration || 0;
        if (videoDuration > 0) {
            const progress = currentTime / videoDuration;
            ctx.fillStyle = brandingColor;
            ctx.fillRect(0, h - 12, w * progress, 12);
        }

        ctx.restore();
    }, [selectedData, brandingColor, isCleanFeed, propMode, currentTime, activeHeadshotImg, activeLogoImg]);

    const drawFrame = useCallback(() => drawFrameInternal(aspectRatio), [drawFrameInternal, aspectRatio]);

    useEffect(() => {
        if (videoUrl && videoRef.current) {
            // Cancel any pending play request by pausing
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
            setIsPlaying(false);
        }
    }, [videoUrl]);

    useEffect(() => {
        if (videoUrl && !isProcessing) {
            const loop = () => {
                if (videoRef.current) {
                    setCurrentTime(videoRef.current.currentTime);
                }
                drawFrame();
                if (isPlaying) requestRef.current = requestAnimationFrame(loop);
            };
            if (isPlaying) requestRef.current = requestAnimationFrame(loop);
            else drawFrame();
            return () => cancelAnimationFrame(requestRef.current);
        }
    }, [isPlaying, videoUrl, drawFrame, isProcessing]);

    const handlePlayPause = async () => {
        if (!videoRef.current) return;
        if (isPlaying) { 
            videoRef.current.pause(); 
            setIsPlaying(false); 
        } else { 
            try {
                const playPromise = videoRef.current.play();
                if (playPromise !== undefined) {
                    await playPromise;
                }
                setIsPlaying(true);
            } catch (error: any) {
                if (error.name !== 'AbortError') {
                    console.error("Playback was interrupted or prevented:", error);
                }
                setIsPlaying(false);
            }
        }
    };

    const recordVideoForRatio = async (targetRatio: AspectRatio): Promise<{ blob: Blob, ext: string }> => {
        return new Promise(async (resolve, reject) => {
            if (!videoUrl || !videoRef.current || !canvasRef.current) return reject("Missing refs");
            const video = videoRef.current;
            const canvas = canvasRef.current;
            handleRatioChange(targetRatio);
            video.pause();
            video.currentTime = 0;
            video.muted = true;
            await new Promise(r => {
                const onSeek = () => { video.removeEventListener('seeked', onSeek); r(null); };
                video.addEventListener('seeked', onSeek);
            });
            const mimeTypeOptions = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm'];
            const selectedMimeType = mimeTypeOptions.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
            const ext = selectedMimeType.includes('mp4') ? 'mp4' : 'webm';
            const stream = (canvas as any).captureStream(30);
            const mediaRecorder = new MediaRecorder(stream, { mimeType: selectedMimeType, videoBitsPerSecond: 25000000 });
            const chunks: BlobPart[] = [];
            mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
            mediaRecorder.onstop = () => resolve({ blob: new Blob(chunks, { type: selectedMimeType }), ext });
            mediaRecorder.start();
            try {
                const playPromise = video.play();
                if (playPromise !== undefined) await playPromise;
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error("Play failed during recording:", err);
                }
            }
            const duration = video.duration * 1000;
            const startTime = performance.now();
            const renderLoop = () => {
                const elapsed = performance.now() - startTime;
                if (elapsed >= duration || video.ended) { mediaRecorder.stop(); video.pause(); return; }
                drawFrameInternal(targetRatio);
                requestAnimationFrame(renderLoop);
            };
            requestAnimationFrame(renderLoop);
        });
    };

    const handleExportBatch = async () => {
        if (!videoUrl || csvData.length === 0 || isProcessing) return;
        setIsProcessing(true); setIsPlaying(false);
        const zip = new JSZip();
        const ratios: AspectRatio[] = ['16:9', '9:16', '1:1'];
        const addressName = selectedData.address?.replace(/\s+/g, '-') || 'Export';
        const fileSuffix = isCleanFeed ? 'Clean' : 'Branded';
        try {
            for (let i = 0; i < ratios.length; i++) {
                setBatchStatus(`Rendering ${ratios[i]} (${i + 1}/${ratios.length})`);
                const { blob, ext } = await recordVideoForRatio(ratios[i]);
                if (blob.size > 0) zip.file(`GoogleEarth-${ratios[i].replace(':', 'x')}-${addressName}-${fileSuffix}.${ext}`, blob);
            }
            setBatchStatus("Packaging ZIP...");
            const content = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a'); a.href = url; a.download = `GoogleEarth-${fileSuffix}-Pack-${addressName}.zip`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        } catch (err) { console.error("Batch failed", err); }
        finally { setIsProcessing(false); setBatchStatus(""); if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; } }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in-up">
            <div className="lg:col-span-4 space-y-6">
                <div className="glass-panel p-6 rounded-[2rem] space-y-6 shadow-2xl">
                    <div className="space-y-1 border-b border-white/5 pb-4">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Configuration</h3>
                    </div>
                    
                    {/* Clean Feed Toggle */}
                    <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 flex items-center justify-between transition-all hover:bg-slate-900">
                        <div className="flex flex-col">
                            <span className="text-[11px] font-black text-white uppercase tracking-widest">Clean Feed</span>
                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter mt-0.5">Hide all headshots, text & logos</span>
                        </div>
                        <button 
                            onClick={handleCleanFeedToggle}
                            className={`w-12 h-6 rounded-full transition-all relative ${isCleanFeed ? 'bg-orange-600' : 'bg-slate-800'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all ${isCleanFeed ? 'left-7' : 'left-1'}`}></div>
                        </button>
                    </div>

                    {!propSelectedData && (
                        <div className="space-y-4">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Select Property</label>
                            {csvData.length > 0 ? (
                                <select value={selectedRowIndex} onChange={(e) => { const idx = parseInt(e.target.value); setSelectedRowIndex(idx); localStorage.setItem('pmd_selected_row_index', idx.toString()); }} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 focus:ring-1 focus:ring-orange-500 outline-none appearance-none cursor-pointer">
                                    {csvData.map((row, idx) => {
                                        const addressColIdx = csvHeaders.findIndex(h => h.toLowerCase().includes('address'));
                                        const unitColIdx = csvHeaders.findIndex(h => { const l = h.toLowerCase(); return l.includes('unit') || l.includes('apt') || l.includes('suite'); });
                                        const address = row[addressColIdx] || `Entry #${idx + 1}`;
                                        const unit = unitColIdx !== -1 ? row[unitColIdx] : '';
                                        return <option key={idx} value={idx}>{unit ? `${unit} - ${address}` : address}</option>;
                                    })}
                                </select>
                            ) : <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-center"><p className="text-[10px] font-bold text-orange-400 uppercase">No CSV Data</p></div>}
                        </div>
                    )}
                    <div className="space-y-4">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Format</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['9:16', '16:9', '1:1'] as AspectRatio[]).map((r) => (
                                <button key={r} onClick={() => handleRatioChange(r)} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${aspectRatio === r ? 'bg-white text-slate-950 border-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'}`}>{r}</button>
                            ))}
                        </div>
                    </div>
                    <div onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleVideoUpload(e); }} onClick={() => fileInputRef.current?.click()} className={`relative group cursor-pointer w-full h-40 rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center text-center p-6 ${isDragging ? 'border-orange-500 bg-orange-500/10' : 'border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-orange-500/30'}`}>
                        <input type="file" ref={fileInputRef} className="hidden" accept="video/mp4,video/webm" onChange={handleVideoUpload} />
                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3 text-orange-500 group-hover:bg-orange-500/20 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Upload Video</span>
                        {videoUrl && <span className="text-[8px] text-emerald-500 mt-2 font-bold">Loaded ✓</span>}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handlePlayPause} disabled={!videoUrl || isProcessing} className={`flex-1 py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] border border-white/5 transition-all flex items-center justify-center gap-2 ${isPlaying ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                            {isPlaying ? <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.75 5.25v13.5m-7.5-13.5v13.5"/></svg> Pause</> : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/></svg> Play</>}
                        </button>
                    </div>
                    <button onClick={handleExportBatch} disabled={!videoUrl || csvData.length === 0 || isProcessing} className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl transition-all flex flex-col items-center justify-center gap-1 ${!videoUrl || isProcessing ? 'bg-slate-800 text-slate-500' : 'bg-gradient-to-br from-orange-600 to-amber-500 text-white hover:scale-[1.02]'}`}>
                        {isProcessing ? <><span className="flex items-center gap-3"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Rendering...</span><span className="text-[8px] opacity-80">{batchStatus}</span></> : <><span className="flex items-center gap-3"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg> Export All Formats</span><span className="text-[7px] opacity-60">9:16, 16:9, & 1:1 included</span></>}
                    </button>
                </div>
            </div>
            <div className="lg:col-span-8 space-y-6">
                <div className={`relative w-full overflow-hidden bg-black/40 rounded-[2.5rem] border border-white/5 shadow-inner flex items-center justify-center group ${aspectRatio === '9:16' ? 'aspect-[9/16] max-h-[80vh]' : 'aspect-video'}`}>
                    {videoUrl ? <>
                        <video ref={videoRef} src={videoUrl} className="hidden" muted loop />
                        <canvas ref={canvasRef} className="w-full h-full object-contain" />
                    </> : <div className="flex flex-col items-center gap-4 opacity-20"><svg className="w-24 h-24" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg></div>}
                </div>
            </div>
        </div>
    );
};
