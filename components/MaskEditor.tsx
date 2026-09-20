import React, { useRef, useEffect, useState, useCallback } from 'react';

interface Point {
  x: number;
  y: number;
}

interface MaskEditorProps {
  originalUrl: string; 
  generatedUrl?: string; 
  mode?: 'mask' | 'reveal' | 'erase' | 'wall_mask';
  initialBrushSize?: number;
  initialMaskUrl?: string;
  customTitle?: string;
  customSubtitle?: string;
  customConfirmLabel?: string;
  onSave: (newImageUrl: string) => void;
  onCancel: () => void;
}

const MAX_UI_CANVAS_DIM = 3000;

export const MaskEditor: React.FC<MaskEditorProps> = ({ 
  originalUrl, 
  generatedUrl, 
  mode = 'reveal', 
  initialBrushSize,
  initialMaskUrl,
  customTitle,
  customSubtitle,
  customConfirmLabel,
  onSave, 
  onCancel 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskBufferRef = useRef<HTMLCanvasElement | null>(null);
  const scratchCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [imgDims, setImgDims] = useState<{ w: number; h: number; displayW: number; displayH: number } | null>(null);
  const [activeTool, setActiveTool] = useState<'brush' | 'lasso' | 'marquee'>('brush');
  const [brushSize, setBrushSize] = useState(initialBrushSize || 250);
  const [featherSize, setFeatherSize] = useState(mode === 'erase' ? 5 : 20);
  const [maskOpacity, setMaskOpacity] = useState(100);
  const [cursorPos, setCursorPos] = useState<Point | null>(null);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<Point | null>(null);
  
  const currentPointsRef = useRef<Point[]>([]);
  const lassoPointsRef = useRef<Point[]>([]);
  const [, forceUpdate] = useState({});

  const baseImgRef = useRef<HTMLImageElement | null>(null);
  const topImgRef = useRef<HTMLImageElement | null>(null); 
  const metricsRef = useRef<{ left: number, top: number, scaleX: number, scaleY: number } | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = async () => {
          try {
            if ('decode' in img) await img.decode();
            resolve(img);
          } catch (e) { resolve(img); }
        };
        img.onerror = () => reject(new Error(`Failed to load image.`));
        img.src = url;
      });

      try {
        const [base, top, initialMask] = await Promise.all([
          loadImage(originalUrl),
          generatedUrl && (mode === 'reveal') ? loadImage(generatedUrl) : Promise.resolve(null),
          initialMaskUrl ? loadImage(initialMaskUrl) : Promise.resolve(null)
        ]);

        if (active) {
          const w = base.naturalWidth;
          const h = base.naturalHeight;
          
          let displayW = w;
          let displayH = h;
          if (w > MAX_UI_CANVAS_DIM || h > MAX_UI_CANVAS_DIM) {
            const ratio = w / h;
            if (w > h) {
              displayW = MAX_UI_CANVAS_DIM;
              displayH = Math.round(MAX_UI_CANVAS_DIM / ratio);
            } else {
              displayH = MAX_UI_CANVAS_DIM;
              displayW = Math.round(MAX_UI_CANVAS_DIM * ratio);
            }
          }
          // COORDINATE LOCK: Ensure integer dimensions to prevent sub-pixel rendering shifts
          displayW = Math.floor(displayW);
          displayH = Math.floor(displayH);

          setImgDims({ w, h, displayW, displayH });
          baseImgRef.current = base;
          topImgRef.current = top;

          if (initialMask) {
            const mCanvas = document.createElement('canvas');
            mCanvas.width = displayW;
            mCanvas.height = displayH;
            const mCtx = mCanvas.getContext('2d')!;
            mCtx.drawImage(initialMask, 0, 0, displayW, displayH);
            maskBufferRef.current = mCanvas;
          }

          setImagesLoaded(true);
        }
      } catch (err) {
        console.error("MaskEditor load error:", err);
        onCancel();
      }
    };

    load();
    return () => { active = false; };
  }, [originalUrl, generatedUrl, initialMaskUrl, mode, onCancel]);

  const updateMetrics = useCallback(() => {
    if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        metricsRef.current = {
            left: rect.left,
            top: rect.top,
            scaleX: canvasRef.current.width / rect.width,
            scaleY: canvasRef.current.height / rect.height
        };
    }
  }, []);

  useEffect(() => {
    window.addEventListener('resize', updateMetrics);
    return () => window.removeEventListener('resize', updateMetrics);
  }, [updateMetrics]);

  const drawLine = (ctx: CanvasRenderingContext2D, points: Point[], width: number) => {
    if (points.length === 0) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = width;

    if (points.length === 1) {
        ctx.beginPath();
        ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
    }
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const xc = (points[i].x + points[i - 1].x) / 2;
      const yc = (points[i].y + points[i - 1].y) / 2;
      ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
  };

  const drawLassoPath = (ctx: CanvasRenderingContext2D, points: Point[], currentCursor: Point | null) => {
    if (points.length === 0) return;
    ctx.save();
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    if (currentCursor) {
        ctx.lineTo(currentCursor.x, currentCursor.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    points.forEach((p, idx) => {
        ctx.fillStyle = idx === 0 ? '#fff' : '#f97316';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
    });
    ctx.restore();
  };

  const drawMarquee = (ctx: CanvasRenderingContext2D, start: Point, current: Point) => {
    ctx.save();
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const w = Math.abs(start.x - current.x);
    const h = Math.abs(start.y - current.y);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  };

  useEffect(() => {
    if (!imagesLoaded || !imgDims || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    if (!maskBufferRef.current) {
        maskBufferRef.current = document.createElement('canvas');
        maskBufferRef.current.width = imgDims.displayW;
        maskBufferRef.current.height = imgDims.displayH;
    }
    const maskCanvas = maskBufferRef.current;

    if (!scratchCanvasRef.current) {
      scratchCanvasRef.current = document.createElement('canvas');
      scratchCanvasRef.current.width = imgDims.displayW;
      scratchCanvasRef.current.height = imgDims.displayH;
    }
    const scratchCanvas = scratchCanvasRef.current;
    const sCtx = scratchCanvas.getContext('2d')!;

    canvas.width = imgDims.displayW;
    canvas.height = imgDims.displayH;

    let frameId: number;

    const render = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (mode === 'reveal' && topImgRef.current && baseImgRef.current) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(topImgRef.current, 0, 0, canvas.width, canvas.height);

            sCtx.clearRect(0, 0, scratchCanvas.width, scratchCanvas.height);
            sCtx.globalCompositeOperation = 'source-over';
            sCtx.drawImage(baseImgRef.current, 0, 0, scratchCanvas.width, scratchCanvas.height);
            
            sCtx.globalCompositeOperation = 'destination-in';
            if (featherSize > 0) sCtx.filter = `blur(${featherSize}px)`;
            sCtx.globalAlpha = maskOpacity / 100;
            sCtx.drawImage(maskCanvas, 0, 0);
            
            if (activeTool === 'brush' && isPointerDown && currentPointsRef.current.length > 0) {
                sCtx.fillStyle = 'white';
                sCtx.strokeStyle = 'white';
                drawLine(sCtx, currentPointsRef.current, brushSize);
            }
            sCtx.globalAlpha = 1.0;
            sCtx.filter = 'none';

            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(scratchCanvas, 0, 0);

        } else if (mode === 'erase') {
            ctx.globalCompositeOperation = 'source-over';
            if (baseImgRef.current) ctx.drawImage(baseImgRef.current, 0, 0, canvas.width, canvas.height);

            sCtx.clearRect(0, 0, scratchCanvas.width, scratchCanvas.height);
            sCtx.globalCompositeOperation = 'source-over';
            sCtx.fillStyle = 'rgba(239, 68, 68, 1)'; 
            sCtx.fillRect(0, 0, scratchCanvas.width, scratchCanvas.height);
            
            sCtx.globalCompositeOperation = 'destination-in';
            if (featherSize > 0) sCtx.filter = `blur(${featherSize}px)`;
            sCtx.drawImage(maskCanvas, 0, 0);
            sCtx.filter = 'none';
            
            if (activeTool === 'brush' && isPointerDown && currentPointsRef.current.length > 0) {
                sCtx.globalCompositeOperation = 'source-over';
                sCtx.fillStyle = 'rgba(239, 68, 68, 1)';
                sCtx.strokeStyle = 'rgba(239, 68, 68, 1)';
                if (featherSize > 0) sCtx.filter = `blur(${featherSize}px)`;
                drawLine(sCtx, currentPointsRef.current, brushSize);
                sCtx.filter = 'none';
            }

            ctx.globalAlpha = 0.6;
            ctx.drawImage(scratchCanvas, 0, 0);
            ctx.globalAlpha = 1.0;
            ctx.globalCompositeOperation = 'source-over';

        } else {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            if (baseImgRef.current) {
                ctx.save(); ctx.globalAlpha = 0.4; ctx.drawImage(baseImgRef.current, 0, 0, canvas.width, canvas.height); ctx.restore();
            }
            ctx.globalCompositeOperation = 'screen';
            if (featherSize > 0) ctx.filter = `blur(${featherSize}px)`;
            ctx.globalAlpha = maskOpacity / 100;
            ctx.drawImage(maskCanvas, 0, 0);
            if (activeTool === 'brush' && isPointerDown && currentPointsRef.current.length > 0) {
                ctx.fillStyle = 'rgba(249, 115, 22, 0.8)';
                ctx.strokeStyle = 'rgba(249, 115, 22, 0.8)';
                drawLine(ctx, currentPointsRef.current, brushSize);
            }
            ctx.globalAlpha = 1.0;
            ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
        }

        if (activeTool === 'lasso' && lassoPointsRef.current.length > 0) {
            drawLassoPath(ctx, lassoPointsRef.current, cursorPos);
        }

        if (activeTool === 'marquee' && marqueeStart && cursorPos) {
            drawMarquee(ctx, marqueeStart, cursorPos);
        }

        frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    updateMetrics(); 
    return () => cancelAnimationFrame(frameId);
  }, [imagesLoaded, imgDims, mode, isPointerDown, brushSize, featherSize, maskOpacity, updateMetrics, activeTool, cursorPos, marqueeStart]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!imagesLoaded || !metricsRef.current) return;
    const m = metricsRef.current;
    const coords = { x: (e.clientX - m.left) * m.scaleX, y: (e.clientY - m.top) * m.scaleY };
    
    if (activeTool === 'brush') {
        setIsPointerDown(true);
        currentPointsRef.current = [coords];
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else if (activeTool === 'lasso') {
        if (lassoPointsRef.current.length > 0) {
            const first = lassoPointsRef.current[0];
            const dist = Math.hypot(first.x - coords.x, first.y - coords.y);
            if (dist < 15) {
                finalizeLasso();
                return;
            }
        }
        lassoPointsRef.current.push(coords);
        forceUpdate({});
    } else if (activeTool === 'marquee') {
        setIsPointerDown(true);
        setMarqueeStart(coords);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!metricsRef.current) return;
    const m = metricsRef.current;
    const coords = { x: (e.clientX - m.left) * m.scaleX, y: (e.clientY - m.top) * m.scaleY };
    setCursorPos(coords);
    if (activeTool === 'brush' && isPointerDown) {
      currentPointsRef.current.push(coords);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeTool === 'brush' && isPointerDown) {
        setIsPointerDown(false);
        if (maskBufferRef.current && currentPointsRef.current.length > 0) {
            const mCtx = maskBufferRef.current.getContext('2d')!;
            mCtx.strokeStyle = 'white'; mCtx.fillStyle = 'white';
            drawLine(mCtx, currentPointsRef.current, brushSize);
        }
        currentPointsRef.current = [];
        forceUpdate({}); 
    } else if (activeTool === 'marquee' && isPointerDown && marqueeStart && cursorPos) {
        setIsPointerDown(false);
        if (maskBufferRef.current) {
            const mCtx = maskBufferRef.current.getContext('2d')!;
            mCtx.fillStyle = 'white';
            const x = Math.min(marqueeStart.x, cursorPos.x);
            const y = Math.min(marqueeStart.y, cursorPos.y);
            const w = Math.abs(marqueeStart.x - cursorPos.x);
            const h = Math.abs(marqueeStart.y - cursorPos.y);
            mCtx.fillRect(x, y, w, h);
        }
        setMarqueeStart(null);
        forceUpdate({});
    }
  };

  const finalizeLasso = () => {
    if (lassoPointsRef.current.length < 3) {
        lassoPointsRef.current = [];
        forceUpdate({});
        return;
    }
    if (maskBufferRef.current) {
        const mCtx = maskBufferRef.current.getContext('2d')!;
        mCtx.fillStyle = 'white';
        mCtx.beginPath();
        mCtx.moveTo(lassoPointsRef.current[0].x, lassoPointsRef.current[0].y);
        for (let i = 1; i < lassoPointsRef.current.length; i++) {
            mCtx.lineTo(lassoPointsRef.current[i].x, lassoPointsRef.current[i].y);
        }
        mCtx.closePath();
        mCtx.fill();
    }
    lassoPointsRef.current = [];
    forceUpdate({});
  };

  const handleSaveInternal = () => {
    if (!imgDims || !baseImgRef.current || !maskBufferRef.current) return;
    const w = topImgRef.current?.naturalWidth || imgDims.w;
    const h = topImgRef.current?.naturalHeight || imgDims.h;
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = w; finalCanvas.height = h;
    const fCtx = finalCanvas.getContext('2d')!;

    if (mode === 'reveal' && topImgRef.current) {
        fCtx.drawImage(topImgRef.current, 0, 0);
        const patchCanvas = document.createElement('canvas');
        patchCanvas.width = w; patchCanvas.height = h;
        const pCtx = patchCanvas.getContext('2d')!;
        pCtx.drawImage(baseImgRef.current, 0, 0, w, h);
        pCtx.globalCompositeOperation = 'destination-in';
        if (featherSize > 0) {
          const outputScale = w / imgDims.displayW;
          pCtx.filter = `blur(${featherSize * outputScale}px)`;
        }
        pCtx.globalAlpha = maskOpacity / 100;
        pCtx.drawImage(maskBufferRef.current, 0, 0, w, h);
        pCtx.filter = 'none';
        fCtx.globalCompositeOperation = 'source-over';
        fCtx.drawImage(patchCanvas, 0, 0);
        onSave(finalCanvas.toDataURL('image/png'));
    } else if (mode === 'erase') {
        fCtx.fillStyle = 'black'; fCtx.fillRect(0, 0, w, h);
        fCtx.fillStyle = 'white'; fCtx.strokeStyle = 'white';
        if (featherSize > 0) {
          const outputScale = w / imgDims.displayW;
          fCtx.filter = `blur(${featherSize * outputScale}px)`;
        }
        fCtx.drawImage(maskBufferRef.current, 0, 0, w, h);
        fCtx.filter = 'none';
        onSave(finalCanvas.toDataURL('image/png'));
    } else {
        fCtx.fillStyle = 'black'; fCtx.fillRect(0, 0, w, h);
        if (featherSize > 0) {
          const outputScale = w / imgDims.displayW;
          fCtx.filter = `blur(${featherSize * outputScale}px)`;
        }
        fCtx.globalAlpha = maskOpacity / 100;
        fCtx.drawImage(maskBufferRef.current, 0, 0, w, h);
        fCtx.filter = 'none';
        onSave(finalCanvas.toDataURL('image/png'));
    }
  };

  const handleReset = () => {
    if (maskBufferRef.current && imgDims) {
        const mCtx = maskBufferRef.current.getContext('2d')!;
        mCtx.clearRect(0, 0, imgDims.displayW, imgDims.displayH);
        lassoPointsRef.current = [];
        setMarqueeStart(null);
        forceUpdate({});
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col" onClick={(e) => e.stopPropagation()}>
      <div 
           className="relative flex-grow overflow-hidden flex items-center justify-center bg-slate-900 shadow-inner" 
           onPointerDown={handlePointerDown}
           onPointerUp={handlePointerUp}
           onPointerMove={handlePointerMove}
           onPointerLeave={() => { setCursorPos(null); if (activeTool === 'brush') setIsPointerDown(false); }}
           onDoubleClick={() => { if (activeTool === 'lasso') finalizeLasso(); }}
           style={{ touchAction: 'none', cursor: activeTool === 'brush' ? 'none' : 'crosshair' }} 
      >
        {!imagesLoaded && (
          <div className="flex flex-col items-center gap-4">
             <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Loading Canvas...</span>
          </div>
        )}

        {imagesLoaded && imgDims && (
            <div 
                className="relative bg-slate-800 shadow-2xl"
                style={{ maxHeight: '85vh', maxWidth: '85vw', aspectRatio: `${imgDims.w} / ${imgDims.h}` }}
            >
                <canvas ref={canvasRef} className="w-full h-full block touch-none" />
                {activeTool === 'brush' && cursorPos && (
                  <div 
                    className={`absolute pointer-events-none rounded-full border border-white mix-blend-difference z-50 ${mode === 'erase' ? 'bg-red-500/30 border-red-500' : 'bg-white/20'}`}
                    style={{
                      left: cursorPos.x / (metricsRef.current?.scaleX || 1),
                      top: cursorPos.y / (metricsRef.current?.scaleY || 1),
                      width: brushSize / (metricsRef.current?.scaleX || 1),
                      height: brushSize / (metricsRef.current?.scaleX || 1),
                      transform: 'translate(-50%, -50%)',
                      filter: featherSize > 0 ? `blur(${featherSize / (metricsRef.current?.scaleX || 1)}px)` : 'none'
                    }}
                  />
                )}
            </div>
        )}
        
        <div className="absolute top-8 left-1/2 -translate-x-1/2 px-6 py-2.5 bg-black/80 backdrop-blur-xl rounded-full border border-white/10 text-[9px] font-black text-white uppercase tracking-widest pointer-events-none z-40 text-center">
            {customTitle ? `${customTitle} — ` : ''}
            {activeTool === 'brush' ? 'Paint target surfaces' : activeTool === 'lasso' ? 'Polygon collection: Click to add points (Double click to close)' : 'Click and drag to select rectangle'}
            {customSubtitle && <span className="block text-[8px] text-slate-400 font-normal mt-0.5">{customSubtitle}</span>}
        </div>
      </div>

      <div className="bg-slate-900 border-t border-white/5 p-6 flex items-center justify-between gap-8 z-50 overflow-x-auto scrollbar-hide">
         <div className="flex items-center gap-8 flex-grow max-w-6xl">
            <div className="flex items-center bg-slate-800/50 p-1 rounded-xl border border-white/5 shrink-0">
               <button onClick={() => setActiveTool('brush')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTool === 'brush' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1-1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" /></svg>
                   Brush
               </button>
               <button onClick={() => setActiveTool('lasso')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTool === 'lasso' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
                   Lasso
               </button>
               <button onClick={() => setActiveTool('marquee')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTool === 'marquee' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 3.75h3M3 8.25h3M3 12.75h3M3 17.25h3M3 21h3M21 3.75h-3M21 8.25h-3M21 12.75h-3M21 17.25h-3M21 21h-3M8.25 3h3.5M12.75 3h3.5M8.25 21h3.5M12.75 21h3.5" /></svg>
                   Marquee
               </button>
            </div>

            {activeTool === 'brush' && (
              <div className="flex flex-col gap-2 min-w-[120px]">
                 <div className="flex justify-between">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Brush size</label>
                    <span className="text-[10px] font-mono text-orange-500 font-bold">{brushSize}px</span>
                 </div>
                 <input type="range" min="10" max="1000" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-full h-1 bg-slate-800 rounded-full appearance-none cursor-pointer accent-orange-500" />
              </div>
            )}
            
            <div className="flex flex-col gap-2 min-w-[120px]">
               <div className="flex justify-between">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Feathering</label>
                  <span className="text-[10px] font-mono text-orange-500 font-bold">{featherSize}px</span>
               </div>
               <input type="range" min="0" max="150" value={featherSize} onChange={(e) => setFeatherSize(parseInt(e.target.value))} className="w-full h-1 bg-slate-800 rounded-full appearance-none cursor-pointer accent-orange-500" />
            </div>

            {mode !== 'erase' && (
              <div className="flex flex-col gap-2 min-w-[120px]">
                <div className="flex justify-between">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Opacity</label>
                    <span className="text-[10px] font-mono text-orange-500 font-bold">{maskOpacity}%</span>
                </div>
                <input type="range" min="0" max="100" value={maskOpacity} onChange={(e) => setMaskOpacity(parseInt(e.target.value))} className="w-full h-1 bg-slate-800 rounded-full appearance-none cursor-pointer accent-orange-500" />
              </div>
            )}

            <button onClick={handleReset} className="px-5 py-2.5 rounded-lg text-[9px] font-black text-slate-400 border border-white/5 hover:bg-white/5 transition-all mt-4">Reset</button>
         </div>
         <div className="flex items-center gap-4 shrink-0">
            <button onClick={onCancel} className="px-6 py-3 text-xs font-bold text-slate-400 hover:text-white transition-colors">Discard</button>
            <button onClick={handleSaveInternal} disabled={!imagesLoaded} className={`px-8 py-3.5 rounded-xl text-white text-xs font-black uppercase tracking-widest transition-all shadow-xl disabled:opacity-30 ${mode === 'erase' ? 'bg-red-600 hover:bg-red-500' : 'bg-orange-600 hover:bg-orange-500'}`}>
              {customConfirmLabel || (mode === 'erase' ? 'Run Eraser' : mode === 'mask' ? 'Save Selection' : 'Apply Restoration')}
            </button>
         </div>
      </div>
    </div>
  );
};