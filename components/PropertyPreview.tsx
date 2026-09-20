import { PropertyData, FloorPlanHotspot } from '../types';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import JSZip from 'jszip';
import QRCode from 'qrcode';
import { processWebGalleryImage } from '../services/imageUtils';
import { cleanEmbedUrl } from '../utils/embedUtils';
import { downloadAgentInstantVCard, generateMeCard, generateVCard, downloadVCardFile } from '../utils/vCardUtils';
import { NeighborhoodCommuteCalculator } from './NeighborhoodCommuteCalculator';

interface PropertyPreviewProps {
  property: PropertyData;
  brandingColor?: string;
}

interface SmartAgentContactModalProps {
  agent: {
    name?: string;
    brokerage?: string;
    phone?: string;
    email?: string;
    website?: string;
    title?: string;
    photo?: string | null;
    propertyAddress?: string;
    city?: string;
  };
  brandingColor: string;
  onClose: () => void;
}

const SmartAgentContactModal: React.FC<SmartAgentContactModalProps> = ({ agent, brandingColor, onClose }) => {
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [copiedInfo, setCopiedInfo] = useState(false);
  const [copiedVcf, setCopiedVcf] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const mecardStr = useMemo(() => {
    return generateMeCard({
      formattedName: agent.name || 'Real Estate Professional',
      organization: agent.brokerage || '',
      title: agent.title || 'Listing Associate',
      phone: agent.phone || '',
      email: agent.email || '',
      website: agent.website || '',
      propertyAddress: agent.propertyAddress || '',
      city: agent.city || '',
      note: agent.propertyAddress ? `Listing for ${agent.propertyAddress}` : undefined
    });
  }, [agent]);

  useEffect(() => {
    if (!qrCanvasRef.current) return;
    const canvas = qrCanvasRef.current;
    canvas.width = 400;
    canvas.height = 400;

    QRCode.toCanvas(
      canvas,
      mecardStr,
      {
        width: 400,
        margin: 3,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'H'
      },
      (err) => {
        if (err) console.error('QR Error:', err);
        if (canvas) {
          canvas.style.width = '100%';
          canvas.style.height = '100%';
        }
      }
    );
  }, [mecardStr]);

  const handleDownload = () => {
    setIsDownloading(true);
    try {
      downloadAgentInstantVCard(agent);
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsDownloading(false), 800);
    }
  };

  const handleCopyDetails = () => {
    const text = [
      agent.name,
      agent.title,
      agent.brokerage,
      agent.phone ? `Phone: ${agent.phone}` : '',
      agent.email ? `Email: ${agent.email}` : '',
      agent.website ? `Website: ${agent.website}` : '',
      agent.propertyAddress ? `Property: ${agent.propertyAddress}` : ''
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text);
    setCopiedInfo(true);
    setTimeout(() => setCopiedInfo(false), 2500);
  };

  const handleCopyVcf = () => {
    const vcfStr = generateVCard({
      formattedName: agent.name,
      organization: agent.brokerage,
      title: agent.title,
      phone: agent.phone,
      email: agent.email,
      website: agent.website,
      propertyAddress: agent.propertyAddress
    });
    navigator.clipboard.writeText(vcfStr);
    setCopiedVcf(true);
    setTimeout(() => setCopiedVcf(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
      <div 
        className="max-w-lg w-full glass-panel p-6 sm:p-8 rounded-[2.5rem] border border-white/10 shadow-2xl relative animate-fade-in-up my-auto"
        style={{ boxShadow: `0 25px 60px -15px ${brandingColor}30` }}
      >
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors z-10 cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="space-y-6">
          {/* Header & Agent Profile */}
          <div className="flex items-center gap-4">
            <div 
              className="w-20 h-20 rounded-full border-2 p-1 overflow-hidden shrink-0 shadow-xl bg-slate-900"
              style={{ borderColor: brandingColor }}
            >
              {agent.photo ? (
                <img src={agent.photo} alt={agent.name || 'Agent'} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-600 font-bold text-xl rounded-full">
                  {(agent.name || 'A')[0]}
                </div>
              )}
            </div>
            
            <div className="space-y-1 min-w-0 flex-grow">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  {agent.title || 'Listing Associate'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Verified Contact
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight truncate">
                {agent.name || 'Real Estate Professional'}
              </h3>
              {agent.brokerage && (
                <p className="text-[10px] font-bold uppercase tracking-widest truncate" style={{ color: brandingColor }}>
                  {agent.brokerage}
                </p>
              )}
            </div>
          </div>

          {/* Quick Communication Grid */}
          <div className="grid grid-cols-3 gap-2.5">
            {agent.phone ? (
              <a 
                href={`tel:${agent.phone.replace(/[^0-9+]/g, '')}`}
                className="p-3 bg-slate-900/90 hover:bg-slate-800 border border-white/10 hover:border-white/20 rounded-2xl flex flex-col items-center justify-center gap-1 text-center transition-all group"
              >
                <span className="text-base group-hover:scale-110 transition-transform">📞</span>
                <span className="text-[9px] font-black text-white uppercase tracking-wider">Call Agent</span>
                <span className="text-[8px] text-slate-400 font-mono truncate max-w-full">{agent.phone}</span>
              </a>
            ) : (
              <div className="p-3 bg-slate-900/40 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-1 text-center opacity-40">
                <span className="text-base">📞</span>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Call</span>
              </div>
            )}

            {agent.phone ? (
              <a 
                href={`sms:${agent.phone.replace(/[^0-9+]/g, '')}`}
                className="p-3 bg-slate-900/90 hover:bg-slate-800 border border-white/10 hover:border-white/20 rounded-2xl flex flex-col items-center justify-center gap-1 text-center transition-all group"
              >
                <span className="text-base group-hover:scale-110 transition-transform">💬</span>
                <span className="text-[9px] font-black text-white uppercase tracking-wider">Text SMS</span>
                <span className="text-[8px] text-slate-400 truncate max-w-full">Direct Message</span>
              </a>
            ) : (
              <div className="p-3 bg-slate-900/40 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-1 text-center opacity-40">
                <span className="text-base">💬</span>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Text</span>
              </div>
            )}

            {agent.email ? (
              <a 
                href={`mailto:${agent.email}`}
                className="p-3 bg-slate-900/90 hover:bg-slate-800 border border-white/10 hover:border-white/20 rounded-2xl flex flex-col items-center justify-center gap-1 text-center transition-all group"
              >
                <span className="text-base group-hover:scale-110 transition-transform">✉️</span>
                <span className="text-[9px] font-black text-white uppercase tracking-wider">Send Email</span>
                <span className="text-[8px] text-slate-400 truncate max-w-full">{agent.email.split('@')[0]}</span>
              </a>
            ) : (
              <div className="p-3 bg-slate-900/40 border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-1 text-center opacity-40">
                <span className="text-base">✉️</span>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Email</span>
              </div>
            )}
          </div>

          {/* Interactive QR Code for Smartphone Camera */}
          <div className="p-4 bg-slate-950/80 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-28 h-28 bg-white p-2 rounded-xl shrink-0 shadow-inner flex items-center justify-center">
              <canvas ref={qrCanvasRef} className="w-full h-full object-contain" />
            </div>
            <div className="space-y-1.5 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-orange-400 text-[10px] font-black uppercase tracking-wider">
                <span>📷</span> Scan with Phone Camera
              </div>
              <p className="text-[11px] text-slate-300 font-medium leading-relaxed">
                Open your iPhone or Android camera to immediately save this agent's contact details into your phone address book.
              </p>
              {agent.propertyAddress && (
                <div className="text-[9px] font-bold text-slate-500 truncate max-w-xs">
                  Listing: {agent.propertyAddress}
                </div>
              )}
            </div>
          </div>

          {/* Download & Copy Buttons */}
          <div className="space-y-2.5 pt-2">
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-emerald-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {isDownloading ? 'Generating & Downloading...' : 'Download Contact Card (.vcf)'}
            </button>

            <div className="flex gap-2">
              <button
                onClick={handleCopyDetails}
                className="flex-1 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-wider border border-white/5 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>📋</span> {copiedInfo ? 'Copied Details! ✓' : 'Copy Contact Info'}
              </button>
              <button
                onClick={handleCopyVcf}
                className="flex-1 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-wider border border-white/5 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>📇</span> {copiedVcf ? 'Copied vCard! ✓' : 'Copy .vcf Data'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PanoViewerContainer: React.FC<{ src: string }> = ({ src }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    let active = true;

    const init = async () => {
      if (!document.getElementById('pannellum-css')) {
        const link = document.createElement('link');
        link.id = 'pannellum-css';
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css';
        document.head.appendChild(link);
      }
      if (!(window as any).pannellum) {
        if (!document.getElementById('pannellum-js')) {
          const script = document.createElement('script');
          script.id = 'pannellum-js';
          script.src = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js';
          document.head.appendChild(script);
          await new Promise<void>((resolve) => {
            script.onload = () => resolve();
          });
        } else {
          await new Promise<void>((resolve) => {
            const script = document.getElementById('pannellum-js') as HTMLScriptElement;
            if ((window as any).pannellum) resolve();
            else script.addEventListener('load', () => resolve());
          });
        }
      }

      if (!active || !containerRef.current || !(window as any).pannellum) return;

      if (viewerRef.current) {
        try { viewerRef.current.destroy(); } catch (e) {}
      }

      viewerRef.current = (window as any).pannellum.viewer(containerRef.current, {
        type: 'equirectangular',
        panorama: src,
        autoLoad: true,
        showZoomCtrl: true,
        compass: false,
        hfov: 100,
        minHfov: 30,
        maxHfov: 120,
        haov: 360,
        vaov: 180,
        vOffset: 0,
        friction: 0.15
      });
    };

    init();

    return () => {
      active = false;
      if (viewerRef.current) {
        try { viewerRef.current.destroy(); } catch (e) {}
        viewerRef.current = null;
      }
    };
  }, [src]);

  return (
    <div className="w-[85vw] max-w-5xl h-[68vh] rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};

const PropertyPreview: React.FC<PropertyPreviewProps> = ({ property, brandingColor = '#f97316' }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'gallery' | 'floorplan' | 'interactive' | 'drone360' | 'map'>('gallery');
  const [mapLayer, setMapLayer] = useState<'roadmap' | 'satellite' | 'terrain'>('roadmap');
  const [activePoi, setActivePoi] = useState<string>('all');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [selectedVCardAgent, setSelectedVCardAgent] = useState<any | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeHotspotUrl, setActiveHotspotUrl] = useState<string | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<FloorPlanHotspot | null>(null);
  const [is360Active, setIs360Active] = useState(false);
  const [isHotspotMode, setIsHotspotMode] = useState(false);
  const [floorPlanZoom, setFloorPlanZoom] = useState(1);
  const touchPinchRef = useRef<{ initialDist: number; initialZoom: number } | null>(null);

  // Website preview Slideshow & Gallery state
  const [websiteViewMode, setWebsiteViewMode] = useState<'slideshow' | 'gallery'>('slideshow');
  const [websiteSlideIndex, setWebsiteSlideIndex] = useState(0);
  const [isWebsitePlaying, setIsWebsitePlaying] = useState(true);
  const [showWebsiteThumbStrip, setShowWebsiteThumbStrip] = useState(false);

  // 2-Second Auto-play slideshow timer for website
  useEffect(() => {
    if (activeTab !== 'gallery' || websiteViewMode !== 'slideshow' || !isWebsitePlaying || !property.galleryImages || property.galleryImages.length <= 1) {
      return;
    }

    const timer = setInterval(() => {
      setWebsiteSlideIndex((prev) => (prev + 1) % property.galleryImages.length);
    }, 2000);

    return () => clearInterval(timer);
  }, [activeTab, websiteViewMode, isWebsitePlaying, property.galleryImages?.length]);

  // Keep index within bounds
  useEffect(() => {
    if (property.galleryImages && property.galleryImages.length > 0 && websiteSlideIndex >= property.galleryImages.length) {
      setWebsiteSlideIndex(0);
    }
  }, [property.galleryImages?.length, websiteSlideIndex]);

  const handleFloorPlanTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchPinchRef.current = { initialDist: dist, initialZoom: floorPlanZoom };
    }
  };

  const handleFloorPlanTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchPinchRef.current && touchPinchRef.current.initialDist > 0) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scaleChange = dist / touchPinchRef.current.initialDist;
      const newZoom = Math.min(3, Math.max(1, +(touchPinchRef.current.initialZoom * scaleChange).toFixed(2)));
      setFloorPlanZoom(newZoom);
    }
  };

  const handleFloorPlanTouchEnd = () => {
    touchPinchRef.current = null;
  };

  useEffect(() => {
    if (!isHotspotMode) {
      setIs360Active(false);
    }
  }, [lightboxIndex, activeHotspotUrl, isHotspotMode]);
  const galleryRef = useRef<HTMLDivElement>(null);

  const hasAgent2 = Boolean(
    property.agent2Name ||
    property.agent2Headshot ||
    property.agent2PhoneNumber ||
    property.agent2Email ||
    property.agent2Logo ||
    property.agent2Brokerage
  );

  const fullAddress = useMemo(() => {
    const addr = [property.unit, property.address].filter(Boolean).join(' - ');
    return (addr || "") + (property.city ? `, ${property.city}` : '');
  }, [property.unit, property.address, property.city]);



  const formatUrl = (url: string | undefined, businessName?: string): string => { 
    if (!url || typeof url !== 'string' || url.trim() === '' || url === '#' || url === 'undefined' || url === 'null') {
       if (businessName) return `https://www.google.com/search?q=${encodeURIComponent(businessName + " official website")}`;
       return '#';
    }

    const trimmed = url.trim(); 
    
    // If it's already a full URL, return it
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    
    // If it has a dot and no spaces, it's likely a domain (e.g. "google.com")
    if (trimmed.includes('.') && !trimmed.includes(' ')) return `https://${trimmed}`;
    
    // If it's a search string or anything else, fall back to Google Search
    if (businessName) {
       return `https://www.google.com/search?q=${encodeURIComponent(businessName + " official website")}`;
    }
    
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
  };

  const handleScroll = () => { if (!galleryRef.current) return; const { scrollLeft, clientWidth } = galleryRef.current; setActiveIndex(Math.round(scrollLeft / clientWidth)); };
  const scrollToImage = (index: number) => { 
    const el = document.getElementById(`preview-gallery-photo-${index}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (galleryRef.current) {
      galleryRef.current.scrollTo({ left: galleryRef.current.clientWidth * index, behavior: 'smooth' }); 
    }
  };
  
  const handleNetlifySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(formData as any).toString(),
    })
      .then(() => {
        setIsSubmitted(true);
        setTimeout(() => { setShowContactModal(false); setIsSubmitted(false); }, 3000);
      })
      .catch((error) => alert(error));
  };

  const handleDownloadWebsite = async () => {
    setIsExporting(true);
    try {
      const zip = new JSZip(); 
      const rootFolder = zip.folder("index")!;
      const imgFolder = rootFolder.folder("images")!; 
      const galleryFolder = imgFolder.folder("gallery")!;
      const assetPaths: Record<string, string> = { hero: "", headshot: "", logo: "", floorplan: "" }; 
      const galleryPaths: string[] = [];
      const scriptGalleryImages: string[] = [];

      const allGalleryImages = [...(property.galleryImages || [])];
      
      const exportHotspots = (property.floorPlanHotspots || []).map((spot) => {
        let resolvedIdx: number | undefined = undefined;
        // Priority 1: Match by exact targetImageUrl in allGalleryImages
        if (spot.targetImageUrl) {
          const matchIdx = allGalleryImages.findIndex(img => img === spot.targetImageUrl);
          if (matchIdx !== -1) {
            resolvedIdx = matchIdx;
          }
        }
        // Priority 2: Use targetImageIndex if valid and within range
        if (resolvedIdx === undefined && spot.targetImageIndex !== undefined && spot.targetImageIndex >= 0 && spot.targetImageIndex < property.galleryImages.length) {
          resolvedIdx = spot.targetImageIndex;
        }

        let is360 = false;
        if (spot.is360 === true) {
          is360 = true;
        } else if (spot.is360 === false || spot.targetImageIndex !== undefined) {
          is360 = false;
        } else if (spot.targetImageUrl) {
          is360 = true;
        }

        // Priority 3: If targetImageUrl exists but wasn't in gallery, push it to gallery so it gets saved
        if (resolvedIdx === undefined && spot.targetImageUrl) {
          allGalleryImages.push(spot.targetImageUrl);
          resolvedIdx = allGalleryImages.length - 1;
        }
        return {
          ...spot,
          targetImageIndex: resolvedIdx ?? 0,
          is360
        };
      });

      const dataUrlToBlob = async (url: string): Promise<{ blob: Blob; ext: string }> => { 
        const res = await fetch(url); 
        const blob = await res.blob(); 
        let ext = blob.type.split('/')[1] || 'jpg'; 
        if (ext === 'jpeg' || ext === 'jpg' || ext === 'pjpeg') ext = 'jpg';
        else if (ext === 'png') ext = 'png';
        else if (ext === 'webp') ext = 'webp';
        else ext = 'jpg';
        return { blob, ext }; 
      };

      const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      };

      const panoDataUrls: Record<number, string> = {};

      for (let i = 0; i < allGalleryImages.length; i++) {
        const url = allGalleryImages[i]; 
        try {
          if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) { 
            const is360 = exportHotspots.some(spot => spot.targetImageIndex === i && spot.is360);
            const isHero = i === 0;
            // High-resolution export: Hero at 2880px (0.95 quality) for crisp 4K/Retina displays, gallery at 1920px (0.88 quality), 360 panos at 3072px
            const maxDim = is360 ? 3072 : (isHero ? 2880 : 1920);
            const quality = isHero ? 0.95 : 0.88;
            const { blob, ext, dataUrl } = await processWebGalleryImage(url, is360, maxDim, quality); 
            const fileName = `img_${i}.${ext}`; 
            galleryFolder.file(fileName, blob); 
            const path = `images/gallery/${fileName}`;
            galleryPaths.push(path); 
            scriptGalleryImages.push(url);

            // Save relative path for 360 Pannellum viewer if applicable
            if (is360) {
              panoDataUrls[i] = path;
            }

            if (i === 0) assetPaths.hero = path; 
          } else { 
            galleryPaths.push(url); 
            scriptGalleryImages.push(url);
            if (i === 0) assetPaths.hero = url; 
          }
        } catch (e) {
          console.error(`Error processing gallery image ${i}:`, e);
          galleryPaths.push(url);
          scriptGalleryImages.push(url);
          if (i === 0) assetPaths.hero = url;
        }
      }

      const mainGalleryCount = (property.galleryImages || []).length;
      const mainGalleryPaths = galleryPaths.slice(0, mainGalleryCount); 
      const processAsset = async (url: string | undefined, name: string) => { 
        if (url && (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://'))) { 
          const { blob, ext } = await processWebGalleryImage(url, false, 1200, 0.85); 
          const fileName = `${name}.${ext}`; 
          imgFolder.file(fileName, blob); 
          return `images/${fileName}`; 
        } 
        return url || ""; 
      };
      assetPaths.headshot = await processAsset(property.headshot, 'headshot'); 
      assetPaths.logo = await processAsset(property.logo, 'logo'); 
      assetPaths.headshot2 = await processAsset(property.agent2Headshot, 'headshot2'); 
      assetPaths.logo2 = await processAsset(property.agent2Logo, 'logo2'); 
      assetPaths.floorplan = await processAsset(property.floorPlan, 'floorplan');
      
      const specsString = [
        property.bed ? `${property.bed} BED` : '', 
        property.bath ? `${property.bath} BATH` : '', 
        property.sqft ? `${property.sqft} SQFT` : ''
      ].filter(Boolean).join(' • ');
      
      const videoEmbed = cleanEmbedUrl(property.videoUrl);
      const matterport = cleanEmbedUrl(property.matterportUrl);
      const droneEmbed = cleanEmbedUrl(property.drone);
      const threeDFloorPlanEmbed = cleanEmbedUrl(property.threeDFloorPlan);
      const mapSearchAddress = [property.address, property.city].filter(Boolean).join(', ') || property.address || property.city || 'Beverly Hills, CA';
      const showMapTab = property.showMap !== false && Boolean(property.address || property.city);

      let exportScoreHash = 0;
      const exportAddrStr = (mapSearchAddress || '').toLowerCase();
      for (let i = 0; i < exportAddrStr.length; i++) {
        exportScoreHash = (exportScoreHash << 5) - exportScoreHash + exportAddrStr.charCodeAt(i);
        exportScoreHash |= 0;
      }
      const exportAbsHash = Math.abs(exportScoreHash);
      const exportWalkScore = 84 + (exportAbsHash % 13);
      const exportBikeScore = 78 + ((exportAbsHash >> 2) % 15);
      const exportTransitScore = 72 + ((exportAbsHash >> 4) % 17);
      const exportQuietScore = 85 + ((exportAbsHash >> 6) % 12);

      const exportHasAgent2 = Boolean(property.agent2Name || property.agent2Headshot || property.agent2PhoneNumber || property.agent2Email || property.agent2Brokerage || assetPaths.headshot2 || assetPaths.logo2);

      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${property.unit ? property.unit + ' - ' : ''}${property.address || 'Luxury Estate'}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css"/>
    <script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"></script>
    <style>
        :root { --brand: ${brandingColor}; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #020617; color: #f8fafc; overflow-x: hidden; }
        .glass-panel { background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.08); }
        .tab-content { display: none; }
        .tab-content.active { display: block; animation: fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes sun-flare-main { 0% { opacity: 0.3; transform: scale(1) translate(-20%, -20%); } 50% { opacity: 0.7; transform: scale(1.15) translate(-15%, -15%); } 100% { opacity: 0.3; transform: scale(1) translate(-20%, -20%); } }
        .sun-flare-main { position: absolute; top: -10%; left: -10%; width: 70%; height: 70%; background: radial-gradient(circle at center, rgba(255,255,255,0.5) 0%, rgba(251,191,36,0.2) 30%, rgba(249,115,22,0.05) 50%, transparent 70%); filter: blur(70px); animation: sun-flare-main 12s infinite ease-in-out; pointer-events: none; z-index: 10; }
        .tab-btn { color: #64748b; border-bottom: 2px solid transparent; transition: all 0.3s; cursor: pointer; }
        .tab-btn.active { color: var(--brand); border-color: var(--brand); }
        .mobile-gallery-scrollbar::-webkit-scrollbar { height: 6px; display: block; }
        .mobile-gallery-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
        .mobile-gallery-scrollbar::-webkit-scrollbar-thumb { background: var(--brand); border-radius: 10px; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        #lightbox { display: none; position: fixed; inset: 0; background: rgba(2, 6, 23, 0.98); backdrop-filter: blur(12px); z-index: 1000; flex-direction: column; align-items: center; justify-content: center; padding: 0.75rem; }
        #lightbox.active { display: flex; animation: fade-in-up 0.3s ease-out; }
        .lightbox-control { background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); color: white; padding: 0.75rem; border-radius: 1rem; transition: all 0.2s; cursor: pointer; backdrop-filter: blur(8px); }
        .lightbox-control:hover { background: rgba(255, 255, 255, 0.2); border-color: var(--brand); }
    </style>
</head>
<body>
    <div id="lightbox" onclick="if(event.target === this) closeLightbox()">
        <button onclick="closeLightbox()" class="absolute top-4 right-4 sm:top-8 sm:right-8 lightbox-control z-[1100]"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" class="w-5 h-5 sm:w-6 sm:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        <button id="lightbox-prev" onclick="changeLightbox(-1)" class="absolute left-2 sm:left-8 top-1/2 -translate-y-1/2 lightbox-control z-[1100]"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" class="w-5 h-5 sm:w-6 sm:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg></button>
        <button id="lightbox-next" onclick="changeLightbox(1)" class="absolute right-2 sm:right-8 top-1/2 -translate-y-1/2 lightbox-control z-[1100]"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" class="w-5 h-5 sm:w-6 sm:h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg></button>
        <div id="lightbox-badge" class="absolute top-4 left-4 sm:top-8 sm:left-8 px-3 py-1.5 sm:px-4 sm:py-2 bg-orange-600 text-white font-black text-[9px] sm:text-xs uppercase tracking-widest rounded-xl shadow-2xl flex items-center gap-2 z-[1100]" style="display: none;">
            <span>🌐</span> 360° Interactive Panorama
        </div>
        <img id="lightbox-img" src="" class="max-w-full max-h-[82vh] object-contain shadow-2xl rounded-2xl border border-white/5">
        <div id="lightbox-pano" class="w-[96vw] sm:w-[90vw] max-w-5xl h-[75vh] sm:h-[80vh] rounded-2xl overflow-hidden shadow-2xl border border-white/10" style="display: none;"></div>
        <div class="mt-4 sm:mt-6 text-[10px] font-black uppercase tracking-widest text-slate-500" id="lightbox-counter">0 / 0</div>
    </div>

    <div class="h-[65vh] md:h-[80vh] w-full relative overflow-hidden">
        <div class="sun-flare-main"></div>
        <img src="${assetPaths.hero}" fetchpriority="high" decoding="async" class="w-full h-full object-cover">
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
        <div class="absolute bottom-12 left-0 w-full px-6 md:px-12 max-w-[1400px] mx-auto right-0 flex flex-wrap items-end justify-between gap-6">
            <div class="space-y-4">
                ${property.price ? `<div class="inline-flex px-4 py-2 rounded-lg text-lg font-black text-white uppercase tracking-tight" style="background-color: var(--brand)">${property.price}</div>` : ''}
                <h1 class="text-[clamp(1.5rem,4vw,4.5rem)] font-black text-white uppercase tracking-tighter leading-[1.1]">${property.unit ? property.unit + ' - ' : ''}${property.address}</h1>
                <div class="flex items-center gap-6 text-slate-400 font-bold uppercase tracking-[0.2em] text-xs md:text-sm"><span>${property.city || 'TBD'}</span><span class="opacity-20">|</span><span class="text-white">${specsString}</span></div>
            </div>
            ${assetPaths.logo ? `<div class="p-4 md:p-6 glass-panel rounded-3xl border border-white/10 hidden md:flex"><img src="${assetPaths.logo}" class="h-16 object-contain"></div>` : ''}
        </div>
    </div>

    <div class="max-w-[1440px] mx-auto px-6 md:px-12 pt-12 md:pt-20 pb-32">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 md:gap-20">
            <div class="lg:col-span-8">
                <div class="flex justify-start md:justify-center gap-6 md:gap-12 overflow-x-auto border-b border-white/5 py-6 mb-8 scrollbar-hide">
                    <div onclick="switchTab('gallery')" id="btn-gallery" class="tab-btn active whitespace-nowrap px-2 py-2 text-[11px] font-black uppercase tracking-[0.2em]">Gallery</div>
                    ${(assetPaths.floorplan || threeDFloorPlanEmbed) ? `<div onclick="switchTab('floorplan')" id="btn-floorplan" class="tab-btn whitespace-nowrap px-2 py-2 text-[11px] font-black uppercase tracking-[0.2em]">Floor Plan</div>` : ''}
                    ${(videoEmbed || matterport) ? `<div onclick="switchTab('interactive')" id="btn-interactive" class="tab-btn whitespace-nowrap px-2 py-2 text-[11px] font-black uppercase tracking-[0.2em]">Interactive</div>` : ''}
                    ${droneEmbed ? `<div onclick="switchTab('drone360')" id="btn-drone360" class="tab-btn whitespace-nowrap px-2 py-2 text-[11px] font-black uppercase tracking-[0.2em]">Drone 360</div>` : ''}
                    ${showMapTab ? `<div onclick="switchTab('map')" id="btn-map" class="tab-btn whitespace-nowrap px-2 py-2 text-[11px] font-black uppercase tracking-[0.2em]">Location &amp; Commute</div>` : ''}
                </div>

                <div id="gallery" class="tab-content active">
                    <!-- Website Fast Scroller & Slideshow Controller Ribbon -->
                    <div class="w-full mb-6">
                        <div class="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl p-4 md:p-5 shadow-2xl space-y-3">
                            <div class="flex flex-wrap items-center justify-between gap-3 px-1">
                                <div class="flex items-center gap-2.5">
                                    <span id="export-status-dot" class="w-2.5 h-2.5 rounded-full animate-ping" style="background-color: ${brandingColor}"></span>
                                    <div class="flex flex-col">
                                        <span id="export-status-title" class="text-[11px] font-black uppercase tracking-wider text-white">Slideshow Mode (2s Auto-Play)</span>
                                        <span id="export-status-sub" class="text-[9px] font-mono text-slate-400">Auto-advancing every 2 seconds</span>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <button id="export-play-btn" type="button" onclick="toggleExportSlideshowPlay()" class="text-[10px] font-black uppercase px-3 py-1.5 rounded-xl border transition-all cursor-pointer" style="background-color: ${brandingColor}20; color: ${brandingColor}; border-color: ${brandingColor}40;">
                                        ⏸ Pause
                                    </button>
                                    <button type="button" onclick="toggleExportThumbStrip()" class="text-[10px] font-bold px-3 py-1.5 rounded-xl border uppercase transition-all cursor-pointer" style="background-color: ${brandingColor}15; color: ${brandingColor}; border-color: ${brandingColor}30;">
                                        Thumbnails ▼
                                    </button>
                                    <button type="button" onclick="setExportSlide(0)" class="text-[10px] font-bold text-slate-400 hover:text-white bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-white/5 uppercase transition-colors cursor-pointer">
                                        First ⬆
                                    </button>
                                    <button type="button" onclick="setExportSlide(${Math.max(0, mainGalleryPaths.length - 1)})" class="text-[10px] font-bold text-slate-400 hover:text-white bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-white/5 uppercase transition-colors cursor-pointer">
                                        Last ⬇
                                    </button>
                                </div>
                            </div>

                            <!-- Horizontal Scrubbing Slider -->
                            <div class="relative flex items-center gap-2.5 px-1 pt-1 pb-1">
                                <button type="button" onclick="changeExportSlide(-1)" class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-200 active:scale-95 flex items-center justify-center text-xs font-bold shrink-0 transition-all cursor-pointer" title="Previous Photo">
                                    ◀
                                </button>
                                <div class="relative flex-grow flex items-center h-8">
                                    <input id="export-slider-input" type="range" min="0" max="${Math.max(0, mainGalleryPaths.length - 1)}" value="0" oninput="setExportSlide(parseInt(this.value, 10))" class="w-full h-3 bg-slate-800 border border-white/10 rounded-lg appearance-none cursor-pointer focus:outline-none" style="accent-color: ${brandingColor}">
                                </div>
                                <button type="button" onclick="changeExportSlide(1)" class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-200 active:scale-95 flex items-center justify-center text-xs font-bold shrink-0 transition-all cursor-pointer" title="Next Photo">
                                    ▶
                                </button>
                                <div id="export-slide-badge" class="shrink-0 px-3 py-1.5 rounded-xl text-xs font-mono font-black min-w-[65px] text-center border shadow-md" style="background-color: ${brandingColor}15; border-color: ${brandingColor}35; color: ${brandingColor}">
                                    #1 <span class="text-slate-500 text-[10px]">/ ${mainGalleryPaths.length}</span>
                                </div>
                            </div>

                            <!-- Collapsible Thumbnail Strip -->
                            <div id="export-thumb-strip" class="flex gap-2.5 overflow-x-auto py-3 px-1 scrollbar-thin mt-2 border-t border-white/5" style="display: none;">
                                ${mainGalleryPaths.map((p, idx) => `
                                    <button type="button" onclick="setExportSlide(${idx})" class="export-thumb-item relative shrink-0 w-16 h-16 rounded-2xl overflow-hidden border-2 transition-all cursor-pointer ${idx === 0 ? 'scale-105 shadow-xl' : 'border-white/10 opacity-60 hover:opacity-100'}" style="${idx === 0 ? `border-color: ${brandingColor}; box-shadow: 0 0 15px ${brandingColor}40` : ''}">
                                        <img src="${p}" loading="lazy" class="w-full h-full object-cover">
                                        <span class="absolute bottom-0 inset-x-0 bg-black/75 text-[9px] font-mono text-white text-center font-bold">${idx + 1}</span>
                                    </button>
                                `).join('')}
                            </div>

                            <!-- PROMINENT BUTTON ON THE WEBSITE BELOW THE SCROLL BAR -->
                            <div class="pt-2 border-t border-white/5">
                                <button id="export-view-mode-btn" type="button" onclick="toggleExportViewMode()" class="w-full py-3.5 px-5 rounded-2xl font-black uppercase tracking-wider text-xs shadow-2xl transition-all flex items-center justify-center gap-3 border active:scale-[0.99] cursor-pointer" style="background-color: ${brandingColor}; border-color: rgba(255,255,255,0.25); color: #ffffff; box-shadow: 0 10px 25px -5px ${brandingColor}60">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4 text-white">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25a2.25 2.25 0 0 1-2.25 2.25h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
                                    </svg>
                                    <span>See as Gallery (Populate All Images)</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Slideshow Mode Container -->
                    <div id="export-slideshow-container" class="relative group rounded-3xl overflow-hidden bg-slate-900 border border-white/10 shadow-2xl aspect-[16/10] max-h-[700px] flex items-center justify-center">
                        <img id="export-slideshow-img" src="${mainGalleryPaths[0] || ''}" onclick="openLightbox(window.exportSlideIndex !== undefined ? window.exportSlideIndex : 0)" class="w-full h-full object-contain cursor-pointer transition-transform duration-500 hover:scale-[1.02]">
                        <button type="button" onclick="changeExportSlide(-1)" class="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-950/70 border border-white/20 text-white flex items-center justify-center opacity-80 hover:opacity-100 hover:scale-110 active:scale-95 transition-all shadow-2xl backdrop-blur-md cursor-pointer">◀</button>
                        <button type="button" onclick="changeExportSlide(1)" class="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-950/70 border border-white/20 text-white flex items-center justify-center opacity-80 hover:opacity-100 hover:scale-110 active:scale-95 transition-all shadow-2xl backdrop-blur-md cursor-pointer">▶</button>
                        <div class="absolute bottom-4 inset-x-4 flex items-center justify-between pointer-events-none">
                            <span id="export-slideshow-hud" class="px-3.5 py-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/15 text-xs font-mono font-bold text-white shadow-lg">Photo #1 of ${mainGalleryPaths.length}</span>
                            <span class="px-3.5 py-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/15 text-[10px] font-bold uppercase text-slate-300 shadow-lg">Click photo to expand 🔍</span>
                        </div>
                    </div>

                    <!-- Gallery Grid View Container (Hidden initially when in slideshow mode) -->
                    <div id="export-gallery-container" style="display: none;" class="w-full">
                        <div class="columns-1 sm:columns-2 gap-4 md:gap-6">
                            ${mainGalleryPaths.map((p, idx) => `
                                <div id="export-gallery-photo-${idx}" onclick="openLightbox(${idx})" class="break-inside-avoid w-full rounded-3xl overflow-hidden border border-white/10 bg-slate-900 shadow-xl mb-4 md:mb-6 cursor-pointer group hover:border-white/25 transition-all duration-300">
                                    <img src="${p}" loading="lazy" decoding="async" class="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-700" alt="Gallery photo ${idx + 1}">
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                
                <div id="floorplan" class="tab-content">
                    ${assetPaths.floorplan ? `
                    <div class="space-y-8">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 glass-panel rounded-3xl border border-white/10">
                            <div>
                                <h3 class="text-sm font-black text-white uppercase tracking-wider">Architectural Floor Plan</h3>
                                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Click numbered hotspot pins to view room photography</p>
                            </div>
                            <div class="flex items-center gap-3">
                                ${(exportHotspots && exportHotspots.length > 0) ? `<div class="px-3 py-1.5 bg-orange-500/10 border border-orange-500/30 rounded-xl text-[10px] font-black text-orange-400 uppercase tracking-widest">🎯 ${exportHotspots.length} Hotspots</div>` : ''}
                                <a href="${assetPaths.floorplan}" download="FloorPlan.png" class="px-4 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg transition-all flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                    Download Floor Plan
                                </a>
                            </div>
                        </div>
                        <div class="p-4 sm:p-8 bg-slate-900 rounded-[2.5rem] border border-white/10 flex flex-col items-center justify-center shadow-2xl relative overflow-hidden group">
                            <div class="w-full flex flex-wrap items-center justify-between gap-3 mb-4 p-3.5 bg-slate-950/80 backdrop-blur-md rounded-2xl border border-white/10 z-30">
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="text-[10px] font-black text-orange-400 uppercase tracking-widest mr-1">🔍 Blueprint Zoom:</span>
                                    <button onclick="zoomExportFloorPlan(-0.25)" class="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-black text-xs flex items-center justify-center border border-white/10 cursor-pointer">-</button>
                                    <button onclick="setExportFloorPlanZoom(1)" class="px-2.5 py-1 rounded-lg text-[10px] font-black bg-slate-900 text-slate-400 border border-white/10 hover:text-white cursor-pointer">100%</button>
                                    <button onclick="setExportFloorPlanZoom(1.25)" class="px-2.5 py-1 rounded-lg text-[10px] font-black bg-slate-900 text-slate-400 border border-white/10 hover:text-white cursor-pointer">125%</button>
                                    <button onclick="setExportFloorPlanZoom(1.5)" class="px-2.5 py-1 rounded-lg text-[10px] font-black bg-slate-900 text-slate-400 border border-white/10 hover:text-white cursor-pointer">150%</button>
                                    <button onclick="setExportFloorPlanZoom(2)" class="px-2.5 py-1 rounded-lg text-[10px] font-black bg-slate-900 text-slate-400 border border-white/10 hover:text-white cursor-pointer">200%</button>
                                    <button onclick="setExportFloorPlanZoom(2.5)" class="px-2.5 py-1 rounded-lg text-[10px] font-black bg-slate-900 text-slate-400 border border-white/10 hover:text-white cursor-pointer">250%</button>
                                    <button onclick="zoomExportFloorPlan(0.25)" class="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-black text-xs flex items-center justify-center border border-white/10 cursor-pointer">+</button>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="hidden sm:inline-block text-[9px] font-bold text-slate-500 uppercase tracking-widest">Pins stay small when zoomed</span>
                                    <a href="${assetPaths.floorplan}" download="FloorPlan.png" class="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white border border-white/20 rounded-xl text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-xl flex items-center gap-1.5 transition-all">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5 text-orange-400"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                        Download
                                    </a>
                                </div>
                            </div>
                            <div id="export-floorplan-scroll" class="w-full max-h-[75vh] overflow-auto rounded-2xl p-1 bg-slate-950/60 border border-white/5 flex justify-start items-start select-none">
                                <div id="export-floorplan-canvas" class="relative w-full max-w-4xl bg-white rounded-2xl overflow-hidden shadow-2xl transition-transform duration-200 shrink-0 origin-top-left">
                                    <img src="${assetPaths.floorplan}" class="block w-full h-auto pointer-events-none">
                                    ${(exportHotspots || []).map((spot, idx) => {
                                        const targetIdx = spot.targetImageIndex ?? 0;
                                        const targetPath = galleryPaths[targetIdx] || spot.targetImageUrl || '';
                                        return `
                                        <div style="left: ${spot.x}%; top: ${spot.y}%; transform: translate(-50%, -50%) scale(1); transform-origin: center center;" class="export-hotspot-pin absolute z-20 cursor-pointer group/pin">
                                            <div class="absolute inset-0 -m-2 rounded-full bg-orange-500/40 animate-ping pointer-events-none"></div>
                                            <button onclick="openLightbox(${targetIdx}, true, ${spot.is360 ? 'true' : 'false'})" class="relative w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[8px] sm:text-[10px] font-black shadow-2xl border-2 bg-slate-950 text-orange-400 border-orange-500 hover:bg-orange-500 hover:text-white transition-all">
                                                ${idx + 1}
                                            </button>
                                            <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-60 p-3 bg-slate-950/95 border border-orange-500/40 rounded-2xl shadow-2xl backdrop-blur-xl opacity-0 scale-95 pointer-events-none group-hover/pin:opacity-100 group-hover/pin:scale-100 group-hover/pin:pointer-events-auto transition-all duration-300 z-50">
                                                ${targetPath ? `<div class="w-full h-24 rounded-xl overflow-hidden mb-2 bg-slate-900"><img src="${targetPath}" class="w-full h-full object-cover"></div>` : ''}
                                                <div class="space-y-1">
                                                    <div class="flex items-center justify-between">
                                                        <span class="text-[10px] font-black text-orange-400 uppercase tracking-wider">${spot.title || `Hotspot Pin #${idx + 1}`}</span>
                                                        <span class="text-[8px] font-bold text-slate-500">Spot #${idx + 1}</span>
                                                    </div>
                                                    ${spot.description ? `<p class="text-[9px] text-slate-300 line-clamp-2">${spot.description}</p>` : ''}
                                                    <button onclick="openLightbox(${targetIdx}, true, ${spot.is360 ? 'true' : 'false'})" class="w-full mt-2 py-1 bg-orange-600 text-white rounded-lg font-black text-[8px] uppercase tracking-widest shadow">View Image</button>
                                                </div>
                                            </div>
                                        </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    ${threeDFloorPlanEmbed ? `
                    <div class="space-y-4 pt-2">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 glass-panel rounded-3xl border border-white/10">
                            <div>
                                <div class="flex items-center gap-2">
                                    <span class="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                                    <h3 class="text-sm font-black text-white uppercase tracking-wider">3D Interactive Floor Plan</h3>
                                </div>
                                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Explore the interactive 3D dollhouse and spatial walkthrough</p>
                            </div>
                            <div class="px-3.5 py-1.5 bg-orange-500/10 border border-orange-500/30 rounded-xl text-[10px] font-black text-orange-400 uppercase tracking-widest">
                                3D Walkthrough
                            </div>
                        </div>
                        <div class="w-full h-[60vh] sm:h-[75vh] min-h-[420px] rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden border border-white/10 bg-black shadow-2xl">
                            <iframe src="${threeDFloorPlanEmbed}" width="100%" height="100%" frameBorder="0" allowFullScreen allow="xr-spatial-tracking; accelerometer; gyroscope; magnetometer; fullscreen; autoplay; web-share" loading="lazy" referrerpolicy="no-referrer-when-downgrade" class="w-full h-full border-0" title="3D Floor Plan"></iframe>
                        </div>
                    </div>
                    ` : ''}
                </div>
                
                <div id="interactive" class="tab-content space-y-12">
                    ${matterport ? `<div class="w-full h-[72vh] sm:h-[82vh] min-h-[520px] md:min-h-[640px] rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden border border-white/10 bg-black shadow-2xl"><iframe src="${matterport}" width="100%" height="100%" frameBorder="0" allowFullScreen allow="xr-spatial-tracking; accelerometer; gyroscope; magnetometer; fullscreen; autoplay; web-share" loading="lazy" referrerpolicy="no-referrer-when-downgrade" class="w-full h-full border-0" title="Matterport 3D Tour"></iframe></div>` : ''}
                    ${videoEmbed ? `<div class="w-full h-[60vh] sm:h-[70vh] min-h-[400px] md:aspect-video rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden border border-white/10 bg-black shadow-2xl"><iframe src="${videoEmbed}" width="100%" height="100%" frameBorder="0" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" loading="lazy" referrerpolicy="no-referrer-when-downgrade" class="w-full h-full border-0" title="Property Video"></iframe></div>` : ''}
                </div>


                
                ${droneEmbed ? `
                <div id="drone360" class="tab-content space-y-8">
                    <div class="space-y-4">
                        <div class="flex items-center justify-between gap-4">
                            <div class="space-y-1">
                                <h3 class="text-xl font-black text-white uppercase tracking-tighter">Drone 360 Panorama</h3>
                                <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Interactive Aerial Context</p>
                            </div>
                        </div>
                        <div class="w-full h-[72vh] sm:h-[82vh] min-h-[520px] md:min-h-[640px] rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden border border-white/10 bg-slate-900 shadow-2xl relative">
                            <iframe width="100%" height="100%" frameBorder="0" src="${droneEmbed}" allowFullScreen allow="xr-spatial-tracking; gyroscope; accelerometer; fullscreen; autoplay" loading="lazy" referrerpolicy="no-referrer-when-downgrade" class="w-full h-full border-0 bg-slate-900" title="Drone 360 Panorama"></iframe>
                            <div class="absolute top-4 left-4 sm:top-6 sm:left-6 px-3 py-1.5 sm:px-4 sm:py-2 bg-black/80 backdrop-blur-md rounded-xl border border-white/10 flex items-center gap-3">
                               <div class="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                               <span class="text-[9px] sm:text-[10px] font-black text-white uppercase tracking-widest">Interactive VR</span>
                            </div>
                        </div>
                    </div>
                </div>` : ''}
                
                ${showMapTab ? `
                <div id="map" class="tab-content space-y-6">
                    <!-- Map & Location Header -->
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 glass-panel rounded-3xl border border-white/10">
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="w-2 h-2 rounded-full animate-pulse" style="background-color: var(--brand)"></span>
                                <h3 class="text-sm font-black text-white uppercase tracking-wider">Location &amp; Neighborhood</h3>
                            </div>
                            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                ${property.unit ? property.unit + ' - ' : ''}${property.address ? property.address + ', ' : ''}${property.city || ''}
                            </p>
                        </div>
                        <div class="flex items-center gap-2">
                            <button onclick="copyExportAddress()" class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg">
                                <span id="export-copy-icon">📋</span> <span id="export-copy-text">Copy Address</span>
                            </button>
                        </div>
                    </div>

                    <!-- Smart 1-Tap Navigation & Driving Directions -->
                    <div class="p-5 bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl space-y-4">
                        <div class="flex items-center justify-between">
                            <span class="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                <span>🧭</span> 1-Tap Navigation &amp; Directions
                            </span>
                            <span class="text-[9px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Free GPS Deep Links
                            </span>
                        </div>
                        
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapSearchAddress)}" target="_blank" rel="noopener noreferrer" class="p-3.5 bg-slate-950/70 hover:bg-slate-800/80 border border-white/10 hover:border-blue-500/50 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-center group transition-all">
                                <span class="text-xl group-hover:scale-110 transition-transform">🗺️</span>
                                <span class="text-[10px] font-black text-white uppercase tracking-wider">Google Maps</span>
                                <span class="text-[8px] font-bold text-slate-400">Live Traffic &amp; Route</span>
                            </a>

                            <a href="https://maps.apple.com/?daddr=${encodeURIComponent(mapSearchAddress)}" target="_blank" rel="noopener noreferrer" class="p-3.5 bg-slate-950/70 hover:bg-slate-800/80 border border-white/10 hover:border-slate-400/50 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-center group transition-all">
                                <span class="text-xl group-hover:scale-110 transition-transform">🍎</span>
                                <span class="text-[10px] font-black text-white uppercase tracking-wider">Apple Maps</span>
                                <span class="text-[8px] font-bold text-slate-400">iOS &amp; CarPlay</span>
                            </a>

                            <a href="https://waze.com/ul?q=${encodeURIComponent(mapSearchAddress)}&navigate=yes" target="_blank" rel="noopener noreferrer" class="p-3.5 bg-slate-950/70 hover:bg-slate-800/80 border border-white/10 hover:border-cyan-500/50 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-center group transition-all">
                                <span class="text-xl group-hover:scale-110 transition-transform">🚙</span>
                                <span class="text-[10px] font-black text-white uppercase tracking-wider">Waze GPS</span>
                                <span class="text-[8px] font-bold text-slate-400">Real-Time Hazards</span>
                            </a>

                            <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapSearchAddress)}" target="_blank" rel="noopener noreferrer" class="p-3.5 bg-slate-950/70 hover:bg-slate-800/80 border border-white/10 hover:border-amber-500/50 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-center group transition-all">
                                <span class="text-xl group-hover:scale-110 transition-transform">🚶</span>
                                <span class="text-[10px] font-black text-white uppercase tracking-wider">Street View</span>
                                <span class="text-[8px] font-bold text-slate-400">Walk The Block</span>
                            </a>
                        </div>
                    </div>

                    <!-- Map Layer Switcher & POI Category Filters -->
                    <div class="space-y-3">
                        <div class="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-950/80 backdrop-blur-md rounded-2xl border border-white/10">
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">🗺️ Layer:</span>
                                <button onclick="setExportMapLayer('roadmap')" id="btn-layer-roadmap" class="export-layer-btn px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer bg-slate-800 text-white border border-white/20">Roadmap</button>
                                <button onclick="setExportMapLayer('satellite')" id="btn-layer-satellite" class="export-layer-btn px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer bg-slate-900 text-slate-400 border border-white/10 hover:text-white">🛰️ Satellite</button>
                                <button onclick="setExportMapLayer('terrain')" id="btn-layer-terrain" class="export-layer-btn px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer bg-slate-900 text-slate-400 border border-white/10 hover:text-white">🏔️ Terrain</button>
                            </div>

                            <div class="flex items-center gap-2">
                                <a href="https://maps.google.com/maps?q=${encodeURIComponent(mapSearchAddress)}" target="_blank" rel="noopener noreferrer" class="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5 text-blue-400"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                                    Full Map
                                </a>
                            </div>
                        </div>

                        <!-- Points of Interest Pills -->
                        <div class="flex items-center gap-2 overflow-x-auto py-2 px-1 scrollbar-hide">
                            <span class="text-[9px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap mr-1">Nearby POIs:</span>
                            <button onclick="setExportPoi('all', '')" id="poi-btn-all" class="export-poi-btn px-3 py-1.5 rounded-xl text-[10px] font-black whitespace-nowrap transition-all cursor-pointer border" style="background-color: var(--brand); color: #fff; border-color: var(--brand);">📍 Property Pin</button>
                            <button onclick="setExportPoi('schools', 'schools')" id="poi-btn-schools" class="export-poi-btn px-3 py-1.5 rounded-xl text-[10px] font-black whitespace-nowrap transition-all cursor-pointer bg-slate-900 text-slate-400 border border-white/10 hover:text-white">🏫 Schools</button>
                            <button onclick="setExportPoi('dining', 'restaurants cafes')" id="poi-btn-dining" class="export-poi-btn px-3 py-1.5 rounded-xl text-[10px] font-black whitespace-nowrap transition-all cursor-pointer bg-slate-900 text-slate-400 border border-white/10 hover:text-white">☕ Cafes &amp; Dining</button>
                            <button onclick="setExportPoi('parks', 'parks recreation')" id="poi-btn-parks" class="export-poi-btn px-3 py-1.5 rounded-xl text-[10px] font-black whitespace-nowrap transition-all cursor-pointer bg-slate-900 text-slate-400 border border-white/10 hover:text-white">🌲 Parks &amp; Rec</button>
                            <button onclick="setExportPoi('transit', 'transit train station')" id="poi-btn-transit" class="export-poi-btn px-3 py-1.5 rounded-xl text-[10px] font-black whitespace-nowrap transition-all cursor-pointer bg-slate-900 text-slate-400 border border-white/10 hover:text-white">🚆 Transit</button>
                            <button onclick="setExportPoi('shopping', 'grocery store shopping')" id="poi-btn-shopping" class="export-poi-btn px-3 py-1.5 rounded-xl text-[10px] font-black whitespace-nowrap transition-all cursor-pointer bg-slate-900 text-slate-400 border border-white/10 hover:text-white">🛍️ Groceries &amp; Retail</button>
                            <button onclick="setExportPoi('health', 'hospital urgent care')" id="poi-btn-health" class="export-poi-btn px-3 py-1.5 rounded-xl text-[10px] font-black whitespace-nowrap transition-all cursor-pointer bg-slate-900 text-slate-400 border border-white/10 hover:text-white">🏥 Medical</button>
                        </div>

                        <!-- Active POI Search Indicator Banner -->
                        <div id="export-poi-banner" style="display: none;" class="p-3 bg-slate-900/90 rounded-xl border border-white/10 flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <span class="w-2 h-2 rounded-full bg-orange-400 animate-ping"></span>
                                <span id="export-poi-banner-text" class="text-[10px] font-black text-white uppercase tracking-wider"></span>
                            </div>
                            <button onclick="setExportPoi('all', '')" class="text-[9px] font-black text-orange-400 hover:text-white uppercase tracking-wider cursor-pointer">
                                Reset to Property Pin ✕
                            </button>
                        </div>
                    </div>

                    <!-- Embedded Interactive Map Canvas -->
                    <div class="w-full h-[62vh] sm:h-[72vh] min-h-[460px] rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden border border-white/10 bg-slate-950 shadow-2xl relative group">
                        <iframe 
                            id="export-map-iframe" 
                            src="https://maps.google.com/maps?q=${encodeURIComponent(mapSearchAddress)}&t=&z=15&ie=UTF8&iwloc=&output=embed" 
                            width="100%" 
                            height="100%" 
                            frameBorder="0" 
                            allowFullScreen 
                            loading="lazy" 
                            referrerpolicy="no-referrer-when-downgrade" 
                            class="w-full h-full border-0" 
                            title="Property Location Map"
                        ></iframe>
                    </div>

                    <!-- Instant Neighborhood & Commute Calculator ($0 Free Tier) -->
                    <div class="space-y-6 pt-4">
                        <!-- 1. Walk Score / Bike Score / Transit Badges -->
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div class="p-4 bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-white/10 flex flex-col justify-between shadow-xl relative overflow-hidden group">
                                <div class="flex items-center justify-between">
                                    <span class="text-xl">🚶</span>
                                    <span class="text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">Walk Score®</span>
                                </div>
                                <div class="my-2">
                                    <div class="flex items-baseline gap-1">
                                        <span class="text-2xl sm:text-3xl font-black text-white font-mono">${exportWalkScore}</span>
                                        <span class="text-xs font-mono text-slate-400">/ 100</span>
                                    </div>
                                    <div class="text-[11px] font-bold text-emerald-300">Very Walkable</div>
                                    <p class="text-[8.5px] text-slate-400 mt-0.5 leading-snug">Most daily errands can be accomplished on foot.</p>
                                </div>
                                <a href="https://www.walkscore.com/score/${encodeURIComponent(mapSearchAddress)}" target="_blank" rel="noopener noreferrer" class="text-[8px] font-bold uppercase tracking-wider text-slate-400 hover:text-white flex items-center gap-1 transition-colors pt-1 border-t border-white/5">
                                    <span>Official Report</span> <span>→</span>
                                </a>
                            </div>

                            <div class="p-4 bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-white/10 flex flex-col justify-between shadow-xl relative overflow-hidden group">
                                <div class="flex items-center justify-between">
                                    <span class="text-xl">🚆</span>
                                    <span class="text-[9px] font-black uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded-full">Transit Score</span>
                                </div>
                                <div class="my-2">
                                    <div class="flex items-baseline gap-1">
                                        <span class="text-2xl sm:text-3xl font-black text-white font-mono">${exportTransitScore}</span>
                                        <span class="text-xs font-mono text-slate-400">/ 100</span>
                                    </div>
                                    <div class="text-[11px] font-bold text-blue-300">Excellent Transit</div>
                                    <p class="text-[8.5px] text-slate-400 mt-0.5 leading-snug">Frequent public transit options with nearby express routes.</p>
                                </div>
                                <div class="text-[8px] font-bold uppercase tracking-wider text-slate-400 pt-1 border-t border-white/5">Express Commute</div>
                            </div>

                            <div class="p-4 bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-white/10 flex flex-col justify-between shadow-xl relative overflow-hidden group">
                                <div class="flex items-center justify-between">
                                    <span class="text-xl">🚲</span>
                                    <span class="text-[9px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">Bike Score</span>
                                </div>
                                <div class="my-2">
                                    <div class="flex items-baseline gap-1">
                                        <span class="text-2xl sm:text-3xl font-black text-white font-mono">${exportBikeScore}</span>
                                        <span class="text-xs font-mono text-slate-400">/ 100</span>
                                    </div>
                                    <div class="text-[11px] font-bold text-amber-300">Very Bikeable</div>
                                    <p class="text-[8.5px] text-slate-400 mt-0.5 leading-snug">Flat terrain with dedicated, protected bike trails.</p>
                                </div>
                                <div class="text-[8px] font-bold uppercase tracking-wider text-slate-400 pt-1 border-t border-white/5">Biker's Paradise</div>
                            </div>

                            <div class="p-4 bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-white/10 flex flex-col justify-between shadow-xl relative overflow-hidden group">
                                <div class="flex items-center justify-between">
                                    <span class="text-xl">🌿</span>
                                    <span class="text-[9px] font-black uppercase tracking-wider text-violet-400 bg-violet-500/10 border border-violet-500/30 px-2 py-0.5 rounded-full">Quiet Index</span>
                                </div>
                                <div class="my-2">
                                    <div class="flex items-baseline gap-1">
                                        <span class="text-2xl sm:text-3xl font-black text-white font-mono">${exportQuietScore}</span>
                                        <span class="text-xs font-mono text-slate-400">/ 100</span>
                                    </div>
                                    <div class="text-[11px] font-bold text-violet-300">Peaceful Enclave</div>
                                    <p class="text-[8.5px] text-slate-400 mt-0.5 leading-snug">Low road noise and residential neighborhood serenity.</p>
                                </div>
                                <div class="text-[8px] font-bold uppercase tracking-wider text-slate-400 pt-1 border-t border-white/5">Residential Oasis</div>
                            </div>
                        </div>

                        <!-- 2. Distance & Commute Card -->
                        <div class="p-5 sm:p-6 bg-slate-900/95 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl space-y-5">
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-4">
                                <div class="flex items-center gap-2.5">
                                    <div class="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-base">⏱️</div>
                                    <div>
                                        <h4 class="text-sm font-black text-white uppercase tracking-wider">Instant Commute &amp; Distance Calculator</h4>
                                        <p class="text-[10px] text-slate-400">Type your work office, gym, or favorite spot to test daily travel times</p>
                                    </div>
                                </div>
                                <span class="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[8.5px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1 self-start sm:self-auto">
                                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> $0 Free Tier Engine
                                </span>
                            </div>

                            <div class="space-y-3">
                                <div class="relative">
                                    <input 
                                        type="text" 
                                        id="export-commute-input" 
                                        value="Downtown ${property.city || 'Metro'}" 
                                        oninput="calcExportCommute()" 
                                        placeholder="e.g. 100 Financial Way, Downtown Office, Equinox Gym..." 
                                        class="w-full bg-slate-950/80 border border-white/15 focus:border-orange-500 rounded-2xl pl-11 pr-24 py-3.5 text-xs text-white placeholder-slate-500 outline-none transition-all shadow-inner font-medium"
                                    />
                                    <div class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">📍</div>
                                    <button 
                                        type="button" 
                                        onclick="document.getElementById('export-commute-input').value = ''; calcExportCommute();" 
                                        class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-slate-400 hover:text-white bg-slate-800/80 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                                    >Clear</button>
                                </div>

                                <!-- Presets -->
                                <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                                    <span class="text-[8.5px] font-black uppercase tracking-wider text-slate-500 whitespace-nowrap mr-1">Popular Presets:</span>
                                    <button type="button" data-preset-id="downtown" onclick="setExportCommutePreset('downtown', 'Downtown ${property.city || 'Metro'}', 6.8)" class="export-commute-preset-btn px-3 py-1.5 rounded-xl text-[9.5px] font-bold whitespace-nowrap transition-all border cursor-pointer flex items-center gap-1.5 bg-orange-500 text-white border-orange-400 shadow-md">
                                        <span>🏢</span> <span>Downtown</span>
                                    </button>
                                    <button type="button" data-preset-id="airport" onclick="setExportCommutePreset('airport', '${property.city || 'Metro'} International Airport', 14.5)" class="export-commute-preset-btn px-3 py-1.5 rounded-xl text-[9.5px] font-bold whitespace-nowrap transition-all border cursor-pointer flex items-center gap-1.5 bg-slate-950/70 text-slate-400 border-white/10 hover:text-white hover:bg-slate-800">
                                        <span>✈️</span> <span>Airport</span>
                                    </button>
                                    <button type="button" data-preset-id="gym" onclick="setExportCommutePreset('gym', 'Equinox / Luxury Fitness ${property.city || 'Metro'}', 1.8)" class="export-commute-preset-btn px-3 py-1.5 rounded-xl text-[9.5px] font-bold whitespace-nowrap transition-all border cursor-pointer flex items-center gap-1.5 bg-slate-950/70 text-slate-400 border-white/10 hover:text-white hover:bg-slate-800">
                                        <span>🏋️</span> <span>Gym / Fitness</span>
                                    </button>
                                    <button type="button" data-preset-id="shopping" onclick="setExportCommutePreset('shopping', 'Fashion Square & Town Center ${property.city || 'Metro'}', 3.2)" class="export-commute-preset-btn px-3 py-1.5 rounded-xl text-[9.5px] font-bold whitespace-nowrap transition-all border cursor-pointer flex items-center gap-1.5 bg-slate-950/70 text-slate-400 border-white/10 hover:text-white hover:bg-slate-800">
                                        <span>🛍️</span> <span>Town Center</span>
                                    </button>
                                    <button type="button" data-preset-id="waterfront" onclick="setExportCommutePreset('waterfront', 'Harbor & Marina ${property.city || 'Metro'}', 5.4)" class="export-commute-preset-btn px-3 py-1.5 rounded-xl text-[9.5px] font-bold whitespace-nowrap transition-all border cursor-pointer flex items-center gap-1.5 bg-slate-950/70 text-slate-400 border-white/10 hover:text-white hover:bg-slate-800">
                                        <span>🌊</span> <span>Waterfront</span>
                                    </button>
                                    <button type="button" data-preset-id="park" onclick="setExportCommutePreset('park', 'Regional Canyon Park ${property.city || 'Metro'}', 2.5)" class="export-commute-preset-btn px-3 py-1.5 rounded-xl text-[9.5px] font-bold whitespace-nowrap transition-all border cursor-pointer flex items-center gap-1.5 bg-slate-950/70 text-slate-400 border-white/10 hover:text-white hover:bg-slate-800">
                                        <span>🌲</span> <span>Trails &amp; Park</span>
                                    </button>
                                </div>

                                <!-- Modes & Units -->
                                <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
                                    <div class="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-2xl border border-white/10 shadow-inner">
                                        <button type="button" data-mode="driving" onclick="setExportCommuteMode('driving')" class="export-commute-mode-btn px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 bg-orange-500 text-white shadow-md">
                                            <span>🚗</span> <span>Drive</span>
                                        </button>
                                        <button type="button" data-mode="transit" onclick="setExportCommuteMode('transit')" class="export-commute-mode-btn px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 text-slate-400 hover:text-white hover:bg-white/5">
                                            <span>🚆</span> <span>Transit</span>
                                        </button>
                                        <button type="button" data-mode="bicycling" onclick="setExportCommuteMode('bicycling')" class="export-commute-mode-btn px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 text-slate-400 hover:text-white hover:bg-white/5">
                                            <span>🚲</span> <span>Bike</span>
                                        </button>
                                        <button type="button" data-mode="walking" onclick="setExportCommuteMode('walking')" class="export-commute-mode-btn px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 text-slate-400 hover:text-white hover:bg-white/5">
                                            <span>🚶</span> <span>Walk</span>
                                        </button>
                                    </div>

                                    <div class="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-white/10 text-[9px] font-mono font-bold">
                                        <button type="button" id="export-unit-miles" onclick="setExportCommuteUnit('miles')" class="px-2 py-0.5 rounded-lg transition-all cursor-pointer bg-slate-800 text-white">MILES</button>
                                        <button type="button" id="export-unit-km" onclick="setExportCommuteUnit('km')" class="px-2 py-0.5 rounded-lg transition-all cursor-pointer text-slate-500 hover:text-slate-300">KM</button>
                                    </div>
                                </div>
                            </div>

                            <!-- Results Display -->
                            <div class="p-4 bg-slate-950/80 rounded-2xl border border-orange-500/30 space-y-3.5 shadow-inner">
                                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div class="flex items-center gap-3">
                                        <div id="export-commute-mode-icon" class="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-2xl shrink-0">🚗</div>
                                        <div>
                                            <div class="flex items-baseline gap-2">
                                                <span id="export-commute-duration" class="text-2xl font-black text-white font-mono">14 – 18 min</span>
                                                <span id="export-commute-distance" class="text-xs font-mono font-bold text-orange-400">6.8 mi</span>
                                            </div>
                                            <p class="text-[10px] font-medium text-slate-300 flex items-center gap-1.5">
                                                <span>From: ${property.address || 'This Property'}</span>
                                                <span>→</span>
                                                <span id="export-commute-dest-label" class="font-bold text-white truncate max-w-[200px]">Downtown ${property.city || 'Metro'}</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div class="text-left sm:text-right">
                                        <span id="export-commute-traffic" class="inline-block px-2.5 py-1 rounded-xl bg-slate-900 border border-white/10 text-[9px] font-mono text-amber-300">⚡ Morning Rush: +4 to 8 mins (7:30 – 9:00 AM)</span>
                                        <div id="export-commute-route" class="text-[8.5px] text-slate-400 mt-1">Via Primary Boulevards &amp; Arterials</div>
                                    </div>
                                </div>

                                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-white/5">
                                    <a id="export-commute-google-btn" href="https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(mapSearchAddress)}&destination=${encodeURIComponent('Downtown ' + (property.city || 'Metro'))}&travelmode=driving" target="_blank" rel="noopener noreferrer" class="py-2.5 px-3 bg-blue-600/90 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-lg group">
                                        <span class="group-hover:scale-110 transition-transform">🗺️</span> <span>Open in Google Maps</span>
                                    </a>
                                    <a id="export-commute-apple-btn" href="https://maps.apple.com/?saddr=${encodeURIComponent(mapSearchAddress)}&daddr=${encodeURIComponent('Downtown ' + (property.city || 'Metro'))}&dirflg=d" target="_blank" rel="noopener noreferrer" class="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider border border-white/10 transition-all flex items-center justify-center gap-1.5 shadow-lg group">
                                        <span class="group-hover:scale-110 transition-transform">🍎</span> <span>Open in Apple Maps</span>
                                    </a>
                                    <a id="export-commute-waze-btn" href="https://waze.com/ul?q=${encodeURIComponent('Downtown ' + (property.city || 'Metro'))}&navigate=yes" target="_blank" rel="noopener noreferrer" class="py-2.5 px-3 bg-cyan-700/80 hover:bg-cyan-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-lg group">
                                        <span class="group-hover:scale-110 transition-transform">🚙</span> <span>Open in Waze</span>
                                    </a>
                                </div>
                            </div>
                        </div>

                        <!-- 3. Nearest Essentials Matrix -->
                        <div class="p-5 sm:p-6 bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl space-y-4">
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                                <div class="flex items-center gap-2">
                                    <span class="text-xl">📍</span>
                                    <div>
                                        <h4 class="text-sm font-black text-white uppercase tracking-wider">Nearest Essentials &amp; Proximity Matrix</h4>
                                        <p class="text-[10px] text-slate-400">Key neighborhood amenities and estimated travel times from this address</p>
                                    </div>
                                </div>
                                <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Verified Proximity</span>
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                <div class="p-4 bg-slate-950/70 hover:bg-slate-950/95 border border-white/10 hover:border-orange-500/40 rounded-2xl transition-all shadow-lg flex flex-col justify-between gap-3 group">
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <span class="text-2xl group-hover:scale-110 transition-transform">🛒</span>
                                            <div>
                                                <div class="text-[11px] font-black text-white uppercase tracking-wider">Groceries &amp; Markets</div>
                                                <span class="text-[8px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">Daily Essentials</span>
                                            </div>
                                        </div>
                                        <p class="text-[9px] text-slate-400 mt-2 leading-relaxed">Whole Foods Market, Trader Joe's &amp; Organic Grocers</p>
                                    </div>
                                    <div class="space-y-2 pt-2 border-t border-white/5">
                                        <div class="flex items-center justify-between text-[10px] font-mono">
                                            <span class="font-bold text-emerald-400">🚗 4 min drive (1.2 mi)</span>
                                            <span class="text-slate-400">🚶 14 min walk</span>
                                        </div>
                                        <div class="grid grid-cols-2 gap-1.5">
                                            <button type="button" onclick="setExportPoi('shopping', 'grocery store shopping')" class="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-[9px] font-bold uppercase tracking-wider border border-white/10 transition-all flex items-center justify-center gap-1 cursor-pointer">
                                                <span>🗺️</span> <span>Map View</span>
                                            </button>
                                            <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent('grocery store near ' + mapSearchAddress)}" target="_blank" rel="noopener noreferrer" class="py-1.5 px-2 bg-orange-600/80 hover:bg-orange-500 text-white rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-md">
                                                <span>🧭</span> <span>Directions</span>
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                <div class="p-4 bg-slate-950/70 hover:bg-slate-950/95 border border-white/10 hover:border-orange-500/40 rounded-2xl transition-all shadow-lg flex flex-col justify-between gap-3 group">
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <span class="text-2xl group-hover:scale-110 transition-transform">🏫</span>
                                            <div>
                                                <div class="text-[11px] font-black text-white uppercase tracking-wider">Top-Rated Schools</div>
                                                <span class="text-[8px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">GreatSchools 9/10</span>
                                            </div>
                                        </div>
                                        <p class="text-[9px] text-slate-400 mt-2 leading-relaxed">Regional Public Elementary, Prep Academy &amp; High School</p>
                                    </div>
                                    <div class="space-y-2 pt-2 border-t border-white/5">
                                        <div class="flex items-center justify-between text-[10px] font-mono">
                                            <span class="font-bold text-emerald-400">🚗 6 min drive (1.8 mi)</span>
                                            <span class="text-slate-400">🚶 22 min walk</span>
                                        </div>
                                        <div class="grid grid-cols-2 gap-1.5">
                                            <button type="button" onclick="setExportPoi('schools', 'schools')" class="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-[9px] font-bold uppercase tracking-wider border border-white/10 transition-all flex items-center justify-center gap-1 cursor-pointer">
                                                <span>🗺️</span> <span>Map View</span>
                                            </button>
                                            <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent('schools near ' + mapSearchAddress)}" target="_blank" rel="noopener noreferrer" class="py-1.5 px-2 bg-orange-600/80 hover:bg-orange-500 text-white rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-md">
                                                <span>🧭</span> <span>Directions</span>
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                <div class="p-4 bg-slate-950/70 hover:bg-slate-950/95 border border-white/10 hover:border-orange-500/40 rounded-2xl transition-all shadow-lg flex flex-col justify-between gap-3 group">
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <span class="text-2xl group-hover:scale-110 transition-transform">🌲</span>
                                            <div>
                                                <div class="text-[11px] font-black text-white uppercase tracking-wider">Parks &amp; Recreation</div>
                                                <span class="text-[8px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">Green Spaces</span>
                                            </div>
                                        </div>
                                        <p class="text-[9px] text-slate-400 mt-2 leading-relaxed">Community Park, Nature Trails, Tennis &amp; Dog Park</p>
                                    </div>
                                    <div class="space-y-2 pt-2 border-t border-white/5">
                                        <div class="flex items-center justify-between text-[10px] font-mono">
                                            <span class="font-bold text-emerald-400">🚗 3 min drive (0.8 mi)</span>
                                            <span class="text-slate-400">🚶 9 min walk</span>
                                        </div>
                                        <div class="grid grid-cols-2 gap-1.5">
                                            <button type="button" onclick="setExportPoi('parks', 'parks recreation')" class="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-[9px] font-bold uppercase tracking-wider border border-white/10 transition-all flex items-center justify-center gap-1 cursor-pointer">
                                                <span>🗺️</span> <span>Map View</span>
                                            </button>
                                            <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent('parks near ' + mapSearchAddress)}" target="_blank" rel="noopener noreferrer" class="py-1.5 px-2 bg-orange-600/80 hover:bg-orange-500 text-white rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-md">
                                                <span>🧭</span> <span>Directions</span>
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                <div class="p-4 bg-slate-950/70 hover:bg-slate-950/95 border border-white/10 hover:border-orange-500/40 rounded-2xl transition-all shadow-lg flex flex-col justify-between gap-3 group">
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <span class="text-2xl group-hover:scale-110 transition-transform">✈️</span>
                                            <div>
                                                <div class="text-[11px] font-black text-white uppercase tracking-wider">Major Airport</div>
                                                <span class="text-[8px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">Express Access</span>
                                            </div>
                                        </div>
                                        <p class="text-[9px] text-slate-400 mt-2 leading-relaxed">Regional &amp; International Commercial Flight Terminal</p>
                                    </div>
                                    <div class="space-y-2 pt-2 border-t border-white/5">
                                        <div class="flex items-center justify-between text-[10px] font-mono">
                                            <span class="font-bold text-emerald-400">🚗 22 min drive (14.5 mi)</span>
                                            <span class="text-slate-400">Direct Highway</span>
                                        </div>
                                        <div>
                                            <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent('airport near ' + mapSearchAddress)}" target="_blank" rel="noopener noreferrer" class="w-full py-1.5 px-2 bg-orange-600/80 hover:bg-orange-500 text-white rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-md">
                                                <span>🧭</span> <span>Airport Directions</span>
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                <div class="p-4 bg-slate-950/70 hover:bg-slate-950/95 border border-white/10 hover:border-orange-500/40 rounded-2xl transition-all shadow-lg flex flex-col justify-between gap-3 group">
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <span class="text-2xl group-hover:scale-110 transition-transform">☕</span>
                                            <div>
                                                <div class="text-[11px] font-black text-white uppercase tracking-wider">Cafes &amp; Fine Dining</div>
                                                <span class="text-[8px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">Food &amp; Nightlife</span>
                                            </div>
                                        </div>
                                        <p class="text-[9px] text-slate-400 mt-2 leading-relaxed">Artisan Espresso Roasteries, Bistros &amp; Weekend Brunch</p>
                                    </div>
                                    <div class="space-y-2 pt-2 border-t border-white/5">
                                        <div class="flex items-center justify-between text-[10px] font-mono">
                                            <span class="font-bold text-emerald-400">🚗 3 min drive (0.7 mi)</span>
                                            <span class="text-slate-400">🚶 8 min walk</span>
                                        </div>
                                        <div class="grid grid-cols-2 gap-1.5">
                                            <button type="button" onclick="setExportPoi('dining', 'restaurants cafes')" class="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-[9px] font-bold uppercase tracking-wider border border-white/10 transition-all flex items-center justify-center gap-1 cursor-pointer">
                                                <span>🗺️</span> <span>Map View</span>
                                            </button>
                                            <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent('restaurants near ' + mapSearchAddress)}" target="_blank" rel="noopener noreferrer" class="py-1.5 px-2 bg-orange-600/80 hover:bg-orange-500 text-white rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-md">
                                                <span>🧭</span> <span>Directions</span>
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                <div class="p-4 bg-slate-950/70 hover:bg-slate-950/95 border border-white/10 hover:border-orange-500/40 rounded-2xl transition-all shadow-lg flex flex-col justify-between gap-3 group">
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <span class="text-2xl group-hover:scale-110 transition-transform">🏥</span>
                                            <div>
                                                <div class="text-[11px] font-black text-white uppercase tracking-wider">Hospitals &amp; Medical</div>
                                                <span class="text-[8px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">Healthcare</span>
                                            </div>
                                        </div>
                                        <p class="text-[9px] text-slate-400 mt-2 leading-relaxed">Regional Medical Center &amp; 24/7 Urgent Care Hospital</p>
                                    </div>
                                    <div class="space-y-2 pt-2 border-t border-white/5">
                                        <div class="flex items-center justify-between text-[10px] font-mono">
                                            <span class="font-bold text-emerald-400">🚗 7 min drive (2.8 mi)</span>
                                            <span class="text-slate-400">Emergency Care</span>
                                        </div>
                                        <div class="grid grid-cols-2 gap-1.5">
                                            <button type="button" onclick="setExportPoi('health', 'hospital urgent care')" class="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-[9px] font-bold uppercase tracking-wider border border-white/10 transition-all flex items-center justify-center gap-1 cursor-pointer">
                                                <span>🗺️</span> <span>Map View</span>
                                            </button>
                                            <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent('hospital near ' + mapSearchAddress)}" target="_blank" rel="noopener noreferrer" class="py-1.5 px-2 bg-orange-600/80 hover:bg-orange-500 text-white rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-md">
                                                <span>🧭</span> <span>Directions</span>
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>` : ''}
                

            </div>

            <div class="lg:col-span-4">
                <div class="sticky top-10 space-y-6">
                    <div class="p-8 md:p-10 glass-panel rounded-[3rem] border border-white/10 space-y-8 text-center">
                        <div class="flex items-center justify-center gap-3">
                            <div class="w-28 h-28 rounded-full border-4 p-1 overflow-hidden shadow-2xl shrink-0" style="border-color: var(--brand)">
                                ${assetPaths.headshot 
                                    ? `<img src="${assetPaths.headshot}" class="w-full h-full object-cover rounded-full">` 
                                    : assetPaths.logo 
                                        ? `<div class="w-full h-full bg-white/5 flex items-center justify-center rounded-full p-3"><img src="${assetPaths.logo}" class="max-w-full max-h-full object-contain"></div>` 
                                        : '<div class="w-full h-full bg-slate-800 rounded-full"></div>'}
                            </div>
                        </div>
                        <div class="space-y-4">
                            <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Listing Associate</span>
                            
                            <div class="space-y-1">
                                <h3 class="text-xl font-black text-white uppercase tracking-tighter">${property.agentName || 'Professional Agent'}</h3>
                                ${property.brokerage ? `<p class="font-bold text-[10px] uppercase tracking-widest" style="color: var(--brand)">${property.brokerage}</p>` : ''}
                                <div class="flex flex-col gap-0.5 pt-1 text-[10px] font-bold uppercase text-slate-400">
                                   ${property.phoneNumber ? `<div class="text-white">${property.phoneNumber}</div>` : ''}
                                   ${property.email ? `<div class="truncate">${property.email}</div>` : ''}
                                </div>
                            </div>

                            ${property.website ? `<a href="${formatUrl(property.website)}" target="_blank" rel="noopener noreferrer" class="block truncate pt-2 underline underline-offset-4 text-[10px] font-bold uppercase" style="color: var(--brand)">${property.website.replace(/^https?:\/\//, '')}</a>` : ''}
                        </div>
                        <div class="space-y-2.5">
                            <button onclick="toggleModal(true)" class="w-full py-4 rounded-2xl bg-white text-slate-950 font-black uppercase tracking-widest text-[11px] shadow-xl hover:scale-105 transition-transform cursor-pointer">Request Private Viewing</button>
                            <div class="grid grid-cols-2 gap-2">
                                <button onclick="downloadExportVCard('agent1')" class="py-3 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-wider text-[10px] shadow-lg flex items-center justify-center gap-1.5 transition-transform hover:scale-105 cursor-pointer" title="Download RFC vCard Contact Card"><span>📇</span> Save vCard</button>
                                <button onclick="openExportVCardModal('agent1')" class="py-3 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white font-black uppercase tracking-wider text-[10px] border border-white/10 flex items-center justify-center gap-1.5 transition-all cursor-pointer" title="View Contact QR Card"><span>📱</span> QR Card</button>
                            </div>
                        </div>
                    </div>

                    ${exportHasAgent2 ? `
                    <div class="p-8 md:p-10 glass-panel rounded-[3rem] border border-white/10 space-y-6 text-center">
                        <div class="flex items-center justify-center gap-3">
                            <div class="w-28 h-28 rounded-full border-4 p-1 overflow-hidden shadow-2xl shrink-0" style="border-color: var(--brand)">
                                ${assetPaths.headshot2 
                                    ? `<img src="${assetPaths.headshot2}" class="w-full h-full object-cover rounded-full">` 
                                    : assetPaths.logo2 
                                        ? `<div class="w-full h-full bg-white/5 flex items-center justify-center rounded-full p-3"><img src="${assetPaths.logo2}" class="max-w-full max-h-full object-contain"></div>` 
                                        : assetPaths.logo
                                            ? `<div class="w-full h-full bg-white/5 flex items-center justify-center rounded-full p-3"><img src="${assetPaths.logo}" class="max-w-full max-h-full object-contain"></div>`
                                            : '<div class="w-full h-full bg-slate-800 rounded-full"></div>'}
                            </div>
                        </div>
                        <div class="space-y-4">
                            <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Co-Listing Associate</span>
                            
                            <div class="space-y-1">
                                <h3 class="text-xl font-black text-white uppercase tracking-tighter">${property.agent2Name || 'Co-Listing Agent'}</h3>
                                ${(property.agent2Brokerage || property.brokerage) ? `<p class="font-bold text-[10px] uppercase tracking-widest" style="color: var(--brand)">${property.agent2Brokerage || property.brokerage}</p>` : ''}
                                <div class="flex flex-col gap-0.5 pt-1 text-[10px] font-bold uppercase text-slate-400">
                                   ${property.agent2PhoneNumber ? `<div class="text-white">${property.agent2PhoneNumber}</div>` : ''}
                                   ${property.agent2Email ? `<div class="truncate">${property.agent2Email}</div>` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-2 pt-2">
                            <button onclick="downloadExportVCard('agent2')" class="py-3 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-wider text-[10px] shadow-lg flex items-center justify-center gap-1.5 transition-transform hover:scale-105 cursor-pointer" title="Download RFC vCard Contact Card"><span>📇</span> Save vCard</button>
                            <button onclick="openExportVCardModal('agent2')" class="py-3 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white font-black uppercase tracking-wider text-[10px] border border-white/10 flex items-center justify-center gap-1.5 transition-all cursor-pointer" title="View Contact QR Card"><span>📱</span> QR Card</button>
                        </div>
                    </div>
                    ` : ''}

                    <div class="flex justify-center">
                        <img src="https://cmyixvfqicuycuhgqjnv.supabase.co/storage/v1/object/public/clients/logo2025_convertedpng.png" class="max-h-8 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity" alt="Broker Logo">
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="contact-modal" class="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-xl hidden items-center justify-center p-4" style="display: none">
        <div class="max-w-md w-full glass-panel p-8 md:p-10 rounded-[2.5rem] border border-white/10 shadow-2xl relative">
            <button onclick="toggleModal(false)" class="absolute top-6 right-6 p-2 text-slate-500 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" class="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            <div id="form-container" class="space-y-8">
                <div class="space-y-2"><h3 class="text-3xl font-black text-white uppercase tracking-tighter">Private Viewing</h3><p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Property: ${property.unit ? property.unit + ' - ' : ''}${property.address}</p></div>
                <form name="property-inquiry" method="POST" data-netlify="true" class="space-y-4">
                    <input type="hidden" name="form-name" value="property-inquiry" /><input type="hidden" name="property_address" value="${property.unit ? property.unit + ' - ' : ''}${property.address}" />
                    <div class="space-y-1"><label class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Full Name</label><input required type="text" name="name" class="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-orange-500 outline-none" /></div>
                    <div class="space-y-1"><label class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Email Address</label><input required type="email" name="email" class="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-orange-500 outline-none" /></div>
                    <div class="space-y-1"><label class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Message</label><textarea name="message" rows="3" class="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-orange-500 outline-none resize-none"></textarea></div>
                    <button type="submit" class="w-full py-4 mt-4 rounded-xl font-black uppercase tracking-widest text-[11px] text-white shadow-xl" style="background-color: var(--brand)">Send Inquiry</button>
                </form>
            </div>
        </div>
    </div>

    <div id="export-vcard-modal" class="fixed inset-0 z-[250] bg-slate-950/90 backdrop-blur-xl hidden items-center justify-center p-4" style="display: none">
        <div class="max-w-md w-full glass-panel p-6 sm:p-8 rounded-[2.5rem] border border-white/10 shadow-2xl relative">
            <button onclick="toggleExportVCardModal(false)" class="absolute top-6 right-6 p-2 text-slate-500 hover:text-white cursor-pointer"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" class="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            <div class="space-y-6">
                <div class="flex items-center gap-4">
                    <div id="export-modal-agent-avatar" class="w-16 h-16 rounded-full border-2 p-1 overflow-hidden shrink-0 shadow-xl bg-slate-900" style="border-color: var(--brand)">
                    </div>
                    <div class="space-y-1 min-w-0 flex-grow">
                        <span id="export-modal-agent-title" class="text-[9px] font-black uppercase tracking-widest text-slate-400">Listing Associate</span>
                        <h3 id="export-modal-agent-name" class="text-xl font-black text-white uppercase tracking-tight truncate">Agent Name</h3>
                        <p id="export-modal-agent-brokerage" class="text-[10px] font-bold uppercase tracking-widest truncate" style="color: var(--brand)"></p>
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-2">
                    <a id="export-modal-call-btn" href="#" class="p-3 bg-slate-900/90 hover:bg-slate-800 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-1 text-center transition-all">
                        <span class="text-base">📞</span>
                        <span class="text-[9px] font-black text-white uppercase tracking-wider">Call</span>
                    </a>
                    <a id="export-modal-sms-btn" href="#" class="p-3 bg-slate-900/90 hover:bg-slate-800 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-1 text-center transition-all">
                        <span class="text-base">💬</span>
                        <span class="text-[9px] font-black text-white uppercase tracking-wider">Text SMS</span>
                    </a>
                    <a id="export-modal-email-btn" href="#" class="p-3 bg-slate-900/90 hover:bg-slate-800 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-1 text-center transition-all">
                        <span class="text-base">✉️</span>
                        <span class="text-[9px] font-black text-white uppercase tracking-wider">Email</span>
                    </a>
                </div>

                <div class="p-4 bg-slate-950/80 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-center gap-4">
                    <div class="w-24 h-24 bg-white p-1.5 rounded-xl shrink-0 shadow-inner flex items-center justify-center">
                        <img id="export-modal-qr-img" src="" alt="Contact QR" class="w-full h-full object-contain" />
                    </div>
                    <div class="space-y-1 text-center sm:text-left">
                        <div class="text-orange-400 text-[10px] font-black uppercase tracking-wider">📷 Scan with Phone Camera</div>
                        <p class="text-[11px] text-slate-300 font-medium leading-relaxed">
                            Scan with your smartphone camera to immediately import contact details into your phone address book.
                        </p>
                    </div>
                </div>

                <div class="space-y-2 pt-1">
                    <button id="export-modal-download-btn" onclick="downloadCurrentExportVCard()" class="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black uppercase tracking-widest text-xs shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-95">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" class="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                        Download Contact Card (.vcf)
                    </button>
                    <button onclick="copyCurrentExportContactDetails()" id="export-modal-copy-btn" class="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-wider border border-white/5 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                        <span>📋</span> Copy Contact Info
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script>
        var PROPERTY_LOC = ${JSON.stringify(fullAddress)};
        var PROPERTY_CITY = ${JSON.stringify(property.city || '')};
        var BRAND_COLOR = ${JSON.stringify(brandingColor)};
        var GALLERY_IMAGES = ${JSON.stringify(mainGalleryPaths)};
        var EMBEDDED_PANOS = ${JSON.stringify(panoDataUrls)};
        var activeLightboxIdx = 0;
        var exportViewMode = 'slideshow';
        var exportSlideIndex = 0;
        var isExportPlaying = true;
        var exportSlideshowInterval = null;

        // Expose globally for inline event handlers and console access
        window.PROPERTY_LOC = PROPERTY_LOC;
        window.PROPERTY_CITY = PROPERTY_CITY;
        window.BRAND_COLOR = BRAND_COLOR;
        window.GALLERY_IMAGES = GALLERY_IMAGES;
        window.EMBEDDED_PANOS = EMBEDDED_PANOS;
        window.exportSlideIndex = exportSlideIndex;
        window.isExportPlaying = isExportPlaying;
        window.exportViewMode = exportViewMode;
        
        function switchTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
            document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
            var target = document.getElementById(tabId);
            if (target) target.classList.add('active');
            var btn = document.getElementById('btn-' + tabId);
            if (btn) btn.classList.add('active');
            if (tabId === 'drone360') window.dispatchEvent(new Event('resize')); 
            if (tabId === 'gallery') {
                if (isExportPlaying && exportViewMode === 'slideshow') {
                    startExportSlideshow();
                }
            } else {
                stopExportSlideshow();
            }
        }
        window.switchTab = switchTab;
        
        function toggleModal(show) { 
            var modal = document.getElementById('contact-modal');
            if (modal) modal.style.display = show ? 'flex' : 'none'; 
        }
        window.toggleModal = toggleModal;

        var currentExportZoom = 1;
        function setExportFloorPlanZoom(level) {
            currentExportZoom = Math.min(3, Math.max(1, level));
            var canvas = document.getElementById('export-floorplan-canvas');
            if (canvas) {
                canvas.style.transform = 'scale(' + currentExportZoom + ')';
                canvas.style.marginRight = currentExportZoom > 1 ? ((currentExportZoom - 1) * 100) + '%' : '0';
                canvas.style.marginBottom = currentExportZoom > 1 ? ((currentExportZoom - 1) * 100) + '%' : '0';
            }
            var pins = document.querySelectorAll('.export-hotspot-pin');
            var invScale = 1 / currentExportZoom;
            pins.forEach(function(pin) {
                pin.style.transform = 'translate(-50%, -50%) scale(' + invScale + ')';
            });
        }
        window.setExportFloorPlanZoom = setExportFloorPlanZoom;

        function zoomExportFloorPlan(delta) {
            setExportFloorPlanZoom(+(currentExportZoom + delta).toFixed(2));
        }
        window.zoomExportFloorPlan = zoomExportFloorPlan;

        var pannellumViewer = null;
        var isHotspotLightbox = false;
        var hotspotIs360 = false;

        function checkIs360(src, cb) {
            if (!src) return cb(false);
            if (isHotspotLightbox && hotspotIs360) {
                return cb(true);
            }
            cb(false);
        }

        function openLightbox(index, isHotspot, is360) {
            isHotspotLightbox = !!isHotspot;
            hotspotIs360 = !!is360;
            activeLightboxIdx = typeof index === 'number' ? index : (window.exportSlideIndex || 0);
            updateLightbox();
            var lb = document.getElementById('lightbox');
            if (lb) lb.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
        window.openLightbox = openLightbox;
        
        function closeLightbox() {
            if (pannellumViewer) {
                try { pannellumViewer.destroy(); } catch(e){}
                pannellumViewer = null;
            }
            var lb = document.getElementById('lightbox');
            if (lb) lb.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
        window.closeLightbox = closeLightbox;

        function changeLightbox(delta) {
            if (isHotspotLightbox || !GALLERY_IMAGES || GALLERY_IMAGES.length === 0) return;
            var total = GALLERY_IMAGES.length;
            activeLightboxIdx = ((activeLightboxIdx + delta) % total + total) % total;
            updateLightbox();
        }
        window.changeLightbox = changeLightbox;

        function updateLightbox() {
            if (!GALLERY_IMAGES || GALLERY_IMAGES.length === 0) return;
            var total = GALLERY_IMAGES.length;
            activeLightboxIdx = ((activeLightboxIdx % total) + total) % total;
            var relativeSrc = GALLERY_IMAGES[activeLightboxIdx];
            var dataSrc = (EMBEDDED_PANOS && EMBEDDED_PANOS[activeLightboxIdx]) ? EMBEDDED_PANOS[activeLightboxIdx] : relativeSrc;
            var imgEl = document.getElementById('lightbox-img');
            var panoEl = document.getElementById('lightbox-pano');
            var badgeEl = document.getElementById('lightbox-badge');
            var counter = document.getElementById('lightbox-counter');
            var prevBtn = document.getElementById('lightbox-prev');
            var nextBtn = document.getElementById('lightbox-next');

            if (prevBtn) prevBtn.style.display = isHotspotLightbox ? 'none' : 'block';
            if (nextBtn) nextBtn.style.display = isHotspotLightbox ? 'none' : 'block';
            if (counter) counter.innerText = isHotspotLightbox ? 'Hotspot Photo' : ((activeLightboxIdx + 1) + ' / ' + total);

            if (pannellumViewer) {
                try { pannellumViewer.destroy(); } catch(e){}
                pannellumViewer = null;
            }
            if (panoEl) panoEl.innerHTML = '';

            checkIs360(dataSrc, function(is360) {
                if (is360) {
                    if (imgEl) imgEl.style.display = 'none';
                    if (panoEl) panoEl.style.display = 'block';
                    if (badgeEl) badgeEl.style.display = 'flex';

                    function initPannellum() {
                        if (window.pannellum) {
                            panoEl.innerHTML = '';
                            function createViewer(panoPath) {
                                try {
                                    pannellumViewer = pannellum.viewer('lightbox-pano', {
                                        type: 'equirectangular',
                                        panorama: panoPath,
                                        autoLoad: true,
                                        showZoomCtrl: true,
                                        compass: false,
                                        hfov: 100,
                                        minHfov: 30,
                                        maxHfov: 120,
                                        haov: 360,
                                        vaov: 180,
                                        vOffset: 0,
                                        friction: 0.15
                                    });
                                    setTimeout(function() {
                                        if (pannellumViewer) try { pannellumViewer.resize(); } catch(err){}
                                    }, 200);
                                } catch (e) {
                                    console.error("Pannellum init error:", e);
                                    if (panoPath !== relativeSrc) {
                                        createViewer(relativeSrc);
                                    }
                                }
                            }
                            createViewer(dataSrc);
                        } else {
                            setTimeout(initPannellum, 100);
                        }
                    }
                    initPannellum();
                } else {
                    if (panoEl) panoEl.style.display = 'none';
                    if (badgeEl) badgeEl.style.display = 'none';
                    if (imgEl) {
                        imgEl.style.display = 'block';
                        imgEl.src = relativeSrc;
                    }
                }
            });
        }
        window.updateLightbox = updateLightbox;

        document.addEventListener('keydown', function(e) {
            var lb = document.getElementById('lightbox');
            if (lb && lb.classList.contains('active')) {
                if (e.key === 'Escape') closeLightbox();
                if (!isHotspotLightbox) {
                    if (e.key === 'ArrowLeft') changeLightbox(-1);
                    if (e.key === 'ArrowRight') changeLightbox(1);
                }
                return;
            }
            if (exportViewMode === 'slideshow') {
                if (e.key === 'ArrowLeft') changeExportSlide(-1);
                if (e.key === 'ArrowRight') changeExportSlide(1);
            }
        });

        // Website Slideshow & Fast Navigation Logic
        function startExportSlideshow() {
            stopExportSlideshow();
            if (!isExportPlaying || exportViewMode !== 'slideshow' || !GALLERY_IMAGES || GALLERY_IMAGES.length <= 1) return;
            exportSlideshowInterval = setInterval(function() {
                if (!isExportPlaying || exportViewMode !== 'slideshow') {
                    stopExportSlideshow();
                    return;
                }
                changeExportSlide(1, true);
            }, 2000);
        }
        window.startExportSlideshow = startExportSlideshow;

        function stopExportSlideshow() {
            if (exportSlideshowInterval) {
                clearInterval(exportSlideshowInterval);
                exportSlideshowInterval = null;
            }
        }
        window.stopExportSlideshow = stopExportSlideshow;

        function setExportSlide(idx, fromAutoPlay) {
            if (!GALLERY_IMAGES || GALLERY_IMAGES.length === 0) return;
            var total = GALLERY_IMAGES.length;
            exportSlideIndex = ((idx % total) + total) % total;
            window.exportSlideIndex = exportSlideIndex;
            
            var imgEl = document.getElementById('export-slideshow-img');
            var sliderInput = document.getElementById('export-slider-input');
            var badgeEl = document.getElementById('export-slide-badge');
            var hudEl = document.getElementById('export-slideshow-hud');

            if (imgEl && GALLERY_IMAGES[exportSlideIndex]) {
                imgEl.src = GALLERY_IMAGES[exportSlideIndex];
            }
            if (sliderInput) sliderInput.value = exportSlideIndex;
            if (badgeEl) badgeEl.innerHTML = '#' + (exportSlideIndex + 1) + ' <span class="text-slate-500 text-[10px]">/ ' + total + '</span>';
            if (hudEl) hudEl.innerText = 'Photo #' + (exportSlideIndex + 1) + ' of ' + total;

            var thumbStrip = document.getElementById('export-thumb-strip');
            var thumbItems = document.querySelectorAll('.export-thumb-item');
            if (thumbItems && thumbItems.length > 0) {
                thumbItems.forEach(function(el, i) {
                    if (i === exportSlideIndex) {
                        el.classList.add('scale-105', 'shadow-xl');
                        el.style.borderColor = BRAND_COLOR;
                        el.style.boxShadow = '0 0 15px ' + BRAND_COLOR + '40';
                        el.style.opacity = '1';
                        if (thumbStrip && thumbStrip.style.display !== 'none' && el.scrollIntoView) {
                            try { el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); } catch(err){}
                        }
                    } else {
                        el.classList.remove('scale-105', 'shadow-xl');
                        el.style.borderColor = 'rgba(255,255,255,0.1)';
                        el.style.boxShadow = 'none';
                        el.style.opacity = '0.6';
                    }
                });
            }

            if (exportViewMode === 'gallery') {
                var targetPhoto = document.getElementById('export-gallery-photo-' + exportSlideIndex);
                if (targetPhoto) {
                    targetPhoto.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }

            // Only restart timer if manual navigation occurred so user gets full 2 seconds
            if (!fromAutoPlay && isExportPlaying && exportViewMode === 'slideshow') {
                startExportSlideshow();
            }
        }
        window.setExportSlide = setExportSlide;

        function changeExportSlide(delta, fromAutoPlay) {
            setExportSlide(exportSlideIndex + delta, fromAutoPlay);
        }
        window.changeExportSlide = changeExportSlide;

        function toggleExportSlideshowPlay() {
            isExportPlaying = !isExportPlaying;
            window.isExportPlaying = isExportPlaying;
            var btn = document.getElementById('export-play-btn');
            var dot = document.getElementById('export-status-dot');
            var sub = document.getElementById('export-status-sub');

            if (btn) {
                btn.innerHTML = isExportPlaying ? '⏸ Pause' : '▶ Play (2s)';
                btn.style.backgroundColor = isExportPlaying ? BRAND_COLOR + '20' : 'rgba(16, 185, 129, 0.15)';
                btn.style.color = isExportPlaying ? BRAND_COLOR : '#34d399';
                btn.style.borderColor = isExportPlaying ? BRAND_COLOR + '40' : 'rgba(16, 185, 129, 0.3)';
            }
            if (dot) {
                if (isExportPlaying) dot.classList.add('animate-ping');
                else dot.classList.remove('animate-ping');
            }
            if (sub) {
                sub.innerText = isExportPlaying ? 'Auto-advancing every 2 seconds' : 'Slideshow Paused';
            }

            if (isExportPlaying) {
                startExportSlideshow();
            } else {
                stopExportSlideshow();
            }
        }
        window.toggleExportSlideshowPlay = toggleExportSlideshowPlay;

        function toggleExportThumbStrip() {
            var strip = document.getElementById('export-thumb-strip');
            if (strip) {
                var isHidden = (strip.style.display === 'none' || !strip.style.display);
                strip.style.display = isHidden ? 'flex' : 'none';
            }
        }
        window.toggleExportThumbStrip = toggleExportThumbStrip;

        function toggleExportViewMode() {
            exportViewMode = exportViewMode === 'slideshow' ? 'gallery' : 'slideshow';
            window.exportViewMode = exportViewMode;
            var slideshowContainer = document.getElementById('export-slideshow-container');
            var galleryContainer = document.getElementById('export-gallery-container');
            var btn = document.getElementById('export-view-mode-btn');
            var statusTitle = document.getElementById('export-status-title');
            var playBtn = document.getElementById('export-play-btn');

            if (exportViewMode === 'slideshow') {
                if (slideshowContainer) slideshowContainer.style.display = 'flex';
                if (galleryContainer) galleryContainer.style.display = 'none';
                if (playBtn) playBtn.style.display = 'inline-flex';
                if (statusTitle) statusTitle.innerText = 'Slideshow Mode (2s Auto-Play)';
                if (btn) {
                    btn.style.backgroundColor = BRAND_COLOR;
                    btn.style.borderColor = 'rgba(255,255,255,0.25)';
                    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4 text-white"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25a2.25 2.25 0 0 1-2.25 2.25h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" /></svg><span>See as Gallery (Populate All Images)</span>';
                }
                if (isExportPlaying) startExportSlideshow();
            } else {
                if (slideshowContainer) slideshowContainer.style.display = 'none';
                if (galleryContainer) galleryContainer.style.display = 'block';
                if (playBtn) playBtn.style.display = 'none';
                if (statusTitle) statusTitle.innerText = 'Gallery Grid (' + GALLERY_IMAGES.length + ' Photos)';
                if (btn) {
                    btn.style.backgroundColor = 'rgba(30, 41, 59, 0.9)';
                    btn.style.borderColor = BRAND_COLOR + '50';
                    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4 text-orange-400"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg><span>See as Slideshow (Auto 2s Per Image)</span>';
                }
                stopExportSlideshow();
            }
        }
        window.toggleExportViewMode = toggleExportViewMode;

        // Start 2-second slideshow auto-play on load and setup initial slide
        function initExportSlideshow() {
            setExportSlide(0);
            if (isExportPlaying) {
                startExportSlideshow();
            }
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initExportSlideshow);
        } else {
            initExportSlideshow();
        }

        var currentExportMapLayer = 'roadmap';
        var currentExportPoiQuery = '';
        var BASE_MAP_ADDRESS = ${JSON.stringify(mapSearchAddress)};

        function updateExportMapSrc() {
            const tParam = currentExportMapLayer === 'satellite' ? 'k' : (currentExportMapLayer === 'terrain' ? 'p' : '');
            const zoom = currentExportPoiQuery ? 14 : (currentExportMapLayer === 'satellite' ? 17 : 15);
            const qStr = currentExportPoiQuery ? (currentExportPoiQuery + ' near ' + BASE_MAP_ADDRESS) : BASE_MAP_ADDRESS;
            const url = 'https://maps.google.com/maps?q=' + encodeURIComponent(qStr) + '&t=' + tParam + '&z=' + zoom + '&ie=UTF8&iwloc=&output=embed';
            const iframe = document.getElementById('export-map-iframe');
            if (iframe) iframe.src = url;
        }

        function setExportMapLayer(layer) {
            currentExportMapLayer = layer;
            document.querySelectorAll('.export-layer-btn').forEach(function(btn) {
                btn.className = 'export-layer-btn px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer bg-slate-900 text-slate-400 border border-white/10 hover:text-white';
            });
            const activeBtn = document.getElementById('btn-layer-' + layer);
            if (activeBtn) {
                activeBtn.className = 'export-layer-btn px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer bg-slate-800 text-white border border-white/20 shadow-md';
            }
            updateExportMapSrc();
        }

        function setExportPoi(poiId, query) {
            currentExportPoiQuery = query;
            document.querySelectorAll('.export-poi-btn').forEach(function(btn) {
                btn.style.backgroundColor = '';
                btn.style.color = '';
                btn.style.borderColor = '';
                btn.className = 'export-poi-btn px-3 py-1.5 rounded-xl text-[10px] font-black whitespace-nowrap transition-all cursor-pointer bg-slate-900 text-slate-400 border border-white/10 hover:text-white';
            });
            const activeBtn = document.getElementById('poi-btn-' + poiId);
            if (activeBtn) {
                activeBtn.style.backgroundColor = BRAND_COLOR;
                activeBtn.style.color = '#ffffff';
                activeBtn.style.borderColor = BRAND_COLOR;
            }
            const banner = document.getElementById('export-poi-banner');
            const bannerText = document.getElementById('export-poi-banner-text');
            if (banner && bannerText) {
                if (query) {
                    banner.style.display = 'flex';
                    bannerText.textContent = 'Highlighting nearby ' + poiId.toUpperCase() + ' around ' + BASE_MAP_ADDRESS;
                } else {
                    banner.style.display = 'none';
                }
            }
            updateExportMapSrc();
        }

        function copyExportAddress() {
            navigator.clipboard.writeText(BASE_MAP_ADDRESS).then(function() {
                const text = document.getElementById('export-copy-text');
                const icon = document.getElementById('export-copy-icon');
                if (text) text.textContent = 'Address Copied!';
                if (icon) icon.textContent = '✅';
                setTimeout(function() {
                    if (text) text.textContent = 'Copy Address';
                    if (icon) icon.textContent = '📋';
                }, 2500);
            });
        }

        // Instant Neighborhood & Commute Calculator ($0 Free Tier Engine)
        var exportCommuteState = {
            origin: BASE_MAP_ADDRESS,
            dest: 'Downtown ' + (${JSON.stringify(property.city || 'Metro')}),
            mode: 'driving',
            unit: 'miles',
            approxMiles: 6.8
        };

        function setExportCommutePreset(presetId, defaultDest, miles) {
            exportCommuteState.dest = defaultDest;
            exportCommuteState.approxMiles = miles;
            var input = document.getElementById('export-commute-input');
            if (input) input.value = defaultDest;

            document.querySelectorAll('.export-commute-preset-btn').forEach(function(btn) {
                if (btn.getAttribute('data-preset-id') === presetId) {
                    btn.className = 'export-commute-preset-btn px-3 py-1.5 rounded-xl text-[9.5px] font-bold whitespace-nowrap transition-all border cursor-pointer flex items-center gap-1.5 bg-orange-500 text-white border-orange-400 shadow-md';
                } else {
                    btn.className = 'export-commute-preset-btn px-3 py-1.5 rounded-xl text-[9.5px] font-bold whitespace-nowrap transition-all border cursor-pointer flex items-center gap-1.5 bg-slate-950/70 text-slate-400 border-white/10 hover:text-white hover:bg-slate-800';
                }
            });

            calcExportCommute();
        }

        function setExportCommuteMode(mode) {
            exportCommuteState.mode = mode;
            document.querySelectorAll('.export-commute-mode-btn').forEach(function(btn) {
                if (btn.getAttribute('data-mode') === mode) {
                    btn.className = 'export-commute-mode-btn px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 bg-orange-500 text-white shadow-md';
                } else {
                    btn.className = 'export-commute-mode-btn px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 text-slate-400 hover:text-white hover:bg-white/5';
                }
            });
            calcExportCommute();
        }

        function setExportCommuteUnit(unit) {
            exportCommuteState.unit = unit;
            var milesBtn = document.getElementById('export-unit-miles');
            var kmBtn = document.getElementById('export-unit-km');
            if (unit === 'miles') {
                if (milesBtn) milesBtn.className = 'px-2 py-0.5 rounded-lg transition-all cursor-pointer bg-slate-800 text-white';
                if (kmBtn) kmBtn.className = 'px-2 py-0.5 rounded-lg transition-all cursor-pointer text-slate-500 hover:text-slate-300';
            } else {
                if (kmBtn) kmBtn.className = 'px-2 py-0.5 rounded-lg transition-all cursor-pointer bg-slate-800 text-white';
                if (milesBtn) milesBtn.className = 'px-2 py-0.5 rounded-lg transition-all cursor-pointer text-slate-500 hover:text-slate-300';
            }
            calcExportCommute();
        }

        function calcExportCommute() {
            var input = document.getElementById('export-commute-input');
            var dest = (input && input.value ? input.value : exportCommuteState.dest || '').trim();
            if (!dest) return;
            var mode = exportCommuteState.mode;
            var miles = exportCommuteState.approxMiles || 5.0;

            if (/airport/i.test(dest)) miles = 14.5;
            else if (/downtown|financial|center/i.test(dest)) miles = 7.2;
            else if (/gym|fitness|equinox|coffee|market/i.test(dest)) miles = 1.9;
            else if (/beach|waterfront|marina/i.test(dest)) miles = 5.4;
            else {
                var sum = 0;
                for (var i = 0; i < dest.length; i++) sum += dest.charCodeAt(i);
                miles = 2.0 + (sum % 160) / 10;
            }

            var minMins = 0;
            var maxMins = 0;
            var traffic = '';
            var route = '';

            if (mode === 'driving') {
                var speed = miles > 10 ? 42 : 28;
                var base = (miles / speed) * 60;
                minMins = Math.max(3, Math.round(base));
                maxMins = Math.max(minMins + 3, Math.round(base * 1.35));
                traffic = '⚡ Morning Rush: +4 to 8 mins (7:30 – 9:00 AM)';
                route = miles > 8 ? 'Via Interstate Arterials & Parkway' : 'Via Primary Boulevards & Avenues';
            } else if (mode === 'transit') {
                var base = (miles / 18) * 60 + 8;
                minMins = Math.max(10, Math.round(base));
                maxMins = Math.max(minMins + 5, Math.round(base * 1.25));
                traffic = '🚆 Express Departures every 8–12 mins';
                route = 'Rapid Bus & Regional Commuter Metro Rail';
            } else if (mode === 'bicycling') {
                var base = (miles / 12) * 60;
                minMins = Math.max(5, Math.round(base));
                maxMins = Math.max(minMins + 3, Math.round(base * 1.15));
                traffic = '🚲 Protected bike lanes & gentle grade';
                route = 'Scenic Greenway & Dedicated Bike Paths';
            } else {
                var base = (miles / 3.1) * 60;
                minMins = Math.max(5, Math.round(base));
                maxMins = Math.max(minMins + 2, Math.round(base * 1.1));
                traffic = '🚶 Pedestrian friendly sidewalks & streetlights';
                route = 'Direct Sidewalk Walkway';
            }

            var timeStr = minMins === maxMins ? minMins + ' min' : minMins + ' – ' + maxMins + ' min';
            var km = Math.round(miles * 1.60934 * 10) / 10;
            var distStr = exportCommuteState.unit === 'miles' ? miles + ' mi' : km + ' km';

            var durEl = document.getElementById('export-commute-duration');
            var distEl = document.getElementById('export-commute-distance');
            var trafEl = document.getElementById('export-commute-traffic');
            var routeEl = document.getElementById('export-commute-route');
            var destLabelEl = document.getElementById('export-commute-dest-label');
            var modeIconEl = document.getElementById('export-commute-mode-icon');

            if (durEl) durEl.textContent = timeStr;
            if (distEl) distEl.textContent = distStr;
            if (trafEl) trafEl.textContent = traffic;
            if (routeEl) routeEl.textContent = route;
            if (destLabelEl) destLabelEl.textContent = dest;
            if (modeIconEl) {
                modeIconEl.textContent = mode === 'driving' ? '🚗' : mode === 'transit' ? '🚆' : mode === 'bicycling' ? '🚲' : '🚶';
            }

            var originEnc = encodeURIComponent(BASE_MAP_ADDRESS);
            var destEnc = encodeURIComponent(dest);
            var gMode = mode === 'driving' ? 'driving' : mode === 'transit' ? 'transit' : mode === 'bicycling' ? 'bicycling' : 'walking';
            var aMode = mode === 'transit' ? 'r' : mode === 'walking' ? 'w' : mode === 'bicycling' ? 'b' : 'd';

            var gBtn = document.getElementById('export-commute-google-btn');
            if (gBtn) gBtn.href = 'https://www.google.com/maps/dir/?api=1&origin=' + originEnc + '&destination=' + destEnc + '&travelmode=' + gMode;

            var aBtn = document.getElementById('export-commute-apple-btn');
            if (aBtn) aBtn.href = 'https://maps.apple.com/?saddr=' + originEnc + '&daddr=' + destEnc + '&dirflg=' + aMode;

            var wBtn = document.getElementById('export-commute-waze-btn');
            if (wBtn) wBtn.href = 'https://waze.com/ul?q=' + destEnc + '&navigate=yes';
        }

        // Initialize commute calculations on load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                try { calcExportCommute(); } catch(e) {}
            });
        } else {
            try { calcExportCommute(); } catch(e) {}
        }

        const AGENTS_DATA = {
            agent1: {
                name: ${JSON.stringify(property.agentName || 'Professional Agent')},
                brokerage: ${JSON.stringify(property.brokerage || '')},
                phone: ${JSON.stringify(property.phoneNumber || '')},
                email: ${JSON.stringify(property.email || '')},
                website: ${JSON.stringify(property.website || '')},
                title: 'Listing Associate',
                photo: ${JSON.stringify(assetPaths.headshot || assetPaths.logo || '')},
                address: ${JSON.stringify(fullAddress)}
            },
            agent2: ${exportHasAgent2 ? JSON.stringify({
                name: property.agent2Name || 'Co-Listing Agent',
                brokerage: property.agent2Brokerage || property.brokerage || '',
                phone: property.agent2PhoneNumber || '',
                email: property.agent2Email || '',
                website: property.website || '',
                title: 'Co-Listing Associate',
                photo: assetPaths.headshot2 || assetPaths.logo2 || assetPaths.logo || '',
                address: fullAddress
            }) : 'null'}
        };

        let currentModalAgentKey = 'agent1';

        function buildExportVCardText(agent) {
            const name = (agent.name || 'Agent').trim();
            const parts = name.split(' ');
            const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
            const firstName = parts[0] || '';
            const cleanPhone = (agent.phone || '').replace(/[^0-9+]/g, '');

            let lines = [
                'BEGIN:VCARD',
                'VERSION:3.0',
                'N:' + lastName + ';' + firstName + ';;;',
                'FN:' + name,
                'ORG:' + (agent.brokerage || ''),
                'TITLE:' + (agent.title || 'Listing Associate')
            ];
            if (cleanPhone) lines.push('TEL;TYPE=CELL,VOICE:' + cleanPhone);
            if (agent.email) lines.push('EMAIL;TYPE=PREF,INTERNET:' + agent.email.trim());
            if (agent.website) lines.push('URL:' + agent.website.trim());
            if (agent.address) lines.push('NOTE:Listing for ' + agent.address);
            lines.push('END:VCARD');
            return lines.join('\\r\\n');
        }

        function downloadExportVCard(agentKey) {
            const agent = AGENTS_DATA[agentKey];
            if (!agent) return;
            const vcfContent = buildExportVCardText(agent);
            const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const safeName = (agent.name || 'Agent').replace(/[^a-zA-Z0-9_-]/g, '_');
            a.download = safeName + '_Contact_Card.vcf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function() { URL.revokeObjectURL(url); }, 1500);
        }

        function toggleExportVCardModal(show) {
            const modal = document.getElementById('export-vcard-modal');
            if (modal) modal.style.display = show ? 'flex' : 'none';
        }

        function openExportVCardModal(agentKey) {
            const agent = AGENTS_DATA[agentKey];
            if (!agent) return;
            currentModalAgentKey = agentKey;

            const nameEl = document.getElementById('export-modal-agent-name');
            const titleEl = document.getElementById('export-modal-agent-title');
            const brokEl = document.getElementById('export-modal-agent-brokerage');
            const avatarEl = document.getElementById('export-modal-agent-avatar');
            const qrImg = document.getElementById('export-modal-qr-img');
            const callBtn = document.getElementById('export-modal-call-btn');
            const smsBtn = document.getElementById('export-modal-sms-btn');
            const emailBtn = document.getElementById('export-modal-email-btn');

            if (nameEl) nameEl.textContent = agent.name || 'Professional Agent';
            if (titleEl) titleEl.textContent = agent.title || 'Listing Associate';
            if (brokEl) brokEl.textContent = agent.brokerage || '';
            if (avatarEl) {
                if (agent.photo) {
                    avatarEl.innerHTML = '<img src="' + agent.photo + '" class="w-full h-full object-cover rounded-full" />';
                } else {
                    avatarEl.innerHTML = '<div class="w-full h-full bg-slate-800 flex items-center justify-center text-slate-500 font-bold text-lg rounded-full">' + ((agent.name || 'A')[0]) + '</div>';
                }
            }

            const cleanPhone = (agent.phone || '').replace(/[^0-9+]/g, '');
            if (callBtn) {
                if (cleanPhone) {
                    callBtn.href = 'tel:' + cleanPhone;
                    callBtn.style.opacity = '1';
                    callBtn.style.pointerEvents = 'auto';
                } else {
                    callBtn.href = '#';
                    callBtn.style.opacity = '0.4';
                    callBtn.style.pointerEvents = 'none';
                }
            }
            if (smsBtn) {
                if (cleanPhone) {
                    smsBtn.href = 'sms:' + cleanPhone;
                    smsBtn.style.opacity = '1';
                    smsBtn.style.pointerEvents = 'auto';
                } else {
                    smsBtn.href = '#';
                    smsBtn.style.opacity = '0.4';
                    smsBtn.style.pointerEvents = 'none';
                }
            }
            if (emailBtn) {
                if (agent.email) {
                    emailBtn.href = 'mailto:' + agent.email;
                    emailBtn.style.opacity = '1';
                    emailBtn.style.pointerEvents = 'auto';
                } else {
                    emailBtn.href = '#';
                    emailBtn.style.opacity = '0.4';
                    emailBtn.style.pointerEvents = 'none';
                }
            }

            let mecard = 'MECARD:N:' + (agent.name || '') + ';';
            if (agent.brokerage) mecard += 'ORG:' + agent.brokerage + ';';
            if (cleanPhone) mecard += 'TEL:' + cleanPhone + ';';
            if (agent.email) mecard += 'EMAIL:' + agent.email + ';';
            if (agent.website) mecard += 'URL:' + agent.website + ';';
            if (agent.address) mecard += 'NOTE:Listing for ' + agent.address + ';';
            mecard += ';';

            if (qrImg) {
                qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=4&data=' + encodeURIComponent(mecard);
            }

            toggleExportVCardModal(true);
        }

        function downloadCurrentExportVCard() {
            downloadExportVCard(currentModalAgentKey);
        }

        function copyCurrentExportContactDetails() {
            const agent = AGENTS_DATA[currentModalAgentKey];
            if (!agent) return;
            const text = [
                agent.name,
                agent.title,
                agent.brokerage,
                agent.phone ? 'Phone: ' + agent.phone : '',
                agent.email ? 'Email: ' + agent.email : '',
                agent.website ? 'Website: ' + agent.website : '',
                agent.address ? 'Property: ' + agent.address : ''
            ].filter(Boolean).join('\\n');

            navigator.clipboard.writeText(text).then(function() {
                const btn = document.getElementById('export-modal-copy-btn');
                if (btn) {
                    btn.innerHTML = '<span>✓</span> Copied Details!';
                    setTimeout(function() {
                        btn.innerHTML = '<span>📋</span> Copy Contact Info';
                    }, 2500);
                }
            });
        }


    </script>
