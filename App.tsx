
import { Header } from './components/Header';
import { useAuth } from './components/AuthContext';
import { AuthModal } from './components/AuthModal';
import { PricingModal } from './components/PricingModal';
import { ClientDashboardModal } from './components/ClientDashboardModal';
import { ImageUploader } from './components/ImageUploader';
import { ImageGridItem } from './components/ImageGridItem';
import { SocialMediaGenerator } from './components/SocialMediaGenerator';
import { MaskEditor } from './components/MaskEditor';
import { PanoramaEditor } from './components/PanoramaEditor';
import { AIAnalyst } from './components/AIAnalyst';
import { CustomTool } from './components/CustomTool';
import { SlideshowBuilder, SlideshowSlide, convertItemToSlide } from './components/SlideshowBuilder';
import { editImageWeather, stringifyError, enhancePrompt, LuxuryMarketingPack, generateDawnToDuskVideo, generateSunnySkiesVideo, generateFurnitureBuildVideo, generateCustomVideo, generateVideoFromImage, generateSurgicalMask, generateDepersonalizeMask, analyzeImageVision } from './services/geminiService';
import { resizeAndProcessImage, convertPdfToImage, getImageDimensions, createZipArchive, processImageForApi, applyWatermarkToDataUrl, normalizeImage, cropToRatio, sharpenImage, reprojectRectilinearTo360, project360ToRectilinear, dilateMask, extractVideoThumbnailAndDimensions, applySurgicalComposite, calculateSkyCoveragePercent } from './services/imageUtils';
import { WEATHER_PRESETS, PANORAMA_PRESETS, VISUAL_STAGER_PRESETS, FURNITURE_STYLES, STAGING_ROOMS, STUDIO_TOOL_CATEGORIES } from './constants';
import { ImageItem, WeatherPreset, GeneratedAsset, SocialAssets, ImageItemConfig, PropertyData, ImagePreAnalysis } from './types';
import { assetStore } from './utils/persistence';
import { 
  loadTokenGuardSettings, 
  saveTokenGuardSettings, 
  recordTokensUsed, 
  calculateBatchEstimatedTokens, 
  calculateTokensForTools,
  formatTokens, 
  tokenToDollarString, 
  TokenGuardSettings 
} from './utils/tokenGuard';
import { TokenGuardModal } from './components/TokenGuardModal';
import { cleanEmbedUrl } from './utils/embedUtils';
import { hexToColorDescription } from './utils/colorUtils';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
    EyeDropper?: any;
  }
}

type SortOption = 'name' | 'date-modified' | 'date-added';
type AppTab = 'studio' | 'social' | 'ai-analyst' | 'property-website';

const TRANSFORMATIVE_DUPLICATE_TOOLS = ['furniture', 'style_swapper', 'p360_vstaging_3d', 'p360_style_swap', 'dawn_to_dusk_video', 'sunny_skies_video', 'custom_video', 'furniture_build_video', 'empty_room', 'p360_auto_declutter', 'auto_declutter', 'floor_replacer', 'ceiling_replacer'];

