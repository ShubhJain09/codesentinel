import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export function parseSemgrepReport(json) {
  if (typeof json !== 'string') throw new Error('Scanner did not return JSON');
  let report;
  try { report = JSON.parse(json); }
  catch { throw new Error('Scanner returned malformed JSON'); }
  if (!Array.isArray(report?.results) || !Array.isArray(report?.errors)) {
    throw new Error('Unexpected Semgrep report structure');
  }
  if (report.errors.length) throw new Error('Semgrep reported configuration or parsing errors');
  if (report.results.length > 250) throw new Error('Scan has more than 250 findings: refusing truncated report');
  return report.results.slice(0, 250).map((item, index) => ({
    id: `finding-${index + 1}`,
    rule: String(item.check_id ?? 'unknown-rule').slice(0, 150),
    path: String(item.path ?? '').slice(0, 280),
    line: Number.isSafeInteger(item.start?.line) ? item.start.line : null,
    severity: ['ERROR', 'WARNING', 'INFO'].includes(item.extra?.severity)
      ? item.extra.severity : 'INFO',
    message: String(item.extra?.message ?? 'Potential issue detected').slice(0, 500),
  }));
}

/** Scan ONLY the version-controlled, controlled demonstration fixtures.
 *  Never accept a repo URL, filesystem path, rule file, or process argument from HTTP input.
 *  Supports scanning 'all', 'insecure', or 'safe' fixtures independently.
 */
export async function scanDemoFixture({ root = process.cwd(), execute = execFileAsync, target = 'all' } = {}) {
  const rules = path.resolve(root, 'rules/semgrep-demo.yml');
  let fixtureTarget;
  if (target === 'safe') {
    fixtureTarget = path.resolve(root, 'fixtures/demo/safe_example.py');
  } else if (target === 'insecure') {
    fixtureTarget = path.resolve(root, 'fixtures/demo/insecure_example.py');
  } else {
    fixtureTarget = path.resolve(root, 'fixtures/demo');
  }

  const args = ['scan', '--config', rules, '--json', '--metrics=off', fixtureTarget];
  try {
    const safeEnv = { ...process.env };
    delete safeEnv.GITHUB_TOKEN;
    delete safeEnv.WEBHOOK_SECRET;
    delete safeEnv.OWNER_PASSWORD;
    const home = process.env.HOME || '';
    const localBin = home ? path.join(home, '.local', 'bin') : '';
    const uvBin = home ? path.join(home, '.local', 'share', 'uv', 'tools', 'semgrep', 'bin') : '';
    safeEnv.PATH = [uvBin, localBin, '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', process.env.PATH || ''].filter(Boolean).join(':');
    safeEnv.SEMGREP_SEND_METRICS = 'off';
    safeEnv.SEMGREP_ENABLE_VERSION_CHECK = '0';

    const result = await execute('semgrep', args, {
      cwd: root, timeout: 30_000, maxBuffer: 4 * 1024 * 1024,
      env: safeEnv,
    });
    const findings = parseSemgrepReport(result.stdout);
    return {
      status: 'completed',
      verdict: findings.length > 0 ? 'vulnerabilities_detected' : 'clean',
      findings,
      scannedTarget: path.relative(root, fixtureTarget),
      ruleset: path.relative(root, rules),
      exitCode: 0,
      warning: null,
    };
  } catch (err) {
    // Some CLI versions can exit nonzero while emitting machine-readable findings.
    // Only accept a parsed report if Semgrep explicitly returned results and NO errors.
    if (typeof err.stdout === 'string' && err.stdout.trim().startsWith('{')) {
      try {
        const findings = parseSemgrepReport(err.stdout);
        if (!err.killed && !err.signal && err.code === 1) {
          return {
            status: 'completed',
            verdict: findings.length > 0 ? 'vulnerabilities_detected' : 'clean',
            findings,
            scannedTarget: path.relative(root, fixtureTarget),
            ruleset: path.relative(root, rules),
            exitCode: err.code ?? 1,
            warning: null,
          };
        }
      } catch { /* Preserve original command failure below. */ }
    }
    const missing = err.code === 'ENOENT';
    return {
      status: missing ? 'scanner_unavailable' : 'scanner_failed',
      verdict: 'execution_failed',
      findings: [],
      scannedTarget: path.relative(root, fixtureTarget),
      ruleset: path.relative(root, rules),
      exitCode: err.code ?? -1,
      warning: missing ? 'Semgrep is not installed or not in PATH.'
        : `Semgrep execution failed (code: ${err.code ?? 'unknown'}). No clean result may be inferred. Check stderr: ${String(err.stderr || err.message).slice(0, 200)}`,
    };
  }
}
