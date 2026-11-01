import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ProjectIcon,
  IndexesIcon,
  DocumentIcon,
  CopyIcon,
  CheckIcon,
  ShieldAlertIcon,
} from '../components/ui/AgndexIcons';
import { ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';
import { scans } from '../lib/api';
import { formatRelative, formatDuration, cn } from '../lib/utils';
import { normalizeFinding } from '../lib/findings-mapper';
import { StatusBadge } from '../components/ui/StatusBadge';

export default function ScanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [copiedJson, setCopiedJson] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['scan', id],
    queryFn: () => scans.get(id!),
    enabled: Boolean(id),
  });

  const scan = data?.item;

  const copyScanJson = () => {
    if (!scan) return;
    navigator.clipboard.writeText(JSON.stringify(scan, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 p-4 md:gap-11 md:p-8">
        <div className="rounded-xl border border-white/5 bg-[#202227] p-8 text-center text-sm text-zinc-400">
          Loading scan record...
        </div>
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:gap-8 md:p-8 text-center">
        <div className="size-12 rounded-2xl bg-red-500/10 text-red-400 mx-auto flex items-center justify-center">
          <AlertTriangle size={24} />
        </div>
        <h2 className="text-xl font-bold text-white">Scan Record Not Found</h2>
        <p className="text-xs text-zinc-400">
          The requested audit record does not exist or has been purged.
        </p>
        <button
          onClick={() => navigate('/app/scans')}
          className="agndex-btn-primary mx-auto text-xs"
        >
          <ArrowLeft size={14} /> Back to Scan History
        </button>
      </div>
    );
  }

  const findingsList = scan.findings || [];
  const findingCount = findingsList.length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 p-4 md:gap-11 md:p-8">
      {/* ── 1. BREADCRUMB & HEADER ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <Link
          to="/app/scans"
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Scan History</span>
        </Link>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {scan.repository || 'local/controlled-fixture'}
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Pull Request review completed {formatRelative(scan.at || new Date().toISOString())}
            </p>
          </div>

          <button
            type="button"
            onClick={copyScanJson}
            className="agndex-btn-outline h-9 px-3 text-xs gap-1.5 self-start md:self-auto"
          >
            {copiedJson ? <CheckIcon className="size-3.5 text-emerald-400" /> : <CopyIcon className="size-3.5" />}
            <span>{copiedJson ? 'Copied JSON' : 'Export JSON'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. METADATA CHIPS ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center md:gap-2">
        <div className="agndex-meta-chip font-medium text-white">
          <ProjectIcon className="size-4 text-zinc-400" />
          PR #{scan.prNumber || 12}
        </div>
        <div className="agndex-meta-chip">
          <IndexesIcon className="size-4 text-zinc-400" />
          {findingCount} {findingCount === 1 ? 'issue' : 'issues'}
        </div>
        <div className="agndex-meta-chip">
          <DocumentIcon className="size-4 text-zinc-400" />
          Duration: {formatDuration(scan.durationMs || 1024)}
        </div>
      </div>

      {/* ── 3. HORIZONTAL DIVIDER ──────────────────────────────────────────── */}
      <div className="border-t border-white/10" />

      {/* ── 4. DETECTED FINDINGS LIST ──────────────────────────────────────── */}
      <div className="flex flex-col gap-6 md:gap-8">
        {scan.status !== 'completed' && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-300 flex flex-col gap-2">
            <div className="flex items-center gap-2 font-medium text-red-200">
              <AlertTriangle className="size-4 text-red-400 shrink-0" />
              <span>Scanner Execution Notice: Status is &ldquo;{scan.status}&rdquo; (Verdict: {scan.verdict || 'execution_failed'})</span>
            </div>
            {scan.warning && (
              <p className="text-zinc-300 font-mono text-[11px] bg-black/30 p-2.5 rounded border border-white/5 whitespace-pre-wrap">
                {scan.warning}
              </p>
            )}
            <p className="text-zinc-400">
              A zero-finding result from a failed scanner process is not equivalent to a clean security review. Semgrep must execute with exit code 0 to certify clean code.
            </p>
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <h2 className="font-semibold text-white text-base tracking-tight">Detected Vulnerabilities</h2>
          <span className="text-xs text-zinc-400 font-normal">
            ({findingCount} {findingCount === 1 ? 'issue' : 'issues'})
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {findingCount === 0 ? (
            <div className="rounded-xl border border-white/5 bg-[#202227] p-8 text-center text-sm text-zinc-400">
              No security vulnerabilities detected in this review.
            </div>
          ) : (
            findingsList.map((finding: any) => {
              const norm = normalizeFinding(finding);
              return (
                <div
                  key={norm.id}
                  className="flex flex-col gap-3 rounded-xl border border-white/5 bg-[#202227] p-4"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge
                        status={norm.severity === 'ERROR' ? 'critical' : 'high'}
                        label={`${norm.severityLabel.toUpperCase()} · ${norm.cwe}`}
                        variant="subtle"
                        size="xs"
                      />
                      <span className="text-xs font-medium text-white">
                        {norm.title}
                      </span>
                      <span className="font-mono text-[11px] text-zinc-400 bg-white/5 px-2 py-0.5 rounded">
                        {norm.rule}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-zinc-300">
                      {norm.filePath}:{norm.line}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-400">
                    {norm.explanation}
                  </p>

                  <div className="rounded-lg border border-white/10 bg-[#0E0F12] p-3 text-xs font-mono text-zinc-300">
                    <div className="text-zinc-600 mb-1"># Target: {norm.filePath}</div>
                    <pre className="text-zinc-300 whitespace-pre-wrap">{norm.safeCodeDiff}</pre>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── 5. EXECUTION PARAMETERS ────────────────────────────────────────── */}
      <div className="border-t border-white/10" />

      <div className="flex flex-col gap-4">
        <h2 className="font-medium text-white">Execution Profile</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-white/5 bg-[#202227] p-4">
            <span className="text-xs text-zinc-500 block">Static Engine</span>
            <span className="text-sm font-medium text-zinc-200 mt-1 block">
              Semgrep CLI 1.181.0
            </span>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#202227] p-4">
            <span className="text-xs text-zinc-500 block">Isolation Boundary</span>
            <span className="text-sm font-medium text-zinc-200 mt-1 block">
              Ephemeral File Isolation (POSIX 0600)
            </span>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#202227] p-4">
            <span className="text-xs text-zinc-500 block">Scanned Target</span>
            <span className="text-sm font-mono text-zinc-200 mt-1 block truncate" title={scan.scannedTarget || scan.target || 'fixtures/demo'}>
              {scan.scannedTarget || scan.target || 'fixtures/demo'}
            </span>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#202227] p-4">
            <span className="text-xs text-zinc-500 block">Scanner Verdict</span>
            <span className={cn(
              'text-sm font-medium mt-1 block capitalize',
              scan.status === 'completed' && findingCount === 0 ? 'text-emerald-400' :
              scan.status === 'completed' ? 'text-red-400' : 'text-amber-400'
            )}>
              {scan.verdict || (scan.status === 'completed' ? (findingCount > 0 ? 'Flaws Detected' : 'Clean') : scan.status)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
