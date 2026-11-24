/**
 * Controlled sample pull requests. All repositories, authors and code here are
 * fictional fixtures written for this prototype. Nothing is fetched from GitHub.
 */

export type DiffKind = 'add' | 'del' | 'ctx';

export interface DiffLine {
  kind: DiffKind;
  oldNo: number | null;
  newNo: number | null;
  text: string;
}

export interface Hunk {
  header: string;
  lines: DiffLine[];
}

export interface FileDiff {
  path: string;
  status: 'added' | 'modified' | 'binary';
  hunks: Hunk[];
  additions: number;
  deletions: number;
}

export interface PullRequest {
  repo: string;
  number: number;
  title: string;
  author: string;
  branch: string;
  base: string;
  summary: string;
  files: FileDiff[];
}

export interface Repository {
  name: string;
  description: string;
  language: string;
}

interface HunkSpec {
  oldStart: number;
  newStart: number;
  context?: string;
  body: string;
}

function parseHunk({ oldStart, newStart, context, body }: HunkSpec): Hunk {
  let oldNo = oldStart;
  let newNo = newStart;
  const lines: DiffLine[] = [];
  const raw = body.replace(/^\n/, '').replace(/\n$/, '').split('\n');
  for (const r of raw) {
    const mark = r.charAt(0);
    const text = r.slice(1);
    if (mark === '+') lines.push({ kind: 'add', oldNo: null, newNo: newNo++, text });
    else if (mark === '-') lines.push({ kind: 'del', oldNo: oldNo++, newNo: null, text });
    else lines.push({ kind: 'ctx', oldNo: oldNo++, newNo: newNo++, text });
  }
  const oldLen = lines.filter((l) => l.kind !== 'add').length;
  const newLen = lines.filter((l) => l.kind !== 'del').length;
  const header = `@@ -${oldStart},${oldLen} +${newStart},${newLen} @@${context ? ` ${context}` : ''}`;
  return { header, lines };
}

function file(path: string, status: FileDiff['status'], hunks: HunkSpec[]): FileDiff {
  const parsed = hunks.map(parseHunk);
  const all = parsed.flatMap((h) => h.lines);
  return {
    path,
    status,
    hunks: parsed,
    additions: all.filter((l) => l.kind === 'add').length,
    deletions: all.filter((l) => l.kind === 'del').length,
  };
}

export const REPOSITORIES: readonly Repository[] = [
  { name: 'demo-auth-service', description: 'Accounts, sessions and profile pages', language: 'JavaScript' },
  { name: 'billing-api', description: 'Invoices and payment webhooks', language: 'JavaScript' },
  { name: 'docs-site', description: 'Product documentation build', language: 'JavaScript' },
];

