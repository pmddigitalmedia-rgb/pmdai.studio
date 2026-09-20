import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { LibraryItem, ComparisonPair } from '../types';
import { drawGeminiWatermark } from '../services/imageUtils';
import JSZip from 'jszip';

interface BeforeAfterGeneratorProps {
    library: LibraryItem[];
    setLibrary: React.Dispatch<React.SetStateAction<LibraryItem[]>>;
    pairs: ComparisonPair[];
    setPairs: React.Dispatch<React.SetStateAction<ComparisonPair[]>>;
}

export const BeforeAfterGenerator: React.FC<BeforeAfterGeneratorProps> = ({ library, setLibrary, pairs, setPairs }) => {
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [isRendering, setIsRendering] = useState(false);
    const [renderStatus, setRenderStatus] = useState("");
    const [renderProgress, setRenderProgress] = useState(0);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        Array.from(e.target.files).forEach((file: File) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setLibrary(prev => [...prev, {
                    id: Math.random().toString(36).substring(7),
                    url: ev.target?.result as string,
                    name: file.name
                }]);
            };
            reader.readAsDataURL(file);
        });
    };

    const addPair = () => {
        setPairs(prev => [...prev, {
            id: Math.random().toString(36).substring(7),
            beforeId: null,
            afterId: null,
            status: 'idle',
            videoUrl: null,
            format: 'webm'
        }]);
    };

    const removePair = (id: string) => {
        setPairs(prev => prev.filter(p => p.id !== id));
    };

    const clearSlot = (pairId: string, type: 'before' | 'after') => {
        setPairs(prev => prev.map(p => {
            if (p.id === pairId) {
                return { ...p, [type === 'before' ? 'beforeId' : 'afterId']: null, videoUrl: null, status: 'idle' };
            }
            return p;
        }));
    };

    const autoPair = () => {
        if (library.length < 2) {
            alert("Need at least 2 images to auto-pair.");
            return;
        }
        if (confirm("This will clear current pairs and auto-match images in order. Continue?")) {
            const newPairs: ComparisonPair[] = [];
            for (let i = 0; i < library.length; i += 2) {
                if (i + 1 < library.length) {
                    newPairs.push({
                        id: Math.random().toString(36).substring(7),
                        beforeId: library[i].id,
                        afterId: library[i + 1].id,
                        status: 'idle',
                        videoUrl: null,
                        format: 'webm'
                    });
                }
            }
            setPairs(newPairs);
        }
    };

    const handleDrop = (pairId: string, type: 'before' | 'after') => {
        if (!draggingId) return;
        setPairs(prev => prev.map(p => {
            if (p.id === pairId) {
                return { ...p, [type === 'before' ? 'beforeId' : 'afterId']: draggingId, videoUrl: null, status: 'idle' };
            }
            return p;
        }));
        setDraggingId(null);
    };

    const downloadZip = async () => {
        const rendered = pairs.filter(p => p.videoUrl && p.status === 'done');
        if (rendered.length === 0) {
            alert("No rendered reels to export.");
            return;
        }
        const zip = new JSZip();
        for (let i = 0; i < rendered.length; i++) {
            const pair = rendered[i];
            const response = await fetch(pair.videoUrl!);
            const blob = await response.blob();
            zip.file(`comparison-reel-${i + 1}.${pair.format}`, blob);
        }
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = "PMD-Comparison-Reels.zip";
        a.click();
        URL.revokeObjectURL(url);
    };

    const generateVideo = async (pair: ComparisonPair): Promise<{ blob: Blob; ext: 'webm' | 'mp4' }> => {
        return new Promise((resolve, reject) => {
            const canvas = canvasRef.current;
            if (!canvas) return reject("Canvas not available");
            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) return reject("Context not available");

            const beforeData = library.find(l => l.id === pair.beforeId);
            const afterData = library.find(l => l.id === pair.afterId);
            if (!beforeData || !afterData) return reject("Images missing");

            const beforeImg = new Image();
            const afterImg = new Image();

            let loaded = 0;
            const checkLoad = () => {
                loaded++;
                if (loaded === 2) start();
            };
            beforeImg.crossOrigin = "anonymous";
            afterImg.crossOrigin = "anonymous";
            beforeImg.onload = checkLoad;
            afterImg.onload = checkLoad;
            beforeImg.src = beforeData.url;
            afterImg.src = afterData.url;

            function start() {
                // Vertical Stack Output Dimensions: 1440x2560 (2K Master Reel)
                const w = 1440;
                const h = 2560;
                canvas!.width = w;
                canvas!.height = h;

                const stream = (canvas as any).captureStream(30);
                const mimeTypes = [
                    'video/mp4; codecs="avc1.42E01E"',
                    'video/mp4',
                    'video/webm; codecs="h264"',
                    'video/webm'
                ];

                let selectedMime = 'video/webm';
                let ext: 'webm' | 'mp4' = 'webm';

                for (const type of mimeTypes) {
                    if (MediaRecorder.isTypeSupported(type)) {
                        selectedMime = type;
                        if (type.includes('mp4')) ext = 'mp4';
                        break;
                    }
                }

                const recorder = new MediaRecorder(stream, { mimeType: selectedMime, videoBitsPerSecond: 20000000 });
                const chunks: BlobPart[] = [];
                recorder.ondataavailable = e => chunks.push(e.data);
                recorder.onstop = () => resolve({ blob: new Blob(chunks, { type: selectedMime }), ext });

                recorder.start();

                const SLIDE_TIME = 3000;
                const TOTAL_DURATION = SLIDE_TIME;
                const startTime = performance.now();

                function draw(time: number) {
                    const elapsed = time - startTime;
                    
                    // Simple progress for any motion (though stack is usually static or swipe)
                    // Let's do a vertical swipe for variety or just a split
                    const splitY = h / 2;

                    ctx!.fillStyle = '#000';
                    ctx!.fillRect(0, 0, w, h);

                    // Top: Before
                    ctx!.save();
                    ctx!.beginPath();
                    ctx!.rect(0, 0, w, splitY);
                    ctx!.clip();
                    drawContain(ctx!, beforeImg, w, splitY);
                    drawOverlayLabel(ctx!, "BEFORE", w/2, splitY - 40, 1.0, 'center');
                    ctx!.restore();

                    // Bottom: After
                    ctx!.save();
                    ctx!.beginPath();
                    ctx!.rect(0, splitY, w, h - splitY);
                    ctx!.clip();
                    ctx!.translate(0, splitY);
                    drawContain(ctx!, afterImg, w, h - splitY);
                    drawOverlayLabel(ctx!, "AFTER", w/2, h - splitY - 40, 1.0, 'center');
                    ctx!.restore();

                    // Divider
                    ctx!.beginPath();
                    ctx!.moveTo(0, splitY);
                    ctx!.lineTo(w, splitY);
                    ctx!.strokeStyle = '#fff';
                    ctx!.lineWidth = 8;
                    ctx!.stroke();

                    drawGeminiWatermark(ctx!, w, h, true);

                    if (elapsed < TOTAL_DURATION) requestAnimationFrame(draw);
                    else recorder.stop();
                }
                requestAnimationFrame(draw);
            }
        });
    };

    const renderAll = async () => {
        const pending = pairs.filter(p => p.status === 'idle' && p.beforeId && p.afterId);
        if (pending.length === 0) return;

        setIsRendering(true);
        const updatedPairs = [...pairs];

        for (let i = 0; i < pending.length; i++) {
            const pair = pending[i];
            const pairIndexInFullList = updatedPairs.findIndex(p => p.id === pair.id);
            
            setRenderStatus(`Rendering Reel ${i + 1} of ${pending.length}`);
            setRenderProgress((i / pending.length) * 100);
            
            updatedPairs[pairIndexInFullList] = { ...updatedPairs[pairIndexInFullList], status: 'rendering' };
            setPairs([...updatedPairs]);

            try {
                const { blob, ext } = await generateVideo(pair);
                const url = URL.createObjectURL(blob);
                
                updatedPairs[pairIndexInFullList] = { 
                    ...updatedPairs[pairIndexInFullList], 
                    videoUrl: url, 
                    format: ext, 
                    status: 'done' 
                };
            } catch (e) { 
                console.error("Render failed for pair", pair.id, e);
                updatedPairs[pairIndexInFullList] = { ...updatedPairs[pairIndexInFullList], status: 'error' };
            }
            
            setPairs([...updatedPairs]);
        }
        
        setRenderProgress(100);
        setTimeout(() => {
            setIsRendering(false);
            setRenderStatus("");
        }, 500);
    };

    return (
        <div className="flex flex-col xl:flex-row gap-8 items-start h-[calc(100vh-280px)] overflow-hidden">
            <canvas ref={canvasRef} className="hidden" />

            {isRendering && (
                <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6">
                    <div className="glass-panel p-8 rounded-3xl max-w-sm w-full space-y-6 text-center shadow-2xl">
                        <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter">{renderStatus}</h3>
                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-orange-500 transition-all duration-300" style={{ width: `${renderProgress}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <aside className="w-full xl:w-80 flex flex-col h-full glass-panel rounded-3xl overflow-hidden shrink-0 border border-white/5 shadow-2xl">
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Project Assets</h2>
                    <label className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer transition-colors border border-white/5">
                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-orange-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                    </label>
                </div>
                <div className="flex-grow p-4 overflow-y-auto grid grid-cols-2 gap-3 scrollbar-hide">
                    {library.length === 0 && (
                        <div className="col-span-2 text-center py-10 opacity-30">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">No images loaded</p>
                        </div>
                    )}
                    {library.map(img => (
                        <div 
                            key={img.id}
                            draggable
                            onDragStart={() => setDraggingId(img.id)}
                            className="group relative aspect-square bg-slate-800 rounded-xl overflow-hidden border border-white/5 cursor-grab active:cursor-grabbing hover:scale-[1.02] transition-all hover:border-orange-500/50"
                        >
                            <img src={img.url} className="w-full h-full object-cover" alt="" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                                <span className="text-[8px] font-black text-white uppercase text-center truncate w-full">{img.name}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            <section className="flex-grow flex flex-col h-full min-w-0">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Comparison Workbench</h2>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">2K Master Reel Export (1440 × 2560) • 20 Mbps • $0 Extra</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={autoPair} className="px-5 py-2.5 rounded-xl border border-white/5 bg-slate-900 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
                            Auto-Match
                        </button>
                        <button onClick={renderAll} disabled={isRendering} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 text-white text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] transition-all flex items-center gap-2 disabled:opacity-50">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125z" /></svg>
                            {isRendering ? 'Generating...' : 'Generate Reels'}
                        </button>
                        <button onClick={downloadZip} disabled={pairs.filter(p => p.videoUrl).length === 0} className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] transition-all flex items-center gap-2 disabled:opacity-50">
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                             Export All (ZIP)
                        </button>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto space-y-4 pr-2 scrollbar-hide">
                    {pairs.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 border-2 border-dashed border-white/10 rounded-[2.5rem]">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-20 h-20 mb-4"><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg>
                            <span className="text-xs font-black uppercase tracking-[0.3em]">Workbench Empty</span>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {pairs.map((pair, idx) => {
                        const before = library.find(l => l.id === pair.beforeId);
                        const after = library.find(l => l.id === pair.afterId);
                        return (
                            <div key={pair.id} className="glass-panel p-5 rounded-[2rem] border border-white/5 flex flex-col gap-4 relative group animate-fade-in-up shadow-xl">
                                <div className="absolute top-4 right-4 flex flex-col gap-2 z-30">
                                    {pair.status === 'rendering' && (
                                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-600/20 text-orange-400 border border-orange-500/30">
                                            <div className="w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Rendering...</span>
                                        </div>
                                    )}
                                    {pair.videoUrl && (
                                        <a 
                                            href={pair.videoUrl} 
                                            download={`comparison-${idx + 1}.${pair.format}`} 
                                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-900/40 transition-all scale-95 hover:scale-100"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                            </svg>
                                            <span className="text-[9px] font-black uppercase tracking-widest">Reel Ready</span>
                                        </a>
                                    )}
                                    <button 
                                        onClick={() => removePair(pair.id)} 
                                        className="p-2 rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-900/40 transition-all scale-95 hover:scale-100"
                                        title="Delete Pair"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                        </svg>
                                    </button>
                                </div>
                                
                                <div className="flex flex-col gap-2 w-full h-[400px]">
                                    {/* Vertical Stack in UI */}
                                    <div 
                                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-orange-500/10', 'border-orange-500'); }}
                                        onDragLeave={(e) => e.currentTarget.classList.remove('bg-orange-500/10', 'border-orange-500')}
                                        onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('bg-orange-500/10', 'border-orange-500'); handleDrop(pair.id, 'before'); }}
                                        className={`flex-1 rounded-2xl border-2 border-dashed flex items-center justify-center relative overflow-hidden transition-all ${before ? 'border-transparent bg-slate-900' : 'border-white/10 bg-black/20'}`}
                                    >
                                        {before ? (
                                            <>
                                                <img src={before.url} className="w-full h-full object-cover" alt="" />
                                                <div className="absolute top-3 left-3 px-3 py-1 bg-orange-600 rounded-lg text-[10px] font-black text-white uppercase tracking-widest backdrop-blur-md shadow-lg">Before</div>
                                                <button onClick={() => clearSlot(pair.id, 'before')} className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 hover:bg-red-600 text-white transition-all"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                                            </>
                                        ) : (
                                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Drop Before</span>
                                        )}
                                    </div>
                                    <div 
                                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-orange-500/10', 'border-orange-500'); }}
                                        onDragLeave={(e) => e.currentTarget.classList.remove('bg-orange-500/10', 'border-orange-500')}
                                        onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('bg-orange-500/10', 'border-orange-500'); handleDrop(pair.id, 'after'); }}
                                        className={`flex-1 rounded-2xl border-2 border-dashed flex items-center justify-center relative overflow-hidden transition-all ${after ? 'border-transparent bg-slate-900' : 'border-white/10 bg-black/20'}`}
                                    >
                                        {after ? (
                                            <>
                                                <img src={after.url} className="w-full h-full object-cover" alt="" />
                                                <div className="absolute top-3 left-3 px-3 py-1 bg-emerald-600 rounded-lg text-[10px] font-black text-white uppercase tracking-widest backdrop-blur-md shadow-lg">After</div>
                                                <button onClick={() => clearSlot(pair.id, 'after')} className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 hover:bg-red-600 text-white transition-all"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                                            </>
                                        ) : (
                                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Drop After</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    </div>
                    <button onClick={addPair} className="w-full py-10 border-2 border-dashed border-white/5 rounded-[2.5rem] bg-slate-900/40 hover:bg-slate-900/60 hover:border-orange-500/20 text-slate-500 hover:text-orange-500 transition-all flex flex-col items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Add New Comparison</span>
                    </button>
                </div>
            </section>
        </div>
    );
};

// --- Rendering Helpers ---

function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cw: number, ch: number) {
    const imgRatio = img.width / img.height;
    const canvasRatio = cw / ch;
    let dw, dh, dx, dy;
    
    // Use Math.max for Cover scaling to fill the frame
    if (imgRatio > canvasRatio) {
        dh = ch; dw = ch * imgRatio; dy = 0; dx = (cw - dw) / 2;
    } else {
        dw = cw; dh = cw / imgRatio; dx = 0; dy = (ch - dh) / 2;
    }
    ctx.drawImage(img, dx, dy, dw, dh);
}

function drawOverlayLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, scale: number, align: CanvasTextAlign) {
    ctx.save();
    // Labels are centered for vertical stack
    ctx.font = `900 ${80 * scale}px 'Plus Jakarta Sans', sans-serif`; 
    ctx.textAlign = align;
    ctx.textBaseline = 'bottom';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 12 * scale;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = 'white';
    ctx.fillText(text, x, y);
    ctx.restore();
}

function drawComparisonHandle(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
    const size = 30 * scale; 
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 10;
    
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x, y - size);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = '#0f172a';
    ctx.shadowBlur = 0;
    const inner = size * 0.4;
    // Left arrow
    ctx.beginPath();
    ctx.moveTo(x - inner, y);
    ctx.lineTo(x - (inner/3), y - inner);
    ctx.lineTo(x - (inner/3), y + inner);
    ctx.fill();
    // Right arrow
    ctx.beginPath();
    ctx.moveTo(x + inner, y);
    ctx.lineTo(x + (inner/3), y - inner);
    ctx.lineTo(x + (inner/3), y + inner);
    ctx.fill();
    ctx.restore();
}
