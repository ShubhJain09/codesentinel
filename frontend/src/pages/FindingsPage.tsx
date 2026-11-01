import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ShieldAlertIcon,
  ProjectIcon,
  IndexesIcon,
  CalendarIcon,
  CheckIcon,
  CopyIcon,
  DocumentIcon,
} from '../components/ui/AgndexIcons';
import { Search, X, ExternalLink, ShieldCheck, Layers, ListFilter } from 'lucide-react';
import { findings } from '../lib/api';
import { formatRelative } from '../lib/utils';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
  normalizeFinding,
  groupFindingsByPattern,
  type NormalizedFinding,
  type UniqueFindingPattern,
} from '../lib/findings-mapper';

export default function FindingsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'ERROR' | 'WARNING'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'open' | 'acknowledged'>('ALL');
  const [viewMode, setViewMode] = useState<'patterns' | 'occurrences'>('patterns');
  const [drawerFinding, setDrawerFinding] = useState<NormalizedFinding | null>(null);
  const [copiedPatch, setCopiedPatch] = useState(false);

  // Local acknowledgment state
  const [acknowledgedIds, setAcknowledgedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('cs_acked_findings') || '[]');
    } catch {
      return [];
    }
  });

  const { data: findingsData, isLoading } = useQuery({
    queryKey: ['findings-all'],
    queryFn: () => findings.list({ limit: 100 }),
    refetchInterval: 15_000,
  });

  const rawItems = findingsData?.findings ?? [];

  // Normalize all raw findings with presentation mapper
  const normalizedItems: NormalizedFinding[] = useMemo(() => {
    return rawItems.map((f: any) => normalizeFinding(f, acknowledgedIds));
  }, [rawItems, acknowledgedIds]);

  // Group unique vulnerability patterns
  const patterns: UniqueFindingPattern[] = useMemo(() => {
    return groupFindingsByPattern(rawItems, acknowledgedIds);
  }, [rawItems, acknowledgedIds]);

  // Filtered patterns
  const filteredPatterns = useMemo(() => {
    return patterns.filter((p) => {
      const currentStatus = p.allAcknowledged ? 'acknowledged' : 'open';
      if (severityFilter !== 'ALL' && p.severity !== severityFilter) return false;
      if (statusFilter !== 'ALL' && currentStatus !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.title.toLowerCase().includes(q) ||
          p.representativeFinding.rule.toLowerCase().includes(q) ||
          p.filePath.toLowerCase().includes(q) ||
          p.cwe.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [patterns, severityFilter, statusFilter, searchQuery]);

  // Filtered occurrences
  const filteredOccurrences = useMemo(() => {
    return normalizedItems.filter((f) => {
      const currentStatus = f.acknowledged ? 'acknowledged' : 'open';
      if (severityFilter !== 'ALL' && f.severity !== severityFilter) return false;
      if (statusFilter !== 'ALL' && currentStatus !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          f.title.toLowerCase().includes(q) ||
          f.rule.toLowerCase().includes(q) ||
          f.filePath.toLowerCase().includes(q) ||
          f.cwe.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [normalizedItems, severityFilter, statusFilter, searchQuery]);

  const toggleStatus = (id: string) => {
    setAcknowledgedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem('cs_acked_findings', JSON.stringify(next));
      return next;
    });
  };

  const handleCopyPatch = () => {
    if (!drawerFinding) return;
    navigator.clipboard.writeText(drawerFinding.safeCodeDiff);
    setCopiedPatch(true);
    setTimeout(() => setCopiedPatch(false), 2000);
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 p-4 md:gap-11 md:p-8">
      {/* ── 1. PAGE HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Vulnerabilities</h1>
        <p className="text-zinc-400">
          Security flaws and AST findings detected across monitored pull requests
        </p>
      </div>

      {/* ── 2. METADATA CHIPS & CONTROLS ───────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center md:justify-between">
          <div className="contents md:flex md:flex-wrap md:items-center md:gap-2">
            <div className="agndex-meta-chip font-medium text-white">
              <ProjectIcon className="size-4 text-zinc-400" />
              CodeSentinel Workspace
            </div>
            <div className="agndex-meta-chip">
              <ShieldAlertIcon className="size-4 text-red-400" />
              <span>
                {viewMode === 'patterns'
                  ? `${filteredPatterns.length} Pattern(s)`
                  : `${filteredOccurrences.length} Review Flaw(s)`}
              </span>
            </div>
          </div>

          <div className="relative flex-1 md:max-w-xs">
            <Search className="size-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vulnerabilities, CWEs, files..."
              className="agndex-input h-11 pl-10 text-xs"
            />
          </div>
        </div>

        {/* View Mode Toggle & Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {/* Segmented View Mode Toggle */}
          <div className="flex items-center rounded-lg bg-[#202227] p-1 border border-white/5">
            <button
              type="button"
              onClick={() => setViewMode('patterns')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'patterns'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Layers size={13} />
              <span>Unique Patterns ({patterns.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('occurrences')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'occurrences'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ListFilter size={13} />
              <span>All Occurrences ({normalizedItems.length})</span>
            </button>
          </div>

          {/* Severity & Status Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-500 mr-1">Severity:</span>
              {(['ALL', 'ERROR', 'WARNING'] as const).map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSeverityFilter(sev)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    severityFilter === sev
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {sev === 'ALL' ? 'All' : sev === 'ERROR' ? 'Critical' : 'High'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-500 mr-1">Status:</span>
              {(['ALL', 'open', 'acknowledged'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    statusFilter === st
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {st === 'ALL' ? 'All Status' : st === 'open' ? 'Open' : 'Acknowledged'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. HORIZONTAL DIVIDER ──────────────────────────────────────────── */}
      <div className="border-t border-white/10" />

      {/* ── 4. FINDINGS CONTENT ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h3 className="font-semibold text-white tracking-tight">
              {viewMode === 'patterns'
                ? `${filteredPatterns.length} Distinct Pattern(s)`
                : `${filteredOccurrences.length} Recorded Issue(s)`}
            </h3>
            <span className="text-xs text-zinc-400 font-normal">
              ({viewMode === 'patterns' ? 'Deduplicated' : 'Chronological'})
            </span>
          </div>
        </div>

        {/* List Content */}
        <div className="flex flex-col gap-3">
          {isLoading ? (
            <div className="rounded-xl border border-white/5 bg-[#202227] p-8 text-center text-sm text-zinc-400">
              Loading security findings...
            </div>
          ) : viewMode === 'patterns' ? (
            /* ── A. PATTERNS VIEW ─────────────────────────────────────────── */
            filteredPatterns.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-[#202227] p-8 text-center text-sm text-zinc-400">
                No vulnerability patterns match the current filter.
              </div>
            ) : (
              filteredPatterns.map((pattern) => {
                const rep = pattern.representativeFinding;
                const isCritical = pattern.severity === 'ERROR';

                return (
                  <div
                    key={pattern.patternId}
                    onClick={() => setDrawerFinding(rep)}
                    className="flex items-center justify-between gap-3 rounded-xl bg-[#202227] px-3.5 py-3 transition-colors hover:bg-[#262930] md:pr-4 border border-white/5 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 overflow-hidden md:gap-4">
                      <div
                        className={`flex size-11 items-center justify-center rounded-lg border shrink-0 ${
                          isCritical
                            ? 'border-red-500/20 bg-red-500/10 text-red-400'
                            : 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        <ShieldAlertIcon className="size-5" />
                      </div>

                      <div className="flex flex-col gap-1 overflow-hidden">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge
                            status={isCritical ? 'critical' : 'high'}
                            label={`${pattern.severityLabel.toUpperCase()} · ${pattern.cwe}`}
                            variant="subtle"
                            size="xs"
                          />
                          <p className="truncate text-xs font-medium tracking-tight text-white group-hover:text-white">
                            {pattern.title}
                          </p>
                          <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400 font-mono">
                            {pattern.occurrenceCount} {pattern.occurrenceCount === 1 ? 'occurrence' : 'occurrences'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-zinc-400">
                          <span className="font-mono text-zinc-300">
                            {pattern.filePath}:{pattern.line}
                          </span>
                          <span className="size-1 rounded-full bg-zinc-600" />
                          <span>local/controlled-fixture</span>
                          <span className="size-1 rounded-full bg-zinc-600" />
                          <StatusBadge
                            status={pattern.allAcknowledged ? 'acknowledged' : 'open'}
                            label={pattern.allAcknowledged ? 'Acknowledged' : 'Open'}
                            size="xs"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDrawerFinding(rep);
                        }}
                        className="agndex-btn-outline h-9 px-3 text-xs"
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            /* ── B. OCCURRENCES VIEW ──────────────────────────────────────── */
            filteredOccurrences.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-[#202227] p-8 text-center text-sm text-zinc-400">
                No vulnerability occurrences match the current filter.
              </div>
            ) : (
              filteredOccurrences.map((finding) => {
                const isCritical = finding.severity === 'ERROR';

                return (
                  <div
                    key={finding.id}
                    onClick={() => setDrawerFinding(finding)}
                    className="flex items-center justify-between gap-3 rounded-xl bg-[#202227] px-3.5 py-3 transition-colors hover:bg-[#262930] md:pr-4 border border-white/5 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 overflow-hidden md:gap-4">
                      <div
                        className={`flex size-11 items-center justify-center rounded-lg border shrink-0 ${
                          isCritical
                            ? 'border-red-500/20 bg-red-500/10 text-red-400'
                            : 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        <ShieldAlertIcon className="size-5" />
                      </div>

                      <div className="flex flex-col gap-1 overflow-hidden">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge
                            status={isCritical ? 'critical' : 'high'}
                            label={`${finding.severityLabel.toUpperCase()} · ${finding.cwe}`}
                            variant="subtle"
                            size="xs"
                          />
                          <p className="truncate text-xs font-medium tracking-tight text-white">
                            {finding.title}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-zinc-400">
                          <span className="font-mono text-zinc-300">
                            {finding.filePath}:{finding.line}
                          </span>
                          <span className="size-1 rounded-full bg-zinc-600" />
                          <span>{finding.repository}</span>
                          <span className="size-1 rounded-full bg-zinc-600" />
                          <StatusBadge
                            status={finding.acknowledged ? 'acknowledged' : 'open'}
                            label={finding.acknowledged ? 'Acknowledged' : 'Open'}
                            size="xs"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDrawerFinding(finding);
                        }}
                        className="agndex-btn-outline h-9 px-3 text-xs"
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>
      </div>

      {/* ── 5. CONTEXTUAL INVESTIGATION DRAWER / MODAL ─────────────────────── */}
      {drawerFinding && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/70 backdrop-blur-sm">
          <div
            className="fixed inset-0"
            onClick={() => setDrawerFinding(null)}
          />
          <div className="relative flex h-full w-full max-w-xl flex-col justify-between overflow-y-auto bg-[#18191D] border-l border-white/10 p-6 z-50 shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex flex-col gap-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-red-500/20 px-2.5 py-1 text-xs font-bold text-red-400 uppercase tracking-wide border border-red-500/30">
                    {drawerFinding.severityLabel.toUpperCase()} · {drawerFinding.cwe}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {drawerFinding.acknowledged ? 'Status: Acknowledged' : 'Status: Active Flaw'}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Close investigation drawer"
                  onClick={() => setDrawerFinding(null)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-white/5"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Title & Description */}
              <div className="flex flex-col gap-1.5">
                <h2 className="text-lg font-semibold text-white tracking-tight">
                  {drawerFinding.title}
                </h2>
                <p className="text-xs text-[#818CF8]">
                  {drawerFinding.cwe}: {drawerFinding.cweTitle}
                </p>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  {drawerFinding.explanation}
                </p>
              </div>

              {/* Metadata strip */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/5 bg-[#202227] p-3">
                  <span className="text-xs text-zinc-500 block">Repository File & Line</span>
                  <span className="font-mono text-xs text-zinc-200 mt-1 block truncate" title={drawerFinding.filePath}>
                    {drawerFinding.filePath}:{drawerFinding.line}
                  </span>
                </div>
                <div className="rounded-xl border border-white/5 bg-[#202227] p-3">
                  <span className="text-xs text-zinc-500 block">Analysis Engine</span>
                  <span className="text-xs text-zinc-200 mt-1 block">
                    Semgrep CLI 1.181.0 (AST)
                  </span>
                </div>
              </div>

              {/* Technical Diagnostics */}
              <div className="rounded-xl border border-white/5 bg-[#202227] p-3 flex flex-col gap-1.5">
                <span className="text-xs text-zinc-500 font-medium">Technical Diagnostics</span>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">Rule ID:</span>
                  <span className="text-zinc-200">{drawerFinding.rule}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">Target Context:</span>
                  <span className="text-zinc-200">{drawerFinding.repository}</span>
                </div>
              </div>

              {/* AST Syntax Lens */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-white flex items-center gap-1.5">
                  <span>AST Code Diff & Syntax Lens</span>
                </span>
                <div className="rounded-xl border border-white/10 bg-[#0E0F12] p-4 text-xs font-mono leading-relaxed text-zinc-300">
                  <div className="text-zinc-600"># Source file: {drawerFinding.filePath}</div>
                  <pre className="text-zinc-300 whitespace-pre-wrap">{drawerFinding.safeCodeDiff}</pre>
                </div>
              </div>

              {/* Remediation Advice */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white">Actionable Remediation</span>
                  <button
                    type="button"
                    onClick={handleCopyPatch}
                    className="agndex-btn-outline h-7 px-2 text-[11px] gap-1"
                  >
                    {copiedPatch ? <CheckIcon className="size-3 text-emerald-400" /> : <CopyIcon className="size-3" />}
                    <span>{copiedPatch ? 'Copied' : 'Copy Patch'}</span>
                  </button>
                </div>
                <div className="rounded-xl border border-white/5 bg-[#202227] p-3.5 text-xs text-zinc-300 leading-relaxed">
                  {drawerFinding.remediationSummary}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-6 border-t border-white/10 flex items-center justify-between gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  toggleStatus(drawerFinding.id);
                  setDrawerFinding((prev) =>
                    prev ? { ...prev, acknowledged: !prev.acknowledged } : null
                  );
                }}
                className="agndex-btn-outline text-xs h-10 px-4"
              >
                {drawerFinding.acknowledged ? 'Mark as Open' : 'Acknowledge Risk'}
              </button>
              <Link
                to={`/app/scans/${drawerFinding.scanId || 'recent'}`}
                className="agndex-btn-primary text-xs h-10 px-4"
              >
                View Full Audit
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
