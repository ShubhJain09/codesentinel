import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  CodeSentinelLogo,
  HomeIcon,
  ShieldAlertIcon,
  HistoryIcon,
  PipelineIcon,
} from '../components/ui/AgndexIcons';
import {
  ArrowRight,
  Play,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  Shield,
  Terminal,
  Lock,
  Zap,
  AlertTriangle,
  FileCode,
  CheckCircle2,
  ExternalLink,
  Layers,
  Cpu,
  GitPullRequest,
  RotateCw,
} from 'lucide-react';
import { cn } from '../lib/utils';

type TabId = 'overview' | 'scan' | 'findings' | 'history' | 'pipeline';

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  caption: string;
}

const PRODUCT_TABS: TabConfig[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: HomeIcon,
    caption: 'Unified pull-request review dashboard with AST precision.',
  },
  {
    id: 'scan',
    label: 'Scan',
    icon: Zap,
    caption: 'Zero-host AST execution analyzing Python syntax trees in under a second.',
  },
  {
    id: 'findings',
    label: 'Findings',
    icon: ShieldAlertIcon,
    badge: '1',
    caption: 'Detailed flaw inspection with CWE taxonomy and copyable remediation diffs.',
  },
  {
    id: 'history',
    label: 'History',
    icon: HistoryIcon,
    caption: 'Immutable audit trail recording every verified pull request review.',
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    icon: PipelineIcon,
    caption: 'Zero-trust pipeline isolating untrusted code in ephemeral 0600 directories.',
  },
];

