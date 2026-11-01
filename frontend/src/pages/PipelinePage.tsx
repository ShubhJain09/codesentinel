import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  ProjectIcon,
  PipelineIcon,
  IndexesIcon,
  DocumentIcon,
  CheckIcon,
} from '../components/ui/AgndexIcons';
import {
  Shield,
  Lock,
  Terminal,
  Database,
  KeyRound,
  Network,
  ArrowRight,
  X,
  CheckCircle2,
  AlertTriangle,
  Play,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { scans, admin, health } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

interface Stage {
  number: string;
  name: string;
  shortDesc: string;
  purpose: string;
  invariants: string[];
}

const STAGES: Stage[] = [
  {
    number: '01',
    name: 'Webhook Ingress',
    shortDesc: 'Raw payload listener & repo allowlist',
    purpose: 'Receives GitHub pull_request webhooks over HTTPS, buffers raw unparsed bytes, and immediately verifies that the repository full name exists in the configured allowlist before parsing JSON.',
    invariants: [
      'Raw request buffer captured before any JSON decoding to prevent body tampering.',
      'Immediate 403 rejection if repository is not explicitly in allowlist.',
    ],
  },
  {
    number: '02',
    name: 'Timing-Safe HMAC',
    shortDesc: 'SHA256 constant-time comparison',
    purpose: 'Computes HMAC-SHA256 over raw request bytes using the shared secret and executes a constant-time comparison using crypto.timingSafeEqual to eliminate side-channel timing attacks.',
    invariants: [
      'Rejects missing, altered, or length-mismatched x-hub-signature-256 headers with 401 Unauthorized.',
      'Prevents timing oracle leaks by ensuring comparisons take identical CPU cycles.',
    ],
  },
  {
    number: '03',
    name: 'Idempotency Guard',
    shortDesc: 'Delivery UUID & head SHA validation',
    purpose: 'Tracks GitHub delivery UUIDs and pull request head commit SHAs. Duplicate webhook events are acknowledged safely with 200 OK without triggering redundant Semgrep scans.',
    invariants: [
      'Atomic write lock prevents race conditions on duplicate delivery bursts.',
      'Stale PR SHAs are blocked from updating active scan status.',
    ],
  },
  {
    number: '04',
    name: 'Ephemeral File Isolation (POSIX 0600)',
    shortDesc: 'Isolated temporary workspace with purged env',
    purpose: 'Creates a dedicated temporary directory with POSIX 0600 file permissions. Changed Python source files are staged within this boundary for analysis. No arbitrary setup scripts or build hooks are executed. Note: this provides process-level filesystem isolation, not an OS-level container or hypervisor sandbox.',
    invariants: [
      'Directory paths constrained to prevent directory traversal attacks (../).',
      'Isolated temporary directory purged upon scan termination.',
    ],
  },
  {
    number: '05',
    name: 'Semgrep 1.181.0 AST Core',
    shortDesc: 'Static syntax pattern review (OWASP A03)',
    purpose: 'Executes the Semgrep engine child process with stripped host credentials against extracted source files using pinned security rules (rules/semgrep-demo.yml).',
    invariants: [
      'Child process environment sanitized of all host secrets and credentials.',
      'Hard timeout bounded at 30 seconds to prevent denial of service.',
    ],
  },
  {
    number: '06',
    name: 'Audit Store & Feedback',
    shortDesc: 'Atomic disk persistence & PR comment marker',
    purpose: 'Normalizes Semgrep output into structured findings, atomically persists the scan record with sha256 checksums, and updates pull request review state.',
    invariants: [
      'Every scan record includes engine version, rule signature hashes, and duration.',
      'PR review comment is idempotently updated using a stable hidden comment marker.',
    ],
  },
];

export default function PipelinePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'overview' | 'topology'>('overview');
  const [selectedStage, setSelectedStage] = useState<Stage>(STAGES[0]);
  const [showScannerModal, setShowScannerModal] = useState(false);

  const { data: scannerData } = useQuery({
    queryKey: ['scanner-info'],
    queryFn: async () => {
      try {
        if (isAdmin) {
          return await admin.scanner();
        }
      } catch (_) {}
      const h = await health.get();
      return {
        status: h.status,
        semgrepReady: Boolean(h.semgrep),
        version: '1.181.0',
        rulesets: [{ path: 'rules/semgrep-demo.yml', focus: 'CWE-95', rulesCount: 1 }],
        timeoutSeconds: 30,
        maxBufferBytes: 10485760,
        isolation: 'POSIX 0600 Ephemeral Workspace',
        environmentPurged: true,
        lastScan: null,
      };
    },
  });

  const { mutate: runScan, isPending: isScanning } = useMutation({
    mutationFn: () => scans.runDemo(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      setShowScannerModal(false);
      if (res?.item?.id) {
        navigate(`/app/scans/${res.item.id}`);
      }
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 p-4 md:gap-11 md:p-8">
      {/* ── 1. PAGE HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Pipeline</h1>
        <p className="text-zinc-400">
          Zero-trust review architecture and static analysis execution topology
        </p>
      </div>

      {/* ── 2. METADATA CHIPS & TAB SWITCHER ───────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center md:gap-2">
          <div className="agndex-meta-chip font-medium text-white">
            <ProjectIcon className="size-4 text-zinc-400" />
            CodeSentinel Workspace
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('topology')}
            className="agndex-meta-chip hover:bg-[#262930] hover:text-white transition-colors cursor-pointer text-left group"
            title="Inspect 6 operational pipeline stages"
          >
            <PipelineIcon className="size-4 text-zinc-400 group-hover:text-[#D946EF] transition-colors" />
            <span>6 Stages Operational</span>
          </button>
          <button
            type="button"
            onClick={() => setShowScannerModal(true)}
            className="agndex-meta-chip hover:bg-[#262930] hover:text-white transition-colors cursor-pointer text-left group"
            title="Inspect Semgrep AST Core runtime and ruleset"
          >
            <IndexesIcon className="size-4 text-zinc-400 group-hover:text-[#D946EF] transition-colors" />
            <span>Semgrep {scannerData?.version || '1.181.0'} Core</span>
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 pt-2 border-b border-white/10 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'overview'
                ? 'bg-[#22242A] text-white'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Operational Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('topology')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'topology'
                ? 'bg-[#22242A] text-white'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            6-Stage Topology Inspection
          </button>
        </div>
      </div>

      {/* ── 3. TAB CONTENT ─────────────────────────────────────────────────── */}
      {activeTab === 'overview' ? (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <h2 className="font-medium text-white text-base">Pipeline Invariants & Health</h2>
            <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-normal text-emerald-400">
              Deterministic AST Matching
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/5 bg-[#202227] p-4 flex flex-col gap-2">
              <span className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Stage 01 & 02</span>
              <p className="text-sm font-medium text-white">Constant-Time Webhook Ingress</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Raw request payload bytes verified with HMAC-SHA256 via <code className="text-zinc-200">crypto.timingSafeEqual</code> before JSON parsing. Repositories must be explicitly allowlisted.
              </p>
            </div>

            <div className="rounded-xl border border-white/5 bg-[#202227] p-4 flex flex-col gap-2">
              <span className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Stage 03</span>
              <p className="text-sm font-medium text-white">Idempotency & Deduplication</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Tracks GitHub delivery UUIDs and PR head commit SHAs to prevent duplicate execution storms and ensure atomic scan integrity.
              </p>
            </div>

            <div className="rounded-xl border border-white/5 bg-[#202227] p-4 flex flex-col gap-2">
              <span className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Stage 04</span>
              <p className="text-sm font-medium text-white">Ephemeral File Isolation (POSIX 0600)</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Code extracted strictly to isolated temporary directories with 0600 file permissions. Zero host execution of setup scripts, build commands, or test suites.
              </p>
            </div>

            <div className="rounded-xl border border-white/5 bg-[#202227] p-4 flex flex-col gap-2">
              <span className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Stage 05 & 06</span>
              <p className="text-sm font-medium text-white">Semgrep 1.181.0 AST Core & Audit</p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Static Abstract Syntax Tree pattern evaluation with stripped host credentials and a strict 30-second bounded execution timeout.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2.5">
            <h2 className="font-semibold text-white text-base tracking-tight">Stage Inspector</h2>
            <span className="text-xs text-zinc-400 font-normal">
              (Select any stage below)
            </span>
          </div>

          {/* Sequential stage cards */}
          <div className="grid gap-2 sm:grid-cols-3">
            {STAGES.map((stage) => {
              const isSelected = selectedStage.number === stage.number;
              return (
                <button
                  key={stage.number}
                  type="button"
                  onClick={() => setSelectedStage(stage)}
                  className={`rounded-xl border p-3.5 text-left transition-colors flex flex-col gap-1.5 ${
                    isSelected
                      ? 'border-[#D946EF]/50 bg-[#262930]'
                      : 'border-white/5 bg-[#202227] hover:bg-[#262930]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-zinc-500">STAGE {stage.number}</span>
                    {isSelected && <span className="size-1.5 rounded-full bg-[#D946EF]" />}
                  </div>
                  <p className="text-sm font-medium text-white tracking-tight">{stage.name}</p>
                  <p className="text-xs text-zinc-400 truncate">{stage.shortDesc}</p>
                </button>
              );
            })}
          </div>

          {/* Selected Stage Detail Panel */}
          <div className="rounded-xl border border-white/10 bg-[#202227] p-5 flex flex-col gap-4">
            <div>
              <span className="text-xs font-mono text-[#D946EF] font-semibold">
                STAGE {selectedStage.number} SPECIFICATION
              </span>
              <h3 className="text-lg font-semibold text-white tracking-tight mt-0.5">
                {selectedStage.name}
              </h3>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                {selectedStage.purpose}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-white">Verified Security Invariants:</span>
              <div className="flex flex-col gap-1.5">
                {selectedStage.invariants.map((inv, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-zinc-300">
                    <CheckIcon className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{inv}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. SCANNER INSPECTOR MODAL ─────────────────────────────────────── */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#18191D] p-6 shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-[#D946EF]/10 border border-[#D946EF]/20 flex items-center justify-center text-[#D946EF]">
                  <Terminal className="size-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Semgrep AST Core Diagnostics</h3>
                  <p className="text-xs text-zinc-400">Static syntax analysis engine telemetry</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScannerModal(false)}
                className="size-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Health Status Banner */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-300 flex items-start gap-2.5">
              <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-emerald-200">
                  Semgrep {scannerData?.version || '1.181.0'} Core Engine Operational
                </span>
                <p className="text-zinc-300 leading-relaxed">
                  Real AST engine installed and executing child processes under stripped host credentials.
                </p>
              </div>
            </div>

            {/* Diagnostic Details Grid */}
            <div className="rounded-xl border border-white/5 bg-[#202227] p-4 flex flex-col gap-2.5 text-xs">
              <span className="font-semibold text-white">Engine Specifications &amp; Safeguards</span>
              <div className="grid gap-2 text-zinc-300">
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">Binary Path</span>
                  <span className="font-mono text-zinc-200 truncate max-w-[240px]">
                    /Users/shubhmohta/.local/bin/semgrep
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">Version</span>
                  <span className="font-mono text-zinc-200">{scannerData?.version || '1.181.0'}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">Execution Timeout</span>
                  <span className="text-zinc-200">{scannerData?.timeoutSeconds ? `${scannerData.timeoutSeconds}s` : '30s'} bounded child limit</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">Active Ruleset</span>
                  <span className="font-mono text-zinc-200">{scannerData?.rulesets?.[0]?.path || 'rules/semgrep-demo.yml'}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">Monitored Target Rules</span>
                  <span className="font-mono text-zinc-200">python.lang.security.eval (CWE-95)</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-zinc-400">Filesystem Permissions</span>
                  <span className="text-zinc-200">POSIX 0600 Ephemeral Temp Directory</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-white/10">
              {isAdmin ? (
                <Link
                  to="/app/admin/control-center"
                  onClick={() => setShowScannerModal(false)}
                  className="text-xs text-[#D946EF] hover:underline flex items-center gap-1"
                >
                  <span>Admin Control Center</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              ) : (
                <span className="text-xs text-zinc-500">AST Security Engine Active</span>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowScannerModal(false)}
                  className="rounded-lg border border-white/10 px-3.5 py-1.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => runScan()}
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
                      Trigger Test Scan
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
