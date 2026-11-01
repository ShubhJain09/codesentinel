import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format } from 'date-fns';
import type { SeverityLevel } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'MMM d, yyyy HH:mm');
  } catch {
    return dateStr;
  }
}

export function formatRelative(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export function severityBadgeClass(severity: SeverityLevel): string {
  switch (severity) {
    case 'ERROR': return 'badge-critical';
    case 'WARNING': return 'badge-high';
    case 'INFO': return 'badge-low';
  }
}

export function severityLabel(severity: SeverityLevel): string {
  switch (severity) {
    case 'ERROR': return 'Critical';
    case 'WARNING': return 'High';
    case 'INFO': return 'Low';
  }
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    queued: 'Queued',
    fetching: 'Fetching',
    scanning: 'Scanning',
    completed: 'Completed',
    pipeline_failed: 'Failed',
    scanner_unavailable: 'Scanner N/A',
    scanner_failed: 'Scanner Error',
    illustrative_only: 'Preview',
    unsupported_scope: 'No Python Files',
  };
  return map[status] || status;
}

export function statusColor(status: string): string {
  if (status === 'completed') return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  if (['queued', 'fetching', 'scanning'].includes(status)) return 'text-violet-600 bg-violet-50 border-violet-200';
  if (['pipeline_failed', 'scanner_failed'].includes(status)) return 'text-coral-600 bg-coral-50 border-coral-200';
  return 'text-ink-500 bg-warm-100 border-warm-300';
}

export function truncateId(id: string, len = 8): string {
  return id.slice(0, len) + '…';
}

export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] || c));
}
