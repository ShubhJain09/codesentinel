import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

export interface StickyScrollItem {
  id: string;
  step: string;
  tag: string;
  title: string;
  subtitle: string;
  description: string;
  annotation: string;
  visual: React.ReactNode;
}

interface StickyScrollProps {
  items: StickyScrollItem[];
  className?: string;
}

/**
 * StickyScrollReveal component adapted from Aceternity UI (https://ui.aceternity.com/)
 * Keeps visual panel sticky while scrolling through descriptive stages, updating smoothly.
 */
export function StickyScroll({ items, className }: StickyScrollProps) {
  const [activeCard, setActiveCard] = useState(0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight * 0.45;

      itemRefs.current.forEach((el, index) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const top = rect.top + window.scrollY;
        const bottom = top + rect.height;

        if (scrollPosition >= top && scrollPosition <= bottom) {
          setActiveCard(index);
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [items]);

  return (
    <div className={cn('relative max-w-screen-xl mx-auto px-6 py-12', className)}>
      <div className="grid lg:grid-cols-12 gap-12 items-start">
        {/* Left Column: Scrolling content stages */}
        <div className="lg:col-span-6 space-y-24 py-8">
          {items.map((item, index) => {
            const isActive = activeCard === index;

            return (
              <div
                key={item.id}
                ref={(el) => (itemRefs.current[index] = el)}
                onClick={() => setActiveCard(index)}
                className={cn(
                  'cursor-pointer transition-all duration-300 p-8 rounded-3xl border',
                  isActive
                    ? 'bg-white border-warm-400 shadow-panel translate-x-1'
                    : 'bg-warm-50/70 border-warm-200 opacity-60 hover:opacity-90'
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <span
                    className={cn(
                      'text-display-md font-black font-mono tracking-tight transition-colors',
                      isActive ? 'text-coral' : 'text-warm-300'
                    )}
                  >
                    {item.step}
                  </span>
                  <span className="text-[10px] font-mono font-bold tracking-widest text-ink-500 bg-warm-200 px-2.5 py-1 rounded uppercase">
                    {item.tag}
                  </span>
                </div>

                <h3 className="text-xl font-black text-ink mb-1.5 tracking-tight">
                  {item.title}
                </h3>
                <div className="text-xs font-semibold text-coral mb-3 font-mono">
                  {item.subtitle}
                </div>
                <p className="text-xs text-ink-500 leading-relaxed mb-6 font-sans">
                  {item.description}
                </p>

                <div className="pt-4 border-t border-warm-200/80 flex items-center justify-between text-[11px] font-mono text-ink-400">
                  <span>{item.annotation}</span>
                  <span className={cn('text-xs font-bold', isActive ? 'text-coral' : 'text-ink-300')}>
                    {isActive ? '● ACTIVE' : '○ STAGE'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Sticky live visual panel */}
        <div className="lg:col-span-6 lg:sticky lg:top-28">
          <div className="rounded-3xl bg-ink-900 border border-ink-700 shadow-float overflow-hidden">
            <div className="px-5 py-3.5 bg-ink-800 border-b border-ink-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="ml-2 text-xs font-mono text-slate-400">
                  codesentinel-pipeline-telemetry.log
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold text-coral bg-coral/10 px-2.5 py-0.5 rounded">
                LIVE STAGE: {items[activeCard]?.step}
              </span>
            </div>

            <div className="p-6 min-h-[380px] flex flex-col justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={items[activeCard]?.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="w-full"
                >
                  {items[activeCard]?.visual}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StickyScroll;
