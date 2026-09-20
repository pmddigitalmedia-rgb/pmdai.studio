import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ImageItem, SocialAssets, PropertyData } from '../types';
import { PROFESSIONAL_AUDIO_LIBRARY, AudioTrack } from '../constants';
import {
  drawAgentCardOverlay,
  drawLowerThirdsOverlay,
  loadBrandingImages,
  LoadedBrandingImages,
  AgentCardData,
  LowerThirdsData
} from '../utils/canvasBranding';

export type KenBurnsPreset =
  | 'zoom_in'
  | 'zoom_out'
  | 'pan_left_to_right'
  | 'pan_right_to_left'
  | 'pan_top_to_bottom'
  | 'pan_bottom_to_top';

export type SlideTransition = 'crossfade' | 'dip_black' | 'cut';

export interface SlideshowSlide {
  id: string;
  sourceId?: string;
  name: string;
  type: 'image' | 'video';
  url: string;
  duration: number; // in seconds
  // Video-specific trimming
  videoDuration?: number;
  trimStart: number;
  trimEnd: number;
  videoMuted: boolean;
  // Ken Burns specific
  kenBurnsEnabled: boolean;
  kenBurnsPreset: KenBurnsPreset;
  kenBurnsIntensity: number; // e.g. 1.15
  // Overlay
  title?: string;
  subtitle?: string;
  showCaption?: boolean;
  // Agent Card & Lower Thirds Overlays
  showAgentCard?: boolean;
  showLowerThirds?: boolean;
  lowerThirdsMode?: string; // 'JUST LISTED' | 'JUST SOLD' | 'FOR SALE' | 'FEATURED HOME'
  customPrice?: string;
  customAddress?: string;
  customCity?: string;
  customBeds?: string;
  customBaths?: string;
  customSqft?: string;
}

export interface SlideshowBuilderProps {
  items: ImageItem[];
  socialAssets: SocialAssets;
  brandingColor?: string;
  properties?: PropertyData[];
  onBackToStudio?: () => void;
  initialSlides?: SlideshowSlide[];
  onSlidesChange?: (slides: SlideshowSlide[]) => void;
}

/**
 * Converts a Studio ImageItem to a SlideshowSlide.
 * Strictly enforces:
 * - If the selected item represents a video (active video in history or video file),
 *   it imports ONLY the video as a video slide. It never duplicates or converts it to an image.
 * - If the selected item represents an image, it imports ONLY the image.
 */
export const convertItemToSlide = (item: ImageItem, index: number = 0): SlideshowSlide => {
  const activeAsset = item.currentHistoryIndex >= 0 && item.history && item.history[item.currentHistoryIndex]
    ? item.history[item.currentHistoryIndex]
    : null;

  const isVideo = activeAsset
    ? (activeAsset.type === 'video' ||
       (typeof activeAsset.url === 'string' && (activeAsset.url.startsWith('data:video/') || activeAsset.url.endsWith('.mp4') || activeAsset.url.endsWith('.webm') || activeAsset.url.includes('video'))))
    : (Boolean(item.file?.type?.startsWith('video/')) ||
       (typeof item.previewUrl === 'string' && (item.previewUrl.startsWith('data:video/') || item.previewUrl.endsWith('.mp4') || item.previewUrl.endsWith('.webm'))));

  const mediaUrl = activeAsset ? activeAsset.url : item.previewUrl;
  const rawName = item.file?.name?.replace(/\.[^/.]+$/, '') || `Slide ${index + 1}`;
  const presets: KenBurnsPreset[] = ['zoom_in', 'pan_left_to_right', 'zoom_out', 'pan_right_to_left'];

  if (isVideo) {
    return {
      id: `slide-vid-${item.id}-${Date.now()}-${index}`,
      sourceId: item.id,
      name: `${rawName} (Video)`,
      type: 'video',
      url: mediaUrl,
      duration: 5,
      videoDuration: 5,
      trimStart: 0,
      trimEnd: 5,
      videoMuted: false,
      kenBurnsEnabled: false,
      kenBurnsPreset: 'zoom_in',
      kenBurnsIntensity: 1.15,
      title: rawName,
      showCaption: false
    };
  } else {
    return {
      id: `slide-img-${item.id}-${Date.now()}-${index}`,
      sourceId: item.id,
      name: rawName,
      type: 'image',
      url: mediaUrl,
      duration: 4,
      trimStart: 0,
      trimEnd: 4,
      videoMuted: true,
      kenBurnsEnabled: true,
      kenBurnsPreset: presets[index % presets.length],
      kenBurnsIntensity: 1.15,
      title: rawName,
      showCaption: false
    };
  }
};

export interface SlideshowBrandingSettings {
  showIntroAgentCard: boolean;
  introDuration: number;
  showOutroAgentCard: boolean;
  outroDuration: number;
  showGlobalLowerThirds: boolean;
  lowerThirdsMode: string;
  price: string;
  address: string;
  unit: string;
  city: string;
  beds: string;
  baths: string;
  sqft: string;
  realtor: string;
  phone: string;
  email: string;
  brokerage: string;
  website: string;
  realtor2?: string;
  phone2?: string;
  email2?: string;
  brokerage2?: string;
}

