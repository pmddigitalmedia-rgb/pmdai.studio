
import { ImageItem, WeatherPreset } from '../types';
import { WEATHER_PRESETS, PANORAMA_PRESETS, VISUAL_STAGER_PRESETS, FURNITURE_STYLES, STAGING_ROOMS, TOOL_ENGINE_COSTS } from '../constants';
import React, { useState, useMemo } from 'react';
import { useAuth } from './AuthContext';

interface ImageGridItemProps {
  item: ImageItem;
  isGridView: boolean;
  isActive: boolean;
  onToggleSelect: (id: string) => void;
  onRemove: (id: string, e: React.MouseEvent) => void;
  onDuplicate: (id: string, e: React.MouseEvent) => void;
  onRevert: (id: string, e: React.MouseEvent) => void;
  onUndo: (id: string, e: React.MouseEvent) => void;
  onRedo: (id: string, e: React.MouseEvent) => void;
  onDownload: (item: ImageItem, e: React.MouseEvent) => void;
  onOpenRestore: (id: string, e: React.MouseEvent) => void;
  onOpenEraser: (id: string, e: React.MouseEvent) => void;
  onOpenLasso: (id: string) => void;
  onOpenPano?: (id: string, e: React.MouseEvent) => void;
  onToolDrop?: (itemId: string, toolId: string) => void;
  onToggleAutoDuplicate?: (id: string) => void;
  onSharpen?: (id: string, e: React.MouseEvent) => void;
  onExtractFrame?: (id: string, e?: React.MouseEvent) => void;
  onPreAnalyze?: (id: string, e?: React.MouseEvent) => void;
  onApplyPreAnalysisRecommendations?: (id: string) => void;
  onTogglePreAnalysisTool?: (itemId: string, toolId: string) => void;
  isDownloading: boolean;
}

