import { PropertyData, ViewMode, ImageItem, SocialAssets } from '../types';
import { SAMPLE_PROPERTIES } from '../constants';
import Dashboard from './Dashboard';
import Editor from './Editor';
import PropertyPreview from './PropertyPreview';
import { assetStore } from '../utils/persistence';
import React, { useState, useEffect } from 'react';

const META_KEY = 'luxury_property_list';

// Safely serialize property metadata for IndexedDB storage without duplicating heavy binary data
const sanitizePropertiesForStorage = (props: PropertyData[]) => {
  return props.map(p => {
    const sanitizeField = (val: string | undefined | null) => {
      if (!val) return '';
      // Keep external web links, but avoid storing massive base64 or ephemeral blob URLs in metadata
      if (val.startsWith('http://') || val.startsWith('https://') || (val.startsWith('/') && !val.startsWith('//'))) {
        return val;
      }
      return '[stored_asset]';
    };

    return {
      ...p,
      headshot: sanitizeField(p.headshot),
      logo: sanitizeField(p.logo),
      agent2Headshot: sanitizeField(p.agent2Headshot),
      agent2Logo: sanitizeField(p.agent2Logo),
      floorPlan: sanitizeField(p.floorPlan),
      galleryImages: (p.galleryImages || []).map(img => sanitizeField(img)),
    };
  });
};

// Persist any binary image assets to the dedicated IndexedDB 'assets' store
const persistPropertyAssets = async (p: PropertyData) => {
  try {
    const tasks: Promise<any>[] = [];
    if (p.headshot && (p.headshot.startsWith('data:') || p.headshot.startsWith('blob:'))) {
      tasks.push(assetStore.save(`${p.id}-headshot`, p.headshot));
    }
    if (p.logo && (p.logo.startsWith('data:') || p.logo.startsWith('blob:'))) {
      tasks.push(assetStore.save(`${p.id}-logo`, p.logo));
    }
    if (p.agent2Headshot && (p.agent2Headshot.startsWith('data:') || p.agent2Headshot.startsWith('blob:'))) {
      tasks.push(assetStore.save(`${p.id}-agent2Headshot`, p.agent2Headshot));
    }
    if (p.agent2Logo && (p.agent2Logo.startsWith('data:') || p.agent2Logo.startsWith('blob:'))) {
      tasks.push(assetStore.save(`${p.id}-agent2Logo`, p.agent2Logo));
    }
    if (p.floorPlan && (p.floorPlan.startsWith('data:') || p.floorPlan.startsWith('blob:'))) {
      tasks.push(assetStore.save(`${p.id}-floorPlan`, p.floorPlan));
    }
    if (p.galleryImages && p.galleryImages.length > 0) {
      p.galleryImages.forEach((img, idx) => {
        if (img && (img.startsWith('data:') || img.startsWith('blob:'))) {
          tasks.push(assetStore.save(`${p.id}-gallery-${idx}`, img));
        }
      });
    }
    await Promise.all(tasks);
  } catch (err) {
    console.warn("Non-critical error persisting property assets:", err);
  }
};

interface CustomToolProps {
  studioItems: ImageItem[];
  socialAssets: SocialAssets;
  setSocialAssets: React.Dispatch<React.SetStateAction<SocialAssets>>;
  brandingColor: string;
  initialProperties?: PropertyData[];
  onPropertiesChange?: (props: PropertyData[]) => void;
}

