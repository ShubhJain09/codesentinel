/**
 * Prototype pattern rules (CS-001 – CS-005).
 *
 * These are deliberately small, line-based patterns used to make the Sightline
 * prototype truthful: every finding shown in the UI is produced by running these
 * matchers over the changed lines of a sample fixture. They are NOT Semgrep rules
 * and make no claim about real-world detection coverage.
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export const SEVERITY_ORDER: readonly Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};

export interface MatchRange {
  start: number;
  end: number;
}

export interface Rule {
  id: string;
  name: string;
  category: string;
  severity: Severity;
  cwe: string;
  /** One plain sentence: what this finding means. */
  summary: string;
  /** What the matcher looks for, in plain words. */
  matches: string;
  /** Lines the rule flags and lines it deliberately ignores (also used by the tests). */
  examples: { flagged: string[]; ignored: string[] };
  /** Why a match on this line was flagged. */
  why: string;
  impact: string;
  remediation: string;
  safer: { before: string; after: string };
  limitations: string[];
  /** Returns the highlighted range on the line, or null if the rule does not match. */
  test: (line: string) => MatchRange | null;
  /** When true, the matched range is redacted in evidence. */
  redactMatch?: boolean;
}

export const RULESET_VERSION = 'prototype-rules 0.1';

/** Extends a match that ends at an opening parenthesis to its balanced closing parenthesis. */
function callRange(line: string, start: number, openIdx: number): MatchRange {
  let depth = 0;
  let quote: string | null = null;
  for (let i = openIdx; i < line.length; i++) {
    const ch = line[i]!;
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')' && --depth === 0) return { start, end: i + 1 };
  }
  return { start, end: line.length };
}

function trimEnd(line: string, r: MatchRange): MatchRange {
  let end = r.end;
  while (end > r.start && /[\s;]/.test(line[end - 1]!)) end--;
  return { start: r.start, end };
}

const isComment = (line: string): boolean => /^\s*(\/\/|\*|\/\*)/.test(line);

function firstMatch(re: RegExp, line: string, group = 0): MatchRange | null {
  const m = re.exec(line);
  if (!m || m.index === undefined) return null;
  const text = m[group];
  if (text === undefined) return null;
  const start = group === 0 ? m.index : line.indexOf(text, m.index);
  return { start, end: start + text.length };
}

