import React from 'react';
import { cn } from '../../lib/utils';

export type StatusVariant = 'inline' | 'subtle';
export type StatusSize = 'xs' | 'sm' | 'md';

export interface StatusBadgeProps {
  status: string;
  count?: number;
  label?: string;
  className?: string;
  size?: StatusSize;
  variant?: StatusVariant;
  showDot?: boolean;
  ariaLabel?: string;
}

export function StatusBadge({
  status,
  count,
  label,
  className,
  size = 'sm',
  variant = 'inline',
  showDot = true,
  ariaLabel,
}: StatusBadgeProps) {
  let dotColor = 'bg-zinc-500';
  let textColor = 'text-zinc-400';
  let subtleBgBorder = 'bg-white/5 border-white/10 text-zinc-300';
  let defaultLabel = status || 'Unknown';
  let pulse = false;

  const key = (status || '').toLowerCase().trim();

  switch (key) {
    case 'clean':
    case 'no-findings':
    case 'no findings':
    case 'completed':
      dotColor = 'bg-emerald-400';
      textColor = 'text-zinc-300';
      subtleBgBorder = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300';
      defaultLabel = 'No findings';
      break;

    case 'critical':
    case 'error':
      dotColor = 'bg-rose-500';
      textColor = 'text-rose-400 font-medium';
      subtleBgBorder = 'bg-rose-500/10 border-rose-500/20 text-rose-300';
      defaultLabel = 'Critical';
      break;

    case 'high':
    case 'warning':
      dotColor = 'bg-orange-400';
      textColor = 'text-orange-300';
      subtleBgBorder = 'bg-orange-500/10 border-orange-500/20 text-orange-300';
      defaultLabel = 'High';
      break;

    case 'medium':
      dotColor = 'bg-amber-400';
      textColor = 'text-amber-300';
      subtleBgBorder = 'bg-amber-500/10 border-amber-500/20 text-amber-300';
      defaultLabel = 'Medium';
      break;

    case 'low':
    case 'info':
      dotColor = 'bg-sky-400';
      textColor = 'text-sky-300';
      subtleBgBorder = 'bg-sky-500/10 border-sky-500/20 text-sky-300';
      defaultLabel = 'Low';
      break;

    case 'findings':
    case 'vulnerabilities_detected':
    case 'flagged':
    case 'issue':
    case 'issues':
      if (count !== undefined) {
        dotColor = count > 1 ? 'bg-rose-400' : 'bg-amber-400';
        textColor = count > 1 ? 'text-rose-300' : 'text-amber-300';
        subtleBgBorder = count > 1 ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' : 'bg-amber-500/10 border-amber-500/20 text-amber-300';
        defaultLabel = count === 1 ? '1 issue' : `${count} issues`;
      } else {
        dotColor = 'bg-amber-400';
        textColor = 'text-amber-300';
        subtleBgBorder = 'bg-amber-500/10 border-amber-500/20 text-amber-300';
        defaultLabel = 'Issues detected';
      }
      break;

    case 'running':
    case 'scanning':
    case 'queued':
    case 'fetching':
      dotColor = 'bg-[#D946EF]';
      textColor = 'text-zinc-200';
      subtleBgBorder = 'bg-[#D946EF]/10 border-[#D946EF]/20 text-[#E879F9]';
      defaultLabel = 'Scanning';
      pulse = true;
      break;

    case 'failed':
    case 'scanner_failed':
    case 'pipeline_failed':
      dotColor = 'bg-rose-500';
      textColor = 'text-rose-400 font-medium';
      subtleBgBorder = 'bg-rose-500/10 border-rose-500/20 text-rose-300';
      defaultLabel = 'Scan failed';
      break;

    case 'unavailable':
    case 'scanner_unavailable':
      dotColor = 'bg-amber-400';
      textColor = 'text-amber-300';
      subtleBgBorder = 'bg-amber-500/10 border-amber-500/20 text-amber-300';
      defaultLabel = 'Unavailable';
      break;

    case 'ready':
    case 'operational':
      dotColor = 'bg-emerald-400';
      textColor = 'text-zinc-300';
      subtleBgBorder = 'bg-white/5 border-white/10 text-zinc-300';
      defaultLabel = 'Ready';
      break;

    case 'allowlist-enabled':
    case 'strict-scope':
    case 'strict':
    case 'strict scope':
      dotColor = 'bg-zinc-400';
      textColor = 'text-zinc-300';
      subtleBgBorder = 'bg-white/5 border-white/10 text-zinc-300';
      defaultLabel = 'Allowlist enabled';
      break;

    case 'verified-fixture':
      dotColor = 'bg-emerald-400';
      textColor = 'text-zinc-300';
      subtleBgBorder = 'bg-white/5 border-white/10 text-zinc-300';
      defaultLabel = 'Verified fixture';
      break;

    case 'active':
      dotColor = 'bg-emerald-400';
      textColor = 'text-zinc-300';
      subtleBgBorder = 'bg-white/5 border-white/10 text-zinc-300';
      defaultLabel = 'Active';
      break;

    case 'disabled':
    case 'inactive':
      dotColor = 'bg-zinc-600';
      textColor = 'text-zinc-500';
      subtleBgBorder = 'bg-white/5 border-white/5 text-zinc-500';
      defaultLabel = 'Disabled';
      break;

    case 'owner':
      dotColor = 'bg-[#D946EF]';
      textColor = 'text-zinc-300';
      subtleBgBorder = 'bg-[#D946EF]/10 border-[#D946EF]/20 text-[#E879F9]';
      defaultLabel = 'Owner';
      break;

    case 'admin':
      dotColor = 'bg-indigo-400';
      textColor = 'text-zinc-300';
      subtleBgBorder = 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300';
      defaultLabel = 'Admin';
      break;

    case 'member':
    case 'user':
      dotColor = 'bg-zinc-400';
      textColor = 'text-zinc-400';
      subtleBgBorder = 'bg-white/5 border-white/10 text-zinc-400';
      defaultLabel = 'Member';
      break;

    case 'open':
      dotColor = 'bg-rose-400';
      textColor = 'text-zinc-300';
      subtleBgBorder = 'bg-rose-500/10 border-rose-500/20 text-rose-300';
      defaultLabel = 'Open';
      break;

    case 'acknowledged':
      dotColor = 'bg-zinc-500';
      textColor = 'text-zinc-400';
      subtleBgBorder = 'bg-white/5 border-white/10 text-zinc-400';
      defaultLabel = 'Acknowledged';
      break;

    default:
      defaultLabel = label || status;
      break;
  }

  const displayText = label || defaultLabel;

  const sizeClasses = {
    xs: 'text-[11px] gap-1.5',
    sm: 'text-xs gap-1.5',
    md: 'text-[13px] gap-2',
  }[size];

  const dotSizeClasses = {
    xs: 'size-1',
    sm: 'size-1.5',
    md: 'size-2',
  }[size];

  if (variant === 'subtle') {
    return (
      <span
        role="status"
        aria-label={ariaLabel || displayText}
        className={cn(
          'inline-flex items-center rounded-md border px-2 py-0.5 select-none font-medium tracking-tight',
          sizeClasses,
          subtleBgBorder,
          className
        )}
      >
        {showDot && (
          <span
            className={cn(
              dotSizeClasses,
              'rounded-full shrink-0',
              dotColor,
              pulse && 'motion-safe:animate-pulse'
            )}
            aria-hidden="true"
          />
        )}
        <span className="truncate">{displayText}</span>
      </span>
    );
  }

  return (
    <span
      role="status"
      aria-label={ariaLabel || displayText}
      className={cn(
        'inline-flex items-center select-none font-medium tracking-tight',
        sizeClasses,
        textColor,
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            dotSizeClasses,
            'rounded-full shrink-0',
            dotColor,
            pulse && 'motion-safe:animate-pulse'
          )}
          aria-hidden="true"
        />
      )}
      <span className="truncate">{displayText}</span>
    </span>
  );
}

export default StatusBadge;
