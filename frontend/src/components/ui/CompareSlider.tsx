import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CompareSliderProps {
  firstContent: React.ReactNode;
  secondContent: React.ReactNode;
  firstLabel?: string;
  secondLabel?: string;
  initialSliderPercentage?: number;
  className?: string;
}

/**
 * CompareSlider component adapted from Aceternity UI (https://ui.aceternity.com/components/compare)
 * Allows interactive horizontal drag/scrub comparison between vulnerable code and safe remediation.
 */
export function CompareSlider({
  firstContent,
  secondContent,
  firstLabel = 'Vulnerable Code (Flawed)',
  secondLabel = 'Remediated Code (Safe)',
  initialSliderPercentage = 50,
  className,
}: CompareSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(initialSliderPercentage);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      let percentage = (x / rect.width) * 100;
      if (percentage < 5) percentage = 5;
      if (percentage > 95) percentage = 95;
      setSliderPosition(percentage);
    },
    []
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;
      handleMove(e.touches[0].clientX);
    },
    [isDragging, handleMove]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      handleMove(e.clientX);
    },
    [isDragging, handleMove]
  );

  return (
    <div
      ref={containerRef}
      onMouseDown={() => setIsDragging(true)}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
      onMouseMove={handleMouseMove}
      onTouchStart={() => setIsDragging(true)}
      onTouchEnd={() => setIsDragging(false)}
      onTouchMove={handleTouchMove}
      className={cn(
        'relative w-full overflow-hidden select-none rounded-3xl border border-ink-700 bg-ink-950 shadow-float cursor-ew-resize',
        className
      )}
    >
      {/* Top Header with labels & position */}
      <div className="px-5 py-3 bg-ink-900 border-b border-ink-800 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2 text-coral">
          <AlertTriangle size={13} />
          <span className="font-bold">{firstLabel}</span>
        </div>
        <div className="text-[11px] text-slate-400 font-bold bg-ink-800 px-3 py-1 rounded-full border border-ink-700">
          Drag to Compare: {Math.round(sliderPosition)}%
        </div>
        <div className="flex items-center gap-2 text-emerald-400">
          <CheckCircle size={13} />
          <span className="font-bold">{secondLabel}</span>
        </div>
      </div>

      {/* Comparison Viewport */}
      <div className="relative min-h-[300px] w-full overflow-hidden">
        {/* Right / Remediated Layer (Base) */}
        <div className="absolute inset-0 w-full h-full p-6 text-slate-300 font-mono text-xs overflow-x-auto bg-ink-950">
          {secondContent}
        </div>

        {/* Left / Flawed Layer (Clipped Overlay) */}
        <div
          className="absolute inset-0 w-full h-full p-6 text-slate-300 font-mono text-xs overflow-x-auto bg-ink-950 border-r border-coral/80"
          style={{
            clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)`,
          }}
        >
          {firstContent}
        </div>

        {/* Divider Slider Line & Handle */}
        <div
          className="absolute top-0 bottom-0 z-20 pointer-events-none"
          style={{ left: `${sliderPosition}%` }}
        >
          {/* Vertical Glowing Line */}
          <div className="absolute top-0 bottom-0 -left-px w-0.5 bg-gradient-to-b from-coral via-white to-emerald-400 shadow-[0_0_12px_rgba(232,85,62,0.8)]" />

          {/* Centered Handle */}
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white text-ink shadow-2xl border-2 border-coral flex items-center justify-center font-mono text-[10px] font-black">
            ◄►
          </div>
        </div>
      </div>
    </div>
  );
}

export default CompareSlider;
