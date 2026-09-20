import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ImageItem } from '../types';
import { project360ToRectilinear, dilateMask, getOptimalProjectionResolution, getImageDimensions, shiftPanoramaHorizontal } from '../services/imageUtils';
import { generateSurgicalMask } from '../services/geminiService';
import { FURNITURE_STYLES, STAGING_ROOMS, PANORAMA_PRESETS } from '../constants';

interface PanoramaEditorProps {
  item: ImageItem;
  onSaveReproject: (
    projectedUrl: string,
    yaw: number,
    pitch: number,
    fov: number,
    toolId?: string,
    toolConfig?: {
      stagingRoom?: string;
      stagingStyle?: string;
      stageDescriptor?: string;
      swapStyle?: string;
      swapDescriptor?: string;
      customPrompt?: string;
      declutterMode?: 'full_depopulation' | 'loose_clutter';
      clutterMaskBase64?: string | null;
      maskCoverageRatio?: number | null;
    }
  ) => void;
  onSaveOrientation: (yaw: number, pitch: number, fov: number) => void;
  onUpdatePanoSource?: (newEquirectangularUrl: string) => void;
  onExportFlat?: (projectedUrl: string) => void;
  onCancel: () => void;
}

export const PanoramaEditor: React.FC<PanoramaEditorProps> = ({
  item,
  onSaveReproject,
  onSaveOrientation,
  onUpdatePanoSource,
  onExportFlat,
  onCancel
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [yaw, setYaw] = useState<number>(item.config.panoYaw ?? 0);
  const [pitch, setPitch] = useState<number>(item.config.panoPitch ?? -5);
  const [fov, setFov] = useState<number>(item.config.panoFov ?? 80);

  // View Mode: 'perspective' (targeted camera frustum) vs 'equirectangular' (horizontal 2D sliding)
  const [viewMode, setViewMode] = useState<'perspective' | 'equirectangular'>('perspective');
  const [panoShiftDeg, setPanoShiftDeg] = useState<number>(0);
  const [isShifting, setIsShifting] = useState<boolean>(false);
  const [shiftSuccessMsg, setShiftSuccessMsg] = useState<string | null>(null);

  const [selectedTool, setSelectedTool] = useState<string>(
    item.assignedTools.find(t => t.startsWith('p360_')) || 'p360_vstaging_3d'
  );
  const [stagingRoom, setStagingRoom] = useState<string>(
    item.config.stagingRoom || STAGING_ROOMS[0]
  );
  const [stagingStyle, setStagingStyle] = useState<string>(
    item.config.stagingStyle || item.config.swapStyle || FURNITURE_STYLES[0]
  );
  const [stageDescriptor, setStageDescriptor] = useState<string>(
    item.config.stageDescriptor || item.config.swapDescriptor || ''
  );
  const [customPrompt, setCustomPrompt] = useState<string>(item.config.customPrompt || '');

  // 360 Declutter Mask Inspection States
  const [declutterMode, setDeclutterMode] = useState<'full_depopulation' | 'loose_clutter'>('full_depopulation');
  const [previewMaskBase64, setPreviewMaskBase64] = useState<string | null>(null);
  const [previewOverlayUrl, setPreviewOverlayUrl] = useState<string | null>(null);
  const [maskCoverageRatio, setMaskCoverageRatio] = useState<number | null>(null);
  const [isInspectingMask, setIsInspectingMask] = useState<boolean>(false);
  const [showMaskOverlay, setShowMaskOverlay] = useState<boolean>(true);

  const [isProjecting, setIsProjecting] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [sourceDims, setSourceDims] = useState<{ width: number; height: number }>({ width: 4096, height: 2048 });
  const [cropDims, setCropDims] = useState<{ width: number; height: number }>({ width: 2048, height: 1536 });
  const dragStartRef = useRef<{ x: number; y: number; yaw: number; pitch: number; shift: number }>({
    x: 0,
    y: 0,
    yaw: 0,
    pitch: 0,
    shift: 0
  });

  const imgRef = useRef<HTMLImageElement | null>(null);

  // Base source URL (current history or original preview)
  const baseSourceUrl =
    item.currentHistoryIndex >= 0 && item.history[item.currentHistoryIndex]?.url
      ? item.history[item.currentHistoryIndex].url
      : item.previewUrl;

  const [workingSourceUrl, setWorkingSourceUrl] = useState<string>(baseSourceUrl);

  useEffect(() => {
    setWorkingSourceUrl(baseSourceUrl);
  }, [baseSourceUrl]);

  useEffect(() => {
    setIsLoaded(false);
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      imgRef.current = img;
      setIsLoaded(true);
      const w = img.naturalWidth || 4096;
      const h = img.naturalHeight || 2048;
      setSourceDims({ width: w, height: h });
      const opt = getOptimalProjectionResolution(w, h, fov);
      setCropDims(opt);
    };
    img.src = workingSourceUrl;
  }, [workingSourceUrl, fov]);

  const renderPreview = useCallback(async () => {
    if (!imgRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (viewMode === 'equirectangular') {
      const img = imgRef.current;
      const W = img.naturalWidth || img.width;
      const H = img.naturalHeight || img.height;
      const cW = canvas.width;
      const cH = canvas.height;

      let normDeg = ((panoShiftDeg % 360) + 360) % 360;
      const shiftPx = Math.round((normDeg / 360) * W);

      ctx.clearRect(0, 0, cW, cH);

      if (shiftPx === 0) {
        ctx.drawImage(img, 0, 0, W, H, 0, 0, cW, cH);
      } else {
        const leftSourceW = W - shiftPx;
        const leftDestW = (leftSourceW / W) * cW;
        // Draw right portion to left of canvas
        ctx.drawImage(img, shiftPx, 0, leftSourceW, H, 0, 0, leftDestW, cH);
        // Draw left portion to right of canvas
        ctx.drawImage(img, 0, 0, shiftPx, H, leftDestW, 0, cW - leftDestW, cH);
      }

      // Visual guidelines on flat panorama
      ctx.save();
      // Center guideline (orange)
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.85)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cW / 2, 0);
      ctx.lineTo(cW / 2, cH);
      ctx.stroke();

      // Seam line (sky blue) if shifted
      if (shiftPx > 0) {
        const seamX = ((W - shiftPx) / W) * cW;
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.85)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(seamX, 0);
        ctx.lineTo(seamX, cH);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      try {
        const projected = await project360ToRectilinear(
          workingSourceUrl,
          yaw,
          pitch,
          fov,
          800,
          500
        );
        const pImg = new Image();
        pImg.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(pImg, 0, 0, canvas.width, canvas.height);
        };
        pImg.src = projected;
      } catch (err) {
        console.error("Preview projection error:", err);
      }
    }
  }, [workingSourceUrl, viewMode, panoShiftDeg, yaw, pitch, fov]);

  useEffect(() => {
    if (isLoaded) {
      const timer = setTimeout(() => {
        renderPreview();
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [yaw, pitch, fov, isLoaded, viewMode, panoShiftDeg, renderPreview]);

  // Interactive mouse drag to look around (perspective) or slide seam (equirectangular)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      yaw,
      pitch,
      shift: panoShiftDeg
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    if (viewMode === 'equirectangular') {
      const containerWidth = containerRef.current?.clientWidth || 800;
      const shiftChange = -(dx / containerWidth) * 360;
      let newShift = (dragStartRef.current.shift + shiftChange) % 360;
      if (newShift < 0) newShift += 360;
      setPanoShiftDeg(Math.round(newShift));
    } else {
      const sensitivity = 0.25;
      let newYaw = dragStartRef.current.yaw - dx * sensitivity;
      while (newYaw > 180) newYaw -= 360;
      while (newYaw < -180) newYaw += 360;

      let newPitch = dragStartRef.current.pitch + dy * sensitivity;
      newPitch = Math.max(-85, Math.min(85, newPitch));

      setYaw(Math.round(newYaw));
      setPitch(Math.round(newPitch));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Smooth mouse wheel / trackpad zooming or shifting
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (viewMode === 'equirectangular') {
      const step = e.shiftKey ? 1 : 5;
      const delta = e.deltaY > 0 ? step : -step;
      setPanoShiftDeg(prev => {
        let n = (prev + delta) % 360;
        return n < 0 ? n + 360 : n;
      });
    } else {
      const zoomStep = e.shiftKey ? 1 : 4;
      const delta = e.deltaY > 0 ? zoomStep : -zoomStep;
      setFov(prev => Math.max(30, Math.min(160, prev + delta)));
    }
  };

  // Preset camera views
  const applyPresetAngle = (presetYaw: number, presetPitch: number, presetFov: number) => {
    setYaw(presetYaw);
    setPitch(presetPitch);
    setFov(presetFov);
  };

  // Primary Native Resolution Crop + Reproject Action
  const handleExecute1KStaging = async () => {
    setIsProjecting(true);
    try {
      // Extract targeted rectilinear crop matching native panorama resolution (e.g. 2048x1536 for 4K pano)
      const projected = await project360ToRectilinear(
        workingSourceUrl,
        yaw,
        pitch,
        fov,
        cropDims.width,
        cropDims.height
      );
      onSaveReproject(projected, yaw, pitch, fov, selectedTool, {
        stagingRoom,
        stagingStyle,
        stageDescriptor,
        swapStyle: stagingStyle,
        swapDescriptor: stageDescriptor,
        customPrompt,
        declutterMode,
        clutterMaskBase64: declutterMode === 'loose_clutter' ? previewMaskBase64 : null,
        maskCoverageRatio
      });
    } catch (e) {
      console.error(e);
      setIsProjecting(false);
    }
  };

  // Inspect & preview clutter mask directly in 360 editor
  const handleInspectClutterMask = async () => {
    setIsInspectingMask(true);
    try {
      const projected = await project360ToRectilinear(
        workingSourceUrl,
        yaw,
        pitch,
        fov,
        cropDims.width,
        cropDims.height
      );
      const rectBase64 = projected.split(',')[1];
      const rawMaskUrl = await generateSurgicalMask(rectBase64, 'image/png', 'clutter');
      const { dilatedDataUrl, coverageRatio, previewOverlayUrl: overlayUrl } = await dilateMask(rawMaskUrl, 20, true);
      setPreviewMaskBase64(dilatedDataUrl.split(',')[1]);
      setPreviewOverlayUrl(overlayUrl || null);
      setMaskCoverageRatio(coverageRatio);
      setShowMaskOverlay(true);
    } catch (err) {
      console.warn("Clutter mask inspection failed:", err);
    } finally {
      setIsInspectingMask(false);
    }
  };

  // Save orientation for batch processing
  const handleSaveOrientationOnly = () => {
    onSaveOrientation(yaw, pitch, fov);
    onCancel();
  };

  // Apply the rotated/shifted panorama as the new base orientation
  const handleApplyPanoShift = async () => {
    if (panoShiftDeg === 0) return;
    setIsShifting(true);
    try {
      const shiftedUrl = await shiftPanoramaHorizontal(workingSourceUrl, panoShiftDeg);
      setWorkingSourceUrl(shiftedUrl);
      const prevShift = panoShiftDeg;
      setPanoShiftDeg(0);
      if (onUpdatePanoSource) {
        onUpdatePanoSource(shiftedUrl);
      }
      setShiftSuccessMsg(`Panorama shifted ${prevShift}° and saved as new base orientation!`);
      setTimeout(() => setShiftSuccessMsg(null), 4000);
    } catch (e) {
      console.error("Failed to apply horizontal shift:", e);
    } finally {
      setIsShifting(false);
    }
  };

  // Download the shifted 4K panorama directly
  const handleDownloadShiftedPano = async () => {
    setIsShifting(true);
    try {
      const shiftedUrl = panoShiftDeg === 0
        ? workingSourceUrl
        : await shiftPanoramaHorizontal(workingSourceUrl, panoShiftDeg);
      const a = document.createElement('a');
      a.href = shiftedUrl;
      a.download = `re_centered_${item.file.name.replace(/\.[^/.]+$/, '')}_shift_${panoShiftDeg}deg.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error("Failed to download shifted panorama:", e);
    } finally {
      setIsShifting(false);
    }
  };

  // Export Flat 2D Photo
  const handleExportFlatPhoto = async () => {
    setIsProjecting(true);
    try {
      const flat1080p = await project360ToRectilinear(
        workingSourceUrl,
        yaw,
        pitch,
        fov,
        1920,
        1080
      );
      if (onExportFlat) {
        onExportFlat(flat1080p);
      } else {
        const a = document.createElement('a');
        a.href = flat1080p;
        a.download = `360_perspective_${item.file.name.replace(/\.[^/.]+$/, '')}_${yaw}deg.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProjecting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto"
      onMouseUp={handleMouseUp}
    >
      <div className="max-w-5xl w-full space-y-6 animate-fade-in-up my-auto">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[9px] font-black tracking-widest uppercase">
                360 Panorama Stager
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black tracking-widest uppercase flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                </svg>
                Targeted 1K Crop + Reprojection (Lowest $ Cost)
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Spherical FOV Camera & AI Staging
            </h2>
            <p className="text-xs font-medium text-slate-400 max-w-2xl">
              Aims a targeted 1K camera frustum at the focal area to run cost-effective AI staging, then automatically reprojects the result seamlessly back into your original high-resolution (up to 8K) Kuula panorama.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
            title="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Main Stage & Viewport */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Viewport Box (Left 7 cols) */}
          <div className="lg:col-span-7 space-y-3">
            {/* View Mode Toggle Switcher */}
            <div className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded-2xl border border-white/10 shadow-lg">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  id="btn-mode-perspective"
                  onClick={() => setViewMode('perspective')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    viewMode === 'perspective'
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  <span>360 Camera View</span>
                </button>
                <button
                  type="button"
                  id="btn-mode-equirectangular"
                  onClick={() => setViewMode('equirectangular')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    viewMode === 'equirectangular'
                      ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                  </svg>
                  <span>Slide Panorama (Horizontal Roll)</span>
                </button>
              </div>

              <div className="pr-2 text-[9px] font-mono font-bold flex items-center gap-1.5">
                {viewMode === 'perspective' ? (
                  <span className="text-orange-400">Aim Frustum to Stage</span>
                ) : (
                  <span className="text-sky-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                    Lossless 2D Re-Center
                  </span>
                )}
              </div>
            </div>

            {/* Viewport Canvas Container */}
            <div
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onWheel={handleWheel}
              className={`relative ${
                viewMode === 'equirectangular' ? 'aspect-[2/1] border-sky-500/30' : 'aspect-[16/10] border-white/10'
              } bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border flex items-center justify-center select-none cursor-grab active:cursor-grabbing group`}
            >
              {!isLoaded ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full" />
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    Loading 360 Texture...
                  </span>
                </div>
              ) : (
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={viewMode === 'equirectangular' ? 400 : 500}
                  className="w-full h-full object-contain pointer-events-none"
                />
              )}

              {/* Clutter Mask Review Visual Overlay (Perspective Only) */}
              {viewMode === 'perspective' && showMaskOverlay && previewOverlayUrl && (
                <img
                  src={previewOverlayUrl}
                  alt="Clutter Mask Review"
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none mix-blend-screen opacity-85 transition-opacity"
                />
              )}

              {/* Viewport Reticle / Grid Overlay */}
              {viewMode === 'perspective' ? (
                <div className="absolute inset-0 pointer-events-none border border-white/5 flex items-center justify-center opacity-30 group-hover:opacity-60 transition-opacity">
                  <div className="w-8 h-8 border border-white/40 rounded-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full" />
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 opacity-60">
                  <div className="flex justify-between text-[8px] font-mono font-bold text-slate-400">
                    <span>Left Seam (0°)</span>
                    <span className="text-orange-400 font-black">Center Focal Line</span>
                    <span>Right Seam (360°)</span>
                  </div>
                  {panoShiftDeg > 0 && (
                    <div className="flex justify-center">
                      <span className="px-2 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-500/30 text-[8px] font-mono">
                        Dashed blue line = wrapped seam location
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Viewport Info Overlay */}
              <div className="absolute top-4 left-4 flex gap-2 z-20">
                {viewMode === 'perspective' ? (
                  <div className="px-3 py-1.5 bg-slate-950/85 backdrop-blur-md rounded-xl border border-white/10 text-[9px] font-mono text-slate-300 font-bold shadow-lg flex items-center gap-2">
                    <span>Yaw: <strong className="text-orange-400 font-semibold">{yaw}°</strong></span>
                    <span className="text-slate-600">|</span>
                    <span>Pitch: <strong className="text-orange-400 font-semibold">{pitch}°</strong></span>
                    <span className="text-slate-600">|</span>
                    <span>Zoom: <strong className="text-orange-400 font-semibold">{fov}°</strong></span>
                    <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      fov === 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      fov >= 135 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                      fov >= 105 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {fov === 80 ? '★ Sweet Spot' : fov <= 70 ? 'Close-Up' : fov <= 95 ? 'Standard' : fov <= 125 ? 'Wide' : fov <= 145 ? 'Ultra-Wide' : 'Super Pano'}
                    </span>
                  </div>
                ) : (
                  <div className="px-3 py-1.5 bg-slate-950/85 backdrop-blur-md rounded-xl border border-sky-500/30 text-[9px] font-mono text-slate-200 font-bold shadow-lg flex items-center gap-2">
                    <span className="text-sky-400 font-bold">Shift:</span>
                    <strong className="text-white font-mono text-xs">{panoShiftDeg}°</strong>
                    <span className="text-slate-500">({Math.round((panoShiftDeg / 360) * 100)}%)</span>
                    <span className="px-1.5 py-0.5 bg-sky-500/20 text-sky-300 rounded text-[8px] uppercase tracking-wider font-sans">
                      2:1 Equirectangular
                    </span>
                  </div>
                )}
              </div>

              {/* Floating Quick Controls on Canvas */}
              {viewMode === 'perspective' ? (
                <div className="absolute top-4 right-4 flex flex-col gap-1.5 z-20">
                  <button
                    type="button"
                    id="btn-pano-zoom-in"
                    onClick={(e) => { e.stopPropagation(); setFov(f => Math.max(30, f - 6)); }}
                    title="Zoom In (Decrease FOV)"
                    className="w-8 h-8 rounded-xl bg-slate-950/85 hover:bg-orange-500 text-slate-200 hover:text-white border border-white/10 flex items-center justify-center transition-all shadow-lg cursor-pointer active:scale-95"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    id="btn-pano-zoom-out"
                    onClick={(e) => { e.stopPropagation(); setFov(f => Math.min(160, f + 6)); }}
                    title="Zoom Out / Ultra-Wide (Increase FOV up to 160°)"
                    className="w-8 h-8 rounded-xl bg-slate-950/85 hover:bg-orange-500 text-slate-200 hover:text-white border border-white/10 flex items-center justify-center transition-all shadow-lg cursor-pointer active:scale-95"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    id="btn-pano-zoom-reset"
                    onClick={(e) => { e.stopPropagation(); setFov(80); }}
                    title="Set to Optimum Sharpness Sweet Spot 80°"
                    className="w-8 h-7 rounded-xl bg-emerald-950/90 hover:bg-emerald-800 text-[8.5px] font-mono text-emerald-300 font-bold border border-emerald-500/30 flex items-center justify-center transition-all shadow-lg cursor-pointer"
                  >
                    80°
                  </button>
                </div>
              ) : (
                <div className="absolute top-4 right-4 flex items-center gap-1.5 z-20">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPanoShiftDeg(s => ((s - 15) % 360 + 360) % 360); }}
                    title="Nudge Left -15°"
                    className="px-2 py-1 rounded-xl bg-slate-950/85 hover:bg-sky-500 text-[9px] font-mono font-bold text-slate-200 hover:text-white border border-white/10 transition-all shadow-lg cursor-pointer"
                  >
                    -15°
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPanoShiftDeg(s => (s + 15) % 360); }}
                    title="Nudge Right +15°"
                    className="px-2 py-1 rounded-xl bg-slate-950/85 hover:bg-sky-500 text-[9px] font-mono font-bold text-slate-200 hover:text-white border border-white/10 transition-all shadow-lg cursor-pointer"
                  >
                    +15°
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPanoShiftDeg(0); }}
                    title="Reset Shift to 0°"
                    className="px-2 py-1 rounded-xl bg-slate-950/85 hover:bg-slate-800 text-[9px] font-mono font-bold text-sky-400 border border-sky-500/30 transition-all shadow-lg cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              )}

              {/* Bottom Guidance Pill */}
              <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-slate-950/85 backdrop-blur-md rounded-full border border-white/10 text-[9px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2 shadow-lg pointer-events-none">
                {viewMode === 'perspective' ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-orange-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.834.166-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243-1.59-1.59" />
                    </svg>
                    <span>Drag to Aim • Scroll Wheel to Zoom</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-sky-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                    </svg>
                    <span>Drag Sideways to Slide Panorama Seam • Scroll Wheel to Nudge</span>
                  </>
                )}
              </div>
            </div>

            {/* Notification Banner on Apply */}
            {shiftSuccessMsg && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-2xl text-xs text-emerald-200 flex items-center justify-between gap-2 shadow-lg animate-fade-in">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-emerald-400 shrink-0">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  <span className="font-semibold">{shiftSuccessMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setViewMode('perspective')}
                  className="px-2.5 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[9px] uppercase tracking-wider transition-all"
                >
                  Switch to 360 Camera →
                </button>
              </div>
            )}

            {/* View Mode Specific Controls */}
            {viewMode === 'equirectangular' ? (
              /* Dedicated Horizontal Seam Shift Controller */
              <div className="space-y-3.5 bg-slate-900/70 p-4 rounded-2xl border border-sky-500/20 shadow-xl">
                <div className="p-3.5 bg-slate-950/80 rounded-xl border border-sky-500/30 space-y-3 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-200">
                        Equirectangular Horizontal Shift (Seam Roll)
                      </span>
                      <span className="text-[8px] font-bold uppercase px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40">
                        Lossless 2D Wrap
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-black text-sky-400">
                        {panoShiftDeg}°
                      </span>
                      <span className="text-[9px] font-mono text-slate-400">
                        / 360°
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Shift Range Slider */}
                  <div className="space-y-1.5">
                    <input
                      type="range"
                      id="slider-horizontal-pano-shift"
                      min="0"
                      max="360"
                      step="1"
                      value={panoShiftDeg}
                      onChange={(e) => setPanoShiftDeg(Number(e.target.value))}
                      className="w-full h-2.5 bg-slate-800 rounded-full appearance-none accent-sky-400 cursor-pointer"
                    />
                    <div className="flex justify-between text-[8px] font-mono text-slate-400">
                      <span>0° (Original Seam)</span>
                      <span>90° (Quarter Right)</span>
                      <span>180° (Opposite Wall)</span>
                      <span>270° (Quarter Left)</span>
                      <span>360°</span>
                    </div>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mr-1">Quick Presets:</span>
                      {[
                        { label: '0° Original', val: 0 },
                        { label: '+90° Right', val: 90 },
                        { label: '+180° Opposite Wall', val: 180 },
                        { label: '+270° (-90° Left)', val: 270 },
                      ].map(p => (
                        <button
                          key={p.val}
                          type="button"
                          onClick={() => setPanoShiftDeg(p.val)}
                          className={`px-2.5 py-1 rounded-lg text-[8.5px] font-mono font-bold transition-all border cursor-pointer ${
                            panoShiftDeg === p.val
                              ? 'bg-sky-500 text-white border-sky-400 shadow-md'
                              : 'bg-slate-900/90 text-slate-300 border-white/5 hover:text-white hover:bg-slate-800'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action Row: Apply as Base & Download */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    id="btn-apply-pano-shift"
                    onClick={handleApplyPanoShift}
                    disabled={isShifting || panoShiftDeg === 0}
                    className="py-3 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg hover:shadow-sky-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isShifting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Rotating Equirectangular Canvas...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                        </svg>
                        Apply Re-Centered Seam as Base
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    id="btn-download-shifted-pano"
                    onClick={handleDownloadShiftedPano}
                    disabled={isShifting}
                    className="py-3 px-4 rounded-xl bg-slate-950 border border-sky-500/30 hover:bg-slate-800 text-sky-200 text-[10px] font-black uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-sky-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download Shifted 4K Panorama
                  </button>
                </div>

                {/* Educational Craft Notice */}
                <div className="p-3 bg-slate-950/60 rounded-xl border border-white/5 flex items-start gap-2.5">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-sky-400 shrink-0 mt-0.5">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                  </svg>
                  <p className="text-[10px] leading-relaxed text-slate-300">
                    <strong className="text-white">Why horizontal sliding works best:</strong> Sliding rolls the cylindrical equirectangular texture sideways with <strong>100% pixel fidelity</strong> and zero distortion. This repositions your primary wall directly into the center of the image canvas before virtual staging or Kuula export.
                  </p>
                </div>
              </div>
            ) : (
              /* Standard 360 Camera Frustum & Orientation Controls */
              <div className="space-y-3">
                {/* Quick Angle Presets Bar */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 shrink-0">Angles:</span>
                  <button
                    type="button"
                    onClick={() => applyPresetAngle(0, -5, fov)}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase transition-all shrink-0 border ${
                      yaw === 0 && pitch === -5 ? 'bg-orange-500 text-white border-orange-400 shadow-md' : 'bg-slate-900/80 text-slate-400 border-white/5 hover:bg-slate-800'
                    }`}
                  >
                    Center View
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetAngle(-60, -5, fov)}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase transition-all shrink-0 border ${
                      yaw === -60 ? 'bg-orange-500 text-white border-orange-400 shadow-md' : 'bg-slate-900/80 text-slate-400 border-white/5 hover:bg-slate-800'
                    }`}
                  >
                    Left Angle (-60°)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetAngle(60, -5, fov)}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase transition-all shrink-0 border ${
                      yaw === 60 ? 'bg-orange-500 text-white border-orange-400 shadow-md' : 'bg-slate-900/80 text-slate-400 border-white/5 hover:bg-slate-800'
                    }`}
                  >
                    Right Angle (+60°)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetAngle(180, -5, fov)}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase transition-all shrink-0 border ${
                      Math.abs(yaw) === 180 ? 'bg-orange-500 text-white border-orange-400 shadow-md' : 'bg-slate-900/80 text-slate-400 border-white/5 hover:bg-slate-800'
                    }`}
                  >
                    Rear View (180°)
                  </button>
                </div>

                {/* Camera Orientation & Ultra-Wide Zoom Sliders */}
                <div className="space-y-3 bg-slate-900/60 p-4 rounded-2xl border border-white/5">
                  {/* Ultra-Wide Zoom Slider (Primary Zoom Out / In Controller) */}
                  <div className="p-3.5 bg-slate-950/70 rounded-xl border border-orange-500/20 space-y-2.5 shadow-inner">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-orange-400">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM10.5 7.5v6m3-3h-6" />
                        </svg>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-200">
                          Ultra-Wide Zoom Slider
                        </span>
                        <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          fov === 80 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                          fov >= 135 ? 'bg-orange-500/20 text-orange-400 border-orange-500/40' :
                          fov >= 105 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                          'bg-slate-800 text-slate-400 border-white/5'
                        }`}>
                          {fov === 80 ? '★ Sweet Spot (Optimum)' : fov <= 70 ? 'Tight Telephoto' : fov <= 95 ? 'Normal (90°)' : fov <= 125 ? 'Wide-Angle' : fov <= 145 ? 'Ultra-Wide' : 'Super Ultra-Wide'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setFov(f => Math.max(30, f - 5))}
                          title="Step Zoom In"
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px] font-mono font-bold transition-colors cursor-pointer"
                        >
                          -5°
                        </button>
                        <span className="font-mono text-sm font-black text-orange-400 min-w-[45px] text-right">
                          {fov}°
                        </span>
                        <button
                          type="button"
                          onClick={() => setFov(f => Math.min(160, f + 5))}
                          title="Step Zoom Out"
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px] font-mono font-bold transition-colors cursor-pointer"
                        >
                          +5°
                        </button>
                      </div>
                    </div>

                    {/* The Full Continuous Zoom Slider */}
                    <input
                      type="range"
                      id="slider-ultra-wide-zoom"
                      min="30"
                      max="160"
                      step="1"
                      value={fov}
                      onChange={(e) => setFov(Number(e.target.value))}
                      className="w-full h-2 bg-slate-800 rounded-full appearance-none accent-orange-500 cursor-pointer"
                    />

                    {/* Range Labels and Quick Preset Chips */}
                    <div className="flex items-center justify-between gap-1 pt-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mr-1">Presets:</span>
                        {[
                          { label: '★ 80° Sweet Spot', val: 80, isSweet: true },
                          { label: '60° Close', val: 60 },
                          { label: '90° Normal', val: 90 },
                          { label: '110° Wide', val: 110 },
                          { label: '130° Ultra-Wide', val: 130 },
                          { label: '150° Super-Wide', val: 150 },
                          { label: '160° Max Out', val: 160 },
                        ].map(p => (
                          <button
                            key={p.val}
                            type="button"
                            onClick={() => setFov(p.val)}
                            className={`px-2 py-0.5 rounded-lg text-[8px] font-mono font-bold transition-all border cursor-pointer ${
                              fov === p.val
                                ? p.isSweet
                                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-sm'
                                  : 'bg-orange-500 text-white border-orange-400 shadow-sm'
                                : p.isSweet
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/60'
                                : 'bg-slate-900/90 text-slate-400 border-white/5 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                      <span className="text-[8px] font-mono text-slate-500 shrink-0">
                        Max: 160°
                      </span>
                    </div>

                    {/* Quality Tip */}
                    <div className="pt-1 text-[8px] text-slate-400 flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-emerald-400 shrink-0">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                      </svg>
                      <span>
                        <strong className="text-emerald-300">Optimum Sharpness (75°–85°):</strong> Replicates a 24mm architectural lens, avoiding perspective stretching and keeping 4K furniture details tack-sharp.
                      </span>
                    </div>
                  </div>

                  {/* Aiming Angles (Yaw & Pitch) */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[9px] font-black uppercase text-slate-400">
                        <span>Yaw (Horizontal 360°)</span>
                        <span className="font-mono text-orange-400">{yaw}°</span>
                      </div>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        value={yaw}
                        onChange={(e) => setYaw(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-full appearance-none accent-orange-500 cursor-pointer"
                      />
                      <div className="flex justify-between text-[7.5px] font-mono text-slate-500">
                        <span>-180° (Left)</span>
                        <span>0° (Center)</span>
                        <span>+180° (Right)</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[9px] font-black uppercase text-slate-400">
                        <span>Pitch (Vertical Tilt)</span>
                        <span className="font-mono text-orange-400">{pitch}°</span>
                      </div>
                      <input
                        type="range"
                        min="-85"
                        max="85"
                        value={pitch}
                        onChange={(e) => setPitch(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-full appearance-none accent-orange-500 cursor-pointer"
                      />
                      <div className="flex justify-between text-[7.5px] font-mono text-slate-500">
                        <span>-85° (Floor)</span>
                        <span>0° (Eye Level)</span>
                        <span>+85° (Ceiling)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Staging Parameters & Actions (Right 5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4 bg-slate-900/60 p-5 rounded-3xl border border-white/5">
            <div className="space-y-4">
              {/* Tool Selector */}
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Staging / AI Operation
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PANORAMA_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedTool(p.id)}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                        selectedTool === p.id
                          ? 'bg-orange-500/20 border-orange-500/50 text-white shadow-lg'
                          : 'bg-slate-950/60 border-white/5 text-slate-400 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${selectedTool === p.id ? 'bg-orange-400' : 'bg-slate-600'}`} />
                      <span className="text-[10px] font-bold break-words leading-tight">{p.label}</span>
                      {(p.hasAiWatermark || ['p360_vstaging_3d', 'p360_style_swap', 'p360_auto_declutter'].includes(p.id)) && (
                        <span className="ml-auto shrink-0 px-1 py-0.5 bg-amber-400 text-[6.5px] font-black text-slate-950 rounded uppercase tracking-tight shadow-sm flex items-center gap-0.5 border border-amber-300">
                          <svg className="w-1.5 h-1.5 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg>
                          +AI
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Room & Style Configuration */}
              {(selectedTool === 'p360_vstaging_3d' || selectedTool === 'furniture') && (
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                      Room Type
                    </label>
                    <select
                      value={stagingRoom}
                      onChange={(e) => setStagingRoom(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-orange-500"
                    >
                      {STAGING_ROOMS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                      Furniture Style
                    </label>
                    <select
                      value={stagingStyle}
                      onChange={(e) => setStagingStyle(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-orange-500"
                    >
                      {FURNITURE_STYLES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                      Custom Staging Notes (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Modern boucle sofa, marble coffee table, warm lighting..."
                      value={stageDescriptor}
                      onChange={(e) => setStageDescriptor(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-emerald-400">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400">
                      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                    </svg>
                    <div className="text-[9px] font-bold leading-tight">
                      <span className="uppercase tracking-wider block">Wall & Architecture Lock: Active</span>
                      <span className="block text-[8px] font-normal text-emerald-300/80">Zero added walls, moved walls, or spherical geometry shifts</span>
                    </div>
                  </div>
                </div>
              )}

              {selectedTool === 'p360_style_swap' && (
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                      Target Replacement Style
                    </label>
                    <select
                      value={stagingStyle}
                      onChange={(e) => setStagingStyle(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-orange-500"
                    >
                      {FURNITURE_STYLES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-emerald-400">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400">
                      <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                    </svg>
                    <div className="text-[9px] font-bold leading-tight">
                      <span className="uppercase tracking-wider block">Wall & Architecture Lock: Active</span>
                      <span className="block text-[8px] font-normal text-emerald-300/80">No added walls, moved walls, or altered room geometry</span>
                    </div>
                  </div>
                </div>
              )}

              {selectedTool === 'p360_auto_declutter' && (
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                      Declutter Scope
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDeclutterMode('full_depopulation')}
                        className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                          declutterMode === 'full_depopulation'
                            ? 'bg-orange-500/20 border-orange-500/50 text-white shadow-md'
                            : 'bg-slate-950/60 border-white/5 text-slate-400 hover:bg-slate-800/60'
                        }`}
                      >
                        <span className="text-[10px] font-bold">Full Room Depopulation</span>
                        <span className="text-[8px] text-slate-400 leading-tight">Remove all furniture, rugs, beds & clutter</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeclutterMode('loose_clutter')}
                        className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                          declutterMode === 'loose_clutter'
                            ? 'bg-orange-500/20 border-orange-500/50 text-white shadow-md'
                            : 'bg-slate-950/60 border-white/5 text-slate-400 hover:bg-slate-800/60'
                        }`}
                      >
                        <span className="text-[10px] font-bold">Surgical Clutter Only</span>
                        <span className="text-[8px] text-slate-400 leading-tight">Remove loose items, cords & trash only</span>
                      </button>
                    </div>
                  </div>

                  {/* Mask Inspection & Review */}
                  <div className="p-3 bg-slate-950/80 rounded-2xl border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-300">
                        AI Clutter Mask Inspector
                      </span>
                      {previewOverlayUrl && (
                        <button
                          type="button"
                          onClick={() => setShowMaskOverlay(!showMaskOverlay)}
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border transition-all ${
                            showMaskOverlay
                              ? 'bg-orange-500/30 text-orange-300 border-orange-500/40'
                              : 'bg-slate-800 text-slate-400 border-white/10'
                          }`}
                        >
                          {showMaskOverlay ? 'Hide Overlay' : 'Show Overlay'}
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleInspectClutterMask}
                      disabled={isInspectingMask || !isLoaded}
                      className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center justify-center gap-2 border border-white/10 transition-all disabled:opacity-40"
                    >
                      {isInspectingMask ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                          <span>Detecting & Dilating Mask (+20px)...</span>
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 text-orange-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                          <span>{previewOverlayUrl ? 'Re-Inspect Camera View' : 'Inspect AI Clutter Mask'}</span>
                        </>
                      )}
                    </button>

                    {maskCoverageRatio !== null && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[9px] font-mono">
                          <span className="text-slate-400 font-sans font-bold">Mask Coverage:</span>
                          <span className={`font-bold ${maskCoverageRatio >= 0.008 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {(maskCoverageRatio * 100).toFixed(1)}% of frame
                          </span>
                        </div>
                        {maskCoverageRatio < 0.008 ? (
                          <p className="text-[8px] text-amber-300 leading-tight">
                            Low mask coverage detected. System will automatically engage Full-Perspective Depopulation (Guidance Scale 4.5) to ensure complete furniture removal.
                          </p>
                        ) : (
                          <p className="text-[8px] text-emerald-300 leading-tight">
                            Mask verified & dilated (+20px). Contact shadows, rugs, and edges are fully encapsulated for seamless inpainting.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Native Resolution Matching Badge */}
              <div className="p-3 bg-sky-950/30 border border-sky-500/25 rounded-2xl flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M1 2.75A.75.75 0 011.75 2h16.5a.75.75 0 01.75.75v11.5a.75.75 0 01-.75.75H1.75a.75.75 0 01-.75-.75V2.75zm1.5.75v10h15v-10H2.5zm7.25 13.5a.75.75 0 000 1.5h.5a.75.75 0 000-1.5h-.5z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-[10px] leading-relaxed text-slate-300 flex-1">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="font-bold text-sky-300">Native Resolution Match:</span>
                    <span className="font-mono text-[9px] px-2 py-0.5 bg-sky-500/20 text-sky-200 rounded-md font-bold">
                      {cropDims.width} × {cropDims.height} ({cropDims.width >= 2048 ? '2K Native' : '1.5K'})
                    </span>
                  </div>
                  <p className="text-slate-400 text-[9px]">
                    Targeted view matches your {sourceDims.width}×{sourceDims.height} panorama 1:1, ensuring staged furniture and decor are rendered with crisp, razor-sharp detail.
                  </p>
                </div>
              </div>

              {/* Cost Guarantee Badge */}
              <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-2xl flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-[10px] leading-relaxed text-slate-300">
                  <span className="font-bold text-emerald-400 block">High-Res Kuula Protection:</span>
                  Ceilings, floors, nadir, and unedited walls remain 100% untouched at native resolution (up to 8K). Only the targeted perspective is edited and reprojected.
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={handleExecute1KStaging}
                disabled={isProjecting || !isLoaded}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-black uppercase tracking-widest shadow-xl hover:shadow-orange-600/30 transition-all flex items-center justify-center gap-2.5 disabled:opacity-40"
              >
                {isProjecting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating & Reprojecting 360...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                    </svg>
                    Stage & Reproject to 360
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleSaveOrientationOnly}
                  disabled={isProjecting || !isLoaded}
                  className="py-2.5 px-3 rounded-xl bg-slate-950 border border-white/10 hover:bg-slate-800 text-slate-300 text-[9px] font-black uppercase tracking-wider transition-all truncate"
                  title="Save camera angle so main batch generation uses this view"
                >
                  Save Angle for Batch
                </button>
                <button
                  type="button"
                  onClick={handleExportFlatPhoto}
                  disabled={isProjecting || !isLoaded}
                  className="py-2.5 px-3 rounded-xl bg-slate-950 border border-white/10 hover:bg-slate-800 text-slate-300 text-[9px] font-black uppercase tracking-wider transition-all truncate"
                  title="Export this rectilinear view as a flat 1080p photo"
                >
                  Export Flat Photo
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