const authPR: PullRequest = {
  repo: 'demo-auth-service',
  number: 12,
  title: 'Render profile bios and refresh sessions',
  author: 'mira.k',
  branch: 'feature/profile-bios',
  base: 'main',
  summary:
    'Adds editable profile bios, a discount rule for annual plans, a payments client and longer-lived sessions.',
  files: [
    file('src/db/users.js', 'modified', [
      {
        oldStart: 12,
        newStart: 12,
        context: "import { pool } from './pool.js';",
        body: `
 export async function findUserById(id) {
   const { rows } = await pool.query('SELECT id, email, display_name FROM users WHERE id = $1', [id]);
   return rows[0] ?? null;
 }

-export async function findUserByEmail(email) {
-  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
-  return rows[0] ?? null;
-}
+export async function findUserByEmail(email, { includeDisabled = false } = {}) {
+  let sql = "SELECT id, email, display_name, bio FROM users WHERE email = '" + email + "'";
+  if (!includeDisabled) {
+    sql += ' AND disabled_at IS NULL';
+  }
+  const { rows } = await pool.query(sql);
+  return rows[0] ?? null;
+}
+
+export async function updateBio(userId, bio) {
+  await pool.query('UPDATE users SET bio = $1 WHERE id = $2', [bio, userId]);
+}
`,
      },
    ]),
    file('src/client/profile.js', 'modified', [
      {
        oldStart: 1,
        newStart: 1,
        body: `
 import { getJSON } from './http.js';
+import { formatJoinDate } from './dates.js';

 export function renderProfile(root, profile) {
   root.querySelector('[data-profile-name]').textContent = profile.displayName;
+  root.querySelector('[data-profile-joined]').textContent = formatJoinDate(profile.createdAt);
+  root.querySelector('[data-profile-bio]').innerHTML = profile.bio;
 }

 export async function loadProfile(root, email) {
   const profile = await getJSON(\`/api/profile?email=\${encodeURIComponent(email)}\`);
+  if (!profile) {
+    root.innerHTML = '';
+    return;
+  }
   renderProfile(root, profile);
 }
`,
      },
    ]),
    file('src/config/payments.js', 'added', [
      {
        oldStart: 0,
        newStart: 1,
        body: `
+import { createClient } from '@acme/payments-sdk';
+
+// TODO: move to the secrets manager before launch
+const PAYMENTS_API_KEY = "pk_demo_7d1e5c90a4b84f2e9c3a";
+
+export const payments = createClient({
+  apiKey: PAYMENTS_API_KEY,
+  timeoutMs: 8000,
+  retries: 2,
+});
`,
      },
    ]),
    file('src/lib/pricing.js', 'modified', [
      {
        oldStart: 18,
        newStart: 18,
        context: 'export function priceFor(plan, seats) {',
        body: `
   return plan.unitPrice * seats;
 }
+
+// Discount rules are authored in the admin panel, e.g. "subtotal > 100 ? 0.1 : 0"
+export function applyDiscountRule(rule, order) {
+  const rate = eval(rule.expression.replace(/subtotal/g, String(order.subtotal)));
+  return Math.round(order.subtotal * (1 - rate) * 100) / 100;
+}
`,
      },
    ]),
    file('src/server/session.js', 'modified', [
      {
        oldStart: 21,
        newStart: 21,
        context: 'export function installSessions(app) {',
        body: `
   app.use(session({
     name: 'sid',
     secret: process.env.SESSION_SECRET,
     resave: false,
     saveUninitialized: false,
-    cookie: { httpOnly: true, secure: true, sameSite: 'lax' },
+    cookie: { httpOnly: true, secure: false, sameSite: 'lax', maxAge: SESSION_TTL_MS },
   }));
 }
`,
      },
    ]),
    file('test/profile.test.js', 'added', [
      {
        oldStart: 0,
        newStart: 1,
        body: `
+import { renderProfile } from '../src/client/profile.js';
+
+test('shows markup in a bio as text', () => {
+  const root = makeProfileRoot();
+  const bio = '<img src=x onerror="alert(1)">';
+  renderProfile(root, { displayName: 'Ada', createdAt: '2026-01-04', bio });
+  expect(root.querySelector('[data-profile-bio]').textContent).toBe(bio);
+});
`,
      },
    ]),
  ],
};

const billingPR: PullRequest = {
  repo: 'billing-api',
  number: 7,
  title: 'Retry failed webhook deliveries',
  author: 'jon.e',
  branch: 'fix/webhook-retries',
  base: 'main',
  summary: 'Retries webhook deliveries with exponential backoff and records the final attempt.',
  files: [
    file('src/webhooks/deliver.js', 'modified', [
      {
        oldStart: 8,
        newStart: 8,
        context: 'export async function deliver(event, endpoint) {',
        body: `
-  const res = await fetch(endpoint.url, { method: 'POST', body: JSON.stringify(event) });
-  return res.ok;
+  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
+    const res = await fetch(endpoint.url, {
+      method: 'POST',
+      headers: { 'content-type': 'application/json' },
+      body: JSON.stringify(event),
+    });
+    if (res.ok) return { delivered: true, attempt };
+    await sleep(backoff(attempt));
+  }
+  return { delivered: false, attempt: MAX_ATTEMPTS };
 }
`,
      },
    ]),
    file('src/db/deliveries.js', 'modified', [
      {
        oldStart: 3,
        newStart: 3,
        body: `
 export async function recordAttempt(eventId, result) {
-  await pool.query('INSERT INTO deliveries (event_id, ok) VALUES ($1, $2)', [eventId, result]);
+  await pool.query(
+    'INSERT INTO deliveries (event_id, ok, attempts) VALUES ($1, $2, $3)',
+    [eventId, result.delivered, result.attempt],
+  );
 }
`,
      },
    ]),
  ],
};

const docsPR: PullRequest = {
  repo: 'docs-site',
  number: 3,
  title: 'Add architecture diagram',
  author: 'sam.r',
  branch: 'docs/architecture',
  base: 'main',
  summary: 'Adds an exported architecture diagram to the docs build.',
  files: [
    { path: 'assets/architecture.bin', status: 'binary', hunks: [], additions: 0, deletions: 0 },
    file('docs/architecture.md', 'modified', [
      {
        oldStart: 1,
        newStart: 1,
        body: `
 # Architecture
+
+![System overview](../assets/architecture.bin)
`,
      },
    ]),
  ],
};

export const PULL_REQUESTS: readonly PullRequest[] = [authPR, billingPR, docsPR];

export function findPullRequest(repo: string, number: number): PullRequest | undefined {
  return PULL_REQUESTS.find((p) => p.repo === repo && p.number === number);
}

export const prKey = (pr: Pick<PullRequest, 'repo' | 'number'>): string => `${pr.repo}#${pr.number}`;
