import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { CREDIT_PACKS } from '../constants';
import { CreditPack } from '../types';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuthModal?: () => void;
}

export const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose, onOpenAuthModal }) => {
  const { user, profile, addCredits, isAdmin, clientPreviewMode } = useAuth();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [stripeStatus, setStripeStatus] = useState<{
    configured: boolean;
    isTestMode: boolean;
    publishableKey?: string;
  }>({
    configured: false,
    isTestMode: true
  });
  const [checkingStripe, setCheckingStripe] = useState<boolean>(true);

  // Check Stripe configuration on backend
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setCheckingStripe(true);

    fetch('/api/stripe/status')
      .then(res => res.json())
      .then(data => {
        if (isMounted) {
          setStripeStatus({
            configured: Boolean(data.configured),
            isTestMode: Boolean(data.isTestMode),
            publishableKey: data.publishableKey
          });
          setCheckingStripe(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setStripeStatus({ configured: false, isTestMode: true });
          setCheckingStripe(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Real Stripe Checkout redirect
  const handleStripeCheckout = async (pack: CreditPack) => {
    setErrorNotice(null);

    if (!user) {
      if (onOpenAuthModal) {
        onClose();
        onOpenAuthModal();
      } else {
        setErrorNotice("Please sign in or create an account before purchasing credits.");
      }
      return;
    }

    setPurchasing(pack.id);

    try {
      // If a direct Stripe Payment Link is defined (e.g. https://buy.stripe.com/...), redirect immediately!
      if (pack.stripePaymentLink) {
        // Append user email and client reference ID if available for tracking
        const url = new URL(pack.stripePaymentLink);
        if (user.email) {
          url.searchParams.set('prefilled_email', user.email);
        }
        url.searchParams.set('client_reference_id', user.uid);
        window.location.href = url.toString();
        return;
      }

      if (!stripeStatus.configured) {
        // Fallback if Stripe key is not configured in environment
        setErrorNotice(
          `Stripe key not detected in server environment. Use 'Instant Sandbox Top-Up' below or add STRIPE_SECRET_KEY to Settings > Secrets.`
        );
        setPurchasing(null);
        return;
      }

      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packId: pack.id,
          userId: user.uid,
          userEmail: user.email,
          returnUrl: window.location.href
        })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to initialize Stripe checkout session");
      }

      if (data.url) {
        // Redirect directly to Stripe hosted checkout
        window.location.href = data.url;
      } else {
        throw new Error("No checkout redirect URL received from Stripe.");
      }
    } catch (err: any) {
      console.error("[Stripe Checkout Error]", err);
      setErrorNotice(err.message || "Failed to initiate Stripe checkout. Please try again.");
      setPurchasing(null);
    }
  };

  // Sandbox / Preview Instant Credit Top-Up
  const handleSimulatePurchase = async (pack: CreditPack) => {
    setErrorNotice(null);
    if (!user) {
      if (onOpenAuthModal) {
        onClose();
        onOpenAuthModal();
      } else {
        setErrorNotice("Please sign in or create an account first.");
      }
      return;
    }

    setPurchasing(`sandbox_${pack.id}`);
    try {
      await new Promise(r => setTimeout(r, 600));
      await addCredits(pack.credits, `Sandbox Top-Up: ${pack.name} (${pack.credits.toLocaleString()} Credits)`);
      setSuccessNotice(`🎉 Successfully credited ${pack.credits.toLocaleString()} credits to your account!`);
      setTimeout(() => {
        setSuccessNotice(null);
      }, 5000);
    } catch (err: any) {
      setErrorNotice("Credit grant failed: " + err.message);
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div 
      id="pricing-modal-overlay"
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div 
        id="pricing-modal-container"
        className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl text-slate-100 max-h-[92vh] overflow-y-auto"
      >
        {/* Close Button */}
        <button
          id="pricing-modal-close-btn"
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer z-10"
          aria-label="Close pricing modal"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="text-center max-w-xl mx-auto mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-wider shadow-[0_0_12px_rgba(6,182,212,0.15)]">
              <span>💳 Instant Credit Replenishment</span>
            </div>

            {stripeStatus.configured ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Stripe Active {stripeStatus.isTestMode && '(Test Mode)'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                Sandbox / Preview Mode
              </span>
            )}
          </div>

          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white">
            Choose Your Credit Pack
          </h2>
          <p className="text-xs md:text-sm text-slate-400 mt-2">
            Never expire. Credits power automated virtual staging, sunny skies, de clutter, 360 restyling, and cinematic AI video reels.
          </p>

          <div className="mt-3.5 flex items-center justify-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              🎁 New Accounts: 300 Complimentary Credits (~10 Free Edits)
            </span>
            {profile && (
              <div className="px-3 py-1 bg-slate-800/90 rounded-full text-xs text-slate-300 font-semibold border border-slate-700 flex items-center gap-1.5">
                <span className="text-slate-400">Current Balance:</span>
                <span className="text-cyan-400 font-bold font-mono">
                  {isAdmin ? '∞ Unlimited (Admin)' : `${profile.credits.toLocaleString()} credits`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Success Alert */}
        {successNotice && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-sm flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <svg className="w-5 h-5 shrink-0 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              <span>{successNotice}</span>
            </div>
            <button onClick={() => setSuccessNotice(null)} className="text-emerald-400 hover:text-white text-xs font-bold">✕</button>
          </div>
        )}

        {/* Error Alert */}
        {errorNotice && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-sm flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <svg className="w-5 h-5 shrink-0 text-rose-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <span>{errorNotice}</span>
            </div>
            <button onClick={() => setErrorNotice(null)} className="text-rose-400 hover:text-white text-xs font-bold">✕</button>
          </div>
        )}

        {/* Not Signed In Notice */}
        {!user && (
          <div className="mb-6 p-3.5 rounded-2xl bg-amber-950/50 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-base">🔐</span>
              <span>You are currently browsing as a guest. Sign in to link purchased credits to your permanent account.</span>
            </div>
            {onOpenAuthModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAuthModal();
                }}
                className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] uppercase tracking-wider shrink-0 transition-colors cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        )}

        {/* Credit Packs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CREDIT_PACKS.map((pack) => {
            const isStripeLoading = purchasing === pack.id;
            const isSandboxLoading = purchasing === `sandbox_${pack.id}`;

            return (
              <div
                key={pack.id}
                id={`pricing-card-${pack.id}`}
                className={`relative flex flex-col justify-between rounded-3xl p-6 transition-all ${
                  pack.popular
                    ? 'bg-gradient-to-b from-slate-850 to-slate-900 border-2 border-cyan-500 shadow-xl shadow-cyan-500/10'
                    : 'bg-slate-950/70 border border-slate-800 hover:border-slate-700'
                }`}
              >
                {pack.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 text-[10px] font-black uppercase tracking-wider text-slate-950 shadow-md">
                    Most Popular
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-black text-white">{pack.name}</h3>
                  <p className="text-[11px] text-slate-400 mt-1 min-h-[32px] leading-relaxed">{pack.description}</p>

                  <div className="my-6">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl md:text-4xl font-black text-white">{pack.price}</span>
                      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">CAD</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-xs font-bold text-cyan-400">
                        {pack.credits.toLocaleString()} Credits
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                        {pack.photoEdits}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Effective rate: <span className="text-slate-200 font-mono font-bold">{pack.unitPrice}</span>
                    </div>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-300 border-t border-slate-800/80 pt-4 mb-6">
                    {(pack.features || [
                      'Virtual Staging & Style Swap (30-60 credits)',
                      'Sunny Skies & De Clutter (30 credits)',
                      '360 Panoramic Virtual Staging (90 credits)',
                      'AI Video Reels & Transformations (90 credits)'
                    ]).map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-2">
                        <svg className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        <span className="leading-tight">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2 mt-auto">
                  {/* Primary Stripe Checkout Action */}
                  <button
                    type="button"
                    id={`buy-stripe-btn-${pack.id}`}
                    onClick={() => {
                      if (pack.stripePaymentLink || stripeStatus.configured) {
                        handleStripeCheckout(pack);
                      } else {
                        // If Stripe isn't configured, offer sandbox top-up
                        handleSimulatePurchase(pack);
                      }
                    }}
                    disabled={isStripeLoading || isSandboxLoading}
                    className={`w-full py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 ${
                      pack.popular
                        ? 'bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 shadow-cyan-500/20'
                        : 'bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    {isStripeLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                        <span>Connecting to Stripe...</span>
                      </>
                    ) : (pack.stripePaymentLink || stripeStatus.configured) ? (
                      <>
                        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                          <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697.5 12.515.5 5.538.5 2.1 4.148 2.1 9.42c0 4.908 3.018 7.373 7.848 9.176 2.457.917 3.298 1.574 3.298 2.527 0 .963-.82 1.487-2.28 1.487-2.25 0-5.184-1.077-7.227-2.19l-.916 5.618C4.54 27.24 7.697 28 11.233 28c7.433 0 10.87-3.648 10.87-9.42 0-5.074-3.033-7.533-8.127-9.43z"/>
                        </svg>
                        <span>Add {pack.credits.toLocaleString()} Credits ({pack.price})</span>
                      </>
                    ) : (
                      <>
                        <span>Add {pack.credits.toLocaleString()} Credits (Instant)</span>
                      </>
                    )}
                  </button>

                  {/* Secondary Instant Sandbox Top-up (available for dev testing / preview mode) */}
                  {(pack.stripePaymentLink || stripeStatus.configured) && (
                    <button
                      type="button"
                      id={`simulate-btn-${pack.id}`}
                      onClick={() => handleSimulatePurchase(pack)}
                      disabled={isStripeLoading || isSandboxLoading}
                      className="w-full py-1.5 px-3 rounded-lg font-semibold text-[10px] text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors cursor-pointer border border-transparent hover:border-slate-800"
                      title="Test adding credits instantly without charging a card"
                    >
                      {isSandboxLoading ? 'Granting Test Credits...' : '⚡ Instant Test Top-Up (Sandbox)'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer / Trust Badges */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              <span>256-Bit SSL Encrypted</span>
            </div>
            <span className="text-slate-600">•</span>
            <span className="text-slate-300">Accepted: Visa, Mastercard, AMEX, Apple Pay, Google Pay</span>
          </div>

          <div className="text-[11px] text-slate-500">
            Need custom brokerage API volume? Contact <a href="mailto:support@pmddigitalmedia.com" className="text-slate-400 hover:text-cyan-400 underline">support@pmddigitalmedia.com</a>
          </div>
        </div>
      </div>
    </div>
  );
};
