/**
 * Centralized Finding Presentation & Sanitization Mapper
 * Translates raw scanner diagnostics, local filesystem paths, and Semgrep rule IDs
 * into human-readable titles, relative paths, and progressive disclosure metadata.
 */

export interface NormalizedFinding {
  id: string;
  rule: string; // Original technical Semgrep rule ID
  title: string; // Human-readable title (e.g. "Unsafe Dynamic Code Evaluation")
  cwe: string; // e.g. "CWE-95"
  cweTitle: string; // Full CWE taxonomy name
  severity: 'ERROR' | 'WARNING' | 'INFO';
  severityLabel: 'Critical' | 'High' | 'Low';
  filePath: string; // Relative repository path (e.g. "fixtures/demo/insecure_example.py")
  line: number;
  explanation: string;
  rawMessage: string;
  remediationSummary: string;
  safeCodeDiff: string;
  source: string;
  scanId?: string;
  repository?: string;
  scannedAt?: string;
  acknowledged?: boolean;
}

export interface UniqueFindingPattern {
  patternId: string;
  title: string;
  cwe: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  severityLabel: 'Critical' | 'High' | 'Low';
  filePath: string;
  line: number;
  explanation: string;
  representativeFinding: NormalizedFinding;
  occurrenceCount: number;
  historicalScanIds: string[];
  firstDetectedAt: string;
  lastDetectedAt: string;
  allAcknowledged: boolean;
}

/**
 * Normalizes absolute local machine file paths to clean repository-relative paths.
 * Strips `/Users/.../CodeSentinel_Complete/`, `/home/...`, `/tmp/...` safely.
 */
