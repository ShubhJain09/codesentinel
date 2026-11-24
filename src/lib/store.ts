import { useEffect, useState, useSyncExternalStore } from 'react';
import { PULL_REQUESTS, findPullRequest, type PullRequest } from '../data/fixtures';
import { scanPullRequest, type Finding, type ScanResult } from './scanner';

/**
 * Browser-local prototype state. Only non-sensitive sample records are stored
 * (PRD FR-08 / §10.5); every storage access is guarded.
 */

export type ReviewStatus = 'open' | 'in_review' | 'resolved' | 'accepted_risk';

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  open: 'Open',
  in_review: 'In review',
  resolved: 'Resolved',
  accepted_risk: 'Accepted risk',
};

export const STATUS_HINT: Record<ReviewStatus, string> = {
  open: 'Nobody has reviewed it yet',
  in_review: 'Someone is looking into it',
  resolved: 'The reviewer marked it as handled',
  accepted_risk: 'Kept on purpose — a reason is required',
};

export interface ReviewEvent {
  status: ReviewStatus;
  at: string;
  actor: string;
  reason?: string;
}

interface State {
  reviews: Record<string, { status: ReviewStatus; history: ReviewEvent[] }>;
  scans: ScanRecord[];
  storage: 'ok' | 'unavailable';
}

export interface ScanRecord {
  id: string;
  repo: string;
  pr: number;
  startedAt: string;
  origin: 'sample' | 'local';
}

const KEY = 'codesentinel.highlight.v1';
const ACTOR = 'You (this browser)';

export const SAMPLE_SCANS: ScanRecord[] = [
  { id: 'scan-0001', repo: 'docs-site', pr: 3, startedAt: '2026-10-31T09:12:00Z', origin: 'sample' },
  { id: 'scan-0002', repo: 'billing-api', pr: 7, startedAt: '2026-10-31T09:40:00Z', origin: 'sample' },
  { id: 'scan-0003', repo: 'demo-auth-service', pr: 12, startedAt: '2026-10-31T10:42:00Z', origin: 'sample' },
];

function load(): State {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { reviews: {}, scans: [], storage: 'ok' };
    const p = JSON.parse(raw) as Partial<State>;
    return {
      reviews: p.reviews && typeof p.reviews === 'object' ? p.reviews : {},
      scans: Array.isArray(p.scans) ? p.scans.filter((s) => s.origin === 'local') : [],
      storage: 'ok',
    };
  } catch {
    return { reviews: {}, scans: [], storage: 'unavailable' };
  }
}

let state: State = typeof window === 'undefined' ? { reviews: {}, scans: [], storage: 'ok' } : load();
const listeners = new Set<() => void>();

function commit(next: State): boolean {
  let ok = true;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ reviews: next.reviews, scans: next.scans }));
  } catch {
    ok = false;
  }
  state = { ...next, storage: ok ? 'ok' : 'unavailable' };
  listeners.forEach((l) => l());
  return ok;
}

export function useStore(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

export function reviewOf(s: State, fingerprint: string) {
  return s.reviews[fingerprint] ?? { status: 'open' as ReviewStatus, history: [] as ReviewEvent[] };
}

export function setReview(fingerprint: string, status: ReviewStatus, reason?: string): boolean {
  const cur = reviewOf(state, fingerprint);
  const event: ReviewEvent = reason
    ? { status, at: new Date().toISOString(), actor: ACTOR, reason }
    : { status, at: new Date().toISOString(), actor: ACTOR };
  return commit({ ...state, reviews: { ...state.reviews, [fingerprint]: { status, history: [...cur.history, event] } } });
}

export function allScans(s: State): ScanRecord[] {
  return [...SAMPLE_SCANS, ...s.scans].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function findScan(s: State, id: string): ScanRecord | undefined {
  return allScans(s).find((x) => x.id === id);
}

export function recordScan(pr: PullRequest): ScanRecord {
  const rec: ScanRecord = {
    id: `scan-${String(SAMPLE_SCANS.length + state.scans.length + 1).padStart(4, '0')}`,
    repo: pr.repo,
    pr: pr.number,
    startedAt: new Date().toISOString(),
    origin: 'local',
  };
  commit({ ...state, scans: [...state.scans, rec] });
  return rec;
}

const cache = new Map<string, ScanResult>();
export function resultFor(pr: PullRequest): ScanResult {
  const k = `${pr.repo}#${pr.number}`;
  let r = cache.get(k);
  if (!r) {
    r = scanPullRequest(pr);
    cache.set(k, r);
  }
  return r;
}

export function findingsFor(pr: PullRequest): Finding[] {
  const r = resultFor(pr);
  return r.outcome.kind === 'findings' ? r.outcome.findings : [];
}

export function prOf(scan: ScanRecord): PullRequest {
  const pr = findPullRequest(scan.repo, scan.pr);
  if (!pr) throw new Error(`Missing fixture ${scan.repo}#${scan.pr}`);
  return pr;
}

export const SAMPLE_PR = PULL_REQUESTS[0]!;

const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
export const formatTime = (iso: string): string => `${fmt.format(new Date(iso))} UTC`;

/* ---------- Theme (per-viewer convenience) ---------- */

export type Theme = 'light' | 'dark';
const THEME_KEY = 'codesentinel.highlight.theme';

function initialTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* fall through */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => (typeof window === 'undefined' ? 'light' : initialTheme()));
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* per-session only */
    }
  }, [theme]);
  return [theme, setTheme];
}

export const useReducedMotion = (): boolean => {
  const q = '(prefers-reduced-motion: reduce)';
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mql = window.matchMedia(q);
    const on = () => setM(mql.matches);
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, []);
  return m;
};
