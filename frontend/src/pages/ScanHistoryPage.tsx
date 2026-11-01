import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  ProjectIcon,
  IndexesIcon,
  AddIcon,
  DocumentIcon,
  CalendarIcon,
} from '../components/ui/AgndexIcons';
import {
  RefreshCw,
  Play,
  Search,
  ArrowRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  Shield,
} from 'lucide-react';
import { scans } from '../lib/api';
import { formatRelative, formatDuration } from '../lib/utils';
import { StatusBadge } from '../components/ui/StatusBadge';

export default function ScanHistoryPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchRepo, setSearchRepo] = useState('');
  const [scanTarget, setScanTarget] = useState<'all' | 'insecure' | 'safe'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'flagged' | 'clean' | 'error'>('all');
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['scans', searchRepo],
    queryFn: () => scans.list({ repository: searchRepo || undefined }),
    refetchInterval: 6_000,
  });

  const { mutate: triggerScan, isPending: isScanning } = useMutation({
    mutationFn: (target?: 'all' | 'insecure' | 'safe') => scans.runDemo(target),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      if (res?.item?.id) {
        navigate(`/app/scans/${res.item.id}`);
      }
    },
  });

  const items = data?.items || [];

  const totalReviews = items.length;
  const flaggedReviews = items.filter((s) => (s.findings?.length ?? 0) > 0).length;
  const errorReviews = items.filter(
    (s) => s.status === 'scanner_failed' || s.status === 'pipeline_failed' || s.status === 'scanner_unavailable'
  ).length;
  const cleanReviews = items.filter(
    (s) => (s.findings?.length ?? 0) === 0 && s.status !== 'scanner_failed' && s.status !== 'pipeline_failed'
  ).length;

  const filteredItems = items.filter((scan) => {
    if (searchRepo && !scan.repository?.toLowerCase().includes(searchRepo.toLowerCase())) {
      return false;
    }
    if (statusFilter === 'flagged') {
      return (scan.findings?.length ?? 0) > 0;
    }
    if (statusFilter === 'clean') {
      return (
        (scan.findings?.length ?? 0) === 0 &&
        scan.status !== 'scanner_failed' &&
        scan.status !== 'pipeline_failed'
      );
    }
    if (statusFilter === 'error') {
      return (
        scan.status === 'scanner_failed' ||
        scan.status === 'pipeline_failed' ||
        scan.status === 'scanner_unavailable'
      );
    }
    return true;
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 p-4 md:gap-11 md:p-8">
      {/* ── 1. PAGE HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Scan History</h1>
        <p className="text-zinc-400">
          Chronological record of automated static analysis reviews
        </p>
      </div>

      {/* ── 2. METADATA CHIPS & ACTIONS ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center md:justify-between">
        <div className="contents md:flex md:flex-wrap md:items-center md:gap-2">
          <div className="agndex-meta-chip font-medium text-white">
            <ProjectIcon className="size-4 text-zinc-400" />
            CodeSentinel Workspace
          </div>
          <button
            type="button"
            onClick={() => setShowSummaryModal(true)}
            className="agndex-meta-chip hover:bg-[#262930] hover:text-white transition-colors cursor-pointer text-left group"
            title="Inspect review summary and breakdown"
          >
            <IndexesIcon className="size-4 text-zinc-400 group-hover:text-[#D946EF] transition-colors" />
            <span>{items.length} scans</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={scanTarget}
            onChange={(e) => setScanTarget(e.target.value as 'all' | 'insecure' | 'safe')}
            aria-label="Select scan fixture target"
            className="agndex-input h-10 px-2.5 text-xs bg-[#202227] text-zinc-300 border-white/10 rounded-lg cursor-pointer"
          >
            <option value="all">Target: All Fixtures</option>
            <option value="insecure">Target: Insecure Fixture</option>
            <option value="safe">Target: Safe Fixture (Clean)</option>
          </select>
          <button
            type="button"
            onClick={() => triggerScan(scanTarget)}
            disabled={isScanning}
            className="agndex-btn-primary"
          >
            {isScanning ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <AddIcon className="size-4" />
                Run Security Scan
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── 3. HORIZONTAL DIVIDER ──────────────────────────────────────────── */}
      <div className="border-t border-white/10" />

      {/* ── 4. ACTIVITY LIST ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 md:gap-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="font-semibold text-white text-base tracking-tight">Historical Runs</h2>
            <span className="text-xs text-zinc-400 font-normal">
              ({filteredItems.length} of {items.length} shown)
            </span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Status Filter Pills */}
            <div className="flex items-center rounded-lg border border-white/10 bg-[#18191E] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`rounded px-2.5 py-1 transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-[#262930] text-white font-medium shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                All ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('flagged')}
                className={`rounded px-2.5 py-1 transition-colors ${
                  statusFilter === 'flagged'
                    ? 'bg-amber-500/20 text-amber-300 font-medium'
                    : 'text-zinc-400 hover:text-amber-300'
                }`}
              >
                Flagged ({flaggedReviews})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('clean')}
                className={`rounded px-2.5 py-1 transition-colors ${
                  statusFilter === 'clean'
                    ? 'bg-emerald-500/20 text-emerald-300 font-medium'
                    : 'text-zinc-400 hover:text-emerald-300'
                }`}
              >
                Clean ({cleanReviews})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('error')}
                className={`rounded px-2.5 py-1 transition-colors ${
                  statusFilter === 'error'
                    ? 'bg-red-500/20 text-red-300 font-medium'
                    : 'text-zinc-400 hover:text-red-300'
                }`}
              >
                Errors ({errorReviews})
              </button>
            </div>

            <div className="relative w-full sm:w-48">
              <Search className="size-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchRepo}
                onChange={(e) => setSearchRepo(e.target.value)}
                placeholder="Repo..."
                className="agndex-input h-8 pl-9 text-xs"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {isLoading ? (
            <div className="rounded-xl border border-white/5 bg-[#202227] p-8 text-center text-sm text-zinc-400">
              Loading scan history...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-[#202227] p-8 text-center text-sm text-zinc-400">
              No scan history records match current filters.
              {statusFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className="ml-2 text-[#D946EF] underline hover:text-[#e879f9]"
                >
                  Clear filter
                </button>
              )}
            </div>
          ) : (
            filteredItems.map((scan) => {
              const findingsCount = scan.findings?.length ?? 0;
              const hasCritical = scan.findings?.some((f) => f.severity === 'ERROR');
              const isFailed = scan.status === 'scanner_failed' || scan.status === 'pipeline_failed';
              const isUnavailable = scan.status === 'scanner_unavailable';
              const isInProgress = scan.status === 'scanning' || scan.status === 'fetching' || scan.status === 'queued';

              return (
                <div
                  key={scan.id}
                  onClick={() => navigate(`/app/scans/${scan.id}`)}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[#202227] px-3.5 py-3 transition-colors hover:bg-[#262930] md:pr-4 border border-white/5 cursor-pointer group"
                >
                  <div className="flex items-center gap-3 overflow-hidden md:gap-4">
                    <div className="flex size-11 items-center justify-center rounded-lg border border-white/10 bg-[#0E0F12] text-zinc-400 shrink-0 group-hover:border-white/20 transition-colors">
                      <DocumentIcon className="size-5" />
                    </div>

                    <div className="flex flex-col gap-1 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium tracking-tight text-white group-hover:text-white">
                          {scan.repository || 'local/controlled-fixture'}
                        </p>
                        {isFailed ? (
                          <StatusBadge status="failed" label="Scan failed" size="xs" />
                        ) : isUnavailable ? (
                          <StatusBadge status="unavailable" label="Unavailable" size="xs" />
                        ) : isInProgress ? (
                          <StatusBadge status="scanning" label="Scanning" size="xs" />
                        ) : findingsCount > 0 ? (
                          <StatusBadge status="findings" count={findingsCount} size="xs" />
                        ) : (
                          <StatusBadge status="clean" label="No findings" size="xs" />
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="size-3.5 text-zinc-500" />
                          <span>{formatRelative(scan.at || new Date().toISOString())}</span>
                        </span>
                        <span className="size-1 rounded-full bg-zinc-600" />
                        <span>Duration: {formatDuration(scan.durationMs || 1024)}</span>
                        <span className="size-1 rounded-full bg-zinc-600" />
                        <span>Source: {scan.source}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      aria-label="Inspect scan detail"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/app/scans/${scan.id}`);
                      }}
                      className="size-9 rounded-lg hover:bg-white/10 flex items-center justify-center text-zinc-400 group-hover:text-white transition-colors"
                      title="Inspect scan detail"
                    >
                      <ArrowRight className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── 5. REVIEW SUMMARY & TELEMETRY MODAL ─────────────────────────────── */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#18191D] p-6 shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-[#D946EF]/10 border border-[#D946EF]/20 flex items-center justify-center text-[#D946EF]">
                  <IndexesIcon className="size-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Review Summary &amp; Telemetry</h3>
                  <p className="text-xs text-zinc-400">Continuous Semgrep AST inspection metrics</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className="size-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Quick Metrics (Clickable to Filter) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setShowSummaryModal(false);
                }}
                className="rounded-xl border border-white/10 bg-[#202227] p-3 text-left hover:border-white/20 hover:bg-[#262930] transition-colors"
              >
                <span className="text-[11px] text-zinc-400 uppercase tracking-wide">Total Runs</span>
                <p className="text-xl font-bold text-white mt-0.5">{totalReviews}</p>
                <span className="text-[10px] text-zinc-500">Filter all →</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilter('flagged');
                  setShowSummaryModal(false);
                }}
                className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-left hover:border-amber-500/40 hover:bg-amber-500/15 transition-colors"
              >
                <span className="text-[11px] text-amber-300 uppercase tracking-wide">Flagged</span>
                <p className="text-xl font-bold text-amber-300 mt-0.5">{flaggedReviews}</p>
                <span className="text-[10px] text-amber-400/80">Filter flaws →</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilter('clean');
                  setShowSummaryModal(false);
                }}
                className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-left hover:border-emerald-500/40 hover:bg-emerald-500/15 transition-colors"
              >
                <span className="text-[11px] text-emerald-300 uppercase tracking-wide">Clean</span>
                <p className="text-xl font-bold text-emerald-300 mt-0.5">{cleanReviews}</p>
                <span className="text-[10px] text-emerald-400/80">Filter clean →</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilter('error');
                  setShowSummaryModal(false);
                }}
                className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-left hover:border-red-500/40 hover:bg-red-500/15 transition-colors"
              >
                <span className="text-[11px] text-red-300 uppercase tracking-wide">Errors</span>
                <p className="text-xl font-bold text-red-300 mt-0.5">{errorReviews}</p>
                <span className="text-[10px] text-red-400/80">Filter errors →</span>
              </button>
            </div>

            {/* Architecture Invariants */}
            <div className="rounded-xl border border-white/5 bg-[#202227] p-4 flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-white">Scanner Architecture &amp; Runtime</span>
              <div className="grid gap-2 text-xs text-zinc-300">
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">AST Engine</span>
                  <span className="font-mono text-zinc-200">Semgrep 1.181.0</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">Default Target</span>
                  <span className="font-mono text-zinc-200">local/controlled-fixture</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">Execution Boundary</span>
                  <span className="text-zinc-200">POSIX 0600 Ephemeral Temp</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-zinc-400">Security Rule Definition</span>
                  <span className="font-mono text-zinc-200">python.lang.security.eval (CWE-95)</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setSearchRepo('');
                  setShowSummaryModal(false);
                }}
                className="text-xs text-zinc-400 hover:text-white transition-colors"
              >
                Reset All Filters
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSummaryModal(false)}
                  className="rounded-lg border border-white/10 px-3.5 py-1.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSummaryModal(false);
                    triggerScan(scanTarget);
                  }}
                  disabled={isScanning}
                  className="agndex-btn-primary text-xs h-8 px-3.5 gap-1.5"
                >
                  {isScanning ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Play className="size-3.5 fill-current" />
                      Run Scan Now
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