function App() {
  const [hoveredToolTooltip, setHoveredToolTooltip] = useState<{ preset: WeatherPreset; rect: { left: number; right: number; top: number; bottom: number; width: number; height: number } } | null>(null);
  const [showTooltips, setShowTooltips] = useState<boolean>(true);
  const [items, setItems] = useState<ImageItem[]>([]);
  const { user, profile, isAdmin, isActualAdmin, clientPreviewMode, setClientPreviewMode, deductCredits, addCredits } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showPricingModal, setShowPricingModal] = useState<boolean>(false);
  const [showDashboardModal, setShowDashboardModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<AppTab>('studio');

  // Fallback to studio if client is currently on admin-only tabs
  useEffect(() => {
    if (!isAdmin && activeTab !== 'studio') {
      setActiveTab('studio');
    }
  }, [isAdmin, activeTab]);
  const [showCostModal, setShowCostModal] = useState<boolean>(false);
  const [tokenGuardSettings, setTokenGuardSettings] = useState<TokenGuardSettings>(() => loadTokenGuardSettings());
  const [showTokenGuardSettings, setShowTokenGuardSettings] = useState<boolean>(false);
  const [showTokenGuardInterception, setShowTokenGuardInterception] = useState<boolean>(false);
  const [pendingBatchTokens, setPendingBatchTokens] = useState<number>(0);
  const [customConfirm, setCustomConfirm] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
  } | null>(null);
  const [customAlert, setCustomAlert] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [stagingPreviewTool, setStagingPreviewTool] = useState<string | null>(null);
  const [aiAnalystResults, setAiAnalystResults] = useState<LuxuryMarketingPack | null>(null);

  const [properties, setProperties] = useState<PropertyData[]>([]);

  const [socialAssets, setSocialAssets] = useState<SocialAssets>({
    headshot: null,
    logo: null,
    propertyImages: [],
    assetLibrary: {}
  });
  const [slideshowSlides, setSlideshowSlides] = useState<SlideshowSlide[]>([]);

  // HYDRATION for Social Assets
  useEffect(() => {
    const hydrate = async () => {
      const headshot = localStorage.getItem('pmd_headshot_b64');
      const logo = localStorage.getItem('pmd_logo_b64');
      const library = await assetStore.getMetadata('pmd_asset_library');
      
      setSocialAssets(prev => ({
        ...prev,
        headshot: headshot || null,
        logo: logo || null,
        assetLibrary: library || {}
      }));
    };
    hydrate();
  }, []);

  // Handle return redirect from Stripe Checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripeSessionId = params.get('stripe_session_id');
    const stripeStatus = params.get('stripe_status');
    const packId = params.get('pack_id');

    if (stripeSessionId && stripeStatus === 'success') {
      try {
        const processed: string[] = JSON.parse(localStorage.getItem('pmd_processed_stripe_sessions') || '[]');
        if (processed.includes(stripeSessionId)) {
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }

        const verifyStripePayment = async () => {
          try {
            const res = await fetch('/api/stripe/verify-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId: stripeSessionId })
            });
            const data = await res.json();
            if (data.paid && data.credits > 0) {
              await addCredits(data.credits, `Stripe Checkout: ${data.packId || packId || 'Credit Pack'} (${data.credits.toLocaleString()} Credits)`);
              
              processed.push(stripeSessionId);
              localStorage.setItem('pmd_processed_stripe_sessions', JSON.stringify(processed));

              setCustomAlert({
                title: 'Payment Confirmed! 🎉',
                message: `Thank you for your purchase! ${data.credits.toLocaleString()} credits have been added to your account.`
              });
            } else {
              setCustomAlert({
                title: 'Payment Verification Notice',
                message: data.status ? `Payment status: ${data.status}` : 'Could not confirm payment completion.'
              });
            }
          } catch (err: any) {
            console.error('Failed to verify Stripe payment:', err);
          } finally {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        };

        verifyStripePayment();
      } catch (e) {
        console.error('Stripe return handling error:', e);
      }
    } else if (stripeStatus === 'cancelled') {
      setCustomAlert({
        title: 'Checkout Cancelled',
        message: 'Your Stripe payment session was cancelled. No charges were made to your card.'
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [addCredits]);

  useEffect(() => {
    if (socialAssets.assetLibrary && Object.keys(socialAssets.assetLibrary).length > 0) {
      assetStore.saveMetadata('pmd_asset_library', socialAssets.assetLibrary);
    }
    try {
      if (socialAssets.headshot) {
        localStorage.setItem('pmd_headshot_b64', socialAssets.headshot);
      } else {
        localStorage.removeItem('pmd_headshot_b64');
      }
    } catch {}
    try {
      if (socialAssets.logo) {
        localStorage.setItem('pmd_logo_b64', socialAssets.logo);
      } else {
        localStorage.removeItem('pmd_logo_b64');
      }
    } catch {}
  }, [socialAssets.assetLibrary, socialAssets.headshot, socialAssets.logo]);

  const [orderedPresets, setOrderedPresets] = useState<WeatherPreset[]>(() => {
    let base: WeatherPreset[];
    const savedOrder = localStorage.getItem('pmd_tools_order');
    if (savedOrder) {
      try {
        const savedIds = JSON.parse(savedOrder) as string[];
        const ordered = savedIds
          .map(id => WEATHER_PRESETS.find(p => id === p.id))
          .filter((p): p is WeatherPreset => p !== undefined);
        const missing = WEATHER_PRESETS.filter(p => !savedIds.includes(p.id));
        base = [...ordered, ...missing];
      } catch (e) {
        base = [...WEATHER_PRESETS];
      }
    } else {
      base = [...WEATHER_PRESETS];
    }
    
    // Ensure Direct Declutter is positioned in front of Declutter
    const directIdx = base.findIndex(p => p.id === 'declutter_direct');
    const autoIdx = base.findIndex(p => p.id === 'auto_declutter');
    if (directIdx !== -1 && autoIdx !== -1 && directIdx > autoIdx) {
      const [directTool] = base.splice(directIdx, 1);
      const newAutoIdx = base.findIndex(p => p.id === 'auto_declutter');
      base.splice(newAutoIdx, 0, directTool);
    }

    // Ensure Sun Drenched is positioned directly to the right of Outdoor Sun
    const sunnyIdx = base.findIndex(p => p.id === 'sunny_skies');
    const sunDrenchedIdx = base.findIndex(p => p.id === 'sun_drenched');
    if (sunnyIdx !== -1 && sunDrenchedIdx !== -1) {
      const [sunDrenchedTool] = base.splice(sunDrenchedIdx, 1);
      const newSunnyIdx = base.findIndex(p => p.id === 'sunny_skies');
      base.splice(newSunnyIdx + 1, 0, sunDrenchedTool);
    }

    const withoutCables = base.filter(p => p.id !== 'cable_remover');
    const cableTool = WEATHER_PRESETS.find(p => p.id === 'cable_remover');
    return cableTool ? [...withoutCables, cableTool] : withoutCables;
  });

  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isEnhancingVideo, setIsEnhancingVideo] = useState(false);
  const [brandingColor, setBrandingColor] = useState('#f97316'); 
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [panoEditingItemId, setPanoEditingItemId] = useState<string | null>(null);
  const [maskEditorMode, setMaskEditorMode] = useState<'reveal' | 'erase' | 'mask' | 'wall_mask'>('reveal');
  const [globalStagingPrefs, setGlobalStagingPrefs] = useState<Partial<ImageItemConfig>>(() => {
    const saved = localStorage.getItem('pmd_global_staging_prefs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return {
      stagingRoom: STAGING_ROOMS[0],
      stagingStyle: FURNITURE_STYLES[0],
      swapStyle: FURNITURE_STYLES[0],
      stageDescriptor: '',
      swapDescriptor: ''
    };
  });

  useEffect(() => {
    localStorage.setItem('pmd_global_staging_prefs', JSON.stringify(globalStagingPrefs));
  }, [globalStagingPrefs]);

  const debounceTimerRef = useRef<number | null>(null);
  const debounceVideoTimerRef = useRef<number | null>(null);
  const activeItem = useMemo(() => items.find(i => i.id === activeItemId) || null, [items, activeItemId]);

  const currentStagingConfig = useMemo(() => {
    if (activeItem) return activeItem.config;
    return {
      stagingRoom: globalStagingPrefs.stagingRoom || STAGING_ROOMS[0],
      stagingStyle: globalStagingPrefs.stagingStyle || FURNITURE_STYLES[0],
      swapStyle: globalStagingPrefs.swapStyle || FURNITURE_STYLES[0],
      stageDescriptor: globalStagingPrefs.stageDescriptor || '',
      swapDescriptor: globalStagingPrefs.swapDescriptor || '',
      emptyRoomFirst: false,
    };
  }, [activeItem, globalStagingPrefs]);

  const stagedCount = useMemo(() => items.filter(i => i.assignedTools.length > 0).length, [items]);
  const selectedCount = useMemo(() => items.filter(i => i.selected).length, [items]);

  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
  const [batchAnalysisProgress, setBatchAnalysisProgress] = useState<string>('');

  const socialAssetsRef = useRef(socialAssets);
  useEffect(() => {
    socialAssetsRef.current = socialAssets;
  }, [socialAssets]);

  const handleSocialRowSelected = useCallback((data: any) => {
    if (!data) return;
    const getField = (keys: string[]) => {
      for (const k of keys) {
        const normalized = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (data[normalized] !== undefined && data[normalized] !== null) return String(data[normalized]);
        if (data[k] !== undefined && data[k] !== null) return String(data[k]);
      }
      return "";
    };
    const address = getField(['address', 'propertyaddress', 'location']);
    const city = getField(['city', 'region', 'neighborhood']);
    const unit = getField(['unit', 'apt', 'suite', 'apartmentnumber']);
    
    if (!address && !city) return;

    const findAssetUrl = (refName: string) => {
      if (!refName) return "";
      const val = refName.trim();
      if (!val) return "";
      if (val.startsWith('http') || val.startsWith('data:') || val.startsWith('blob:')) return val;
      const currentSocial = socialAssetsRef.current;
      if (currentSocial && currentSocial.assetLibrary) {
        const cleanRef = val.toLowerCase().split('.')[0];
        const matchKey = Object.keys(currentSocial.assetLibrary).find(k => k.toLowerCase().split('.')[0] === cleanRef);
        if (matchKey) return currentSocial.assetLibrary[matchKey];
      }
      return "";
    };

    const rawHeadshot = getField(['headshot', 'ai', 'col34', '@Headshot', 'agent_headshot', 'agent_photo', 'photo', 'agent_url', 'headshot_url', 'profile_image', 'profile_photo', 'agent_image', 'agent_pic', 'agent_portrait', 'r_headshot', 'remote_headshot', 'r']);
    const rawLogo = getField(['logo', 'aj', 'col35', '@Logo', 'brand_asset', 'brand_asset_url', 'logo_url', 'brokerage_logo_url', 'company_logo', 'branding_logo', 'brand_image', 'brand_url', 'logo_image', 'brokerage_image', 'brokerage_logo', 'brand_logo', 'brand', 'broker_logo', 'r_logo', 'remote_logo']);
    const rawHeadshot2 = getField(['headshot2', 'co_headshot', 'agent2_headshot', 'photo2', 'agent2_photo', 'r2_headshot']);
    const rawLogo2 = getField(['logo2', 'co_logo', 'agent2_logo', 'brokerage2_logo', 'r2_logo']);

    const resolvedHeadshot = findAssetUrl(rawHeadshot) || undefined;
    const resolvedLogo = findAssetUrl(rawLogo) || undefined;
    const resolvedHeadshot2 = findAssetUrl(rawHeadshot2) || undefined;
    const resolvedLogo2 = findAssetUrl(rawLogo2) || undefined;

    // Update global social assets if matched
    if (resolvedHeadshot || resolvedLogo || resolvedHeadshot2 || resolvedLogo2) {
      setSocialAssets(prev => {
        const updates: Partial<typeof prev> = {};
        if (resolvedHeadshot && resolvedHeadshot !== prev.headshot) updates.headshot = resolvedHeadshot;
        if (resolvedLogo && resolvedLogo !== prev.logo) updates.logo = resolvedLogo;
        if (resolvedHeadshot2 && resolvedHeadshot2 !== prev.headshot2) updates.headshot2 = resolvedHeadshot2;
        if (resolvedLogo2 && resolvedLogo2 !== prev.logo2) updates.logo2 = resolvedLogo2;
        if (Object.keys(updates).length > 0) {
          return { ...prev, ...updates };
        }
        return prev;
      });
    }

    setProperties(prev => {
      const existingIdx = prev.findIndex(p => 
        (p.address || "").toLowerCase().trim() === address.toLowerCase().trim() &&
        (p.city || "").toLowerCase().trim() === city.toLowerCase().trim()
      );
      const newProp: PropertyData = {
        id: existingIdx !== -1 ? prev[existingIdx].id : Math.random().toString(36).substring(7),
        unit: unit,
        address: address,
        city: city,
        price: getField(['price', 'listprice', 'askingprice']),
        bed: getField(['bed', 'beds', 'bedrooms']),
        bath: getField(['bath', 'baths', 'bathrooms']),
        sqft: getField(['total living area sqft', 'sqft', 'squarefeet', 'totallivingarea', 'livingarea', 'total area']),
        email: getField(['email', 'agentemail']),
        phoneNumber: getField(['phonenumber', 'phone', 'cell', 'mobile']),
        website: getField(['website', 'url', 'agentwebsite']),
        agentName: getField(['realtor', 'agent', 'agentname', 'representative']),
        brokerage: getField(['brokerage', 'agency', 'company']),
        headshot: resolvedHeadshot || socialAssetsRef.current.headshot || undefined,
        logo: resolvedLogo || socialAssetsRef.current.logo || undefined,
        
        // Second Realtor fields
        agent2Name: getField(['agent2', 'agent2Name', 'agent2name', 'realtor2', 'coagent', 'colistingagent', 'colistingagentname', 'coagentname', 'secondagent', 'secondrealtor', 'secondagentname', 'secondrealtorname', 'colistingrepresentative', 'co_agent', 'co_realtor', 'agent2_name', 'realtor2_name']),
        agent2Brokerage: getField(['agent2Brokerage', 'agent2brokerage', 'brokerage2', 'coagentbrokerage', 'colistingbrokerage', 'colistingagentbrokerage', 'secondagentbrokerage', 'company2', 'agent2_brokerage', 'co_brokerage']),
        agent2PhoneNumber: getField(['agent2PhoneNumber', 'agent2phonenumber', 'agent2phone', 'phone2', 'phonenumber2', 'realtor2phone', 'coagentphone', 'colistingphone', 'colistingagentphone', 'secondagentphone', 'agent2_phone', 'agent2_phonenumber', 'co_phone']),
        agent2Email: getField(['agent2Email', 'agent2email', 'agent2emailaddress', 'email2', 'realtor2email', 'coagentemail', 'colistingemail', 'colistingagentemail', 'secondagentemail', 'agent2_email', 'co_email']),
        agent2Headshot: resolvedHeadshot2 || socialAssetsRef.current.headshot2 || undefined,
        agent2Logo: resolvedLogo2 || socialAssetsRef.current.logo2 || undefined,

        matterportUrl: cleanEmbedUrl(getField(['matterport', 'matterporturl', 'virtualtour'])) || getField(['matterport', 'matterporturl', 'virtualtour']),
        threeDFloorPlan: cleanEmbedUrl(getField([
          '3d floorplan',
          '3dfloorplan',
          '3d floor plan',
          '3d_floorplan',
          '3d-floorplan',
          '3d_floor_plan',
          'floorplan 3d',
          'floorplan3d',
          'floorplan_3d',
          '3d floorplan iframe',
          '3dfloorplaniframe',
          '3d_floorplan_iframe',
          '3d floor plan iframe',
          'iframe 3d floorplan',
          'iframe_3d_floorplan',
          '3d tour floorplan',
          '3dtourfloorplan'
        ])) || getField([
          '3d floorplan',
          '3dfloorplan',
          '3d floor plan',
          '3d_floorplan',
          '3d-floorplan',
          '3d_floor_plan',
          'floorplan 3d',
          'floorplan3d',
          'floorplan_3d',
          '3d floorplan iframe',
          '3dfloorplaniframe',
          '3d_floorplan_iframe',
          '3d floor plan iframe',
          'iframe 3d floorplan',
          'iframe_3d_floorplan',
          '3d tour floorplan',
          '3dtourfloorplan'
        ]),
        videoUrl: cleanEmbedUrl(getField(['video', 'videourl', 'youtube', 'vimeo'])) || getField(['video', 'videourl', 'youtube', 'vimeo']),
        drone: cleanEmbedUrl(getField(['drone', 'droneurl', 'drone360', 'drone 360', 'drone_url'])) || getField(['drone', 'droneurl', 'drone360', 'drone 360', 'drone_url']),
        galleryImages: [...socialAssetsRef.current.propertyImages],
        showMap: true
      };
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx] = newProp;
        return updated;
      }
      return [newProp, ...prev];
    });
  }, [setSocialAssets]);

  const applySunnySkiesToSelected = () => {
    if (selectedCount === 0) {
      setCustomAlert({
        title: "No Selected Images",
        message: "Please select one or more photos to apply Sunny Skies."
      });
      return;
    }
    setItems(prev => prev.map(item => {
      if (item.selected) {
        const hasSunny = item.assignedTools.includes('sunny_skies');
        return {
          ...item,
          assignedTools: hasSunny ? item.assignedTools : [...item.assignedTools, 'sunny_skies']
        };
      }
      return item;
    }));
  };

  useEffect(() => {
    const customPrompt = activeItem?.config.customPrompt;
    if (!customPrompt?.trim()) return;
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(async () => {
      setIsEnhancing(true);
      try {
        const enhanced = await enhancePrompt(customPrompt);
        updateActiveItemConfig({ enhancedPrompt: enhanced });
      } catch (e) { console.error(e); } finally { setIsEnhancing(false); }
    }, 1500);
    return () => { if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current); };
  }, [activeItem?.config.customPrompt, activeItemId]);

  useEffect(() => {
    const customVideoPrompt = activeItem?.config.customVideoPrompt;
    if (!customVideoPrompt?.trim()) return;
    if (debounceVideoTimerRef.current) window.clearTimeout(debounceVideoTimerRef.current);
    debounceVideoTimerRef.current = window.setTimeout(async () => {
      setIsEnhancingVideo(true);
      try {
        const enhanced = await enhancePrompt(`Convert this video prompt into a rich, cinematic video generation prompt for architectural videography, specifying camera motion, depth, lighting, and environmental atmosphere: "${customVideoPrompt}"`);
        updateActiveItemConfig({ enhancedVideoPrompt: enhanced });
      } catch (e) { console.error(e); } finally { setIsEnhancingVideo(false); }
    }, 1500);
    return () => { if (debounceVideoTimerRef.current) window.clearTimeout(debounceVideoTimerRef.current); };
  }, [activeItem?.config.customVideoPrompt, activeItemId]);

  useEffect(() => {
    const ids = orderedPresets.map(p => p.id);
    localStorage.setItem('pmd_tools_order', JSON.stringify(ids));
  }, [orderedPresets]);

  useEffect(() => {
    if (orderedPresets.length > 0) {
      const sunnyIdx = orderedPresets.findIndex(p => p.id === 'sunny_skies');
      const sunDrenchedIdx = orderedPresets.findIndex(p => p.id === 'sun_drenched');
      if (sunnyIdx !== -1 && sunDrenchedIdx !== -1 && sunDrenchedIdx !== sunnyIdx + 1) {
        const next = [...orderedPresets];
        const [tool] = next.splice(sunDrenchedIdx, 1);
        const newSunnyIdx = next.findIndex(p => p.id === 'sunny_skies');
        next.splice(newSunnyIdx + 1, 0, tool);
        setOrderedPresets(next);
        return;
      }

      const lastIndex = orderedPresets.length - 1;
      if (orderedPresets[lastIndex].id !== 'cable_remover') {
        const withoutCables = orderedPresets.filter(p => p.id !== 'cable_remover');
        const cableTool = WEATHER_PRESETS.find(p => p.id === 'cable_remover');
        if (cableTool) {
          setOrderedPresets([...withoutCables, cableTool]);
        }
      }
    }
  }, [orderedPresets]);

  useEffect(() => {
    setHasApiKey(true);
  }, []);

  const handleOpenKeySelector = async () => {
    // Legacy key selection has been removed to comply with platform guidelines.
    // We handle and instruct the user visually instead.
    setHasApiKey(false);
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isGridView, setIsGridView] = useState(true);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  const handleImagesSelected = async (files: File[]) => {
    const now = Date.now();
    const newItems: ImageItem[] = await Promise.all(files.map(async (file) => {
      const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|mkv|ogg)$/i.test(file.name);
      let processedFile = file;

      if (isVideo) {
        const videoBlobUrl = URL.createObjectURL(file);
        let previewUrl = '';
        let base64: string | null = null;
        let dimensions: { width: number; height: number } = { width: 1920, height: 1080 };

        try {
          const videoInfo = await extractVideoThumbnailAndDimensions(file, 0.5);
          previewUrl = videoInfo.thumbnailDataUrl;
          dimensions = { width: videoInfo.width, height: videoInfo.height };
          const result = await processImageForApi(previewUrl, 1024);
          base64 = result.base64;
        } catch (vErr) {
          console.error("Failed to extract video thumbnail frame:", file.name, vErr);
          const fallbackCanvas = document.createElement('canvas');
          fallbackCanvas.width = 1920;
          fallbackCanvas.height = 1080;
          const ctx = fallbackCanvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, 1920, 1080);
            ctx.fillStyle = '#f97316';
            ctx.font = 'bold 56px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('VIDEO CLIP', 960, 540);
          }
          previewUrl = fallbackCanvas.toDataURL('image/jpeg', 0.85);
          base64 = previewUrl.split(',')[1];
        }

        const isPortrait = dimensions.height > dimensions.width;

        return {
          id: Math.random().toString(36).substring(7),
          file: processedFile,
          previewUrl,
          base64,
          dimensions,
          history: [
            {
              url: videoBlobUrl,
              type: 'video' as const,
              timestamp: now,
              tools: ['Uploaded Video']
            }
          ],
          currentHistoryIndex: 0,
          status: 'complete' as const,
          selected: false,
          autoDuplicate: false,
          is360: false,
          dateAdded: now,
          assignedTools: [],
          config: {
            stagingRoom: STAGING_ROOMS[0],
            stagingStyle: FURNITURE_STYLES[0],
            swapStyle: FURNITURE_STYLES[0],
            wallColor: '#f1f1f1',
            stageDescriptor: '',
            swapDescriptor: '',
            videoAspectRatio: isPortrait ? '9:16' : '16:9'
          }
        };
      }

      if (file.type === 'application/pdf') {
         try { processedFile = await convertPdfToImage(file); } catch (e) { console.error("Failed to convert PDF", file.name, e); }
      }
      const initialBlobUrl = URL.createObjectURL(processedFile);
      let dimensions: { width: number; height: number } | undefined;
      let previewUrl = initialBlobUrl;
      let base64: string | null = null;
      
      try {
        dimensions = await getImageDimensions(initialBlobUrl);
        const is360 = dimensions && (Math.abs(dimensions.width / dimensions.height - 2) < 0.1);
        
        // Preserve original aspect ratio: Normalize to ensure consistent rendering grid
        previewUrl = await normalizeImage(initialBlobUrl);
        // Refresh dimensions from the normalized canvas
        dimensions = await getImageDimensions(previewUrl);
        
        URL.revokeObjectURL(initialBlobUrl); 

        // Optimize API payload resolution to 1024px to reduce input token ingestion by ~60%
        const result = await processImageForApi(previewUrl, is360 ? 2048 : 1024);
        base64 = result.base64;
      } catch (e) { 
        console.error("Failed to read file", processedFile.name); 
      }

      return {
        id: Math.random().toString(36).substring(7),
        file: processedFile,
        previewUrl, 
        base64,
        dimensions,
        history: [],
        currentHistoryIndex: -1,
        status: 'pending' as const,
        selected: false,
        autoDuplicate: false,
        is360: dimensions && (Math.abs(dimensions.width / dimensions.height - 2) < 0.1),
        dateAdded: now,
        assignedTools: [],
        config: {
          stagingRoom: STAGING_ROOMS[0],
          stagingStyle: FURNITURE_STYLES[0],
          swapStyle: FURNITURE_STYLES[0],
          wallColor: '#f1f1f1',
          stageDescriptor: '',
          swapDescriptor: ''
        }
      };
    }));
    setItems(prev => {
      const combined = [...prev, ...newItems];
      if (!activeItemId && newItems.length > 0) setActiveItemId(newItems[0].id);
      return combined;
    });
  };

  const handleExtractVideoFrame = async (itemId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const item = items.find(i => i.id === itemId);
    if (!item || !item.previewUrl) return;

    try {
      const resp = await fetch(item.previewUrl);
      const blob = await resp.blob();
      const baseName = item.file.name.replace(/\.[^/.]+$/, "");
      const frameFile = new File([blob], `${baseName}-still-frame.jpg`, { type: 'image/jpeg' });
      const newBlobUrl = URL.createObjectURL(frameFile);
      const dims = item.dimensions || { width: 1920, height: 1080 };
      const apiResult = await processImageForApi(newBlobUrl, 1024);

      const newItem: ImageItem = {
        id: Math.random().toString(36).substring(7),
        file: frameFile,
        previewUrl: newBlobUrl,
        base64: apiResult.base64,
        dimensions: dims,
        history: [],
        currentHistoryIndex: -1,
        status: 'complete',
        selected: false,
        autoDuplicate: false,
        is360: false,
        dateAdded: Date.now(),
        assignedTools: [],
        config: {
          stagingRoom: STAGING_ROOMS[0],
          stagingStyle: FURNITURE_STYLES[0],
          swapStyle: FURNITURE_STYLES[0],
          wallColor: '#f1f1f1',
          stageDescriptor: '',
          swapDescriptor: ''
        }
      };

      setItems(prev => {
        const itemIdx = prev.findIndex(i => i.id === itemId);
        if (itemIdx >= 0) {
          const updated = [...prev];
          updated.splice(itemIdx + 1, 0, newItem);
          return updated;
        }
        return [...prev, newItem];
      });
      setActiveItemId(newItem.id);
    } catch (err) {
      console.error("Failed to extract video frame as photo item", err);
    }
  };

  const updateActiveItemConfig = (updates: Partial<ImageItemConfig>) => {
    if (!activeItemId) return;
    setItems(prev => prev.map(item => item.id === activeItemId ? { ...item, config: { ...item.config, ...updates } } : item));
    
    // Global Furniture Memory: Update global prefs if these are staging/swap fields
    const stagingFields = ['stagingRoom', 'stagingStyle', 'stageDescriptor', 'swapStyle', 'swapDescriptor'];
    const relevantUpdates = Object.keys(updates).filter(k => stagingFields.includes(k));
    if (relevantUpdates.length > 0) {
      setGlobalStagingPrefs(prev => ({ ...prev, ...updates }));
    }
  };

  const handleUpdateStagingConfig = (updates: Partial<ImageItemConfig>) => {
    if (activeItemId) {
      updateActiveItemConfig(updates);
    } else {
      setGlobalStagingPrefs(prev => ({ ...prev, ...updates }));
    }
  };

  const handleOpenRestore = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setMaskEditorMode('reveal'); setEditingItemId(id); };
  const handleOpenEraser = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setMaskEditorMode('erase'); setEditingItemId(id); };
  const handleOpenLasso = (id: string) => { setMaskEditorMode('mask'); setEditingItemId(id); };
  const handleOpenWallMask = (id: string) => { setMaskEditorMode('wall_mask'); setEditingItemId(id); };

  const handleToggleAutoDuplicate = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, autoDuplicate: !item.autoDuplicate } : item));
  };

  const handleToolToggle = (toolId: string, specificItemId?: string) => {
    let targetId = specificItemId || activeItemId;
    if (!targetId && items.length > 0) {
      targetId = items[0].id;
      setActiveItemId(items[0].id);
    }
    if (!targetId) {
      setStagingPreviewTool(prev => prev === toolId ? null : toolId);
      return;
    }

    // Disallow video, 360, architectural finishes, and uncategorized tools on client side
    if (!isAdmin) {
      if (toolId.includes('video') || toolId.startsWith('p360_')) {
        return;
      }
      const allowedToolIds = new Set(
        STUDIO_TOOL_CATEGORIES
          .filter(c => c.id !== 'cinematic_video' && c.id !== '360_panorama' && c.id !== 'custom_precision' && c.id !== 'architectural_finishes')
          .flatMap(c => c.toolIds)
      );
      if (!allowedToolIds.has(toolId)) {
        return;
      }
    }
    
    // Magic Eraser special handling: open editor immediately
    if (toolId === 'object_removal') {
      handleOpenEraser(targetId, { stopPropagation: () => {} } as any);
      return;
    }

    setItems(prev => {
      return prev.map(item => {
        if (item.id === targetId) {
          const isAssigned = item.assignedTools.includes(toolId);
          if (!isAssigned) {
            const newConfig = { ...item.config };
            // Use Global Furniture Memory for staging and style swap tools
            if (toolId === 'furniture' || toolId === 'p360_vstaging_3d') {
              newConfig.stagingRoom = globalStagingPrefs.stagingRoom;
              newConfig.stagingStyle = globalStagingPrefs.stagingStyle;
              newConfig.stageDescriptor = globalStagingPrefs.stageDescriptor;
            } else if (toolId === 'style_swapper' || toolId === 'p360_style_swap') {
              newConfig.swapStyle = globalStagingPrefs.swapStyle;
              newConfig.swapDescriptor = globalStagingPrefs.swapDescriptor;
            } else if (toolId === 'wall_unifier') {
              newConfig.wallColor = globalStagingPrefs.wallColor || '#f1f1f1';
            } else if (toolId === 'floor_replacer') {
              newConfig.floorSample = globalStagingPrefs.floorSample;
            } else if (toolId === 'ceiling_replacer') {
              newConfig.ceilingSample = globalStagingPrefs.ceilingSample;
            }
            return { ...item, assignedTools: [...item.assignedTools, toolId], config: newConfig };
          } else {
            return { ...item, assignedTools: item.assignedTools.filter(id => id !== toolId) };
          }
        }
        return item;
      });
    });
    if (specificItemId) setActiveItemId(specificItemId);
  };

  const handleToolDrop = (itemId: string, toolId: string) => {
    // Disallow video, 360, architectural finishes, and uncategorized tools on client side
    if (!isAdmin) {
      if (toolId.includes('video') || toolId.startsWith('p360_')) {
        return;
      }
      const allowedToolIds = new Set(
        STUDIO_TOOL_CATEGORIES
          .filter(c => c.id !== 'cinematic_video' && c.id !== '360_panorama' && c.id !== 'custom_precision' && c.id !== 'architectural_finishes')
          .flatMap(c => c.toolIds)
      );
      if (!allowedToolIds.has(toolId)) {
        return;
      }
    }

    // Magic Eraser special handling: open editor immediately
    if (toolId === 'object_removal') {
      handleOpenEraser(itemId, { stopPropagation: () => {} } as any);
      return;
    }

    // Set as active item so sync tools knows where to pull from
    setActiveItemId(itemId);

    setItems(prev => {
      return prev.map(item => {
        if (item.id === itemId) {
          if (!item.assignedTools.includes(toolId)) {
            const newConfig = { ...item.config };
            // Use Global Furniture Memory for staging and style swap tools
            if (toolId === 'furniture' || toolId === 'p360_vstaging_3d') {
              newConfig.stagingRoom = globalStagingPrefs.stagingRoom;
              newConfig.stagingStyle = globalStagingPrefs.stagingStyle;
              newConfig.stageDescriptor = globalStagingPrefs.stageDescriptor;
            } else if (toolId === 'style_swapper' || toolId === 'p360_style_swap') {
              newConfig.swapStyle = globalStagingPrefs.swapStyle;
              newConfig.swapDescriptor = globalStagingPrefs.swapDescriptor;
            } else if (toolId === 'wall_unifier') {
              newConfig.wallColor = globalStagingPrefs.wallColor || '#f1f1f1';
            } else if (toolId === 'floor_replacer') {
              newConfig.floorSample = globalStagingPrefs.floorSample;
            } else if (toolId === 'ceiling_replacer') {
              newConfig.ceilingSample = globalStagingPrefs.ceilingSample;
            }
            return { ...item, assignedTools: [...item.assignedTools, toolId], config: newConfig };
          }
        }
        return item;
      });
    });
    setActiveItemId(itemId);
  };

  const handleSyncTools = () => {
    if (selectedCount === 0) return;
    
    // Find a source item: prefer activeItemId with tools, then find ANY selected item with tools, then find ANY item with tools
    let source = items.find(i => i.id === activeItemId);
    if (!source || source.assignedTools.length === 0) {
      source = items.find(i => i.selected && i.assignedTools.length > 0);
    }
    if (!source || source.assignedTools.length === 0) {
      source = items.find(i => i.assignedTools.length > 0);
    }
    
    if (!source) {
      setCustomAlert({
        title: "No Tools Found",
        message: "Please drop a tool onto an image first before syncing."
      });
      return;
    }
    
    const toolCount = source.assignedTools.length;
    const finalSource = source; // capture reference
    setCustomConfirm({
      title: "Sync Tools to Selected",
      message: `Apply the ${toolCount} tool${toolCount === 1 ? '' : 's'} staged on "${source.file.name}" to all other selected images?`,
      confirmText: "Sync",
      cancelText: "Cancel",
      onConfirm: () => {
        const toolsToSync = !isAdmin
          ? finalSource.assignedTools.filter(t => !t.includes('video') && !t.startsWith('p360_'))
          : [...finalSource.assignedTools];
        // Important: We don't sync the lassoMask, wallMask or other unique surgical assets across different photos
        const { lassoMask, wallMask, floorSample, ceilingSample, ...sharedConfig } = finalSource.config;

        setItems(prev => prev.map(item => {
          if (item.selected) {
            // Reset status to pending if tools are added/changed
            const wasStatusComplete = item.status === 'complete';
            return { 
              ...item, 
              assignedTools: [...toolsToSync], // Ensure new array reference
              status: wasStatusComplete ? 'pending' : item.status,
              config: { 
                ...item.config,
                ...sharedConfig
              } 
            };
          }
          return item;
        }));
        setCustomConfirm(null);
      }
    });
  };

  const handleClearStaged = () => {
    setCustomConfirm({
      title: "Clear All Staged Tools",
      message: "Clear all staged tools from all images?",
      confirmText: "Clear All",
      cancelText: "Cancel",
      onConfirm: () => {
        setItems(prev => prev.map(item => ({ ...item, assignedTools: [] })));
        setCustomConfirm(null);
      }
    });
  };

  // Option 2: AI-Powered Pre-Analysis (Gemini Vision) Handlers
  const handlePreAnalyzeSingle = async (itemId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetItem = items.find(i => i.id === itemId);
    if (!targetItem || !targetItem.base64) return;

    setItems(prev => prev.map(item => item.id === itemId ? { ...item, isAnalyzing: true } : item));

    try {
      const mimeType = targetItem.file.type || 'image/jpeg';
      const analysis = await analyzeImageVision(targetItem.base64, mimeType);
      
      setItems(prev => prev.map(item => {
        if (item.id === itemId) {
          const updatedConfig = { ...item.config };
          if (analysis.suggestedStagingRoom && !updatedConfig.stagingRoom) {
            updatedConfig.stagingRoom = analysis.suggestedStagingRoom;
          }
          if (analysis.suggestedStagingStyle && !updatedConfig.stagingStyle) {
            updatedConfig.stagingStyle = analysis.suggestedStagingStyle;
          }
          return {
            ...item,
            preAnalysis: analysis,
            isAnalyzing: false,
            config: updatedConfig
          };
        }
        return item;
      }));
    } catch (err) {
      console.error("Pre-analysis failed:", err);
      setItems(prev => prev.map(item => item.id === itemId ? { ...item, isAnalyzing: false } : item));
    }
  };

  const handleApplyPreAnalysisRecommendations = (itemId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId && item.preAnalysis) {
        const toolsToAdd = item.preAnalysis.recommendedTools || [];
        const newAssigned = Array.from(new Set([...item.assignedTools, ...toolsToAdd]));
        const newConfig = { ...item.config };
        if (item.preAnalysis.suggestedStagingRoom) {
          newConfig.stagingRoom = item.preAnalysis.suggestedStagingRoom;
        }
        if (item.preAnalysis.suggestedStagingStyle) {
          newConfig.stagingStyle = item.preAnalysis.suggestedStagingStyle;
        }
        return {
          ...item,
          assignedTools: newAssigned,
          config: newConfig
        };
      }
      return item;
    }));
  };

  const handleTogglePreAnalysisTool = (itemId: string, toolId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const isAssigned = item.assignedTools.includes(toolId);
        const assignedTools = isAssigned
          ? item.assignedTools.filter(t => t !== toolId)
          : [...item.assignedTools, toolId];
        return { ...item, assignedTools };
      }
      return item;
    }));
  };

  const handleBatchPreAnalyze = async () => {
    const targets = selectedCount > 0 
      ? items.filter(i => i.selected && i.base64)
      : items.filter(i => i.base64);

    if (targets.length === 0) {
      setCustomAlert({
        title: "No Images to Analyze",
        message: "Please upload or select at least one image to run AI Pre-Analysis."
      });
      return;
    }

    setIsBatchAnalyzing(true);
    setBatchAnalysisProgress(`Analyzing 1 of ${targets.length}...`);

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      setBatchAnalysisProgress(`Analyzing ${i + 1} of ${targets.length}...`);
      await handlePreAnalyzeSingle(target.id);
    }

    setIsBatchAnalyzing(false);
    setBatchAnalysisProgress('');
  };

  const runGenerationForItem = async (item: ImageItem, customMaskBase64?: string | null, overrideTools?: string[]): Promise<string | null> => {
    let sourceBase64 = item.base64;
    let mimeType = item.file.type;
    const currentAsset = item.currentHistoryIndex >= 0 ? item.history[item.currentHistoryIndex] : null;
    if (currentAsset && currentAsset.type === 'image') {
      sourceBase64 = currentAsset.url.split(',')[1];
      mimeType = 'image/png';
    }
    if (!mimeType || mimeType.startsWith('video/')) {
      mimeType = 'image/jpeg';
    }
    const toolIds = overrideTools || [...item.assignedTools];
    if (!sourceBase64 || toolIds.length === 0) return null;

    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing', error: undefined } : i));

    try {
      if (toolIds.includes('dawn_to_dusk_video')) {
          const preset = WEATHER_PRESETS.find(p => p.id === 'dawn_to_dusk_video')!;
          const aspect = item.config.videoAspectRatio || '16:9';
          const videoUrl = await generateDawnToDuskVideo(sourceBase64, preset.prompt, aspect);
          const newAsset: GeneratedAsset = { url: videoUrl, type: 'video', timestamp: Date.now(), tools: ['dawn_to_dusk_video'] };
          recordTokensUsed('dawn_to_dusk_video', undefined, item.id);
          setTokenGuardSettings(loadTokenGuardSettings());
          setItems(prev => prev.map(i => {
              if (i.id === item.id) {
                  const truncatedHistory = i.history.slice(0, i.currentHistoryIndex + 1);
                  return { ...i, status: 'complete', history: [...truncatedHistory, newAsset], currentHistoryIndex: truncatedHistory.length, assignedTools: overrideTools ? i.assignedTools : [] };
              }
              return i;
          }));
          return videoUrl;
      }

      if (toolIds.includes('sunny_skies_video')) {
          const preset = WEATHER_PRESETS.find(p => p.id === 'sunny_skies_video')!;
          const aspect = item.config.videoAspectRatio || '16:9';
          const videoUrl = await generateSunnySkiesVideo(sourceBase64, preset.prompt, aspect);
          const newAsset: GeneratedAsset = { url: videoUrl, type: 'video', timestamp: Date.now(), tools: ['sunny_skies_video'] };
          recordTokensUsed('sunny_skies_video', undefined, item.id);
          setTokenGuardSettings(loadTokenGuardSettings());
          setItems(prev => prev.map(i => {
              if (i.id === item.id) {
                  const truncatedHistory = i.history.slice(0, i.currentHistoryIndex + 1);
                  return { ...i, status: 'complete', history: [...truncatedHistory, newAsset], currentHistoryIndex: truncatedHistory.length, assignedTools: overrideTools ? i.assignedTools : [] };
              }
              return i;
          }));
          return videoUrl;
      }

      if (toolIds.includes('custom_video')) {
          const aspect = item.config.videoAspectRatio || '16:9';
          const videoPrompt = item.config.enhancedVideoPrompt || item.config.customVideoPrompt || item.config.customPrompt || 'A high-end cinematic architectural video with smooth camera motion and realistic lighting.';
          const videoUrl = await generateCustomVideo(sourceBase64, videoPrompt, aspect);
          const newAsset: GeneratedAsset = { url: videoUrl, type: 'video', timestamp: Date.now(), tools: ['custom_video'] };
          recordTokensUsed('custom_video', undefined, item.id);
          setTokenGuardSettings(loadTokenGuardSettings());
          setItems(prev => prev.map(i => {
              if (i.id === item.id) {
                  const truncatedHistory = i.history.slice(0, i.currentHistoryIndex + 1);
                  return { ...i, status: 'complete', history: [...truncatedHistory, newAsset], currentHistoryIndex: truncatedHistory.length, assignedTools: overrideTools ? i.assignedTools : [] };
              }
              return i;
          }));
          return videoUrl;
      }

      if (toolIds.includes('furniture_build_video')) {
          const preset = WEATHER_PRESETS.find(p => p.id === 'furniture_build_video')!;
          const aspect = item.config.videoAspectRatio || '16:9';
          const style = item.config.stagingStyle || 'Luxury Modern';
          const room = item.config.stagingRoom || 'living room';
          const detail = item.config.stageDescriptor ? ` featuring ${item.config.stageDescriptor}` : '';
          const customPrompt = item.config.customPrompt ? ` ${item.config.customPrompt}` : '';
          const videoPrompt = `A high-end cinematic architectural time-lapse video showing modern ${style} designer furniture smoothly being assembled and built piece by piece into this ${room}${detail}.${customPrompt} Designer sofas, armchairs, wooden tables, elegant rugs, and warm accent lighting assemble piece-by-piece in seamless stop-motion architectural staging into a fully furnished luxury room. STRICT WALL COLOR & STRUCTURAL PRESERVATION: All original walls, wall paint colors, wall finishes, doorways, windows, and room dimensions remain 100% untouched and unchanged throughout the video. Absolutely DO NOT change or alter the wall color. Photorealistic interior design, smooth camera motion.`;
          const videoUrl = await generateFurnitureBuildVideo(sourceBase64, videoPrompt, aspect);
          const newAsset: GeneratedAsset = { url: videoUrl, type: 'video', timestamp: Date.now(), tools: ['furniture_build_video'] };
          recordTokensUsed('furniture_build_video', undefined, item.id);
          setTokenGuardSettings(loadTokenGuardSettings());
          setItems(prev => prev.map(i => {
              if (i.id === item.id) {
                  const truncatedHistory = i.history.slice(0, i.currentHistoryIndex + 1);
                  return { ...i, status: 'complete', history: [...truncatedHistory, newAsset], currentHistoryIndex: truncatedHistory.length, assignedTools: overrideTools ? i.assignedTools : [] };
              }
              return i;
          }));
          return videoUrl;
      }

      const activePresets = toolIds.map(id => [...WEATHER_PRESETS, ...PANORAMA_PRESETS, ...VISUAL_STAGER_PRESETS].find(p => p.id === id)).filter(Boolean) as WeatherPreset[];
      
      // Determine if we need a sample image (floor or ceiling replacer)
      let sampleBase64: string | null = null;
      if (toolIds.includes('floor_replacer') && item.config.floorSample) {
        sampleBase64 = item.config.floorSample.split(',')[1];
      } else if (toolIds.includes('ceiling_replacer') && item.config.ceilingSample) {
        sampleBase64 = item.config.ceilingSample.split(',')[1];
      }

      // Check for manual lasso or selective wall mask
      let usedMask = customMaskBase64;
      if (!usedMask && item.config.lassoMask) {
        usedMask = item.config.lassoMask.split(',')[1];
      }
      if (!usedMask && item.assignedTools.includes('wall_unifier') && item.config.wallMask) {
        usedMask = item.config.wallMask.split(',')[1];
      }

      let combinedPrompts = activePresets.map(preset => {
          let p = preset.id === 'custom_edit' && item.config.enhancedPrompt ? item.config.enhancedPrompt : preset.prompt;
          if (preset.id === 'furniture' || preset.id === 'p360_vstaging_3d') {
            p = p.replace('{style}', item.config.stagingStyle || FURNITURE_STYLES[0]);
            p = p.replace('{room}', item.config.stagingRoom || STAGING_ROOMS[0]);
            if (item.config.stageDescriptor) p += ` Scene Context: ${item.config.stageDescriptor}`;
            p += ' [STRICT_WALL_COLOR_LOCK]: Absolutely DO NOT change, repaint, tint, or modify any wall colors, accent walls, or wall paint finishes. Keep all existing wall paint colors, sheen, and textures 100% identical to the source image. [STRICT_STRUCTURAL_PRESERVATION]: Absolutely zero added walls or moved walls. Keep all room boundaries, doorways, windows, and ceiling height 100% identical. Only place freestanding furniture, rugs, and decor on existing floor space.';
          }
          else if (preset.id === 'style_swapper' || preset.id === 'p360_style_swap') {
            const chosenStyle = item.config.swapStyle || item.config.stagingStyle || FURNITURE_STYLES[0];
            const chosenRoom = item.config.stagingRoom || STAGING_ROOMS[0];
            p = p.replace('{style}', chosenStyle);
            p += ` Target Room Type: ${chosenRoom}.`;
            if (item.config.swapDescriptor) p += ` Room Descriptor: ${item.config.swapDescriptor}`;
            p += ' [STRICT_FLOOR_MATERIAL_AND_FINISH_LOCK]: ABSOLUTELY DO NOT change, replace, bleach, restain, re-tile, or alter ANY existing flooring material. Hardwood grain, plank width, plank direction, wood stain color, tile pattern, carpet texture, and grout MUST remain 100% identical and unchanged to the source image. Any newly uncovered floor where old rugs or furniture were removed MUST seamlessly match the surrounding floor material identically. [STRICT_WALL_COLOR_LOCK]: Absolutely DO NOT change, repaint, tint, or modify any wall colors, accent walls, or wall paint finishes. Keep all existing wall paint colors, sheen, and textures 100% identical to the source image. [STRICT_STRUCTURAL_PRESERVATION]: Absolutely zero added walls or moved walls. Keep all original room geometry and architectural boundaries 100% untouched. Only place freestanding furniture, rugs, and decor on existing floor space.';
          }
          else if (preset.id === 'wall_unifier') {
            const hexColor = item.config.wallColor || '#f1f1f1';
            const colorDescription = hexToColorDescription(hexColor);
            p = p.replace('{color}', `${colorDescription} (Hex: ${hexColor})`);
            if (item.config.wallMask) {
              p += ` SELECTIVE ACCENT WALL MODE: Apply the exact color ${colorDescription} (Hex: ${hexColor}) strictly and exclusively to the painted/masked wall surfaces. Do NOT recolor or touch any unmasked walls, ceiling, trim, floor, or adjacent surfaces. Maintain original lighting, shadows, and architectural details across the entire room.`;
            } else {
              p += ` REPAINT ALL INTERIOR WALLS: Repaint all interior drywall and wall surfaces uniformly in ${colorDescription} (Hex: ${hexColor}). Keep existing flooring, trim, ceilings, windows, and furnishings completely unaltered and structurally identical.`;
            }
          }
          else if (preset.id === 'sunset') {
            p = 'GOLDEN HOUR SUNSET REAL ESTATE PROTOCOL: [TASK]: Transform the daytime scene into a stunning, bright golden-hour sunset architectural photo. [ATMOSPHERIC LIGHTING & EXPOSURE]: Fill the sky with dramatic, vivid golden-hour sunset clouds featuring rich amber, warm gold, and soft pink/apricot tones. CRITICAL: Maintain bright ambient exposure and clear visibility across the entire property facade, roof, lawn, and driveway. STRICTLY FORBIDDEN: DO NOT render nighttime, dark blue hour, pitch black skies, or underexposed shadows. This is a bright golden-hour sunset shot with full daytime clarity and warm sunset warmth. [WINDOW & EXTERIOR LIGHTS]: Turn on warm, inviting architectural lighting inside windows and exterior porch/wall lights with a cozy 2700K golden glow. [STRUCTURAL PRESERVATION]: Keep the house facade, materials, walls, windows, rooflines, trim, doors, and surroundings 100% identical and intact.';
          }
          if (['auto_declutter', 'declutter_direct'].includes(preset.id)) {
            return p;
          }
          if (preset.id === 'p360_auto_declutter') {
            return `[PROTOCOL_360_DECLUTTER]: ${p}`;
          }
          return `[PROTOCOL_${preset.id.toUpperCase()}]: ${p}`;
      }).filter(Boolean).join('\n');

      // COST OPTIMIZATION: Surgical Mask Caching
      // If this is an atmospheric task and we don't have a mask yet, generate and cache it.
      // Day to Dusk / Sunset / Astro Dusk / Sunny Skies require global lighting and atmospheric transformations to cast sunlight, so we DO NOT use a static sky mask.
      const isSunCastingTask = activePresets.some(p => p.id === 'sun_drenched') ||
                               combinedPrompts.toUpperCase().includes('OUTDOOR SUN CASTING') ||
                               combinedPrompts.toUpperCase().includes('SUN DRENCHED');
      const isSunnySkiesTask = !isSunCastingTask && (
                               activePresets.some(p => p.id === 'sunny_skies' || p.id === 'p360_sunny_skies') ||
                               combinedPrompts.toUpperCase().includes('OUTDOOR SUNNY SKIES') ||
                               combinedPrompts.toUpperCase().includes('OUTDOOR SUN') ||
                               combinedPrompts.toUpperCase().includes('OUTDOOR_SUN') ||
                               combinedPrompts.toUpperCase().includes('SUNNY SKIES') ||
                               combinedPrompts.toUpperCase().includes('SUNNY_SKIES'));

      // 10% Sky Coverage detection & Sunny Splash fallback
      let itemPreAnalysis = item.preAnalysis;
      if (isSunnySkiesTask && (!itemPreAnalysis || typeof itemPreAnalysis.skyPercentage !== 'number')) {
        try {
          const isKnownInterior = itemPreAnalysis?.sceneType === 'interior' ||
                                  ['living room', 'bedroom', 'kitchen', 'dining room', 'bathroom', 'den', 'office', 'rec room', 'room'].some(r => itemPreAnalysis?.roomType?.toLowerCase().includes(r));
          const hasWindows = itemPreAnalysis?.hasWindows;

          const calculatedSkyPercent = (isKnownInterior && hasWindows === false) 
            ? 0 
            : await calculateSkyCoveragePercent(
                `data:${mimeType};base64,${sourceBase64}`,
                itemPreAnalysis?.sceneType || (isKnownInterior ? 'interior' : undefined),
                hasWindows
              );

          itemPreAnalysis = {
            ...(itemPreAnalysis || {
              roomType: 'room',
              sceneType: (calculatedSkyPercent < 10 ? 'interior' : 'exterior') as 'interior' | 'exterior',
              occupancy: 'vacant' as const,
              lightingCondition: 'natural',
              clutterLevel: 'none' as const,
              detectedFeatures: [],
              recommendedTools: [],
              summary: 'Automatic sky percentage calculation',
              timestamp: Date.now()
            }),
            skyPercentage: calculatedSkyPercent,
            hasWindows: itemPreAnalysis?.hasWindows ?? (calculatedSkyPercent > 0 && calculatedSkyPercent < 10),
            timestamp: itemPreAnalysis?.timestamp || Date.now()
          };
          // Persist calculated sky coverage
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, preAnalysis: itemPreAnalysis } : i));
        } catch (skyCalcErr) {
          console.warn("Client sky coverage estimation fallback:", skyCalcErr);
        }
      }

      const isAtmospheric = !isSunnySkiesTask &&
                            (combinedPrompts.toUpperCase().includes('WEATHER') || 
                             combinedPrompts.toUpperCase().includes('SUNBURST')) && 
                            !combinedPrompts.toUpperCase().includes('DAY TO DUSK') &&
                            !combinedPrompts.toUpperCase().includes('ASTRO DUSK') &&
                            !combinedPrompts.toUpperCase().includes('SUNSET') &&
                            !combinedPrompts.toUpperCase().includes('STYLE SWAP') &&
                            !combinedPrompts.toUpperCase().includes('DECLUTTER') &&
                            !combinedPrompts.toUpperCase().includes('FURNITURE');

      if (isAtmospheric && !usedMask) {
        let maskTarget: 'sky' | 'surfaces' | 'windows' = 'sky';
        if (combinedPrompts.toUpperCase().includes('WINDOW') || combinedPrompts.toUpperCase().includes('EXTERIOR WINDOW')) {
            maskTarget = 'windows';
        } else if (combinedPrompts.toUpperCase().includes('SUNBURST') || combinedPrompts.toUpperCase().includes('SUNNY SPLASH')) {
            maskTarget = 'surfaces';
        }

        let existingMask: string | undefined;
        if (maskTarget === 'surfaces') existingMask = item.cachedMaskSurfaces;
        else if (maskTarget === 'windows') existingMask = item.config.lassoMask;
        else existingMask = item.cachedMaskSky;

        if (existingMask) {
          usedMask = existingMask.split(',')[1];
        } else {
          try {
            // Use a downscaled version for the mask generation to save tokens
            const { base64: maskSourceBase64 } = await processImageForApi(`data:${mimeType};base64,${sourceBase64}`, 1024);
            const maskUrl = await generateSurgicalMask(maskSourceBase64, mimeType, maskTarget);
            usedMask = maskUrl.split(',')[1];
            // Cache it for future edits of this image
            setItems(prev => prev.map(i => {
                if (i.id === item.id) {
                    if (maskTarget === 'surfaces') return { ...i, cachedMaskSurfaces: maskUrl };
                    if (maskTarget === 'windows') return { ...i, config: { ...i.config, lassoMask: maskUrl } };
                    return { ...i, cachedMaskSky: maskUrl };
                }
                return i;
            }));
          } catch (e) {
            console.warn("Mask generation failed, proceeding without lock.", e);
          }
        }
      }

      const hasDepersonalize = activePresets.some(p => p.id === 'virtual_depersonalize');
      if (hasDepersonalize && !usedMask) {
        const existingDepersonalizeMask = item.cachedMaskDepersonalize;
        if (existingDepersonalizeMask) {
          usedMask = existingDepersonalizeMask.split(',')[1];
        } else {
          try {
            console.log("[Depersonalize] Detecting personal photos for surgical in-frame mask generation...");
            const depersonalizeMaskUrl = await generateDepersonalizeMask(sourceBase64!, mimeType, item.dimensions?.width, item.dimensions?.height);
            if (depersonalizeMaskUrl) {
              usedMask = depersonalizeMaskUrl.split(',')[1];
              setItems(prev => prev.map(i => i.id === item.id ? { ...i, cachedMaskDepersonalize: depersonalizeMaskUrl } : i));
              console.log("[Depersonalize] Surgical mask generated: 100% of furniture and wall colors will remain untouched!");
            } else {
              console.log("[Depersonalize] No framed photos detected; applying strict zero-furniture and zero-wall-color prompt constraints.");
            }
          } catch (depErr) {
            console.warn("[Depersonalize] Mask generation error, falling back to prompt lock:", depErr);
          }
        }
      }

      let resultUrl: string;

      // TARGETED 1K RECTILINEAR CROP + REPROJECTION FOR 360 PANORAMAS:
      // Lowest API cost ($), 100% native resolution (up to 8K) unedited pixels preserved!
      const is360Pano = item.is360 || (item.dimensions && Math.abs(item.dimensions.width / item.dimensions.height - 2) < 0.2) || activePresets.some(p => p.id.startsWith('p360_'));
      const isTargeted360Transform = is360Pano && activePresets.some(p => ['p360_vstaging_3d', 'p360_style_swap', 'p360_auto_declutter', 'furniture', 'style_swapper', 'auto_declutter'].includes(p.id));

      if (isTargeted360Transform) {
        const yaw = item.config.panoYaw ?? 0;
        const pitch = item.config.panoPitch ?? -5;
        const fov = item.config.panoFov ?? 90;

        const fullEquirectangularUrl = `data:${mimeType};base64,${sourceBase64}`;
        // Step 1: Project targeted rectilinear crop matching native panorama resolution (2048x1536 for 4K pano)
        const panoDims = item.dimensions || { width: 4096, height: 2048 };
        const targetCropW = panoDims.width >= 3000 ? 2048 : (panoDims.width >= 2000 ? 1536 : 1024);
        const targetCropH = Math.round(targetCropW * 0.75);

        const projectedUrl = await project360ToRectilinear(fullEquirectangularUrl, yaw, pitch, fov, targetCropW, targetCropH);
        const rectBase64 = projectedUrl.split(',')[1];

        let targetMask = usedMask;
        if (!targetMask && activePresets.some(p => p.id === 'p360_auto_declutter')) {
          try {
            const rawMaskUrl = await generateSurgicalMask(rectBase64, 'image/png', 'clutter');
            const { dilatedDataUrl, coverageRatio, isCoverageValid } = await dilateMask(rawMaskUrl, 20);
            console.log(`[360 Declutter Batch] Mask Coverage: ${(coverageRatio * 100).toFixed(2)}% (valid: ${isCoverageValid})`);
            if (isCoverageValid) {
              targetMask = dilatedDataUrl.split(',')[1];
            } else {
              console.warn(`[360 Declutter Batch] Coverage too sparse (<0.8%). Falling back to full-perspective depopulation with guidance scale 4.5.`);
              targetMask = null;
            }
          } catch (maskErr) {
            console.warn("Auto-clutter mask extraction for 360 failed, server will handle mask:", maskErr);
          }
        }

        // Step 2: Run AI editing at high clarity matching native resolution
        const stagedRectilinearUrl = await editImageWeather(
          rectBase64,
          'image/png',
          combinedPrompts,
          'gemini-3.1-flash-image',
          targetMask,
          { width: targetCropW, height: targetCropH },
          sampleBase64,
          true
        );

        // Pre-sharpen the rectilinear staged patch before spherical re-projection
        let sharpStagedUrl = stagedRectilinearUrl;
        try {
          sharpStagedUrl = await sharpenImage(stagedRectilinearUrl, 0.20);
        } catch (_) {}

        // Step 3: Reproject edited perspective back into original full-resolution equirectangular canvas
        resultUrl = await reprojectRectilinearTo360(
          fullEquirectangularUrl,
          sharpStagedUrl,
          yaw,
          pitch,
          fov,
          28
        );
      } else {
        resultUrl = await editImageWeather(
          sourceBase64!, 
          mimeType, 
          combinedPrompts, 
          'gemini-3.1-flash-image', 
          usedMask, 
          item.dimensions, 
          sampleBase64, 
          false, 
          itemPreAnalysis
        );
      }
      
      // Mandatory safeguard for manual lasso/mask edits:
      // Guarantee that unmasked areas of the source photo are 100% preserved and never dropped or blacked out
      if (usedMask) {
        try {
          const originalDataUrl = `data:${mimeType};base64,${sourceBase64}`;
          const maskDataUrl = usedMask.startsWith('data:') ? usedMask : `data:image/png;base64,${usedMask}`;
          resultUrl = await applySurgicalComposite(originalDataUrl, resultUrl, maskDataUrl);
        } catch (compErr) {
          console.warn("Client surgical composite pass failed:", compErr);
        }
      }
      
      // Automatically apply auto-blending sharpening (+20% clarity) to the final output
      try {
        resultUrl = await sharpenImage(resultUrl, 0.20);
      } catch (sharpErr) {
        console.warn("Auto-sharpening failed, using unsharpened image:", sharpErr);
      }

      const TRANSFORMATIVE_TOOLS = ['furniture', 'p360_vstaging_3d', 'style_swapper', 'p360_style_swap', 'auto_declutter', 'p360_auto_declutter', 'sunset', 'lush_lawn', 'seasonal_change', 'snow_removal', 'floor_replacer', 'ceiling_replacer', 'cable_remover'];
      const hasEmptyRoom = activePresets.some(p => p.id === 'empty_room');
      const hasWallUnifier = activePresets.some(p => p.id === 'wall_unifier');
      const hasStyleSwap = activePresets.some(p => ['style_swapper', 'p360_style_swap'].includes(p.id));
      const hasStagingOrSwap = activePresets.some(p => ['furniture', 'p360_vstaging_3d', 'style_swapper', 'p360_style_swap'].includes(p.id));
      const hasDeclutter = activePresets.some(p => ['auto_declutter', 'p360_auto_declutter'].includes(p.id));
      const hasSunset = activePresets.some(p => p.id === 'sunset');
      const hasLushLawn = activePresets.some(p => p.id === 'lush_lawn');
      const hasSeasonShift = activePresets.some(p => p.id === 'seasonal_change');
      const hasSnowRemoval = activePresets.some(p => p.id === 'snow_removal');
      const hasAnyWatermarkTool = activePresets.some(p => p.hasAiWatermark || TRANSFORMATIVE_TOOLS.includes(p.id));

      if (hasStyleSwap || (!hasEmptyRoom && !hasWallUnifier && hasAnyWatermarkTool)) {
         let watermarkText: string | undefined;
         if (hasStagingOrSwap) {
           watermarkText = "ai virtually staged";
         } else if (hasDeclutter) {
           watermarkText = "digitally decluttered";
         } else if (hasSunset) {
           watermarkText = "ai day to dusk";
         } else if (hasLushLawn) {
           watermarkText = "ai enhanced greenery";
         } else if (hasSeasonShift) {
           watermarkText = "ai seasonal enhancement";
         } else if (hasSnowRemoval) {
           watermarkText = "ai digital snow removal";
         } else {
           watermarkText = "ai enhanced";
         }
         resultUrl = await applyWatermarkToDataUrl(resultUrl, true, true, watermarkText);
      }
      
      const newAsset: GeneratedAsset = { 
        url: resultUrl, 
        type: 'image', 
        timestamp: Date.now(),
        tools: activePresets.map(p => p.id)
      };
      const primaryPreset = activePresets[0];
      const combinedToolIds = activePresets.map(p => p.id);
      const combinedTokenCost = calculateTokensForTools(combinedToolIds);
      const combinedLabel = activePresets.length > 1
        ? `${activePresets.map(p => p.label).join(' + ')} (Combined Call)`
        : primaryPreset?.label || 'Image Process';

      recordTokensUsed(primaryPreset?.id || 'combined_edit', combinedTokenCost, item.id, combinedLabel);
      setTokenGuardSettings(loadTokenGuardSettings());
      setItems(prev => prev.map(i => {
          if (i.id === item.id) {
              const truncatedHistory = i.history.slice(0, i.currentHistoryIndex + 1);
              return { ...i, status: 'complete', history: [...truncatedHistory, newAsset], currentHistoryIndex: truncatedHistory.length, assignedTools: overrideTools ? i.assignedTools : [] };
          }
          return i;
      }));
      return resultUrl;
    } catch (err: any) {
      const errorMsg = stringifyError(err);
      if (
        errorMsg.includes("Requested entity was not found") || 
        errorMsg.includes("Quota") || 
        errorMsg.includes("quota") || 
        errorMsg.includes("429") || 
        errorMsg.includes("RESOURCE_EXHAUSTED")
      ) {
        setHasApiKey(false);
        handleOpenKeySelector();
      }
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: errorMsg } : i));
      return null;
    }
  };

  const handleGenerate = async (forceOverride = false) => {
    const targets = items.filter(i => i.assignedTools.length > 0);
    if (targets.length === 0) return;

    const estimatedBatchTokens = calculateBatchEstimatedTokens(targets);

    // Token Guard Safety Cap Interception Check (Admin only)
    if (isAdmin && !forceOverride && tokenGuardSettings.enabled && !tokenGuardSettings.overriddenToday) {
      const projectedTotal = (tokenGuardSettings.usedToday || 0) + estimatedBatchTokens;
      if (projectedTotal > (tokenGuardSettings.dailyLimit || 125000)) {
        setPendingBatchTokens(estimatedBatchTokens);
        setShowTokenGuardInterception(true);
        return;
      }
    }

    // Client Credit Gate: require login and sufficient credits for paying clients
    if (!isAdmin) {
      if (!user) {
        setShowAuthModal(true);
        return;
      }
      // Calculate total credits needed: 90 credits for videos/panos, 30 credits per standard tool edit
      let totalCreditsNeeded = 0;
      targets.forEach(t => {
        const hasPanoOrVideo = t.is360 || t.assignedTools.some(tool => tool.includes('video') || tool.startsWith('p360_'));
        totalCreditsNeeded += hasPanoOrVideo ? 90 : Math.max(30, t.assignedTools.length * 30);
      });

      if ((profile?.credits ?? 0) < totalCreditsNeeded) {
        setCustomAlert({
          title: "Insufficient Credits",
          message: `This batch requires ${totalCreditsNeeded} credits, but your account has ${profile?.credits ?? 0}. Please top up your credit balance to run this generation.`
        });
        setShowPricingModal(true);
        return;
      }

      // Deduct credits with audit trail
      const deducted = await deductCredits(totalCreditsNeeded, `Generated AI edits for ${targets.length} image(s)`);
      if (!deducted) {
        setCustomAlert({
          title: "Payment Required",
          message: "Unable to deduct credits. Please check your account balance or top up."
        });
        setShowPricingModal(true);
        return;
      }
    }

    setIsGenerating(true);
    const generationTasks = targets.map(async (item) => {
      const hasSunny = item.assignedTools.includes('sunny_skies');
      const hasDusk = item.assignedTools.includes('sunset');
      
      // SURGICAL SEQUENCE CHAIN: EMPTY -> STAGE
      const stagingTools = ['furniture', 'p360_vstaging_3d', 'style_swapper', 'p360_style_swap'];
      const hasEmpty = item.assignedTools.includes('empty_room') || !!item.config?.emptyRoomFirst;
      const activeStagingTool = item.assignedTools.find(t => stagingTools.includes(t));

      if (hasSunny && hasDusk) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, assignedTools: [] } : i));
        const sunnyId = Math.random().toString(36).substring(7);
        const duskId = Math.random().toString(36).substring(7);
        const sunnyItem: ImageItem = { ...item, id: sunnyId, file: item.file, previewUrl: item.previewUrl, selected: false, status: 'pending', dateAdded: Date.now(), assignedTools: ['sunny_skies'], history: [], currentHistoryIndex: -1 };
        setItems(prev => {
          const index = prev.findIndex(i => i.id === item.id);
          const next = [...prev];
          next.splice(index + 1, 0, sunnyItem);
          return next;
        });
        const sunnyResultUrl = await runGenerationForItem(sunnyItem, null, ['sunny_skies']);
        if (!sunnyResultUrl) return;
        const duskItem: ImageItem = { ...sunnyItem, id: duskId, file: item.file, base64: sunnyResultUrl.split(',')[1], previewUrl: sunnyResultUrl, history: [], currentHistoryIndex: -1, assignedTools: ['sunset'], dateAdded: Date.now() + 1 };
        setItems(prev => {
          const index = prev.findIndex(i => i.id === sunnyId);
          const next = [...prev];
          next.splice(index + 1, 0, duskItem);
          return next;
        });
        return runGenerationForItem(duskItem, null, ['sunset']);
      } else if (hasEmpty && activeStagingTool) {
        // Implementation of EMPTY -> STAGE chain
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, assignedTools: [] } : i));
        const emptyId = Math.random().toString(36).substring(7);
        const stagedId = Math.random().toString(36).substring(7);
        
        const emptyItem: ImageItem = { ...item, id: emptyId, file: item.file, previewUrl: item.previewUrl, selected: false, status: 'pending', dateAdded: Date.now(), assignedTools: ['empty_room'], history: [], currentHistoryIndex: -1 };
        
        setItems(prev => {
          const index = prev.findIndex(i => i.id === item.id);
          const next = [...prev];
          next.splice(index + 1, 0, emptyItem);
          return next;
        });

        const emptyResultUrl = await runGenerationForItem(emptyItem, null, ['empty_room']);
        if (!emptyResultUrl) return;

        // Use the empty result as the source for staging
        const stagedItem: ImageItem = { ...emptyItem, id: stagedId, file: item.file, base64: emptyResultUrl.split(',')[1], previewUrl: emptyResultUrl, history: [], currentHistoryIndex: -1, assignedTools: [activeStagingTool], dateAdded: Date.now() + 1 };
        
        setItems(prev => {
          const index = prev.findIndex(i => i.id === emptyId);
          const next = [...prev];
          next.splice(index + 1, 0, stagedItem);
          return next;
        });

        return runGenerationForItem(stagedItem, null, [activeStagingTool]);
      } else {
        const needsDuplicate = item.autoDuplicate || item.assignedTools.some(tool => 
          ['furniture', 'p360_vstaging_3d', 'style_swapper', 'p360_style_swap', 'virtual_depersonalize', 'lush_lawn', 'sunset', 'empty_room', 'auto_declutter', 'p360_auto_declutter', 'furniture_build_video', 'dawn_to_dusk_video', 'sunny_skies_video', 'custom_video'].includes(tool)
        );
        if (needsDuplicate) {
          const duplicateId = Math.random().toString(36).substring(7);
          const duplicateItem: ImageItem = { ...item, id: duplicateId, file: item.file, previewUrl: item.previewUrl, selected: false, status: 'pending', dateAdded: Date.now(), history: [], currentHistoryIndex: -1 };
          setItems(prev => {
            const index = prev.findIndex(i => i.id === item.id);
            const next = [...prev];
            next[index] = { ...next[index], assignedTools: [] };
            next.splice(index + 1, 0, duplicateItem);
            return next;
          });
          return runGenerationForItem(duplicateItem);
        } else {
          return runGenerationForItem(item);
        }
      }
    });
    await Promise.all(generationTasks);
    setIsGenerating(false);
  };

  const handleToggleSelect = useCallback((id: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const isSelecting = !item.selected;
        return { 
          ...item, 
          selected: isSelecting,
          selectionOrder: isSelecting ? Date.now() : undefined 
        };
      }
      return item;
    }));
    setActiveItemId(id); 
  }, []);

  const handleSelectAll = () => setItems(prev => prev.map((item, idx) => ({ 
    ...item, 
    selected: true,
    selectionOrder: item.selectionOrder || (Date.now() + idx)
  })));

  const handleSelectNone = () => setItems(prev => prev.map(item => ({ 
    ...item, 
    selected: false,
    selectionOrder: undefined
  })));

  const handleRemoveImage = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItems(prev => {
      const filtered = prev.filter(item => item.id !== id);
      if (activeItemId === id) setActiveItemId(filtered.length > 0 ? filtered[0].id : null);
      return filtered;
    });
  }, [activeItemId]);

  const handleDeleteSelected = useCallback(() => {
    const selected = items.filter(i => i.selected);
    if (selected.length === 0) return;
    setCustomConfirm({
      title: "Delete Selected Images",
      message: `Are you sure you want to remove ${selected.length} selected images?`,
      confirmText: "Delete",
      cancelText: "Cancel",
      onConfirm: () => {
        setItems(prev => {
          const filtered = prev.filter(item => !item.selected);
          if (activeItemId && prev.find(i => i.id === activeItemId)?.selected) {
             setActiveItemId(filtered.length > 0 ? filtered[0].id : null);
          }
          return filtered;
        });
        setCustomConfirm(null);
      }
    });
  }, [items, activeItemId]);

  const handleDuplicateImage = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItems(prev => {
      const index = prev.findIndex(item => item.id === id);
      if (index === -1) return prev;
      const itemToDuplicate = prev[index];
      const duplicate: ImageItem = { ...itemToDuplicate, id: Math.random().toString(36).substring(7), selected: false, dateAdded: Date.now(), history: [...itemToDuplicate.history], currentHistoryIndex: itemToDuplicate.currentHistoryIndex, assignedTools: [...itemToDuplicate.assignedTools] };
      const next = [...prev];
      next.splice(index + 1, 0, duplicate);
      return next;
    });
  }, []);

  const handleBatchDownload = async () => {
    const selectedTargets = items.filter(i => i.selected);
    if (selectedTargets.length === 0) return;
    setIsZipping(true);
    try {
      const results = await Promise.all(selectedTargets.map(async (item, index) => {
        const currentAsset = item.currentHistoryIndex >= 0 ? item.history[item.currentHistoryIndex] : null;
        const sourceUrl = currentAsset?.url || item.previewUrl;
        if (currentAsset?.type === 'video') {
            const resp = await fetch(currentAsset.url);
            const blob = await resp.blob();
            const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
            return [{ name: `reels/${item.file.name.split('.')[0]}-${index+1}.${ext}`, blob }];
        }
        
        const processedUrl = sourceUrl;
        const dims = await getImageDimensions(processedUrl);
        const baseName = item.file.name.split('.')[0];
        const ext = item.file.type?.split('/')[1] || 'jpg';
        const targetRatio = item.dimensions ? item.dimensions.width / item.dimensions.height : (dims.width / dims.height);
        const originalW = item.dimensions?.width || dims.width;
        const originalH = item.dimensions?.height || dims.height;

        // CLIENT SIDE ONLY: Export strictly in the exact original resolution the image was uploaded in
        if (!isAdmin) {
          const clientW = originalW;
          const clientH = originalH || Math.round(clientW / targetRatio);
          const clientBlob = await resizeAndProcessImage(
            processedUrl,
            clientW,
            clientH,
            item.file.type || 'image/jpeg',
            false,
            true,
            72,
            0.98
          );
          return [{ name: `${baseName}-${index + 1}.${ext}`, blob: clientBlob }];
        }
        
        // ADMIN SIDE: Master Print version (Ultra High Resolution 4000px+, 300 DPI, High Fidelity 0.98 quality)
        const printW = item.is360 ? 6144 : Math.max(dims.width, originalW, 4000);
        const printH = Math.round(printW / targetRatio);
        const printBlob = await resizeAndProcessImage(processedUrl, printW, printH, item.file.type || 'image/jpeg', false, true, 300, 0.98);
        
        // ADMIN SIDE: Web version (High-Definition Web Gallery 2048px max width, 72 DPI, 0.88 quality)
        const finalWebW = item.is360 ? 3072 : 2048; 
        const finalWebH = Math.round(finalWebW / targetRatio);
        const webBlob = await resizeAndProcessImage(processedUrl, finalWebW, finalWebH, item.file.type || 'image/jpeg', false, true, 72, 0.88);
        
        return [{ name: `print/${baseName}-${index + 1}.${ext}`, blob: printBlob }, { name: `for web/${baseName}-${index + 1}.${ext}`, blob: webBlob }];
      }));
      const zipBlob = await createZipArchive(results.flat());
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a'); a.href = url; a.download = `PMD-Studio-Package.zip`; a.click(); URL.revokeObjectURL(url);
    } catch (err) { 
      console.error("Batch download failed", err); 
      setCustomAlert({
        title: "Export Failed",
        message: "Export failed. Please check console for details."
      });
    } finally { setIsZipping(false); }
  };

  const handleRevert = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setItems(prev => prev.map(item => item.id === id ? { ...item, history: [], currentHistoryIndex: -1, status: 'pending', assignedTools: [] } : item));
  };

  const handleUndo = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItems(prev => prev.map(item => (item.id === id && item.currentHistoryIndex >= 0) ? { ...item, currentHistoryIndex: item.currentHistoryIndex - 1 } : item));
  };

  const handleRedo = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItems(prev => prev.map(item => (item.id === id && item.currentHistoryIndex < item.history.length - 1) ? { ...item, currentHistoryIndex: item.currentHistoryIndex + 1 } : item));
  };

  const handleSharpenImage = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const item = items.find(i => i.id === id);
    if (!item) return;

    setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'processing' } : i));

    try {
      const currentAsset = item.currentHistoryIndex >= 0 ? item.history[item.currentHistoryIndex] : null;
      const sourceUrl = currentAsset?.url || item.previewUrl;

      // Perform custom high-fidelity sharpening pass (+20% clarity)
      const sharpenedUrl = await sharpenImage(sourceUrl, 0.20);

      const newAsset: GeneratedAsset = { url: sharpenedUrl, type: 'image', timestamp: Date.now() };
      setItems(prev => prev.map(i => {
        if (i.id === id) {
          const truncatedHistory = i.history.slice(0, i.currentHistoryIndex + 1);
          return { 
            ...i, 
            status: 'complete', 
            history: [...truncatedHistory, newAsset], 
            currentHistoryIndex: truncatedHistory.length 
          };
        }
        return i;
      }));
    } catch (err) {
      console.error("Manual sharpening failed:", err);
      setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'error', error: "Sharpening failed." } : i));
    }
  };

  const handleDownloadSingle = async (item: ImageItem, e: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDownloadingId(item.id);
    try {
      const currentAsset = item.currentHistoryIndex >= 0 ? item.history[item.currentHistoryIndex] : null;
      const sourceUrl = currentAsset?.url || item.previewUrl;
      if (currentAsset?.type === 'video') {
          const a = document.createElement('a'); a.href = sourceUrl; a.download = `reel-${item.file.name.split('.')[0]}.mp4`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
      } else {
          const processedUrl = sourceUrl;
          const dims = await getImageDimensions(processedUrl);
          const targetRatio = item.dimensions ? item.dimensions.width / item.dimensions.height : (dims.width / dims.height);
          const originalW = item.dimensions?.width || dims.width;
          const originalH = item.dimensions?.height || dims.height;

          // Client side: Export in the original uploaded resolution
          // Admin side: Export in master print resolution (4000px+, 300 DPI)
          let exportW: number;
          let exportH: number;
          let dpi = 300;
          let quality = 0.98;

          if (!isAdmin) {
            exportW = originalW;
            exportH = originalH || Math.round(exportW / targetRatio);
            dpi = 72;
          } else {
            exportW = item.is360 ? 6144 : Math.max(dims.width, originalW, 4000);
            exportH = Math.round(exportW / targetRatio);
          }

          const blob = await resizeAndProcessImage(processedUrl, exportW, exportH, item.file.type || 'image/jpeg', false, true, dpi, quality);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `pmd-studio-${item.file.name.split('.')[0]}.${item.file.type?.split('/')[1] || 'jpg'}`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      }
    } catch (err) { console.error(err); } finally { setDownloadingId(null); }
  };

  const handleSaveMaskedImage = (savedContent: string) => {
    if (!editingItemId) return;
    if (maskEditorMode === 'erase') {
        const item = items.find(i => i.id === editingItemId);
        if (item) runGenerationForItem(item, savedContent, ['object_removal']);
    } else if (maskEditorMode === 'mask') {
        // Special case: defining a selection area for Custom Tool
        setItems(prev => prev.map(item => {
          if (item.id === editingItemId) {
            return { ...item, config: { ...item.config, lassoMask: savedContent } };
          }
          return item;
        }));
    } else if (maskEditorMode === 'wall_mask') {
        // Special case: defining selective walls for Wall Unifier tool
        setItems(prev => prev.map(item => {
          if (item.id === editingItemId) {
            return { ...item, config: { ...item.config, wallMask: savedContent } };
          }
          return item;
        }));
    } else {
        setItems(prev => prev.map(item => {
          if (item.id === editingItemId) {
            const truncatedHistory = item.history.slice(0, item.currentHistoryIndex + 1);
            return { ...item, history: [...truncatedHistory, { url: savedContent, type: 'image', timestamp: Date.now() }], currentHistoryIndex: truncatedHistory.length, status: 'complete' };
          }
          return item;
        }));
    }
    setEditingItemId(null);
  };

  const handleSavePanoOrientation = (yaw: number, pitch: number, fov: number) => {
     if (!panoEditingItemId) return;
     setItems(prev => prev.map(i => i.id === panoEditingItemId ? {
       ...i,
       config: { ...i.config, panoYaw: yaw, panoPitch: pitch, panoFov: fov }
     } : i));
  };

  const handleUpdatePanoSource = (newEquirectangularUrl: string) => {
    if (!panoEditingItemId) return;
    const newAsset: GeneratedAsset = {
      url: newEquirectangularUrl,
      type: 'image',
      timestamp: Date.now(),
      tools: ['p360_recenter']
    };
    setItems(prev => prev.map(i => {
      if (i.id === panoEditingItemId) {
        const truncatedHistory = i.history.slice(0, i.currentHistoryIndex + 1);
        return {
          ...i,
          history: [...truncatedHistory, newAsset],
          currentHistoryIndex: truncatedHistory.length,
          previewUrl: newEquirectangularUrl
        };
      }
      return i;
    }));
  };

  const handleSavePanoEdit = async (
    projected1KUrl: string,
    yaw: number,
    pitch: number,
    fov: number,
    toolId?: string,
    toolConfig?: any
  ) => {
     if (!panoEditingItemId) return;
     const item = items.find(i => i.id === panoEditingItemId);
     if (!item) return;
     setPanoEditingItemId(null);
     setIsGenerating(true);

     // Mark processing & save view orientation
     setItems(prev => prev.map(i => i.id === item.id ? {
       ...i,
       status: 'processing',
       config: { ...i.config, panoYaw: yaw, panoPitch: pitch, panoFov: fov, ...toolConfig }
     } : i));

     try {
        const activeToolId = toolId || (item.assignedTools.length > 0 ? item.assignedTools[0] : 'p360_vstaging_3d');
        const preset = [...WEATHER_PRESETS, ...PANORAMA_PRESETS, ...VISUAL_STAGER_PRESETS].find(p => p.id === activeToolId) || PANORAMA_PRESETS[3];
        
        let prompt = preset.prompt;
        const room = toolConfig?.stagingRoom || item.config.stagingRoom || STAGING_ROOMS[0];
        const style = toolConfig?.stagingStyle || toolConfig?.swapStyle || item.config.stagingStyle || FURNITURE_STYLES[0];
        const descriptor = toolConfig?.stageDescriptor || toolConfig?.swapDescriptor || item.config.stageDescriptor;

        if (preset.id === 'furniture' || preset.id === 'p360_vstaging_3d') {
          prompt = prompt.replace('{style}', style).replace('{room}', room);
          if (descriptor) prompt += ` Scene Context: ${descriptor}`;
          prompt += ' [STRICT_WALL_COLOR_LOCK]: Absolutely DO NOT change, repaint, tint, or modify any wall colors, accent walls, or wall paint finishes. Keep all existing wall paint colors and textures 100% identical to the source photo. [STRICT_STRUCTURAL_PRESERVATION]: Zero added walls, zero moved walls. Preserve all existing walls, doors, windows, and boundaries 100% untouched. Only place freestanding furniture, rugs, and decor on existing floor space.';
        } else if (preset.id === 'style_swapper' || preset.id === 'p360_style_swap') {
          prompt = prompt.replace('{style}', style);
          if (descriptor) prompt += ` Room Descriptor: ${descriptor}`;
          prompt += ' [STRICT_FLOOR_LOCK]: ABSOLUTELY DO NOT change, restain, bleach, or alter any existing flooring material, wood planks, stain, tile, or carpet. Keep existing flooring 100% identical. [STRICT_WALL_COLOR_LOCK]: Absolutely DO NOT change, repaint, tint, or modify any wall colors, accent walls, or wall paint finishes. Keep all wall colors and textures 100% identical to the source image. [STRICT_STRUCTURAL_PRESERVATION]: Zero added walls, zero moved walls. Preserve all original architectural geometry 100% unchanged. Only place freestanding furniture, rugs, and decor on existing floor space.';
        } else if (preset.id === 'custom_edit' && toolConfig?.customPrompt) {
          prompt = toolConfig.customPrompt;
        }

        const rectBase64 = projected1KUrl.split(',')[1];
        
        let targetMask: string | null = toolConfig?.clutterMaskBase64 || null;

        if (preset.id === 'p360_auto_declutter' || activeToolId === 'p360_auto_declutter') {
          if (toolConfig?.declutterMode === 'loose_clutter') {
            if (!targetMask) {
              try {
                const rawMaskUrl = await generateSurgicalMask(rectBase64, 'image/png', 'clutter');
                const { dilatedDataUrl, coverageRatio, isCoverageValid } = await dilateMask(rawMaskUrl, 20);
                if (isCoverageValid) {
                  targetMask = dilatedDataUrl.split(',')[1];
                  prompt = "ARCHITECTURAL DECLUTTER: Surgically remove all loose clutter, mess, cables, boxes, dishes, and trash. Inpaint clean continuous architectural floor and surfaces matching surroundings.";
                }
              } catch (err) {
                console.warn("Clutter mask generation failed:", err);
              }
            }
          } else {
            // Full room depopulation mode: empty room, remove everything with enhanced guidance
            prompt = "ARCHITECTURAL 360 DECLUTTER: Completely vacant, empty room. All furniture, sofas, chairs, tables, desks, beds, rugs, carpets, boxes, electronics, and clutter are completely removed. Pristine, clean, continuous architectural hardwood floor and plain walls. Original architectural windows, ceilings, and room perspective strictly preserved.";
            targetMask = null;
          }
        }

        // Step 1: AI generation pass matching native resolution (2K for 4K panorama)
        let rectDims = { width: 2048, height: 1536 };
        try {
          rectDims = await getImageDimensions(projected1KUrl);
        } catch (_) {}

        const editedRectilinearUrl = await editImageWeather(
          rectBase64,
          'image/png',
          `[PROTOCOL_360_TARGETED_PERSPECTIVE]: ${prompt}`,
          'gemini-3.1-flash-image',
          targetMask,
          rectDims,
          null,
          true
        );

        // Pre-sharpen the rectilinear staging patch to ensure crisp furniture textures and edges
        let sharpStagedUrl = editedRectilinearUrl;
        try {
          sharpStagedUrl = await sharpenImage(editedRectilinearUrl, 0.22);
        } catch (_) {}

        // Step 2: Reproject back onto original full-res equirectangular canvas preserving all native pixels up to 8K
        const baseEquirectangularUrl = (item.currentHistoryIndex >= 0 && item.history[item.currentHistoryIndex]?.url)
          ? item.history[item.currentHistoryIndex].url
          : item.previewUrl;

        let final360Url = await reprojectRectilinearTo360(
          baseEquirectangularUrl,
          sharpStagedUrl,
          yaw,
          pitch,
          fov,
          28
        );

        // Step 3: Auto-sharpening for crisp architectural clarity
        try {
          final360Url = await sharpenImage(final360Url, 0.20);
        } catch (sharpErr) {
          console.warn("Sharpening failed:", sharpErr);
        }

        // Step 4: Apply watermark if transformative
        if (['p360_vstaging_3d', 'p360_style_swap', 'furniture', 'style_swapper'].includes(preset.id)) {
          final360Url = await applyWatermarkToDataUrl(final360Url, true, true, "ai virtually staged");
        } else if (['p360_auto_declutter', 'auto_declutter'].includes(preset.id)) {
          final360Url = await applyWatermarkToDataUrl(final360Url, true, true, "digitally decluttered");
        }

        recordTokensUsed(preset.id, undefined, item.id);
        setTokenGuardSettings(loadTokenGuardSettings());

        const newAsset: GeneratedAsset = {
          url: final360Url,
          type: 'image',
          timestamp: Date.now(),
          tools: [preset.id]
        };

        setItems(prev => prev.map(i => {
          if (i.id === item.id) {
            const truncatedHistory = i.history.slice(0, i.currentHistoryIndex + 1);
            return {
              ...i,
              status: 'complete',
              history: [...truncatedHistory, newAsset],
              currentHistoryIndex: truncatedHistory.length,
              assignedTools: []
            };
          }
          return i;
        }));
     } catch (err: any) {
        console.error("360 Reprojection error:", err);
        const errorMsg = stringifyError(err);
        if (
          errorMsg.includes("Requested entity was not found") || 
          errorMsg.includes("Quota") || 
          errorMsg.includes("quota") || 
          errorMsg.includes("429") || 
          errorMsg.includes("RESOURCE_EXHAUSTED")
        ) {
          setHasApiKey(false);
          handleOpenKeySelector();
        }
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: errorMsg } : i));
     } finally {
        setIsGenerating(false);
     }
  };

  const handleSendToSocialKit = () => {
    const selectedItems = items.filter(item => item.selected);
    // Sort by selectionOrder to respect the order in which the user picked them
    const sortedSelected = [...selectedItems].sort((a, b) => (a.selectionOrder || 0) - (b.selectionOrder || 0));
    
    const selectedImages = sortedSelected.map(item => {
      const activeAsset = item.currentHistoryIndex >= 0 && item.history ? item.history[item.currentHistoryIndex] : null;
      if (activeAsset && activeAsset.type === 'video') return activeAsset.url;
      const isVideo = item.file && (item.file.type?.startsWith('video/') || item.file.name?.toLowerCase().endsWith('.mp4'));
      if (isVideo) {
        const vid = item.history?.find(h => h.type === 'video');
        if (vid) return vid.url;
        return item.previewUrl;
      }
      return (item.currentHistoryIndex >= 0 ? item.history[item.currentHistoryIndex].url : item.previewUrl);
    });
    const selectedMasks = sortedSelected.map(item => item.cachedMask || '');
    
    if (selectedImages.length > 0) {
        setSocialAssets(prev => ({ 
            ...prev, 
            propertyImages: [...prev.propertyImages, ...selectedImages],
            propertyMasks: [...(prev.propertyMasks || []), ...selectedMasks]
        }));
        setActiveTab('social');
    }
  };

  const handleSendToSlideshow = () => {
    const selectedItems = items.filter(item => item.selected);
    // Sort by selectionOrder to respect the order in which the user picked them
    const sortedSelected = [...selectedItems].sort((a, b) => (a.selectionOrder || 0) - (b.selectionOrder || 0));
    
    if (sortedSelected.length > 0) {
      // convertItemToSlide strictly imports videos as videos and images as images without duplicating or changing types
      const newSlides = sortedSelected.map((item, idx) => convertItemToSlide(item, idx));
      setSlideshowSlides(newSlides);
      setActiveTab('slideshow');
    }
  };

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const nameA = a.file?.name || '';
      const nameB = b.file?.name || '';
      if (sortBy === 'name') return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
      if (sortBy === 'date-modified') {
        const modA = Math.max(a.file?.lastModified || 0, ...a.history.map(h => h.timestamp));
        const modB = Math.max(b.file?.lastModified || 0, ...b.history.map(h => h.timestamp));
        return modA - modB;
      }
      return b.dateAdded - a.dateAdded;
    });
  }, [items, sortBy]);

  const displayedItems = showSelectedOnly ? sortedItems.filter(i => i.selected) : sortedItems;
  const handleOpenPanoEditor = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setPanoEditingItemId(id); };

  const handleDragStartTool = (e: React.DragEvent, toolId: string) => {
    e.dataTransfer.setData('toolId', toolId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSampleUpload = async (files: FileList | null, field: 'floorSample' | 'ceilingSample') => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const b64 = e.target?.result as string;
      updateActiveItemConfig({ [field]: b64 });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans text-slate-100 bg-slate-950 relative ${activeTab === 'studio' && items.length > 0 ? 'lg:h-screen lg:overflow-hidden pb-4 lg:pb-0' : 'pb-20'}`}>
      <Header 
        onOpenAuthModal={() => setShowAuthModal(true)}
        onOpenPricingModal={() => setShowPricingModal(true)}
        onOpenDashboardModal={() => setShowDashboardModal(true)}
      />

      {/* Client Preview Mode Banner for Administrator */}
      {isActualAdmin && clientPreviewMode && (
        <div className="shrink-0 bg-gradient-to-r from-cyan-950/95 via-slate-900 to-cyan-950/95 border-b border-cyan-500/30 px-4 py-2 text-xs text-cyan-200 flex flex-wrap items-center justify-between gap-3 shadow-lg z-30 relative animate-fade-in">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]"></span>
            <span className="font-black uppercase tracking-widest text-[9px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/40">
              Client Preview Active
            </span>
            <span className="text-slate-300 text-[11px] hidden sm:inline">
              You are previewing PMD Studio exactly as clients and real estate agents see it (Property Website tab is hidden and client cyan styling is active).
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setClientPreviewMode(false)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-black text-[10px] uppercase tracking-wider shadow-md hover:shadow-orange-500/25 active:scale-95 transition-all cursor-pointer"
            >
              <span>Exit Preview (Back to Admin)</span>
            </button>
          </div>
        </div>
      )}
      
      {/* Mandatory API Key Selection Overlay for high-end models */}
      {hasApiKey === false && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-md w-full glass-panel p-10 rounded-[3rem] border border-orange-500/30 shadow-2xl space-y-8 animate-fade-in-up relative">
                <button 
                    onClick={() => setHasApiKey(true)}
                    className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    title="Dismiss / Browse App"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="w-20 h-20 bg-orange-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-orange-900/40">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-10 h-10 text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                    </svg>
                </div>
                <div className="space-y-3">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Advanced Tools Locked</h2>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        High-fidelity weather transformations and video generation require your own paid-tier API key because the free shared quota was exceeded.
                    </p>
                </div>

                <div className="text-left bg-slate-900/80 p-5 rounded-2xl border border-white/5 space-y-3">
                    <div className="text-xs font-black text-orange-500 uppercase tracking-wider">How to Link Your API Key:</div>
                    <ol className="list-decimal list-inside text-xs text-slate-300 space-y-2 leading-relaxed">
                        <li>Return to your main <strong className="text-white">Google AI Studio</strong> workspace tab containing this editor.</li>
                        <li>Look at the far top-right corner of the interface and click the <strong className="text-white">Settings (gear icon)</strong>.</li>
                        <li>Go to the <strong className="text-white">Secrets</strong> section.</li>
                        <li>Configure or paste your paid-tier <strong className="text-white">GEMINI_API_KEY</strong> with billing enabled.</li>
                        <li>If running locally or externally, add <code className="bg-black/50 px-1 py-0.5 rounded text-orange-400">GEMINI_API_KEY=&lt;key&gt;</code> inside your <code className="text-orange-400">.env</code> file.</li>
                    </ol>
                </div>

                <div className="space-y-3 pt-2">
                    <button 
                        onClick={() => setHasApiKey(true)}
                        className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-all"
                    >
                        Dismiss & Browse Workspace
                    </button>
                    <a 
                        href="https://ai.google.dev/gemini-api/docs/billing" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block text-[10px] font-black text-slate-500 hover:text-orange-500 uppercase tracking-widest transition-colors text-center"
                    >
                        View Billing Documentation
                    </a>
                </div>
            </div>
        </div>
      )}

      {items.find(i => i.id === editingItemId) && (
        <MaskEditor 
          originalUrl={items.find(i => i.id === editingItemId)!.previewUrl}
          generatedUrl={items.find(i => i.id === editingItemId)!.history[items.find(i => i.id === editingItemId)!.currentHistoryIndex]?.url}
          mode={maskEditorMode} 
          initialMaskUrl={
            maskEditorMode === 'wall_mask'
              ? items.find(i => i.id === editingItemId)!.config.wallMask
              : maskEditorMode === 'mask'
              ? items.find(i => i.id === editingItemId)!.config.lassoMask
              : undefined
          }
          customTitle={
            maskEditorMode === 'wall_mask' 
              ? 'Selective Wall Selector' 
              : maskEditorMode === 'mask' 
              ? 'Lasso Tool Selection' 
              : undefined
          }
          customSubtitle={
            maskEditorMode === 'wall_mask'
              ? 'Paint or lasso the specific wall(s) you want to recolor'
              : undefined
          }
          customConfirmLabel={
            maskEditorMode === 'wall_mask'
              ? 'Save Wall Selection'
              : maskEditorMode === 'mask'
              ? 'Save Selection'
              : undefined
          }
          onSave={handleSaveMaskedImage} 
          onCancel={() => setEditingItemId(null)}
        />
      )}
      {items.find(i => i.id === panoEditingItemId) && (
        <PanoramaEditor 
          item={items.find(i => i.id === panoEditingItemId)!} 
          onSaveReproject={handleSavePanoEdit} 
          onSaveOrientation={handleSavePanoOrientation}
          onUpdatePanoSource={handleUpdatePanoSource}
          onCancel={() => setPanoEditingItemId(null)} 
        />
      )}

      <div className="shrink-0 sticky top-24 z-30 bg-slate-950/60 backdrop-blur-xl border-b border-white/5 py-3">
        <div className="max-w-[1440px] mx-auto w-full px-4 sm:px-6 lg:px-8">
            <div className="glass-panel p-2 rounded-2xl flex flex-wrap items-center justify-between gap-3 border border-white/10 shadow-2xl">
                <div className="flex bg-slate-900/80 p-1 rounded-xl border border-white/5">
                    <button onClick={() => setActiveTab('studio')} className={`px-4 sm:px-5 py-2 rounded-lg text-xs font-bold uppercase transition-all ${activeTab === 'studio' ? (isAdmin ? 'bg-orange-500 text-white shadow-lg' : 'bg-cyan-500 text-slate-950 font-black shadow-lg') : 'text-slate-500 hover:text-slate-300'}`}>Studio</button>
                    {isAdmin && (
                      <>
                        <button onClick={() => setActiveTab('social')} className={`px-4 sm:px-5 py-2 rounded-lg text-xs font-bold uppercase transition-all ${activeTab === 'social' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Social Kit</button>
                        <button onClick={() => setActiveTab('ai-analyst')} className={`px-4 sm:px-5 py-2 rounded-lg text-xs font-bold uppercase transition-all ${activeTab === 'ai-analyst' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>AI Analyst</button>
                        <button onClick={() => setActiveTab('property-website')} className={`px-4 sm:px-5 py-2 rounded-lg text-xs font-bold uppercase transition-all ${activeTab === 'property-website' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Property Website</button>
                      </>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-900/50 border border-white/10 rounded-xl px-3 py-1.5 shrink-0">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sort:</span>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} className="bg-transparent text-[10px] font-bold text-slate-300 outline-none cursor-pointer">
                            <option value="date-added">Newest</option>
                            <option value="name">A-Z Name</option>
                            <option value="date-modified">Modified</option>
                        </select>
                    </div>
                    <div className="flex items-center bg-slate-900/50 p-1 rounded-xl border border-white/5 shrink-0">
                        <button onClick={() => setIsGridView(false)} className={`p-2 rounded-lg transition-all ${!isGridView ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`} title="List View (1 Column)"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg></button>
                        <button onClick={() => setIsGridView(true)} className={`p-2 rounded-lg transition-all ${isGridView ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`} title="Grid View (3 Columns)"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 0112.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25a2.25 2.25 0 01-2.25 2.25h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25v-2.25z" /></svg></button>
                    </div>
                    <div className="h-8 w-px bg-white/5 mx-2"></div>
                    <button onClick={() => setShowSelectedOnly(!showSelectedOnly)} className={`px-4 py-2 rounded-xl border text-[10px] font-bold uppercase transition-all ${showSelectedOnly ? 'bg-orange-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>{showSelectedOnly ? 'All Items' : `Selected (${selectedCount})`}</button>
                    <button onClick={handleSelectAll} className="px-4 py-2 rounded-xl bg-slate-900 text-[10px] font-bold uppercase text-slate-400 hover:text-white transition-colors">All</button>
                    <button onClick={handleSelectNone} className="px-4 py-2 rounded-xl bg-slate-900 text-[10px] font-bold uppercase text-slate-400 hover:text-white transition-colors">None</button>
                    <div className="h-8 w-px bg-white/5 mx-2"></div>
                    <div className="flex items-center bg-slate-900/50 p-1 rounded-xl border border-white/5 shrink-0">
                        <button onClick={handleBatchDownload} disabled={isZipping || selectedCount === 0} className="px-6 py-2 rounded-lg bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 disabled:opacity-30 transition-all flex items-center gap-2">{isZipping ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>}Download Package</button>
                    </div>
                    <button onClick={handleDeleteSelected} disabled={selectedCount === 0} className="px-4 py-2 rounded-xl border border-red-500/50 bg-red-950/30 text-red-400 text-[10px] font-black uppercase disabled:opacity-50 hover:bg-red-900/40 transition-colors">Delete</button>
                </div>
            </div>
        </div>
      </div>

      <main className={`flex-grow max-w-[1440px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-3.5 ${activeTab === 'studio' && items.length > 0 ? 'lg:overflow-hidden lg:min-h-0 flex flex-col' : ''}`}>
        {activeTab === 'studio' && (
          <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-stretch flex-grow min-h-0 lg:h-full w-full">
              {items.length === 0 ? (
                <div className="w-full max-w-2xl mx-auto mt-16"><ImageUploader onImagesSelected={handleImagesSelected} /></div>
              ) : (
                <>
                  <aside 
                    onScroll={() => setHoveredToolTooltip(null)}
                    className="w-full lg:w-[350px] lg:shrink-0 glass-panel p-5 space-y-6 rounded-[1.5rem] shadow-2xl lg:h-full lg:max-h-full overflow-y-auto overscroll-contain pr-2"
                  >
                      {/* Studio Tools Header */}
                      <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.7)]"></span>
                            <label className="text-sm font-black text-white uppercase tracking-widest block">Studio Tools</label>
                          </div>
                          <span className="text-[9px] text-slate-400 font-medium pl-4 block mt-0.5">Click or drag tools onto images</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {!isAdmin && (
                            <button
                              type="button"
                              onClick={() => setShowTooltips(prev => !prev)}
                              title={showTooltips ? "Hide tool descriptions" : "Show tool descriptions"}
                              className={`px-2 py-1 rounded-lg text-[8.5px] font-bold uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
                                showTooltips
                                  ? 'bg-slate-800/80 text-orange-400 border-orange-500/30 shadow-sm'
                                  : 'bg-slate-900/60 text-slate-400 border-white/10 hover:text-slate-200'
                              }`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                                {showTooltips ? (
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                                ) : (
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                )}
                              </svg>
                              <span>{showTooltips ? 'Info On' : 'Info Off'}</span>
                            </button>
                          )}
                          {activeItem && activeItem.assignedTools.length > 0 && (
                            <span className="text-[8px] font-black text-orange-400 bg-orange-500/15 border border-orange-500/30 px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
                              {activeItem.assignedTools.length} active
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Categorized Tool Sections */}
                      <div className="space-y-4">
                        {STUDIO_TOOL_CATEGORIES
                          .filter(category => {
                            // Hide cinematic video, 360 panorama, custom & precision, and architectural finishes from client side
                            if (!isAdmin) {
                              if (
                                category.id === 'cinematic_video' || 
                                category.id === '360_panorama' || 
                                category.id === 'custom_precision' ||
                                category.id === 'architectural_finishes'
                              ) {
                                return false;
                              }
                            }
                            return true;
                          })
                          .map((category) => {
                          const allAvailable = [...orderedPresets, ...VISUAL_STAGER_PRESETS, ...PANORAMA_PRESETS];
                          const categoryPresets = category.toolIds
                            .map(id => allAvailable.find(p => p.id === id))
                            .filter((p): p is WeatherPreset => Boolean(p));

                          if (categoryPresets.length === 0) return null;

                          return (
                            <div 
                              key={category.id} 
                              className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 shadow-md hover:border-slate-600/80 transition-all space-y-3"
                            >
                              {/* Category Header */}
                              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/[0.08]">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-3.5 rounded-full bg-gradient-to-b from-orange-400 to-orange-600 shrink-0 shadow-[0_0_8px_rgba(249,115,22,0.6)]"></span>
                                    <span className="text-[12.5px] font-black text-white uppercase tracking-wider block">
                                      {category.title}
                                    </span>
                                  </div>
                                  {showTooltips && (
                                    <span className="text-[9.5px] text-slate-400 block leading-tight truncate pl-3.5 mt-0.5">
                                      {category.description}
                                    </span>
                                  )}
                                </div>
                                {category.badge && (
                                  <span className="shrink-0 text-[8px] font-black text-orange-200 uppercase tracking-wider px-2 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/30 shadow-sm">
                                    {category.badge}
                                  </span>
                                )}
                              </div>

                               {/* Tool Grid */}
                              <div className={`grid ${category.toolIds.length === 1 ? 'grid-cols-1' : 'grid-cols-3'} gap-2`}>
                                {categoryPresets.map((preset) => {
                                  const isAssigned = (activeItem?.assignedTools.includes(preset.id)) || (!activeItem && stagingPreviewTool === preset.id);
                                  const hasWatermark = preset.hasAiWatermark || ['furniture', 'style_swapper', 'p360_vstaging_3d', 'p360_style_swap', 'auto_declutter', 'p360_auto_declutter', 'sunset'].includes(preset.id);

                                  return (
                                    <div key={preset.id} className="relative group/toolbtn h-full">
                                      <button
                                        draggable
                                        onDragStart={(e) => handleDragStartTool(e, preset.id)}
                                        onClick={() => handleToolToggle(preset.id)}
                                        onMouseEnter={(e) => {
                                          const r = e.currentTarget.getBoundingClientRect();
                                          setHoveredToolTooltip({ preset, rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height } });
                                        }}
                                        onMouseLeave={() => setHoveredToolTooltip(null)}
                                        className={`w-full h-full min-h-[72px] relative flex flex-col items-center justify-center p-1.5 py-2 rounded-2xl border transition-all cursor-grab active:cursor-grabbing ${
                                          isAssigned
                                            ? `${preset.color} scale-105 shadow-xl ring-1 ring-white/20`
                                            : 'bg-slate-700/50 border-slate-600/60 text-slate-200 hover:text-white hover:bg-slate-600/70 hover:border-slate-500 shadow-sm'
                                        }`}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 shrink-0 mb-1">
                                          <path strokeLinecap="round" strokeLinejoin="round" d={preset.icon} />
                                        </svg>
                                        <span className="text-[7.5px] text-center font-bold uppercase tracking-tight leading-[1.15] break-words w-full px-0.5">
                                          {preset.label}
                                        </span>
                                        {preset.isPremium && (
                                          <div className="absolute top-1 right-1 px-1 py-0.5 bg-indigo-500 text-[5.5px] font-black text-white rounded uppercase tracking-wider shadow-lg">
                                            PRO
                                          </div>
                                        )}
                                        {hasWatermark && !preset.isPremium && (
                                          <div
                                            className="absolute top-1 right-1 px-1 py-0.5 bg-amber-400 text-[6px] font-black text-slate-950 rounded uppercase tracking-tight shadow-md flex items-center gap-0.5 border border-amber-300"
                                            title="Includes MLS-compliant AI watermark"
                                          >
                                            <svg className="w-1.5 h-1.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
                                            </svg>
                                            +AI
                                          </div>
                                        )}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Direct Contextual Controls below tools when Modern Stage or Style Swap is selected */}
                              {((category.id === 'virtual_staging' && (
                                  (activeItem && (activeItem.assignedTools.includes('furniture') || activeItem.assignedTools.includes('furniture_build_video') || activeItem.assignedTools.includes('style_swapper'))) ||
                                  (!activeItem && (stagingPreviewTool === 'furniture' || stagingPreviewTool === 'style_swapper'))
                                )) || (category.id === '360_panorama' && (
                                  (activeItem && (activeItem.assignedTools.includes('p360_vstaging_3d') || activeItem.assignedTools.includes('p360_style_swap'))) ||
                                  (!activeItem && (stagingPreviewTool === 'p360_vstaging_3d' || stagingPreviewTool === 'p360_style_swap'))
                                ))) && (
                                <div className="space-y-3">
                                  {/* Modern Stage Controls */}
                                  {(((activeItem && (activeItem.assignedTools.includes('furniture') || activeItem.assignedTools.includes('p360_vstaging_3d') || activeItem.assignedTools.includes('furniture_build_video'))) ||
                                    (!activeItem && (stagingPreviewTool === 'furniture' || stagingPreviewTool === 'p360_vstaging_3d'))) && (category.id === 'virtual_staging' ? (!activeItem || activeItem.assignedTools.includes('furniture') || activeItem.assignedTools.includes('furniture_build_video')) : (activeItem?.assignedTools.includes('p360_vstaging_3d') || stagingPreviewTool === 'p360_vstaging_3d'))) && (
                                    <div className="space-y-3 pt-3 border-t border-slate-700/60 mt-3 animate-in fade-in duration-200">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-[9.5px] font-black uppercase tracking-wider text-rose-400">
                                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a2.25 2.25 0 0 0-2.25 2.25v1.5a2.25 2.25 0 0 0 2.25 2.25h1.5a2.25 2.25 0 0 0 2.25-2.25v-1.5A2.25 2.25 0 0 0 15.75 6ZM3 15.75A2.25 2.25 0 0 1 5.25 13.5h13.5A2.25 2.25 0 0 1 21 15.75V18a2.25 2.25 0 0 1-2.244 2.077H5.25A2.25 2.25 0 0 1 3 18v-2.25Z" />
                                          </svg>
                                          Modern Stage Settings
                                        </div>
                                        <span className="text-[7.5px] font-bold text-rose-300 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 rounded uppercase">
                                          Active Tool
                                        </span>
                                      </div>

                                      <div className="space-y-1.5">
                                        <label className="text-[8.5px] font-bold text-slate-300 uppercase tracking-wider block">Room Type</label>
                                        <select 
                                          value={currentStagingConfig.stagingRoom} 
                                          onChange={(e) => handleUpdateStagingConfig({ stagingRoom: e.target.value })} 
                                          className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-rose-500 appearance-none cursor-pointer"
                                        >
                                          {STAGING_ROOMS.map(room => (<option key={room} value={room}>{room}</option>))}
                                        </select>
                                      </div>

                                      <div className="space-y-1.5">
                                        <label className="text-[8.5px] font-bold text-slate-300 uppercase tracking-wider block">Staging Style</label>
                                        <select 
                                          value={currentStagingConfig.stagingStyle} 
                                          onChange={(e) => handleUpdateStagingConfig({ stagingStyle: e.target.value })} 
                                          className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-rose-500 appearance-none cursor-pointer"
                                        >
                                          {FURNITURE_STYLES.map(style => (<option key={style} value={style}>{style}</option>))}
                                        </select>
                                      </div>

                                      <div className="space-y-1.5">
                                        <label className="text-[8.5px] font-bold text-slate-300 uppercase tracking-wider block">Stage Detail (Optional)</label>
                                        <input 
                                          type="text" 
                                          value={currentStagingConfig.stageDescriptor || ''} 
                                          onChange={(e) => handleUpdateStagingConfig({ stageDescriptor: e.target.value })} 
                                          placeholder="e.g. sectional sofa, modern brass floor lamp..." 
                                          className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-rose-500" 
                                        />
                                      </div>

                                      <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/70 hover:border-cyan-500/40 transition-colors">
                                        <label className="flex items-start gap-2 cursor-pointer select-none">
                                          <div className="relative flex items-center mt-0.5">
                                            <input
                                              type="checkbox"
                                              checked={!!currentStagingConfig.emptyRoomFirst}
                                              onChange={(e) => handleUpdateStagingConfig({ emptyRoomFirst: e.target.checked })}
                                              className="sr-only peer"
                                            />
                                            <div className="w-7 h-3.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
                                          </div>
                                          <div className="flex-1">
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-[9.5px] font-bold text-white">Empty Room First</span>
                                              <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Auto Clean</span>
                                            </div>
                                            <p className="text-[8.5px] text-slate-400 mt-0.5 leading-tight">
                                              Clears existing furniture before applying new staging.
                                            </p>
                                          </div>
                                        </label>
                                      </div>

                                      <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-emerald-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400"><path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" /></svg>
                                        <div className="text-[8.5px] font-bold leading-tight">
                                          <span className="uppercase tracking-wider block">Wall & Architecture Lock: Active</span>
                                          <span className="block text-[7.5px] font-normal text-emerald-300/80">Room walls, windows, and architecture strictly preserved</span>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-950/40 border border-amber-500/20 text-amber-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0 text-amber-400"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg>
                                        <div className="text-[8.5px] font-bold leading-tight">
                                          <span className="uppercase tracking-wider block">AI Watermark: Active</span>
                                          <span className="block text-[7.5px] font-normal text-amber-300/80">MLS-compliant "ai virtually staged" disclosure applied</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Style Swap Controls */}
                                  {(((activeItem && (activeItem.assignedTools.includes('style_swapper') || activeItem.assignedTools.includes('p360_style_swap'))) ||
                                    (!activeItem && (stagingPreviewTool === 'style_swapper' || stagingPreviewTool === 'p360_style_swap'))) && (category.id === 'virtual_staging' ? (!activeItem || activeItem.assignedTools.includes('style_swapper')) : (activeItem?.assignedTools.includes('p360_style_swap') || stagingPreviewTool === 'p360_style_swap'))) && (
                                    <div className="space-y-3 pt-3 border-t border-slate-700/60 mt-3 animate-in fade-in duration-200">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-[9.5px] font-black uppercase tracking-wider text-fuchsia-400">
                                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                          </svg>
                                          Style Swap Settings
                                        </div>
                                        <span className="text-[7.5px] font-bold text-fuchsia-300 bg-fuchsia-500/15 border border-fuchsia-500/30 px-1.5 py-0.5 rounded uppercase">
                                          Active Tool
                                        </span>
                                      </div>

                                      <div className="space-y-1.5">
                                        <label className="text-[8.5px] font-bold text-slate-300 uppercase tracking-wider block">Room Type</label>
                                        <select 
                                          value={currentStagingConfig.stagingRoom} 
                                          onChange={(e) => handleUpdateStagingConfig({ stagingRoom: e.target.value })} 
                                          className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-fuchsia-500 appearance-none cursor-pointer"
                                        >
                                          {STAGING_ROOMS.map(room => (<option key={room} value={room}>{room}</option>))}
                                        </select>
                                      </div>

                                      <div className="space-y-1.5">
                                        <label className="text-[8.5px] font-bold text-slate-300 uppercase tracking-wider block">Staging Style</label>
                                        <select 
                                          value={currentStagingConfig.swapStyle || currentStagingConfig.stagingStyle} 
                                          onChange={(e) => handleUpdateStagingConfig({ swapStyle: e.target.value, stagingStyle: e.target.value })} 
                                          className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-fuchsia-500 appearance-none cursor-pointer"
                                        >
                                          {FURNITURE_STYLES.map(style => (<option key={style} value={style}>{style}</option>))}
                                        </select>
                                      </div>

                                      <div className="space-y-1.5">
                                        <label className="text-[8.5px] font-bold text-slate-300 uppercase tracking-wider block">Swap Detail (Optional)</label>
                                        <input 
                                          type="text" 
                                          value={currentStagingConfig.swapDescriptor || ''} 
                                          onChange={(e) => handleUpdateStagingConfig({ swapDescriptor: e.target.value })} 
                                          placeholder="e.g. replace sectional with modern wing chairs" 
                                          className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-2 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-fuchsia-500" 
                                        />
                                      </div>

                                      <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-emerald-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400"><path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" /></svg>
                                        <div className="text-[8.5px] font-bold leading-tight">
                                          <span className="uppercase tracking-wider block">Wall & Floor Lock: Active</span>
                                          <span className="block text-[7.5px] font-normal text-emerald-300/80">Flooring material, wood grain, stain, tile, and walls strictly preserved</span>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-950/40 border border-amber-500/20 text-amber-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0 text-amber-400"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg>
                                        <div className="text-[8.5px] font-bold leading-tight">
                                          <span className="uppercase tracking-wider block">AI Watermark: Active</span>
                                          <span className="block text-[7.5px] font-normal text-amber-300/80">MLS-compliant "ai virtually staged" disclosure applied</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Fallback for any dynamically added or custom presets (Admin only) */}
                        {isAdmin && (() => {
                          const allAvailable = [...orderedPresets, ...VISUAL_STAGER_PRESETS, ...PANORAMA_PRESETS];
                          const categorizedIds = new Set(STUDIO_TOOL_CATEGORIES.flatMap(c => c.toolIds));
                          const uncategorized = allAvailable.filter(p => !categorizedIds.has(p.id));

                          if (uncategorized.length === 0) return null;

                          return (
                            <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 shadow-md hover:border-slate-600/80 transition-all space-y-3">
                              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/[0.08]">
                                <div className="flex items-center gap-2.5">
                                  <span className="w-2 h-4 rounded-full bg-gradient-to-b from-orange-400 to-orange-600 shrink-0 shadow-[0_0_8px_rgba(249,115,22,0.6)]"></span>
                                  <span className="text-[13.5px] font-black text-white uppercase tracking-wider block">More Tools</span>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {uncategorized.map((preset) => {
                                  const isAssigned = activeItem?.assignedTools.includes(preset.id);
                                  const hasWatermark = preset.hasAiWatermark;

                                  return (
                                    <div key={preset.id} className="relative group/toolbtn h-full">
                                      <button
                                        draggable
                                        onDragStart={(e) => handleDragStartTool(e, preset.id)}
                                        onClick={() => handleToolToggle(preset.id)}
                                        onMouseEnter={(e) => {
                                          const r = e.currentTarget.getBoundingClientRect();
                                          setHoveredToolTooltip({ preset, rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height } });
                                        }}
                                        onMouseLeave={() => setHoveredToolTooltip(null)}
                                        className={`w-full h-full min-h-[72px] relative flex flex-col items-center justify-center p-1.5 py-2 rounded-2xl border transition-all cursor-grab active:cursor-grabbing ${
                                          isAssigned
                                            ? `${preset.color} scale-105 shadow-xl`
                                            : 'bg-slate-700/50 border-slate-600/60 text-slate-200 hover:text-white hover:bg-slate-600/70 hover:border-slate-500 shadow-sm'
                                        }`}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 shrink-0 mb-1">
                                          <path strokeLinecap="round" strokeLinejoin="round" d={preset.icon} />
                                        </svg>
                                        <span className="text-[7.5px] text-center font-bold uppercase tracking-tight leading-[1.15] break-words w-full px-0.5">
                                          {preset.label}
                                        </span>
                                        {preset.isPremium && (
                                          <div className="absolute top-1 right-1 px-1 py-0.5 bg-indigo-500 text-[5.5px] font-black text-white rounded uppercase tracking-wider shadow-lg">
                                            PRO
                                          </div>
                                        )}
                                        {hasWatermark && !preset.isPremium && (
                                          <div className="absolute top-1 right-1 px-1 py-0.5 bg-amber-400 text-[6px] font-black text-slate-950 rounded uppercase tracking-tight shadow-md flex items-center gap-0.5 border border-amber-300">
                                            +AI
                                          </div>
                                        )}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {activeItem && activeItem.assignedTools.length > 0 && (
                        <div className="p-4 rounded-2xl border bg-slate-900/40 border-white/5 space-y-4 animate-fade-in-up">
                           {isAdmin && activeItem.assignedTools.includes('custom_edit') && (
                             <div className="space-y-3">
                               <div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Custom Tool Instructions</label>{isEnhancing && <div className="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>}</div>
                               <textarea value={activeItem.config.customPrompt || ''} onChange={(e) => updateActiveItemConfig({ customPrompt: e.target.value })} placeholder="Type specific instructions..." className="w-full h-24 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-orange-500 resize-none" />
                               
                               <div className="space-y-2">
                                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Surgical Selection (Optional)</label>
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => handleOpenLasso(activeItem.id)}
                                      className="flex-grow flex items-center justify-center gap-2 py-3 rounded-xl border border-white/5 bg-slate-900 hover:bg-slate-800 text-orange-500 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg group"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 group-hover:scale-110 transition-transform"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
                                      {activeItem.config.lassoMask ? 'Edit Selection' : 'Lasso Edit Area'}
                                    </button>
                                    {activeItem.config.lassoMask && (
                                      <button 
                                        onClick={() => updateActiveItemConfig({ lassoMask: undefined })}
                                        className="p-3 rounded-xl bg-red-900/20 border border-red-500/20 text-red-500 hover:bg-red-900/40 transition-all"
                                        title="Clear Selection"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                      </button>
                                    )}
                                  </div>
                                  {activeItem.config.lassoMask && (
                                    <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-black/40 group">
                                      <img src={activeItem.config.lassoMask} className="w-full h-full object-contain mix-blend-screen opacity-60" />
                                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span className="text-[8px] font-black text-orange-500/70 uppercase tracking-widest">Surgical Mask Defined</span>
                                      </div>
                                    </div>
                                  )}
                               </div>

                               {activeItem.config.enhancedPrompt && ( <div className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-[10px] text-orange-200 italic"><span className="font-bold uppercase tracking-tighter text-orange-500 block mb-1">AI Optimized Prompt:</span>"{activeItem.config.enhancedPrompt}"</div> )}
                             </div>
                           )}
                           {isAdmin && activeItem.assignedTools.includes('custom_video') && (
                             <div className="space-y-3">
                               <div className="flex justify-between items-center">
                                 <div className="flex items-center gap-2">
                                   <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Video Motion & Description</label>
                                   <span className="text-[9px] font-semibold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-800/40">MiniMax H3 Max • Fal.ai</span>
                                 </div>
                                 {isEnhancingVideo && <div className="w-3 h-3 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>}
                               </div>
                               <textarea 
                                 value={activeItem.config.customVideoPrompt || ''} 
                                 onChange={(e) => updateActiveItemConfig({ customVideoPrompt: e.target.value })} 
                                 placeholder="Describe the video motion... (e.g. Smooth cinematic drone push-in toward the property, golden hour sunlight streaming in, slow camera move... powered by MiniMax H3 Max via Fal.ai)" 
                                 className="w-full h-24 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-rose-500 resize-none" 
                                />

                               <div className="space-y-1.5">
                                 <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Motion Suggestions</span>
                                 <div className="flex flex-wrap gap-1.5">
                                   {[
                                     { label: 'Drone Fly-In', text: 'Smooth drone push-in from high angle down toward the front entrance with architectural 4K clarity.' },
                                     { label: 'Slow Zoom & Pan', text: 'Cinematic slow zoom-in with subtle left-to-right panning across the space and realistic natural lighting.' },
                                     { label: 'Walkthrough Reveal', text: 'Smooth steady-cam walkthrough moving seamlessly forward into the room with warm ambient lighting.' },
                                     { label: 'Golden Hour Sunset', text: 'Golden hour sunset time-lapse with warm sunlight casting long moving shadows across the surfaces.' },
                                     { label: 'Night Twilight Glow', text: 'Atmospheric twilight transition where interior and exterior lights turn on and cast a warm welcoming glow.' },
                                   ].map(chip => (
                                     <button
                                       key={chip.label}
                                       type="button"
                                       onClick={() => updateActiveItemConfig({ customVideoPrompt: chip.text })}
                                       className="text-[8px] font-medium px-2 py-1 rounded-md bg-slate-800/80 hover:bg-rose-950/40 hover:text-rose-300 text-slate-400 border border-slate-700/50 transition-all text-left cursor-pointer"
                                     >
                                       + {chip.label}
                                     </button>
                                   ))}
                                 </div>
                               </div>

                               {activeItem.config.enhancedVideoPrompt && (
                                 <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-200 italic">
                                   <span className="font-bold uppercase tracking-tighter text-rose-400 block mb-1">AI Video Optimized Prompt:</span>
                                   "{activeItem.config.enhancedVideoPrompt}"
                                 </div>
                               )}
                             </div>
                           )}
                           {isAdmin && (activeItem.is360 || (activeItem.dimensions && Math.abs(activeItem.dimensions.width / activeItem.dimensions.height - 2) < 0.2) || activeItem.assignedTools.some(t => t.startsWith('p360_'))) && (
                             <div className="space-y-3 border-t border-white/5 pt-4">
                               <div className="flex items-center justify-between">
                                 <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">360 Camera Angle</label>
                                 <span className="text-[8.5px] font-mono font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                                   Yaw: {activeItem.config.panoYaw ?? 0}° | Pitch: {activeItem.config.panoPitch ?? -5}° | FOV: {activeItem.config.panoFov ?? 90}°
                                 </span>
                               </div>
                               <div className="space-y-1.5 p-2.5 bg-slate-950/70 rounded-xl border border-white/5">
                                 <div className="flex items-center justify-between text-[8px] font-black uppercase text-slate-400">
                                   <span className="flex items-center gap-1">
                                     <span>Ultra-Wide Zoom</span>
                                     <span className="text-[7.5px] text-orange-400">
                                       {(activeItem.config.panoFov ?? 90) >= 135 ? '(Ultra-Wide)' : (activeItem.config.panoFov ?? 90) >= 105 ? '(Wide)' : '(Standard)'}
                                     </span>
                                   </span>
                                   <span className="font-mono text-orange-400 font-bold">{activeItem.config.panoFov ?? 90}°</span>
                                 </div>
                                 <input
                                   type="range"
                                   min="30"
                                   max="160"
                                   step="1"
                                   value={activeItem.config.panoFov ?? 90}
                                   onChange={(e) => updateActiveItemConfig({ panoFov: Number(e.target.value) })}
                                   className="w-full h-1.5 bg-slate-900 rounded-full appearance-none accent-orange-500 cursor-pointer"
                                 />
                                 <div className="flex justify-between text-[7px] font-mono text-slate-500">
                                   <span>30° In</span>
                                   <span>90° Normal</span>
                                   <span>160° Max Out</span>
                                 </div>
                               </div>
                               <button
                                 type="button"
                                 id="btn-sidebar-aim-360"
                                 onClick={(e) => handleOpenPanoEditor(activeItem.id, e)}
                                 className="w-full py-2.5 px-3 rounded-xl border border-orange-500/40 bg-orange-500/15 hover:bg-orange-500 text-orange-400 hover:text-white text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                               >
                                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                   <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7V5m0 14v-2M5 12H3m18 0h-2" />
                                 </svg>
                                 Aim Camera & Reposition View
                               </button>
                               <p className="text-[8px] text-slate-400 leading-tight">
                                 Aims the 1K targeted perspective at the room space for optimal AI virtual staging. Preserves full resolution (up to 8K) Kuula panoramas.
                               </p>
                             </div>
                           )}
                           {(activeItem.assignedTools.includes('dawn_to_dusk_video') || activeItem.assignedTools.includes('sunny_skies_video') || activeItem.assignedTools.includes('custom_video') || activeItem.assignedTools.includes('furniture_build_video')) && (
                             <div className="space-y-3 border-t border-white/5 pt-4">
                               <div className="flex items-center justify-between">
                                 <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">
                                   Video Aspect Ratio
                                 </label>
                                 {activeItem.assignedTools.includes("dawn_to_dusk_video") && (
                                   <span className="text-[8px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 uppercase tracking-wider">
                                     Slow Sunset • Dusk at End
                                   </span>
                                 )}
                               </div>
                               <div className="grid grid-cols-2 gap-2">
                                 <button
                                   type="button"
                                   onClick={() => updateActiveItemConfig({ videoAspectRatio: '16:9' })}
                                   className={`py-2 px-3 rounded-xl border text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                     (activeItem.config.videoAspectRatio || '16:9') === '16:9'
                                       ? 'bg-orange-500 border-orange-400 text-white shadow-lg'
                                       : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                                   }`}
                                 >
                                   <span className="w-3.5 h-2 border border-current rounded-sm inline-block"></span>
                                   16:9 Landscape
                                 </button>
                                 <button
                                   type="button"
                                   onClick={() => updateActiveItemConfig({ videoAspectRatio: '9:16' })}
                                   className={`py-2 px-3 rounded-xl border text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                     activeItem.config.videoAspectRatio === '9:16'
                                       ? 'bg-orange-500 border-orange-400 text-white shadow-lg'
                                       : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                                   }`}
                                 >
                                   <span className="w-2 h-3.5 border border-current rounded-sm inline-block"></span>
                                   9:16 Vertical
                                 </button>
                               </div>
                             </div>
                           )}
                           {isAdmin && activeItem.assignedTools.includes('wall_unifier') && (
                             <div className="space-y-3 border-t border-white/5 pt-4">
                               <div className="flex items-center justify-between">
                                 <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Wall Color</label>
                                 {activeItem.config.wallMask && (
                                   <span className="text-[8px] font-black uppercase text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                     Selective Mode Active
                                   </span>
                                 )}
                               </div>
                               <div className="flex gap-2">
                                 <input type="color" value={activeItem.config.wallColor} onChange={(e) => updateActiveItemConfig({ wallColor: e.target.value })} className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer" />
                                 <input type="text" value={activeItem.config.wallColor} onChange={(e) => updateActiveItemConfig({ wallColor: e.target.value })} className="flex-grow bg-slate-950 border border-slate-800 rounded-xl px-3 text-xs font-mono text-slate-300" />
                               </div>
                               <div className="pt-1">
                                 <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Selective Accent Walls</label>
                                 <div className="flex gap-2">
                                   <button
                                     type="button"
                                     onClick={() => handleOpenWallMask(activeItem.id)}
                                     className={`flex-1 py-2.5 px-3 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                                       activeItem.config.wallMask
                                         ? "bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-lg"
                                         : "bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900 hover:border-slate-700"
                                     }`}
                                   >
                                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 text-amber-400">
                                       <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1-1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
                                     </svg>
                                     {activeItem.config.wallMask ? "Edit Selected Walls" : "Select Specific Walls"}
                                   </button>
                                   {activeItem.config.wallMask && (
                                     <button
                                       type="button"
                                       onClick={() => updateActiveItemConfig({ wallMask: undefined })}
                                       title="Clear wall selection (apply to all walls)"
                                       className="py-2.5 px-3 rounded-xl border border-red-500/30 bg-red-950/30 text-red-400 text-[9px] font-black uppercase hover:bg-red-900/40 transition-colors"
                                     >
                                       Clear
                                     </button>
                                   )}
                                 </div>
                                 <p className="text-[8px] text-slate-500 mt-1 leading-normal">
                                   {activeItem.config.wallMask 
                                     ? "Color will apply only to the selected wall surfaces." 
                                     : "Leave unselected to unify all walls in the room, or click above to paint specific accent walls."}
                                 </p>
                               </div>
                             </div>
                           )}
                           {isAdmin && activeItem.assignedTools.includes('floor_replacer') && (
                             <div className="space-y-2 border-t border-white/5 pt-4">
                               <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Floor Texture Sample</label>
                               <div 
                                 onDragOver={(e) => e.preventDefault()}
                                 onDrop={(e) => { e.preventDefault(); handleSampleUpload(e.dataTransfer.files, 'floorSample'); }}
                                 onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = (e) => handleSampleUpload((e.target as HTMLInputElement).files, 'floorSample'); input.click(); }}
                                 className="relative group w-full h-32 rounded-xl bg-slate-950 border-2 border-dashed border-slate-800 flex items-center justify-center cursor-pointer overflow-hidden hover:border-orange-500/50 transition-all"
                               >
                                 {activeItem.config.floorSample ? (
                                   <img src={activeItem.config.floorSample} className="w-full h-full object-cover" alt="Floor Sample" />
                                 ) : (
                                   <div className="flex flex-col items-center gap-2">
                                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-slate-600"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                                     <span className="text-[8px] font-black text-slate-600 uppercase">Drop Floor Sample</span>
                                   </div>
                                 )}
                               </div>
                             </div>
                           )}
                           {activeItem.assignedTools.includes('sunset') && (
                             <div className="space-y-3 border-t border-white/5 pt-4">
                               <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-950/40 border border-amber-500/20 text-amber-400">
                                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0 text-amber-400"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg>
                                 <div className="text-[9px] font-bold leading-tight">
                                   <span className="uppercase tracking-wider block">AI Watermark: Active</span>
                                   <span className="block text-[8px] font-normal text-amber-300/80">MLS-compliant "ai day to dusk" disclosure watermark applied</span>
                                 </div>
                               </div>
                             </div>
                           )}
                           {isAdmin && activeItem.assignedTools.includes('ceiling_replacer') && (
                             <div className="space-y-2 border-t border-white/5 pt-4">
                               <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Ceiling Texture Sample</label>
                               <div 
                                 onDragOver={(e) => e.preventDefault()}
                                 onDrop={(e) => { e.preventDefault(); handleSampleUpload(e.dataTransfer.files, 'ceilingSample'); }}
                                 onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = (e) => handleSampleUpload((e.target as HTMLInputElement).files, 'ceilingSample'); input.click(); }}
                                 className="relative group w-full h-32 rounded-xl bg-slate-950 border-2 border-dashed border-slate-800 flex items-center justify-center cursor-pointer overflow-hidden hover:border-orange-500/50 transition-all"
                               >
                                 {activeItem.config.ceilingSample ? (
                                   <img src={activeItem.config.ceilingSample} className="w-full h-full object-cover" alt="Ceiling Sample" />
                                 ) : (
                                   <div className="flex flex-col items-center gap-2">
                                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-slate-600"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                                     <span className="text-[8px] font-black text-slate-600 uppercase">Drop Ceiling Sample</span>
                                   </div>
                                 )}
                               </div>
                             </div>
                           )}
                        </div>
                      )}
                      <div className="space-y-4 pt-4 border-t border-white/5">
                          {isAdmin && (
                            <div className="flex items-center justify-between"><div className="flex flex-col"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Processing Queue</span><span className="text-[9px] font-bold text-orange-500 uppercase tracking-tighter">{stagedCount} Images Ready</span></div>{stagedCount > 0 && ( <button onClick={handleClearStaged} className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:text-red-400 transition-colors">Clear All</button> )}</div>
                          )}
                          
                          {/* QUICK COST CONTROL & DAILY TOKEN BUDGET IN SIDEBAR (Admin only) */}
                          {isAdmin && (
                            <div className="bg-slate-950/60 border border-white/10 rounded-2xl p-3.5 space-y-2.5 shadow-lg">
                              <div className="flex items-center justify-between">
                                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                                  <span className="text-orange-500">🛡️</span> Daily Token Guard
                                </span>
                                <button 
                                  onClick={() => setShowTokenGuardSettings(true)} 
                                  className="text-[8px] font-bold text-orange-400 hover:text-orange-300 underline uppercase"
                                >
                                  {tokenGuardSettings.enabled ? 'Configure ⚙️' : 'Off ⚪'}
                                </button>
                              </div>

                              {/* Today's Token Usage Meter */}
                              <div className="space-y-1.5 pt-1">
                                <div className="flex justify-between text-[9px]">
                                  <span className="text-slate-400 font-medium">Today's Token Use:</span>
                                  <span className="font-mono font-bold text-slate-200">
                                    {formatTokens(tokenGuardSettings.usedToday)} / {formatTokens(tokenGuardSettings.dailyLimit)}
                                  </span>
                                </div>
                                {/* Progress bar */}
                                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                                  <div 
                                    className={`h-full transition-all duration-300 ${
                                      (tokenGuardSettings.usedToday / tokenGuardSettings.dailyLimit) >= 1
                                        ? 'bg-rose-500'
                                        : (tokenGuardSettings.usedToday / tokenGuardSettings.dailyLimit) >= 0.8
                                        ? 'bg-amber-500'
                                        : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${Math.min(100, Math.round(((tokenGuardSettings.usedToday || 0) / (tokenGuardSettings.dailyLimit || 125000)) * 100))}%` }}
                                  />
                                </div>
                                <div className="flex justify-between items-center text-[8px] pt-0.5">
                                  <span className="text-slate-500 font-mono">
                                    ~{tokenToDollarString(tokenGuardSettings.usedToday)} / {tokenToDollarString(tokenGuardSettings.dailyLimit)}
                                  </span>
                                  {tokenGuardSettings.overriddenToday ? (
                                    <span className="text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                      ⚡ Override Active
                                    </span>
                                  ) : (
                                    <button 
                                      onClick={() => {
                                        const updated: TokenGuardSettings = { ...tokenGuardSettings, overriddenToday: true };
                                        saveTokenGuardSettings(updated);
                                        setTokenGuardSettings(updated);
                                      }}
                                      className="text-slate-400 hover:text-amber-400 uppercase tracking-wider transition-colors font-bold flex items-center gap-1"
                                      title="Click to bypass daily token limit for today"
                                    >
                                      <span>⚡ Busy Day?</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between border-t border-white/5 pt-2">
                                <span className="text-[8.5px] font-bold text-slate-300">Cost & Quality Center</span>
                                <button onClick={() => setShowCostModal(true)} className="text-[8px] font-bold text-emerald-400 hover:text-emerald-300 underline uppercase">Open 💎</button>
                              </div>
                            </div>
                          )}

                          <div className="text-[8px] font-medium text-slate-500 italic px-1">
                            {isAdmin 
                              ? 'Note: Batch processing multiple images with Premium tools (Videos) will consume significantly more tokens/credits.' 
                              : 'Note: Processing multiple tools across images will consume credits per applied tool.'}
                          </div>
                          <button onClick={handleGenerate} disabled={isGenerating || stagedCount === 0} className="w-full py-5 rounded-[1.25rem] font-black text-white shadow-2xl bg-gradient-to-br from-orange-600 to-amber-600 disabled:opacity-30 transition-all uppercase tracking-widest text-xs hover:scale-[1.02] flex items-center justify-center gap-3">{isGenerating ? ( <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Processing...</> ) : `Run Batch Process (${stagedCount})`}</button>
                          <div className="grid grid-cols-1 gap-2">
                              <button 
                                onClick={handleSyncTools} 
                                disabled={selectedCount === 0 || !items.some(i => i.assignedTools.length > 0)}
                                className="py-3 rounded-xl font-bold uppercase tracking-widest text-[9px] border border-white/5 bg-slate-900 text-emerald-500 hover:bg-slate-800 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" /></svg>
                                Sync Tools to Selected ({selectedCount})
                              </button>
                              {isAdmin && (
                                <button onClick={handleSendToSocialKit} disabled={selectedCount === 0} className="py-3 rounded-xl font-bold uppercase tracking-widest text-[9px] border border-white/5 bg-slate-900 text-orange-500 hover:bg-slate-800 transition-all">Social Kit</button>
                              )}
                          </div>
                      </div>
                      <ImageUploader onImagesSelected={handleImagesSelected} compact />
                  </aside>
                  <div 
                    className="w-full lg:flex-grow lg:min-w-0 relative lg:h-full lg:max-h-full overflow-y-auto overscroll-contain pr-2 pb-16" 
                    id="gallery-grid-container"
                  >
                    <div className={`grid gap-4 ${isGridView ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1'}`}>
                      {displayedItems.map((item) => (
                        <ImageGridItem 
                          key={item.id} 
                          item={item} 
                          isGridView={isGridView} 
                          isActive={activeItemId === item.id} 
                          onToggleSelect={handleToggleSelect} 
                          onRemove={handleRemoveImage} 
                          onDuplicate={handleDuplicateImage} 
                          onRevert={handleRevert} 
                          onUndo={handleUndo} 
                          onRedo={handleRedo} 
                          onDownload={handleDownloadSingle} 
                          onOpenRestore={handleOpenRestore} 
                          onOpenEraser={handleOpenEraser} 
                          onOpenLasso={handleOpenLasso} 
                          onOpenPano={handleOpenPanoEditor} 
                          onToolDrop={handleToolDrop} 
                          onToggleAutoDuplicate={handleToggleAutoDuplicate} 
                          onSharpen={handleSharpenImage} 
                          onExtractFrame={handleExtractVideoFrame}
                          onPreAnalyze={handlePreAnalyzeSingle}
                          onApplyPreAnalysisRecommendations={handleApplyPreAnalysisRecommendations}
                          onTogglePreAnalysisTool={handleTogglePreAnalysisTool}
                          isDownloading={downloadingId === item.id} 
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
          </div>
        )}
        {activeTab === 'social' && isAdmin && (
          <SocialMediaGenerator 
            assets={socialAssets} 
            setAssets={setSocialAssets} 
            brandingColor={brandingColor} 
            setBrandingColor={setBrandingColor} 
            onRowSelected={handleSocialRowSelected}
            studioItems={items}
          />
        )}

        {activeTab === 'ai-analyst' && isAdmin && (
          <AIAnalyst 
            items={items} 
            persistedResults={aiAnalystResults} 
            onResultsChange={setAiAnalystResults} 
            onPreAnalyzeSingle={handlePreAnalyzeSingle}
            onApplyPreAnalysisRecommendations={handleApplyPreAnalysisRecommendations}
            onTogglePreAnalysisTool={handleTogglePreAnalysisTool}
          />
        )}
        {activeTab === 'property-website' && isAdmin && <CustomTool studioItems={items} socialAssets={socialAssets} setSocialAssets={setSocialAssets} brandingColor={brandingColor} initialProperties={properties} onPropertiesChange={setProperties} />}
      </main>

      {/* DYNAMIC BILLING & COST OPTIMIZER CENTER MODAL */}
      {showCostModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in text-center">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-[2rem] shadow-2xl p-6 md:p-8 overflow-hidden max-h-[85vh] overflow-y-auto">
            {/* Decorative ambient background */}
            <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-72 h-72 rounded-full bg-orange-500/10 blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-72 h-72 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none"></div>

            <div className="relative flex items-start justify-between mb-6">
              <div className="text-left">
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">💎 Cost Optimizer & Billing Center</span>
                <h2 className="text-xl md:text-2xl font-black text-white mt-3 tracking-tight">Active Plan Conservation</h2>
                <p className="text-xs text-slate-400 mt-1">Identify which tools drive pricing and toggle Eco-Staging preferences below.</p>
              </div>
              <button 
                onClick={() => setShowCostModal(false)}
                className="p-2 text-slate-500 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="relative space-y-6">
              {/* Billing Assessment Section */}
              <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 md:p-5 space-y-4">
                <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider text-left">What spiked my bill yesterday?</h3>
                <p className="text-xs text-slate-400 leading-relaxed text-left">
                  Real Estate staging and styling require high-fidelity data transformation. The primary drivers of daily billing are:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <div className="border border-red-500/10 bg-red-950/20 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-black text-red-400 uppercase tracking-wider text-left">High Cost</span>
                      <span className="text-[10px]">🔥</span>
                    </div>
                    <h4 className="text-xs font-bold text-white text-left">Staging & Twilight</h4>
                    <p className="text-[9px] text-slate-400 mt-1 text-left leading-normal">Creates 1K staged canvas outputs + custom masks. Triggers premium generation charges.</p>
                  </div>
                  <div className="border border-orange-500/10 bg-orange-950/20 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-black text-orange-400 uppercase tracking-wider text-left">Medium Cost</span>
                      <span className="text-[10px]">⚡</span>
                    </div>
                    <h4 className="text-xs font-bold text-white text-left">Grounding Search</h4>
                    <p className="text-[9px] text-slate-400 mt-1 text-left leading-normal">Queries live indexes for score indicators. Adds a fixed external service surcharge.</p>
                  </div>
                  <div className="border border-slate-800 bg-slate-900/40 rounded-xl p-3 font-left">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider text-left">Minimal Cost</span>
                      <span className="text-[10px]">🌿</span>
                    </div>
                    <h4 className="text-xs font-bold text-white text-left">Listing & Text Pro</h4>
                    <p className="text-[9px] text-slate-400 mt-1 text-left leading-normal">Uses lightweight text-only configurations. Extremely low token ingestion footprint.</p>
                  </div>
                </div>
              </div>

              {/* Real-Time Toggles */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <span>Control Settings</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                </h3>

                {/* High Resolution Indicator */}
                <div className="flex items-start justify-between bg-slate-950/40 border border-white/5 rounded-2xl p-4 hover:border-emerald-500/20 transition-all">
                  <div className="space-y-1 max-w-full text-left">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white">Full 1K High-Resolution Output</h4>
                      <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase">Maximum Quality</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Always processes and outputs images in the maximum supported 1024px resolution (1K). This avoids downscaling, giving you crisp details, sharp boundaries, and perfect structural fidelity.
                    </p>
                  </div>
                </div>

                {/* Daily Token Safety Budget & Busy Day Override */}
                <div className="bg-slate-950/50 border border-orange-500/20 rounded-2xl p-4 text-left space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>🛡️</span> Daily Token Safety Cap
                      </h4>
                      {tokenGuardSettings.overriddenToday && (
                        <span className="text-[8px] font-black text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30 uppercase">
                          ⚡ Override Active
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setShowCostModal(false);
                        setShowTokenGuardSettings(true);
                      }}
                      className="text-[9px] font-bold text-orange-400 hover:text-orange-300 uppercase underline"
                    >
                      Budget Manager ⚙️
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Caps cumulative token usage per calendar day to prevent surprise billing spikes. Allows 1-click override on busy days.
                  </p>
                  <div className="flex justify-between items-center bg-slate-900/80 p-2.5 rounded-xl border border-white/5 text-[10px]">
                    <span className="text-slate-400">Current Daily Limit: <strong className="text-white font-mono">{formatTokens(tokenGuardSettings.dailyLimit)} tkn ({tokenToDollarString(tokenGuardSettings.dailyLimit)})</strong></span>
                    <span className="text-slate-400">Used Today: <strong className="text-emerald-400 font-mono">{formatTokens(tokenGuardSettings.usedToday)} tkn</strong></span>
                  </div>
                </div>
              </div>

              {/* Informational Advisory */}
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-left">
                <div className="flex gap-3">
                  <span className="text-lg">💡</span>
                  <div className="space-y-1">
                    <h5 className="text-xs font-bold text-white">Intelligent Optimizations Built-In:</h5>
                    <ul className="text-[10px] text-slate-400 list-disc list-inside space-y-1">
                      <li>Source templates are now automatically compressed before any scaling parameters are padded.</li>
                      <li>Calculated surgical masks slice and store locally, preventing repetitive mask model tasks.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowCostModal(false)}
                className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold uppercase text-[10px] tracking-widest rounded-xl transition-all"
              >
                Apply Conservation Choices
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION DIALOG */}
      {customConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in text-center">
          <div className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-[1.5rem] shadow-2xl p-6 overflow-hidden">
            <h3 className="text-sm font-black text-white mb-2 uppercase tracking-wider">{customConfirm.title}</h3>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed">{customConfirm.message}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  if (customConfirm.onCancel) customConfirm.onCancel();
                  setCustomConfirm(null);
                }}
                className="px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-bold text-[10px] uppercase tracking-wider hover:bg-slate-700 transition-colors"
              >
                {customConfirm.cancelText || "Cancel"}
              </button>
              <button
                onClick={customConfirm.onConfirm}
                className="px-5 py-2.5 rounded-xl bg-orange-600 text-white font-black text-[10px] uppercase tracking-wider hover:bg-orange-500 transition-colors"
              >
                {customConfirm.confirmText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM ALERT DIALOG */}
      {customAlert && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in text-center">
          <div className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-[1.5rem] shadow-2xl p-6 overflow-hidden">
            <h3 className="text-sm font-black text-white mb-2 uppercase tracking-wider">{customAlert.title}</h3>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed">{customAlert.message}</p>
            <div className="flex justify-center">
              <button
                onClick={() => {
                  setCustomAlert(null);
                }}
                className="px-6 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-black text-[10px] uppercase tracking-wider hover:bg-slate-700 transition-colors animate-pulse"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      {/* TOKEN GUARD SETTINGS MODAL */}
      <TokenGuardModal
        isOpen={showTokenGuardSettings}
        onClose={() => setShowTokenGuardSettings(false)}
        settings={tokenGuardSettings}
        onUpdateSettings={(newSettings) => setTokenGuardSettings(newSettings)}
        mode="settings"
      />

      {/* CLIENT AUTH, PRICING & DASHBOARD MODALS */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        onOpenAuthModal={() => {
          setShowPricingModal(false);
          setShowAuthModal(true);
        }}
      />
      <ClientDashboardModal
        isOpen={showDashboardModal}
        onClose={() => setShowDashboardModal(false)}
        onOpenPricing={() => setShowPricingModal(true)}
      />

      {/* Global Screen-Fixed Uncropped Tooltip Portal */}
      {!isAdmin && showTooltips && hoveredToolTooltip && (() => {
        const tooltipW = 280;
        const rect = hoveredToolTooltip.rect;
        // Position clearly to the RIGHT of the button/sidebar so the hovered tool remains 100% visible
        const fitsRight = (rect.right + tooltipW + 24) <= window.innerWidth;
        const leftPos = fitsRight ? (rect.right + 14) : Math.max(16, rect.left - tooltipW - 14);
        const topPos = Math.min(window.innerHeight - 180, Math.max(16, rect.top + (rect.height / 2) - 45));

        return (
          <div
            className="fixed pointer-events-none z-[999999] transition-all duration-150 animate-in fade-in zoom-in-95"
            style={{
              left: `${leftPos}px`,
              top: `${topPos}px`,
              width: `${tooltipW}px`
            }}
          >
            <div className="relative p-3.5 bg-slate-950/95 backdrop-blur-xl rounded-2xl border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.95)] ring-1 ring-white/10 text-left">
              {/* Pointing notch indicator */}
              <div
                className={`w-2.5 h-2.5 bg-slate-950 border-white/20 rotate-45 absolute top-10 ${fitsRight ? '-left-1.5 border-l border-b' : '-right-1.5 border-r border-t'}`}
              />
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10 mb-2">
                <span className="text-xs font-black text-white tracking-wide break-words">{hoveredToolTooltip.preset.label}</span>
                {(hoveredToolTooltip.preset.hasAiWatermark || ['furniture', 'style_swapper', 'p360_vstaging_3d', 'p360_style_swap', 'auto_declutter', 'p360_auto_declutter', 'sunset'].includes(hoveredToolTooltip.preset.id)) && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 border border-amber-300 flex items-center gap-1 shadow-sm">
                    <svg className="w-2 h-2 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg>
                    +AI Watermark
                  </span>
                )}
              </div>
              <p className="text-[11.5px] text-slate-300 leading-relaxed font-normal break-words">
                {hoveredToolTooltip.preset.description}
              </p>
            </div>
          </div>
        );
      })()}

      {/* TOKEN GUARD INTERCEPTION MODAL (SAFETY CAP TRIGGERED) */}
      <TokenGuardModal
        isOpen={showTokenGuardInterception}
        onClose={() => setShowTokenGuardInterception(false)}
        settings={tokenGuardSettings}
        onUpdateSettings={(newSettings) => setTokenGuardSettings(newSettings)}
        batchEstimatedTokens={pendingBatchTokens}
        mode="interception"
        onConfirmOverrideAndRun={() => {
          setShowTokenGuardInterception(false);
          handleGenerate(true);
        }}
      />
    </div>
  );
}

export default App;
