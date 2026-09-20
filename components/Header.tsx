import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

interface HeaderProps {
  onOpenAuthModal?: () => void;
  onOpenPricingModal?: () => void;
  onOpenDashboardModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAuthModal,
  onOpenPricingModal,
  onOpenDashboardModal
}) => {
  const { user, profile, isAdmin, isActualAdmin, clientPreviewMode, setClientPreviewMode, loading } = useAuth();
  const [engineInfo, setEngineInfo] = useState<{ label: string; isFal: boolean }>({
    label: 'Checking AI Engine...',
    isFal: false
  });

  useEffect(() => {
    fetch('/api/engine-status')
      .then(res => res.json())
      .then(data => {
        if (data?.hasFalKey) {
          setEngineInfo({
            label: 'FAL AI • Flux',
            isFal: true
          });
        } else {
          setEngineInfo({
            label: 'Gemini 3 Pro',
            isFal: false
          });
        }
      })
      .catch(() => {
        setEngineInfo({ label: 'Gemini 3 Pro', isFal: false });
      });
  }, []);

  return (
    <header className="sticky top-0 z-40 transition-all duration-300">
      <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-2xl border-b border-white/5 shadow-lg"></div>
      <div className="relative max-w-[1440px] mx-auto px-4 md:px-6 h-20 md:h-24 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 md:gap-4">
          {/* PMD Logo Recreation */}
          <div className="relative group cursor-default">
            <div className="absolute -inset-2 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
            <div className="relative w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-amber-500 via-orange-600 to-orange-700 shadow-lg shadow-orange-900/40 flex flex-col items-center justify-center border border-white/10 ring-1 ring-black/20 overflow-hidden transition-transform duration-300 group-hover:scale-105">
               <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
               <span className="text-white font-black text-base md:text-lg tracking-tighter leading-none z-10 drop-shadow-sm transform translate-y-[1px]" style={{ fontFamily: 'Arial, sans-serif' }}>PMD</span>
               <span className="text-white font-bold text-[0.26rem] md:text-[0.3rem] tracking-wide leading-none mt-0.5 opacity-90 z-10">DIGITAL MEDIA</span>
            </div>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-black tracking-wider uppercase text-white flex items-center gap-1.5">
              PMD Studio
              <span className="px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-400 text-[8px] font-bold tracking-widest border border-orange-500/30">
                PRO
              </span>
            </h1>
            <p className="text-[10px] text-slate-400">Automated Real Estate Visuals & Virtual Staging</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3">
           {/* Architecture Lock status */}
           <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 backdrop-blur-md rounded-full border border-orange-500/20 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-orange-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
              <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Architectural Lock Active</span>
           </div>
           
           {/* AI Engine Badge */}
           <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm ring-1 transition-all ${
             engineInfo.isFal 
               ? 'bg-purple-950/60 border-purple-500/40 text-purple-200 ring-purple-500/20' 
               : 'bg-slate-900/50 border-white/10 text-slate-400 ring-white/5'
           }`}>
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                engineInfo.isFal 
                  ? 'bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]' 
                  : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
              }`}></div>
              <span className="text-[10px] font-bold uppercase tracking-widest">{engineInfo.label}</span>
           </div>

           {/* User / Client Access & Credit Section */}
           {loading ? (
             <div className="w-24 h-9 bg-slate-800/50 rounded-full animate-pulse"></div>
           ) : user ? (
             <div className="flex items-center gap-2 md:gap-3">
                {/* Admin Mode / Client Preview Mode Switcher */}
                {isActualAdmin && (
                  <div className="flex items-center bg-slate-900/90 border border-white/10 p-0.5 rounded-full shadow-inner ring-1 ring-white/5">
                    <button
                      onClick={() => setClientPreviewMode(false)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        !clientPreviewMode 
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 shadow-md' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Admin Mode: Full workspace with Property Website builder and unlimited privileges"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${!clientPreviewMode ? 'bg-slate-950' : 'bg-slate-600'}`}></span>
                      <span>Admin View</span>
                    </button>
                    <button
                      onClick={() => setClientPreviewMode(true)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        clientPreviewMode 
                          ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-black shadow-md shadow-cyan-500/20' 
                          : 'text-slate-400 hover:text-cyan-300'
                      }`}
                      title="Client Preview: See PMD Studio as external clients and agents see it"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                      <span>Client Preview</span>
                    </button>
                  </div>
                )}

                {/* Credit balance badge */}
                <button
                  onClick={onOpenPricingModal}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 border transition-all text-xs cursor-pointer group ${
                    isAdmin 
                      ? 'border-slate-700 hover:border-orange-500/50' 
                      : 'border-cyan-500/40 hover:border-cyan-400 bg-cyan-950/30'
                  }`}
                  title="Click to top up credits"
                >
                  <span className={`w-2 h-2 rounded-full group-hover:scale-125 transition-transform ${
                    isAdmin ? 'bg-orange-400' : 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.7)]'
                  }`}></span>
                  <span className="font-black text-white">
                    {isAdmin ? '∞ Unlimited' : `${clientPreviewMode ? (profile?.credits === 999999 ? 300 : profile?.credits) : (profile?.credits ?? 0)}`}
                  </span>
                  <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Credits</span>
                  {!isAdmin && (
                    <span className="text-[10px] text-cyan-400 font-bold ml-0.5 group-hover:translate-x-0.5 transition-transform">+</span>
                  )}
                </button>

                {/* Profile avatar / dashboard trigger */}
                <button
                  onClick={onOpenDashboardModal}
                  className="flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-all text-xs cursor-pointer"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-slate-950 font-black text-[10px] shadow-sm ${
                    isAdmin 
                      ? 'bg-gradient-to-tr from-orange-500 to-amber-500' 
                      : 'bg-gradient-to-tr from-cyan-400 to-blue-500'
                  }`}>
                    {profile?.displayName?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="text-[11px] font-semibold text-slate-200 hidden sm:inline max-w-[100px] truncate">
                    {profile?.displayName?.split(' ')[0] || 'Account'}
                  </span>
                  <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${
                    isAdmin ? 'bg-purple-500/30 text-purple-300' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  }`}>
                    {isAdmin ? 'Admin' : clientPreviewMode ? 'Client (Preview)' : 'Client'}
                  </span>
                </button>
             </div>
           ) : (
             <div className="flex items-center gap-2">
                <button
                  onClick={onOpenPricingModal}
                  className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-cyan-300 hover:text-white border border-cyan-500/30 text-xs font-semibold transition-all cursor-pointer"
                >
                  <span>Pricing & Credits</span>
                </button>
                <button
                  onClick={onOpenAuthModal}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 text-xs font-black uppercase tracking-wider shadow-md hover:shadow-orange-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  <span>Sign In</span>
                </button>
             </div>
           )}
        </div>
      </div>
    </header>
  );
};