const FAQS = [
  {
    q: 'How does CodeSentinel analyze pull requests without executing untrusted code?',
    a: 'CodeSentinel operates strictly on static Abstract Syntax Trees (AST) using the Semgrep 1.181.0 engine. Changed Python files are extracted into temporary 0600 scratch directories. It never executes setup.py, pip install, test suites, or package build scripts from the pull request.',
  },
  {
    q: 'Which programming languages and rulesets are currently supported?',
    a: 'The verified implementation focuses on Python (.py) source files using pinned rulesets in rules/semgrep-demo.yml and rules/semgrep-security.yml (OWASP Top 10 vulnerabilities including dynamic eval, shell injection, and hardcoded secrets). Non-Python files in pull requests are marked as unsupported_scope rather than claiming a false clean result.',
  },
  {
    q: 'How are GitHub webhook deliveries verified and deduplicated?',
    a: 'Incoming payloads are verified using HMAC-SHA256 on the raw request buffer before parsing, compared in constant time with crypto.timingSafeEqual. Delivery UUIDs (X-GitHub-Delivery) are indexed in the atomic FileStore to neutralize duplicate deliveries and replay attacks.',
  },
  {
    q: 'How can my team enable or disable automatic PR summary comments?',
    a: 'PR comments are disabled by default (GITHUB_COMMENT_MODE=off) to prevent unwanted clutter. When you explicitly set GITHUB_COMMENT_MODE=write in a private repository, CodeSentinel uses idempotent marker headers to create or update a single summary comment rather than creating duplicate threads.',
  },
  {
    q: 'How does the two-screen mobile companion function during academic evaluation?',
    a: 'The mobile companion in mobile/ is a standalone React Native / Expo application with a Security Alert Inbox and Alert Detail & Acknowledgement screen. It persists acknowledgement state on-device via AsyncStorage and simulates local security notifications without requiring remote APNS/FCM cloud infrastructure.',
  },
];

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [copiedPatch, setCopiedPatch] = useState(false);
  const [diffMode, setDiffMode] = useState<'vulnerable' | 'remediated'>('vulnerable');
  const [activePipelineStage, setActivePipelineStage] = useState<number>(2);

  // Interactive scan runner state
  const [scanState, setScanState] = useState<'idle' | 'running' | 'completed'>('completed');
  const [scanProgress, setScanProgress] = useState<number>(3); // 0 to 3

  // Cookie consent state
  const [cookieConsent, setCookieConsent] = useState(() => {
    return !localStorage.getItem('codesentinel_privacy_consent');
  });

  useEffect(() => {
    document.title = 'CodeSentinel — Security, before merge.';
  }, []);

  useEffect(() => {
    function handleReopen() {
      setCookieConsent(true);
    }
    window.addEventListener('codesentinel-open-privacy-preferences', handleReopen);
    return () => window.removeEventListener('codesentinel-open-privacy-preferences', handleReopen);
  }, []);

  const saveConsent = (choice: 'accepted' | 'essential') => {
    localStorage.setItem('codesentinel_privacy_consent', choice);
    setCookieConsent(false);
  };

  const handleCopyPatch = () => {
    const patch = `--- a/fixtures/demo/insecure_example.py
+++ b/fixtures/demo/insecure_example.py
@@ -11,4 +11,5 @@
 def execute_calculation(raw_expression: str):
-    # Flawed: Arbitrary code evaluation via built-in eval()
-    return eval(raw_expression)
+    # Remediated: Safe literal evaluation via AST parser
+    import ast
+    return ast.literal_eval(raw_expression)`;
    navigator.clipboard.writeText(patch);
    setCopiedPatch(true);
    setTimeout(() => setCopiedPatch(false), 2000);
  };

  const triggerInteractiveScan = () => {
    setScanState('running');
    setScanProgress(0);
    setTimeout(() => setScanProgress(1), 350);
    setTimeout(() => setScanProgress(2), 700);
    setTimeout(() => {
      setScanProgress(3);
      setScanState('completed');
    }, 1100);
  };

  const currentTabConfig = PRODUCT_TABS.find((t) => t.id === activeTab) || PRODUCT_TABS[0];

  return (
    <div className="min-h-screen bg-[#0E0F12] text-zinc-100 font-sans selection:bg-[#D946EF]/30 selection:text-white">
      {/* ── 1. MINIMAL STICKY NAVIGATION ───────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#0E0F12]/85 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <CodeSentinelLogo className="size-6 text-[#D946EF] group-hover:scale-105 transition-transform" />
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base tracking-tight text-white">
                CodeSentinel
              </span>
              <span className="hidden md:inline-block text-[11px] font-mono uppercase tracking-widest text-zinc-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                Workspace
              </span>
            </div>
          </Link>

          {/* Navigation Links (Visible on desktop/large screens) */}
          <nav className="hidden lg:flex items-center gap-5 xl:gap-6 text-sm text-zinc-400">
            <a href="#demo-window" className="hover:text-white transition-colors">
              Product
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors">
              How It Works
            </a>
            <a href="#ast-precision" className="hover:text-white transition-colors">
              AST Precision
            </a>
            <a href="#architecture" className="hover:text-white transition-colors">
              Architecture
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              FAQs
            </a>
            <Link to="/docs" className="hover:text-white transition-colors">
              Docs
            </Link>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              to="/login"
              className="text-xs sm:text-sm text-zinc-300 hover:text-white font-medium px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              Sign In
            </Link>
            <Link
              to="/app"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium px-3.5 sm:px-4 py-2 rounded-lg bg-[#D946EF] hover:bg-[#C026D3] text-white shadow-sm hover:shadow-[0_0_20px_rgba(217,70,239,0.35)] active:scale-[0.98] transition-all whitespace-nowrap"
            >
              <span>Open Workspace</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── 2. ACETERNITY-INSPIRED MINIMAL HERO ────────────────────────────── */}
      <section className="relative pt-20 pb-12 sm:pt-28 sm:pb-16 px-6 overflow-hidden">
        {/* Subtle Background Radial Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#D946EF]/10 blur-[120px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          {/* Eyebrow Pill */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#18191E] border border-white/10 text-xs text-zinc-300 mb-8 shadow-sm"
          >
            <span className="size-2 rounded-full bg-[#D946EF] animate-pulse" />
            <span className="font-mono text-[11px] text-zinc-400">PST_PD_143 · Group G385</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-300">Semgrep 1.181.0 AST Engine</span>
          </motion.div>

          {/* Hero Typography */}
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white leading-[1.08] max-w-3xl"
          >
            Secure every pull request.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-200 to-zinc-500">
              Before it merges.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base sm:text-lg md:text-xl text-zinc-400 max-w-2xl mt-6 leading-relaxed font-normal"
          >
            Scan code. Understand risks. Review findings. All from one developer workspace.
          </motion.p>

          {/* Two Primary CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mt-8 w-full sm:w-auto"
          >
            <Link
              to="/app"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-[#D946EF] hover:bg-[#C026D3] text-white text-sm font-medium transition-all shadow-lg shadow-[#D946EF]/20 hover:shadow-[#D946EF]/35 active:scale-[0.98]"
            >
              <span>Open Workspace</span>
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#demo-window"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-zinc-200 text-sm font-medium transition-all active:scale-[0.98]"
            >
              <Play className="size-3.5 text-zinc-400 fill-zinc-400" />
              <span>Explore Demo</span>
            </a>
          </motion.div>

          {/* Engineering Trust Badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-10 text-xs text-zinc-500 font-mono"
          >
            <span className="flex items-center gap-1.5">
              <Check className="size-3.5 text-[#D946EF]" />
              Static AST Analysis
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="size-3.5 text-[#D946EF]" />
              Zero Code Execution
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="size-3.5 text-[#D946EF]" />
              Ephemeral 0600 Isolation
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="size-3.5 text-[#D946EF]" />
              HMAC-SHA256 Webhook
            </span>
          </motion.div>
        </div>
      </section>

      {/* ── 3. CENTERED TAB PILL SWITCHER & LARGE PRODUCT WINDOW ──────────── */}
      <section id="demo-window" className="relative px-4 sm:px-6 pb-24 scroll-mt-20">
        <div className="max-w-5xl mx-auto flex flex-col items-center">
          {/* Centered Tab Pill Selector (Aceternity Continuous Style) */}
          <div className="mb-6 p-1.5 rounded-xl sm:rounded-full bg-[#18191E] border border-white/10 shadow-xl flex flex-wrap justify-center gap-1 max-w-full">
            {PRODUCT_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'relative px-3.5 sm:px-5 py-2 rounded-lg sm:rounded-full text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors duration-200 select-none z-10',
                    isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTabPill"
                      className="absolute inset-0 bg-[#202227] border border-white/10 rounded-lg sm:rounded-full shadow-sm"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      style={{ zIndex: -1 }}
                    />
                  )}
                  <Icon className={cn('size-4', isActive ? 'text-[#D946EF]' : 'text-zinc-400')} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={cn(
                        'px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold leading-none',
                        isActive
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-white/10 text-zinc-400'
                      )}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Large Interactive Product Window */}
          <div className="w-full rounded-2xl md:rounded-3xl border border-white/10 bg-[#18191E] shadow-[0_20px_70px_rgba(0,0,0,0.7)] overflow-hidden transition-all">
            {/* Window Chrome Header */}
            <div className="h-12 px-5 bg-[#202227] border-b border-white/5 flex items-center justify-between text-xs text-zinc-400 select-none">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-[#FF5F56]/80 inline-block" />
                <span className="size-3 rounded-full bg-[#FFBD2E]/80 inline-block" />
                <span className="size-3 rounded-full bg-[#27C93F]/80 inline-block" />
                <span className="hidden sm:inline-block ml-3 font-mono text-[11px] text-zinc-400">
                  codesentinel / core · PR #42
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-[11px] text-zinc-300">
                  AST Engine Active · Semgrep 1.181.0
                </span>
              </div>
            </div>

            {/* Window Body with Aceternity Blur/Crossfade Animation */}
            <div className="p-4 sm:p-6 md:p-8 min-h-[460px] flex flex-col justify-center bg-[#18191E]">
              <AnimatePresence mode="wait">
                {activeTab === 'overview' && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                    transition={{ duration: 0.22 }}
                    className="flex flex-col gap-6"
                  >
                    {/* PR Header & Status Chip */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">
                            Pull Request #42 Review
                          </span>
                          <span className="size-1 rounded-full bg-zinc-600" />
                          <span className="text-xs text-zinc-400 font-mono">branch: feat/user-eval</span>
                        </div>
                        <h3 className="text-lg sm:text-xl font-semibold text-white mt-1">
                          Add dynamic user formula calculator
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
                          <AlertTriangle className="size-3.5 text-rose-400" />
                          1 Critical Finding (Merge Blocked)
                        </span>
                      </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-4 rounded-xl bg-[#202227] border border-white/5">
                        <span className="text-xs text-zinc-500 block mb-1">Target Repository</span>
                        <span className="text-sm font-medium text-white truncate block">
                          local/controlled-fixture
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-[#202227] border border-white/5">
                        <span className="text-xs text-zinc-500 block mb-1">Scanner Engine</span>
                        <span className="text-sm font-medium text-white block">Semgrep 1.181.0</span>
                      </div>
                      <div className="p-4 rounded-xl bg-[#202227] border border-white/5">
                        <span className="text-xs text-zinc-500 block mb-1">Isolation Sandbox</span>
                        <span className="text-sm font-medium text-white block">0600 Ephemeral Dir</span>
                      </div>
                      <div className="p-4 rounded-xl bg-[#202227] border border-white/5">
                        <span className="text-xs text-zinc-500 block mb-1">Execution Duration</span>
                        <span className="text-sm font-medium text-emerald-400 font-mono block">
                          218 ms
                        </span>
                      </div>
                    </div>

                    {/* Detected Flaw Card */}
                    <div className="rounded-xl bg-[#202227] border border-rose-500/20 p-5 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            CRITICAL
                          </span>
                          <span className="text-sm font-mono text-zinc-300">
                            python.lang.security.eval
                          </span>
                        </div>
                        <span className="text-xs font-mono text-zinc-500">CWE-95</span>
                      </div>

                      <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                        Improper neutralization of directives in dynamically evaluated code. The
                        built-in <code className="text-rose-400 font-mono bg-rose-950/40 px-1 py-0.5 rounded">eval()</code> function was
                        invoked with user-controlled input, allowing arbitrary Python bytecode execution.
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                        <span className="font-mono text-zinc-400">
                          fixtures/demo/insecure_example.py:14
                        </span>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setActiveTab('findings')}
                            className="text-[#D946EF] hover:underline flex items-center gap-1 font-medium"
                          >
                            <span>Inspect Remediation Diff</span>
                            <ArrowRight className="size-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'scan' && (
                  <motion.div
                    key="scan"
                    initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                    transition={{ duration: 0.22 }}
                    className="flex flex-col gap-6"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          Static AST Analysis Execution
                        </h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Evaluates Python syntax trees without executing any untrusted test or build code.
                        </p>
                      </div>
                      <button
                        onClick={triggerInteractiveScan}
                        disabled={scanState === 'running'}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D946EF] hover:bg-[#C026D3] disabled:opacity-50 text-white text-xs font-medium transition-colors"
                      >
                        <RotateCw
                          className={cn('size-3.5', scanState === 'running' && 'animate-spin')}
                        />
                        <span>{scanState === 'running' ? 'Scanning AST...' : 'Re-run AST Scan'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Code Preview */}
                      <div className="rounded-xl bg-[#0E0F12] border border-white/10 p-4 font-mono text-xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/5 text-[11px] text-zinc-500">
                            <span>fixtures/demo/insecure_example.py</span>
                            <span>Python 3.11</span>
                          </div>
                          <div className="space-y-1.5 leading-relaxed text-zinc-300">
                            <p className="text-zinc-600"># Pull Request Target File</p>
                            <p>
                              <span className="text-purple-400">def</span>{' '}
                              <span className="text-blue-400">calculate_formula</span>
                              (raw_input: <span className="text-yellow-400">str</span>):
                            </p>
                            <p className="pl-4 text-zinc-500">
                              """Evaluate user-supplied calculation."""
                            </p>
                            <p className="pl-4 bg-rose-500/10 text-rose-300 px-2 py-1 rounded border-l-2 border-rose-500">
                              <span className="text-rose-400 font-bold">return</span>{' '}
                              <span className="text-rose-200 underline decoration-rose-400">
                                eval(raw_input)
                              </span>{' '}
                              <span className="text-rose-400 text-[10px]"># ◄ CWE-95 FLAGGED</span>
                            </p>
                            <p className="pl-4">
                              <span className="text-purple-400">return</span>{' '}
                              <span className="text-green-300">None</span>
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-white/5 text-[11px] text-zinc-500 flex items-center justify-between">
                          <span>Target: local/controlled-fixture</span>
                          <span className="text-rose-400">Line 14 flagged</span>
                        </div>
                      </div>

                      {/* Interactive Console Terminal */}
                      <div className="rounded-xl bg-[#0E0F12] border border-white/10 p-4 font-mono text-xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/5 text-[11px] text-zinc-500">
                            <span className="flex items-center gap-1.5">
                              <Terminal className="size-3 text-[#D946EF]" />
                              <span>Semgrep AST Execution Log</span>
                            </span>
                            <span className="text-emerald-400">Exit: 0</span>
                          </div>

                          <div className="space-y-2 text-zinc-300">
                            <div className="flex items-center gap-2">
                              <span className="size-1.5 rounded-full bg-blue-400" />
                              <span className="text-zinc-400">[01] Extracting changed Python files to /tmp/cs-0600-scratch...</span>
                            </div>

                            {scanProgress >= 1 && (
                              <div className="flex items-center gap-2">
                                <span className="size-1.5 rounded-full bg-yellow-400" />
                                <span className="text-zinc-400">[02] Parsing Abstract Syntax Tree via Semgrep 1.181.0...</span>
                              </div>
                            )}

                            {scanProgress >= 2 && (
                              <div className="flex items-center gap-2">
                                <span className="size-1.5 rounded-full bg-purple-400" />
                                <span className="text-zinc-400">[03] Applying rule: python.lang.security.eval...</span>
                              </div>
                            )}

                            {scanProgress >= 3 && (
                              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] mt-2">
                                <p className="font-bold text-rose-400">
                                  [MATCH] AST Call node 'eval' detected on line 14.
                                </p>
                                <p className="text-zinc-400 mt-1">
                                  Zero-host execution: Code was parsed statically without launching Python interpreter.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px]">
                          <span className="text-zinc-500">Execution time: 218 ms</span>
                          <span className="text-zinc-400">Untrusted execution: False</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'findings' && (
                  <motion.div
                    key="findings"
                    initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                    transition={{ duration: 0.22 }}
                    className="flex flex-col gap-6"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            CWE-95
                          </span>
                          <h3 className="text-lg font-semibold text-white">
                            Eval Injection in execute_calculation()
                          </h3>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">
                          Rule: <span className="font-mono text-zinc-300">python.lang.security.eval</span> · File:{' '}
                          <span className="font-mono text-zinc-300">fixtures/demo/insecure_example.py:14</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCopyPatch}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-zinc-300 text-xs font-medium transition-colors"
                        >
                          {copiedPatch ? (
                            <>
                              <Check className="size-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Patch Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="size-3.5 text-zinc-400" />
                              <span>Copy Remediation Patch</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Diff View Mode Switcher */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDiffMode('vulnerable')}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                          diffMode === 'vulnerable'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                        )}
                      >
                        Vulnerable AST Node
                      </button>
                      <button
                        onClick={() => setDiffMode('remediated')}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                          diffMode === 'remediated'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                        )}
                      >
                        Remediated Safe Implementation
                      </button>
                    </div>

                    {/* Diff Code Container */}
                    <div className="rounded-xl bg-[#0E0F12] border border-white/10 p-4 font-mono text-xs overflow-x-auto">
                      {diffMode === 'vulnerable' ? (
                        <div className="space-y-1 text-zinc-300">
                          <p className="text-zinc-500"># Vulnerable implementation in pull request #42</p>
                          <p>
                            <span className="text-purple-400">def</span>{' '}
                            <span className="text-blue-400">execute_calculation</span>(raw_expression: <span className="text-yellow-400">str</span>):
                          </p>
                          <p className="text-zinc-500 pl-4">
                            """Evaluate user-supplied arithmetic expression."""
                          </p>
                          <p className="bg-rose-500/20 text-rose-300 p-2 rounded border-l-2 border-rose-500 my-1">
                            - return eval(raw_expression) <span className="text-rose-400"># ◄ CRITICAL: Allows arbitrary code execution</span>
                          </p>
                          <p className="text-zinc-500 text-[11px] pt-2">
                            Explanation: An attacker providing payload like <code className="text-rose-300">__import__('os').system('id')</code> achieves remote code execution.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1 text-zinc-300">
                          <p className="text-zinc-500"># Recommended secure remediation using AST literal parser</p>
                          <p>
                            <span className="text-purple-400">import</span> <span className="text-yellow-400">ast</span>
                          </p>
                          <p className="mt-2">
                            <span className="text-purple-400">def</span>{' '}
                            <span className="text-blue-400">execute_calculation</span>(raw_expression: <span className="text-yellow-400">str</span>):
                          </p>
                          <p className="text-zinc-500 pl-4">
                            """Evaluate user-supplied arithmetic expression safely."""
                          </p>
                          <p className="bg-emerald-500/20 text-emerald-300 p-2 rounded border-l-2 border-emerald-500 my-1">
                            + return ast.literal_eval(raw_expression) <span className="text-emerald-400"># ✔ SECURE: Evaluates only Python literals</span>
                          </p>
                          <p className="text-zinc-500 text-[11px] pt-2">
                            Explanation: <code className="text-emerald-300">ast.literal_eval</code> parses syntax trees strictly for strings, numbers, tuples, lists, dicts, booleans, and None, safely blocking executable statements.
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'history' && (
                  <motion.div
                    key="history"
                    initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                    transition={{ duration: 0.22 }}
                    className="flex flex-col gap-6"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          Verified Pull Request Audit Trail
                        </h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Cryptographically logged PR scans. Errors are recorded truthfully and never presented as clean.
                        </p>
                      </div>
                      <span className="text-xs font-mono text-zinc-400 bg-white/5 px-2.5 py-1 rounded border border-white/5">
                        4 Records Indexed
                      </span>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#0E0F12] overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-white/10 bg-[#202227]/50 text-zinc-400 text-[11px] uppercase tracking-wider font-mono">
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Repository / PR</th>
                            <th className="py-3 px-4">Revision</th>
                            <th className="py-3 px-4">Verdict</th>
                            <th className="py-3 px-4">Duration</th>
                            <th className="py-3 px-4">Verified</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-mono">
                          <tr className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                FLAGGED
                              </span>
                            </td>
                            <td className="py-3 px-4 text-zinc-200 font-sans font-medium">
                              local/controlled-fixture #42
                            </td>
                            <td className="py-3 px-4 text-zinc-400">c839a1f</td>
                            <td className="py-3 px-4 text-rose-400">1 Critical (CWE-95)</td>
                            <td className="py-3 px-4 text-zinc-300">218 ms</td>
                            <td className="py-3 px-4 text-emerald-400">✔ HMAC Match</td>
                          </tr>
                          <tr className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                CLEAN
                              </span>
                            </td>
                            <td className="py-3 px-4 text-zinc-200 font-sans font-medium">
                              fixtures/demo/safe_example.py #41
                            </td>
                            <td className="py-3 px-4 text-zinc-400">a19b882</td>
                            <td className="py-3 px-4 text-emerald-400">0 Findings</td>
                            <td className="py-3 px-4 text-zinc-300">184 ms</td>
                            <td className="py-3 px-4 text-emerald-400">✔ HMAC Match</td>
                          </tr>
                          <tr className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                ERROR
                              </span>
                            </td>
                            <td className="py-3 px-4 text-zinc-200 font-sans font-medium">
                              invalid-syntax-test #40
                            </td>
                            <td className="py-3 px-4 text-zinc-400">f023d51</td>
                            <td className="py-3 px-4 text-amber-400">SyntaxError (Line 8)</td>
                            <td className="py-3 px-4 text-zinc-300">92 ms</td>
                            <td className="py-3 px-4 text-emerald-400">✔ Recorded</td>
                          </tr>
                          <tr className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                CLEAN
                              </span>
                            </td>
                            <td className="py-3 px-4 text-zinc-200 font-sans font-medium">
                              main-branch-verification #39
                            </td>
                            <td className="py-3 px-4 text-zinc-400">e4871aa</td>
                            <td className="py-3 px-4 text-emerald-400">0 Findings</td>
                            <td className="py-3 px-4 text-zinc-300">195 ms</td>
                            <td className="py-3 px-4 text-emerald-400">✔ HMAC Match</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'pipeline' && (
                  <motion.div
                    key="pipeline"
                    initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                    transition={{ duration: 0.22 }}
                    className="flex flex-col gap-6"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          6-Stage Zero-Trust Pipeline Architecture
                        </h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Every pull request traverses isolated verification stages without arbitrary code execution.
                        </p>
                      </div>
                      <span className="text-xs text-zinc-400 font-mono">
                        Select stage to inspect properties
                      </span>
                    </div>

                    {/* Pipeline Stage Buttons */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      {[
                        { step: '01', title: 'HMAC Webhook', desc: 'Raw body SHA256' },
                        { step: '02', title: 'Dedup Guard', desc: 'X-GitHub-Delivery' },
                        { step: '03', title: '0600 Scratch', desc: 'Ephemeral sandbox' },
                        { step: '04', title: 'Semgrep AST', desc: 'Static tree parse' },
                        { step: '05', title: 'Store Persist', desc: 'Atomic file store' },
                        { step: '06', title: 'Merge Verdict', desc: 'GitHub check gate' },
                      ].map((st, idx) => (
                        <button
                          key={st.step}
                          onClick={() => setActivePipelineStage(idx)}
                          className={cn(
                            'p-3 rounded-xl border text-left transition-all',
                            activePipelineStage === idx
                              ? 'bg-[#202227] border-[#D946EF]/50 shadow-md shadow-[#D946EF]/10'
                              : 'bg-[#0E0F12] border-white/5 hover:border-white/20'
                          )}
                        >
                          <span className="text-[10px] font-mono text-zinc-500 block">
                            Stage {st.step}
                          </span>
                          <span className="text-xs font-semibold text-white block mt-1">
                            {st.title}
                          </span>
                          <span className="text-[10px] text-zinc-400 truncate block mt-0.5">
                            {st.desc}
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Detailed Stage Inspector Panel */}
                    <div className="rounded-xl bg-[#202227] border border-white/10 p-5 text-xs text-zinc-300">
                      {activePipelineStage === 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-white text-sm">
                              Stage 01: HMAC-SHA256 Delivery Verification
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
                              crypto.timingSafeEqual
                            </span>
                          </div>
                          <p className="text-zinc-400 leading-relaxed">
                            Webhooks from GitHub are validated against the raw byte buffer before JSON parsing.
                            The signature is computed via HMAC-SHA256 and compared in constant time to prevent side-channel timing attacks.
                          </p>
                        </div>
                      )}
                      {activePipelineStage === 1 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-white text-sm">
                              Stage 02: Atomic Delivery Deduplication
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-400 border border-blue-500/30 font-mono">
                              FileStore Atomic Index
                            </span>
                          </div>
                          <p className="text-zinc-400 leading-relaxed">
                            The X-GitHub-Delivery UUID is registered in an atomic JSON file store before queueing. Duplicate
                            deliveries or retried payloads are acknowledged with HTTP 200 without running redundant scanner workloads.
                          </p>
                        </div>
                      )}
                      {activePipelineStage === 2 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-white text-sm">
                              Stage 03: Ephemeral 0600 File Isolation
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/15 text-purple-400 border border-purple-500/30 font-mono">
                              chmod 0600 Scratch
                            </span>
                          </div>
                          <p className="text-zinc-400 leading-relaxed">
                            Changed Python files from the PR revision are extracted into an isolated, temporary directory with
                            strict 0600 file permissions. No build commands, dependencies, or shell scripts from the pull request are executed.
                          </p>
                        </div>
                      )}
                      {activePipelineStage === 3 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-white text-sm">
                              Stage 04: Static Semgrep 1.181.0 AST Engine
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-[#D946EF]/20 text-[#D946EF] border border-[#D946EF]/40 font-mono">
                              Abstract Syntax Tree
                            </span>
                          </div>
                          <p className="text-zinc-400 leading-relaxed">
                            The Semgrep engine parses the files into abstract syntax tree nodes and matches them against pinned security
                            rulesets (OWASP Top 10, CWE-95, CWE-78). Non-Python files in pull requests are classified as unsupported_scope.
                          </p>
                        </div>
                      )}
                      {activePipelineStage === 4 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-white text-sm">
                              Stage 05: Atomic Persistence & Audit Logging
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
                              data/scans.json
                            </span>
                          </div>
                          <p className="text-zinc-400 leading-relaxed">
                            Results are serialized to disk with atomic rename operations. Scan exit codes, matched rules, file locations,
                            and run durations are immutably archived. Scanner failures are accurately preserved as errors.
                          </p>
                        </div>
                      )}
                      {activePipelineStage === 5 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-white text-sm">
                              Stage 06: Pull Request Merge Gating
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/15 text-rose-400 border border-rose-500/30 font-mono">
                              GitHub Status Check
                            </span>
                          </div>
                          <p className="text-zinc-400 leading-relaxed">
                            If critical vulnerabilities (such as CWE-95) are detected, the status check fails, preventing merge in GitHub.
                            Optional idempotency headers allow updating an existing single summary comment without spamming PR threads.
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Dynamic Tab Caption (Aceternity Signature Detail) */}
          <motion.div
            key={activeTab + '-caption'}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-6 flex items-center gap-2 text-xs sm:text-sm text-zinc-400 text-center"
          >
            <span className="size-1.5 rounded-full bg-[#D946EF]" />
            <span>{currentTabConfig.caption}</span>
          </motion.div>
        </div>
      </section>

      {/* ── 4. HOW CODESENTINEL WORKS (3 NUMBERED STEPS) ──────────────────── */}
      <section id="how-it-works" className="py-20 border-t border-white/5 px-6 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-mono uppercase tracking-widest text-[#D946EF] font-semibold block mb-2">
              Automated PR Workflow
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white">
              Three steps to pull-request security
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 mt-3">
              Zero agent installations on developers’ machines. Continuous enforcement at GitHub merge boundary.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="p-6 rounded-2xl bg-[#18191E] border border-white/5 flex flex-col justify-between hover:border-white/10 transition-colors">
              <div>
                <span className="font-mono text-3xl font-bold text-zinc-600 block mb-4">01</span>
                <h3 className="text-base font-semibold text-white mb-2">Connect Repository</h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  Register repository on the allowlist and configure your HMAC webhook secret. No broad access tokens required.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-zinc-500 font-mono">
                <Lock className="size-3.5 text-[#D946EF]" />
                <span>HMAC-SHA256 Ingress</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl bg-[#18191E] border border-white/5 flex flex-col justify-between hover:border-white/10 transition-colors">
              <div>
                <span className="font-mono text-3xl font-bold text-zinc-600 block mb-4">02</span>
                <h3 className="text-base font-semibold text-white mb-2">Open Pull Request</h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  Every commit or pull request triggers an automated scan. Changed Python files are isolated to 0600 scratch space.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-zinc-500 font-mono">
                <GitPullRequest className="size-3.5 text-[#D946EF]" />
                <span>Isolated Diff Extraction</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl bg-[#18191E] border border-white/5 flex flex-col justify-between hover:border-white/10 transition-colors">
              <div>
                <span className="font-mono text-3xl font-bold text-zinc-600 block mb-4">03</span>
                <h3 className="text-base font-semibold text-white mb-2">Guard Before Merge</h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  AST scanner verifies syntax in ~200ms. If critical flaws exist, merge is blocked with copyable remediation diffs.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-zinc-500 font-mono">
                <Shield className="size-3.5 text-[#D946EF]" />
                <span>Zero Execution Verdict</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. AST DETECTION PRECISION VS NAIVE REGEX ─────────────────────── */}
      <section id="ast-precision" className="py-20 border-t border-white/5 bg-[#0A0B0E] px-6 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-mono uppercase tracking-widest text-[#D946EF] font-semibold block mb-2">
              Static Analysis Engineering
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white">
              Why AST analysis beats pattern matching
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 mt-3">
              Naive regex search produces alert fatigue. CodeSentinel parses real Python syntax trees.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Flawed Regex */}
            <div className="p-6 rounded-2xl bg-[#18191E] border border-rose-500/20">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono text-rose-400 uppercase tracking-wider font-semibold">
                  Conventional Regex / Grep
                </span>
                <span className="size-2 rounded-full bg-rose-500" />
              </div>
              <ul className="space-y-3 text-xs sm:text-sm text-zinc-400">
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-400 font-bold">✕</span>
                  <span>Flags benign comments like <code className="text-zinc-300"># eval() is deprecated</code> as vulnerabilities.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-400 font-bold">✕</span>
                  <span>Easily fooled by multi-line arguments or variable aliasing.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-400 font-bold">✕</span>
                  <span>No understanding of Python scope, imports, or variable data flow.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-400 font-bold">✕</span>
                  <span>Drowns developers in noisy false positives.</span>
                </li>
              </ul>
            </div>

            {/* CodeSentinel AST */}
            <div className="p-6 rounded-2xl bg-[#18191E] border border-emerald-500/20">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider font-semibold">
                  CodeSentinel AST Analysis
                </span>
                <span className="size-2 rounded-full bg-emerald-400" />
              </div>
              <ul className="space-y-3 text-xs sm:text-sm text-zinc-300">
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold">✔</span>
                  <span>Ignores docstrings and comments; targets actual Call and Import nodes.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold">✔</span>
                  <span>Differentiates between hazardous <code className="text-rose-300">eval()</code> and safe <code className="text-emerald-300">ast.literal_eval()</code>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold">✔</span>
                  <span>Executes static tree traversal without running PR code on host machine.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold">✔</span>
                  <span>Zero runtime execution overhead; completed in under 250 milliseconds.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. ZERO-TRUST SECURITY ARCHITECTURE (4 PILLARS) ───────────────── */}
      <section id="architecture" className="py-20 border-t border-white/5 px-6 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-mono uppercase tracking-widest text-[#D946EF] font-semibold block mb-2">
              System Invariants
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white">
              Zero-trust pull request inspection
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 mt-3">
              Engineered so that scanning untrusted code never compromises the scanner host.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[#18191E] border border-white/5 hover:border-white/10 transition-colors">
              <div className="size-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-[#D946EF] mb-4">
                <Cpu className="size-5" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">Zero Code Execution</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Setup scripts, package install routines, and test suites are never executed from scanned PRs.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#18191E] border border-white/5 hover:border-white/10 transition-colors">
              <div className="size-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
                <Lock className="size-5" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">Timing-Safe HMAC</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Incoming deliveries validated with HMAC-SHA256 via timing-safe byte equality checks.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#18191E] border border-white/5 hover:border-white/10 transition-colors">
              <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
                <Layers className="size-5" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">Ephemeral 0600 Sandbox</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Changed files extracted into temporary scratch folders with 0600 permissions and purged.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#18191E] border border-white/5 hover:border-white/10 transition-colors">
              <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
                <FileCode className="size-5" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">Honest Audit Log</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Scanner failures and syntax errors are recorded faithfully and never disguised as clean.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. FREQUENTLY ASKED QUESTIONS (ACCORDION) ──────────────────────── */}
      <section id="faq" className="py-20 border-t border-white/5 bg-[#0A0B0E] px-6 scroll-mt-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-mono uppercase tracking-widest text-[#D946EF] font-semibold block mb-2">
              Verification & Scope
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white">
              Frequently Asked Questions
            </h2>
            <p className="text-sm text-zinc-400 mt-2">
              Technical details regarding AST analysis, GitHub integration, and security invariants.
            </p>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="rounded-xl border border-white/5 bg-[#18191E] overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 select-none hover:bg-white/5 transition-colors"
                  >
                    <span className="text-sm font-medium text-white">{faq.q}</span>
                    <span className="shrink-0 text-zinc-400">
                      {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-5 sm:px-5 text-xs sm:text-sm text-zinc-400 leading-relaxed border-t border-white/5 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 8. BOTTOM CTA BANNER ───────────────────────────────────────────── */}
      <section className="py-20 border-t border-white/5 px-6 relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white">
            Ready to secure your pull requests?
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 max-w-xl mt-3">
            Open the CodeSentinel security workspace or explore the live AST analysis engine.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
            <Link
              to="/app"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#D946EF] hover:bg-[#C026D3] text-white text-sm font-medium shadow-md shadow-[#D946EF]/20 transition-all active:scale-[0.98]"
            >
              <span>Open Developer Workspace</span>
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/docs"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-zinc-300 text-sm font-medium transition-all"
            >
              <span>View Technical Documentation</span>
              <ExternalLink className="size-3.5 text-zinc-400" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 9. MINIMAL FOOTER ──────────────────────────────────────────────── */}
      <footer className="py-12 border-t border-white/5 bg-[#0E0F12] px-6 text-xs text-zinc-500">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <CodeSentinelLogo className="size-5 text-[#D946EF]" />
            <span className="font-semibold text-zinc-300">CodeSentinel</span>
            <span>·</span>
            <span className="font-mono text-[11px]">PST_PD_143 · Group G385</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-zinc-400">
            <Link to="/app" className="hover:text-white transition-colors">
              Workspace
            </Link>
            <Link to="/docs" className="hover:text-white transition-colors">
              Documentation
            </Link>
            <Link to="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
            <button
              onClick={() => setCookieConsent(true)}
              className="hover:text-white transition-colors underline decoration-zinc-600 underline-offset-4"
            >
              Privacy Preferences
            </button>
          </div>

          <p className="text-zinc-600 font-mono text-[11px]">
            Static AST Pull Request Guardian · Semgrep 1.181.0
          </p>
        </div>
      </footer>

      {/* ── 10. PRIVACY CONSENT BANNER (DARK THEME) ────────────────────────── */}
      {cookieConsent && (
        <div className="fixed bottom-4 right-4 max-w-sm w-full bg-[#18191E] border border-white/10 rounded-2xl p-4 shadow-2xl z-50 text-xs flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-[#D946EF]" />
              <span className="font-semibold text-white">Local Privacy Notice</span>
            </div>
          </div>
          <p className="text-zinc-400 leading-relaxed">
            CodeSentinel stores essential session tokens and local evaluation preferences locally.
            No external analytics or advertising cookies are deployed.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => saveConsent('accepted')}
              className="flex-1 py-1.5 px-3 rounded-lg bg-[#D946EF] hover:bg-[#C026D3] text-white font-medium text-xs transition-colors"
            >
              Accept
            </button>
            <button
              onClick={() => saveConsent('essential')}
              className="flex-1 py-1.5 px-3 rounded-lg border border-white/10 hover:bg-white/5 text-zinc-300 font-medium text-xs transition-colors"
            >
              Essential Only
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
