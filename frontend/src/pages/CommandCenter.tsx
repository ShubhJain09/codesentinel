import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import {
  ProjectIcon,
  DeveloperIcon,
  IndexesIcon,
  HistoryIcon,
  SampleIcon,
  AddIcon,
  DocumentIcon,
  CalendarIcon,
} from '../components/ui/AgndexIcons';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ShieldAlert, ArrowRight, RefreshCw, ShieldCheck, X, Settings } from 'lucide-react';
import { scans, stats, findings } from '../lib/api';
import { formatRelative } from '../lib/utils';
import { normalizeFinding } from '../lib/findings-mapper';

export default function CommandCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [scanTarget, setScanTarget] = useState<'all' | 'insecure' | 'safe'>('all');
  const [showOwnerPopover, setShowOwnerPopover] = useState(false);

  // Queries
  const { data: statsData } = useQuery({
    queryKey: ['stats'],
    queryFn: stats.get,
    refetchInterval: 10_000,
  });

  const { data: scansData, isLoading: scansLoading } = useQuery({
    queryKey: ['scans-recent'],
    queryFn: () => scans.list(),
    refetchInterval: 10_000,
  });

  const { data: findingsData } = useQuery({
    queryKey: ['findings-summary'],
    queryFn: () => findings.list({ limit: 10 }),
    refetchInterval: 10_000,
  });

  // Demo scan execution mutation
  const { mutate: runScan, isPending: isScanning } = useMutation({
    mutationFn: (target?: 'all' | 'insecure' | 'safe') => scans.runDemo(target),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      queryClient.invalidateQueries({ queryKey: ['scans-recent'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['findings-summary'] });
    },
  });

  const recentScans = scansData?.items?.slice(0, 5) ?? [];
  const rawFindings = findingsData?.findings ?? [];
  const uniqueRuleFindings = rawFindings.reduce((acc, f) => {
    if (!acc.some((x) => x.rule === f.rule)) {
      acc.push(f);
    }
    return acc;
  }, [] as typeof rawFindings);

  const defaultProjectName = 'CodeSentinel Workspace';
  const leadFinding = uniqueRuleFindings.length > 0 ? normalizeFinding(uniqueRuleFindings[0]) : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-4 md:gap-10 md:p-8">
      {/* ── 1. PAGE HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Dashboard</h1>
        <p className="text-xs text-zinc-400">Manage security reviews for {defaultProjectName}</p>
      </div>

      {/* ── 2. METADATA CHIPS & PROJECT CONTEXT ───────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="agndex-meta-chip font-medium text-white">
            <ProjectIcon className="size-4 text-zinc-400" />
            <span>{defaultProjectName}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowOwnerPopover(true)}
            className="agndex-meta-chip hover:bg-[#262930] hover:text-white transition-colors cursor-pointer text-left"
            title="Inspect account role & permissions"
          >
            <DeveloperIcon className="size-4 text-[#D946EF]" />
            <span>{user?.role === 'owner' ? 'System Owner' : user?.role === 'admin' ? 'Administrator' : 'Operator'}</span>
          </button>
          <Link
            to="/app/scans"
            className="agndex-meta-chip hover:bg-[#262930] hover:text-white transition-colors cursor-pointer"
            title="View all scan records"
          >
            <IndexesIcon className="size-4 text-zinc-400" />
            <span>{recentScans.length} scans</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/app/pipeline"
            className="agndex-btn-outline h-8 px-2.5 text-xs"
            title="Inspect CI/CD Scanner Pipeline"
          >
            <SampleIcon className="size-3.5 text-zinc-400" />
            <span>Pipeline</span>
          </Link>
          <button
            type="button"
            onClick={() => navigate('/app/scans')}
            className="agndex-btn-outline h-8 px-2.5 text-xs"
          >
            <HistoryIcon className="size-3.5 text-zinc-400" />
            <span>Audit History</span>
          </button>
        </div>
      </div>

      {/* ── 3. HORIZONTAL DIVIDER ──────────────────────────────────────────── */}
      <div className="border-t border-white/10" />

      {/* ── 4. RECENT SECURITY REVIEWS ─────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {/* Coherent Section Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <IndexesIcon className="size-4 text-zinc-400" />
              <h2 className="text-base font-semibold text-white tracking-tight">Recent security reviews</h2>
            </div>
            <p className="text-xs text-zinc-400 pl-6">
              Manage static analysis reviews for {defaultProjectName}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <select
              value={scanTarget}
              onChange={(e) => setScanTarget(e.target.value as 'all' | 'insecure' | 'safe')}
              aria-label="Select scan fixture target"
              className="agndex-input h-9 px-2.5 text-xs bg-[#202227] text-zinc-300 border-white/10 rounded-lg cursor-pointer"
            >
              <option value="all">All Fixtures</option>
              <option value="insecure">Insecure Fixture (CWE-95)</option>
              <option value="safe">Safe Fixture (Clean Baseline)</option>
            </select>
            <button
              type="button"
              onClick={() => runScan(scanTarget)}
              disabled={isScanning}
              className="agndex-btn-primary h-9 px-3.5 text-xs shrink-0"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Reviewing...</span>
                </>
              ) : (
                <>
                  <AddIcon className="size-3.5" />
                  <span>Run Security Scan</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scan List Cards */}
        <div className="flex flex-col gap-2.5 pt-1">
          {scansLoading && recentScans.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-[#202227] p-8 text-center text-xs text-zinc-400">
              Loading security reviews...
            </div>
          ) : recentScans.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-[#202227] p-8 text-center text-xs text-zinc-400">
              No security scans recorded yet. Click &ldquo;Run Security Scan&rdquo; to execute a Semgrep review.
            </div>
          ) : (
            recentScans.map((scan) => {
              const findingsCount = scan.findings?.length ?? 0;
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
                    <div className="flex size-10 items-center justify-center rounded-lg border border-white/10 bg-[#0E0F12] text-zinc-400 shrink-0 group-hover:border-white/20 transition-colors">
                      <DocumentIcon className="size-4" />
                    </div>
                    <div className="flex flex-col gap-1 overflow-hidden">
                      <div className="flex items-center gap-2.5">
                        <p className="truncate text-xs font-medium tracking-tight text-white">
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
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-zinc-400">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="size-3 text-zinc-500" />
                          <span>{formatRelative(scan.at || new Date().toISOString())}</span>
                        </span>
                        <span className="size-1 rounded-full bg-zinc-600" />
                        <span>{scan.source === 'semgrep-fixture' ? 'Fixture Scan' : scan.source}</span>
                        <span className="size-1 rounded-full bg-zinc-600" />
                        <span>Semgrep 1.181.0</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      aria-label="View review record"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/app/scans/${scan.id}`);
                      }}
                      className="size-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-zinc-400 group-hover:text-white transition-colors"
                      title="View review record"
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

      {/* ── 5. SECONDARY SECTION: CONCISE VULNERABILITY SUMMARY ───────────── */}
      {leadFinding && (
        <div className="flex flex-col gap-3 mt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-white flex-wrap">
              <ShieldAlert className="size-3.5 text-rose-400" />
              <span>Actionable Vulnerabilities</span>
              <span className="text-[11px] text-zinc-400 font-normal">
                (1 Pattern · {statsData?.totalFindings ?? 6} historical occurrences)
              </span>
            </div>
            <Link
              to="/app/findings"
              className="flex items-center gap-1 text-xs text-[#D946EF] hover:underline"
            >
              <span>View all findings</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>

          <div className="rounded-xl border border-white/5 bg-[#202227] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge
                  status="critical"
                  label={`${leadFinding.severityLabel.toUpperCase()} · ${leadFinding.cwe}`}
                  variant="subtle"
                  size="xs"
                />
                <span className="text-xs font-medium text-white truncate">
                  {leadFinding.title}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {leadFinding.explanation} Detected in <code className="font-mono text-zinc-300">{leadFinding.filePath}:{leadFinding.line}</code>
              </p>
            </div>

            <Link
              to="/app/findings"
              className="agndex-btn-outline h-8 px-2.5 text-xs shrink-0 self-start sm:self-auto"
            >
              Investigate
            </Link>
          </div>
        </div>
      )}

      {/* ── System Owner / Role Popover Modal ── */}
      {showOwnerPopover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#18191E] p-6 shadow-2xl text-zinc-100 flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="size-5 text-[#D946EF]" />
                <h3 className="text-base font-semibold text-white">Account &amp; Role Permissions</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowOwnerPopover(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#202227] border border-white/5">
              <div className="size-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-mono font-bold text-base text-[#D946EF]">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-white truncate">{user?.name}</span>
                <span className="text-xs text-zinc-400 font-mono truncate">{user?.email}</span>
                <div className="mt-1">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${
                      user?.role === 'owner'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : user?.role === 'admin'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'bg-zinc-800 text-zinc-300 border border-white/10'
                    }`}
                  >
                    {user?.role === 'owner' ? 'System Owner' : user?.role === 'admin' ? 'Administrator' : 'Standard Operator'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs text-zinc-300 leading-relaxed bg-[#202227] p-4 rounded-xl border border-white/5">
              <span className="text-zinc-400 font-medium block mb-1">Assigned Permissions:</span>
              {user?.role === 'owner' ? (
                <p>
                  Complete governance authority. Permitted to modify team roles, manage repository allowlists, inspect Semgrep engine diagnostics, configure GitHub webhooks, and review audit trails.
                </p>
              ) : user?.role === 'admin' ? (
                <p>
                  Operational authority. Permitted to configure repository allowlists, execute scanner diagnostics, and inspect audit logs. User role promotion/demotion is restricted to System Owner.
                </p>
              ) : (
                <p>
                  Standard operator. Authorized to inspect vulnerability findings, review scan history records, and execute controlled fixture scans. Administrative configuration is restricted.
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-white/5">
              <Link
                to="/app/settings"
                onClick={() => setShowOwnerPopover(false)}
                className="w-full sm:w-auto flex-1 agndex-btn-outline justify-center text-xs"
              >
                <Settings className="size-3.5" />
                <span>Account Settings</span>
              </Link>
              {(user?.role === 'owner' || user?.role === 'admin') && (
                <Link
                  to="/app/admin/control-center"
                  onClick={() => setShowOwnerPopover(false)}
                  className="w-full sm:w-auto flex-1 agndex-btn-primary justify-center text-xs"
                >
                  <ShieldCheck className="size-3.5" />
                  <span>Admin Control Center</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
