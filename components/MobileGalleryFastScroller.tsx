import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ImageItem } from '../types';

interface MobileGalleryFastScrollerProps {
  items: ImageItem[];
  activeItemId: string | null;
  onItemSelect?: (id: string) => void;
  isGridView?: boolean;
}

export const MobileGalleryFastScroller: React.FC<MobileGalleryFastScrollerProps> = ({
  items,
  activeItemId,
  onItemSelect,
  isGridView = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0); // 0 to 1
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [showThumbStrip, setShowThumbStrip] = useState(false);
  
  const railRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  // Keep ref in sync
  isDraggingRef.current = isDragging;

  const total = items.length;

  // Scroll to a specific item by index
  const scrollToItemIndex = useCallback((index: number, smooth = false) => {
    if (items.length === 0) return;
    const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
    setCurrentIndex(clampedIndex);
    
    const targetItem = items[clampedIndex];
    if (!targetItem) return;

    const el = document.getElementById(`image-item-${targetItem.id}`);
    if (el) {
      const galleryContainer = document.getElementById('gallery-grid-container');
      if (galleryContainer && galleryContainer.scrollHeight > galleryContainer.clientHeight) {
        const containerTop = galleryContainer.getBoundingClientRect().top;
        const elementTop = el.getBoundingClientRect().top;
        const currentScroll = galleryContainer.scrollTop;
        const targetScroll = currentScroll + (elementTop - containerTop) - 10;
        galleryContainer.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: smooth ? 'smooth' : 'auto'
        });
      } else {
        const headerOffset = 180; // sticky header + sort bar height
        const elementPosition = el.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: Math.max(0, offsetPosition),
          behavior: smooth ? 'smooth' : 'auto'
        });
      }
    }

    if (navigator.vibrate && isDraggingRef.current) {
      navigator.vibrate(5);
    }
  }, [items]);

  // Update progress based on window or gallery scroll position
  useEffect(() => {
    const handleScroll = () => {
      if (isDraggingRef.current || items.length === 0) return;

      const galleryEl = document.getElementById('gallery-grid-container');
      if (!galleryEl) return;

      const rect = galleryEl.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Show scroller when gallery is in view
      const inView = rect.top < viewportHeight && rect.bottom > 0;
      setIsVisible(inView && items.length > 2);

      const isContainerScroll = galleryEl.scrollHeight > galleryEl.clientHeight;
      const centerY = isContainerScroll ? (rect.top + rect.height / 2) : (viewportHeight / 2);

      // Find the item currently closest to center
      let closestIdx = 0;
      let minDistance = Infinity;

      items.forEach((item, idx) => {
        const el = document.getElementById(`image-item-${item.id}`);
        if (el) {
          const itemRect = el.getBoundingClientRect();
          const itemCenter = itemRect.top + itemRect.height / 2;
          const distance = Math.abs(itemCenter - centerY);
          if (distance < minDistance) {
            minDistance = distance;
            closestIdx = idx;
          }
        }
      });

      setCurrentIndex(closestIdx);
      const progress = items.length > 1 ? closestIdx / (items.length - 1) : 0;
      setScrollProgress(Math.max(0, Math.min(1, progress)));
    };

    const galleryEl = document.getElementById('gallery-grid-container');
    galleryEl?.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();

    return () => {
      galleryEl?.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [items]);

  // Handle touch / pointer position along the rail
  const handleRailInteraction = useCallback((clientY: number) => {
    if (!railRef.current || items.length === 0) return;
    const rect = railRef.current.getBoundingClientRect();
    const relativeY = clientY - rect.top;
    const clampedY = Math.max(0, Math.min(rect.height, relativeY));
    const progress = clampedY / rect.height;

    setScrollProgress(progress);

    const targetIdx = Math.round(progress * (items.length - 1));
    scrollToItemIndex(targetIdx, false);
  }, [items, scrollToItemIndex]);

  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    if (e.touches.length > 0) {
      handleRailInteraction(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length > 0) {
      handleRailInteraction(e.touches[0].clientY);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Pointer / Mouse Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    handleRailInteraction(e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      handleRailInteraction(e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    setIsDragging(false);
  };

  if (items.length === 0) return null;

  const currentItem = items[currentIndex] || items[0];
  const activeThumbnail = (currentItem.currentHistoryIndex >= 0 && currentItem.history[currentItem.currentHistoryIndex]?.url)
    ? currentItem.history[currentItem.currentHistoryIndex].url
    : currentItem.previewUrl;

  return (
    <>
      {/* Top Quick-Jump Scrubber Ribbon for Studio Editor */}
      <div className="w-full mb-3">
        <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-2xl p-2.5 shadow-xl">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
                Fast Scroll Gallery ({items.length} Photos)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowThumbStrip(!showThumbStrip)}
                className="text-[9px] font-bold text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 px-2 py-0.5 rounded-lg border border-orange-500/20 uppercase transition-all"
              >
                {showThumbStrip ? 'Hide Strip ▲' : 'Thumbnails ▼'}
              </button>
              <button
                type="button"
                onClick={() => scrollToItemIndex(0, true)}
                className="text-[9px] font-bold text-slate-400 hover:text-white bg-slate-800/80 px-2 py-0.5 rounded-lg border border-white/5 uppercase"
                title="Scroll to First Photo"
              >
                Top ⬆
              </button>
              <button
                type="button"
                onClick={() => scrollToItemIndex(items.length - 1, true)}
                className="text-[9px] font-bold text-slate-400 hover:text-white bg-slate-800/80 px-2 py-0.5 rounded-lg border border-white/5 uppercase"
                title="Scroll to Last Photo"
              >
                End ⬇
              </button>
            </div>
          </div>

          {/* Quick Horizontal Slider Bar */}
          <div className="relative flex items-center gap-2 px-1 pt-0.5 pb-0.5">
            <button
              type="button"
              onClick={() => scrollToItemIndex(Math.max(0, currentIndex - 1), true)}
              className="w-7 h-7 rounded-lg bg-slate-800 border border-white/10 text-slate-300 active:bg-orange-500 active:text-white flex items-center justify-center text-xs font-bold shrink-0 transition-colors"
              title="Previous photo"
            >
              ◀
            </button>
            <div className="relative flex-grow flex items-center h-7">
              <input
                type="range"
                min={0}
                max={items.length - 1}
                value={currentIndex}
                onChange={(e) => scrollToItemIndex(parseInt(e.target.value, 10), false)}
                className="w-full h-3 bg-slate-800 border border-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => scrollToItemIndex(Math.min(items.length - 1, currentIndex + 1), true)}
              className="w-7 h-7 rounded-lg bg-slate-800 border border-white/10 text-slate-300 active:bg-orange-500 active:text-white flex items-center justify-center text-xs font-bold shrink-0 transition-colors"
              title="Next photo"
            >
              ▶
            </button>
            <div className="shrink-0 bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/40 px-2 py-1 rounded-lg text-[10px] font-mono font-bold text-orange-300 min-w-[50px] text-center shadow-sm">
              #{currentIndex + 1} <span className="text-slate-500 text-[8px]">/ {items.length}</span>
            </div>
          </div>

          {/* Collapsible Horizontal Thumbnail Strip */}
          {showThumbStrip && (
            <div className="flex gap-2 overflow-x-auto py-2 px-1 scrollbar-thin mt-2 border-t border-white/5">
              {items.map((item, idx) => {
                const thumb = (item.currentHistoryIndex >= 0 && item.history[item.currentHistoryIndex]?.url)
                  ? item.history[item.currentHistoryIndex].url
                  : item.previewUrl;
                const isCurrent = idx === currentIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToItemIndex(idx, true)}
                    className={`relative shrink-0 w-12 h-12 rounded-xl overflow-hidden border-2 transition-all ${
                      isCurrent
                        ? 'border-orange-500 scale-105 ring-2 ring-orange-500/40 shadow-lg shadow-orange-500/20'
                        : 'border-white/10 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={thumb} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] font-mono text-white text-center font-bold">
                      {idx + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Vertical Fast-Scroll Scrubber Rail (Mobile & Tablet Right Edge) */}
      <div 
        className={`fixed right-0 top-32 bottom-24 z-40 lg:hidden flex flex-col items-end select-none transition-opacity duration-300 ${
          isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-60 hover:opacity-100'
        }`}
        style={{ touchAction: 'none' }}
      >
        {/* Generous Hit Zone Container (64px wide touch target) */}
        <div className="relative w-16 h-full flex flex-col items-center justify-between py-1 pr-1.5">
          
          {/* Quick Jump Top Button */}
          <button
            type="button"
            onClick={() => scrollToItemIndex(0, true)}
            className="w-9 h-9 rounded-full bg-slate-900/95 border border-orange-500/30 text-orange-400 flex items-center justify-center text-xs shadow-xl active:scale-90 transition-transform mb-2 backdrop-blur-md font-bold"
            title="Jump to Top"
            aria-label="Scroll to top of gallery"
          >
            ▲
          </button>

          {/* Scrubber Touch Rail */}
          <div
            ref={railRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="relative w-full flex-grow flex items-center justify-center cursor-pointer group select-none"
            style={{ touchAction: 'none' }}
          >
            {/* Background wider glass track */}
            <div className="w-3.5 h-full bg-slate-950/90 backdrop-blur-xl border border-white/20 rounded-full shadow-2xl overflow-hidden flex flex-col justify-between relative">
              {/* Active fill indicator */}
              <div 
                className="w-full bg-gradient-to-b from-orange-500 via-amber-500 to-orange-600 rounded-full transition-all duration-75 shadow-[0_0_12px_rgba(249,115,22,0.6)]"
                style={{ height: `${Math.max(6, scrollProgress * 100)}%` }}
              />
              {/* Subtle guide tick marks */}
              {total > 4 && (
                <div className="absolute inset-y-0 inset-x-0 flex flex-col justify-around items-center pointer-events-none opacity-30 py-2">
                  <div className="w-1.5 h-0.5 bg-white rounded-full" />
                  <div className="w-1.5 h-0.5 bg-white rounded-full" />
                  <div className="w-1.5 h-0.5 bg-white rounded-full" />
                </div>
              )}
            </div>

            {/* Draggable Scrubber Thumb */}
            <div
              className={`absolute right-1 w-11 h-13 flex items-center justify-center transition-transform ${
                isDragging ? 'scale-115' : 'group-hover:scale-105'
              }`}
              style={{
                top: `calc(${scrollProgress * 100}% - 26px)`,
                touchAction: 'none'
              }}
            >
              {/* Thumb Grip Pill with Index & Texture */}
              <div className={`w-10 h-12 rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 border-2 border-white shadow-2xl flex flex-col items-center justify-center gap-0.5 transition-all ${
                isDragging 
                  ? 'ring-4 ring-orange-500/50 shadow-orange-500/80 scale-105' 
                  : 'shadow-lg shadow-black/60'
              }`}>
                {/* Visual tactile ridges */}
                <div className="flex gap-0.5 items-center mb-0.5">
                  <div className="w-1 h-2 bg-white/80 rounded-full"></div>
                  <div className="w-1 h-2.5 bg-white rounded-full"></div>
                  <div className="w-1 h-2 bg-white/80 rounded-full"></div>
                </div>
                {/* Photo number on thumb handle */}
                <span className="text-[9px] font-black text-white font-mono leading-none drop-shadow">
                  {currentIndex + 1}
                </span>
              </div>

              {/* Pop-out HUD Tooltip while dragging or scrubbing */}
              {isDragging && (
                <div className="absolute right-13 top-1/2 -translate-y-1/2 bg-slate-950/95 backdrop-blur-2xl border-2 border-orange-500/50 rounded-2xl p-2.5 shadow-2xl flex items-center gap-3 min-w-[150px] animate-fade-in pointer-events-none">
                  <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/20 shrink-0 bg-slate-900 shadow-inner">
                    <img src={activeThumbnail} alt="Current" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-[8px] font-black uppercase text-orange-400 tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" /> Fast Scrub
                    </span>
                    <span className="text-sm font-mono font-black text-white">
                      Photo {currentIndex + 1} <span className="text-slate-500 font-normal text-xs">/ {total}</span>
                    </span>
                    <span className="text-[8px] text-amber-300 font-mono font-bold">
                      {Math.round(scrollProgress * 100)}% of gallery
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Jump Bottom Button */}
          <button
            type="button"
            onClick={() => scrollToItemIndex(items.length - 1, true)}
            className="w-9 h-9 rounded-full bg-slate-900/95 border border-orange-500/30 text-orange-400 flex items-center justify-center text-xs shadow-xl active:scale-90 transition-transform mt-2 backdrop-blur-md font-bold"
            title="Jump to Bottom"
            aria-label="Scroll to bottom of gallery"
          >
            ▼
          </button>
        </div>
      </div>
    </>
  );
};
