import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

interface ClientDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPricing: () => void;
}

export const ClientDashboardModal: React.FC<ClientDashboardModalProps> = ({ isOpen, onClose, onOpenPricing }) => {
  const { user, profile, signOut, isAdmin, isActualAdmin, clientPreviewMode, setClientPreviewMode } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  useEffect(() => {
    if (!isOpen || !user) return;
    const fetchTransactions = async () => {
      setLoadingTx(true);
      try {
        const txRef = collection(db, 'users', user.uid, 'transactions');
        const q = query(txRef, orderBy('timestamp', 'desc'), limit(15));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setTransactions(list);
      } catch (e: any) {
        console.warn("Notice: Transactions not loaded or initialized:", e?.message || e);
        setTransactions([]);
      } finally {
        setLoadingTx(false);
      }
    };
    fetchTransactions();
  }, [isOpen, user]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
        >
          ✕
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-slate-950 font-black text-xl shadow-lg ${
            isAdmin 
              ? 'bg-gradient-to-tr from-orange-500 to-amber-500 shadow-orange-500/20' 
              : 'bg-gradient-to-tr from-cyan-400 to-blue-500 shadow-cyan-500/20'
          }`}>
            {profile?.displayName?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">{profile?.displayName || 'User Profile'}</h2>
              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                isAdmin 
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                  : clientPreviewMode
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              }`}>
                {isAdmin ? 'ADMINISTRATOR' : clientPreviewMode ? 'CLIENT (PREVIEW)' : 'CLIENT'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{profile?.email}</p>
          </div>
        </div>

        {/* Admin Quick Switcher Banner */}
        {isActualAdmin && (
          <div className="mb-6 p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>View Mode:</span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                  clientPreviewMode 
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' 
                    : 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                }`}>
                  {clientPreviewMode ? 'Client Preview Active' : 'Admin Mode'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {clientPreviewMode 
                  ? 'Previewing what clients see when managing their account and purchasing credits.' 
                  : 'Full administrator account with unrestricted tools.'}
              </p>
            </div>
            <button
              onClick={() => setClientPreviewMode(!clientPreviewMode)}
              className={`px-3.5 py-1.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all cursor-pointer ${
                clientPreviewMode
                  ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-md'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md'
              }`}
            >
              {clientPreviewMode ? 'Switch to Admin View' : 'Preview Client View'}
            </button>
          </div>
        )}

        {/* Credit Card Overview */}
        <div className={`p-5 rounded-2xl bg-gradient-to-r from-slate-950 to-slate-900 border flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 ${
          isAdmin ? 'border-slate-800' : 'border-cyan-500/25 shadow-lg shadow-cyan-950/30'
        }`}>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Available Credit Balance</div>
            <div className={`text-3xl font-black mt-1 ${isAdmin ? 'text-orange-400' : 'text-cyan-400'}`}>
              {isAdmin ? 'Unlimited' : (clientPreviewMode && profile?.credits === 999999 ? '300' : (profile?.credits?.toLocaleString() ?? 0))}
              <span className="text-xs font-normal text-slate-400 ml-1.5">credits</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {isAdmin 
                ? 'Admin bypass enabled (Zero credit restriction)' 
                : '30-60 credits per standard edit, 90 credits per 360 panorama or video'}
            </div>
          </div>

          <button
            onClick={() => {
              onClose();
              onOpenPricing();
            }}
            className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg active:scale-[0.98] transition-all cursor-pointer shrink-0 text-slate-950 ${
              isAdmin
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-orange-500/20'
                : 'bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 shadow-cyan-500/20'
            }`}
          >
            + Add Credits
          </button>
        </div>

        {/* Usage History */}
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
            Recent Credit Activity
          </h3>

          {loadingTx ? (
            <div className="text-center py-6 text-slate-500 text-xs">Loading activity...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 bg-slate-950/40 rounded-xl border border-slate-800/60 text-xs text-slate-500">
              No recent credit transactions found.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {transactions.map((tx) => (
                <div key={tx.id} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-200">{tx.description || 'AI Edit'}</div>
                    <div className="text-[10px] text-slate-500">{new Date(tx.timestamp).toLocaleString()}</div>
                  </div>
                  <div className={`font-black ${tx.amount > 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount} credits
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-8 pt-4 border-t border-slate-800 flex justify-between items-center">
          <button
            onClick={async () => {
              await signOut();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            Sign Out
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-400 text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
