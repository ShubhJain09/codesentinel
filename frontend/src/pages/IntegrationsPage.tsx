import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ProjectIcon,
  CopyIcon,
  CheckIcon,
  DownloadIcon,
  DocumentIcon,
  InfoIcon,
} from '../components/ui/AgndexIcons';
import {
  GitPullRequest,
  ShieldCheck,
  Cpu,
  Lock,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { health } from '../lib/api';

const envTemplateContents = `# CodeSentinel Server Environment Template
# Copy this file to .env in your server root.
# Generate high-entropy secrets: openssl rand -hex 32

PORT=4173
NODE_ENV=development

# GitHub Ingress (HMAC-SHA256 signature verification)
WEBHOOK_SECRET=replace_with_server_webhook_secret_here

# Monitored Repository Allowlist (comma-delimited)
ALLOWED_REPOS=local/controlled-fixture,your-org/codesentinel-fixtures

# Optional: Fine-grained GitHub Personal Access Token (for remote PR text downloads & comments)
# Contents: Read, Pull Requests: Read, Issues: Write
GITHUB_TOKEN=

# Static Analysis Configuration
SEMGREP_RULES_PATH=rules/semgrep-demo.yml
GITHUB_COMMENT_MODE=disabled
`;

export default function IntegrationsPage() {
  const [templateCopied, setTemplateCopied] = useState(false);

  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['health'],
    queryFn: health.get,
    refetchInterval: 10_000,
  });

  const copyText = (value: string) => {
    void navigator.clipboard.writeText(value);
    setTemplateCopied(true);
    setTimeout(() => setTemplateCopied(false), 2000);
  };

  const downloadEnvTemplate = () => {
    const blob = new Blob([envTemplateContents], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '.env.template';
    link.click();
    URL.revokeObjectURL(url);
  };

  const isSemgrepReady = healthData?.semgrep ?? true;
  const isGithubConfigured = Boolean(healthData?.githubConfigured);
  const allowlistedRepos = healthData?.allowlistedRepositories ?? ['local/controlled-fixture'];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 p-4 md:gap-11 md:p-8">
      {/* ── 1. PAGE HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Integrations</h1>
        <p className="text-zinc-400">
          Manage GitHub webhook ingress, repository allowlists, and static scanner readiness
        </p>
      </div>

      {/* ── 2. METADATA STATUS CHIPS ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center md:gap-2">
        <div className="agndex-meta-chip font-medium text-white">
          <ProjectIcon className="size-4 text-zinc-400" />
          CodeSentinel Workspace
        </div>
        <div className="agndex-meta-chip">
          <Cpu className="size-4 text-zinc-400" />
          Semgrep 1.181.0 {isSemgrepReady ? 'Ready' : 'Checking'}
        </div>
        <div className="agndex-meta-chip">
          <GitPullRequest className="size-4 text-zinc-400" />
          {isGithubConfigured ? 'GitHub Connected' : 'Local Development Mode; No Remote GitHub Connection Active'}
        </div>
      </div>

      {/* ── 3. HORIZONTAL DIVIDER ──────────────────────────────────────────── */}
      <div className="border-t border-white/10" />

      {/* ── 4. GITHUB WEBHOOK INGRESS GATEWAY ──────────────────────────────── */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <GitPullRequest className="size-4.5 text-[#D946EF]" />
            <h2 className="font-medium text-white text-base">GitHub Webhook Ingress</h2>
          </div>
          <p className="text-sm text-zinc-400 md:pl-6">
            Configure your GitHub repository to stream Pull Request lifecycle events to CodeSentinel
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {/* Payload URL */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">Webhook Payload URL (Development Loopback Endpoint)</span>
              <span className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                Loopback Only
              </span>
            </div>
            <div className="flex h-12 items-center justify-between rounded-xl border border-white/10 bg-[#202227] px-4">
              <span className="font-mono text-xs text-zinc-200 truncate">
                http://127.0.0.1:4173/webhooks/github
              </span>
              <button
                type="button"
                onClick={() => copyText('http://127.0.0.1:4173/webhooks/github')}
                className="size-7 rounded hover:bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                title="Copy Payload URL"
                aria-label="Copy Payload URL"
              >
                <CopyIcon className="size-4" />
              </button>
            </div>
            <p className="text-[11px] text-zinc-500">
              Notice: http://127.0.0.1:4173 is a local development loopback address. Direct webhook delivery from remote GitHub servers requires exposing this port through a reverse proxy, public host, or external tunnel.
            </p>
          </div>

          {/* Webhook Properties Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/10 bg-[#202227] p-3.5">
              <span className="text-xs text-zinc-500 block">Content Type</span>
              <span className="text-sm font-mono text-zinc-200 mt-1 block">application/json</span>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#202227] p-3.5">
              <span className="text-xs text-zinc-500 block">Signature Verification</span>
              <span className="text-sm font-mono text-emerald-400 mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" />
                HMAC-SHA256 (Constant Time)
              </span>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#202227] p-3.5">
              <span className="text-xs text-zinc-500 block">PR Comment Mode</span>
              <span className="text-sm font-mono text-zinc-300 mt-1 block">
                {healthData?.commentMode === 'write' ? 'Write Enabled' : 'Disabled (Read-Only)'}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2 text-zinc-400 text-xs">
            <InfoIcon className="size-4 shrink-0 mt-0.5 text-zinc-500" />
            <p>
              Security Guarantee: Webhook secrets and GitHub PAT tokens remain strictly on the host process and are never accessible via client-side bundles or APIs. External PR comments are not published unless GITHUB_COMMENT_MODE=write is configured with valid GitHub credentials.
            </p>
          </div>
        </div>
      </div>

      {/* ── 5. HORIZONTAL DIVIDER ──────────────────────────────────────────── */}
      <div className="border-t border-white/10" />

      {/* ── 6. MONITORED REPOSITORY ALLOWLIST ───────────────────────────────── */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4.5 text-[#D946EF]" />
            <h2 className="font-medium text-white text-base">Repository Ingress Allowlist</h2>
          </div>
          <p className="text-sm text-zinc-400 md:pl-6">
            Only pull requests targeting explicitly allowlisted repositories will be queued for AST analysis
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#202227] divide-y divide-white/5 overflow-hidden">
          {allowlistedRepos.length === 0 ? (
            <div className="p-4 text-xs text-zinc-400">No repositories configured in ALLOWED_REPOS.</div>
          ) : (
            allowlistedRepos.map((repo) => (
              <div key={repo} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="size-2 rounded-full bg-emerald-400" />
                  <span className="font-mono text-sm text-zinc-200">{repo}</span>
                </div>
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
                  Allowlisted & Monitored
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── 7. HORIZONTAL DIVIDER ──────────────────────────────────────────── */}
      <div className="border-t border-white/10" />

      {/* ── 8. ENVIRONMENT CONFIGURATION TEMPLATE ──────────────────────────── */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium text-white text-base">Environment Configuration Template</h2>
            <p className="text-sm text-zinc-400">
              Reference template for server-side secret management and CI deployment
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => copyText(envTemplateContents)}
              className="agndex-btn-outline h-9 px-3 text-xs gap-1.5"
            >
              {templateCopied ? (
                <CheckIcon className="size-3.5 text-emerald-400" />
              ) : (
                <CopyIcon className="size-3.5" />
              )}
              <span>{templateCopied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              type="button"
              onClick={downloadEnvTemplate}
              className="agndex-btn-outline h-9 px-3 text-xs gap-1.5"
            >
              <DownloadIcon className="size-3.5" />
              <span>Download .env.template</span>
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#202227] p-4 text-xs font-mono text-zinc-300">
          <pre className="whitespace-pre-wrap leading-relaxed">
{`CODESENTINEL_PROJECT_ID = pst_pd_143_g385_c101d38e
WEBHOOK_SECRET          = [Configured in server .env]
ALLOWED_REPOS           = ${allowlistedRepos.join(',')}
SEMGREP_RULES_PATH      = rules/semgrep-demo.yml`}
          </pre>
        </div>

        <div className="flex items-start gap-2 text-zinc-400 text-xs">
          <InfoIcon className="size-4 shrink-0 mt-0.5 text-zinc-500" />
          <p>
            Generate cryptographic secrets on the server via <code className="text-zinc-200">openssl rand -hex 32</code>. Never store plaintext webhook secrets or access tokens in source control.
          </p>
        </div>
      </div>
    </div>
  );
}