export const SlideshowBuilder: React.FC<SlideshowBuilderProps> = ({
  items,
  socialAssets,
  brandingColor = '#f97316',
  properties = [],
  onBackToStudio,
  initialSlides,
  onSlidesChange
}) => {
  const defaultProperty = properties && properties.length > 0 ? properties[0] : null;

  // Branding & Overlays Settings (Agent Card & Lower Thirds)
  const [brandingSettings, setBrandingSettings] = useState<SlideshowBrandingSettings>(() => ({
    showIntroAgentCard: true,
    introDuration: 2.5,
    showOutroAgentCard: true,
    outroDuration: 3.0,
    showGlobalLowerThirds: true,
    lowerThirdsMode: 'JUST LISTED',
    price: defaultProperty?.price || '$1,295,000',
    address: defaultProperty?.address || '1248 Ocean View Drive',
    unit: defaultProperty?.unit || '',
    city: defaultProperty?.city || 'Newport Beach, CA',
    beds: defaultProperty?.beds || '4 Beds',
    baths: defaultProperty?.baths || '3 Baths',
    sqft: defaultProperty?.sqft || '3,450 Sq Ft',
    realtor: socialAssets.realtor || '',
    phone: socialAssets.phone || '',
    email: socialAssets.email || '',
    brokerage: socialAssets.brokerage || '',
    website: socialAssets.website || '',
    realtor2: socialAssets.realtor2 || '',
    phone2: socialAssets.phone2 || '',
    email2: socialAssets.email2 || '',
    brokerage2: socialAssets.brokerage2 || '',
  }));

  const [inspectorTab, setInspectorTab] = useState<'slide' | 'branding'>('slide');
  const [loadedBranding, setLoadedBranding] = useState<LoadedBrandingImages | null>(null);

  // Preload agent headshots and brokerage logos for high-performance canvas overlay drawing
  useEffect(() => {
    let active = true;
    loadBrandingImages(socialAssets, brandingSettings).then((imgs) => {
      if (active) {
        setLoadedBranding(imgs);
      }
    });
    return () => {
      active = false;
    };
  }, [
    socialAssets.headshot,
    socialAssets.logo,
    socialAssets.headshot2,
    socialAssets.logo2,
    socialAssets.agentHeadshot,
    socialAssets.brokerageLogo,
    brandingSettings.realtor,
    brandingSettings.brokerage
  ]);

  // Slides state
  const [slides, setSlides] = useState<SlideshowSlide[]>(() => {
    if (initialSlides && initialSlides.length > 0) return initialSlides;
    const selectedItems = items.filter((i) => i.selected);
    if (selectedItems.length > 0) {
      const sortedSelected = [...selectedItems].sort((a, b) => (a.selectionOrder || 0) - (b.selectionOrder || 0));
      return sortedSelected.map((item, idx) => convertItemToSlide(item, idx));
    }
    return [];
  });

  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [exportResolution, setExportResolution] = useState<'4k' | '2k' | '1080p'>('4k');
  const [transitionStyle, setTransitionStyle] = useState<SlideTransition>('crossfade');
  const [transitionDuration, setTransitionDuration] = useState<number>(0.8);

  // Audio state
  const [selectedAudioIdx, setSelectedAudioIdx] = useState<number>(0);
  const [customAudio, setCustomAudio] = useState<{ name: string; url: string } | null>(null);
  const [audioVolume, setAudioVolume] = useState<number>(0.8);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0); // in seconds
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportStatusText, setExportStatusText] = useState<string>('');

  // Asset Picker Drawer / Modal
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importTab, setImportTab] = useState<'selected' | 'videos' | 'images' | 'originals' | 'upload'>('selected');

  // Trimmer local player ref
  const trimmerVideoRef = useRef<HTMLVideoElement | null>(null);
  const [trimmerCurrentTime, setTrimmerCurrentTime] = useState<number>(0);
  const [isTrimmerPlaying, setIsTrimmerPlaying] = useState<boolean>(false);

  // Main Canvas Player Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number>(0);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const currentTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);

  // Sync ref with state
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (!isPlaying) {
      // Ensure all videos in preview cache pause immediately
      videoElementsRef.current.forEach((v) => {
        if (!v.paused) v.pause();
      });
    }
  }, [isPlaying]);

  // Cache for loaded images and hidden video elements
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Active audio track
  const activeAudioTrack: AudioTrack = useMemo(() => {
    if (customAudio) return customAudio;
    return PROFESSIONAL_AUDIO_LIBRARY[selectedAudioIdx] || PROFESSIONAL_AUDIO_LIBRARY[0];
  }, [customAudio, selectedAudioIdx]);

  // Gather all generated session media from items
  const allSessionAssets = useMemo(() => {
    const selectedStudioItems: { item: ImageItem; slide: SlideshowSlide }[] = [];
    const videos: { id: string; name: string; url: string; tool: string; parentId: string; isSelected?: boolean }[] = [];
    const generatedImages: { id: string; name: string; url: string; tool: string; parentId: string; isSelected?: boolean }[] = [];
    const originals: { id: string; name: string; url: string; parentId: string; isSelected?: boolean }[] = [];

    // First, process explicitly selected items in the studio
    items.filter((i) => i.selected).forEach((item, idx) => {
      selectedStudioItems.push({
        item,
        slide: convertItemToSlide(item, idx)
      });
    });

    items.forEach((item, idx) => {
      const baseName = item.file?.name || `Property Photo #${idx + 1}`;
      const activeAsset = item.currentHistoryIndex >= 0 && item.history ? item.history[item.currentHistoryIndex] : null;
      const isItemActiveVideo = activeAsset
        ? (activeAsset.type === 'video' || activeAsset.url.startsWith('data:video/') || activeAsset.url.includes('.mp4') || activeAsset.url.includes('.webm'))
        : (item.file?.type?.startsWith('video/') || item.previewUrl?.startsWith('data:video/') || item.previewUrl?.includes('.mp4') || item.previewUrl?.includes('.webm'));

      // If this item is active as a video, do NOT add it as an original image (prevents duplicating video as image)
      if (item.previewUrl && !isItemActiveVideo) {
        originals.push({
          id: `orig-${item.id}`,
          name: baseName,
          url: item.previewUrl,
          parentId: item.id,
          isSelected: item.selected
        });
      }

      if (item.history && item.history.length > 0) {
        item.history.forEach((asset, hIdx) => {
          const toolName = asset.tools && asset.tools.length > 0 ? asset.tools.join(', ') : 'AI Enhance';
          const isAssetVideo = asset.type === 'video' || asset.url.startsWith('data:video/') || asset.url.includes('.mp4') || asset.url.includes('.webm');
          if (isAssetVideo) {
            videos.push({
              id: `vid-${item.id}-${hIdx}`,
              name: `${baseName} (${toolName})`,
              url: asset.url,
              tool: toolName,
              parentId: item.id,
              isSelected: item.selected
            });
          } else {
            generatedImages.push({
              id: `img-${item.id}-${hIdx}`,
              name: `${baseName} (${toolName})`,
              url: asset.url,
              tool: toolName,
              parentId: item.id,
              isSelected: item.selected
            });
          }
        });
      }
    });

    return { selectedStudioItems, videos, generatedImages, originals };
  }, [items]);

  // Sync slides when initialSlides change (e.g. transferred from Studio via "Slideshow" button)
  useEffect(() => {
    if (initialSlides && initialSlides.length > 0) {
      setSlides(initialSlides);
      setActiveSlideIndex(0);
      setCurrentTime(0);
      currentTimeRef.current = 0;
    }
  }, [initialSlides]);

  // Notify parent of slides changes if requested
  useEffect(() => {
    if (onSlidesChange) {
      onSlidesChange(slides);
    }
  }, [slides, onSlidesChange]);

  // Compute slide timeline offsets and total sequence duration (including optional Intro and Outro Agent Cards)
  const timelineInfo = useMemo(() => {
    const introSec = brandingSettings.showIntroAgentCard ? Math.max(1, brandingSettings.introDuration) : 0;
    const outroSec = brandingSettings.showOutroAgentCard ? Math.max(1, brandingSettings.outroDuration) : 0;

    let acc = introSec;
    const offsets: { start: number; end: number; duration: number }[] = [];
    slides.forEach((slide) => {
      const dur = slide.type === 'video' ? Math.max(0.5, slide.trimEnd - slide.trimStart) : Math.max(1, slide.duration);
      offsets.push({ start: acc, end: acc + dur, duration: dur });
      acc += dur;
    });
    const slideSequenceEnd = acc;
    const totalDuration = slideSequenceEnd + outroSec;

    return {
      introSec,
      outroSec,
      slideSequenceStart: introSec,
      slideSequenceEnd,
      offsets,
      totalDuration: Math.max(0.1, totalDuration)
    };
  }, [
    slides,
    brandingSettings.showIntroAgentCard,
    brandingSettings.introDuration,
    brandingSettings.showOutroAgentCard,
    brandingSettings.outroDuration
  ]);

  // Helper: Get slide and local time from global playhead, with phase ('intro' | 'slide' | 'outro')
  const getSlideAtTime = useCallback((time: number) => {
    if (slides.length === 0) return null;
    const { offsets, introSec, outroSec, slideSequenceEnd, totalDuration } = timelineInfo;
    const clampedTime = Math.min(Math.max(0, time), totalDuration);

    // 1. Intro phase (Full Agent Card Animation)
    if (introSec > 0 && clampedTime < introSec) {
      const progress = clampedTime / introSec;
      return {
        phase: 'intro' as const,
        index: 0,
        slide: slides[0],
        localTime: clampedTime,
        progress,
        isEnding: false
      };
    }

    // 2. Outro phase (Full Agent Card Animation)
    if (outroSec > 0 && clampedTime >= slideSequenceEnd) {
      const localTime = clampedTime - slideSequenceEnd;
      const progress = Math.min(1, localTime / outroSec);
      const lastIdx = slides.length - 1;
      return {
        phase: 'outro' as const,
        index: lastIdx,
        slide: slides[lastIdx],
        localTime,
        progress,
        isEnding: false
      };
    }

    // 3. Slide sequence phase
    for (let i = 0; i < offsets.length; i++) {
      const { start, end } = offsets[i];
      if (clampedTime >= start && clampedTime <= end) {
        const localTime = clampedTime - start;
        const progress = (end > start) ? localTime / (end - start) : 0;
        return {
          phase: 'slide' as const,
          index: i,
          slide: slides[i],
          localTime,
          progress,
          isEnding: clampedTime >= end - transitionDuration
        };
      }
    }

    const lastIdx = slides.length - 1;
    return {
      phase: 'slide' as const,
      index: lastIdx,
      slide: slides[lastIdx],
      localTime: offsets[lastIdx]?.duration || 0,
      progress: 1,
      isEnding: false
    };
  }, [slides, timelineInfo, transitionDuration]);

  // Preload video elements and images
  useEffect(() => {
    slides.forEach((slide) => {
      if (slide.type === 'image') {
        if (!imageCacheRef.current.has(slide.url)) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = slide.url;
          img.onload = () => imageCacheRef.current.set(slide.url, img);
        }
      } else if (slide.type === 'video') {
        let v = videoElementsRef.current.get(slide.url);
        if (!v) {
          v = document.createElement('video');
          v.crossOrigin = 'anonymous';
          v.src = slide.url;
          v.muted = slide.videoMuted ?? false;
          v.playsInline = true;
          v.preload = 'auto';
          videoElementsRef.current.set(slide.url, v);
        }

        v.onloadedmetadata = () => {
          const natDur = v?.duration && !isNaN(v.duration) && v.duration > 0 ? v.duration : 5;
          setSlides((prev) =>
            prev.map((s) => {
              if (s.id === slide.id && (!s.videoDuration || s.videoDuration === 5)) {
                return {
                  ...s,
                  videoDuration: natDur,
                  trimEnd: s.trimEnd === 5 ? natDur : Math.min(s.trimEnd, natDur),
                  duration: s.duration === 5 ? natDur : s.duration
                };
              }
              return s;
            })
          );
        };
      }
    });
  }, [slides]);

  // Dimension calculator based on aspect ratio and resolution
  const getOutputDimensions = (ratio: '16:9' | '9:16' | '1:1', res: '4k' | '2k' | '1080p') => {
    if (res === '4k') {
      switch (ratio) {
        case '16:9': return { width: 3840, height: 2160 };
        case '9:16': return { width: 2160, height: 3840 };
        case '1:1': return { width: 2160, height: 2160 };
      }
    }
    if (res === '2k') {
      switch (ratio) {
        case '16:9': return { width: 2560, height: 1440 };
        case '9:16': return { width: 1440, height: 2560 };
        case '1:1': return { width: 2048, height: 2048 };
      }
    }
    switch (ratio) {
      case '16:9': return { width: 1920, height: 1080 };
      case '9:16': return { width: 1080, height: 1920 };
      case '1:1': return { width: 1080, height: 1080 };
    }
  };

  // Draw a single slide onto canvas with Ken Burns transform or Video Frame
  const drawSlideToCanvas = (
    ctx: CanvasRenderingContext2D,
    slide: SlideshowSlide,
    localProgress: number, // 0 to 1
    cw: number,
    ch: number
  ) => {
    if (slide.type === 'image') {
      let img = imageCacheRef.current.get(slide.url);
      if (!img || !img.complete || img.naturalWidth === 0) {
        img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = slide.url;
        imageCacheRef.current.set(slide.url, img);
      }
      if (!img.complete || img.naturalWidth === 0) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, cw, ch);
        return;
      }

      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const baseScale = Math.max(cw / iw, ch / ih);

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (slide.kenBurnsEnabled) {
        const intensity = slide.kenBurnsIntensity || 1.15;
        let scale = 1.0;
        let shiftX = 0;
        let shiftY = 0;
        const maxShiftX = (cw * (intensity - 1)) / 2;
        const maxShiftY = (ch * (intensity - 1)) / 2;

        switch (slide.kenBurnsPreset) {
          case 'zoom_in':
            scale = 1.0 + (intensity - 1.0) * localProgress;
            break;
          case 'zoom_out':
            scale = intensity - (intensity - 1.0) * localProgress;
            break;
          case 'pan_left_to_right':
            scale = 1.08 + (intensity - 1.08) * 0.5;
            shiftX = -maxShiftX + 2 * maxShiftX * localProgress;
            break;
          case 'pan_right_to_left':
            scale = 1.08 + (intensity - 1.08) * 0.5;
            shiftX = maxShiftX - 2 * maxShiftX * localProgress;
            break;
          case 'pan_top_to_bottom':
            scale = 1.08 + (intensity - 1.08) * 0.5;
            shiftY = -maxShiftY + 2 * maxShiftY * localProgress;
            break;
          case 'pan_bottom_to_top':
            scale = 1.08 + (intensity - 1.08) * 0.5;
            shiftY = maxShiftY - 2 * maxShiftY * localProgress;
            break;
        }

        const renderW = iw * baseScale * scale;
        const renderH = ih * baseScale * scale;
        const renderX = (cw - renderW) / 2 + shiftX;
        const renderY = (ch - renderH) / 2 + shiftY;

        ctx.drawImage(img, renderX, renderY, renderW, renderH);
      } else {
        const renderW = iw * baseScale;
        const renderH = ih * baseScale;
        const renderX = (cw - renderW) / 2;
        const renderY = (ch - renderH) / 2;
        ctx.drawImage(img, renderX, renderY, renderW, renderH);
      }

      ctx.restore();
    } else if (slide.type === 'video') {
      const v = videoElementsRef.current.get(slide.url);
      if (v && v.videoWidth > 0) {
        const vw = v.videoWidth || cw;
        const vh = v.videoHeight || ch;
        const baseScale = Math.max(cw / vw, ch / vh);
        const renderW = vw * baseScale;
        const renderH = vh * baseScale;
        const renderX = (cw - renderW) / 2;
        const renderY = (ch - renderH) / 2;

        ctx.drawImage(v, renderX, renderY, renderW, renderH);
      } else {
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, cw, ch);
      }
    }

    // Optional subtle lower gradient vignette + caption overlay
    if (slide.showCaption && slide.title) {
      ctx.save();
      const grad = ctx.createLinearGradient(0, ch * 0.7, 0, ch);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.75)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, ch * 0.7, cw, ch * 0.3);

      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 12;
      ctx.textAlign = 'center';
      const fontSize = Math.max(22, Math.floor(cw * 0.032));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillText(slide.title.toUpperCase(), cw / 2, ch - fontSize * 1.5);
      ctx.restore();
    }
  };

  // Draw a blurred background from a slide for Intro/Outro Agent Card views
  const drawSlideBlurredBackground = (
    ctx: CanvasRenderingContext2D,
    slide: SlideshowSlide,
    cw: number,
    ch: number
  ) => {
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, cw, ch);

    if (slide.type === 'image') {
      let img = imageCacheRef.current.get(slide.url);
      if (!img || !img.complete) {
        img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = slide.url;
        imageCacheRef.current.set(slide.url, img);
      }
      if (img && img.complete && img.naturalWidth > 0) {
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const baseScale = Math.max(cw / iw, ch / ih);
        const rw = iw * baseScale * 1.06;
        const rh = ih * baseScale * 1.06;
        ctx.filter = 'blur(20px) brightness(0.4)';
        ctx.drawImage(img, (cw - rw) / 2, (ch - rh) / 2, rw, rh);
      }
    } else if (slide.type === 'video') {
      const v = videoElementsRef.current.get(slide.url);
      if (v && v.videoWidth > 0) {
        const vw = v.videoWidth;
        const vh = v.videoHeight;
        const baseScale = Math.max(cw / vw, ch / vh);
        const rw = vw * baseScale * 1.06;
        const rh = vh * baseScale * 1.06;
        ctx.filter = 'blur(20px) brightness(0.4)';
        ctx.drawImage(v, (cw - rw) / 2, (ch - rh) / 2, rw, rh);
      }
    }
    ctx.restore();
  };

  const agentCardData: AgentCardData = useMemo(() => ({
    realtor: brandingSettings.realtor || 'Featured Real Estate Specialist',
    phone: brandingSettings.phone || '(555) 234-5678',
    email: brandingSettings.email || 'realtor@luxuryrealestate.com',
    brokerage: brandingSettings.brokerage || 'Signature Real Estate Group',
    website: brandingSettings.website || 'www.luxuryestates.com',
    realtor2: brandingSettings.realtor2,
    phone2: brandingSettings.phone2,
    email2: brandingSettings.email2,
    brokerage2: brandingSettings.brokerage2,
  }), [brandingSettings]);

  // Render current frame onto preview canvas
  const renderFrameAtTime = useCallback((timeSec: number, isSeeking: boolean = false) => {
    const canvas = canvasRef.current;
    if (!canvas || slides.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;

    const currentInfo = getSlideAtTime(timeSec);
    if (!currentInfo) return;

    const { phase, index, slide, localTime, progress } = currentInfo;

    // Phase 1: Intro Agent Card Animation
    if (phase === 'intro') {
      drawSlideBlurredBackground(ctx, slide, cw, ch);
      if (loadedBranding) {
        drawAgentCardOverlay(
          ctx,
          cw,
          ch,
          loadedBranding,
          agentCardData,
          progress,
          brandingColor,
          'intro'
        );
      }
      return;
    }

    // Phase 2: Outro Agent Card Animation
    if (phase === 'outro') {
      drawSlideBlurredBackground(ctx, slide, cw, ch);
      if (loadedBranding) {
        drawAgentCardOverlay(
          ctx,
          cw,
          ch,
          loadedBranding,
          agentCardData,
          progress,
          brandingColor,
          'outro'
        );
      }
      return;
    }

    // Phase 3: Slide Sequence
    const { offsets } = timelineInfo;
    const currentOffset = offsets[index];

    // Synchronize video element playback position if this slide is video
    if (slide.type === 'video') {
      const v = videoElementsRef.current.get(slide.url);
      if (v) {
        const targetVideoTime = Math.min(
          slide.trimEnd,
          Math.max(slide.trimStart, slide.trimStart + localTime)
        );

        if (!isPlayingRef.current || isSeeking) {
          // Paused or user scrubbing: pause and seek cleanly to precise frame
          if (!v.paused) v.pause();
          if (Math.abs(v.currentTime - targetVideoTime) > 0.04) {
            v.currentTime = targetVideoTime;
          }
        } else {
          // Timeline playing: let video play natively in hardware with zero seeking jitter
          v.muted = slide.videoMuted || isAudioMuted;
          if (v.paused) {
            if (Math.abs(v.currentTime - targetVideoTime) > 0.3) {
              v.currentTime = targetVideoTime;
            }
            v.play().catch(() => {});
          } else {
            // Already playing: only resync if severe drift (> 0.5s)
            if (Math.abs(v.currentTime - targetVideoTime) > 0.5) {
              v.currentTime = targetVideoTime;
            }
          }
        }
      }

      // Pause any other video elements to prevent background resource hogging
      videoElementsRef.current.forEach((otherV, url) => {
        if (url !== slide.url && !otherV.paused) {
          otherV.pause();
        }
      });
    } else {
      // Photo slide active: ensure all videos are paused
      videoElementsRef.current.forEach((v) => {
        if (!v.paused) v.pause();
      });
    }

    // Check if we are in transition zone with the next slide
    const timeRemaining = currentOffset.end - timeSec;
    const isTransitioning =
      transitionStyle !== 'cut' &&
      timeRemaining <= transitionDuration &&
      index < slides.length - 1;

    if (isTransitioning) {
      const nextSlide = slides[index + 1];
      const transProgress = 1.0 - timeRemaining / transitionDuration; // 0 to 1

      // If next slide is video, pre-cue to start so transition is seamless
      if (nextSlide.type === 'video') {
        const nextV = videoElementsRef.current.get(nextSlide.url);
        if (nextV && Math.abs(nextV.currentTime - nextSlide.trimStart) > 0.2) {
          nextV.currentTime = nextSlide.trimStart;
        }
      }

      if (transitionStyle === 'crossfade') {
        // Draw current slide
        ctx.globalAlpha = 1.0;
        drawSlideToCanvas(ctx, slide, progress, cw, ch);

        // Draw next slide with alpha
        ctx.globalAlpha = transProgress;
        drawSlideToCanvas(ctx, nextSlide, 0, cw, ch);
        ctx.globalAlpha = 1.0;
      } else if (transitionStyle === 'dip_black') {
        // Dip to black in middle
        if (transProgress < 0.5) {
          const fadeToBlack = transProgress * 2;
          ctx.globalAlpha = 1.0 - fadeToBlack;
          drawSlideToCanvas(ctx, slide, progress, cw, ch);
          ctx.globalAlpha = 1.0;
        } else {
          const fadeFromBlack = (transProgress - 0.5) * 2;
          ctx.globalAlpha = fadeFromBlack;
          drawSlideToCanvas(ctx, nextSlide, 0, cw, ch);
          ctx.globalAlpha = 1.0;
        }
      }
    } else {
      ctx.globalAlpha = 1.0;
      drawSlideToCanvas(ctx, slide, progress, cw, ch);
    }

    // Overlay 1: Lower Thirds Overlay
    const showLowerThirds = slide.showLowerThirds !== undefined
      ? slide.showLowerThirds
      : brandingSettings.showGlobalLowerThirds;

    if (showLowerThirds) {
      const ltData: LowerThirdsData = {
        mode: slide.lowerThirdsMode || brandingSettings.lowerThirdsMode || 'JUST LISTED',
        price: slide.customPrice || brandingSettings.price || '$1,295,000',
        address: slide.customAddress || brandingSettings.address || '1248 Ocean View Drive',
        unit: slide.customCity ? '' : (slide.customAddress ? '' : brandingSettings.unit),
        city: slide.customCity || brandingSettings.city || 'Newport Beach, CA',
        beds: slide.customBeds || brandingSettings.beds || '4 Beds',
        baths: slide.customBaths || brandingSettings.baths || '3 Baths',
        sqft: slide.customSqft || brandingSettings.sqft || '3,450 Sq Ft'
      };

      drawLowerThirdsOverlay(
        ctx,
        cw,
        ch,
        ltData,
        progress,
        brandingColor,
        aspectRatio
      );
    }

    // Overlay 2: Per-slide Agent Card
    if (slide.showAgentCard && loadedBranding) {
      drawAgentCardOverlay(
        ctx,
        cw,
        ch,
        loadedBranding,
        agentCardData,
        progress,
        brandingColor,
        'slide'
      );
    }
  }, [
    slides,
    timelineInfo,
    getSlideAtTime,
    transitionStyle,
    transitionDuration,
    isAudioMuted,
    brandingSettings,
    loadedBranding,
    agentCardData,
    brandingColor,
    aspectRatio
  ]);

  // Main playback requestAnimationFrame loop
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioElementRef.current) audioElementRef.current.pause();
      videoElementsRef.current.forEach((v) => {
        if (!v.paused) v.pause();
      });
      return;
    }

    if (audioElementRef.current) {
      audioElementRef.current.currentTime = currentTimeRef.current % (audioElementRef.current.duration || 60);
      audioElementRef.current.volume = isAudioMuted ? 0 : audioVolume;
      audioElementRef.current.play().catch(() => {});
    }

    lastTickTimeRef.current = performance.now();

    const loop = (now: number) => {
      if (!isPlayingRef.current) return;
      const dt = (now - lastTickTimeRef.current) / 1000;
      lastTickTimeRef.current = now;

      // Check current active slide
      const currentInfo = getSlideAtTime(currentTimeRef.current);
      let nextTime = currentTimeRef.current;

      if (currentInfo) {
        const { index, slide } = currentInfo;
        const currentOffset = timelineInfo.offsets[index];

        if (slide.type === 'video') {
          const v = videoElementsRef.current.get(slide.url);
          if (v && !v.paused && v.readyState >= 2) {
            // Smoothly drive timeline clock directly from the video's hardware playback
            const actualLocalTime = Math.max(0, v.currentTime - slide.trimStart);
            nextTime = currentOffset.start + actualLocalTime;

            if (v.currentTime >= slide.trimEnd) {
              v.pause();
              nextTime = currentOffset.end;
            }
          } else {
            nextTime += dt;
          }
        } else {
          nextTime += dt;
        }
      } else {
        nextTime += dt;
      }

      if (nextTime >= timelineInfo.totalDuration) {
        setIsPlaying(false);
        isPlayingRef.current = false;
        currentTimeRef.current = 0;
        setCurrentTime(0);
        videoElementsRef.current.forEach((v) => {
          v.pause();
          v.currentTime = 0;
        });
        renderFrameAtTime(0, true);
        return;
      }

      currentTimeRef.current = nextTime;
      setCurrentTime(nextTime);
      renderFrameAtTime(nextTime, false);

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioElementRef.current) audioElementRef.current.pause();
      videoElementsRef.current.forEach((v) => {
        if (!v.paused) v.pause();
      });
    };
  }, [isPlaying, timelineInfo, isAudioMuted, audioVolume, getSlideAtTime, renderFrameAtTime]);

  // Synchronize canvas size to selected aspect ratio (ONLY when aspectRatio changes, preventing canvas wiping)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dims = getOutputDimensions(aspectRatio, '1080p');
    if (canvas.width !== dims.width || canvas.height !== dims.height) {
      canvas.width = dims.width;
      canvas.height = dims.height;
    }
    renderFrameAtTime(currentTimeRef.current, true);
  }, [aspectRatio, renderFrameAtTime]);

  // Automatically update active slide index as playhead moves
  useEffect(() => {
    const info = getSlideAtTime(currentTime);
    if (info && info.index !== activeSlideIndex) {
      setActiveSlideIndex(info.index);
    }
  }, [currentTime, getSlideAtTime, activeSlideIndex]);

  // Audio element volume listener
  useEffect(() => {
    if (audioElementRef.current) {
      audioElementRef.current.volume = isAudioMuted ? 0 : audioVolume;
    }
  }, [audioVolume, isAudioMuted]);

  // Jump to specific slide
  const handleSelectSlide = (idx: number) => {
    setActiveSlideIndex(idx);
    const { offsets } = timelineInfo;
    if (offsets[idx]) {
      const targetTime = offsets[idx].start;
      currentTimeRef.current = targetTime;
      setCurrentTime(targetTime);
      renderFrameAtTime(targetTime, true);
    }
  };

  // Reordering helpers
  const moveSlide = (index: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= slides.length) return;
    const newSlides = [...slides];
    const temp = newSlides[index];
    newSlides[index] = newSlides[targetIdx];
    newSlides[targetIdx] = temp;
    setSlides(newSlides);
    setActiveSlideIndex(targetIdx);
  };

  const removeSlide = (index: number) => {
    if (slides.length <= 1) return;
    const newSlides = slides.filter((_, i) => i !== index);
    setSlides(newSlides);
    setActiveSlideIndex(Math.max(0, index - 1));
  };

  const duplicateSlide = (index: number) => {
    const slideToCopy = slides[index];
    const newSlide: SlideshowSlide = {
      ...slideToCopy,
      id: `slide-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    };
    const newSlides = [...slides];
    newSlides.splice(index + 1, 0, newSlide);
    setSlides(newSlides);
    setActiveSlideIndex(index + 1);
  };

  // Add media asset into timeline
  const handleAddMedia = (asset: { name: string; url: string; type: 'image' | 'video'; sourceId?: string }) => {
    let initialDuration = asset.type === 'video' ? 5 : 4;
    const cachedV = videoElementsRef.current.get(asset.url);
    if (cachedV && cachedV.duration && !isNaN(cachedV.duration) && cachedV.duration > 0) {
      initialDuration = cachedV.duration;
    }

    const newSlide: SlideshowSlide = {
      id: `slide-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sourceId: asset.sourceId,
      name: asset.name,
      type: asset.type,
      url: asset.url,
      duration: initialDuration,
      videoDuration: asset.type === 'video' ? initialDuration : undefined,
      trimStart: 0,
      trimEnd: initialDuration,
      videoMuted: asset.type === 'video' ? false : true,
      kenBurnsEnabled: asset.type === 'image',
      kenBurnsPreset: 'zoom_in',
      kenBurnsIntensity: 1.16,
      title: asset.name.split(' (')[0],
      showCaption: false
    };

    setSlides((prev) => [...prev, newSlide]);
    setActiveSlideIndex(slides.length);
  };

  // File Upload directly to slideshow
  const handleDirectUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file: File) => {
      const isVid = file.type.startsWith('video/');
      if (isVid) {
        const url = URL.createObjectURL(file);
        handleAddMedia({
          name: file.name,
          url,
          type: 'video',
          sourceId: `upload-${Date.now()}`
        });
      } else {
        const reader = new FileReader();
        reader.onload = (loadEvt) => {
          const url = loadEvt.target?.result as string;
          handleAddMedia({
            name: file.name,
            url,
            type: 'image',
            sourceId: `upload-${Date.now()}`
          });
        };
        reader.readAsDataURL(file);
      }
    });
  };

  // Trimmer Local Controls for active slide
  const activeSlide = slides[activeSlideIndex] || null;

  const handleSetTrimIn = () => {
    if (!activeSlide || activeSlide.type !== 'video' || !trimmerVideoRef.current) return;
    const cur = trimmerVideoRef.current.currentTime;
    const safeIn = Math.max(0, Math.min(cur, activeSlide.trimEnd - 0.5));
    setSlides((prev) =>
      prev.map((s, i) => (i === activeSlideIndex ? { ...s, trimStart: safeIn } : s))
    );
  };

  const handleSetTrimOut = () => {
    if (!activeSlide || activeSlide.type !== 'video' || !trimmerVideoRef.current) return;
    const cur = trimmerVideoRef.current.currentTime;
    const safeOut = Math.max(activeSlide.trimStart + 0.5, cur);
    setSlides((prev) =>
      prev.map((s, i) => (i === activeSlideIndex ? { ...s, trimEnd: safeOut } : s))
    );
  };

  const handleResetTrim = () => {
    if (!activeSlide || activeSlide.type !== 'video' || !trimmerVideoRef.current) return;
    const maxDur = trimmerVideoRef.current.duration || activeSlide.videoDuration || 6;
    setSlides((prev) =>
      prev.map((s, i) =>
        i === activeSlideIndex
          ? { ...s, trimStart: 0, trimEnd: maxDur }
          : s
      )
    );
  };

  // EXPORT ENGINE (2K / 1080p, MediaRecorder, Audio Destination, $0 Cost)
  const handleExportVideo = async () => {
    if (slides.length === 0 || isExporting) return;
    setIsPlaying(false);
    setIsExporting(true);
    setExportProgress(0);
    setExportStatusText('Initializing 2K/HD Render Engine...');

    try {
      const dims = getOutputDimensions(aspectRatio, exportResolution);
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = dims.width;
      offscreenCanvas.height = dims.height;
      const offCtx = offscreenCanvas.getContext('2d');
      if (!offCtx) throw new Error('Could not create offscreen render canvas');

      // Audio setup
      let audioCtx: AudioContext | null = null;
      let audioDest: MediaStreamAudioDestinationNode | null = null;
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx && activeAudioTrack.url && !isAudioMuted) {
          audioCtx = new AudioCtx();
          audioDest = audioCtx.createMediaStreamDestination();
          const response = await fetch(activeAudioTrack.url);
          const arrayBuffer = await response.arrayBuffer();
          const decodedAudio = await audioCtx.decodeAudioData(arrayBuffer);
          const source = audioCtx.createBufferSource();
          source.buffer = decodedAudio;
          source.loop = true;
          const gainNode = audioCtx.createGain();
          gainNode.gain.value = audioVolume;
          source.connect(gainNode);
          gainNode.connect(audioDest);
          source.start(0);
        }
      } catch (audioErr) {
        console.warn('Background audio could not be muxed into export stream:', audioErr);
      }

      const stream = offscreenCanvas.captureStream(30);
      if (audioDest && audioDest.stream.getAudioTracks().length > 0) {
        stream.addTrack(audioDest.stream.getAudioTracks()[0]);
      }

      const mimeTypeOptions = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=h264,aac',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm'
      ];
      const selectedMime = mimeTypeOptions.find((t) => MediaRecorder.isTypeSupported(t)) || 'video/webm';
      const targetBitrate = exportResolution === '4k' ? 45000000 : exportResolution === '2k' ? 22000000 : 10000000;

      const recorder = new MediaRecorder(stream, {
        mimeType: selectedMime,
        videoBitsPerSecond: targetBitrate
      });

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const renderPromise = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: selectedMime });
          resolve(blob);
        };
        recorder.onerror = (e) => reject(e);
      });

      recorder.start();

      // Step through the total timeline in 30fps frames
      const fps = 30;
      const totalSeconds = timelineInfo.totalDuration;
      const totalFrames = Math.floor(totalSeconds * fps);

      for (let f = 0; f <= totalFrames; f++) {
        const timeSec = f / fps;
        const progressPct = Math.min(100, Math.round((f / totalFrames) * 100));
        setExportProgress(progressPct);
        setExportStatusText(`Rendering frame ${f} of ${totalFrames} (${progressPct}%)...`);

        const info = getSlideAtTime(timeSec);
        if (info) {
          const { phase, index, slide, localTime, progress } = info;

          if (phase === 'intro') {
            drawSlideBlurredBackground(offCtx, slide, dims.width, dims.height);
            if (loadedBranding) {
              drawAgentCardOverlay(
                offCtx,
                dims.width,
                dims.height,
                loadedBranding,
                agentCardData,
                progress,
                brandingColor,
                'intro'
              );
            }
          } else if (phase === 'outro') {
            drawSlideBlurredBackground(offCtx, slide, dims.width, dims.height);
            if (loadedBranding) {
              drawAgentCardOverlay(
                offCtx,
                dims.width,
                dims.height,
                loadedBranding,
                agentCardData,
                progress,
                brandingColor,
                'outro'
              );
            }
          } else {
            const currentOffset = timelineInfo.offsets[index];

            // Synchronize video element position during render
            if (slide.type === 'video') {
              const v = videoElementsRef.current.get(slide.url);
              if (v) {
                const targetTime = Math.min(slide.trimEnd, Math.max(slide.trimStart, slide.trimStart + localTime));
                if (Math.abs(v.currentTime - targetTime) > 0.02) {
                  v.currentTime = targetTime;
                  await new Promise<void>((resolve) => {
                    if (!v.seeking && v.readyState >= 2) {
                      resolve();
                      return;
                    }
                    const onSeeked = () => {
                      v.removeEventListener('seeked', onSeeked);
                      resolve();
                    };
                    v.addEventListener('seeked', onSeeked);
                    setTimeout(() => {
                      v.removeEventListener('seeked', onSeeked);
                      resolve();
                    }, 40);
                  });
                }
              }
            }

            const timeRemaining = currentOffset.end - timeSec;
            const isTransitioning =
              transitionStyle !== 'cut' &&
              timeRemaining <= transitionDuration &&
              index < slides.length - 1;

            if (isTransitioning) {
              const nextSlide = slides[index + 1];
              const transProgress = 1.0 - timeRemaining / transitionDuration;

              if (transitionStyle === 'crossfade') {
                offCtx.globalAlpha = 1.0;
                drawSlideToCanvas(offCtx, slide, progress, dims.width, dims.height);
                offCtx.globalAlpha = transProgress;
                drawSlideToCanvas(offCtx, nextSlide, 0, dims.width, dims.height);
                offCtx.globalAlpha = 1.0;
              } else if (transitionStyle === 'dip_black') {
                if (transProgress < 0.5) {
                  const fade = transProgress * 2;
                  offCtx.globalAlpha = 1.0 - fade;
                  drawSlideToCanvas(offCtx, slide, progress, dims.width, dims.height);
                  offCtx.globalAlpha = 1.0;
                } else {
                  const fade = (transProgress - 0.5) * 2;
                  offCtx.globalAlpha = fade;
                  drawSlideToCanvas(offCtx, nextSlide, 0, dims.width, dims.height);
                  offCtx.globalAlpha = 1.0;
                }
              }
            } else {
              offCtx.globalAlpha = 1.0;
              drawSlideToCanvas(offCtx, slide, progress, dims.width, dims.height);
            }

            // Overlay 1: Lower Thirds Overlay in export
            const showLowerThirds = slide.showLowerThirds !== undefined
              ? slide.showLowerThirds
              : brandingSettings.showGlobalLowerThirds;

            if (showLowerThirds) {
              const ltData: LowerThirdsData = {
                mode: slide.lowerThirdsMode || brandingSettings.lowerThirdsMode || 'JUST LISTED',
                price: slide.customPrice || brandingSettings.price || '$1,295,000',
                address: slide.customAddress || brandingSettings.address || '1248 Ocean View Drive',
                unit: slide.customCity ? '' : (slide.customAddress ? '' : brandingSettings.unit),
                city: slide.customCity || brandingSettings.city || 'Newport Beach, CA',
                beds: slide.customBeds || brandingSettings.beds || '4 Beds',
                baths: slide.customBaths || brandingSettings.baths || '3 Baths',
                sqft: slide.customSqft || brandingSettings.sqft || '3,450 Sq Ft'
              };

              drawLowerThirdsOverlay(
                offCtx,
                dims.width,
                dims.height,
                ltData,
                progress,
                brandingColor,
                aspectRatio
              );
            }

            // Overlay 2: Per-slide Agent Card in export
            if (slide.showAgentCard && loadedBranding) {
              drawAgentCardOverlay(
                offCtx,
                dims.width,
                dims.height,
                loadedBranding,
                agentCardData,
                progress,
                brandingColor,
                'slide'
              );
            }
          }
        }

        // 33ms delay per frame to keep recorder synced
        await new Promise((r) => setTimeout(r, 28));
      }

      setExportStatusText('Finalizing video container and audio encoding...');
      recorder.stop();
      if (audioCtx) {
        try { audioCtx.close(); } catch (e) {}
      }

      const finishedBlob = await renderPromise;
      const downloadUrl = URL.createObjectURL(finishedBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const ext = selectedMime.includes('mp4') ? 'mp4' : 'webm';
      a.download = `property_slideshow_${exportResolution}_${aspectRatio.replace(':', 'x')}_${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setExportStatusText('Export complete! Video saved.');
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
        setExportStatusText('');
      }, 2000);
    } catch (err: any) {
      console.error('Export failed:', err);
      alert(`Export error: ${err?.message || 'Failed to render slideshow video'}`);
      setIsExporting(false);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const tenths = Math.floor((sec % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${tenths}`;
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fade-in">
      {/* Hidden Audio Player for Preview */}
      <audio
        ref={audioElementRef}
        src={activeAudioTrack.url}
        preload="auto"
        loop
        className="hidden"
      />

      {/* HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-5 rounded-3xl border border-white/10 shadow-2xl">
        <div className="flex items-center gap-4">
          {onBackToStudio && (
            <button
              onClick={onBackToStudio}
              className="p-2.5 rounded-2xl bg-slate-900 border border-white/10 text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              title="Return to Studio"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
          )}
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">
                Cinematic Slideshow Builder
              </h1>
              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                4K / 2K Master
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              Combine generated videos & staged images with Ken Burns pan & zoom, video in/out trimming, and background audio.
            </p>
          </div>
        </div>

        {/* Global Format & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Aspect Ratio Selector */}
          <div className="flex bg-slate-900/80 p-1 rounded-2xl border border-white/5">
            <button
              onClick={() => setAspectRatio('16:9')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer ${
                aspectRatio === '16:9' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
              }`}
            >
              16:9 Wide
            </button>
            <button
              onClick={() => setAspectRatio('9:16')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer ${
                aspectRatio === '9:16' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
              }`}
            >
              9:16 Reel
            </button>
            <button
              onClick={() => setAspectRatio('1:1')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer ${
                aspectRatio === '1:1' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
              }`}
            >
              1:1 Square
            </button>
          </div>

          {/* Resolution Selector */}
          <div className="flex bg-slate-900/80 p-1 rounded-2xl border border-white/5">
            <button
              onClick={() => setExportResolution('4k')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer flex items-center gap-1 ${
                exportResolution === '4k' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>4K Ultra HD</span>
              <span className="text-[8px] opacity-75">($0)</span>
            </button>
            <button
              onClick={() => setExportResolution('2k')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer flex items-center gap-1 ${
                exportResolution === '2k' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>2K Master</span>
              <span className="text-[8px] opacity-75">($0)</span>
            </button>
            <button
              onClick={() => setExportResolution('1080p')}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer ${
                exportResolution === '1080p' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'
              }`}
            >
              1080p HD
            </button>
          </div>

          {/* Import Media Button */}
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 border border-white/10 transition-all cursor-pointer shadow-md"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-orange-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Import Media
          </button>

          {/* Export Video Button */}
          <button
            disabled={isExporting || slides.length === 0}
            onClick={handleExportVideo}
            className="px-5 py-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-orange-500/20 transition-all cursor-pointer disabled:opacity-40"
          >
            {isExporting ? (
              <>
                <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exporting {exportProgress}%
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Export {exportResolution.toUpperCase()}
              </>
            )}
          </button>
        </div>
      </div>

      {/* EXPORT PROGRESS BANNER */}
      {isExporting && (
        <div className="glass-panel p-4 rounded-2xl border border-orange-500/30 bg-orange-500/10 flex flex-col md:flex-row items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-orange-500 animate-ping"></div>
            <div>
              <p className="text-xs font-black uppercase text-orange-400 tracking-wider">
                Rendering {exportResolution.toUpperCase()} Slideshow ({aspectRatio})
              </p>
              <p className="text-[11px] text-slate-300 font-mono mt-0.5">{exportStatusText}</p>
            </div>
          </div>
          <div className="w-full md:w-64 bg-slate-900 rounded-full h-3 overflow-hidden border border-white/10">
            <div
              className="bg-gradient-to-r from-orange-500 to-amber-400 h-full transition-all duration-150"
              style={{ width: `${exportProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* MAIN WORKSPACE GRID: PREVIEW PLAYER (LEFT) & INSPECTOR / CONTROLS (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: LIVE CANVAS PREVIEW & SCRUBBER */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="glass-panel p-4 rounded-3xl border border-white/10 flex flex-col items-center justify-center bg-slate-950/70 shadow-2xl relative overflow-hidden min-h-[440px]">
            {/* Aspect Container */}
            <div
              className={`relative overflow-hidden rounded-2xl shadow-2xl bg-black flex items-center justify-center transition-all ${
                aspectRatio === '16:9'
                  ? 'w-full max-w-[620px] aspect-video'
                  : aspectRatio === '9:16'
                  ? 'w-[280px] sm:w-[320px] aspect-[9/16]'
                  : 'w-[360px] sm:w-[420px] aspect-square'
              }`}
            >
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain cursor-pointer"
                onClick={() => setIsPlaying(!isPlaying)}
              />

              {/* Play Overlay Button on hover / pause */}
              {!isPlaying && slides.length > 0 && (
                <button
                  onClick={() => setIsPlaying(true)}
                  className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-orange-500/90 text-white flex items-center justify-center shadow-2xl hover:scale-110 transition-transform cursor-pointer backdrop-blur-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-8 h-8 translate-x-0.5">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              )}

              {/* Empty Sequence State Overlay */}
              {slides.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 backdrop-blur-sm z-10">
                  <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">No Slides Added Yet</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Select photos or videos in the Studio and click <strong className="text-orange-400">Slideshow</strong>, or import media below.
                  </p>
                  <div className="flex items-center gap-2 mt-4">
                    {items.some((i) => i.selected) && (
                      <button
                        onClick={() => {
                          const selected = items.filter((i) => i.selected).sort((a, b) => (a.selectionOrder || 0) - (b.selectionOrder || 0));
                          const newSlides = selected.map((item, idx) => convertItemToSlide(item, idx));
                          setSlides(newSlides);
                          setActiveSlideIndex(0);
                        }}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-black uppercase tracking-wider shadow-lg transition-all cursor-pointer"
                      >
                        Add Selected ({items.filter((i) => i.selected).length})
                      </button>
                    )}
                    <button
                      onClick={() => setShowImportModal(true)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider border border-white/10 transition-all cursor-pointer"
                    >
                      Import Media
                    </button>
                  </div>
                </div>
              )}

              {/* Live Info Pill */}
              {slides.length > 0 && (
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>Slide #{activeSlideIndex + 1} / {slides.length}</span>
                  {activeSlide && (
                    <span className="text-slate-400">• {activeSlide.type.toUpperCase()}</span>
                  )}
                </div>
              )}
            </div>

            {/* SCRUBBER & PLAYBACK CONTROLS */}
            <div className="w-full max-w-[620px] mt-4 space-y-2">
              {/* Scrub timeline slider */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-slate-400 shrink-0">
                  {formatTime(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, timelineInfo.totalDuration)}
                  step={0.05}
                  value={currentTime}
                  onChange={(e) => {
                    const t = parseFloat(e.target.value);
                    currentTimeRef.current = t;
                    setCurrentTime(t);
                    renderFrameAtTime(t, true);
                  }}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
                <span className="text-[11px] font-mono text-slate-400 shrink-0">
                  {formatTime(timelineInfo.totalDuration)}
                </span>
              </div>

              {/* Bottom Playback bar */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (isPlaying) {
                        setIsPlaying(false);
                        videoElementsRef.current.forEach((v) => {
                          if (!v.paused) v.pause();
                        });
                      } else {
                        setIsPlaying(true);
                      }
                    }}
                    className="p-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition-all cursor-pointer shadow-md"
                  >
                    {isPlaying ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setIsPlaying(false);
                      videoElementsRef.current.forEach((v) => {
                        v.pause();
                        v.currentTime = 0;
                      });
                      currentTimeRef.current = 0;
                      setCurrentTime(0);
                      renderFrameAtTime(0, true);
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
                    title="Restart from beginning"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                  </button>
                </div>

                {/* Audio track selector & volume */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsAudioMuted(!isAudioMuted)}
                    className={`p-2 rounded-xl transition-all cursor-pointer ${
                      isAudioMuted ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                    title={isAudioMuted ? 'Unmute Audio' : 'Mute Audio'}
                  >
                    {isAudioMuted ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.414 0-.75-.336-.75-.75V10.5c0-.414.336-.75.75-.75h2.24z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.414 0-.75-.336-.75-.75V10.5c0-.414.336-.75.75-.75h2.24z" />
                      </svg>
                    )}
                  </button>

                  <select
                    value={selectedAudioIdx}
                    onChange={(e) => setSelectedAudioIdx(parseInt(e.target.value, 10))}
                    className="bg-slate-900 border border-white/10 text-slate-300 text-[11px] font-bold rounded-xl px-2.5 py-1.5 outline-none max-w-[180px] truncate"
                  >
                    {PROFESSIONAL_AUDIO_LIBRARY.map((track, i) => (
                      <option key={i} value={i}>
                        🎵 {track.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SLIDE INSPECTOR (TRIMMER FOR VIDEO, KEN BURNS FOR IMAGES) */}
        <div className="lg:col-span-5 space-y-4">
          {activeSlide ? (
            <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-5 bg-slate-900/60 shadow-xl">
              {/* Header Info */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                    activeSlide.type === 'video'
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {activeSlide.type === 'video' ? 'Video Clip' : 'Still Photo'}
                  </span>
                  <span className="text-xs font-bold text-white truncate max-w-[200px]">
                    {activeSlide.name}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => duplicateSlide(activeSlideIndex)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
                    title="Duplicate Slide"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                    </svg>
                  </button>
                  <button
                    onClick={() => removeSlide(activeSlideIndex)}
                    disabled={slides.length <= 1}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all cursor-pointer disabled:opacity-30"
                    title="Remove Slide"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* SPECIFIC CONTROLS: IF VIDEO -> VIDEO TRIMMER */}
              {activeSlide.type === 'video' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.848 8.25l1.536.887M12.152 8.25l-1.536.887m0 0l-1.536.887M10.616 9.137l1.536.887M18 12a6 6 0 11-12 0 6 6 0 0112 0z" />
                      </svg>
                      Video Trimmer (In / Out Points)
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 font-bold">
                      Trimmed: {(activeSlide.trimEnd - activeSlide.trimStart).toFixed(1)}s
                    </span>
                  </div>

                  {/* Trimmer Video Preview Player */}
                  <div className="relative rounded-xl overflow-hidden bg-black border border-white/10 aspect-video flex items-center justify-center">
                    <video
                      ref={trimmerVideoRef}
                      src={activeSlide.url}
                      playsInline
                      muted={activeSlide.videoMuted}
                      onTimeUpdate={() => {
                        if (trimmerVideoRef.current) {
                          setTrimmerCurrentTime(trimmerVideoRef.current.currentTime);
                          if (trimmerVideoRef.current.currentTime >= activeSlide.trimEnd) {
                            trimmerVideoRef.current.pause();
                            setIsTrimmerPlaying(false);
                            trimmerVideoRef.current.currentTime = activeSlide.trimStart;
                          }
                        }
                      }}
                      className="w-full h-full object-contain"
                    />

                    <button
                      onClick={() => {
                        if (!trimmerVideoRef.current) return;
                        if (isTrimmerPlaying) {
                          trimmerVideoRef.current.pause();
                          setIsTrimmerPlaying(false);
                        } else {
                          trimmerVideoRef.current.currentTime = activeSlide.trimStart;
                          trimmerVideoRef.current.play();
                          setIsTrimmerPlaying(true);
                        }
                      }}
                      className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-black/70 hover:bg-black text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm border border-white/10 flex items-center gap-1 cursor-pointer"
                    >
                      {isTrimmerPlaying ? 'Pause' : 'Play Trim'}
                    </button>

                    <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-mono text-slate-300 border border-white/10">
                      {trimmerCurrentTime.toFixed(1)}s
                    </div>
                  </div>

                  {/* Dual Trim Sliders */}
                  <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-white/5">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                      <span>Start Point (In): {activeSlide.trimStart.toFixed(1)}s</span>
                      <span>End Point (Out): {activeSlide.trimEnd.toFixed(1)}s</span>
                    </div>

                    <div className="space-y-1.5">
                      <input
                        type="range"
                        min={0}
                        max={activeSlide.videoDuration || 10}
                        step={0.1}
                        value={activeSlide.trimStart}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (val < activeSlide.trimEnd) {
                            setSlides((prev) =>
                              prev.map((s, i) =>
                                i === activeSlideIndex ? { ...s, trimStart: val } : s
                              )
                            );
                            if (trimmerVideoRef.current) trimmerVideoRef.current.currentTime = val;
                          }
                        }}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
                      />
                      <input
                        type="range"
                        min={0}
                        max={activeSlide.videoDuration || 10}
                        step={0.1}
                        value={activeSlide.trimEnd}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (val > activeSlide.trimStart) {
                            setSlides((prev) =>
                              prev.map((s, i) =>
                                i === activeSlideIndex ? { ...s, trimEnd: val } : s
                              )
                            );
                            if (trimmerVideoRef.current) trimmerVideoRef.current.currentTime = val;
                          }
                        }}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
                      />
                    </div>

                    {/* Quick In/Out buttons */}
                    <div className="grid grid-cols-3 gap-2 pt-2">
                      <button
                        onClick={handleSetTrimIn}
                        className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[9px] font-black uppercase tracking-wider text-slate-300 hover:text-white border border-white/5 transition-all cursor-pointer"
                      >
                        Set Start [In]
                      </button>
                      <button
                        onClick={handleSetTrimOut}
                        className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[9px] font-black uppercase tracking-wider text-slate-300 hover:text-white border border-white/5 transition-all cursor-pointer"
                      >
                        Set End [Out]
                      </button>
                      <button
                        onClick={handleResetTrim}
                        className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[9px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-200 border border-white/5 transition-all cursor-pointer"
                      >
                        Reset All
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SPECIFIC CONTROLS: IF IMAGE -> KEN BURNS PAN & ZOOM */}
              {activeSlide.type === 'image' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                      </svg>
                      Ken Burns Pan & Zoom
                    </span>

                    {/* Enable / Disable Toggle */}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeSlide.kenBurnsEnabled}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSlides((prev) =>
                            prev.map((s, i) =>
                              i === activeSlideIndex ? { ...s, kenBurnsEnabled: checked } : s
                            )
                          );
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  {activeSlide.kenBurnsEnabled && (
                    <div className="space-y-3 bg-slate-950/60 p-3 rounded-xl border border-white/5">
                      {/* Motion Direction Presets */}
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                          Motion Preset
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: 'zoom_in', label: '🔍 Zoom In' },
                            { id: 'zoom_out', label: '🔎 Zoom Out' },
                            { id: 'pan_left_to_right', label: '➡️ Pan Right' },
                            { id: 'pan_right_to_left', label: '⬅️ Pan Left' },
                            { id: 'pan_top_to_bottom', label: '⬇️ Pan Down' },
                            { id: 'pan_bottom_to_top', label: '⬆️ Pan Up' }
                          ].map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSlides((prev) =>
                                  prev.map((s, i) =>
                                    i === activeSlideIndex
                                      ? { ...s, kenBurnsPreset: p.id as KenBurnsPreset }
                                      : s
                                  )
                                );
                                renderFrameAtTime(currentTime);
                              }}
                              className={`py-2 px-2.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider text-left transition-all cursor-pointer ${
                                activeSlide.kenBurnsPreset === p.id
                                  ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-md'
                                  : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Zoom Intensity Slider */}
                      <div>
                        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                          <span>Zoom Intensity</span>
                          <span>{((activeSlide.kenBurnsIntensity - 1) * 100).toFixed(0)}% Depth</span>
                        </div>
                        <input
                          type="range"
                          min={1.08}
                          max={1.30}
                          step={0.02}
                          value={activeSlide.kenBurnsIntensity}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setSlides((prev) =>
                              prev.map((s, i) =>
                                i === activeSlideIndex ? { ...s, kenBurnsIntensity: val } : s
                              )
                            );
                            renderFrameAtTime(currentTime);
                          }}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                        />
                      </div>
                    </div>
                  )}

                  {/* Still Slide Display Duration Slider */}
                  <div className="space-y-1 bg-slate-950/60 p-3 rounded-xl border border-white/5">
                    <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
                      <span>Slide Duration</span>
                      <span className="font-mono">{activeSlide.duration.toFixed(1)}s</span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={10}
                      step={0.5}
                      value={activeSlide.duration}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setSlides((prev) =>
                          prev.map((s, i) =>
                            i === activeSlideIndex ? { ...s, duration: val } : s
                          )
                        );
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                  </div>
                </div>
              )}

              {/* TRANSITION STYLE & PACING */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
                  Transition to Next Slide
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'crossfade', label: '✨ Crossfade' },
                    { id: 'dip_black', label: '🌑 Dip Black' },
                    { id: 'cut', label: '⚡ Hard Cut' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTransitionStyle(t.id as SlideTransition)}
                      className={`py-2 px-2 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        transitionStyle === t.id
                          ? 'bg-orange-500 border-orange-400 text-white shadow-md'
                          : 'bg-slate-950 border-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel p-8 rounded-3xl border border-white/10 text-center text-slate-500 flex flex-col items-center justify-center min-h-[300px]">
              <p className="text-xs font-bold uppercase tracking-wider">No Slide Selected</p>
              <p className="text-[11px] text-slate-400 mt-1">Select a slide from the storyboard below to customize its settings.</p>
            </div>
          )}
        </div>
      </div>

      {/* STORYBOARD / TIMELINE STRIP */}
      <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-3 bg-slate-950/70 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase text-white tracking-wider">
              Storyboard & Sequence Timeline
            </span>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full border border-white/5">
              {slides.length} slides • Total {timelineInfo.totalDuration.toFixed(1)}s
            </span>
          </div>

          <button
            onClick={() => setShowImportModal(true)}
            className="px-3 py-1 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Slide
          </button>
        </div>

        {/* Horizontal Slides Strip */}
        <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin">
          {slides.map((slide, idx) => {
            const isActive = idx === activeSlideIndex;
            const slideDur = slide.type === 'video' ? slide.trimEnd - slide.trimStart : slide.duration;
            return (
              <div
                key={slide.id}
                onClick={() => handleSelectSlide(idx)}
                className={`group relative shrink-0 w-36 sm:w-44 rounded-2xl overflow-hidden border transition-all cursor-pointer ${
                  isActive
                    ? 'border-orange-500 ring-2 ring-orange-500/50 shadow-xl bg-slate-900 scale-102'
                    : 'border-white/10 bg-slate-950/80 hover:border-white/20'
                }`}
              >
                {/* Thumbnail */}
                <div className="aspect-video w-full bg-black relative overflow-hidden">
                  {slide.type === 'image' ? (
                    <img src={slide.url} alt={slide.name} className="w-full h-full object-cover" />
                  ) : (
                    <video src={slide.url} className="w-full h-full object-cover" />
                  )}

                  {/* Slide number badge */}
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md text-[9px] font-mono font-bold text-white border border-white/10">
                    #{idx + 1}
                  </span>

                  {/* Type badge */}
                  <span className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider backdrop-blur-md ${
                    slide.type === 'video'
                      ? 'bg-purple-500/80 text-white'
                      : 'bg-emerald-500/80 text-white'
                  }`}>
                    {slide.type === 'video' ? 'Video' : 'Photo'}
                  </span>

                  {/* Duration pill */}
                  <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-mono font-bold text-orange-400 border border-white/10">
                    {slideDur.toFixed(1)}s
                  </span>
                </div>

                {/* Info and Reorder Row */}
                <div className="p-2 flex items-center justify-between gap-1 text-[10px]">
                  <span className="text-slate-300 font-bold truncate max-w-[80px]">
                    {slide.name}
                  </span>

                  <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                    <button
                      disabled={idx === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveSlide(idx, 'left');
                      }}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                      title="Move Left"
                    >
                      ◀
                    </button>
                    <button
                      disabled={idx === slides.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveSlide(idx, 'right');
                      }}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                      title="Move Right"
                    >
                      ▶
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL: IMPORT ASSETS FROM SESSION / UPLOAD */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-3xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl p-6 overflow-hidden max-h-[85vh] flex flex-col space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">
                  Import Media into Slideshow
                </h3>
                <p className="text-xs text-slate-400">
                  Select generated AI videos, virtually staged photos, or upload files directly.
                </p>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-white/5 pb-2">
              <button
                onClick={() => setImportTab('selected')}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                  importTab === 'selected'
                    ? 'bg-orange-500 text-white shadow-lg'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>Selected in Studio</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  importTab === 'selected' ? 'bg-black/30 text-white' : 'bg-slate-700 text-slate-300'
                }`}>
                  {allSessionAssets.selectedStudioItems.length}
                </span>
              </button>
              <button
                onClick={() => setImportTab('videos')}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer ${
                  importTab === 'videos'
                    ? 'bg-orange-500 text-white shadow-lg'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Generated Videos ({allSessionAssets.videos.length})
              </button>
              <button
                onClick={() => setImportTab('images')}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer ${
                  importTab === 'images'
                    ? 'bg-orange-500 text-white shadow-lg'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Generated Images ({allSessionAssets.generatedImages.length})
              </button>
              <button
                onClick={() => setImportTab('originals')}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer ${
                  importTab === 'originals'
                    ? 'bg-orange-500 text-white shadow-lg'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Original Photos ({allSessionAssets.originals.length})
              </button>
              <button
                onClick={() => setImportTab('upload')}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer ${
                  importTab === 'upload'
                    ? 'bg-orange-500 text-white shadow-lg'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Upload File
              </button>
            </div>

            {/* Asset Grid */}
            <div className="overflow-y-auto flex-1 pr-1">
              {importTab === 'selected' && (
                <div>
                  {allSessionAssets.selectedStudioItems.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <p className="text-xs font-bold uppercase">No Items Selected in Studio</p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                        In the Studio tab, select photos or videos using the checkbox in the upper corner of each card, then click &quot;Slideshow&quot; or return here.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-2xl border border-white/5">
                        <div className="text-xs text-slate-300">
                          <strong>{allSessionAssets.selectedStudioItems.length} items selected in Studio</strong>
                          <span className="text-[11px] text-slate-400 ml-1.5">• Videos import as videos, images import as images</span>
                        </div>
                        <button
                          onClick={() => {
                            const newSlides = allSessionAssets.selectedStudioItems.map((s) => s.slide);
                            setSlides((prev) => [...prev, ...newSlides]);
                            setShowImportModal(false);
                          }}
                          className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-[11px] font-black uppercase tracking-wider shadow-md transition-all cursor-pointer"
                        >
                          + Add All Selected ({allSessionAssets.selectedStudioItems.length})
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {allSessionAssets.selectedStudioItems.map(({ item, slide }) => (
                          <div
                            key={`sel-${item.id}`}
                            className="group relative rounded-xl overflow-hidden border border-white/10 bg-black aspect-video hover:border-orange-500 transition-all cursor-pointer"
                            onClick={() => {
                              setSlides((prev) => [...prev, slide]);
                              setShowImportModal(false);
                            }}
                          >
                            {slide.type === 'video' ? (
                              <video src={slide.url} className="w-full h-full object-cover" />
                            ) : (
                              <img src={slide.url} alt={slide.name} className="w-full h-full object-cover" />
                            )}
                            {/* Type Badge */}
                            <div className="absolute top-2 left-2 z-10">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                slide.type === 'video'
                                  ? 'bg-purple-600/90 text-white shadow'
                                  : 'bg-emerald-600/90 text-white shadow'
                              }`}>
                                {slide.type === 'video' ? '🎬 Video' : '📷 Image'}
                              </span>
                            </div>
                            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                              <span className="px-3 py-1 rounded-lg bg-orange-500 text-white text-[10px] font-black uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                                + Add to Slideshow
                              </span>
                            </div>
                            <div className="absolute bottom-1 left-1 right-1 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md text-[9px] text-white truncate font-bold">
                              {slide.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {importTab === 'videos' && (
                <div>
                  {allSessionAssets.videos.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <p className="text-xs font-bold uppercase">No Generated Videos Yet</p>
                      <p className="text-[11px] text-slate-400 mt-1">Run Dawn to Dusk, Furniture Build, Sun Morph, or Custom Video in the Studio tab first.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {allSessionAssets.videos.map((vid) => (
                        <div
                          key={vid.id}
                          className="group relative rounded-xl overflow-hidden border border-white/10 bg-black aspect-video hover:border-orange-500 transition-all cursor-pointer"
                          onClick={() => {
                            handleAddMedia({
                              name: vid.name,
                              url: vid.url,
                              type: 'video',
                              sourceId: vid.id
                            });
                            setShowImportModal(false);
                          }}
                        >
                          <video src={vid.url} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <span className="px-3 py-1 rounded-lg bg-orange-500 text-white text-[10px] font-black uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                              + Add to Slideshow
                            </span>
                          </div>
                          <div className="absolute bottom-1 left-1 right-1 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md text-[9px] text-white truncate font-bold">
                            {vid.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {importTab === 'images' && (
                <div>
                  {allSessionAssets.generatedImages.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <p className="text-xs font-bold uppercase">No Generated Images Found</p>
                      <p className="text-[11px] text-slate-400 mt-1">Apply virtual staging, wall unifier, or dusk tools in the Studio tab first.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {allSessionAssets.generatedImages.map((img) => (
                        <div
                          key={img.id}
                          className="group relative rounded-xl overflow-hidden border border-white/10 bg-black aspect-video hover:border-orange-500 transition-all cursor-pointer"
                          onClick={() => {
                            handleAddMedia({
                              name: img.name,
                              url: img.url,
                              type: 'image',
                              sourceId: img.id
                            });
                            setShowImportModal(false);
                          }}
                        >
                          <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <span className="px-3 py-1 rounded-lg bg-orange-500 text-white text-[10px] font-black uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                              + Add to Slideshow
                            </span>
                          </div>
                          <div className="absolute bottom-1 left-1 right-1 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md text-[9px] text-white truncate font-bold">
                            {img.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {importTab === 'originals' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {allSessionAssets.originals.map((img) => (
                    <div
                      key={img.id}
                      className="group relative rounded-xl overflow-hidden border border-white/10 bg-black aspect-video hover:border-orange-500 transition-all cursor-pointer"
                      onClick={() => {
                        handleAddMedia({
                          name: img.name,
                          url: img.url,
                          type: 'image',
                          sourceId: img.id
                        });
                        setShowImportModal(false);
                      }}
                    >
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <span className="px-3 py-1 rounded-lg bg-orange-500 text-white text-[10px] font-black uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                          + Add to Slideshow
                        </span>
                      </div>
                      <div className="absolute bottom-1 left-1 right-1 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md text-[9px] text-white truncate font-bold">
                        {img.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {importTab === 'upload' && (
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-white/15 rounded-2xl p-8 text-center bg-slate-950/40">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-orange-400 mb-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                  </svg>
                  <p className="text-xs font-bold text-white uppercase tracking-wider">Drop or Browse Image / Video Files</p>
                  <p className="text-[11px] text-slate-400 mt-1 mb-4">Supports PNG, JPG, MP4, WebM up to 4K resolution</p>
                  <label className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider cursor-pointer shadow-lg">
                    Choose Files
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={(e) => {
                        handleDirectUpload(e);
                        setShowImportModal(false);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
