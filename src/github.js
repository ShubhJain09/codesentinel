import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const BASE = 'https://api.github.com';
const SHA = /^[a-f0-9]{40}$/;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const MAX_FILES = 30;
const MAX_FILE_BYTES = 160_000;
const MAX_TOTAL = 1_000_000;
export const REPORT_MARKER = '<!-- codesentinel-report:v1 -->';

export function assertRepositoryAllowed(repo, allowed = process.env.ALLOWED_REPOS || '') {
  if (typeof repo !== 'string' || !REPO.test(repo) || repo.includes('..')) throw new Error('Invalid repository name');
  const permit = allowed.split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (!permit.includes(repo.toLowerCase())) throw new Error('Repository is not on ALLOWED_REPOS; no remote scan is allowed');
  return repo;
}
export function safePythonPath(p) {
  if (typeof p !== 'string' || p.length > 240 || !p.endsWith('.py') || p.startsWith('/') || p.includes('\\') || /(^|\/)\.{1,2}(\/|$)/.test(p) || p.includes('\0')) return false;
  return p.split('/').every(s => /^[a-zA-Z0-9_. -]+$/.test(s) && s !== '.' && s !== '..');
}
function b64url(data) { return Buffer.from(data).toString('base64url'); }
export async function installationToken({ appId, privateKeyFile, installationId, fetchFn = fetch }) {
  if (!/^\d+$/.test(String(appId)) || !/^\d+$/.test(String(installationId))) throw new Error('Invalid GitHub App identifiers');
  const pem = await readFile(privateKeyFile, 'utf8');
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'RS256' }));
  const claim = b64url(JSON.stringify({ iat: now - 60, exp: now + 480, iss: String(appId) }));
  const signed = `${header}.${claim}`;
  const signer = createSign('RSA-SHA256'); signer.update(signed); signer.end();
  const jwt = `${signed}.${signer.sign(pem, 'base64url')}`;
  const response = await fetchFn(`${BASE}/app/installations/${installationId}/access_tokens`, {
    method:'POST', headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/vnd.github+json', 'User-Agent':'CodeSentinel-OJT', 'X-GitHub-Api-Version':'2026-03-10' }, signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`GitHub App token request failed (HTTP ${response.status})`);
  const result = await response.json();
  if (!result?.token) throw new Error('Missing installation token');
  return result.token;
}
export async function configuredGitHubToken({ installationId, fetchFn = fetch, env = process.env } = {}) {
  if (env.GITHUB_APP_ID && env.GITHUB_PRIVATE_KEY_FILE && installationId) {
    return installationToken({ appId: env.GITHUB_APP_ID, privateKeyFile: env.GITHUB_PRIVATE_KEY_FILE, installationId, fetchFn });
  }
  return env.GITHUB_TOKEN || '';
}
export function createGitHubClient({ token, fetchFn = fetch } = {}) {
  async function request(route, { method = 'GET', body } = {}) {
    if (typeof route !== 'string' || !route.startsWith('/') || route.startsWith('//')) throw new Error('Unsafe API route');
    const response = await fetchFn(`${BASE}${route}`, {
      method,
      headers: {
        Accept:'application/vnd.github+json', 'User-Agent':'CodeSentinel-OJT',
        'X-GitHub-Api-Version':'2026-03-10',
        ...(token ? { Authorization:`Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { 'content-type':'application/json' }),
      },
      ...(body === undefined ? {} : { body:JSON.stringify(body) }),
      signal:AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`GitHub API ${method} ${route.split('?')[0]} failed (HTTP ${response.status})`);
    if (response.status === 204) return null;
    return response.json();
  }
  return {
    request,
    async pr(repo, n) { return request(`/repos/${repo}/pulls/${n}`); },
    async changedPythonFiles(repo, prNumber, headSha) {
      if (!SHA.test(headSha)) throw new Error('Invalid head SHA');
      const result = [];
      let bytes = 0;
      for (let page = 1; page <= 11; page++) {
        const files = await request(`/repos/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`);
        if (!Array.isArray(files)) throw new Error('GitHub returned invalid file list');
        for (const f of files) {
          if (!safePythonPath(f?.filename) || !['added','modified','renamed'].includes(f.status)) continue;
          if (result.length >= MAX_FILES) throw new Error(`Scan limit exceeded: over ${MAX_FILES} Python files; refusing partial scan`);
          if (f.size > MAX_FILE_BYTES) throw new Error('Scan limit exceeded: Python file too large');
          const route = `/repos/${repo}/contents/${f.filename.split('/').map(encodeURIComponent).join('/')}?ref=${headSha}`;
          const content = await request(route);
          if (content?.type !== 'file' || content.encoding !== 'base64' || !content.content) throw new Error('Unsupported GitHub file content');
          const data = Buffer.from(content.content.replace(/\s/g,''), 'base64');
          if (data.length > MAX_FILE_BYTES || (bytes += data.length) > MAX_TOTAL) throw new Error('Scan limit exceeded: total content too large');
          result.push({ path:f.filename, bytes:data });
        }
        if (files.length < 100) return result;
      }
      throw new Error('GitHub PR file list is too large; refusing partial scan');
    },
    async commentOnce(repo, prNumber, markdown) {
      const route = `/repos/${repo}/issues/${prNumber}/comments`;
      const existing = await request(`${route}?per_page=100&page=1`);
      let ownLogin = null;
      try { ownLogin = (await request('/user'))?.login || null; } catch { /* installation credentials may not expose /user */ }
      // Searching only recent 100 comments: if the PR exceeds this, disable publishing to avoid duplication.
      if (existing.length === 100) throw new Error('PR has 100+ comments; safe automated comment deduplication is unavailable');
      const prior = existing.find(x => typeof x.body === 'string' && x.body.includes(REPORT_MARKER) && (x.user?.type === 'Bot' || (ownLogin && x.user?.login === ownLogin)));
      if (prior) { await request(`/repos/${repo}/issues/comments/${prior.id}`, {method:'PATCH',body:{body:markdown}}); return 'updated'; }
      await request(route, {method:'POST', body:{body:markdown}});
      return 'created';
    },
  };
}
export function formatPrReport({ repository, prNumber, headSha, findings, status, warning, scannedFiles, durationMs }) {
  const s = x => String(x ?? '').replace(/[\r\n]+/g, ' ').replace(/[`<>|@]/g, '_').slice(0, 170);
  const top = (findings || []).slice(0, 20).map(f => `| ${s(f.severity)} | \`${s(f.path)}:${f.line ?? '?'}\` | ${s(f.rule)} | ${s(f.message)} |`).join('\n');
  return `${REPORT_MARKER}\n## CodeSentinel security scan\n\n**Repository:** ${s(repository)} · **PR:** #${prNumber} · **Commit:** \`${headSha}\`\n\n**Status:** ${s(status)} · **Python files scanned:** ${scannedFiles} · **Findings:** ${(findings||[]).length} · **Duration:** ${(durationMs / 1000).toFixed(1)}s\n\n${warning ? `**Warning:** ${s(warning)}\n\n` : ''}${status === 'completed' ? (findings?.length ? `| Severity | Location | Rule | Explanation |\n|---|---|---|---|\n${top}` : 'No findings in the selected Python files **under the configured rules**. This is not proof of security.') : '**Scan did not finish successfully. No clean security verdict can be inferred.**'}\n\n_Analyzed source without executing repository code. Results are informational and require human review. Generated by the CodeSentinel OJT project._`;
}