export const CustomTool: React.FC<CustomToolProps> = ({ 
  studioItems, socialAssets, setSocialAssets, brandingColor, initialProperties, onPropertiesChange 
}) => {
  const [view, setView] = useState<ViewMode>('dashboard');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [localProperties, setLocalProperties] = useState<PropertyData[]>(initialProperties || []);
  const [currentProperty, setCurrentProperty] = useState<PropertyData | null>(null);

  const properties = initialProperties || localProperties;
  const setProperties = onPropertiesChange || setLocalProperties;

  // Sync initialProperties prop to local state if it changes externally (e.g. from Social Kit)
  useEffect(() => {
    if (initialProperties && initialProperties.length > 0) {
      setLocalProperties(initialProperties);
    }
  }, [initialProperties]);

  // HYDRATION: Load properties list and recreate blob URLs
  useEffect(() => {
    const hydrateAll = async () => {
      let list = await assetStore.getMetadata(META_KEY);
      if (!list) {
        const savedLegacy = localStorage.getItem('luxury_property_builder_v2_data');
        if (savedLegacy) { try { list = JSON.parse(savedLegacy); } catch (e) {} }
      }
      
      // Merge strategy: use stored data as base, but respect initialProperties from props
      const mergedList = list && Array.isArray(list) ? [...list] : [];
      if (initialProperties && initialProperties.length > 0) {
        initialProperties.forEach(p => {
          if (!mergedList.some(existing => existing.id === p.id)) {
            mergedList.unshift(p);
          }
        });
      }

      if (mergedList.length === 0) {
        mergedList.push(...SAMPLE_PROPERTIES);
      }

      const hydratedProperties = await Promise.all(mergedList.map(async (prop: PropertyData) => {
        const p = { ...prop };
        const hydrateField = async (id: string, field: string, currentVal?: string) => {
          try {
            const blob = await assetStore.get(`${id}-${field}`);
            if (blob) return URL.createObjectURL(blob);
            if (currentVal && currentVal !== '[stored_asset]') return currentVal;
            return '';
          } catch {
            return currentVal && currentVal !== '[stored_asset]' ? currentVal : '';
          }
        };

        p.headshot = await hydrateField(p.id, 'headshot', p.headshot);
        p.logo = await hydrateField(p.id, 'logo', p.logo);
        p.agent2Headshot = await hydrateField(p.id, 'agent2Headshot', p.agent2Headshot);
        p.agent2Logo = await hydrateField(p.id, 'agent2Logo', p.agent2Logo);
        p.floorPlan = await hydrateField(p.id, 'floorPlan', p.floorPlan);

        const gallery = await Promise.all((p.galleryImages || []).map(async (img, idx) => {
          try {
            const blob = await assetStore.get(`${p.id}-gallery-${idx}`);
            if (blob) return URL.createObjectURL(blob);
            if (img && img !== '[stored_asset]') return img;
            return null;
          } catch {
            return img && img !== '[stored_asset]' ? img : null;
          }
        }));
        const validGallery = gallery.filter(g => g !== null && g !== '') as string[];
        p.galleryImages = validGallery;
        return p;
      }));
      
      setProperties(hydratedProperties);
      setIsHydrating(false);
    };
    hydrateAll();
  }, []);

  useEffect(() => {
    if (isHydrating) return;
    const sync = async () => {
      try {
        // 1. Asynchronously persist any newly uploaded raw images into the binary store
        await Promise.all(properties.map(p => persistPropertyAssets(p)));
        // 2. Save clean, lightweight metadata record in IndexedDB (avoiding out of memory limits)
        const cleanMetadata = sanitizePropertiesForStorage(properties);
        await assetStore.saveMetadata(META_KEY, cleanMetadata);
        setLastSync(new Date());
      } catch (e) {
        console.warn("Storage sync notice:", e);
      }
    };
    sync();
  }, [properties, isHydrating]);

  const handleSelectProperty = (prop: PropertyData) => { setCurrentProperty(prop); setView('preview'); };
  const handleEditProperty = (prop: PropertyData) => { setCurrentProperty(prop); setView('editor'); };
  const handleNewProperty = (initialData?: Partial<PropertyData>) => { setCurrentProperty(initialData ? { id: Math.random().toString(36).substring(7), galleryImages: [], ...initialData } as PropertyData : null); setView('editor'); };
  const handleImport = (newProperties: PropertyData[]) => { setProperties([...newProperties, ...properties]); };
  
  const handleSave = (updatedProp: PropertyData) => { 
    setProperties(prev => { 
      const exists = prev.find(p => p.id === updatedProp.id); 
      if (exists) { 
        return prev.map(p => p.id === updatedProp.id ? updatedProp : p); 
      } 
      return [updatedProp, ...prev]; 
    }); 
    setCurrentProperty(updatedProp); 
    setView('preview'); 
  };

  const handleClearAll = () => { 
    if (window.confirm("Are you sure?")) { 
      setProperties([]); 
      localStorage.removeItem('luxury_property_builder_v2_data'); 
      assetStore.clear(); 
    } 
  };

  if (isHydrating) { 
    return ( 
      <div className="min-h-[60vh] flex flex-col items-center justify-center"> 
        <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mb-4"></div> 
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Accessing Secure Vault...</p> 
      </div> 
    ); 
  }

  return (
    <div className="max-w-[1440px] mx-auto w-full selection:bg-orange-500/20">
      {view === 'dashboard' && (
        <div className="relative min-h-[60vh]">
          {properties.length > 0 && ( 
            <button onClick={handleClearAll} className="absolute top-8 right-4 md:right-8 text-slate-500 hover:text-red-400 text-[10px] md:text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2 z-10"> 
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg> Clear Library 
            </button> 
          )}
          <Dashboard properties={properties} onSelect={handleSelectProperty} onEdit={handleEditProperty} onImport={handleImport} onNew={handleNewProperty} />
          {lastSync && ( 
            <div className="fixed bottom-24 left-4 flex items-center gap-2 text-[10px] font-bold text-slate-500 bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-full border border-white/5 shadow-xl z-50"> 
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></div> Database Permanent • {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
            </div> 
          )}
        </div>
      )}
      {view === 'editor' && ( 
        <Editor property={currentProperty} onSave={handleSave} onCancel={() => setView('dashboard')} studioItems={studioItems} socialAssets={socialAssets} setSocialAssets={setSocialAssets} /> 
      )}
      {view === 'preview' && currentProperty && (
        <div className="relative">
          <div className="fixed top-28 left-10 z-[100] flex gap-2">
            <button onClick={() => setView('dashboard')} className="bg-white/10 backdrop-blur-md text-white px-5 py-2 rounded-xl shadow-2xl hover:bg-white/20 transition-all font-bold flex items-center gap-2 border border-white/10 text-[9px] uppercase tracking-widest"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>Hub</button>
            <button onClick={() => setView('editor')} className="bg-white/10 backdrop-blur-md text-white px-5 py-2 rounded-xl shadow-2xl hover:bg-white/20 transition-all font-bold flex items-center gap-2 border border-white/10 text-[9px] uppercase tracking-widest"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487l1.687-1.688a1.875 1.151 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>Edit</button>
          </div>
          <PropertyPreview property={currentProperty} brandingColor={brandingColor} />
        </div>
      )}
    </div>
  );
};

export default CustomTool;
