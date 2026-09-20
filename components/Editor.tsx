
import React, { useState, useRef } from 'react';
import { PropertyData, ImageItem, SocialAssets } from '../types';
import { assetStore } from '../utils/persistence';
import { resizeAndProcessImage, getImageDimensions } from '../services/imageUtils';
import { cleanEmbedUrl, isKuulaUrl } from '../utils/embedUtils';

interface EditorProps {
  property: PropertyData | null;
  onSave: (prop: PropertyData) => void;
  onCancel: () => void;
  studioItems: ImageItem[];
  socialAssets: SocialAssets;
  setSocialAssets: React.Dispatch<React.SetStateAction<SocialAssets>>;
}

export const Editor: React.FC<EditorProps> = ({ 
  property, 
  onSave, 
  onCancel, 
  studioItems, 
  socialAssets,
  setSocialAssets
}) => {
  const [formData, setFormData] = useState<PropertyData>(() => ({
    id: property?.id || Math.random().toString(36).substring(7),
    unit: property?.unit || '',
    address: property?.address || '',
    city: property?.city || '',
    price: property?.price || '',
    bed: property?.bed || '',
    bath: property?.bath || '',
    sqft: property?.sqft || '',
    email: property?.email || '',
    phoneNumber: property?.phoneNumber || '',
    website: property?.website || '',
    threeDFloorPlan: property?.threeDFloorPlan || '',
    matterportUrl: property?.matterportUrl || '',
    videoUrl: property?.videoUrl || '',
    drone: property?.drone || '',
    agentName: property?.agentName || '',
    brokerage: property?.brokerage || '',
    headshot: property?.headshot || socialAssets.headshot || undefined,
    logo: property?.logo || socialAssets.logo || undefined,
    
    // Second Realtor fields
    agent2Name: property?.agent2Name || socialAssets.agent2Name || '',
    agent2Brokerage: property?.agent2Brokerage || socialAssets.agent2Brokerage || '',
    agent2PhoneNumber: property?.agent2PhoneNumber || socialAssets.agent2PhoneNumber || '',
    agent2Email: property?.agent2Email || socialAssets.agent2Email || '',
    agent2Headshot: property?.agent2Headshot || socialAssets.headshot2 || undefined,
    agent2Logo: property?.agent2Logo || socialAssets.logo2 || undefined,

    floorPlan: property?.floorPlan || undefined,
    floorPlanHotspots: property?.floorPlanHotspots || [],
    galleryImages: property?.galleryImages || [],
    showMap: property?.showMap ?? true,
  }));

  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
  const [editorTab, setEditorTab] = useState<'details' | 'hotspots'>('details');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [draggingPinId, setDraggingPinId] = useState<string | null>(null);
  const [preview3DModalUrl, setPreview3DModalUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const wasDraggingRef = useRef(false);

  const handlePointerDownPin = (spotId: string, e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setActiveHotspotId(spotId);
    setDraggingPinId(spotId);
    wasDraggingRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMovePin = (spotId: string, e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPinId !== spotId || !canvasRef.current) return;
    wasDraggingRef.current = true;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.min(98, Math.max(2, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    const y = Math.min(98, Math.max(2, Math.round(((e.clientY - rect.top) / rect.height) * 100)));

    setFormData(prev => ({
      ...prev,
      floorPlanHotspots: prev.floorPlanHotspots?.map(s => 
        s.id === spotId ? { ...s, x, y } : s
      )
    }));
  };

  const handlePointerUpPin = (spotId: string, e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPinId === spotId) {
      setDraggingPinId(null);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string>('');
  const [dragOverField, setDragOverField] = useState<string | null>(null);
  const [dragOverHotspotId, setDragOverHotspotId] = useState<string | null>(null);

  const handleHotspotFileUpload = async (files: FileList | File[], hotspotId: string) => {
    if (!files || files.length === 0) return;
    setIsImporting(true);
    try {
      const rawUrl = await processFile(files[0]);
      // Hotspots/360 photos must skip resizing to preserve 100% full original resolution and sharpness
      const optimizedUrl = await optimizeForWeb(rawUrl, true);
      
      setFormData(prev => {
        const updatedHotspots = (prev.floorPlanHotspots || []).map(spot => {
          if (spot.id === hotspotId) {
            return {
              ...spot,
              targetImageIndex: undefined,
              targetImageUrl: optimizedUrl,
              is360: true
            };
          }
          return spot;
        });
        return {
          ...prev,
          floorPlanHotspots: updatedHotspots
        };
      });
    } catch (err) {
      console.error("Hotspot image upload failed:", err);
    } finally {
      setIsImporting(false);
    }
  };

  const handleHotspotDragOver = (e: React.DragEvent, hotspotId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverHotspotId(hotspotId);
  };

  const handleHotspotDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverHotspotId(null);
  };

  const handleHotspotDrop = (e: React.DragEvent, hotspotId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverHotspotId(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleHotspotFileUpload(e.dataTransfer.files, hotspotId);
    }
  };

  /**
   * Optimized Image Processor for Web
   * Preserves full native size for 360° panoramas.
   * Scales gallery photos safely up to 1920px (Web standard) to avoid browser canvas memory crashes.
   */
  const optimizeForWeb = async (sourceUrl: string, skipResize = false): Promise<string> => {
    if (!sourceUrl) return sourceUrl;
    try {
      const dims = await getImageDimensions(sourceUrl);
      const is360Panorama = (dims.width / dims.height >= 1.65) || dims.width >= 2400 || sourceUrl.toLowerCase().includes('360') || sourceUrl.toLowerCase().includes('pano');
      const shouldSkipResize = skipResize || is360Panorama;

      if (shouldSkipResize) {
        return sourceUrl;
      }

      // Web Gallery standard resolution: max 1920px on the longest side
      let targetWidth = 1920;
      let targetHeight = 1920;
      if (dims.width > dims.height) {
        targetWidth = Math.min(dims.width, 1920);
        targetHeight = Math.round((dims.height / dims.width) * targetWidth);
      } else {
        targetHeight = Math.min(dims.height, 1920);
        targetWidth = Math.round((dims.width / dims.height) * targetHeight);
      }

      // If the image is already smaller than or equal to 1920, don't recompress
      if (dims.width <= 1920 && dims.height <= 1920) {
        return sourceUrl;
      }

      const optimizedBlob = await resizeAndProcessImage(
        sourceUrl,
        targetWidth,
        targetHeight,
        'image/jpeg',
        false, // No watermark
        true,
        72, // Web DPI
        0.85
      );

      return URL.createObjectURL(optimizedBlob);
    } catch (err) {
      console.warn("optimizeForWeb fallback to sourceUrl:", err);
      return sourceUrl;
    }
  };

  const processFile = async (file: File) => {
    const reader = new FileReader();
    return new Promise<string>((resolve, reject) => {
      reader.onload = (ev) => resolve(ev.target?.result as string);
      reader.onerror = () => reject(new Error("File read error"));
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (files: FileList | File[], field: string, isGallery = false) => {
    if (!files || files.length === 0) return;

    if (isGallery) {
      setIsImporting(true);
      const fileArr = Array.from(files);
      setImportProgress(`0 / ${fileArr.length}`);
      try {
        const optimizedUrls: string[] = [];
        for (let idx = 0; idx < fileArr.length; idx++) {
          setImportProgress(`${idx + 1} / ${fileArr.length}`);
          const file = fileArr[idx];
          try {
            const rawUrl = await processFile(file);
            const isHero = formData.galleryImages.length === 0 && idx === 0;
            const optimizedUrl = await optimizeForWeb(rawUrl, isHero);
            optimizedUrls.push(optimizedUrl || rawUrl);
          } catch (e) {
            console.warn(`File import failed for file index ${idx}`, e);
          }
        }
        if (optimizedUrls.length > 0) {
          setFormData(prev => ({ ...prev, galleryImages: [...prev.galleryImages, ...optimizedUrls] }));
        }
      } catch (e) {
        console.error("Local file optimization failed", e);
      } finally {
        setIsImporting(false);
        setImportProgress('');
      }
    } else {
      try {
        const url = await processFile(files[0]);
        setFormData(prev => ({ ...prev, [field]: url }));
        
        // Also update globally if it's headshot or logo
        if (field === 'headshot' || field === 'logo') {
          setSocialAssets(prev => ({ ...prev, [field]: url }));
        } else if (field === 'agent2Headshot') {
          setSocialAssets(prev => ({ ...prev, headshot2: url }));
        } else if (field === 'agent2Logo') {
          setSocialAssets(prev => ({ ...prev, logo2: url }));
        }
      } catch (e) {
        console.error("Asset upload failed", e);
      }
    }
  };

  const importFromStudio = async () => {
    const selectedFromStudio = studioItems.filter(i => i.selected);
    if (selectedFromStudio.length === 0) {
      alert("No images are currently selected in the Studio tab.");
      return;
    }
    
    setIsImporting(true);
    setImportProgress(`0 / ${selectedFromStudio.length}`);
    try {
      const processedUrls: string[] = [];
      for (let idx = 0; idx < selectedFromStudio.length; idx++) {
        const item = selectedFromStudio[idx];
        setImportProgress(`${idx + 1} / ${selectedFromStudio.length}`);
        
        const currentAsset = item.currentHistoryIndex >= 0 ? item.history[item.currentHistoryIndex] : null;
        const sourceUrl = currentAsset?.url || item.previewUrl;
        
        // Skip processing for videos
        if (currentAsset?.type === 'video') {
          processedUrls.push(sourceUrl);
          continue;
        }

        try {
          const isHero = formData.galleryImages.length === 0 && idx === 0;
          const optimizedUrl = await optimizeForWeb(sourceUrl, isHero);
          processedUrls.push(optimizedUrl || sourceUrl);
        } catch (itemErr) {
          console.warn("Studio image item optimization failed, using original:", itemErr);
          processedUrls.push(sourceUrl);
        }
      }

      if (processedUrls.length > 0) {
        setFormData(prev => ({
          ...prev,
          galleryImages: [...prev.galleryImages, ...processedUrls]
        }));
      }
    } catch (e) {
      console.error("Studio import processing failed", e);
      alert("Failed to process images for web optimization.");
    } finally {
      setIsImporting(false);
      setImportProgress('');
    }
  };

  const handleDragOver = (e: React.DragEvent, field: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverField(field);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverField(null);
  };

  const handleDrop = (e: React.DragEvent, field: string, isGallery = false) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverField(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files, field, isGallery);
    }
  };

  const handleFinalSave = async () => {
    setIsSaving(true);
    try {
        const normalizedFormData: PropertyData = {
          ...formData,
          threeDFloorPlan: cleanEmbedUrl(formData.threeDFloorPlan) || formData.threeDFloorPlan || '',
          matterportUrl: cleanEmbedUrl(formData.matterportUrl) || formData.matterportUrl || '',
          videoUrl: cleanEmbedUrl(formData.videoUrl) || formData.videoUrl || '',
          drone: cleanEmbedUrl(formData.drone) || formData.drone || '',
        };

        const saveField = async (fieldKey: string, url: string | undefined) => {
            const key = `${normalizedFormData.id}-${fieldKey}`;
            if (url && (url.startsWith('data:') || url.startsWith('blob:'))) {
                await assetStore.save(key, url);
            } else if (!url) {
                // If it's explicitly null or undefined, remove it from storage
                await assetStore.delete(key);
            }
        };

        await saveField('headshot', normalizedFormData.headshot);
        await saveField('logo', normalizedFormData.logo);
        await saveField('agent2Headshot', normalizedFormData.agent2Headshot);
        await saveField('agent2Logo', normalizedFormData.agent2Logo);
        await saveField('floorPlan', normalizedFormData.floorPlan);

        if (normalizedFormData.galleryImages.length > 0) {
            await Promise.all(normalizedFormData.galleryImages.map((url, idx) => {
                if (url.startsWith('data:') || url.startsWith('blob:')) {
                    return assetStore.save(`${normalizedFormData.id}-gallery-${idx}`, url);
                }
                return Promise.resolve();
            }));
        }

        onSave(normalizedFormData);
    } catch (e) {
        console.error("Save failed", e);
        alert("Persistence failed. Metadata will be stored but images may be lost on refresh.");
        onSave(formData);
    } finally {
        setIsSaving(false);
    }
  };

  const removeImage = (idx: number) => {
    setFormData(prev => ({ ...prev, galleryImages: prev.galleryImages.filter((_, i) => i !== idx) }));
  };

  const selectedCount = studioItems.filter(i => i.selected).length;

  return (
    <div className="p-2 sm:p-6 flex justify-center animate-fade-in-up">
      <div className={`w-full glass-panel rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden transition-all duration-300 ${
        editorTab === 'hotspots' ? 'max-w-7xl' : 'max-w-5xl'
      }`}>
        {/* Editor Header */}
        <div className="p-6 md:p-8 border-b border-white/5 bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">{property?.address ? 'Refine Listing' : 'Assemble Property'}</h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Metadata, Floor Plans & Hotspot Synchronization</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
             {/* Sub-Tab Selector */}
             <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-white/10 mr-2">
                <button
                  onClick={() => setEditorTab('details')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    editorTab === 'details'
                      ? 'bg-orange-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  📋 Details & Gallery
                </button>
                <button
                  onClick={() => setEditorTab('hotspots')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    editorTab === 'hotspots'
                      ? 'bg-orange-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🎯 Hotspot Builder
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-900 text-orange-400 text-[8px] font-black border border-orange-500/30">
                    {formData.floorPlanHotspots?.length || 0}
                  </span>
                </button>
             </div>

             <button onClick={onCancel} className="px-5 py-3 text-slate-500 font-black uppercase tracking-widest text-[10px] hover:text-white transition-colors">Discard</button>
             <button 
                onClick={handleFinalSave} 
                disabled={isSaving || isImporting}
                className="px-8 py-3.5 bg-orange-600 hover:bg-orange-500 text-white font-black rounded-2xl uppercase tracking-widest text-[10px] shadow-xl shadow-orange-900/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-30"
             >
                {isSaving ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Syncing...</> : 'Store Property'}
             </button>
          </div>
        </div>

        {/* TAB 1: DETAILS & GALLERY */}
        {editorTab === 'details' && (
          <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Main Info Section */}
          <div className="lg:col-span-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 col-span-full md:col-span-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Unit / Apt / Suite</label>
                    <input value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} type="text" placeholder="e.g. 402" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-700 outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div className="space-y-2 col-span-full md:col-span-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Street Address</label>
                    <input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} type="text" placeholder="e.g. 1024 Ocean Front Walk" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-700 outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">City / Region</label>
                    <input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} type="text" placeholder="e.g. Malibu, CA" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-700 outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Asking Price</label>
                    <input value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} type="text" placeholder="e.g. $14,950,000" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-orange-500 font-bold placeholder-slate-700 outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div className="col-span-full bg-slate-950/60 p-4 rounded-2xl border border-white/5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🗺️</span>
                    <div>
                      <div className="text-[10px] font-black text-white uppercase tracking-wider">Location &amp; Commute Calculator</div>
                      <div className="text-[9px] text-slate-400">Includes instant Commute Calculator (drive/transit/bike/walk), Walk &amp; Bike Scores, Nearest Essentials, and 1-tap Google/Apple/Waze GPS. 100% free with no API key.</div>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={formData.showMap !== false} 
                      onChange={e => setFormData({...formData, showMap: e.target.checked})} 
                      className="w-4 h-4 accent-orange-500 rounded cursor-pointer"
                    />
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">Show Map Tab</span>
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-4 col-span-full">
                  <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Bedrooms</label>
                      <input value={formData.bed} onChange={e => setFormData({...formData, bed: e.target.value})} type="text" placeholder="5" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-700 outline-none focus:ring-1 focus:ring-orange-500" />
                  </div>
                  <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Bathrooms</label>
                      <input value={formData.bath} onChange={e => setFormData({...formData, bath: e.target.value})} type="text" placeholder="6" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-700 outline-none focus:ring-1 focus:ring-orange-500" />
                  </div>
                  <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Living Area SqFt</label>
                      <input value={formData.sqft} onChange={e => setFormData({...formData, sqft: e.target.value})} type="text" placeholder="4,500" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-700 outline-none focus:ring-1 focus:ring-orange-500" />
                  </div>
                </div>
                <div className="space-y-2 col-span-full">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">3D Floor Plan (iFrame Code / Embed URL)</label>
                      {formData.threeDFloorPlan && (
                        <div className="flex items-center gap-2">
                          {cleanEmbedUrl(formData.threeDFloorPlan) ? (
                            <>
                              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                Embed URL Verified
                              </span>
                              <button
                                type="button"
                                onClick={() => setPreview3DModalUrl(cleanEmbedUrl(formData.threeDFloorPlan))}
                                className="px-2.5 py-1 bg-orange-600/20 hover:bg-orange-600 text-orange-400 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider border border-orange-500/30 transition-all cursor-pointer"
                              >
                                👁️ Test 3D Model
                              </button>
                            </>
                          ) : (
                            <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider">
                              ⚠️ Check URL / Snippet format
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <input 
                      value={formData.threeDFloorPlan || ''} 
                      onChange={e => setFormData({...formData, threeDFloorPlan: e.target.value})} 
                      type="text" 
                      placeholder='Paste <iframe src="https://..."></iframe> or direct 3D URL (Matterport, BoxBrownie, Asteroom, Floorplanner, etc.)' 
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-700 outline-none focus:ring-1 focus:ring-orange-500 font-mono text-xs" 
                    />
                    {formData.threeDFloorPlan && cleanEmbedUrl(formData.threeDFloorPlan) && (
                      <div className="text-[10px] text-slate-400 px-1 truncate flex items-center gap-1.5">
                        <span className="text-orange-400 font-black">Clean Embed Source:</span>
                        <span className="font-mono text-slate-300 truncate">{cleanEmbedUrl(formData.threeDFloorPlan)}</span>
                      </div>
                    )}
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Virtual Tour / Matterport URL</label>
                      {formData.matterportUrl && cleanEmbedUrl(formData.matterportUrl) && (
                        <div className="flex items-center gap-2">
                          {isKuulaUrl(formData.matterportUrl) && (
                            <span className="text-[8px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              Mobile Labels On
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setPreview3DModalUrl(cleanEmbedUrl(formData.matterportUrl))}
                            className="px-2 py-0.5 bg-orange-600/20 hover:bg-orange-600 text-orange-400 hover:text-white rounded-lg text-[8px] font-black uppercase tracking-wider border border-orange-500/30 transition-all cursor-pointer"
                          >
                            👁️ Test
                          </button>
                        </div>
                      )}
                    </div>
                    <input value={formData.matterportUrl} onChange={e => setFormData({...formData, matterportUrl: e.target.value})} type="text" placeholder="https://my.matterport.com/show/?m=... or https://kuula.co/share/..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-700 outline-none focus:ring-1 focus:ring-orange-500" />
                    {formData.matterportUrl && isKuulaUrl(formData.matterportUrl) && (
                      <p className="text-[9px] text-emerald-400/90 px-1 flex items-center gap-1">
                        <span>✨</span> Kuula tour detected: automatically optimized with mobile room labels &amp; navigation bar (<code className="font-mono text-[9px]">&amp;nav=1&amp;info=1&amp;thumbs=1</code>).
                      </p>
                    )}
                </div>
                <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Video URL (YouTube/Vimeo)</label>
                    <input value={formData.videoUrl} onChange={e => setFormData({...formData, videoUrl: e.target.value})} type="text" placeholder="https://youtube.com/watch?v=..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-700 outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Drone 360 / Virtual Tour URL</label>
                      {formData.drone && cleanEmbedUrl(formData.drone) && (
                        <div className="flex items-center gap-2">
                          {isKuulaUrl(formData.drone) && (
                            <span className="text-[8px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              Mobile Labels On
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setPreview3DModalUrl(cleanEmbedUrl(formData.drone))}
                            className="px-2 py-0.5 bg-orange-600/20 hover:bg-orange-600 text-orange-400 hover:text-white rounded-lg text-[8px] font-black uppercase tracking-wider border border-orange-500/30 transition-all cursor-pointer"
                          >
                            👁️ Test
                          </button>
                        </div>
                      )}
                    </div>
                    <input value={formData.drone} onChange={e => setFormData({...formData, drone: e.target.value || ''})} type="text" placeholder="https://kuula.co/share/... or 360 URL" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-700 outline-none focus:ring-1 focus:ring-orange-500" />
                    {formData.drone && isKuulaUrl(formData.drone) && (
                      <p className="text-[9px] text-emerald-400/90 px-1 flex items-center gap-1">
                        <span>✨</span> Kuula tour detected: automatically optimized with mobile room labels &amp; navigation bar (<code className="font-mono text-[9px]">&amp;nav=1&amp;info=1&amp;thumbs=1</code>).
                      </p>
                    )}
                </div>
                <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Listing Representative</label>
                    <input value={formData.agentName} onChange={e => setFormData({...formData, agentName: e.target.value})} type="text" placeholder="Full Name" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-700 outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Phone Number</label>
                    <input value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} type="text" placeholder="(555) 000-0000" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-700 outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Agent Email</label>
                    <input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} type="email" placeholder="agent@luxury.com" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-700 outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Agent Website</label>
                    <input value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} type="text" placeholder="https://www.agentwebsite.com" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-700 outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div className="space-y-2 col-span-full">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Brokerage Group</label>
                    <input value={formData.brokerage} onChange={e => setFormData({...formData, brokerage: e.target.value})} type="text" placeholder="e.g. Elite Estates Malibu" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-700 outline-none focus:ring-1 focus:ring-orange-500" />
                </div>

                {/* Second Listing Representative (Co-Realtor) Section */}
                <div className="col-span-full pt-4 border-t border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Co-Listing Representative (Second Realtor)</label>
                        <span className="text-[8px] text-slate-500 font-bold uppercase">Optional</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/40 p-5 rounded-3xl border border-white/5">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Co-Agent Name</label>
                            <input value={formData.agent2Name || ''} onChange={e => setFormData({...formData, agent2Name: e.target.value})} type="text" placeholder="Co-Agent Full Name" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-700 outline-none focus:ring-1 focus:ring-orange-500" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Co-Agent Phone Number</label>
                            <input value={formData.agent2PhoneNumber || ''} onChange={e => setFormData({...formData, agent2PhoneNumber: e.target.value})} type="text" placeholder="(555) 000-0000" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-700 outline-none focus:ring-1 focus:ring-orange-500" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Co-Agent Email</label>
                            <input value={formData.agent2Email || ''} onChange={e => setFormData({...formData, agent2Email: e.target.value})} type="email" placeholder="coagent@luxury.com" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-700 outline-none focus:ring-1 focus:ring-orange-500" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Co-Agent Brokerage</label>
                            <input value={formData.agent2Brokerage || ''} onChange={e => setFormData({...formData, agent2Brokerage: e.target.value})} type="text" placeholder="e.g. Premier Partners" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-white placeholder-slate-700 outline-none focus:ring-1 focus:ring-orange-500" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Showcase Gallery ({formData.galleryImages.length})</label>
                   <div className="flex gap-2">
                      <button 
                        onClick={importFromStudio}
                        disabled={isImporting}
                        className="px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 rounded-lg text-[9px] font-black text-orange-500 uppercase tracking-widest border border-orange-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                        title={`Import ${selectedCount} selected images from Studio`}
                      >
                         {isImporting ? (
                           <><div className="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div> {importProgress ? `Importing ${importProgress}` : 'Optimizing...'}</>
                         ) : (
                           <>
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                             Import Selected from Studio ({selectedCount})
                           </>
                         )}
                      </button>
                      <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-[9px] font-black text-orange-500 uppercase tracking-widest cursor-pointer border border-white/5 transition-all relative">
                          Add Local Files
                          <input type="file" multiple accept="image/*" onChange={e => handleFiles(e.target.files!, '', true)} className="hidden" />
                      </label>
                   </div>
                </div>
                <div 
                    className={`grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-3xl min-h-[200px] transition-all duration-300 border-2 border-dashed relative
                        ${dragOverField === 'gallery' 
                          ? 'bg-orange-500/10 border-orange-500 scale-[0.99]' 
                          : 'bg-slate-950/50 border-white/5'
                        }`}
                >
                    {/* Transparent Drag Overlay to handle Gallery Drops */}
                    <div 
                      onDragOver={(e) => handleDragOver(e, 'gallery')}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, 'gallery', true)}
                      className="absolute inset-0 z-10"
                    />

                    {formData.galleryImages.map((url, idx) => (
                        <div key={idx} className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-white/10 z-20">
                            <img src={url} className="w-full h-full object-cover" />
                            <button onClick={() => removeImage(idx)} className="absolute top-2 right-2 p-2 bg-red-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                            {idx === 0 && (
                                <div className="absolute top-2 left-2 px-2 py-0.5 bg-orange-600 rounded-md text-[8px] font-black text-white uppercase tracking-widest shadow-lg">Hero</div>
                            )}
                        </div>
                    ))}
                    {formData.galleryImages.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center text-slate-700 space-y-2 pointer-events-none">
                           <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                           <p className="text-[10px] font-bold uppercase tracking-widest">{dragOverField === 'gallery' ? 'Drop to Add' : 'Primary images required'}</p>
                        </div>
                    )}
                </div>
            </div>
          </div>

          {/* Branding Section */}
          <div className="lg:col-span-4 space-y-6">
            <div className="p-6 bg-slate-900/50 rounded-[2rem] border border-white/5 space-y-6">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-4">Brand Assets</h3>
                
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block">Agent Headshot</label>
                        <div 
                            onDragOver={(e) => handleDragOver(e, 'headshot')}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, 'headshot')}
                            className={`relative group aspect-square rounded-full overflow-hidden bg-slate-950 border-2 border-dashed flex items-center justify-center cursor-pointer transition-all mx-auto max-w-[120px]
                                ${dragOverField === 'headshot' 
                                  ? 'border-orange-500 bg-orange-500/10 scale-105' 
                                  : 'border-slate-800 hover:border-orange-500/50'}`}
                        >
                            {formData.headshot ? (
                                <>
                                    <img src={formData.headshot} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-red-600/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-30">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFormData(prev => ({ ...prev, headshot: undefined }));
                                                if (window.confirm("Remove this headshot globally?")) {
                                                    setSocialAssets(prev => ({ ...prev, headshot: null }));
                                                }
                                            }}
                                            className="p-2 bg-white text-red-600 rounded-full shadow-lg"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-8 h-8 ${dragOverField === 'headshot' ? 'text-orange-500' : 'text-slate-700'}`}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                            )}
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={e => handleFiles(e.target.files!, 'headshot')} 
                              className="absolute inset-0 opacity-0 cursor-pointer z-20" 
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block">Agency Logo</label>
                        <div 
                            onDragOver={(e) => handleDragOver(e, 'logo')}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, 'logo')}
                            className={`relative group h-20 rounded-2xl bg-slate-950 border-2 border-dashed flex items-center justify-center cursor-pointer transition-all
                                ${dragOverField === 'logo' 
                                  ? 'border-orange-500 bg-orange-500/10 scale-[1.02]' 
                                  : 'border-slate-800 hover:border-orange-500/50'}`}
                        >
                            {formData.logo ? (
                                <>
                                    <img src={formData.logo} className="max-h-full max-w-full p-3 object-contain" />
                                    <div className="absolute inset-0 bg-red-600/60 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-30">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFormData(prev => ({ ...prev, logo: undefined }));
                                                if (window.confirm("Remove this logo globally?")) {
                                                    setSocialAssets(prev => ({ ...prev, logo: null }));
                                                }
                                            }}
                                            className="p-2 bg-white text-red-600 rounded-full shadow-lg"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-6 h-6 ${dragOverField === 'logo' ? 'text-orange-500' : 'text-slate-700'}`}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                            )}
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={e => handleFiles(e.target.files!, 'logo')} 
                              className="absolute inset-0 opacity-0 cursor-pointer z-20" 
                            />
                        </div>
                    </div>

                    {/* Co-Agent Brand Assets */}
                    <div className="pt-4 border-t border-white/5 space-y-4">
                        <label className="text-[9px] font-black text-orange-400 uppercase tracking-widest block">Co-Agent Brand Assets</label>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Co-Headshot</label>
                                <div 
                                    onDragOver={(e) => handleDragOver(e, 'agent2Headshot')}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, 'agent2Headshot')}
                                    className={`relative group aspect-square rounded-full overflow-hidden bg-slate-950 border-2 border-dashed flex items-center justify-center cursor-pointer transition-all mx-auto max-w-[90px]
                                        ${dragOverField === 'agent2Headshot' 
                                          ? 'border-orange-500 bg-orange-500/10 scale-105' 
                                          : 'border-slate-800 hover:border-orange-500/50'}`}
                                >
                                    {formData.agent2Headshot ? (
                                        <>
                                            <img src={formData.agent2Headshot} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-red-600/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-30">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setFormData(prev => ({ ...prev, agent2Headshot: undefined }));
                                                        if (window.confirm("Remove co-agent headshot globally?")) {
                                                            setSocialAssets(prev => ({ ...prev, headshot2: null }));
                                                        }
                                                    }}
                                                    className="p-1.5 bg-white text-red-600 rounded-full shadow-lg"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-6 h-6 ${dragOverField === 'agent2Headshot' ? 'text-orange-500' : 'text-slate-700'}`}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                                    )}
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      onChange={e => handleFiles(e.target.files!, 'agent2Headshot')} 
                                      className="absolute inset-0 opacity-0 cursor-pointer z-20" 
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Co-Brokerage Logo</label>
                                <div 
                                    onDragOver={(e) => handleDragOver(e, 'agent2Logo')}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, 'agent2Logo')}
                                    className={`relative group h-20 rounded-2xl bg-slate-950 border-2 border-dashed flex items-center justify-center cursor-pointer transition-all
                                        ${dragOverField === 'agent2Logo' 
                                          ? 'border-orange-500 bg-orange-500/10 scale-[1.02]' 
                                          : 'border-slate-800 hover:border-orange-500/50'}`}
                                >
                                    {formData.agent2Logo ? (
                                        <>
                                            <img src={formData.agent2Logo} className="max-h-full max-w-full p-2 object-contain" />
                                            <div className="absolute inset-0 bg-red-600/60 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-30">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setFormData(prev => ({ ...prev, agent2Logo: undefined }));
                                                        if (window.confirm("Remove co-agent logo globally?")) {
                                                            setSocialAssets(prev => ({ ...prev, logo2: null }));
                                                        }
                                                    }}
                                                    className="p-1.5 bg-white text-red-600 rounded-full shadow-lg"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 ${dragOverField === 'agent2Logo' ? 'text-orange-500' : 'text-slate-700'}`}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                                    )}
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      onChange={e => handleFiles(e.target.files!, 'agent2Logo')} 
                                      className="absolute inset-0 opacity-0 cursor-pointer z-20" 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block">Floor Plan</label>
                            {formData.floorPlan && (
                              <button
                                onClick={() => setEditorTab('hotspots')}
                                className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border flex items-center gap-1.5 ${
                                  editorTab === 'hotspots'
                                    ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-900/30'
                                    : 'bg-slate-800 border-white/5 text-orange-400 hover:bg-slate-700'
                                }`}
                              >
                                🎯 Open Hotspot Builder ({formData.floorPlanHotspots?.length || 0})
                              </button>
                            )}
                        </div>
                        <div 
                            onDragOver={(e) => handleDragOver(e, 'floorPlan')}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, 'floorPlan')}
                            className={`relative group aspect-video rounded-2xl bg-slate-950 border-2 border-dashed flex items-center justify-center cursor-pointer transition-all
                                ${dragOverField === 'floorPlan' 
                                  ? 'border-orange-500 bg-orange-500/10 scale-[1.02]' 
                                  : 'border-slate-800 hover:border-orange-500/50'}`}
                        >
                            {formData.floorPlan ? (
                                <>
                                    <img src={formData.floorPlan} className="w-full h-full object-contain p-2" />
                                    <div className="absolute inset-0 bg-red-600/60 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-30 pointer-events-auto">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFormData(prev => ({ ...prev, floorPlan: undefined, floorPlanHotspots: [] }));
                                            }}
                                            className="p-2 bg-white text-red-600 rounded-full shadow-lg"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-6 h-6 ${dragOverField === 'floorPlan' ? 'text-orange-500' : 'text-slate-700'}`}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                            )}
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={e => handleFiles(e.target.files!, 'floorPlan')} 
                              className={`absolute inset-0 opacity-0 z-20 ${formData.floorPlan ? 'pointer-events-none' : 'cursor-pointer'}`} 
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 bg-slate-900/50 rounded-[2rem] border border-white/5 space-y-4">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-4">Location Services</h3>
                <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-300 block">Map &amp; Commute Calculator</span>
                      <span className="text-[9px] text-slate-500 block">Walk scores, commute times &amp; essentials</span>
                    </div>
                    <button 
                        onClick={() => setFormData({...formData, showMap: !formData.showMap})}
                        className={`w-10 h-5 rounded-full transition-all relative ${formData.showMap ? 'bg-orange-600' : 'bg-slate-800'}`}
                    >
                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${formData.showMap ? 'left-6' : 'left-1'}`}></div>
                    </button>
                </div>
            </div>
          </div>
        </div>
        )}

        {/* TAB 2: EXPANDED SPACIOUS HOTSPOT BUILDER WORKSPACE */}
        {editorTab === 'hotspots' && (
          <div className="p-6 md:p-8 space-y-8 animate-fade-in">
            {!formData.floorPlan ? (
              <div className="p-12 text-center bg-slate-950/80 rounded-[2rem] border border-dashed border-slate-800 space-y-4 max-w-xl mx-auto my-12">
                <div className="w-16 h-16 rounded-3xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 mx-auto text-2xl font-black">
                  📐
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">No Floor Plan Blueprint Uploaded</h3>
                  <p className="text-xs text-slate-400 mt-1">Upload a floor plan image below to unlock the interactive hotspot mapping studio.</p>
                </div>
                <label className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer shadow-lg transition-all">
                  Upload Floor Plan Image
                  <input type="file" accept="image/*" onChange={e => handleFiles(e.target.files!, 'floorPlan')} className="hidden" />
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left/Main Column: Huge High-Res Blueprint Canvas */}
                <div className="lg:col-span-8 space-y-4">
                  {/* Canvas Toolbar & Presets */}
                  <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/80 rounded-2xl border border-white/10">
                    <div>
                      <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest block">Interactive Blueprint Canvas</span>
                      <h4 className="text-xs font-black text-white uppercase tracking-tight">
                        Click Blueprint to Drop Room Pins ({formData.floorPlanHotspots?.length || 0} Placed)
                      </h4>
                    </div>

                    {/* Canvas Controls */}
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-slate-500 uppercase mr-1">Zoom:</span>
                      {[1, 1.25, 1.5, 2, 2.5].map((z) => (
                        <button
                          key={z}
                          onClick={() => setZoomLevel(z)}
                          className={`px-2.5 py-1 rounded-lg text-[9px] font-black transition-all border ${
                            zoomLevel === z 
                              ? 'bg-orange-600 text-white border-orange-500' 
                              : 'bg-slate-950 text-slate-400 border-white/10 hover:text-white'
                          }`}
                        >
                          {Math.round(z * 100)}%
                        </button>
                      ))}
                      {formData.floorPlan && (
                        <button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = formData.floorPlan!;
                            const cleanAddress = (formData.address || 'FloorPlan').replace(/[^a-zA-Z0-9_-]/g, '_');
                            link.download = `FloorPlan-${cleanAddress}.png`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="px-3 py-1 bg-slate-800 border border-white/10 hover:bg-slate-700 text-slate-200 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-orange-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                          Download Floor Plan
                        </button>
                      )}
                      {formData.floorPlanHotspots && formData.floorPlanHotspots.length > 0 && (
                        <button
                          onClick={() => {
                            if (confirm('Clear all floor plan hotspot pins?')) {
                              setFormData(prev => ({ ...prev, floorPlanHotspots: [] }));
                              setActiveHotspotId(null);
                            }
                          }}
                          className="ml-2 px-3 py-1 bg-red-600/20 border border-red-500/30 hover:bg-red-600 text-red-400 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Massive Canvas Container */}
                  <div className="p-4 bg-slate-950 rounded-3xl border border-white/10 overflow-auto max-h-[680px] shadow-2xl relative">
                    <div 
                      ref={canvasRef}
                      onClick={(e) => {
                        if (wasDraggingRef.current) {
                          wasDraggingRef.current = false;
                          return;
                        }
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                        const clickY = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                        const newId = Math.random().toString(36).substring(7);
                        const newHotspot = {
                          id: newId,
                          x: Math.min(98, Math.max(2, clickX)),
                          y: Math.min(98, Math.max(2, clickY)),
                          title: '',
                          description: '',
                          targetImageIndex: 0
                        };
                        setFormData(prev => ({
                          ...prev,
                          floorPlanHotspots: [...(prev.floorPlanHotspots || []), newHotspot]
                        }));
                        setActiveHotspotId(newId);
                      }}
                      style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}
                      className="relative w-full max-w-4xl bg-white rounded-2xl overflow-hidden cursor-crosshair border border-white/20 shadow-2xl transition-transform duration-200 select-none shrink-0"
                    >
                      <img src={formData.floorPlan} className="block w-full h-auto pointer-events-none" />

                      {/* Empty State Banner */}
                      {(formData.floorPlanHotspots?.length === 0) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] pointer-events-none">
                          <div className="px-6 py-3 rounded-2xl bg-orange-600 text-white font-black text-xs uppercase tracking-widest shadow-2xl animate-bounce flex items-center gap-2">
                            <span>🎯</span> Click anywhere on this blueprint to pin a photo
                          </div>
                        </div>
                      )}

                      {/* Pins */}
                      {formData.floorPlanHotspots?.map((spot, idx) => {
                        const isSelected = activeHotspotId === spot.id;
                        const isDragging = draggingPinId === spot.id;
                        return (
                          <div
                            key={spot.id}
                            onPointerDown={(e) => handlePointerDownPin(spot.id, e)}
                            onPointerMove={(e) => handlePointerMovePin(spot.id, e)}
                            onPointerUp={(e) => handlePointerUpPin(spot.id, e)}
                            onPointerCancel={(e) => handlePointerUpPin(spot.id, e)}
                            onClick={(e) => e.stopPropagation()}
                            title="Click and drag to reposition pin"
                            style={{ 
                              left: `${spot.x}%`, 
                              top: `${spot.y}%`, 
                              transform: `translate(-50%, -50%) scale(${(1 / zoomLevel) * (isSelected || isDragging ? 1.25 : 1)})`,
                              transformOrigin: 'center center',
                              touchAction: 'none' 
                            }}
                            className={`absolute cursor-grab active:cursor-grabbing z-20 group/pin select-none transition-transform duration-100 ${
                              isSelected || isDragging ? 'z-30' : 'hover:opacity-90'
                            }`}
                          >
                            <div className="relative flex items-center justify-center">
                              {/* Pulse ring for selected */}
                              {isSelected && !isDragging && (
                                <div className="absolute inset-0 -m-2 rounded-full bg-orange-500/40 animate-ping pointer-events-none"></div>
                              )}
                              <div className={`w-6 h-6 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-[9px] sm:text-xs font-black shadow-2xl border-2 transition-colors ${
                                isDragging
                                  ? 'bg-orange-600 text-white border-white ring-4 ring-orange-500/60 scale-110 shadow-orange-500/50'
                                  : isSelected 
                                    ? 'bg-orange-500 text-white border-white ring-4 ring-orange-500/40 scale-110' 
                                    : 'bg-slate-950 text-orange-400 border-orange-500 hover:bg-orange-500 hover:text-white'
                              }`}>
                                {idx + 1}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column: Selected Hotspot Settings & Directory */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Currently Selected Hotspot Card */}
                  {activeHotspotId && (() => {
                    const spotIndex = formData.floorPlanHotspots?.findIndex(s => s.id === activeHotspotId) ?? -1;
                    if (spotIndex === -1) return null;
                    const spot = formData.floorPlanHotspots![spotIndex];

                    return (
                      <div className="p-6 bg-slate-900 rounded-3xl border border-orange-500/40 space-y-5 shadow-2xl animate-fade-in">
                        <div className="flex items-center justify-between border-b border-white/10 pb-4">
                          <div>
                            <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest block">Active Hotspot</span>
                            <h4 className="text-sm font-black text-white uppercase tracking-tight">Pin #{spotIndex + 1} Settings</h4>
                          </div>
                          <button
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                floorPlanHotspots: prev.floorPlanHotspots?.filter(s => s.id !== spot.id)
                              }));
                              setActiveHotspotId(null);
                            }}
                            className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider border border-red-500/30 transition-all flex items-center gap-1"
                          >
                            Delete Pin
                          </button>
                        </div>

                        <div className="space-y-4">
                          {/* Title / Room Name */}
                          <div>
                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Pin Title / Room Name</label>
                            <input
                              type="text"
                              value={spot.title || ''}
                              onChange={(e) => {
                                const updated = [...(formData.floorPlanHotspots || [])];
                                updated[spotIndex] = { ...spot, title: e.target.value };
                                setFormData({ ...formData, floorPlanHotspots: updated });
                              }}
                              placeholder="e.g. Master Bedroom 360, Living Room"
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-orange-500"
                            />
                          </div>

                          {/* Caption */}
                          <div>
                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Note / Caption (Optional)</label>
                            <textarea
                              rows={2}
                              value={spot.description || ''}
                              onChange={(e) => {
                                const updated = [...(formData.floorPlanHotspots || [])];
                                updated[spotIndex] = { ...spot, description: e.target.value };
                                setFormData({ ...formData, floorPlanHotspots: updated });
                              }}
                              placeholder="e.g. Vaulted ceilings, ocean views, dual walk-in closets"
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-orange-500 resize-none"
                            />
                          </div>

                          {/* Drag and Drop Upload Box for External Image */}
                          <div className="pt-2 border-t border-white/10 space-y-2">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">
                              Upload / Drag & Drop Hotspot Photo
                            </label>

                            {(() => {
                              const activeLinkedImg = (spot.targetImageIndex !== undefined && formData.galleryImages[spot.targetImageIndex]) || spot.targetImageUrl;

                              return (
                                <div
                                  onDragOver={(e) => handleHotspotDragOver(e, spot.id)}
                                  onDragLeave={handleHotspotDragLeave}
                                  onDrop={(e) => handleHotspotDrop(e, spot.id)}
                                  className={`relative p-4 rounded-2xl border-2 border-dashed transition-all text-center space-y-2 cursor-pointer ${
                                    dragOverHotspotId === spot.id
                                      ? 'border-orange-500 bg-orange-500/20 scale-[1.02]'
                                      : 'border-white/20 bg-slate-950/80 hover:border-orange-500/50 hover:bg-slate-950'
                                  }`}
                                >
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => e.target.files && handleHotspotFileUpload(e.target.files, spot.id)}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                  />

                                  {activeLinkedImg ? (
                                    <div className="relative group/thumb rounded-2xl overflow-hidden max-h-64 border border-white/10 mx-auto">
                                      <img src={activeLinkedImg} className="w-full h-56 object-cover" alt="Hotspot" />
                                      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex flex-col items-center justify-center p-3 text-center pointer-events-none">
                                        <span className="text-white text-xs font-black uppercase">Drop or Click to Replace Photo</span>
                                        <span className="text-[9px] text-orange-400">Standard photos & 360° panoramas supported</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="py-4">
                                      <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 mx-auto mb-2 text-xl font-black">
                                        📁
                                      </div>
                                      <p className="text-xs font-black text-white uppercase tracking-tight">
                                        Drag & Drop Image Here
                                      </p>
                                      <p className="text-[9px] text-slate-400 mt-0.5">
                                        or <span className="text-orange-400 underline font-bold">click to upload file</span> from computer
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Link Photo from Showcase Gallery */}
                          <div className="space-y-3 pt-3 border-t border-white/10">
                            <div className="flex items-center justify-between">
                              <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest block">
                                Or Link Existing Gallery Photo ({formData.galleryImages.length} available)
                              </label>
                              <span className="text-[8px] text-slate-400">Click image to select room</span>
                            </div>
                            {formData.galleryImages.length > 0 ? (
                              <div className="grid grid-cols-2 gap-3 max-h-[420px] overflow-y-auto p-1.5 scrollbar-thin">
                                {formData.galleryImages.map((imgUrl, gIdx) => {
                                  const isSelected = spot.targetImageIndex === gIdx;
                                  return (
                                    <div
                                      key={gIdx}
                                      onClick={() => {
                                        const updated = [...(formData.floorPlanHotspots || [])];
                                        updated[spotIndex] = { ...spot, targetImageIndex: gIdx, targetImageUrl: imgUrl, is360: false };
                                        setFormData({ ...formData, floorPlanHotspots: updated });
                                      }}
                                      className={`relative aspect-[4/3] rounded-2xl overflow-hidden border-2 cursor-pointer transition-all group ${
                                        isSelected 
                                          ? 'border-orange-500 ring-4 ring-orange-500/50 scale-[1.02] z-10' 
                                          : 'border-white/10 opacity-80 hover:opacity-100 hover:border-orange-500/50'
                                      }`}
                                    >
                                      <img src={imgUrl} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" alt={`Gallery photo ${gIdx + 1}`} />
                                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent p-2 flex justify-between items-center text-[10px] font-black text-white">
                                        <span>Photo #{gIdx + 1}</span>
                                        {isSelected && (
                                          <span className="bg-orange-500 text-white px-2 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-extrabold shadow">
                                            Linked
                                          </span>
                                        )}
                                      </div>
                                      {isSelected && (
                                        <div className="absolute top-2 right-2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-black shadow-lg border border-white">
                                          ✓
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-[9px] text-slate-500 italic">Add gallery images in the Details tab to link them to this hotspot pin.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Hotspots Directory List */}
                  <div className="p-6 bg-slate-900/60 rounded-3xl border border-white/10 space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">Hotspots Directory</h4>
                      <span className="text-[9px] font-black text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/30">
                        {formData.floorPlanHotspots?.length || 0} Pins
                      </span>
                    </div>

                    {formData.floorPlanHotspots && formData.floorPlanHotspots.length > 0 ? (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {formData.floorPlanHotspots.map((spot, idx) => {
                          const isSelected = activeHotspotId === spot.id;
                          const linkedImg = (spot.targetImageIndex !== undefined && formData.galleryImages[spot.targetImageIndex]) || spot.targetImageUrl;

                          return (
                            <div
                              key={spot.id}
                              onClick={() => setActiveHotspotId(spot.id)}
                              onDragOver={(e) => handleHotspotDragOver(e, spot.id)}
                              onDragLeave={handleHotspotDragLeave}
                              onDrop={(e) => handleHotspotDrop(e, spot.id)}
                              className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 relative ${
                                dragOverHotspotId === spot.id
                                  ? 'border-orange-500 bg-orange-500/30 ring-2 ring-orange-500/50 scale-[1.02]'
                                  : isSelected 
                                    ? 'bg-orange-600/20 border-orange-500 shadow-lg' 
                                    : 'bg-slate-950 border-white/5 hover:border-white/20'
                              }`}
                            >
                              <div className="w-8 h-8 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center shrink-0 text-orange-400 font-black text-xs">
                                #{idx + 1}
                              </div>
                              {linkedImg && (
                                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/10">
                                  <img src={linkedImg} className="w-full h-full object-cover" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <h5 className="text-xs font-black text-white uppercase tracking-tight truncate">
                                  {spot.title || `Hotspot Pin #${idx + 1}`}
                                </h5>
                                <p className="text-[9px] text-slate-400 truncate">
                                  {spot.description || (spot.targetImageUrl ? 'Custom 360 Hotspot Photo' : `Linked Gallery Photo #${(spot.targetImageIndex ?? 0) + 1}`)}
                                </p>
                              </div>
                              {isSelected && (
                                <span className="text-[10px] text-orange-400">●</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500 text-center py-4 italic">No hotspot pins dropped yet. Click the blueprint image to add your first room pin.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3D Model Test Preview Modal */}
      {preview3DModalUrl && (
        <div className="fixed inset-0 z-[300] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="max-w-4xl w-full glass-panel p-6 rounded-[2.5rem] border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <h4 className="text-sm font-black text-white uppercase tracking-wider">3D Model / Virtual Tour Preview Test</h4>
              </div>
              <button
                type="button"
                onClick={() => setPreview3DModalUrl(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider border border-white/10"
              >
                ✕ Close Preview
              </button>
            </div>
            <div className="text-[10px] text-slate-400 font-mono truncate px-1">
              Source URL: {preview3DModalUrl}
            </div>
            <div className="w-full h-[65vh] min-h-[400px] rounded-2xl overflow-hidden border border-white/10 bg-black shadow-inner">
              <iframe
                src={preview3DModalUrl}
                width="100%"
                height="100%"
                frameBorder="0"
                allowFullScreen
                allow="xr-spatial-tracking; accelerometer; gyroscope; magnetometer; fullscreen; autoplay"
                className="w-full h-full border-0"
                loading="lazy"
                title="3D Preview Test"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Editor;