export const RULES: readonly Rule[] = [
  {
    id: 'CS-001',
    name: 'Hardcoded secret-like value',
    category: 'Secrets',
    severity: 'high',
    cwe: 'CWE-798',
    summary: "A credential-like value is written directly into source code.",
    examples: {
      flagged: ["const PAYMENTS_API_KEY = \"pk_demo_7d1e5c90a4b84f2e9c3a\";", "  dbPassword: 'correct-horse-battery',"],
      ignored: ["const PAYMENTS_API_KEY = process.env.PAYMENTS_API_KEY;", "const token = 'short';", "// const API_KEY = \"pk_demo_7d1e5c90a4b84f2e9c3a\";"],
    },
    matches:
      'An identifier named like a key, secret, token or password assigned a quoted literal of 12+ characters.',
    why: 'A credential-shaped name is assigned a literal string in source. Anything committed here is readable by everyone with repository access and stays in git history after removal.',
    impact:
      'If the value is a live credential, anyone who can read the repository or its history could use it to call the service it unlocks.',
    remediation:
      'Load the value from the environment or a secrets manager at runtime, rotate the exposed value, and keep only a reference in code.',
    safer: {
      before: 'const PAYMENTS_API_KEY = "pk_demo_7d1e…";',
      after: 'const PAYMENTS_API_KEY = process.env.PAYMENTS_API_KEY;',
    },
    limitations: [
      'Names and length are heuristics: test data and placeholders can match, and secrets with neutral names are missed.',
      'The rule cannot tell whether a value is live, revoked or fake.',
    ],
    redactMatch: true,
    test: (line) => {
      if (isComment(line)) return null;
      return firstMatch(
        /\b[A-Za-z0-9_]*(?:api_?key|secret|token|password|private_?key)[A-Za-z0-9_]*\s*[:=]\s*(["'`])([^"'`\s]{12,})\1/i,
        line,
        2,
      );
    },
  },
  {
    id: 'CS-002',
    name: 'Dynamic code evaluation',
    category: 'Injection',
    severity: 'high',
    cwe: 'CWE-95',
    summary: "A string is executed as JavaScript at runtime.",
    examples: {
      flagged: ["const rate = eval(expr);", "const fn = new Function(\"a\", body);"],
      ignored: ["const rate = evaluate(expr);", "// never use eval(x) here", "JSON.parse(body);"],
    },
    matches: 'Calls to eval( or new Function( in JavaScript.',
    why: 'The argument is evaluated as JavaScript at runtime. When any part of it comes from outside the program, the caller decides what code runs.',
    impact:
      'Attacker-influenced input reaching eval can execute arbitrary code with the privileges of the process.',
    remediation:
      'Replace evaluation with a parser or lookup that only accepts the operations you intend to support.',
    safer: {
      before: 'const rate = eval(rule.expression);',
      after: 'const rate = evaluateDiscount(parseRule(rule.expression), order);',
    },
    limitations: [
      'The rule does not trace where the argument comes from; constant input is still flagged.',
      'Indirect forms such as setTimeout with a string are not covered.',
    ],
    test: (line) => {
      if (isComment(line)) return null;
      const m = firstMatch(/\b(?:eval|new\s+Function)\s*\(/, line);
      return m ? callRange(line, m.start, m.end - 1) : null;
    },
  },
  {
    id: 'CS-003',
    name: 'Unsafe DOM insertion',
    category: 'Cross-site scripting',
    severity: 'medium',
    cwe: 'CWE-79',
    summary: "A value that is not a fixed string is written into the page as HTML.",
    examples: {
      flagged: ["el.innerHTML = profile.bio;", "el.outerHTML += html;", "el.insertAdjacentHTML('beforeend', row);"],
      ignored: ["root.innerHTML = '';", "el.innerHTML = \"<b>Static</b>\";", "el.textContent = profile.bio;"],
    },
    matches:
      'Assigning a non-literal value to innerHTML or outerHTML, or calling insertAdjacentHTML.',
    why: 'A value that is not a fixed string is written into the page as HTML. If it contains markup from a user, the browser will parse and run it.',
    impact:
      'User-controlled content could inject script into the page and act with the signed-in user’s session.',
    remediation:
      'Use textContent for plain text. If HTML is genuinely required, sanitize it with a maintained allow-list sanitizer first.',
    safer: {
      before: "root.querySelector('[data-profile-bio]').innerHTML = profile.bio;",
      after: "root.querySelector('[data-profile-bio]').textContent = profile.bio;",
    },
    limitations: [
      'A text pattern cannot establish whether the value is attacker-controlled.',
      'Framework escape hatches (for example dangerouslySetInnerHTML) are not covered by this version.',
    ],
    test: (line) => {
      if (isComment(line)) return null;
      const assign = /\.(?:innerHTML|outerHTML)\s*\+?=\s*(?!\s*(["'`])[^"'`$]*\1\s*;?\s*$)[^;]+/;
      const a = firstMatch(assign, line);
      if (a) return trimEnd(line, { start: a.start + 1, end: a.end });
      const c = firstMatch(/\.insertAdjacentHTML\s*\(/, line);
      return c ? callRange(line, c.start + 1, c.end - 1) : null;
    },
  },
  {
    id: 'CS-004',
    name: 'SQL built by string concatenation',
    category: 'Injection',
    severity: 'critical',
    cwe: 'CWE-89',
    summary: "A SQL query is assembled from a variable instead of a bound parameter.",
    examples: {
      flagged: ["let sql = \"SELECT * FROM users WHERE email = '\" + email + \"'\";", "const q = `DELETE FROM t WHERE id = ${id}`;"],
      ignored: ["pool.query('SELECT * FROM users WHERE email = $1', [email]);", "sql += ' AND disabled_at IS NULL';"],
    },
    matches:
      'A string containing SELECT, INSERT, UPDATE or DELETE that is joined with + or interpolated with ${…}.',
    why: 'The query text is assembled from a variable instead of passing the value as a bound parameter, so the database cannot tell data from SQL.',
    impact:
      'Input such as a crafted email address could change the query, reading or modifying rows the caller should never reach.',
    remediation:
      'Use a parameterized query and pass values separately; build optional clauses from fixed strings only.',
    safer: {
      before: `let sql = "SELECT … WHERE email = '" + email + "'";`,
      after: "const { rows } = await pool.query('SELECT … WHERE email = $1', [email]);",
    },
    limitations: [
      'Concatenating trusted constants is also flagged.',
      'Queries assembled across several lines or through query-builder helpers may be missed.',
    ],
    test: (line) => {
      if (isComment(line)) return null;
      return (
        firstMatch(/(["'])\s*(?:SELECT|INSERT|UPDATE|DELETE)\b(?:(?!\1).)*\1\s*\+/i, line) ??
        firstMatch(/`[^`]*\b(?:SELECT|INSERT|UPDATE|DELETE)\b[^`]*\$\{[^}]+\}[^`]*`/i, line)
      );
    },
  },
  {
    id: 'CS-005',
    name: 'Insecure configuration flag',
    category: 'Configuration',
    severity: 'low',
    cwe: 'CWE-614',
    summary: "A security protection is explicitly switched off in configuration.",
    examples: {
      flagged: ["cookie: { httpOnly: true, secure: false, sameSite: 'lax' },", "https.request({ rejectUnauthorized: false })"],
      ignored: ["cookie: { httpOnly: true, secure: true },", "const secureFalse = false;"],
    },
    matches: 'secure: false, httpOnly: false or rejectUnauthorized: false in an object literal.',
    why: 'A protection that defaults to on has been switched off explicitly in configuration.',
    impact:
      'Session cookies could be sent over plain HTTP, read by scripts, or TLS certificates could go unverified, depending on the flag.',
    remediation:
      'Keep the protection enabled in shared configuration and override it only in a clearly separated local-development profile.',
    safer: {
      before: "cookie: { httpOnly: true, secure: false, sameSite: 'lax' }",
      after: "cookie: { httpOnly: true, secure: true, sameSite: 'lax' }",
    },
    limitations: [
      'The rule cannot tell development-only configuration from production configuration.',
      'Only the three listed flags are covered.',
    ],
    test: (line) => {
      if (isComment(line)) return null;
      return firstMatch(/\b(?:secure|httpOnly|rejectUnauthorized)\s*:\s*false\b/, line);
    },
  },
];

export const RULES_BY_ID: ReadonlyMap<string, Rule> = new Map(RULES.map((r) => [r.id, r]));

export function getRule(id: string): Rule {
  const rule = RULES_BY_ID.get(id);
  if (!rule) throw new Error(`Unknown rule ${id}`);
  return rule;
}
