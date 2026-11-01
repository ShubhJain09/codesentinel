import React from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface TabItem {
  id: string;
  label: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string; size?: number | string }>;
  badge?: string | number;
}

interface ContinuousTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  layoutId?: string;
}

/**
 * ContinuousTabs component adapted from Watermelon UI (https://ui.watermelon.sh/)
 * Provides fluid sliding background pill using Framer Motion layoutId with spring dynamics.
 */
export function ContinuousTabs({
  tabs,
  activeTab,
  onChange,
  className,
  size = 'md',
  layoutId = 'continuous-tabs-pill',
}: ContinuousTabsProps) {
  const sizeClasses = {
    sm: 'text-xs py-1.5 px-3',
    md: 'text-xs font-semibold py-2 px-4',
    lg: 'text-sm font-semibold py-2.5 px-5',
  };

  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 p-1 bg-warm-200/80 rounded-xl border border-warm-300 backdrop-blur-sm',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative rounded-lg transition-colors duration-200 flex items-center gap-2 select-none z-10',
              sizeClasses[size],
              isActive ? 'text-ink font-bold' : 'text-ink-500 hover:text-ink'
            )}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 bg-white rounded-lg shadow-sm border border-warm-300 -z-10"
                transition={{
                  type: 'spring',
                  stiffness: 450,
                  damping: 35,
                }}
              />
            )}
            {Icon && (
              <Icon
                size={size === 'sm' ? 14 : 16}
                className={cn(
                  'transition-colors',
                  isActive ? 'text-coral' : 'text-ink-400'
                )}
              />
            )}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  'ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold',
                  isActive
                    ? 'bg-coral/10 text-coral'
                    : 'bg-warm-300 text-ink-500'
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default ContinuousTabs;