export function normalizeFilePath(rawPath: string | undefined): string {
  if (!rawPath || typeof rawPath !== 'string') return 'fixtures/demo/insecure_example.py';

  let clean = rawPath.trim();

  // If path contains known project root substring, slice from relative folder
  const markers = [
    'CodeSentinel_Complete/',
    'CodeSentinel/',
    'fixtures/',
    'src/',
    'config/',
    'lib/',
    'rules/',
  ];

  for (const marker of markers) {
    const idx = clean.indexOf(marker);
    if (idx !== -1) {
      if (marker.endsWith('/')) {
        // e.g. if marker is 'fixtures/', keep 'fixtures/demo/...'
        if (marker === 'CodeSentinel_Complete/' || marker === 'CodeSentinel/') {
          return clean.slice(idx + marker.length);
        }
        return clean.slice(idx);
      }
    }
  }

  // Strip standard macOS / Linux absolute paths if no marker matched
  clean = clean.replace(/^\/Users\/[^/]+\/[^/]+\//, '');
  clean = clean.replace(/^\/home\/[^/]+\/[^/]+\//, '');
  clean = clean.replace(/^\/tmp\/[a-zA-Z0-9_-]+\//, '');
  clean = clean.replace(/^\/private\/var\/[^/]+\//, '');

  return clean || 'fixtures/demo/insecure_example.py';
}

/**
 * Maps Semgrep technical rule IDs to human-readable developer titles.
 */
export function getFindingTitle(ruleId: string | undefined, message?: string): string {
  const rule = (ruleId || '').toLowerCase();
  const msg = (message || '').toLowerCase();

  if (rule.includes('python-eval') || rule.includes('security.eval') || msg.includes('eval(')) {
    return 'Unsafe Dynamic Code Evaluation';
  }
  if (rule.includes('subprocess') || rule.includes('shell-injection') || rule.includes('command-injection') || msg.includes('subprocess')) {
    return 'Arbitrary Command Injection via Shell Subprocess';
  }
  if (rule.includes('sqli') || rule.includes('sql-injection') || msg.includes('sql')) {
    return 'SQL Injection in Database Query Execution';
  }
  if (rule.includes('path-traversal') || rule.includes('directory-traversal') || msg.includes('traversal')) {
    return 'Path Traversal Vulnerability in File Handling';
  }
  if (rule.includes('hardcoded-secret') || rule.includes('private-key') || rule.includes('token')) {
    return 'Hardcoded Cryptographic Secret Detected';
  }
  if (rule.includes('insecure-deserialization') || rule.includes('pickle')) {
    return 'Insecure Object Deserialization via Untrusted Stream';
  }

  // Fallback: Humanize unknown rule ID cleanly
  const lastSegment = (ruleId || 'security.code.vulnerability').split('.').pop() || 'Vulnerability';
  return lastSegment
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') + ' Pattern';
}

/**
 * Returns CWE taxonomy metadata for known rule signatures.
 */
export function getFindingCwe(ruleId: string | undefined): { cwe: string; title: string } {
  const rule = (ruleId || '').toLowerCase();

  if (rule.includes('python-eval') || rule.includes('eval')) {
    return {
      cwe: 'CWE-95',
      title: "Improper Neutralization of Directives in Dynamically Evaluated Code ('Eval Injection')",
    };
  }
  if (rule.includes('subprocess') || rule.includes('command')) {
    return {
      cwe: 'CWE-78',
      title: "Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection')",
    };
  }
  if (rule.includes('sqli') || rule.includes('sql')) {
    return {
      cwe: 'CWE-89',
      title: "Improper Neutralization of Special Elements used in an SQL Command ('SQL Injection')",
    };
  }
  if (rule.includes('path') || rule.includes('traversal')) {
    return {
      cwe: 'CWE-22',
      title: "Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')",
    };
  }
  if (rule.includes('secret') || rule.includes('key')) {
    return {
      cwe: 'CWE-798',
      title: 'Use of Hard-coded Credentials',
    };
  }

  return {
    cwe: 'CWE-699',
    title: 'Software Development Security Flaw',
  };
}

/**
 * Returns developer-centric explanation of what the flaw is.
 */
export function getFindingExplanation(ruleId: string | undefined, rawMessage?: string): string {
  const rule = (ruleId || '').toLowerCase();

  if (rule.includes('python-eval') || rule.includes('eval')) {
    return 'Dynamic evaluation executes arbitrary statements within current process privileges. Untrusted input passed to eval() permits remote code execution (RCE).';
  }
  if (rule.includes('subprocess') || rule.includes('command')) {
    return 'Spawning shell processes with variable interpolation enables command substitution and unauthorized process invocation on the host environment.';
  }
  if (rule.includes('sqli') || rule.includes('sql')) {
    return 'Direct string concatenation in database queries allows input to break out of query boundaries and execute arbitrary SQL instructions.';
  }

  return rawMessage || 'Potential security vulnerability flagged by static analysis AST pattern evaluation.';
}

/**
 * Returns standard-library remediation advice and code diff.
 */
export function getFindingRemediation(ruleId: string | undefined): { summary: string; codeDiff: string } {
  const rule = (ruleId || '').toLowerCase();

  if (rule.includes('python-eval') || rule.includes('eval')) {
    return {
      summary:
        'Avoid passing untrusted expressions to Python built-in eval(). Replace with standard library ast.literal_eval() for data literals, or strictly deserialize with json.loads().',
      codeDiff: `# Remediated Implementation:
- def execute_user_calculation(expr):
-     return eval(expr)  # Insecure dynamic code execution
+ import ast
+ def execute_user_calculation(expr):
+     return ast.literal_eval(expr)  # Safe literal evaluator (rejects code)`,
    };
  }

  return {
    summary:
      'Sanitize all input arguments, avoid shell wrappers, and replace dynamic string interpolation with parameterized APIs.',
    codeDiff: `# Remediate by passing argument vectors without shell=True`,
  };
}

/**
 * Normalizes a raw finding object from the backend API into a presentation-ready model.
 */
export function normalizeFinding(raw: any, acknowledgedList: string[] = []): NormalizedFinding {
  const rule = raw.rule || 'rules.codesentinel.demo.python-eval';
  const cweInfo = getFindingCwe(rule);
  const title = getFindingTitle(rule, raw.message);
  const filePath = normalizeFilePath(raw.path);
  const explanation = getFindingExplanation(rule, raw.message);
  const rem = getFindingRemediation(rule);

  const rawSev = (raw.severity || 'ERROR').toUpperCase();
  const severity: 'ERROR' | 'WARNING' | 'INFO' =
    rawSev === 'ERROR' || rawSev === 'CRITICAL'
      ? 'ERROR'
      : rawSev === 'WARNING' || rawSev === 'HIGH'
      ? 'WARNING'
      : 'INFO';

  const severityLabel: 'Critical' | 'High' | 'Low' =
    severity === 'ERROR' ? 'Critical' : severity === 'WARNING' ? 'High' : 'Low';

  const id = raw.id || `${rule}-${filePath}-${raw.line || 8}`;
  const isAcknowledged = acknowledgedList.includes(id) || Boolean(raw.acknowledged);

  return {
    id,
    rule,
    title,
    cwe: cweInfo.cwe,
    cweTitle: cweInfo.title,
    severity,
    severityLabel,
    filePath,
    line: Number(raw.line || 8),
    explanation,
    rawMessage: raw.message || '',
    remediationSummary: rem.summary,
    safeCodeDiff: rem.codeDiff,
    source: raw.source || 'semgrep-fixture',
    scanId: raw.scanId,
    repository: raw.repository || 'local/controlled-fixture',
    scannedAt: raw.scannedAt || new Date().toISOString(),
    acknowledged: isAcknowledged,
  };
}

/**
 * Groups multiple review occurrences of the same finding pattern into a single pattern summary.
 */
export function groupFindingsByPattern(
  rawFindings: any[],
  acknowledgedList: string[] = []
): UniqueFindingPattern[] {
  const patternMap = new Map<string, NormalizedFinding[]>();

  for (const raw of rawFindings) {
    const norm = normalizeFinding(raw, acknowledgedList);
    const key = `${norm.rule}::${norm.filePath}::${norm.line}`;
    if (!patternMap.has(key)) {
      patternMap.set(key, []);
    }
    patternMap.get(key)!.push(norm);
  }

  const results: UniqueFindingPattern[] = [];

  for (const [key, occurrences] of patternMap.entries()) {
    const rep = occurrences[0];
    const historicalScanIds = Array.from(
      new Set(occurrences.map((o) => o.scanId).filter(Boolean) as string[])
    );

    const dates = occurrences.map((o) => o.scannedAt || '').filter(Boolean).sort();
    const firstDetectedAt = dates[0] || new Date().toISOString();
    const lastDetectedAt = dates[dates.length - 1] || firstDetectedAt;
    const allAcknowledged = occurrences.every((o) => o.acknowledged);

    results.push({
      patternId: key,
      title: rep.title,
      cwe: rep.cwe,
      severity: rep.severity,
      severityLabel: rep.severityLabel,
      filePath: rep.filePath,
      line: rep.line,
      explanation: rep.explanation,
      representativeFinding: rep,
      occurrenceCount: occurrences.length,
      historicalScanIds,
      firstDetectedAt,
      lastDetectedAt,
      allAcknowledged,
    });
  }

  return results;
}
