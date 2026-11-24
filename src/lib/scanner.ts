import type { FileDiff, PullRequest } from '../data/fixtures';
import { RULES, RULESET_VERSION, SEVERITY_ORDER, type MatchRange, type Severity } from '../data/rules';

export interface Finding {
  /** Stable across repeat scans of the same input: rule + file + line text. */
  fingerprint: string;
  ruleId: string;
  severity: Severity;
  filePath: string;
  line: number;
  range: MatchRange;
  /** Full line text, with the matched value redacted where the rule requires it. */
  evidence: string;
  /** Range of the (possibly redacted) match within `evidence`. */
  evidenceRange: MatchRange;
}

export type ScanOutcome =
  | { kind: 'findings'; findings: Finding[] }
  | { kind: 'clean' }
  | { kind: 'failed'; reason: string };

export interface ScanResult {
  outcome: ScanOutcome;
  filesScanned: number;
  linesScanned: number;
  rulesetVersion: string;
}

const SUPPORTED = /\.(js|mjs|cjs|ts|md)$/;

export function redact(value: string): string {
  if (value.length <= 10) return '•'.repeat(value.length);
  return `${value.slice(0, 6)}${'•'.repeat(6)}${value.slice(-4)}`;
}

function hash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function validate(files: readonly FileDiff[]): string | null {
  const bad = files.find((f) => f.status === 'binary' || !SUPPORTED.test(f.path));
  return bad ? `Unsupported file type: ${bad.path}` : null;
}

/**
 * Runs the prototype rules over the *added* lines of a pull request.
 * Context and deleted lines are not scanned: the question is what this change introduces.
 */
export function scanPullRequest(pr: PullRequest): ScanResult {
  const invalid = validate(pr.files);
  if (invalid) {
    return { outcome: { kind: 'failed', reason: invalid }, filesScanned: 0, linesScanned: 0, rulesetVersion: RULESET_VERSION };
  }

  const findings: Finding[] = [];
  let linesScanned = 0;
  for (const file of pr.files) {
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.kind !== 'add' || line.newNo === null) continue;
        linesScanned++;
        for (const rule of RULES) {
          const range = rule.test(line.text);
          if (!range) continue;
          let evidence = line.text;
          let evidenceRange = range;
          if (rule.redactMatch) {
            const masked = redact(line.text.slice(range.start, range.end));
            evidence = line.text.slice(0, range.start) + masked + line.text.slice(range.end);
            evidenceRange = { start: range.start, end: range.start + masked.length };
          }
          findings.push({
            fingerprint: hash(`${rule.id}|${file.path}|${line.text.trim()}`),
            ruleId: rule.id,
            severity: rule.severity,
            filePath: file.path,
            line: line.newNo,
            range,
            evidence,
            evidenceRange,
          });
        }
      }
    }
  }

  findings.sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
      a.filePath.localeCompare(b.filePath) ||
      a.line - b.line,
  );

  return {
    outcome: findings.length ? { kind: 'findings', findings } : { kind: 'clean' },
    filesScanned: pr.files.length,
    linesScanned,
    rulesetVersion: RULESET_VERSION,
  };
}