export const ImageGridItem: React.FC<ImageGridItemProps> = ({
  item,
  isGridView,
  isActive,
  onToggleSelect,
  onRemove,
  onDuplicate,
  onRevert,
  onUndo,
  onRedo,
  onDownload,
  onOpenRestore,
  onOpenEraser,
  onOpenLasso,
  onOpenPano,
  onToolDrop,
  onToggleAutoDuplicate,
  onSharpen,
  onExtractFrame,
  onPreAnalyze,
  onApplyPreAnalysisRecommendations,
  onTogglePreAnalysisTool,
  isDownloading
}) => {
  const { isAdmin } = useAuth();
  const [isHovered, setIsHovered] = useState(false);
  const [isDragTarget, setIsDragTarget] = useState(false);
  const [showAnalysisDetails, setShowAnalysisDetails] = useState(false);
  const [isAnalysisVisible, setIsAnalysisVisible] = useState(true);
  const currentAsset = item.currentHistoryIndex >= 0 ? item.history[item.currentHistoryIndex] : null;
  
  // Show original only when hovering AND there is an edited asset to compare against
  const showOriginalOnHover = isHovered && currentAsset;

  const canUndo = item.currentHistoryIndex >= 0;
  const canRedo = item.currentHistoryIndex < item.history.length - 1;

  const assignedPresets = useMemo(() => {
    const raw = item.assignedTools.map(id => [...WEATHER_PRESETS, ...PANORAMA_PRESETS, ...VISUAL_STAGER_PRESETS].find(p => p.id === id)).filter(Boolean) as WeatherPreset[];
    if (!isAdmin) {
      return raw.filter(p => !p.id.includes('video') && !p.id.startsWith('p360_'));
    }
    return raw;
  }, [item.assignedTools, isAdmin]);

  const activeAssetTools = useMemo(() => {
    if (currentAsset && currentAsset.tools) {
      return currentAsset.tools;
    }
    return item.assignedTools;
  }, [currentAsset, item.assignedTools]);

  const displayError = useMemo(() => {
    if (!item.error) return '';
    if (typeof item.error === 'string') return item.error;
    if (item.error instanceof Error) return item.error.message;
    return 'An unexpected error occurred';
  }, [item.error]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragTarget(true);
  };

  const handleDragLeave = () => {
    setIsDragTarget(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragTarget(false);
    const toolId = e.dataTransfer.getData('toolId');
    if (toolId && onToolDrop) {
      onToolDrop(item.id, toolId);
    }
  };

  const hasModifications = item.history.length > 0 || item.assignedTools.length > 0;

  const is360Image = useMemo(() => {
    return Boolean(
      item.is360 ||
      (item.dimensions && Math.abs(item.dimensions.width / item.dimensions.height - 2) < 0.2) ||
      assignedPresets.some(p => p.id.startsWith('p360_'))
    );
  }, [item.is360, item.dimensions, assignedPresets]);

  // Calculate dynamic aspect ratio style to ensure the container perfectly matches the image or video
  const containerStyle = useMemo(() => {
    if (currentAsset?.type === 'video') {
      if (item.config.videoAspectRatio === '9:16') {
        return { aspectRatio: '9 / 16' };
      }
      return { aspectRatio: '16 / 9' };
    }
    if (item.dimensions?.width && item.dimensions?.height) {
      // COORDINATE LOCK: Use exact integer ratio to prevent sub-pixel container rounding
      return { aspectRatio: `${Math.round(item.dimensions.width)} / ${Math.round(item.dimensions.height)}` };
    }
    return { aspectRatio: '3 / 2' };
  }, [item.dimensions, currentAsset?.type, item.config.videoAspectRatio]);

  return (
    <div 
      id={`image-item-${item.id}`}
      className={`group relative flex flex-col rounded-[1.5rem] overflow-hidden bg-slate-900 border transition-all duration-300 
      ${item.selected ? 'ring-2 ring-orange-500 border-orange-500 shadow-2xl shadow-orange-500/10' : 'border-white/5'}
      ${isActive ? 'bg-orange-500/10 shadow-[0_0_20px_rgba(249,115,22,0.15)] ring-1 ring-orange-500/50' : ''}
      ${isDragTarget ? 'ring-4 ring-orange-400 scale-[1.02] z-50' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Aspect-Locked Container */}
      <div 
        className="relative bg-slate-950 overflow-hidden cursor-pointer w-full" 
        style={containerStyle}
        onClick={() => onToggleSelect(item.id)}
      >
        <div className="w-full h-full relative">
          {/* 
              PIXEL-PERFECT OVERLAY STRATEGY:
              By using 'object-fill' on two images that have been forced to the same 
              pixel dimensions via canvas post-processing, they will overlay exactly 
              without any zooming or composition shifts.
          */}
          {showOriginalOnHover && (
            <img 
              src={item.previewUrl} 
              className="w-full h-full object-fill absolute inset-0 z-20 transition-opacity duration-300 opacity-100" 
              alt="Original" 
            />
          )}

          {currentAsset?.type === 'video' ? (
            <video 
              src={currentAsset.url} 
              className="w-full h-full object-contain bg-slate-950 absolute inset-0 z-10" 
              autoPlay 
              muted 
              loop 
              playsInline 
            />
          ) : (
            <img 
              src={currentAsset?.url || item.previewUrl} 
              className="w-full h-full object-fill absolute inset-0 z-10 transition-opacity duration-300 opacity-100" 
              alt={item.file.name} 
            />
          )}

          {/* AI Enhanced Badge */}
          {item.history.length > 0 && (
            <div className="absolute bottom-2 left-2 z-20 bg-black/40 backdrop-blur-sm px-2 py-1 rounded flex items-center gap-1.5 opacity-75">
              <div className="flex items-center gap-1 opacity-50">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
                  <path d="M12 2.25a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM12 18.75a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5a.75.75 0 01.75-.75zM18.75 12a.75.75 0 01.75.75h1.5a.75.75 0 010-1.5h-1.5A.75.75 0 0118.75 12zM3 12a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5H3.75A.75.75 0 013 12zM16.95 5.25a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zM5.55 18.75a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zM16.95 18.75a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75zM5.55 5.25a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5a.75.75 0 01-.75-.75z" />
                </svg>
                <span className="text-[8px] font-bold text-white uppercase tracking-wider">AI Enhanced</span>
              </div>
              {activeAssetTools.some(id => ['furniture', 'p360_vstaging_3d', 'style_swapper', 'p360_style_swap'].includes(id)) && (
                <>
                  <span className="text-[8px] text-white/30">•</span>
                  <span className="text-[8px] font-bold text-white opacity-50 uppercase tracking-wider">AI Virtually Staged</span>
                </>
              )}
              {activeAssetTools.some(id => ['auto_declutter', 'p360_auto_declutter'].includes(id)) && (
                <>
                  <span className="text-[8px] text-white/30">•</span>
                  <span className="text-[8px] font-bold text-white opacity-50 uppercase tracking-wider">Digitally Decluttered</span>
                </>
              )}
            </div>
          )}
          
          {showOriginalOnHover && !assignedPresets.length && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 text-[9px] font-black uppercase tracking-widest text-white shadow-2xl pointer-events-none z-30 animate-fade-in-up">
                  Viewing Original
              </div>
          )}

          {/* Configuration Overlay: Admin sees Engine Cost Breakdown in cents (¢); Client sees Credit Count Breakdown */}
          {isHovered && assignedPresets.length > 0 && (
            <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md p-4 flex flex-col animate-fade-in-up pointer-events-none">
              {/* Header: Engine Cost in cents for Admin, Credit Count for Client */}
              <div className="flex items-center justify-between gap-2 mb-2.5 border-b border-white/10 pb-2">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${isAdmin ? 'bg-emerald-400' : 'bg-cyan-400'}`} />
                  <span className="text-[10px] font-black text-white uppercase tracking-wider">
                    {isAdmin ? 'Engine Cost Breakdown' : 'Credit Count'}
                  </span>
                </div>
                <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
                  isAdmin 
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                    : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
                }`}>
                  {assignedPresets.length} {assignedPresets.length === 1 ? 'Tool' : 'Tools'}
                </span>
              </div>
              
              <div className="space-y-2.5 overflow-y-auto scrollbar-hide flex-1">
                {/* Summary Card: Total Cents for Admin or Total Credits for Client */}
                {(() => {
                  if (isAdmin) {
                    const totalCostCents = assignedPresets.reduce((sum, p) => {
                      const info = TOOL_ENGINE_COSTS[p.id];
                      return sum + (info ? (info.cost * 100) : 4.5);
                    }, 0);

                    return (
                      <div className="p-2.5 rounded-xl bg-slate-900/90 border border-emerald-500/30 space-y-1.5 shadow-lg">
                        <div className="flex justify-between items-center text-[9px]">
                          <span className="text-slate-300 font-bold uppercase tracking-wide flex items-center gap-1">
                            <span className="text-emerald-400">⚡</span> Current Engine Cost:
                          </span>
                          <span className="text-emerald-400 font-mono font-extrabold text-[12px]">
                            {totalCostCents.toFixed(1)}¢
                          </span>
                        </div>
                        <div className="text-[8px] text-slate-400 leading-tight">
                          Real-world billing rate based on currently active models and resolution pipelines.
                        </div>
                      </div>
                    );
                  } else {
                    // Client Side Credit Calculation
                    const isPanoOrVideo = item.is360 || assignedPresets.some(p => p.id.includes('video') || p.id.startsWith('p360_'));
                    const totalCredits = isPanoOrVideo ? 90 : Math.max(30, assignedPresets.length * 30);

                    return (
                      <div className="p-2.5 rounded-xl bg-slate-900/90 border border-cyan-500/30 space-y-1.5 shadow-lg">
                        <div className="flex justify-between items-center text-[9px]">
                          <span className="text-slate-200 font-bold uppercase tracking-wide flex items-center gap-1">
                            <span className="text-cyan-400">💎</span> Total Credits Required:
                          </span>
                          <span className="text-cyan-400 font-mono font-extrabold text-[12px]">
                            {totalCredits} Credits
                          </span>
                        </div>
                        <div className="text-[8px] text-slate-400 leading-tight">
                          Total credits consumed to render this high-resolution photo edit.
                        </div>
                      </div>
                    );
                  }
                })()}

                {/* Per-Tool Rows */}
                <div className="space-y-1.5 pt-0.5">
                  {assignedPresets.map((preset) => {
                    const engineInfo = TOOL_ENGINE_COSTS[preset.id] || {
                      engine: 'FLUX.1 Pro Kontext',
                      cost: 0.045,
                      costString: '$0.045',
                      centsString: '4.5¢',
                      credits: (preset.id.includes('video') || preset.id.startsWith('p360_')) ? 90 : 30,
                      category: 'image-diffusion'
                    };

                    const toolCredits = (preset.id.includes('video') || preset.id.startsWith('p360_') || item.is360) ? 90 : (engineInfo.credits || 30);

                    return (
                      <div key={preset.id} className="p-2 rounded-lg bg-slate-900/70 border border-white/5 space-y-1">
                        {/* Tool label and Credit / Cost badge */}
                        <div className="flex justify-between items-center gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${preset.color.replace('text-', 'border-')}`}>
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-2.5 h-2.5 ${preset.color.split(' ')[1]}`}><path strokeLinecap="round" strokeLinejoin="round" d={preset.icon} /></svg>
                            </div>
                            <span className="text-[9.5px] font-bold text-slate-200 uppercase truncate">{preset.label}</span>
                          </div>
                          <div className="text-right shrink-0">
                            {isAdmin ? (
                              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/40">
                                {engineInfo.centsString || `${(engineInfo.cost * 100).toFixed(1)}¢`}
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40 shadow-sm">
                                {toolCredits} Credits
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Admin-only Engine Name and Routing Pipeline */}
                        {isAdmin && (
                          <div className="flex items-center justify-between text-[8px] pl-5 text-slate-400">
                            <span className="font-medium text-slate-300 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                              {engineInfo.engine}
                            </span>
                            {engineInfo.pipeline && (
                              <span className="text-slate-500 font-mono text-[7px] truncate max-w-[140px]">
                                {engineInfo.pipeline}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className={`absolute top-3 left-3 z-30 pointer-events-none ${item.selected ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-100'} transition-all`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shadow-md border-2 ${item.selected ? 'bg-orange-500 border-white text-white' : 'bg-slate-900/80 border-slate-600 text-slate-400'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 01.143z" clipRule="evenodd" /></svg>
              </div>
          </div>

          {currentAsset?.type === 'video' && (
            <div className="absolute top-3 left-11 z-30 pointer-events-none flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-white/20 text-orange-400 shadow-xl">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-orange-400">
                <path d="M3.25 4A2.25 2.25 0 0 0 1 6.25v7.5A2.25 2.25 0 0 0 3.25 16h7.5A2.25 2.25 0 0 0 13 13.75v-7.5A2.25 2.25 0 0 0 10.75 4h-7.5ZM19 4.75a.75.75 0 0 0-1.28-.53l-3 3a.75.75 0 0 0-.22.53v4.5c0 .199.079.39.22.53l3 3a.75.75 0 0 0 1.28-.53V4.75Z" />
              </svg>
              <span className="text-[7.5px] font-black uppercase tracking-widest text-white">Video</span>
            </div>
          )}

          <div className="absolute top-3 right-3 z-[60] flex flex-col items-end gap-1.5 ">
             {item.preAnalysis && (
                <div 
                  title={`AI Scene: ${item.preAnalysis.roomType} (${item.preAnalysis.occupancy})`}
                  className="flex items-center gap-1.5 px-2 py-1 bg-black/85 text-white backdrop-blur-md rounded-lg border border-orange-500/40 shadow-lg pointer-events-auto"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[7.5px] font-black uppercase tracking-widest text-orange-400">
                    {item.preAnalysis.roomType}
                  </span>
                </div>
             )}
             {is360Image && (
                <button
                  type="button"
                  id={`badge-pano-${item.id}`}
                  onClick={(e) => { e.stopPropagation(); onOpenPano?.(item.id, e); }}
                  title="Open 360 Camera Viewport: Aim camera, adjust Yaw/Pitch/FOV, or run virtual staging"
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-black/80 hover:bg-orange-600 text-white backdrop-blur-md rounded-lg border border-white/20 hover:border-orange-400/80 shadow-lg cursor-pointer transition-all group/pano pointer-events-auto"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 text-orange-400 group-hover/pano:text-white transition-colors"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7V5m0 14v-2M5 12H3m18 0h-2m-1.364-4.636-1.414-1.414M7.778 16.222l-1.414 1.414m0-11.414 1.414 1.414m8.486 8.486 1.414 1.414" /></svg>
                    <span className="text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                      360 View / Aim
                      {item.config.panoYaw !== undefined && (
                        <span className="text-[7.5px] font-mono text-orange-300 group-hover/pano:text-white font-bold">({item.config.panoYaw}°)</span>
                      )}
                    </span>
                </button>
             )}
          </div>
          
            <div className="absolute bottom-3 left-3 z-[60] flex flex-wrap gap-2 max-w-[90%] pointer-events-none">
              {assignedPresets.map(p => {
                // Determine high contrast classes based on the preset definition
                const colorClasses = p.color.split(' ');
                const textClass = colorClasses.find(c => c.startsWith('text-')) || 'text-white';
                
                // Extract base color (amber, blue, etc) for consistent high intensity
                const baseColorMatch = textClass.match(/text-([a-z]+)-/);
                const baseColor = baseColorMatch ? baseColorMatch[1] : 'orange';
                
                return (
                  <div 
                    key={p.id} 
                    className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 shadow-2xl backdrop-blur-xl transition-all scale-100 hover:scale-110 active:scale-95 border-${baseColor}-500/50 bg-${baseColor}-600/90`}
                  >
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6 text-white">
                       <path strokeLinecap="round" strokeLinejoin="round" d={p.icon} />
                     </svg>
                  </div>
                );
              })}
            </div>

          {item.isAnalyzing && (
              <div className="absolute inset-0 z-40 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center pointer-events-none">
                  <div className="relative w-10 h-10 flex items-center justify-center mb-2">
                      <div className="absolute inset-0 rounded-full border-2 border-orange-500/30 animate-ping" />
                      <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest animate-pulse">Gemini Vision Scanning...</span>
                  <span className="text-[8px] text-slate-400 mt-1">Analyzing room structure, clutter & lighting</span>
              </div>
          )}

          {item.status === 'processing' && (
              <div className="absolute inset-0 z-40 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                  <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
          )}
          
          {displayError && (
              <div className="absolute inset-0 z-40 bg-red-950/80 backdrop-blur-sm flex items-center justify-center p-4 text-center overflow-auto pointer-events-none">
                  <span className="text-[10px] font-bold text-red-200 uppercase tracking-wider">{displayError}</span>
              </div>
          )}
        </div>
      </div>
      
      <div className={`p-4 flex flex-col gap-3 transition-colors ${item.selected ? 'bg-orange-500/5' : 'bg-slate-800'} ${isActive ? 'bg-orange-500/10' : ''}`}>
          <div className="flex flex-col min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[10px] font-bold truncate flex-grow mr-2 transition-colors ${isActive ? 'text-orange-400' : 'text-slate-300'}`}>{item.file.name}</span>
                {item.history.length > 0 && (
                  <div className="flex gap-1">
                    <button onClick={(e) => onUndo(item.id, e)} disabled={!canUndo} title="Undo" className={`p-1 rounded transition-colors ${canUndo ? 'text-orange-500 hover:bg-orange-500/20' : 'text-slate-600 opacity-30 cursor-not-allowed'}`}><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg></button>
                    <button onClick={(e) => onRedo(item.id, e)} disabled={!canRedo} title="Redo" className={`p-1 rounded transition-colors ${canRedo ? 'text-orange-500 hover:bg-orange-500/20' : 'text-slate-600 opacity-30 cursor-not-allowed'}`}><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" /></svg></button>
                  </div>
                )}
              </div>
          </div>

          {/* AI-Powered Pre-Analysis Card (with complete toggle on/off visibility) */}
          {item.preAnalysis && (
            <div className="bg-slate-900/95 border border-orange-500/30 rounded-xl p-2.5 space-y-2 text-xs shadow-inner">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/>
                  </svg>
                  <span className="text-[9px] font-black uppercase tracking-wider text-orange-400">
                    Gemini Vision Analysis
                  </span>
                  {!isAnalysisVisible && (
                    <span className="px-1.5 py-0.2 rounded bg-orange-500/10 text-[7.5px] font-bold text-orange-400 border border-orange-500/20">
                      Hidden
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {isAnalysisVisible && (
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setShowAnalysisDetails(!showAnalysisDetails); }}
                      className="text-[8px] font-bold text-slate-400 hover:text-white uppercase tracking-wider px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors"
                      title={showAnalysisDetails ? 'Hide Detailed Features' : 'Show Detailed Features'}
                    >
                      {showAnalysisDetails ? 'Less ▲' : 'More ▼'}
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setIsAnalysisVisible(!isAnalysisVisible); }}
                    className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1 ${
                      isAnalysisVisible 
                        ? 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-white/10' 
                        : 'bg-orange-500 text-white hover:bg-orange-400 shadow-sm'
                    }`}
                    title={isAnalysisVisible ? 'Collapse analysis to reduce clutter' : 'Expand full analysis view'}
                  >
                    <span>{isAnalysisVisible ? 'Hide ✕' : 'Show Analysis 👁'}</span>
                  </button>
                </div>
              </div>

              {isAnalysisVisible && (
                <>
                  {/* Attributes badges */}
                  <div className="flex flex-wrap gap-1">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[8px] font-bold text-slate-300 border border-white/5">
                      🏷️ {item.preAnalysis.roomType}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[8px] font-bold text-slate-300 border border-white/5">
                      💡 {item.preAnalysis.lightingCondition}
                    </span>
                    {item.preAnalysis.flooringType && (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[8px] font-bold text-slate-300 border border-white/5">
                        🪵 {item.preAnalysis.flooringType}
                      </span>
                    )}
                    {typeof item.preAnalysis.skyPercentage === 'number' && (
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold border ${
                        item.preAnalysis.skyPercentage >= 10 
                          ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' 
                          : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                      }`} title={item.preAnalysis.skyPercentage >= 10 ? 'Sky coverage >= 10%: Outdoor Sunny Skies active' : 'Sky coverage < 10%: Low or interior sky coverage'}>
                        ☀️ {item.preAnalysis.skyPercentage.toFixed(0)}% Sky {item.preAnalysis.skyPercentage >= 10 ? '(Outdoor Sunny Skies)' : '(Interior/Low Sky)'}
                      </span>
                    )}
                    {item.preAnalysis.clutterLevel !== 'none' && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-[8px] font-bold text-amber-400 border border-amber-500/20">
                        ⚠️ {item.preAnalysis.clutterLevel.toUpperCase()} Clutter
                      </span>
                    )}
                  </div>

                  {/* Summary text */}
                  <p className="text-[8.5px] text-slate-300 leading-snug">
                    {item.preAnalysis.summary}
                  </p>

                  {/* Expandable details */}
                  {showAnalysisDetails && (
                    <div className="space-y-1.5 pt-1.5 border-t border-white/5 text-[8px]">
                      {item.preAnalysis.clutterItems && item.preAnalysis.clutterItems.length > 0 && (
                        <div>
                          <span className="text-slate-500 font-bold uppercase">Detected Clutter: </span>
                          <span className="text-amber-300">{item.preAnalysis.clutterItems.join(', ')}</span>
                        </div>
                      )}
                      {item.preAnalysis.detectedFeatures && item.preAnalysis.detectedFeatures.length > 0 && (
                        <div>
                          <span className="text-slate-500 font-bold uppercase">Architectural Features: </span>
                          <span className="text-slate-300">{item.preAnalysis.detectedFeatures.join(', ')}</span>
                        </div>
                      )}
                      {item.preAnalysis.suggestedStagingStyle && (
                        <div>
                          <span className="text-slate-500 font-bold uppercase">Suggested Staging: </span>
                          <span className="text-orange-300">{item.preAnalysis.suggestedStagingStyle} style for {item.preAnalysis.suggestedStagingRoom || 'room'}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recommendations & One-click Apply */}
                  <div className="pt-1.5 border-t border-white/5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                        Recommended Edits:
                      </span>
                      {onApplyPreAnalysisRecommendations && item.preAnalysis.recommendedTools?.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onApplyPreAnalysisRecommendations(item.id); }}
                          className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-orange-500 text-white hover:bg-orange-400 transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                        >
                          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                          Apply All
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {item.preAnalysis.recommendedTools
                        ?.filter(toolId => {
                          if (!isAdmin && (toolId.includes('video') || toolId.startsWith('p360_'))) return false;
                          return true;
                        })
                        .map(toolId => {
                        const preset = [...WEATHER_PRESETS, ...PANORAMA_PRESETS, ...VISUAL_STAGER_PRESETS].find(p => p.id === toolId);
                        const isAssigned = item.assignedTools.includes(toolId);
                        return (
                          <button
                            key={toolId}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onTogglePreAnalysisTool ? onTogglePreAnalysisTool(item.id, toolId) : onToolDrop && onToolDrop(item.id, toolId); }}
                            className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all flex items-center gap-1 border cursor-pointer ${
                              isAssigned 
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm' 
                                : 'bg-slate-800 text-slate-400 border-white/10 hover:border-orange-500/50 hover:text-orange-300'
                            }`}
                          >
                            <span>{isAssigned ? '✓' : '+'}</span>
                            <span>{preset?.label || toolId}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              {/* Option 2: Pre-Analyze action button */}
              <button
                type="button"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (item.preAnalysis) {
                    setIsAnalysisVisible(prev => !prev);
                  } else {
                    onPreAnalyze && onPreAnalyze(item.id, e); 
                  }
                }}
                disabled={item.isAnalyzing || item.status === 'processing'}
                title={item.preAnalysis ? (isAnalysisVisible ? "Hide Gemini Vision Analysis Panel" : "Show Gemini Vision Analysis Panel") : "AI-Powered Pre-Analysis (Gemini Vision)"}
                className={`px-2.5 py-2 border rounded-lg transition-all shrink-0 flex items-center gap-1.5 shadow-sm cursor-pointer ${
                  item.preAnalysis 
                    ? (isAnalysisVisible 
                        ? 'bg-orange-500/20 border-orange-500/50 text-orange-400 hover:bg-orange-500 hover:text-white' 
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-orange-500/50 hover:text-orange-400') 
                    : 'bg-slate-800 border-slate-700 text-orange-400 hover:bg-orange-500/20'
                }`}
              >
                {item.isAnalyzing ? (
                  <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                  </svg>
                )}
                <span className="text-[9px] font-black uppercase tracking-wider whitespace-nowrap">
                  {item.isAnalyzing ? 'Scanning...' : item.preAnalysis ? (isAnalysisVisible ? 'Analysis On' : 'Analysis Off') : 'Pre-Analyze'}
                </span>
              </button>

              {/* Quick Re-scan button if already analyzed */}
              {item.preAnalysis && !item.isAnalyzing && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onPreAnalyze && onPreAnalyze(item.id, e); }}
                  title="Re-scan image with Gemini Vision"
                  className="p-2 border rounded-lg bg-slate-800 border-slate-700 text-slate-400 hover:text-orange-400 hover:border-orange-500/40 transition-all shrink-0 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </button>
              )}

              {isAdmin && currentAsset?.type === 'video' && onExtractFrame && (
                <button 
                  type="button"
                  onClick={(e) => onExtractFrame(item.id, e)} 
                  title="Extract Video Still Image to Studio Photos (enables virtual staging & atmospheric editing)" 
                  className="px-2.5 py-2 border rounded-lg bg-orange-500/15 border-orange-500/40 text-orange-400 hover:bg-orange-500 hover:text-white transition-all shrink-0 flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                  </svg>
                  <span className="text-[9px] font-black uppercase tracking-wider whitespace-nowrap">Photo Frame</span>
                </button>
              )}

              {isAdmin && is360Image && onOpenPano && (
                <button 
                  type="button"
                  id={`btn-pano-aim-${item.id}`}
                  onClick={(e) => { e.stopPropagation(); onOpenPano(item.id, e); }} 
                  title="360 Camera View & Staging: Reposition Yaw, Pitch & Zoom" 
                  className="px-2.5 py-2 border rounded-lg bg-orange-500/15 border-orange-500/40 text-orange-400 hover:bg-orange-500 hover:text-white transition-all shrink-0 flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7V5m0 14v-2M5 12H3m18 0h-2" />
                  </svg>
                  <span className="text-[9px] font-black uppercase tracking-wider whitespace-nowrap">Aim 360</span>
                </button>
              )}

              {isAdmin && (
                <button onClick={(e) => onOpenRestore(item.id, e)} title="Surgical Restore" className="p-2 border rounded-lg bg-slate-800 border-slate-700 text-emerald-500 hover:bg-emerald-500/20 transition-all shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1-1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
                  </svg>
                </button>
              )}
              
              <button onClick={(e) => onOpenEraser(item.id, e)} title="Magic Eraser" className="p-2 border rounded-lg bg-slate-800 border-slate-700 text-red-500 hover:bg-red-500/20 transition-all shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </button>

              {isAdmin && (
                <button onClick={(e) => { e.stopPropagation(); onOpenLasso(item.id); }} title="Lasso Selection" className={`p-2 border rounded-lg bg-slate-800 border-slate-700 transition-all shrink-0 ${item.config.lassoMask ? 'text-orange-500 bg-orange-500/10 border-orange-500/50' : 'text-slate-400 hover:bg-orange-500/10'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                </button>
              )}

              <button onClick={(e) => onDuplicate(item.id, e)} title="Duplicate Item" className="p-2 border rounded-lg bg-slate-800 border-slate-700 text-slate-400 hover:bg-orange-500/20 hover:text-orange-500 transition-all shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 8.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v8.25A2.25 2.25 0 0 0 6 16.5h2.25m8.25-8.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-7.5A2.25 2.25 0 0 1 8.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 0 0-2.25 2.25v6" />
                </svg>
              </button>

              {hasModifications && (
                  <button onClick={(e) => onRevert(item.id, e)} title="Reset to Original" className="px-3 py-1.5 bg-slate-700/50 border border-slate-600 text-slate-300 rounded-lg text-[9px] font-black uppercase hover:bg-red-600 hover:text-white transition-colors shrink-0">Reset</button>
              )}

              <button onClick={(e) => onDownload(item, e)} disabled={isDownloading || item.status === 'processing'} className="flex-grow py-1.5 bg-white text-slate-900 rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-1 hover:bg-orange-50 transition-colors whitespace-nowrap min-w-[70px]">
                  {isDownloading ? <div className="w-3 h-3 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div> : (currentAsset?.type === 'video' ? 'Reel' : (item.is360 ? '360 Export' : 'HD Export'))}
              </button>
              
              <button title="Delete Item" onClick={(e) => onRemove(item.id, e)} className="p-2 border rounded-lg bg-slate-800 border-slate-700 text-red-500/80 hover:bg-red-900/20 hover:text-red-400 transition-colors shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
              </button>
          </div>
      </div>
    </div>
  );
};
