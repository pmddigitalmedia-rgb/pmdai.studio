
import React, { useState, useMemo } from 'react';
import { PropertyData } from '../types';

interface DashboardProps {
  properties: PropertyData[];
  onSelect: (prop: PropertyData) => void;
  onEdit: (prop: PropertyData) => void;
  onImport: (props: PropertyData[]) => void;
  onNew: (initialData?: Partial<PropertyData>) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ properties, onSelect, onEdit, onNew }) => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return properties.filter(p => 
      p.address?.toLowerCase().includes(search.toLowerCase()) ||
      p.city?.toLowerCase().includes(search.toLowerCase()) ||
      p.agentName?.toLowerCase().includes(search.toLowerCase()) ||
      p.unit?.toLowerCase().includes(search.toLowerCase())
    );
  }, [properties, search]);

  return (
    <div className="p-4 sm:p-8 space-y-10 animate-fade-in-up">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-900/20">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white"><path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.06 1.06l8.69-8.69z" /><path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" /></svg>
             </div>
             <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Property Websites</h1>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] ml-1">Archive and showcase luxury inventory</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
           <div className="hidden sm:flex flex-col items-end pr-4 border-r border-white/5">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none">Total Inventory</span>
              <span className="text-xl font-black text-white">{properties.length}</span>
           </div>
           <button onClick={() => onNew()} className="px-8 py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-orange-900/20 active:scale-95">
              + New Property
           </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-xl group">
        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
          <svg className="w-5 h-5 text-slate-500 group-focus-within:text-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <input 
          type="text" 
          placeholder="Search by address, city, unit or agent..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-sm font-medium text-white placeholder-slate-600 focus:ring-2 focus:ring-orange-500 outline-none transition-all shadow-inner"
        />
      </div>

      {/* Property Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filtered.length > 0 ? (
          filtered.map(prop => (
            <div key={prop.id} className="group relative flex flex-col glass-panel rounded-3xl border border-white/5 overflow-hidden transition-all duration-500 hover:border-orange-500/40 hover:-translate-y-1 hover:shadow-2xl hover:shadow-orange-900/10">
              <div className="aspect-[4/3] relative bg-slate-800 overflow-hidden cursor-pointer" onClick={() => onSelect(prop)}>
                {prop.galleryImages?.[0] ? (
                  <img src={prop.galleryImages[0]} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={prop.address} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-700">
                    <svg className="w-12 h-12 opacity-30" fill="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  </div>
                )}
                {/* Overlay Badge */}
                <div className="absolute top-4 left-4 px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-[9px] font-black text-white uppercase tracking-[0.2em] shadow-lg">
                  {prop.city || "MALIBU"}
                </div>
              </div>

              <div className="p-6 flex flex-col gap-4">
                <div className="space-y-1 min-w-0">
                  <h3 className="font-black text-white text-xl uppercase tracking-tighter truncate group-hover:text-orange-400 transition-colors">
                    {prop.unit ? `${prop.unit} - ` : ''}{prop.address || 'Unnamed Estate'}
                  </h3>
                  <div className="flex items-center justify-between">
                    <span className="text-orange-500 font-bold text-sm tracking-tight">{prop.price || '$ --,---,---'}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{prop.agentName || 'Agent TBD'}</span>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2 border-t border-white/5">
                  <button onClick={() => onSelect(prop)} className="flex-[2] py-3 bg-slate-800 hover:bg-white hover:text-slate-950 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95">
                    Launch Site
                  </button>
                  <button onClick={() => onEdit(prop)} className="flex-1 py-3 border border-white/10 hover:bg-orange-600 hover:border-orange-600 hover:text-white text-orange-500 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-95">
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-32 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[3rem] opacity-30 text-center space-y-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-20 h-20"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" /></svg>
            <p className="text-xs font-black uppercase tracking-[0.4em] text-slate-400">No properties found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
