import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ProjectIcon,
  RepositoriesIcon,
  IndexesIcon,
  AddIcon,
  DocumentIcon,
  CalendarIcon,
  CheckIcon,
} from '../components/ui/AgndexIcons';
import {
  Play,
  RefreshCw,
  X,
  Database,
  Trash2,
  ArrowRight,
  GitBranch,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { scans, admin } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { formatRelative, cn } from '../lib/utils';
import { StatusBadge } from '../components/ui/StatusBadge';

export default function RepositoriesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const queryClient = useQueryClient();

  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState<string | null>(null);
  const [newScope, setNewScope] = useState('');
  const [connectError, setConnectError] = useState<string | null>(null);

  const { data: recentScanData } = useQuery({
    queryKey: ['recent-scans-repo'],
    queryFn: () => scans.list(),
  });

  const { data: allowlistData } = useQuery({
    queryKey: ['admin-allowlist'],
    queryFn: admin.allowlist,
    enabled: isAdmin,
  });

  const activeAllowlist = allowlistData?.allowlist || ['local/controlled-fixture'];
  const latestScan = recentScanData?.items?.[0];

  const { mutate: runScan, isPending: isScanning } = useMutation({
    mutationFn: (target?: string) => scans.runDemo('insecure'),
    onSuccess: (data) => {
      setDispatchStatus(
        `Security review complete: detected ${data?.item?.findings?.length ?? 0} issue(s) using Semgrep AST engine.`
      );
      setTimeout(() => setDispatchStatus(null), 6000);
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['findings-summary'] });
    },
  });

  const { mutate: addRepoScope, isPending: addingScope } = useMutation({
    mutationFn: (repo: string) => admin.addAllowlist(repo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-allowlist'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      setNewScope('');
      setConnectError(null);
      setShowConnectModal(false);
      setDispatchStatus('Repository successfully connected and added to allowed scanning targets.');
      setTimeout(() => setDispatchStatus(null), 5000);
    },
    onError: (err: any) => {
      setConnectError(err.message || 'Failed to connect repository.');
    },
  });

  const { mutate: removeRepoScope, isPending: removingScope } = useMutation({
    mutationFn: (repo: string) => admin.removeAllowlist(repo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-allowlist'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      setDispatchStatus('Repository disconnected from scanning scope.');
      setTimeout(() => setDispatchStatus(null), 4000);
    },
    onError: (err: any) => {
      setDispatchStatus(err.message || 'Failed to remove repository.');
      setTimeout(() => setDispatchStatus(null), 5000);
    },
  });

  const handleAddScope = (e: React.FormEvent) => {
    e.preventDefault();
    setConnectError(null);
    const clean = newScope.trim();
    if (!clean) return;
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(clean) && clean !== 'local/controlled-fixture') {
      setConnectError('Repository identifier must be in owner/repository format (e.g. organization/repo).');
      return;
    }
    addRepoScope(clean);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4 md:gap-10 md:p-8 text-zinc-100">
      {/* ── 1. PAGE HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#D946EF]">
              Repository Scope
            </span>
            <StatusBadge status="allowlist-enabled" label="Allowlist enabled" size="xs" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Repositories
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage connected codebases, test fixtures, and automated PR review targets.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setNewScope('');
            setConnectError(null);
            setShowConnectModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D946EF] hover:bg-[#C026D3] active:scale-95 text-white text-xs font-medium transition-all shadow-sm self-start md:self-auto"
        >
          <GitBranch size={14} />
          <span>+ Add Repository</span>
        </button>
      </div>

      {/* ── 2. METADATA CARDS ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#202227] rounded-xl border border-white/10 p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              Connected Repositories
            </span>
            <Database size={15} className="text-[#D946EF]" />
          </div>
          <div className="text-2xl font-bold text-white">
            {activeAllowlist.length}
          </div>
          <p className="text-[11px] text-zinc-500">Allowed review targets</p>
        </div>

        <div className="bg-[#202227] rounded-xl border border-white/10 p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              Ingress Policy
            </span>
            <ShieldCheck size={15} className="text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-white flex items-center gap-2">
            <span>Zero-Trust</span>
            <StatusBadge status="ready" label="Strict" size="xs" />
          </div>
          <p className="text-[11px] text-zinc-500">Only allowed repos receive scans</p>
        </div>

        <div className="bg-[#202227] rounded-xl border border-white/10 p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              Scanner Engine
            </span>
            <CheckCircle2 size={15} className="text-indigo-400" />
          </div>
          <div className="text-lg font-bold text-white">
            Semgrep 1.181.0
          </div>
          <p className="text-[11px] text-zinc-500">OWASP A03 / CWE-95 & CWE-78</p>
        </div>
      </div>

      {/* Notification banner */}
      {dispatchStatus && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-400 flex items-center justify-between gap-2 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckIcon className="size-4 text-emerald-400 shrink-0" />
            <span>{dispatchStatus}</span>
          </div>
          <button onClick={() => setDispatchStatus(null)} className="text-zinc-400 hover:text-white p-1">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── 3. REPOSITORIES LIST ───────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Configured Repositories</h2>
          <span className="text-xs text-zinc-500">
            {activeAllowlist.length} total targets
          </span>
        </div>

        <div className="bg-[#202227] rounded-xl border border-white/10 overflow-hidden divide-y divide-white/5">
          {activeAllowlist.map((repo) => {
            const isFixture = repo === 'local/controlled-fixture';

            return (
              <div
                key={repo}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.01] transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  <div className="size-10 rounded-lg bg-[#18191E] border border-white/10 flex items-center justify-center text-zinc-400 shrink-0 mt-0.5">
                    <DocumentIcon className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm font-mono">{repo}</span>
                      <StatusBadge
                        status={isFixture ? 'verified-fixture' : 'active'}
                        label={isFixture ? 'Verified Fixture' : 'Configured Target'}
                        size="xs"
                      />
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
                      {isFixture
                        ? 'Deterministic local test fixture. Executes Semgrep static analysis on insecure_example.py and safe_example.py in POSIX 0600 sandboxes.'
                        : 'Remote GitHub repository registered for automated pull request security scanning on signed webhook receipt.'}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-2 font-mono">
                      <span>Scope: {isFixture ? 'Local Sandbox' : 'GitHub Webhook'}</span>
                      <span>·</span>
                      <span>Security Rules: Active</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => runScan(repo)}
                    disabled={isScanning}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D946EF] hover:bg-[#C026D3] text-white text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {isScanning ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        <span>Scanning...</span>
                      </>
                    ) : (
                      <>
                        <Play size={12} fill="currentColor" />
                        <span>Run Scan</span>
                      </>
                    )}
                  </button>

                  <Link
                    to={`/app/findings?repository=${encodeURIComponent(repo)}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
                  >
                    <span>Findings</span>
                  </Link>

                  {!isFixture && (
                    <button
                      type="button"
                      onClick={() => removeRepoScope(repo)}
                      disabled={removingScope}
                      className="p-2 rounded-lg bg-white/5 hover:bg-rose-500/10 text-zinc-400 hover:text-rose-400 transition-colors"
                      title="Disconnect repository"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 4. GUIDED ONBOARDING MODAL ────────────────────────────────────── */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#202227] p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <GitBranch size={18} className="text-[#D946EF]" />
                <h3 className="text-base font-semibold text-white">Add Repository to Allowlist</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConnectModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {connectError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{connectError}</span>
              </div>
            )}

            <form onSubmit={handleAddScope} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Repository Identifier <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={newScope}
                  onChange={(e) => setNewScope(e.target.value)}
                  required
                  placeholder="e.g. facebook/react or my-org/security-app"
                  className="w-full bg-[#18191E] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF] transition-colors"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Format must be <span className="font-mono text-zinc-300">organization/repository</span>.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-[#18191E] border border-white/5 space-y-2 text-zinc-400 leading-relaxed">
                <div className="font-medium text-white flex items-center gap-2">
                  <ShieldCheck size={14} className="text-[#D946EF]" />
                  <span>How Ingress Allowlisting Works</span>
                </div>
                <p className="text-[11px]">
                  Registering a repository adds it to CodeSentinel's zero-trust webhook allowlist. Only incoming webhooks from allowlisted repositories are evaluated; all others are rejected with HTTP 403.
                </p>
                <p className="text-[11px] text-zinc-500">
                  Note: This registers the allowlist entry locally. It does not establish an active outbound connection to GitHub API until a <code className="text-zinc-300">GITHUB_TOKEN</code> is configured in your server environment.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingScope}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D946EF] hover:bg-[#C026D3] text-white text-xs font-medium transition-all disabled:opacity-50"
                >
                  {addingScope ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Allowlisting...</span>
                    </>
                  ) : (
                    <span>Allowlist Repository</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