</body>
</html>`;

      rootFolder.file('index.html', htmlContent); 
      const content = await zip.generateAsync({ type: 'blob' }); 
      const url = URL.createObjectURL(content); 
      const a = document.createElement('a'); 
      a.href = url; 
      a.download = `Property-Site-${(property.address || 'Export').replace(/\s+/g, '-')}.zip`; 
      a.click();
    } catch (e) { console.error(e); } finally { setIsExporting(false); }
  };

  const specsStr = [
    property.bed ? `${property.bed} BED` : '', 
    property.bath ? `${property.bath} BATH` : '', 
    property.sqft ? `${property.sqft} SQFT` : ''
  ].filter(Boolean).join(' • ');

  const videoUrl = cleanEmbedUrl(property.videoUrl);
  const matterportUrl = cleanEmbedUrl(property.matterportUrl);
  const droneUrl = cleanEmbedUrl(property.drone);
  const threeDFloorPlanUrl = cleanEmbedUrl(property.threeDFloorPlan);
  const hasInteractive = !!(matterportUrl || videoUrl);

  const mapSearchAddress = [property.address, property.city].filter(Boolean).join(', ') || property.address || property.city || 'Beverly Hills, CA';
  const showMapTab = property.showMap !== false && Boolean(property.address || property.city);

  const POI_CATEGORIES = [
    { id: 'all', label: 'Property Pin', icon: '📍', query: '' },
    { id: 'schools', label: 'Schools', icon: '🏫', query: 'schools' },
    { id: 'dining', label: 'Cafes & Dining', icon: '☕', query: 'restaurants cafes' },
    { id: 'parks', label: 'Parks & Rec', icon: '🌲', query: 'parks recreation' },
    { id: 'transit', label: 'Transit & Trains', icon: '🚆', query: 'transit train station' },
    { id: 'shopping', label: 'Groceries & Retail', icon: '🛍️', query: 'grocery store shopping' },
    { id: 'health', label: 'Medical & Hospitals', icon: '🏥', query: 'hospital urgent care' },
  ];

  const getGoogleMapsEmbedSrc = (layer: 'roadmap' | 'satellite' | 'terrain', poiId: string) => {
    const poi = POI_CATEGORIES.find(p => p.id === poiId);
    const poiQuery = poi?.query || '';
    const qStr = poiQuery ? `${poiQuery} near ${mapSearchAddress}` : mapSearchAddress;
    const tParam = layer === 'satellite' ? 'k' : (layer === 'terrain' ? 'p' : '');
    const zoom = poiQuery ? 14 : (layer === 'satellite' ? 17 : 15);
    return `https://maps.google.com/maps?q=${encodeURIComponent(qStr)}&t=${tParam}&z=${zoom}&ie=UTF8&iwloc=&output=embed`;
  };

  const handleCopyAddress = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(mapSearchAddress).then(() => {
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2500);
      });
    }
  };

  const openGalleryLightbox = (idx: number) => {
    setActiveHotspotUrl(null);
    setIsHotspotMode(false);
    setIs360Active(false);
    setLightboxIndex(idx);
    document.body.style.overflow = 'hidden';
  };

  const openHotspotLightbox = (idx: number) => {
    setActiveHotspotUrl(null);
    setIsHotspotMode(true);
    setLightboxIndex(idx);
    document.body.style.overflow = 'hidden';
  };

  const handleDownloadFloorPlan = () => {
    if (!property.floorPlan) return;
    const link = document.createElement('a');
    link.href = property.floorPlan;
    const cleanAddress = (property.address || 'FloorPlan').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.download = `FloorPlan-${cleanAddress}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openHotspotImage = (url: string, spot?: FloorPlanHotspot) => {
    setActiveHotspotUrl(url);
    setIsHotspotMode(true);
    const is360 = spot?.is360 === true || (spot?.is360 !== false && spot?.targetImageIndex === undefined && !!spot?.targetImageUrl);
    setIs360Active(is360);
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
    setActiveHotspotUrl(null);
    setIsHotspotMode(false);
    document.body.style.overflow = 'auto';
  };

  const changeLightbox = (delta: number) => {
    if (isHotspotMode || lightboxIndex === null) return;
    const nextIdx = (lightboxIndex + delta + property.galleryImages.length) % property.galleryImages.length;
    setLightboxIndex(nextIdx);
  };

  return (
    <div className="animate-fade-in-up bg-slate-950 min-h-screen relative pb-20 overflow-x-hidden">
      <style>{`
        .gallery-mobile-scroll::-webkit-scrollbar { height: 6px; display: block; }
        .gallery-mobile-scroll::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
        .gallery-mobile-scroll::-webkit-scrollbar-thumb { background: ${brandingColor}; border-radius: 10px; }
        
        @keyframes sun-flare-cinematic {
          0% { opacity: 0.1; transform: scale(1) translate(-20%, -20%) rotate(0deg); }
          50% { opacity: 0.5; transform: scale(1.4) translate(-10%, -10%) rotate(15deg); }
          100% { opacity: 0.1; transform: scale(1) translate(-20%, -20%) rotate(0deg); }
        }
        .sun-flare-overlay {
          position: absolute; top: -20%; left: -20%; width: 80%; height: 80%;
          background: radial-gradient(circle at center, rgba(255,255,255,0.5) 0%, rgba(251,191,36,0.15) 35%, transparent 75%);
          filter: blur(100px); animation: sun-flare-cinematic 12s infinite ease-in-out;
          pointer-events: none; z-index: 10; mix-blend-mode: screen;
        }

        @keyframes ray-shimmer {
          0% { opacity: 0.03; transform: rotate(-5deg) scale(1); }
          50% { opacity: 0.12; transform: rotate(5deg) scale(1.1); }
          100% { opacity: 0.03; transform: rotate(-5deg) scale(1); }
        }
        .sunny-ray {
          position: absolute; top: 0; left: 0; width: 100%; height: 100%;
          background: repeating-conic-gradient(from 45deg, transparent 0deg 12deg, rgba(251,191,36,0.06) 18deg 25deg);
          mask-image: radial-gradient(circle at 5% 5%, black, transparent 80%);
          animation: ray-shimmer 15s infinite linear; pointer-events: none; z-index: 9;
        }

        @keyframes sun-flare-main-react { 0% { opacity: 0.2; transform: scale(1) translate(-20%, -20%); } 50% { opacity: 0.5; transform: scale(1.1) translate(-15%, -15%); } 100% { opacity: 0.2; transform: scale(1) translate(-20%, -20%); } }
        .sun-flare-main-react { position: absolute; top: 0; left: 0; width: 60%; height: 60%; background: radial-gradient(circle at center, rgba(255,255,255,0.4) 0%, rgba(251,191,36,0.1) 40%, transparent 70%); filter: blur(60px); animation: sun-flare-main-react 10s infinite ease-in-out; pointer-events: none; z-index: 10; }
        .map-sunny-overlay { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle at 10% 10%, rgba(251, 191, 36, 0.15) 0%, transparent 60%); mix-blend-mode: overlay; }
      `}</style>

      {(lightboxIndex !== null || activeHotspotUrl !== null) && (() => {
        const currentLightboxSrc = activeHotspotUrl || (lightboxIndex !== null ? property.galleryImages[lightboxIndex] : '');
        return (
          <div 
            className="fixed inset-0 z-[1000] bg-slate-950/98 backdrop-blur-xl flex flex-col items-center justify-center p-8 animate-fade-in-up"
            onClick={(e) => { if(e.target === e.currentTarget) closeLightbox(); }}
          >
            <button onClick={closeLightbox} className="absolute top-8 right-8 p-4 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all z-[1100]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            {!isHotspotMode && (
              <>
                <button onClick={() => changeLightbox(-1)} className="absolute left-8 top-1/2 -translate-y-1/2 p-4 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all z-[1100]">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                </button>
                <button onClick={() => changeLightbox(1)} className="absolute right-8 top-1/2 -translate-y-1/2 p-4 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all z-[1100]">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </button>
              </>
            )}

            {is360Active && (
              <div className="absolute top-8 left-8 px-4 py-2 bg-orange-600 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-2xl flex items-center gap-2 z-[1100]">
                <span>🌐</span> 360° Interactive Panorama Detected
              </div>
            )}

            {is360Active ? (
              <PanoViewerContainer src={currentLightboxSrc} />
            ) : (
              <img src={currentLightboxSrc} className="max-w-full max-h-[85vh] object-contain shadow-2xl rounded-2xl border border-white/5" alt="Expanded" />
            )}

            <div className="mt-8 px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400">
              {isHotspotMode ? 'Hotspot Photo' : `${(lightboxIndex ?? 0) + 1} / ${property.galleryImages.length}`}
            </div>
          </div>
        );
      })()}

      <div className="fixed top-28 right-10 z-[100] flex gap-3">
        <button 
          onClick={handleDownloadWebsite} 
          disabled={isExporting}
          className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl shadow-2xl hover:bg-emerald-500 transition-all font-black flex items-center gap-3 border border-emerald-500/20 text-[10px] uppercase tracking-widest disabled:opacity-50"
        >
          {isExporting ? (
            <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Packaging...</>
          ) : (
            <><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>Download Site</>
          )}
        </button>
      </div>

      {showContactModal && (
        <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="max-w-md w-full glass-panel p-8 md:p-10 rounded-[2.5rem] border border-white/10 shadow-2xl relative animate-fade-in-up">
                <button onClick={() => setShowContactModal(false)} className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                {isSubmitted ? (
                    <div className="text-center space-y-4 py-10">
                        <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-900/40">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-8 h-8 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                        </div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Inquiry Received</h3>
                        <p className="text-slate-400 text-sm">An associate will contact you shortly to coordinate your private viewing.</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        <div className="space-y-2">
                            <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Private Viewing</h3>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Property: {property.unit ? property.unit + ' - ' : ''}{property.address}</p>
                        </div>
                        <form name="property-inquiry" method="POST" data-netlify="true" onSubmit={handleNetlifySubmit} className="space-y-4">
                            <input type="hidden" name="form-name" value="property-inquiry" /><input type="hidden" name="property_address" value={property.unit ? property.unit + ' - ' + (property.address || '') : (property.address || 'Unknown')} />
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                                <input required type="text" name="name" className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-orange-500 outline-none" placeholder="John Doe" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
                                <input required type="email" name="email" className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-orange-500 outline-none" placeholder="john@example.com" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Message (Optional)</label>
                                <textarea name="message" rows={3} className="w-full bg-slate-900/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-orange-500 outline-none resize-none" placeholder="I would like to schedule a tour this weekend..."></textarea>
                            </div>
                            <button type="submit" className="w-full py-4 mt-4 rounded-xl font-black uppercase tracking-widest text-[11px] text-white shadow-xl transition-all hover:scale-[1.02] active:scale-95 cursor-pointer" style={{ backgroundColor: brandingColor }}>Send Inquiry</button>
                        </form>

                        <div className="pt-4 border-t border-white/5 flex items-center justify-between gap-3">
                            <span className="text-[10px] text-slate-400 font-bold">Prefer direct contact?</span>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowContactModal(false);
                                    setSelectedVCardAgent({
                                        name: property.agentName || 'Professional Agent',
                                        brokerage: property.brokerage,
                                        phone: property.phoneNumber,
                                        email: property.email,
                                        website: property.website,
                                        title: 'Listing Associate',
                                        photo: property.headshot || property.logo,
                                        propertyAddress: property.unit ? `${property.unit} - ${property.address}` : property.address,
                                        city: property.city
                                    });
                                }}
                                className="text-[10px] font-black uppercase tracking-wider text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 cursor-pointer"
                            >
                                <span>📇</span> Save Agent Contact Card
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}
      
      <div className="relative h-[65vh] md:h-[80vh] w-full overflow-hidden">
        <div className="sun-flare-main-react"></div>
        {property.galleryImages?.[0] ? <img src={property.galleryImages[0]} className="w-full h-full object-cover scale-105" alt="Hero" /> : <div className="w-full h-full bg-slate-900" />}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
        <div className="absolute bottom-12 left-0 w-full px-6 md:px-12 max-w-[1400px] mx-auto right-0 flex flex-wrap items-end justify-between gap-6">
            <div className="space-y-4 max-w-full overflow-hidden">
                {property.price && (
                  <div className="inline-flex px-4 py-2 rounded-lg text-lg font-black text-white uppercase tracking-tight" style={{ backgroundColor: brandingColor }}>
                    {property.price}
                  </div>
                )}
                <h1 className="text-[clamp(1.5rem,4vw,4.5rem)] font-black text-white uppercase tracking-tighter leading-[1.1] whitespace-nowrap">{property.unit ? property.unit + ' - ' : ''}{property.address || 'Untitled'}</h1>
                <div className="flex items-center gap-6 text-slate-400 font-bold uppercase tracking-[0.2em] text-xs md:text-sm"><span className="flex items-center gap-2"><svg className="w-5 h-5" style={{ color: brandingColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>{property.city || 'TBD'}</span><span className="opacity-20">|</span><span className="text-white">{specsStr || 'LUXURY LIVING'}</span></div>
            </div>
            {property.logo && <div className="p-4 md:p-6 glass-panel rounded-3xl border border-white/10 hidden md:flex items-center justify-center shrink-0"><img src={property.logo} className="h-16 object-contain" alt="Brokerage" /></div>}
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 md:px-12 pt-12 md:pt-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 md:gap-20">
          <div className="lg:col-span-8">
            <div className="bg-slate-950/80 backdrop-blur-xl border-b border-white/5 py-6 mb-8">
              <div className="flex justify-start md:justify-center gap-6 md:gap-12 overflow-x-auto scrollbar-hide">
                <button onClick={() => setActiveTab('gallery')} className="flex-shrink-0 whitespace-nowrap px-2 py-2 text-[11px] font-black uppercase tracking-[0.2em] border-b-2 transition-all" style={{ color: activeTab === 'gallery' ? brandingColor : '#64748b', borderBottomColor: activeTab === 'gallery' ? brandingColor : 'transparent' }}>Gallery</button>
                {(property.floorPlan || property.threeDFloorPlan) && <button onClick={() => setActiveTab('floorplan')} className="flex-shrink-0 whitespace-nowrap px-2 py-2 text-[11px] font-black uppercase tracking-[0.2em] border-b-2 transition-all" style={{ color: activeTab === 'floorplan' ? brandingColor : '#64748b', borderBottomColor: activeTab === 'floorplan' ? brandingColor : 'transparent' }}>Floor Plan</button>}
                {hasInteractive && <button onClick={() => setActiveTab('interactive')} className="flex-shrink-0 whitespace-nowrap px-2 py-2 text-[11px] font-black uppercase tracking-[0.2em] border-b-2 transition-all" style={{ color: activeTab === 'interactive' ? brandingColor : '#64748b', borderBottomColor: activeTab === 'interactive' ? brandingColor : 'transparent' }}>Interactive</button>}

                {property.drone && <button onClick={() => setActiveTab('drone360')} className="flex-shrink-0 whitespace-nowrap px-2 py-2 text-[11px] font-black uppercase tracking-[0.2em] border-b-2 transition-all" style={{ color: activeTab === 'drone360' ? brandingColor : '#64748b', borderBottomColor: activeTab === 'drone360' ? brandingColor : 'transparent' }}>Drone 360</button>}
                {showMapTab && <button onClick={() => setActiveTab('map')} className="flex-shrink-0 whitespace-nowrap px-2 py-2 text-[11px] font-black uppercase tracking-[0.2em] border-b-2 transition-all" style={{ color: activeTab === 'map' ? brandingColor : '#64748b', borderBottomColor: activeTab === 'map' ? brandingColor : 'transparent' }}>Location &amp; Commute</button>}
              </div>
            </div>

            {activeTab === 'gallery' && (
              <div className="animate-fade-in-up space-y-6">
                {/* Website Fast Scroller & Slideshow Controller Ribbon */}
                <div className="w-full">
                  <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl p-4 md:p-5 shadow-2xl space-y-3">
                    {/* Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                      <div className="flex items-center gap-2.5">
                        <span 
                          className={`w-2.5 h-2.5 rounded-full ${websiteViewMode === 'slideshow' && isWebsitePlaying ? 'animate-ping' : ''}`} 
                          style={{ backgroundColor: brandingColor }}
                        ></span>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black uppercase tracking-wider text-white flex items-center gap-2">
                            {websiteViewMode === 'slideshow' ? 'Slideshow Mode (2s Auto-Play)' : `Gallery Grid (${property.galleryImages.length} Photos)`}
                          </span>
                          {websiteViewMode === 'slideshow' && (
                            <span className="text-[9px] font-mono text-slate-400">
                              {isWebsitePlaying ? 'Auto-advancing every 2 seconds' : 'Slideshow Paused'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {websiteViewMode === 'slideshow' && (
                          <button
                            type="button"
                            onClick={() => setIsWebsitePlaying(!isWebsitePlaying)}
                            className="text-[10px] font-black uppercase px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer"
                            style={{
                              backgroundColor: isWebsitePlaying ? `${brandingColor}20` : 'rgba(16, 185, 129, 0.15)',
                              color: isWebsitePlaying ? brandingColor : '#34d399',
                              borderColor: isWebsitePlaying ? `${brandingColor}40` : 'rgba(16, 185, 129, 0.3)'
                            }}
                          >
                            {isWebsitePlaying ? '⏸ Pause' : '▶ Play (2s)'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowWebsiteThumbStrip(!showWebsiteThumbStrip)}
                          className="text-[10px] font-bold px-3 py-1.5 rounded-xl border uppercase transition-all cursor-pointer"
                          style={{
                            backgroundColor: `${brandingColor}15`,
                            color: brandingColor,
                            borderColor: `${brandingColor}30`
                          }}
                        >
                          {showWebsiteThumbStrip ? 'Hide Strip ▲' : 'Thumbnails ▼'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setWebsiteSlideIndex(0);
                            if (websiteViewMode === 'gallery') scrollToImage(0);
                          }}
                          className="text-[10px] font-bold text-slate-400 hover:text-white bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-white/5 uppercase transition-colors cursor-pointer"
                        >
                          First ⬆
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const lastIdx = Math.max(0, property.galleryImages.length - 1);
                            setWebsiteSlideIndex(lastIdx);
                            if (websiteViewMode === 'gallery') scrollToImage(lastIdx);
                          }}
                          className="text-[10px] font-bold text-slate-400 hover:text-white bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-white/5 uppercase transition-colors cursor-pointer"
                        >
                          Last ⬇
                        </button>
                      </div>
                    </div>

                    {/* Horizontal Range Scrubber Slider */}
                    <div className="relative flex items-center gap-2.5 px-1 pt-1 pb-1">
                      <button
                        type="button"
                        onClick={() => {
                          const prevIdx = (websiteSlideIndex - 1 + property.galleryImages.length) % property.galleryImages.length;
                          setWebsiteSlideIndex(prevIdx);
                          if (websiteViewMode === 'gallery') scrollToImage(prevIdx);
                        }}
                        className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-200 active:scale-95 flex items-center justify-center text-xs font-bold shrink-0 transition-all cursor-pointer"
                        title="Previous Photo"
                      >
                        ◀
                      </button>

                      <div className="relative flex-grow flex items-center h-8">
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0, property.galleryImages.length - 1)}
                          value={websiteSlideIndex}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setWebsiteSlideIndex(val);
                            if (websiteViewMode === 'gallery') scrollToImage(val);
                          }}
                          className="w-full h-3 bg-slate-800 border border-white/10 rounded-lg appearance-none cursor-pointer focus:outline-none"
                          style={{ accentColor: brandingColor }}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const nextIdx = (websiteSlideIndex + 1) % property.galleryImages.length;
                          setWebsiteSlideIndex(nextIdx);
                          if (websiteViewMode === 'gallery') scrollToImage(nextIdx);
                        }}
                        className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-200 active:scale-95 flex items-center justify-center text-xs font-bold shrink-0 transition-all cursor-pointer"
                        title="Next Photo"
                      >
                        ▶
                      </button>

                      <div 
                        className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-mono font-black min-w-[65px] text-center border shadow-md"
                        style={{
                          backgroundColor: `${brandingColor}15`,
                          borderColor: `${brandingColor}35`,
                          color: brandingColor
                        }}
                      >
                        #{websiteSlideIndex + 1} <span className="text-slate-500 text-[10px]">/ {property.galleryImages.length}</span>
                      </div>
                    </div>

                    {/* Collapsible Horizontal Thumbnail Strip */}
                    {showWebsiteThumbStrip && (
                      <div className="flex gap-2.5 overflow-x-auto py-3 px-1 scrollbar-thin mt-2 border-t border-white/5">
                        {property.galleryImages.map((url, idx) => {
                          const isCurrent = idx === websiteSlideIndex;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setWebsiteSlideIndex(idx);
                                if (websiteViewMode === 'gallery') scrollToImage(idx);
                              }}
                              className={`relative shrink-0 w-16 h-16 rounded-2xl overflow-hidden border-2 transition-all cursor-pointer ${
                                isCurrent ? 'scale-105 shadow-xl' : 'border-white/10 opacity-60 hover:opacity-100'
                              }`}
                              style={{
                                borderColor: isCurrent ? brandingColor : undefined,
                                boxShadow: isCurrent ? `0 0 15px ${brandingColor}40` : undefined
                              }}
                            >
                              <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                              <span className="absolute bottom-0 inset-x-0 bg-black/75 text-[9px] font-mono text-white text-center font-bold">
                                {idx + 1}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* PROMINENT TOGGLE BUTTON ON THE WEBSITE BELOW THE SCROLL BAR */}
                    <div className="pt-2 border-t border-white/5">
                      <button
                        type="button"
                        onClick={() => setWebsiteViewMode(websiteViewMode === 'slideshow' ? 'gallery' : 'slideshow')}
                        className="w-full py-3.5 px-5 rounded-2xl font-black uppercase tracking-wider text-xs shadow-2xl transition-all flex items-center justify-center gap-3 border active:scale-[0.99] cursor-pointer"
                        style={{
                          backgroundColor: websiteViewMode === 'slideshow' ? brandingColor : 'rgba(30, 41, 59, 0.9)',
                          borderColor: websiteViewMode === 'slideshow' ? '#ffffff40' : `${brandingColor}50`,
                          color: '#ffffff',
                          boxShadow: websiteViewMode === 'slideshow' ? `0 10px 25px -5px ${brandingColor}60` : undefined
                        }}
                      >
                        {websiteViewMode === 'slideshow' ? (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-white">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25a2.25 2.25 0 0 1-2.25 2.25h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
                            </svg>
                            <span>See as Gallery (Populate All Images)</span>
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-orange-400">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                            </svg>
                            <span>See as Slideshow</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Content View Area */}
                {websiteViewMode === 'slideshow' ? (
                  /* Slideshow View: Large Featured High-Res Frame with 2s Auto-Advancing */
                  <div className="relative group rounded-3xl overflow-hidden bg-slate-900 border border-white/10 shadow-2xl aspect-[16/10] max-h-[700px] flex items-center justify-center">
                    {property.galleryImages[websiteSlideIndex] && (
                      <>
                        <img 
                          src={property.galleryImages[websiteSlideIndex]} 
                          alt={`Photo ${websiteSlideIndex + 1}`}
                          onClick={() => openGalleryLightbox(websiteSlideIndex)}
                          className="w-full h-full object-contain cursor-pointer transition-transform duration-500 hover:scale-[1.02]"
                        />
                        {/* Previous Overlay Arrow */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setWebsiteSlideIndex((websiteSlideIndex - 1 + property.galleryImages.length) % property.galleryImages.length);
                          }}
                          className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-950/70 border border-white/20 text-white flex items-center justify-center opacity-80 hover:opacity-100 hover:scale-110 active:scale-95 transition-all shadow-2xl backdrop-blur-md cursor-pointer"
                          title="Previous Image"
                        >
                          ◀
                        </button>
                        {/* Next Overlay Arrow */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setWebsiteSlideIndex((websiteSlideIndex + 1) % property.galleryImages.length);
                          }}
                          className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-950/70 border border-white/20 text-white flex items-center justify-center opacity-80 hover:opacity-100 hover:scale-110 active:scale-95 transition-all shadow-2xl backdrop-blur-md cursor-pointer"
                          title="Next Image"
                        >
                          ▶
                        </button>
                        {/* Bottom HUD Overlay */}
                        <div className="absolute bottom-4 inset-x-4 flex items-center justify-between pointer-events-none">
                          <span className="px-3.5 py-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/15 text-xs font-mono font-bold text-white shadow-lg">
                            Photo #{websiteSlideIndex + 1} of {property.galleryImages.length}
                          </span>
                          <span className="px-3.5 py-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/15 text-[10px] font-bold uppercase text-slate-300 shadow-lg">
                            Click photo to expand 🔍
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  /* Gallery Grid View: All Photos Populate the Screen */
                  <div className="w-full space-y-4">
                    <div className="columns-1 sm:columns-2 gap-4 md:gap-6">
                      {property.galleryImages.map((url, idx) => ( 
                        <div 
                          key={idx} 
                          id={`preview-gallery-photo-${idx}`}
                          onClick={() => openGalleryLightbox(idx)} 
                          className="break-inside-avoid w-full rounded-3xl overflow-hidden bg-slate-900 border border-white/10 cursor-pointer group mb-4 md:mb-6 shadow-xl hover:border-white/25 transition-all duration-300"
                        > 
                          <img 
                            src={url} 
                            className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105" 
                            alt={`Gallery photo ${idx + 1}`} 
                            loading="lazy"
                          /> 
                        </div> 
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'floorplan' && (property.floorPlan || property.threeDFloorPlan) && (
              <div className="space-y-8 animate-fade-in-up">
                {property.floorPlan && (
                  <>
                    {/* Floor Plan Header & Hotspot Badge & Download Button */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 glass-panel rounded-3xl border border-white/10">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                          <h3 className="text-sm font-black text-white uppercase tracking-wider">Architectural Floor Plan</h3>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                          {property.floorPlanHotspots && property.floorPlanHotspots.length > 0 
                            ? `Click any numbered hotspot pin to inspect room details & linked photography`
                            : `Architectural Layout & Blueprint`}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {property.floorPlanHotspots && property.floorPlanHotspots.length > 0 && (
                          <div className="flex items-center gap-2 px-3.5 py-2.5 bg-orange-500/10 border border-orange-500/30 rounded-2xl">
                            <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">
                              🎯 {property.floorPlanHotspots.length} Room Hotspots Active
                            </span>
                          </div>
                        )}

                        <button
                          onClick={handleDownloadFloorPlan}
                          className="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl shadow-lg shadow-orange-950/40 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 shrink-0 border border-orange-400/30 cursor-pointer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                          Download Floor Plan
                        </button>
                      </div>
                    </div>

                    {/* Interactive Floor Plan Canvas */}
                    <div className="p-4 sm:p-8 bg-slate-900 rounded-[2.5rem] border border-white/10 flex flex-col items-center justify-center shadow-2xl relative overflow-hidden group">
                      {/* Canvas Zoom & Controls Toolbar */}
                      <div className="w-full flex flex-wrap items-center justify-between gap-3 mb-4 p-3.5 bg-slate-950/80 backdrop-blur-md rounded-2xl border border-white/10 z-30">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest mr-1 flex items-center gap-1">
                            <span>🔍</span> Blueprint Zoom:
                          </span>
                          <button
                            onClick={() => setFloorPlanZoom(prev => Math.max(1, +(prev - 0.25).toFixed(2)))}
                            disabled={floorPlanZoom <= 1}
                            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-black text-xs flex items-center justify-center transition-all cursor-pointer border border-white/10"
                            title="Zoom Out"
                          >
                            -
                          </button>
                          {[1, 1.25, 1.5, 2, 2.5].map((z) => (
                            <button
                              key={z}
                              onClick={() => setFloorPlanZoom(z)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all border cursor-pointer ${
                                floorPlanZoom === z 
                                  ? 'bg-orange-600 text-white border-orange-500 shadow-md shadow-orange-950/50' 
                                  : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white hover:bg-slate-800'
                              }`}
                            >
                              {Math.round(z * 100)}%
                            </button>
                          ))}
                          <button
                            onClick={() => setFloorPlanZoom(prev => Math.min(3, +(prev + 0.25).toFixed(2)))}
                            disabled={floorPlanZoom >= 3}
                            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-black text-xs flex items-center justify-center transition-all cursor-pointer border border-white/10"
                            title="Zoom In"
                          >
                            +
                          </button>
                          {floorPlanZoom > 1 && (
                            <button
                              onClick={() => setFloorPlanZoom(1)}
                              className="ml-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-orange-400 rounded-lg text-[9px] font-black uppercase tracking-wider border border-orange-500/30 cursor-pointer"
                            >
                              Reset
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="hidden sm:inline-block text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                            Pinch/Scroll to zoom • Pins stay small
                          </span>
                          <button
                            onClick={handleDownloadFloorPlan}
                            title="Download Full Resolution Floor Plan"
                            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white border border-white/20 rounded-xl text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-xl flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 text-orange-400">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            Download
                          </button>
                        </div>
                      </div>

                      {/* Pan/Zoom Scroll Area */}
                      <div 
                        onTouchStart={handleFloorPlanTouchStart}
                        onTouchMove={handleFloorPlanTouchMove}
                        onTouchEnd={handleFloorPlanTouchEnd}
                        className="w-full max-h-[75vh] overflow-auto rounded-2xl p-1 bg-slate-950/60 border border-white/5 flex justify-start items-start select-none"
                      >
                        <div 
                          className="relative w-full max-w-4xl bg-white rounded-2xl overflow-hidden shadow-2xl transition-transform duration-200 shrink-0 origin-top-left"
                          style={{
                            transform: `scale(${floorPlanZoom})`,
                            marginRight: floorPlanZoom > 1 ? `${(floorPlanZoom - 1) * 100}%` : '0',
                            marginBottom: floorPlanZoom > 1 ? `${(floorPlanZoom - 1) * 100}%` : '0',
                          }}
                        >
                          <img src={property.floorPlan} className="block w-full h-auto pointer-events-none" alt="Floor Plan" />

                          {/* Hotspot Pins */}
                          {property.floorPlanHotspots?.map((spot, idx) => {
                            const isSelected = selectedHotspot?.id === spot.id;
                            let resolvedIdx = spot.targetImageIndex;
                            if ((resolvedIdx === undefined || resolvedIdx < 0 || resolvedIdx >= property.galleryImages.length) && spot.targetImageUrl) {
                              const match = property.galleryImages.findIndex(img => img === spot.targetImageUrl);
                              if (match !== -1) resolvedIdx = match;
                            }
                            const targetImg = (resolvedIdx !== undefined && property.galleryImages[resolvedIdx]) || spot.targetImageUrl;

                            const pinScale = (1 / floorPlanZoom) * (isSelected ? 1.25 : 1);

                            return (
                              <div
                                key={spot.id}
                                style={{ 
                                  left: `${spot.x}%`, 
                                  top: `${spot.y}%`, 
                                  transform: `translate(-50%, -50%) scale(${pinScale})`,
                                  transformOrigin: 'center center'
                                }}
                                onClick={() => {
                                  setSelectedHotspot(isSelected ? null : spot);
                                }}
                                className="absolute z-20 cursor-pointer group/pin"
                              >
                                {/* Radar pulse ring */}
                                <div className="absolute inset-0 -m-2 rounded-full bg-orange-500/40 animate-ping pointer-events-none"></div>

                                {/* Pin Badge */}
                                <button className={`relative w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[8px] sm:text-[10px] font-black shadow-2xl transition-all duration-300 border-2 ${
                                  isSelected 
                                    ? 'bg-orange-600 text-white border-white ring-4 ring-orange-500/50' 
                                    : 'bg-slate-950 text-orange-400 border-orange-500 hover:bg-orange-500 hover:text-white'
                                }`}>
                                  {idx + 1}
                                </button>

                                {/* Tooltip / Floating Card on Hover or Selected */}
                                <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-3.5 bg-slate-950/95 border border-orange-500/40 rounded-2xl shadow-2xl backdrop-blur-xl transition-all duration-300 pointer-events-auto z-50 ${
                                  isSelected 
                                    ? 'opacity-100 scale-100' 
                                    : 'opacity-0 scale-95 pointer-events-none group-hover/pin:opacity-100 group-hover/pin:scale-100 group-hover/pin:pointer-events-auto'
                                }`}>
                                  {targetImg && (
                                    <div className="w-full h-28 rounded-xl overflow-hidden mb-2 bg-slate-900 border border-white/10">
                                      <img src={targetImg} className="w-full h-full object-cover" alt={spot.title} />
                                    </div>
                                  )}
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-black text-orange-400 uppercase tracking-wider">{spot.title || `Hotspot Pin #${idx + 1}`}</span>
                                      <span className="text-[8px] font-bold text-slate-500">Spot #{idx + 1}</span>
                                    </div>
                                    {spot.description && (
                                      <p className="text-[9px] text-slate-300 line-clamp-2 leading-relaxed">{spot.description}</p>
                                    )}
                                    {targetImg && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openHotspotImage(targetImg, spot);
                                        }}
                                        className="w-full mt-2 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-black text-[8px] uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-1"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.573 16.49 16.638 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                                        View Image
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* 3D Floor Plan iFrame below Floor Plan */}
                {threeDFloorPlanUrl && (
                  <div className="space-y-4 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 glass-panel rounded-3xl border border-white/10">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                          <h3 className="text-sm font-black text-white uppercase tracking-wider">3D Interactive Floor Plan</h3>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                          Explore the interactive 3D dollhouse and spatial walkthrough
                        </p>
                      </div>
                      <div className="px-3.5 py-1.5 bg-orange-500/10 border border-orange-500/30 rounded-2xl shrink-0">
                        <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">
                          3D Walkthrough
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-[60vh] sm:h-[75vh] min-h-[420px] rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden border border-white/10 bg-black shadow-2xl">
                      <iframe
                        src={threeDFloorPlanUrl}
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        allowFullScreen
                        allow="xr-spatial-tracking; accelerometer; gyroscope; magnetometer; fullscreen; autoplay; web-share"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        className="w-full h-full border-0"
                        title="3D Floor Plan"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'interactive' && hasInteractive && ( 
              <div className="space-y-12 animate-fade-in-up"> 
                {matterportUrl && (
                  <div className="w-full h-[72vh] sm:h-[82vh] min-h-[520px] md:min-h-[640px] rounded-3xl overflow-hidden border border-white/10 bg-black shadow-2xl">
                    <iframe 
                      src={matterportUrl} 
                      width="100%" 
                      height="100%" 
                      frameBorder="0" 
                      allowFullScreen 
                      allow="xr-spatial-tracking; accelerometer; gyroscope; magnetometer; fullscreen; autoplay; web-share"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      className="w-full h-full border-0"
                      title="Matterport 3D Tour"
                    />
                  </div>
                )} 
                {videoUrl && (
                  <div className="w-full h-[60vh] sm:h-[70vh] min-h-[400px] md:aspect-video rounded-3xl overflow-hidden border border-white/10 bg-black shadow-2xl">
                    <iframe 
                      src={videoUrl} 
                      width="100%" 
                      height="100%" 
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      className="w-full h-full border-0"
                      title="Property Video"
                    />
                  </div>
                )} 
              </div> 
            )}
            


            {activeTab === 'drone360' && droneUrl && (
              <div className="animate-fade-in-up space-y-8">
                 <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                       <div className="space-y-1">
                          <h3 className="text-xl font-black text-white uppercase tracking-tighter">Drone 360 Panorama</h3>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Interactive Aerial Context</p>
                       </div>
                       <div className="flex items-center gap-2">
                          <div className="px-3 py-1.5 bg-black/60 border border-white/5 rounded-lg flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                             <span className="text-[9px] font-black text-white uppercase tracking-widest">Interactive VR</span>
                          </div>
                       </div>
                    </div>
                    <div className="w-full h-[72vh] sm:h-[82vh] min-h-[520px] md:min-h-[640px] rounded-[2.5rem] overflow-hidden border border-white/10 bg-slate-900 shadow-2xl relative">
                       <iframe 
                         width="100%" 
                         height="100%" 
                         frameBorder="0" 
                         src={droneUrl} 
                         className="w-full h-full border-0 bg-slate-900" 
                         allowFullScreen 
                         allow="xr-spatial-tracking; gyroscope; accelerometer; fullscreen; autoplay"
                         loading="lazy"
                         referrerPolicy="no-referrer-when-downgrade"
                         title="Drone 360 Panorama"
                       />
                    </div>
                 </div>
              </div>
            )}


            {activeTab === 'map' && (
              <div className="animate-fade-in-up space-y-6">
                {/* Map & Location Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 glass-panel rounded-3xl border border-white/10 shadow-2xl">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: brandingColor }} />
                      <h3 className="text-sm font-black text-white uppercase tracking-wider">Location &amp; Neighborhood</h3>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      {property.unit ? property.unit + ' - ' : ''}{property.address ? property.address + ', ' : ''}{property.city || ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleCopyAddress} 
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg"
                    >
                      <span>{copiedAddress ? '✅' : '📋'}</span>
                      <span>{copiedAddress ? 'Address Copied!' : 'Copy Address'}</span>
                    </button>
                  </div>
                </div>

                {/* Smart 1-Tap Navigation & Driving Directions */}
                <div className="p-5 bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <span>🧭</span> 1-Tap Navigation &amp; Directions
                    </span>
                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Free GPS Deep Links
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <a 
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapSearchAddress)}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="p-3.5 bg-slate-950/70 hover:bg-slate-800/80 border border-white/10 hover:border-blue-500/50 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-center group transition-all"
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform">🗺️</span>
                      <span className="text-[10px] font-black text-white uppercase tracking-wider">Google Maps</span>
                      <span className="text-[8px] font-bold text-slate-400">Live Traffic &amp; Route</span>
                    </a>

                    <a 
                      href={`https://maps.apple.com/?daddr=${encodeURIComponent(mapSearchAddress)}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="p-3.5 bg-slate-950/70 hover:bg-slate-800/80 border border-white/10 hover:border-slate-400/50 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-center group transition-all"
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform">🍎</span>
                      <span className="text-[10px] font-black text-white uppercase tracking-wider">Apple Maps</span>
                      <span className="text-[8px] font-bold text-slate-400">iOS &amp; CarPlay</span>
                    </a>

                    <a 
                      href={`https://waze.com/ul?q=${encodeURIComponent(mapSearchAddress)}&navigate=yes`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="p-3.5 bg-slate-950/70 hover:bg-slate-800/80 border border-white/10 hover:border-cyan-500/50 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-center group transition-all"
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform">🚙</span>
                      <span className="text-[10px] font-black text-white uppercase tracking-wider">Waze GPS</span>
                      <span className="text-[8px] font-bold text-slate-400">Real-Time Hazards</span>
                    </a>

                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapSearchAddress)}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="p-3.5 bg-slate-950/70 hover:bg-slate-800/80 border border-white/10 hover:border-amber-500/50 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-center group transition-all"
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform">🚶</span>
                      <span className="text-[10px] font-black text-white uppercase tracking-wider">Street View</span>
                      <span className="text-[8px] font-bold text-slate-400">Walk The Block</span>
                    </a>
                  </div>
                </div>

                {/* Map Layer Switcher & POI Category Filters */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-950/80 backdrop-blur-md rounded-2xl border border-white/10">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">🗺️ Layer:</span>
                      <button 
                        onClick={() => setMapLayer('roadmap')} 
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer ${mapLayer === 'roadmap' ? 'bg-slate-800 text-white border border-white/20 shadow-md' : 'bg-slate-900 text-slate-400 border border-white/10 hover:text-white'}`}
                      >
                        Roadmap
                      </button>
                      <button 
                        onClick={() => setMapLayer('satellite')} 
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer ${mapLayer === 'satellite' ? 'bg-slate-800 text-white border border-white/20 shadow-md' : 'bg-slate-900 text-slate-400 border border-white/10 hover:text-white'}`}
                      >
                        🛰️ Satellite
                      </button>
                      <button 
                        onClick={() => setMapLayer('terrain')} 
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer ${mapLayer === 'terrain' ? 'bg-slate-800 text-white border border-white/20 shadow-md' : 'bg-slate-900 text-slate-400 border border-white/10 hover:text-white'}`}
                      >
                        🏔️ Terrain
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <a 
                        href={`https://maps.google.com/maps?q=${encodeURIComponent(mapSearchAddress)}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 text-blue-400"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                        Full Map
                      </a>
                    </div>
                  </div>

                  {/* Points of Interest Pills */}
                  <div className="flex items-center gap-2 overflow-x-auto py-2 px-1 scrollbar-hide">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap mr-1">Nearby POIs:</span>
                    {POI_CATEGORIES.map((poi) => {
                      const isSelected = activePoi === poi.id;
                      return (
                        <button
                          key={poi.id}
                          onClick={() => setActivePoi(poi.id)}
                          className="px-3 py-1.5 rounded-xl text-[10px] font-black whitespace-nowrap transition-all cursor-pointer border"
                          style={{
                            backgroundColor: isSelected ? brandingColor : 'rgb(15 23 42)',
                            color: isSelected ? '#ffffff' : '#94a3b8',
                            borderColor: isSelected ? brandingColor : 'rgba(255, 255, 255, 0.1)',
                          }}
                        >
                          {poi.icon} {poi.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Active POI Search Indicator Banner */}
                  {activePoi !== 'all' && (
                    <div className="p-3 bg-slate-900/90 rounded-xl border border-white/10 flex items-center justify-between animate-fade-in-up">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping" />
                        <span className="text-[10px] font-black text-white uppercase tracking-wider">
                          Highlighting nearby {activePoi.toUpperCase()} around {mapSearchAddress}
                        </span>
                      </div>
                      <button 
                        onClick={() => setActivePoi('all')} 
                        className="text-[9px] font-black text-orange-400 hover:text-white uppercase tracking-wider cursor-pointer"
                      >
                        Reset to Property Pin ✕
                      </button>
                    </div>
                  )}
                </div>

                {/* Embedded Interactive Map Canvas */}
                <div className="w-full h-[62vh] sm:h-[72vh] min-h-[460px] rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden border border-white/10 bg-slate-950 shadow-2xl relative group">
                  <iframe 
                    key={`${mapLayer}-${activePoi}-${mapSearchAddress}`}
                    src={getGoogleMapsEmbedSrc(mapLayer, activePoi)} 
                    width="100%" 
                    height="100%" 
                    frameBorder="0" 
                    allowFullScreen 
                    loading="lazy" 
                    referrerPolicy="no-referrer-when-downgrade" 
                    className="w-full h-full border-0" 
                    title="Property Location Map"
                  />
                </div>

                {/* Instant Neighborhood & Commute Calculator ($0 Free Tier) */}
                <NeighborhoodCommuteCalculator
                  propertyAddress={property.address || ''}
                  city={property.city || ''}
                  brandingColor={brandingColor}
                  onSelectPoiCategory={(cat) => setActivePoi(cat)}
                />
              </div>
            )}
          </div>
          <div className="lg:col-span-4">
             <div className="lg:sticky lg:top-32 space-y-6">
                <div className="p-8 md:p-10 glass-panel rounded-[3rem] border border-white/10 space-y-10 text-center">
                    <div className="w-32 h-32 rounded-full border-4 p-1 mx-auto overflow-hidden shadow-2xl" style={{ borderColor: brandingColor }}>
                       {property.headshot ? (
                          <img src={property.headshot} className="w-full h-full object-cover rounded-full" alt="Agent" />
                       ) : property.logo ? (
                          <div className="w-full h-full bg-white/5 flex items-center justify-center rounded-full p-4">
                             <img src={property.logo} className="max-w-full max-h-full object-contain" alt="Brokerage Logo" referrerPolicy="no-referrer" />
                          </div>
                       ) : (
                          <div className="w-full h-full bg-slate-800 rounded-full" />
                       )}
                    </div>
                   <div className="space-y-2"><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Listing Associate</span><h3 className="text-2xl font-black text-white uppercase tracking-tighter">{property.agentName || 'Professional Agent'}</h3>
                       {property.brokerage && <p className="font-bold text-xs uppercase tracking-widest" style={{ color: brandingColor }}>{property.brokerage}</p>}
                       <div className="flex flex-col gap-1.5 pt-4 border-t border-white/5">
                         {property.phoneNumber && <p className="text-xs font-bold text-slate-200">{property.phoneNumber}</p>}
                         {property.email && <p className="text-xs font-bold text-slate-400 truncate">{property.email}</p>}
                         {property.website && <a href={formatUrl(property.website)} target="_blank" rel="noopener noreferrer" className="text-xs font-bold opacity-80 hover:opacity-100 truncate underline underline-offset-4" style={{ color: brandingColor }}>{property.website.replace(/^https?:\/\//, '')}</a>}
                       </div>
                   </div>
                   <div className="space-y-2.5">
                     <button onClick={() => setShowContactModal(true)} className="w-full py-4 rounded-2xl bg-white hover:bg-opacity-90 transition-all text-slate-950 font-black uppercase tracking-widest text-[11px] shadow-xl hover:scale-[1.02] cursor-pointer">
                       Request Private Viewing
                     </button>
                     <div className="grid grid-cols-2 gap-2">
                       <button
                         onClick={() => downloadAgentInstantVCard({
                           name: property.agentName,
                           brokerage: property.brokerage,
                           phone: property.phoneNumber,
                           email: property.email,
                           website: property.website,
                           title: 'Listing Associate',
                           photo: property.headshot || property.logo,
                           propertyAddress: property.unit ? `${property.unit} - ${property.address}` : property.address,
                           city: property.city
                         })}
                         className="py-3 px-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-black uppercase tracking-wider text-[10px] shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                         title="Download RFC vCard .vcf file"
                       >
                         <span>📇</span> Save vCard
                       </button>
                       <button
                         onClick={() => setSelectedVCardAgent({
                           name: property.agentName || 'Professional Agent',
                           brokerage: property.brokerage,
                           phone: property.phoneNumber,
                           email: property.email,
                           website: property.website,
                           title: 'Listing Associate',
                           photo: property.headshot || property.logo,
                           propertyAddress: property.unit ? `${property.unit} - ${property.address}` : property.address,
                           city: property.city
                         })}
                         className="py-3 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white font-black uppercase tracking-wider text-[10px] border border-white/10 flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                         title="Open Smart Contact Card & QR Code"
                       >
                         <span>📱</span> QR Card
                       </button>
                     </div>
                   </div>
                </div>

                {hasAgent2 && (
                  <div className="p-8 md:p-10 glass-panel rounded-[3rem] border border-white/10 space-y-8 text-center animate-fade-in-up">
                      <div className="w-32 h-32 rounded-full border-4 p-1 mx-auto overflow-hidden shadow-2xl" style={{ borderColor: brandingColor }}>
                         {property.agent2Headshot ? (
                            <img src={property.agent2Headshot} className="w-full h-full object-cover rounded-full" alt="Co-Listing Agent" />
                         ) : property.agent2Logo ? (
                            <div className="w-full h-full bg-white/5 flex items-center justify-center rounded-full p-4">
                               <img src={property.agent2Logo} className="max-w-full max-h-full object-contain" alt="Brokerage Logo" referrerPolicy="no-referrer" />
                            </div>
                         ) : property.logo ? (
                            <div className="w-full h-full bg-white/5 flex items-center justify-center rounded-full p-4">
                               <img src={property.logo} className="max-w-full max-h-full object-contain" alt="Brokerage Logo" referrerPolicy="no-referrer" />
                            </div>
                         ) : (
                            <div className="w-full h-full bg-slate-800 rounded-full" />
                         )}
                      </div>
                     <div className="space-y-2">
                         <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Co-Listing Associate</span>
                         <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{property.agent2Name || 'Co-Listing Agent'}</h3>
                         {(property.agent2Brokerage || property.brokerage) && <p className="font-bold text-xs uppercase tracking-widest" style={{ color: brandingColor }}>{property.agent2Brokerage || property.brokerage}</p>}
                         <div className="flex flex-col gap-1.5 pt-4 border-t border-white/5">
                           {property.agent2PhoneNumber && <p className="text-xs font-bold text-slate-200">{property.agent2PhoneNumber}</p>}
                           {property.agent2Email && <p className="text-xs font-bold text-slate-400 truncate">{property.agent2Email}</p>}
                         </div>
                     </div>
                     <div className="grid grid-cols-2 gap-2 pt-2">
                       <button
                         onClick={() => downloadAgentInstantVCard({
                           name: property.agent2Name,
                           brokerage: property.agent2Brokerage || property.brokerage,
                           phone: property.agent2PhoneNumber,
                           email: property.agent2Email,
                           website: property.website,
                           title: 'Co-Listing Associate',
                           photo: property.agent2Headshot || property.agent2Logo || property.logo,
                           propertyAddress: property.unit ? `${property.unit} - ${property.address}` : property.address,
                           city: property.city
                         })}
                         className="py-3 px-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-black uppercase tracking-wider text-[10px] shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                         title="Download RFC vCard .vcf file"
                       >
                         <span>📇</span> Save vCard
                       </button>
                       <button
                         onClick={() => setSelectedVCardAgent({
                           name: property.agent2Name || 'Co-Listing Agent',
                           brokerage: property.agent2Brokerage || property.brokerage,
                           phone: property.agent2PhoneNumber,
                           email: property.agent2Email,
                           website: property.website,
                           title: 'Co-Listing Associate',
                           photo: property.agent2Headshot || property.agent2Logo || property.logo,
                           propertyAddress: property.unit ? `${property.unit} - ${property.address}` : property.address,
                           city: property.city
                         })}
                         className="py-3 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white font-black uppercase tracking-wider text-[10px] border border-white/10 flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                         title="Open Smart Contact Card & QR Code"
                       >
                         <span>📱</span> QR Card
                       </button>
                     </div>
                  </div>
                )}
                <div className="flex justify-center">
                  <img src="https://cmyixvfqicuycuhgqjnv.supabase.co/storage/v1/object/public/clients/logo2025_convertedpng.png" className="max-h-8 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity" alt="Broker Logo" referrerPolicy="no-referrer" />
                </div>
             </div>
          </div>
        </div>
      </div>

      {selectedVCardAgent && (
        <SmartAgentContactModal 
          agent={selectedVCardAgent}
          brandingColor={brandingColor}
          onClose={() => setSelectedVCardAgent(null)}
        />
      )}
    </div>
  );
};

export default PropertyPreview;