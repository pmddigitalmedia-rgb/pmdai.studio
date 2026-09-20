import React, { useState } from 'react';
import {
  TokenGuardSettings,
  tokenToDollar,
  tokenToDollarString,
  formatTokens,
  saveTokenGuardSettings
} from '../utils/tokenGuard';

interface TokenGuardModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: TokenGuardSettings;
  onUpdateSettings: (newSettings: TokenGuardSettings) => void;
  batchEstimatedTokens?: number;
  onConfirmOverrideAndRun?: () => void;
  mode?: 'interception' | 'settings';
}

const PRESET_LIMITS = [
  { label: 'CA$5', tokens: 62500 },
  { label: 'CA$10', tokens: 125000 },
  { label: 'CA$25', tokens: 312500 },
  { label: 'CA$50', tokens: 625000 },
  { label: 'CA$100', tokens: 1250000 },
];

export const TokenGuardModal: React.FC<TokenGuardModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  batchEstimatedTokens = 0,
  onConfirmOverrideAndRun,
  mode = 'settings'
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'control' | 'history'>('control');
  const [customTokenInput, setCustomTokenInput] = useState<string>(String(settings.dailyLimit));

  const used = settings.usedToday || 0;
  const limit = settings.dailyLimit || 125000;
  const projectedTotal = used + batchEstimatedTokens;
  const isOverLimit = settings.enabled && !settings.overriddenToday && projectedTotal > limit;
  
  const currentPct = Math.min(100, Math.round((used / limit) * 100));
  const projectedPct = Math.min(100, Math.round((projectedTotal / limit) * 100));

  const handleToggleEnabled = () => {
    const updated: TokenGuardSettings = {
      ...settings,
      enabled: !settings.enabled
    };
    saveTokenGuardSettings(updated);
    onUpdateSettings(updated);
  };

  const handleToggleOverride = () => {
    const updated: TokenGuardSettings = {
      ...settings,
      overriddenToday: !settings.overriddenToday
    };
    saveTokenGuardSettings(updated);
    onUpdateSettings(updated);
  };

  const handleSetPresetLimit = (tokens: number) => {
    const updated: TokenGuardSettings = {
      ...settings,
      dailyLimit: tokens
    };
    setCustomTokenInput(String(tokens));
    saveTokenGuardSettings(updated);
    onUpdateSettings(updated);
  };

  const handleCustomLimitChange = (val: string) => {
    setCustomTokenInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      const updated: TokenGuardSettings = {
        ...settings,
        dailyLimit: num
      };
      saveTokenGuardSettings(updated);
      onUpdateSettings(updated);
    }
  };

  const handleResetToday = () => {
    const updated: TokenGuardSettings = {
      ...settings,
      usedToday: 0,
      overriddenToday: false
    };
    saveTokenGuardSettings(updated);
    onUpdateSettings(updated);
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in text-center">
      <div className="relative w-full max-w-xl bg-slate-900 border border-white/10 rounded-[2rem] shadow-2xl p-6 md:p-8 overflow-hidden max-h-[90vh] overflow-y-auto">
        
        {/* Glow backdrop */}
        <div className={`absolute top-0 right-0 -translate-y-12 translate-x-12 w-64 h-64 rounded-full blur-3xl pointer-events-none ${isOverLimit ? 'bg-rose-500/15' : 'bg-orange-500/10'}`} />
        <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-start justify-between mb-5">
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                isOverLimit 
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-400' 
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}>
                {mode === 'interception' ? '🛡️ Daily Token Safety Cap' : '💎 Token Spend & Safety Guard'}
              </span>
              {settings.overriddenToday && (
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 animate-pulse">
                  ⚡ Busy Day Override Active
                </span>
              )}
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white mt-2.5 tracking-tight">
              {mode === 'interception' ? 'Daily Token Limit Reached' : 'Daily Token Budget & Override'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {mode === 'interception' 
                ? 'This batch will exceed your daily token safety cap. You can override it for today or increase the limit.' 
                : 'Protect against accidental billing spikes by capping daily API tokens, with instant 1-click busy day overrides.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Real-Time Spend Meter */}
        <div className="relative bg-slate-950/70 border border-white/5 rounded-2xl p-4 text-left space-y-3 mb-5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">Today's Consumption ({settings.lastActiveDate})</span>
            <span className="font-mono font-bold text-slate-200">
              {formatTokens(used)} / {formatTokens(limit)} tokens ({tokenToDollarString(used)} / {tokenToDollarString(limit)})
            </span>
          </div>

          {/* Progress Bar */}
          <div className="relative w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-white/5">
            <div
              className={`h-full transition-all duration-500 ${
                currentPct >= 100
                  ? 'bg-rose-500'
                  : currentPct >= 80
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${currentPct}%` }}
            />
            {batchEstimatedTokens > 0 && (
              <div
                className="absolute top-0 bottom-0 bg-orange-400/50 animate-pulse border-l border-white/40"
                style={{
                  left: `${currentPct}%`,
                  width: `${Math.min(100 - currentPct, Math.round((batchEstimatedTokens / limit) * 100))}%`
                }}
              />
            )}
          </div>

          {batchEstimatedTokens > 0 && (
            <div className="flex justify-between items-center text-[10px] text-orange-300 bg-orange-950/30 border border-orange-500/20 px-3 py-1.5 rounded-lg">
              <span>Queued Batch Requirement:</span>
              <span className="font-mono font-bold">+{formatTokens(batchEstimatedTokens)} tokens (~{tokenToDollarString(batchEstimatedTokens)})</span>
            </div>
          )}
        </div>

        {/* Tab Buttons if in settings mode */}
        {mode === 'settings' && (
          <div className="flex gap-2 border-b border-white/10 pb-3 mb-5">
            <button
              onClick={() => setActiveTab('control')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === 'control'
                  ? 'bg-orange-600 text-white shadow-lg'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Limits & Overrides
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === 'history'
                  ? 'bg-orange-600 text-white shadow-lg'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Today's Activity Log ({settings.history?.length || 0})
            </button>
          </div>
        )}

        {/* Interception Specific Actions */}
        {mode === 'interception' && (
          <div className="space-y-4 mb-6">
            <div className="p-4 bg-rose-950/30 border border-rose-500/30 rounded-2xl text-left space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                Safety Cap Engaged
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Your daily limit is set to <strong className="text-white">{formatTokens(limit)} tokens ({tokenToDollarString(limit)})</strong>. Running this batch will bring total daily usage to <strong className="text-amber-300">{formatTokens(projectedTotal)} tokens (~{tokenToDollarString(projectedTotal)})</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {onConfirmOverrideAndRun && (
                <button
                  onClick={() => {
                    const updated: TokenGuardSettings = {
                      ...settings,
                      overriddenToday: true
                    };
                    saveTokenGuardSettings(updated);
                    onUpdateSettings(updated);
                    onConfirmOverrideAndRun();
                  }}
                  className="w-full py-4 px-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black uppercase text-xs tracking-wider rounded-xl shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                >
                  <span>⚡ Override for Today & Run Batch</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full py-4 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase text-xs tracking-wider rounded-xl transition-all"
              >
                Cancel Batch
              </button>
            </div>
          </div>
        )}

        {/* Settings Tab: Control */}
        {(mode === 'settings' && activeTab === 'control') || mode === 'interception' ? (
          <div className="space-y-5 text-left border-t border-white/5 pt-5">
            
            {/* Quick Busy Day Override Toggle */}
            <div className="flex items-center justify-between bg-slate-950/50 border border-white/5 rounded-2xl p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-white">Busy Day Override</h4>
                  {settings.overriddenToday && (
                    <span className="text-[8px] font-black text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded uppercase">Active Today</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">
                  Allow unlimited processing for today without safety blocks. Automatically turns off at midnight.
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleOverride}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.overriddenToday ? 'bg-amber-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.overriddenToday ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Daily Safety Cap Enable Toggle */}
            <div className="flex items-center justify-between bg-slate-950/50 border border-white/5 rounded-2xl p-4">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-white">Daily Token Safety Cap</h4>
                <p className="text-[10px] text-slate-400">
                  Intercepts and warns before batches that would exceed your daily token budget.
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleEnabled}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.enabled ? 'bg-emerald-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Limit Selection Preset Chips */}
            <div className="space-y-2.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                Select Daily Safety Budget
              </label>
              <div className="grid grid-cols-5 gap-2">
                {PRESET_LIMITS.map(preset => {
                  const isSelected = settings.dailyLimit === preset.tokens;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleSetPresetLimit(preset.tokens)}
                      className={`p-2.5 rounded-xl text-center border transition-all ${
                        isSelected
                          ? 'bg-orange-600/20 border-orange-500 text-white font-bold shadow-md'
                          : 'bg-slate-950 border-white/5 text-slate-400 hover:text-white hover:border-white/10'
                      }`}
                    >
                      <div className="text-xs font-black">{preset.label}</div>
                      <div className="text-[8px] text-slate-400">{(preset.tokens / 1000).toFixed(0)}k tkn</div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Input */}
              <div className="flex items-center gap-3 pt-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Custom Tokens:</span>
                <input
                  type="number"
                  value={customTokenInput}
                  onChange={(e) => handleCustomLimitChange(e.target.value)}
                  placeholder="125000"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:ring-1 focus:ring-orange-500"
                />
                <span className="text-xs font-mono text-emerald-400">
                  ≈ {tokenToDollarString(parseInt(customTokenInput, 10) || 0)}
                </span>
              </div>
            </div>

            {/* Reset Today Counter */}
            <div className="flex justify-between items-center pt-2 border-t border-white/5">
              <span className="text-[10px] text-slate-500">Need to start fresh for testing?</span>
              <button
                type="button"
                onClick={handleResetToday}
                className="text-[9px] font-bold uppercase tracking-wider text-slate-400 hover:text-red-400 transition-colors"
              >
                Reset Today's Counter
              </button>
            </div>
          </div>
        ) : null}

        {/* History Tab */}
        {mode === 'settings' && activeTab === 'history' && (
          <div className="space-y-2 text-left max-h-60 overflow-y-auto scrollbar-thin">
            {(!settings.history || settings.history.length === 0) ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No tool executions recorded today yet.
              </div>
            ) : (
              settings.history.slice().reverse().map(rec => (
                <div key={rec.id} className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-white/5 rounded-xl text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-200 block text-[11px]">{rec.toolLabel}</span>
                    <span className="text-[9px] text-slate-500">
                      {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-orange-400 font-bold text-[11px]">+{formatTokens(rec.tokens)} tkn</span>
                    <span className="text-[9px] text-slate-400 block">~${rec.estimatedCost.toFixed(4)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer */}
        {mode === 'settings' && (
          <div className="mt-6 pt-4 border-t border-white/5">
            <button
              onClick={onClose}
              className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold uppercase text-[10px] tracking-widest rounded-xl transition-all"
            >
              Done
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
