import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseSemgrepReport } from './scanner.js';
import { safePythonPath, createGitHubClient, configuredGitHubToken, formatPrReport } from './github.js';

const execAsync = promisify(execFile);
const shaOk = s => typeof s === 'string' && /^[a-f0-9]{40}$/.test(s);

/** Static analysis only. Never run code, tests, dependency installers or build scripts from a PR. */
export async function scanChangedFiles(files, { root, execute = execAsync } = {}) {
  if (!Array.isArray(files) || files.length > 30) throw new Error('Invalid changed file count');
  if (!files.length) return { status:'unsupported_scope', findings:[], warning:'No changed Python source files were eligible for scanning; this is NOT a clean report for other languages.' };
  const scratch = await mkdtemp(path.join(tmpdir(), 'codesentinel-pr-'));
  try {
    for (const f of files) {
      if (!safePythonPath(f.path) || path.isAbsolute(f.path) || !Buffer.isBuffer(f.bytes)) throw new Error('Untrusted scan file path');
      const full = path.resolve(scratch, f.path);
      if (!full.startsWith(`${scratch}${path.sep}`)) throw new Error('Path outside workspace');
      await mkdir(path.dirname(full), { recursive:true });
      await writeFile(full, f.bytes, {mode:0o600,flag:'wx'});
    }
    try {
      const safeEnv = { ...process.env };
      delete safeEnv.GITHUB_TOKEN;
      delete safeEnv.WEBHOOK_SECRET;
      delete safeEnv.OWNER_PASSWORD;
      delete safeEnv.INITIAL_OWNER_PASSWORD;
      const home = process.env.HOME || '';
      const localBin = home ? path.join(home, '.local', 'bin') : '';
      safeEnv.PATH = [localBin, '/opt/homebrew/bin', '/usr/local/bin', process.env.PATH || ''].filter(Boolean).join(':');
      safeEnv.SEMGREP_SEND_METRICS = 'off';
      safeEnv.SEMGREP_ENABLE_VERSION_CHECK = '0';

      const result = await execute('semgrep', ['scan', '--json', '--metrics=off', '--disable-version-check', '--no-git-ignore', '--config', path.join(root,'rules/semgrep-security.yml'), scratch], {
        cwd: scratch, timeout: 60_000, maxBuffer: 12 * 1024 * 1024,
        env: safeEnv,
      });
      return {status:'completed',findings:normalize(parseSemgrepReport(result.stdout),scratch),warning:null};
    } catch (err) {
      if (typeof err.stdout === 'string' && err.code === 1 && !err.signal && !err.killed) {
        try { return {status:'completed',findings:normalize(parseSemgrepReport(err.stdout),scratch),warning:null}; } catch {}
      }
      return {status:err.code === 'ENOENT' ? 'scanner_unavailable':'scanner_failed',findings:[],warning:err.code === 'ENOENT' ? 'Semgrep is not available on the server PATH.' : 'Semgrep did not complete correctly; inspect the server logs and rules configuration.'};
    }
  } finally { await rm(scratch,{recursive:true,force:true}); }
}
function normalize(findings, dir) {
  return findings.map(f => ({...f,path:path.isAbsolute(f.path) ? path.relative(dir,f.path) : f.path }));
}
export function createPipeline({ store, root, env = process.env, fetchFn = fetch, runFiles = (files) => scanChangedFiles(files,{root}), logger = console } = {}) {
  const pending = new Set();
  async function process(record, { installationId } = {}) {
    if (pending.has(record.id)) return;
    pending.add(record.id);
    const started = Date.now();
    try {
      await store.update(record.id,{status:'fetching',warning:null});
      const token = await configuredGitHubToken({installationId,fetchFn,env});
      if (!token) throw new Error('GitHub authentication unavailable. Configure GITHUB_TOKEN or GitHub App credentials.');
      const github = createGitHubClient({token,fetchFn});
      const pull = await github.pr(record.repository,record.prNumber);
      if (!shaOk(pull?.head?.sha) || pull.head.sha !== record.headSha) throw new Error('PR head has changed. Discard stale scan and trigger a new delivery.');
      if (pull.base?.repo?.full_name && pull.base.repo.full_name.toLowerCase() !== record.repository.toLowerCase()) throw new Error('Unexpected PR base repository');
      const files = await github.changedPythonFiles(record.repository,record.prNumber,record.headSha);
      await store.update(record.id,{status:'scanning',scannedFiles:files.length});
      const result = await runFiles(files);
      const durationMs = Date.now()-started;
      let next = {...result,scannedFiles:files.length,durationMs,finishedAt:new Date().toISOString(),source:'github-pr-scan'};
      if (result.status === 'completed' && env.GITHUB_COMMENT_MODE === 'write') {
        // Re-check for stale PR head; never report old results as the latest status.
        const latest = await github.pr(record.repository,record.prNumber);
        if (latest?.head?.sha !== record.headSha) throw new Error('PR moved while scanning; not posting stale results.');
        const markdown = formatPrReport({...record, ...next});
        next.comment = await github.commentOnce(record.repository,record.prNumber,markdown);
      } else {
        next.comment = 'disabled_or_not_completed';
      }
      await store.update(record.id,next);
    } catch (err) {
      logger.warn?.('PR pipeline failed:',String(err.message).replaceAll(env.GITHUB_TOKEN||'___NOT_A_TOKEN___','[redacted]'));
      await store.update(record.id,{status:'pipeline_failed',warning:err.message.includes('authentication') ? 'Configure GitHub credentials first.' : err.message.slice(0,250),findings:[],finishedAt:new Date().toISOString(),durationMs:Date.now()-started});
    } finally { pending.delete(record.id); }
  }
  function enqueue(record,opts={}) { void process(record,opts); }
  return {process,enqueue};
}
