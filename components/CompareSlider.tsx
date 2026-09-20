
import React, { useState, useRef, useEffect, useCallback } from 'react';

interface CompareSliderProps {
  originalUrl: string;
  generatedUrl: string;
}

export const CompareSlider: React.FC<CompareSliderProps> = ({ originalUrl, generatedUrl }) => {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMove = useCallback((clientX: number) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percentage = (x / rect.width) * 100;
      setPosition(percentage);
    }
  }, []);

  const handleMouseDown = () => { isDragging.current = true; };
  const handleMouseUp = () => { isDragging.current = false; };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current) handleMove(e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => { isDragging.current = false; };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full select-none overflow-hidden cursor-ew-resize group"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
    >
      {/* Background: Original Image */}
      <img 
        src={originalUrl} 
        alt="Original" 
        className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
      />
      
      {/* Foreground: Generated Image with Clip Path */}
      <div 
        className="absolute inset-0 w-full h-full pointer-events-none select-none"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <img 
          src={generatedUrl} 
          alt="Generated" 
          className="absolute inset-0 w-full h-full object-contain"
        />
      </div>

      {/* Slider Handle Line */}
      <div 
        className="absolute inset-y-0 w-0.5 bg-white/80 drop-shadow-md z-20 pointer-events-none"
        style={{ left: `${position}%` }}
      >
        {/* Handle Button */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 backdrop-blur-md border border-white/40 shadow-xl flex items-center justify-center transition-transform group-hover:scale-110">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-white drop-shadow-sm">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
            </svg>
        </div>
      </div>
      
      {/* Labels */}
      <div className="absolute top-4 left-4 px-2 py-1 bg-black/50 backdrop-blur-sm rounded text-[10px] font-bold text-white uppercase tracking-wider pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">Generated</div>
      <div className="absolute top-4 right-4 px-2 py-1 bg-black/50 backdrop-blur-sm rounded text-[10px] font-bold text-white uppercase tracking-wider pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">Original</div>
    </div>
  );
};
