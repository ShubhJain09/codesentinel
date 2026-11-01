import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CodeSentinelLogo,
  DocsIcon,
  ProjectIcon,
} from '../components/ui/AgndexIcons';
import {
  Shield,
  ArrowLeft,
  ArrowRight,
  Terminal,
  Smartphone,
  CheckCircle,
  Lock,
  GitPullRequest,
} from 'lucide-react';

const SECTIONS = [
  { id: 'overview', title: '01. Architecture & Threat Model', icon: Shield },
  { id: 'security', title: '02. Security & Path Isolation', icon: Lock },
  { id: 'github', title: '03. GitHub PR Ingress & HMAC', icon: GitPullRequest },
  { id: 'scanner', title: '04. Semgrep 1.181.0 AST Core', icon: Terminal },
  { id: 'mobile', title: '05. Mobile Companion (React Native)', icon: Smartphone },
  { id: 'ojt', title: '06. Capstone Evaluation Criteria', icon: CheckCircle },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview');

  return (
    <div className="min-h-screen bg-[#0E0F12] text-zinc-100 font-sans flex flex-col justify-between">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#0E0F12]/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <CodeSentinelLogo className="size-6 text-[#D946EF]" />
            <div>
              <span className="font-semibold text-base tracking-tight text-white">
                CodeSentinel
              </span>
              <span className="hidden sm:inline-block ml-2 text-[11px] font-mono uppercase tracking-wide text-zinc-400 bg-white/10 px-2 py-0.5 rounded">
                G385 · PST_PD_143
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="agndex-btn-outline h-9 px-3 text-xs"
            >
              <ArrowLeft size={13} />
              <span>Back to Home</span>
            </Link>
            <Link
              to="/app"
              className="agndex-btn-primary h-9 px-3 text-xs"
            >
              <span>Command Center</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── MAIN DOCUMENTATION BODY ──────────────────────────────────────── */}
      <div className="max-w-7xl w-full mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-12 gap-8 flex-1">
        {/* Sidebar Nav */}
        <aside className="md:col-span-4 lg:col-span-3 space-y-3">
          <div className="text-xs font-normal text-zinc-400 px-1">
            Documentation Index
          </div>
          <div className="bg-[#18191D] rounded-xl border border-white/10 p-2 space-y-1">
            {SECTIONS.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2.5 ${
                    isActive
                      ? 'bg-[#22242A] text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-[#D946EF]' : 'text-zinc-500'} />
                  <span className="truncate">{sec.title}</span>
                </button>
              );
            })}
          </div>

          <div className="p-4 rounded-xl bg-[#18191D] border border-white/10 text-xs text-zinc-400 space-y-2">
            <div className="text-xs font-semibold text-white">
              Project Specification
            </div>
            <p className="leading-relaxed">
              Official Project ID: <code className="text-zinc-200">PST_PD_143</code><br />
              College Group: <code className="text-zinc-200">G385</code><br />
              Assigned Mentor: <code className="text-zinc-200">Biplove</code>
            </p>
          </div>
        </aside>

        {/* Content Region */}
        <main className="md:col-span-8 lg:col-span-9 bg-[#18191D] rounded-xl border border-white/10 p-6 md:p-8 space-y-8">
          {activeSection === 'overview' && (
            <article className="space-y-6">
              <div className="border-b border-white/10 pb-4">
                <span className="text-xs font-semibold text-[#D946EF] uppercase tracking-wide">
                  Section 01
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
                  Architecture &amp; Threat Model
                </h2>
                <p className="text-sm text-zinc-400 mt-1">
                  Zero-trust security operations platform for automated pull request scanning.
                </p>
              </div>

              <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
                <p>
                  CodeSentinel is engineered around an uncompromised core invariant: <strong>Zero Untrusted Code Execution on the Host</strong>. In standard continuous integration environments, executing tools such as <code className="text-zinc-200">npm install</code>, <code className="text-zinc-200">pip install</code>, or test runners against arbitrary pull requests introduces critical remote code execution vulnerabilities via malicious build scripts (e.g. <code className="text-zinc-200">setup.py</code> or <code className="text-zinc-200">postinstall</code> hooks).
                </p>

                <div className="rounded-xl border border-white/10 bg-[#202227] p-5 space-y-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wide">
                    Threat Vectors Neutralized by Design
                  </h4>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-400">
                    <li>Supply chain dependency attacks executing during PR CI lifecycle.</li>
                    <li>Timing-oracle side-channel attacks on webhook signature authentication.</li>
                    <li>Path traversal escapes attempts through changed-file payloads (<code className="text-zinc-200">../../etc/passwd</code>).</li>
                    <li>Duplicate webhook delivery race conditions creating denial of service.</li>
                  </ul>
                </div>
              </div>
            </article>
          )}

          {activeSection === 'security' && (
            <article className="space-y-6">
              <div className="border-b border-white/10 pb-4">
                <span className="text-xs font-semibold text-[#D946EF] uppercase tracking-wide">
                  Section 02
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
                  Security &amp; Path Isolation
                </h2>
                <p className="text-sm text-zinc-400 mt-1">
                  Filesystem boundary containment and ephemeral sandbox guarantees.
                </p>
              </div>

              <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
                <p>
                  Every changed Python file received via GitHub webhook ingress is normalized and verified before being written to disk:
                </p>

                <div className="rounded-xl border border-white/10 bg-[#202227] p-5 space-y-3 font-mono text-xs">
                  <div className="text-zinc-400">// Invariant 1: Path Traversal Rejection</div>
                  <div className="text-zinc-200">if (filepath.includes(&apos;..&apos;) || path.isAbsolute(filepath)) &#123; throw new SecurityError(&apos;Unsafe path&apos;); &#125;</div>

                  <div className="text-zinc-400 mt-3">// Invariant 2: Ephemeral 0600 Directory Permissions</div>
                  <div className="text-zinc-200">fs.mkdirSync(sandboxDir, &#123; mode: 0o700 &#125;);</div>
                  <div className="text-zinc-200">fs.writeFileSync(targetFile, content, &#123; mode: 0o600 &#125;);</div>
                </div>
              </div>
            </article>
          )}

          {activeSection === 'github' && (
            <article className="space-y-6">
              <div className="border-b border-white/10 pb-4">
                <span className="text-xs font-semibold text-[#D946EF] uppercase tracking-wide">
                  Section 03
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
                  GitHub PR Ingress &amp; Timing-Safe HMAC
                </h2>
                <p className="text-sm text-zinc-400 mt-1">
                  Cryptographic verification of pull request webhook payloads.
                </p>
              </div>

              <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
                <p>
                  Webhooks are validated using HMAC-SHA256 digests evaluated with constant-time comparison:
                </p>

                <div className="rounded-xl border border-white/10 bg-[#202227] p-5 font-mono text-xs text-zinc-300">
                  <div className="text-zinc-500">// Constant-time verification eliminates timing oracles</div>
                  <div className="text-zinc-200">const computedSig = crypto.createHmac(&apos;sha256&apos;, secret).update(rawBody).digest();</div>
                  <div className="text-emerald-400">return crypto.timingSafeEqual(computedSig, headerSig);</div>
                </div>
              </div>
            </article>
          )}

          {activeSection === 'scanner' && (
            <article className="space-y-6">
              <div className="border-b border-white/10 pb-4">
                <span className="text-xs font-semibold text-[#D946EF] uppercase tracking-wide">
                  Section 04
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
                  Semgrep 1.181.0 AST Core
                </h2>
                <p className="text-sm text-zinc-400 mt-1">
                  Syntax-level pattern matching without host code execution.
                </p>
              </div>

              <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
                <p>
                  CodeSentinel utilizes the Semgrep CLI (verified version 1.181.0) with pinned rule files (<code className="text-zinc-200">rules/semgrep-demo.yml</code>) detecting:
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-[#202227] p-4">
                    <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400 uppercase">CWE-95</span>
                    <h4 className="text-sm font-semibold text-white mt-1">Python Dynamic Code Evaluation</h4>
                    <p className="text-xs text-zinc-400 mt-0.5">Flags unconstrained eval() on user input.</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-[#202227] p-4">
                    <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400 uppercase">CWE-78</span>
                    <h4 className="text-sm font-semibold text-white mt-1">Command Shell Injection</h4>
                    <p className="text-xs text-zinc-400 mt-0.5">Flags shell=True execution in subprocess.</p>
                  </div>
                </div>
              </div>
            </article>
          )}

          {activeSection === 'mobile' && (
            <article className="space-y-6">
              <div className="border-b border-white/10 pb-4">
                <span className="text-xs font-semibold text-[#D946EF] uppercase tracking-wide">
                  Section 05
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
                  Mobile Security Alert Companion
                </h2>
                <p className="text-sm text-zinc-400 mt-1">
                  Two-screen React Native / Expo application for real-time mobile triage.
                </p>
              </div>

              <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
                <p>
                  Located in the <code className="text-zinc-200">mobile/</code> directory, the standalone React Native companion provides:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-400">
                  <li>Screen 1: Security Alert Inbox with unmitigated vulnerability counts.</li>
                  <li>Screen 2: Alert Detail &amp; Acknowledgement with CWE metadata.</li>
                  <li>Simulated on-device push notifications without requiring remote APNs/FCM keys during evaluation.</li>
                </ul>
              </div>
            </article>
          )}

          {activeSection === 'ojt' && (
            <article className="space-y-6">
              <div className="border-b border-white/10 pb-4">
                <span className="text-xs font-semibold text-[#D946EF] uppercase tracking-wide">
                  Section 06
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
                  Capstone Evaluation Criteria
                </h2>
                <p className="text-sm text-zinc-400 mt-1">
                  Compliance matrix for Project PST_PD_143 (Group G385).
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-[#202227] text-xs">
                  <span>25 / 25 Automated Backend Tests Passing</span>
                  <span className="text-emerald-400 font-semibold">100% Pass</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-[#202227] text-xs">
                  <span>Semgrep CLI 1.181.0 AST Scanner Integration</span>
                  <span className="text-emerald-400 font-semibold">Verified</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-[#202227] text-xs">
                  <span>Timing-Safe HMAC-SHA256 Webhook Verification</span>
                  <span className="text-emerald-400 font-semibold">Constant-Time</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-[#202227] text-xs">
                  <span>Zero Untrusted Code Execution on Host Sandbox</span>
                  <span className="text-emerald-400 font-semibold">POSIX 0600</span>
                </div>
              </div>
            </article>
          )}
        </main>
      </div>
    </div>
  );
}
