import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import { FileStore } from './store.js';
import { getPRMetadata, verifyGitHubSignature } from './webhook.js';
import { scanDemoFixture } from './scanner.js';
import { createPipeline } from './pipeline.js';
import { assertRepositoryAllowed } from './github.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  authenticateUser, createUser, createSession, getSessionUser,
  deleteSession, updateUser, deleteUser, getAllUsers, findUserById, Roles, ensureDefaultOwner,
  isSetupRequired, revokeAllUserSessions, revokeOtherSessions, disableUser, enableUser,
  adminResetPassword, validateUsername, generateTemporaryPassword, verifyPassword,
  isUsernameTaken,
} from './auth.js';
import { createRateLimiter } from './rate-limit.js';

const execAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_BODY = 1024 * 1024;

// ── Static file map (legacy web/ dashboard + Vite dist) ───────────────────────
const staticFiles = {
  '/legacy': ['web/index.html', 'text/html; charset=utf-8'],
  '/legacy/styles.css': ['web/styles.css', 'text/css; charset=utf-8'],
  '/legacy/app.js': ['web/app.js', 'text/javascript; charset=utf-8'],
};

// ── Rate Limiters (In-Memory Sliding Window) ───────────────────────────────────
const authLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
const registerLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });
const scanLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });
const webhookLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

// ── Helpers ────────────────────────────────────────────────────────────────────
function json(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY',
    'x-xss-protection': '0',
  });
  res.end(JSON.stringify(data));
}

// ── Admin Store Helpers ────────────────────────────────────────────────────────
const ALLOWLIST_FILE = path.join(ROOT, 'data', 'allowlist.json');
const AUDIT_FILE = path.join(ROOT, 'data', 'audit.json');

async function getAllowlist(defaultFromEnv = '') {
  let fileList = [];
  try {
    const data = JSON.parse(await readFile(ALLOWLIST_FILE, 'utf8'));
    if (Array.isArray(data)) fileList = data;
  } catch {}
  const fromEnv = (defaultFromEnv || '').split(',').map(s => s.trim()).filter(Boolean);
  return Array.from(new Set(['local/controlled-fixture', ...fileList, ...fromEnv]));
}

async function saveAllowlist(list) {
  await mkdir(path.dirname(ALLOWLIST_FILE), { recursive: true });
  await writeFile(ALLOWLIST_FILE, JSON.stringify(list, null, 2), { mode: 0o600 });
}

async function getAuditLogs() {
  try {
    const data = JSON.parse(await readFile(AUDIT_FILE, 'utf8'));
    if (Array.isArray(data)) return data;
  } catch {}
  return [];
}

async function recordAudit({ action, actorEmail, target, details }) {
  try {
    const logs = await getAuditLogs();
    const entry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      action,
      actor: actorEmail || 'system',
      target: target || 'system',
      details: details || {},
    };
    const updated = [entry, ...logs].slice(0, 200);
    await mkdir(path.dirname(AUDIT_FILE), { recursive: true });
    await writeFile(AUDIT_FILE, JSON.stringify(updated, null, 2), { mode: 0o600 });
    return entry;
  } catch (e) {
    console.error('Failed to write audit log:', e.message);
  }
}

function cors(res, req) {
  const origin = req.headers.origin;
  const allowed = [
    'http://localhost:5173', 'http://127.0.0.1:5173',
    'http://127.0.0.1:4173', 'http://localhost:4173',
  ];
  if (origin && allowed.includes(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('access-control-allow-credentials', 'true');
    res.setHeader('access-control-allow-headers', 'content-type, authorization, x-codesentinel-local, x-codesentinel-csrf');
    res.setHeader('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('vary', 'Origin');
  }
}

async function receiveBody(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > MAX_BODY) {
      const error = new Error('Body too large');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

function checkRateLimit(limiter, req, res) {
  const ip = getClientIp(req);
  const result = limiter.check(ip);
  if (!result.allowed) {
    res.setHeader('retry-after', String(result.retryAfterSeconds));
    json(res, 429, { error: `Too many requests. Please wait ${result.retryAfterSeconds}s before retrying.` });
    return false;
  }
  return true;
}

function originIsLocal(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  return origin === `http://${req.headers.host}` ||
    ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://127.0.0.1:4173', 'http://localhost:4173'].includes(origin);
}

// CSRF Defense for state-changing cookie requests
function verifyCsrf(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  // Requests using Bearer authorization header are not vulnerable to browser CSRF
  if (req.headers.authorization?.startsWith('Bearer ')) return true;
  // If no session cookie is sent, CSRF does not apply
  if (!req.headers.cookie?.includes('cs-session=')) return true;

  const origin = req.headers.origin;
  if (!origin) {
    const referer = req.headers.referer;
    if (referer) {
      try {
        const u = new URL(referer);
        return u.host === req.headers.host;
      } catch { return false; }
    }
    return Boolean(req.headers['x-codesentinel-local'] || req.headers['x-codesentinel-csrf']);
  }
  try {
    const u = new URL(origin);
    const allowedHosts = [req.headers.host, 'localhost:5173', '127.0.0.1:5173', 'localhost:4173', '127.0.0.1:4173'];
    return allowedHosts.includes(u.host);
  } catch { return false; }
}

function setSessionCookie(res, req, token, maxAgeSeconds = 7 * 86400) {
  const isSecure = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
  const flags = [
    `cs-session=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
    'Path=/',
  ];
  if (isSecure) flags.push('Secure');
  res.setHeader('set-cookie', flags.join('; '));
}

// Extract Bearer token from Authorization header or cookie
function extractToken(req) {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)cs-session=([a-f0-9]{64})/);
  return match ? match[1] : null;
}

async function requireAuth(req, res, { allowMustChangePassword = false } = {}) {
  const token = extractToken(req);
  if (!token) { json(res, 401, { error: 'Authentication required' }); return null; }
  const user = await getSessionUser(token);
  if (!user) { json(res, 401, { error: 'Invalid or expired session' }); return null; }
  if (user.mustChangePassword && !allowMustChangePassword) {
    json(res, 403, {
      error: 'Password change required before accessing application resources',
      code: 'MUST_CHANGE_PASSWORD',
      mustChangePassword: true,
    });
    return null;
  }
  return user;
}

async function optionalAuth(req) {
  const token = extractToken(req);
  if (!token) return null;
  try { return await getSessionUser(token); } catch { return null; }
}

async function requireRole(req, res, minRole) {
  const user = await requireAuth(req, res);
  if (!user) return null;
  const hierarchy = [Roles.USER, Roles.ADMIN, Roles.OWNER];
  if (hierarchy.indexOf(user.role) < hierarchy.indexOf(minRole)) {
    json(res, 403, { error: 'Insufficient permissions' });
    return null;
  }
  return user;
}

function validateEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}
function validatePassword(pw) {
  return typeof pw === 'string' && pw.length >= 8 && pw.length <= 128;
}
function validateName(name) {
  return typeof name === 'string' && name.trim().length >= 1 && name.length <= 80;
}

export function normalizeGitHubHandle(input) {
  if (input === null || input === undefined || input === '') {
    return { value: '' };
  }
  if (typeof input !== 'string') {
    return { error: 'GitHub profile must be a text string' };
  }
  let str = input.trim();
  if (str.startsWith('@')) {
    str = str.slice(1).trim();
  }
  try {
    if (str.startsWith('http://') || str.startsWith('https://')) {
      const parsed = new URL(str);
      const host = parsed.hostname.toLowerCase();
      if (host !== 'github.com' && host !== 'www.github.com') {
        return { error: 'GitHub URL must point to github.com (e.g. https://github.com/username)' };
      }
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments.length !== 1) {
        return { error: 'GitHub URL must point directly to a profile (e.g. https://github.com/username)' };
      }
      str = segments[0];
    } else if (str.toLowerCase().startsWith('github.com/')) {
      const pathPart = str.slice('github.com/'.length);
      const segments = pathPart.split('/').filter(Boolean);
      if (segments.length !== 1) {
        return { error: 'GitHub URL must point directly to a profile (e.g. github.com/username)' };
      }
      str = segments[0];
    }
  } catch {
    return { error: 'Invalid GitHub profile URL format' };
  }

  str = str.replace(/\/+$/, '');

  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(str)) {
    return { error: 'Invalid GitHub username. Must be 1-39 alphanumeric characters or hyphens (cannot start or end with a hyphen).' };
  }

  return { value: str };
}

export function validateDateOfBirth(input) {
  if (input === null || input === undefined || input === '') {
    return { value: '' };
  }
  if (typeof input !== 'string') {
    return { error: 'Date of birth must be a valid date string' };
  }
  const str = input.trim();
  if (!/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(str)) {
    return { error: 'Date of birth must be in YYYY-MM-DD format' };
  }
  const [y, m, d] = str.split('-').map(Number);
  if (y < 1900) {
    return { error: 'Date of birth year must be 1900 or later' };
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) {
    return { error: 'Invalid calendar date' };
  }
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  if (dt > todayUTC) {
    return { error: 'Date of birth cannot be in the future' };
  }
  return { value: str };
}

// ── App factory ────────────────────────────────────────────────────────────────
export function createApp({
  store = new FileStore(path.join(ROOT, 'data')),
  scan = (opts = {}) => scanDemoFixture({ root: ROOT, ...opts }),
  webhookSecret = process.env.WEBHOOK_SECRET,
  env = process.env,
  pipeline,
} = {}) {
  const worker = pipeline || createPipeline({ store, root: ROOT, env });

  // Provision owner if configured via environment, or log safe first-run mode
  ensureDefaultOwner().catch(e => console.error('Failed to provision owner:', e.message));

  return http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');

    // Handle CORS preflight
    cors(res, req);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // ── Enforce CSRF protection on mutation routes ──
      if (url.pathname.startsWith('/api/') && !verifyCsrf(req)) {
        return json(res, 403, { error: 'Cross-Site Request Forgery (CSRF) validation failed' });
      }

      // ── Static legacy dashboard ──
      if (req.method === 'GET' && staticFiles[url.pathname]) {
        const [file, type] = staticFiles[url.pathname];
        res.writeHead(200, {
          'content-type': type, 'x-content-type-options': 'nosniff',
          'referrer-policy': 'no-referrer',
          'content-security-policy': "default-src 'self' https://cdn.jsdelivr.net; script-src 'self'; style-src 'self' https://cdn.jsdelivr.net; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'",
        });
        res.end(await readFile(path.join(ROOT, file)));
        return;
      }

      // ── Serve Vite-built React app (all non-API routes) ──
      if (req.method === 'GET' && !url.pathname.startsWith('/api') &&
          !url.pathname.startsWith('/webhooks') && !url.pathname.startsWith('/legacy')) {
        try {
          let filePath = path.join(ROOT, 'frontend', 'dist', url.pathname === '/' ? 'index.html' : url.pathname);
          const ext = path.extname(filePath);
          const typeMap = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'text/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.svg': 'image/svg+xml',
            '.json': 'application/json',
            '.png': 'image/png',
            '.ico': 'image/x-icon',
            '.txt': 'text/plain',
          };
          const content = await readFile(filePath);
          res.writeHead(200, {
            'content-type': typeMap[ext] || 'application/octet-stream',
            'x-content-type-options': 'nosniff',
            'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
          });
          res.end(content);
          return;
        } catch {
          // Fall through to SPA index.html for client-side routing
          try {
            const index = await readFile(path.join(ROOT, 'frontend', 'dist', 'index.html'));
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
            res.end(index);
            return;
          } catch {
            // Vite not built yet, serve legacy dashboard
            const legacy = await readFile(path.join(ROOT, 'web', 'index.html'));
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
            res.end(legacy);
            return;
          }
        }
      }

      if (req.method === 'GET' && url.pathname === '/api/health') {
        let semgrep = false;
        let semgrepVersion = '1.181.0';
        try {
          const home = process.env.HOME || '';
          const localBin = home ? path.join(home, '.local', 'bin') : '';
          const uvBin = home ? path.join(home, '.local', 'share', 'uv', 'tools', 'semgrep', 'bin') : '';
          const healthPath = [uvBin, localBin, '/opt/homebrew/bin', '/usr/local/bin', process.env.PATH || ''].filter(Boolean).join(':');
          const { stdout } = await execAsync('semgrep', ['--version'], { timeout: 3000, maxBuffer: 20000, env: { ...process.env, PATH: healthPath } });
          semgrep = true;
          if (stdout.trim()) semgrepVersion = stdout.trim();
        } catch {}
        const currentAllowlist = await getAllowlist(env.ALLOWED_REPOS);
        return json(res, 200, {
          status: 'ok', mode: 'local-only', version: '1.0.0', semgrep, semgrepVersion,
          githubConfigured: Boolean(env.GITHUB_TOKEN || (env.GITHUB_APP_ID && env.GITHUB_PRIVATE_KEY_FILE)),
          allowlistedRepositories: currentAllowlist,
          commentMode: env.GITHUB_COMMENT_MODE === 'write' ? 'write' : 'disabled',
          mobile: 'local-notification demo available in mobile/',
        });
      }

      // ══════════════════════════════════════════════════════════════════════
      // AUTH & SETUP ENDPOINTS
      // ══════════════════════════════════════════════════════════════════════

      if (req.method === 'GET' && url.pathname === '/api/auth/setup-status') {
        const setupRequired = await isSetupRequired();
        const users = await getAllUsers();
        return json(res, 200, { setupRequired, operatorCount: users.length });
      }

      if (req.method === 'POST' && url.pathname === '/api/auth/setup') {
        if (!checkRateLimit(registerLimiter, req, res)) return;
        const setupRequired = await isSetupRequired();
        if (!setupRequired) return json(res, 403, { error: 'First-run setup has already been completed. Please log in.' });
        const body = await receiveBody(req);
        let input;
        try { input = JSON.parse(body.toString('utf8')); } catch { return json(res, 400, { error: 'Invalid JSON' }); }
        if (!validateName(input?.name)) return json(res, 400, { error: 'Name is required (1-80 chars)' });
        if (!validateEmail(input?.email)) return json(res, 400, { error: 'Valid email is required' });
        if (!validatePassword(input?.password)) return json(res, 400, { error: 'Password must be 8-128 characters' });
        try {
          const user = await createUser({ name: input.name.trim(), email: input.email, password: input.password, role: Roles.OWNER });
          const token = await createSession(user.id);
          setSessionCookie(res, req, token);
          return json(res, 201, { user, token });
        } catch (e) {
          return json(res, e.status || 500, { error: e.message });
        }
      }

      if (req.method === 'POST' && url.pathname === '/api/auth/register') {
        if (!checkRateLimit(registerLimiter, req, res)) return;
        const body = await receiveBody(req);
        let input;
        try { input = JSON.parse(body.toString('utf8')); } catch { return json(res, 400, { error: 'Invalid JSON' }); }
        if (!validateName(input?.name)) return json(res, 400, { error: 'Name is required (1-80 chars)' });
        if (!validateEmail(input?.email)) return json(res, 400, { error: 'Valid email is required' });
        if (!validatePassword(input?.password)) return json(res, 400, { error: 'Password must be 8-128 characters' });
        try {
          const user = await createUser({ name: input.name.trim(), email: input.email, password: input.password });
          const token = await createSession(user.id);
          setSessionCookie(res, req, token);
          return json(res, 201, { user, token });
        } catch (e) {
          return json(res, e.status || 500, { error: e.message });
        }
      }

      if (req.method === 'POST' && url.pathname === '/api/auth/login') {
        if (!checkRateLimit(authLimiter, req, res)) return;
        const body = await receiveBody(req);
        let input;
        try { input = JSON.parse(body.toString('utf8')); } catch { return json(res, 400, { error: 'Invalid JSON' }); }
        const loginIdentifier = (input?.login || input?.email || input?.username || '').trim();
        if (!loginIdentifier || typeof input?.password !== 'string') {
          return json(res, 400, { error: 'Login ID (username or email) and password are required' });
        }
        let user;
        try {
          user = await authenticateUser(loginIdentifier, input.password);
        } catch (e) {
          if (e.status === 403) {
            return json(res, 403, { error: e.message });
          }
          throw e;
        }
        if (!user) {
          await new Promise(r => setTimeout(r, 200 + Math.random() * 100));
          return json(res, 401, { error: 'Invalid username, email, or password' });
        }
        const token = await createSession(user.id);
        setSessionCookie(res, req, token);
        return json(res, 200, { user, token, mustChangePassword: Boolean(user.mustChangePassword) });
      }

      if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
        const token = extractToken(req);
        if (token) await deleteSession(token).catch(() => {});
        setSessionCookie(res, req, '', 0);
        return json(res, 200, { ok: true });
      }

      if (req.method === 'GET' && url.pathname === '/api/auth/me') {
        const token = extractToken(req);
        if (!token) return json(res, 401, { error: 'Not authenticated' });
        const user = await getSessionUser(token);
        if (!user) return json(res, 401, { error: 'Invalid or expired session' });
        return json(res, 200, { user });
      }

      if (req.method === 'PATCH' && url.pathname === '/api/auth/profile') {
        const user = await requireAuth(req, res, { allowMustChangePassword: true });
        if (!user) return;
        try {
          const body = await receiveBody(req);
          let input;
          try { input = JSON.parse(body.toString('utf8')); } catch { return json(res, 400, { error: 'Invalid JSON' }); }
          const patch = {};
          if (input.name !== undefined) {
            if (!validateName(input.name)) {
              return json(res, 400, { error: 'Invalid name (1-80 characters required)', field: 'name' });
            }
            patch.name = input.name.trim();
          }
          if (input.username !== undefined) {
            const u = String(input.username).trim().toLowerCase();
            if (!validateUsername(u)) {
              return json(res, 400, {
                error: 'Username must be 3-32 characters (letters, numbers, dots, hyphens, underscores) and not reserved',
                field: 'username',
              });
            }
            const taken = await isUsernameTaken(u, user.id);
            if (taken) {
              return json(res, 409, { error: 'Username already taken', field: 'username' });
            }
            patch.username = u;
          }
          if (input.bio !== undefined) {
            if (typeof input.bio !== 'string' || input.bio.length > 280) {
              return json(res, 400, { error: 'Bio must be under 280 characters', field: 'bio' });
            }
            patch.bio = input.bio.trim();
          }
          if (input.githubUsername !== undefined) {
            const ghNorm = normalizeGitHubHandle(input.githubUsername);
            if (ghNorm.error) {
              return json(res, 400, { error: ghNorm.error, field: 'githubUsername' });
            }
            patch.githubUsername = ghNorm.value;
          }
          if (input.dob !== undefined) {
            const dobNorm = validateDateOfBirth(input.dob);
            if (dobNorm.error) {
              return json(res, 400, { error: dobNorm.error, field: 'dob' });
            }
            patch.dob = dobNorm.value;
          }
          let passwordRotated = false;
          if (input.password !== undefined || input.newPassword !== undefined) {
            const newPwd = input.newPassword || input.password;
            if (!validatePassword(newPwd)) {
              return json(res, 400, { error: 'Password must be 8-128 characters', field: 'newPassword' });
            }
            if (!input.currentPassword) {
              return json(res, 400, { error: 'Current password is required to set a new password', field: 'currentPassword' });
            }
            const fullUser = await findUserById(user.id);
            const ok = await verifyPassword(input.currentPassword, fullUser?.passwordHash || '');
            if (!ok) {
              return json(res, 400, { error: 'Current password is incorrect', field: 'currentPassword' });
            }
            patch.password = newPwd;
            patch.mustChangePassword = false;
            passwordRotated = true;
          }

          if (user.mustChangePassword && !passwordRotated) {
            return json(res, 403, {
              error: 'You must set a new password before performing any other profile updates',
              code: 'MUST_CHANGE_PASSWORD',
              mustChangePassword: true,
            });
          }

          const updated = await updateUser(user.id, patch);
          if (passwordRotated) {
            const token = extractToken(req);
            if (token) await revokeOtherSessions(user.id, token).catch(() => {});
          }
          await recordAudit({
            action: 'USER_PROFILE_UPDATED',
            actorEmail: user.email,
            target: user.email,
            details: { updatedFields: Object.keys(patch) },
          });
          return json(res, 200, { user: updated });
        } catch (e) {
          console.error('Profile update error:', e.message);
          return json(res, e.status || 400, { error: e.message, field: e.field });
        }
      }

      if (req.method === 'POST' && url.pathname === '/api/auth/revoke-other-sessions') {
        const user = await requireAuth(req, res);
        if (!user) return;
        const token = extractToken(req);
        if (token) await revokeOtherSessions(user.id, token).catch(() => {});
        await recordAudit({
          action: 'USER_OTHER_SESSIONS_REVOKED',
          actorEmail: user.email,
          target: user.email,
        });
        return json(res, 200, { success: true });
      }

      if (req.method === 'POST' && url.pathname === '/api/auth/avatar') {
        const user = await requireAuth(req, res);
        if (!user) return;
        const chunks = [];
        let length = 0;
        const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB
        for await (const chunk of req) {
          length += chunk.length;
          if (length > MAX_AVATAR_SIZE) {
            return json(res, 413, { error: 'Avatar image must be smaller than 2MB' });
          }
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        if (buffer.length < 8) {
          return json(res, 400, { error: 'Invalid image data' });
        }

        // Magic byte validation: PNG, JPEG, or WebP
        let ext = null;
        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
          ext = 'png';
        } else if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
          ext = 'jpg';
        } else if (
          buffer.length >= 12 &&
          buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
          buffer.subarray(8, 12).toString('ascii') === 'WEBP'
        ) {
          ext = 'webp';
        }

        if (!ext) {
          return json(res, 400, { error: 'Unsupported format. Avatar must be a valid PNG, JPEG, or WebP image.' });
        }

        const avatarsDir = path.join(ROOT, 'data', 'avatars');
        await mkdir(avatarsDir, { recursive: true });

        // Safely remove prior avatar if exists
        const currentUser = await findUserById(user.id);
        if (currentUser?.avatarFile) {
          await unlink(path.join(avatarsDir, path.basename(currentUser.avatarFile))).catch(() => {});
        }

        const filename = `${user.id}-${randomBytes(8).toString('hex')}.${ext}`;
        await writeFile(path.join(avatarsDir, filename), buffer, { mode: 0o600 });
        const updated = await updateUser(user.id, { avatarFile: filename });
        await recordAudit({
          action: 'USER_AVATAR_UPDATED',
          actorEmail: user.email,
          target: user.email,
        });
        return json(res, 200, { user: updated, avatarUrl: `/api/users/${user.id}/avatar?t=${Date.now()}` });
      }

      if (req.method === 'DELETE' && url.pathname === '/api/auth/avatar') {
        const user = await requireAuth(req, res);
        if (!user) return;
        const currentUser = await findUserById(user.id);
        if (currentUser?.avatarFile) {
          const avatarsDir = path.join(ROOT, 'data', 'avatars');
          await unlink(path.join(avatarsDir, path.basename(currentUser.avatarFile))).catch(() => {});
        }
        const updated = await updateUser(user.id, { avatarFile: null });
        await recordAudit({
          action: 'USER_AVATAR_REMOVED',
          actorEmail: user.email,
          target: user.email,
        });
        return json(res, 200, { user: updated });
      }

      if (req.method === 'GET' && /^\/api\/users\/[a-f0-9]{16}\/avatar$/.test(url.pathname)) {
        const caller = await requireAuth(req, res);
        if (!caller) return;
        const userId = url.pathname.split('/')[3];
        const targetUser = await findUserById(userId);
        if (!targetUser) return json(res, 404, { error: 'User not found' });
        if (targetUser?.avatarFile) {
          const avatarPath = path.join(ROOT, 'data', 'avatars', path.basename(targetUser.avatarFile));
          try {
            const data = await readFile(avatarPath);
            const ext = path.extname(avatarPath).toLowerCase();
            const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
            res.writeHead(200, {
              'content-type': mime,
              'cache-control': 'private, max-age=3600',
              'x-content-type-options': 'nosniff',
            });
            res.end(data);
            return;
          } catch {}
        }

        // Return clean SVG avatar with initials
        const initial = (targetUser?.name || targetUser?.username || 'U')[0].toUpperCase();
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="64" fill="#202227"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="#D946EF" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="48" font-weight="600">${initial}</text></svg>`;
        res.writeHead(200, {
          'content-type': 'image/svg+xml; charset=utf-8',
          'cache-control': 'public, max-age=86400',
        });
        res.end(svg);
        return;
      }

      // ══════════════════════════════════════════════════════════════════════
      // ADMIN ENDPOINTS
      // ══════════════════════════════════════════════════════════════════════

      if (req.method === 'GET' && url.pathname === '/api/admin/users') {
        const caller = await requireRole(req, res, Roles.ADMIN);
        if (!caller) return;
        const users = await getAllUsers();
        // Omit passwordHash and private dob from directory listing
        const sanitized = users.map(({ passwordHash: _, dob: __, ...u }) => u);
        return json(res, 200, { users: sanitized });
      }

      if (req.method === 'POST' && url.pathname === '/api/admin/users') {
        const caller = await requireRole(req, res, Roles.ADMIN);
        if (!caller) return;
        const body = await receiveBody(req);
        let input;
        try { input = JSON.parse(body.toString('utf8')); } catch { return json(res, 400, { error: 'Invalid JSON' }); }
        if (!validateName(input?.name)) return json(res, 400, { error: 'Name is required (1-80 characters)' });
        if (!validateEmail(input?.email)) return json(res, 400, { error: 'Valid email address is required' });
        
        let pwd = input?.password;
        if (!pwd || typeof pwd !== 'string' || !pwd.trim()) {
          pwd = generateTemporaryPassword();
        } else if (!validatePassword(pwd)) {
          return json(res, 400, { error: 'Password must be 8-128 characters' });
        }

        const role = input?.role || Roles.USER;
        if (![Roles.USER, Roles.ADMIN, Roles.OWNER].includes(role)) {
          return json(res, 400, { error: 'Invalid role' });
        }
        if (role === Roles.OWNER && caller.role !== Roles.OWNER) {
          return json(res, 403, { error: 'Only System Owners can provision new Owner accounts' });
        }

        try {
          const newUser = await createUser({
            name: input.name.trim(),
            username: input.username,
            email: input.email.trim(),
            password: pwd,
            role,
            mustChangePassword: input.mustChangePassword !== false,
          });
          await recordAudit({
            action: 'USER_CREATED',
            actorEmail: caller.email,
            target: newUser.email,
            details: { name: newUser.name, username: newUser.username, role: newUser.role, mustChangePassword: newUser.mustChangePassword },
          });
          return json(res, 201, { user: newUser, temporaryPassword: pwd });
        } catch (e) {
          return json(res, e.status || 400, { error: e.message });
        }
      }

      if (req.method === 'POST' && /^\/api\/admin\/users\/[a-f0-9]{16}\/status$/.test(url.pathname)) {
        const caller = await requireRole(req, res, Roles.ADMIN);
        if (!caller) return;
        const userId = url.pathname.split('/')[4];
        if (userId === caller.id) {
          return json(res, 400, { error: 'Cannot modify your own account status' });
        }
        const body = await receiveBody(req);
        let input;
        try { input = JSON.parse(body.toString('utf8')); } catch { return json(res, 400, { error: 'Invalid JSON' }); }
        if (!['active', 'disabled'].includes(input?.status)) {
          return json(res, 400, { error: "Status must be 'active' or 'disabled'" });
        }
        try {
          let updated;
          if (input.status === 'disabled') {
            updated = await disableUser(userId);
          } else {
            updated = await enableUser(userId);
          }
          await recordAudit({
            action: 'USER_STATUS_UPDATED',
            actorEmail: caller.email,
            target: updated.email,
            details: { newStatus: updated.status },
          });
          return json(res, 200, { user: updated });
        } catch (e) {
          return json(res, e.status || 400, { error: e.message });
        }
      }

      if (req.method === 'POST' && /^\/api\/admin\/users\/[a-f0-9]{16}\/reset-password$/.test(url.pathname)) {
        const caller = await requireRole(req, res, Roles.ADMIN);
        if (!caller) return;
        const userId = url.pathname.split('/')[4];
        const target = await findUserById(userId);
        if (!target) return json(res, 404, { error: 'User not found' });
        if (target.role === Roles.OWNER && caller.role !== Roles.OWNER) {
          return json(res, 403, { error: 'Only System Owners can reset passwords for Owner accounts' });
        }
        const body = await receiveBody(req);
        let input = {};
        try { if (body.length > 0) input = JSON.parse(body.toString('utf8')); } catch {}
        let newPwd = input?.password;
        if (!newPwd || typeof newPwd !== 'string' || !newPwd.trim()) {
          newPwd = generateTemporaryPassword();
        } else if (!validatePassword(newPwd)) {
          return json(res, 400, { error: 'Password must be 8-128 characters' });
        }
        const mustChange = input?.mustChangePassword !== false;
        try {
          const updated = await adminResetPassword(userId, newPwd, mustChange);
          await recordAudit({
            action: 'USER_PASSWORD_RESET',
            actorEmail: caller.email,
            target: updated.email,
            details: { mustChangePassword: mustChange },
          });
          return json(res, 200, { success: true, temporaryPassword: newPwd });
        } catch (e) {
          return json(res, e.status || 400, { error: e.message });
        }
      }

      if (req.method === 'POST' && /^\/api\/admin\/users\/[a-f0-9]{16}\/revoke-sessions$/.test(url.pathname)) {
        const caller = await requireRole(req, res, Roles.ADMIN);
        if (!caller) return;
        const userId = url.pathname.split('/')[4];
        const target = await findUserById(userId);
        if (!target) return json(res, 404, { error: 'User not found' });
        await revokeAllUserSessions(userId);
        await recordAudit({
          action: 'USER_SESSIONS_REVOKED',
          actorEmail: caller.email,
          target: target.email,
        });
        return json(res, 200, { success: true });
      }

      if (req.method === 'PATCH' && /^\/api\/admin\/users\/[a-f0-9]{16}$/.test(url.pathname)) {
        const caller = await requireRole(req, res, Roles.OWNER);
        if (!caller) return;
        const userId = url.pathname.split('/').pop();
        const body = await receiveBody(req);
        let input;
        try { input = JSON.parse(body.toString('utf8')); } catch { return json(res, 400, { error: 'Invalid JSON' }); }
        const allowed = [Roles.USER, Roles.ADMIN, Roles.OWNER];
        if (input.role !== undefined && !allowed.includes(input.role)) return json(res, 400, { error: 'Invalid role' });
        const patch = {};
        if (input.role) patch.role = input.role;
        try {
          const updated = await updateUser(userId, patch);
          await recordAudit({
            action: 'USER_ROLE_UPDATED',
            actorEmail: caller.email,
            target: updated.email,
            details: { newRole: updated.role },
          });
          return json(res, 200, { user: updated });
        } catch (e) {
          return json(res, e.status || 400, { error: e.message });
        }
      }

      if (req.method === 'DELETE' && /^\/api\/admin\/users\/[a-f0-9]{16}$/.test(url.pathname)) {
        const caller = await requireRole(req, res, Roles.OWNER);
        if (!caller) return;
        const userId = url.pathname.split('/').pop();
        if (userId === caller.id) {
          return json(res, 400, { error: 'Cannot delete your own account while signed in' });
        }
        const targetUser = await findUserById(userId);
        if (!targetUser) return json(res, 404, { error: 'User not found' });
        try {
          await deleteUser(userId);
          await recordAudit({
            action: 'USER_DELETED',
            actorEmail: caller.email,
            target: targetUser.email,
            details: { name: targetUser.name, role: targetUser.role },
          });
          return json(res, 200, { success: true });
        } catch (e) {
          return json(res, e.status || 400, { error: e.message });
        }
      }

      if (req.method === 'GET' && url.pathname === '/api/admin/allowlist') {
        const caller = await requireRole(req, res, Roles.ADMIN);
        if (!caller) return;
        const list = await getAllowlist(env.ALLOWED_REPOS);
        return json(res, 200, {
          allowlist: list,
          mode: 'strict',
          policy: 'Zero-trust repository allowlist policy. Only explicitly listed repositories receive automated pull request review. Unlisted targets are rejected with HTTP 403.',
        });
      }

      if (req.method === 'POST' && url.pathname === '/api/admin/allowlist') {
        const caller = await requireRole(req, res, Roles.ADMIN);
        if (!caller) return;
        const body = await receiveBody(req);
        let input;
        try { input = JSON.parse(body.toString('utf8')); } catch { return json(res, 400, { error: 'Invalid JSON' }); }
        const repo = String(input.repository || '').trim();
        const valid = repo === 'local/controlled-fixture' || /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo);
        if (!valid) {
          return json(res, 400, { error: 'Invalid repository identifier. Format must be owner/repository or local/controlled-fixture.' });
        }
        const list = await getAllowlist(env.ALLOWED_REPOS);
        if (!list.map(r => r.toLowerCase()).includes(repo.toLowerCase())) {
          list.push(repo);
          await saveAllowlist(list);
          await recordAudit({ action: 'ALLOWLIST_REPO_ADDED', actorEmail: caller.email, target: repo });
        }
        return json(res, 200, { allowlist: list, success: true });
      }

      if (req.method === 'DELETE' && url.pathname.startsWith('/api/admin/allowlist/')) {
        const caller = await requireRole(req, res, Roles.ADMIN);
        if (!caller) return;
        const repo = decodeURIComponent(url.pathname.replace('/api/admin/allowlist/', '')).trim();
        if (!repo) return json(res, 400, { error: 'Missing repository' });
        if (repo.toLowerCase() === 'local/controlled-fixture') {
          return json(res, 400, { error: 'Cannot remove baseline fixture repository local/controlled-fixture' });
        }
        let list = await getAllowlist(env.ALLOWED_REPOS);
        list = list.filter(r => r.toLowerCase() !== repo.toLowerCase());
        await saveAllowlist(list);
        await recordAudit({ action: 'ALLOWLIST_REPO_REMOVED', actorEmail: caller.email, target: repo });
        return json(res, 200, { allowlist: list, success: true });
      }

      if (req.method === 'GET' && url.pathname === '/api/admin/scanner') {
        const caller = await requireRole(req, res, Roles.ADMIN);
        if (!caller) return;
        let semgrep = false;
        let semgrepVersion = '1.181.0';
        try {
          const home = process.env.HOME || '';
          const localBin = home ? path.join(home, '.local', 'bin') : '';
          const uvBin = home ? path.join(home, '.local', 'share', 'uv', 'tools', 'semgrep', 'bin') : '';
          const healthPath = [uvBin, localBin, '/opt/homebrew/bin', '/usr/local/bin', process.env.PATH || ''].filter(Boolean).join(':');
          const { stdout } = await execAsync('semgrep', ['--version'], { timeout: 3000, maxBuffer: 20000, env: { ...process.env, PATH: healthPath } });
          semgrep = true;
          if (stdout.trim()) semgrepVersion = stdout.trim();
        } catch {}
        const scansList = await store.all();
        const lastScan = scansList[0] || null;
        return json(res, 200, {
          status: 'operational',
          semgrepReady: semgrep,
          version: semgrepVersion,
          rulesets: [
            { path: 'rules/semgrep-demo.yml', focus: 'OWASP A03 / Dynamic Eval & Subprocess Injection', rulesCount: 2 },
            { path: 'rules/semgrep-security.yml', focus: 'Extended Security Baseline (Hardcoded Credentials & Shell)', rulesCount: 4 },
          ],
          timeoutSeconds: 30,
          maxBufferBytes: 4 * 1024 * 1024,
          isolation: 'POSIX 0600 Temporary Filesystem Scratch',
          environmentPurged: true,
          lastScan: lastScan ? { id: lastScan.id, status: lastScan.status, timestamp: lastScan.at, findingsCount: lastScan.findings?.length || 0 } : null,
        });
      }

      if (req.method === 'GET' && url.pathname === '/api/admin/integrations') {
        const caller = await requireRole(req, res, Roles.ADMIN);
        if (!caller) return;
        return json(res, 200, {
          githubTokenConfigured: Boolean(env.GITHUB_TOKEN),
          githubAppConfigured: Boolean(env.GITHUB_APP_ID && env.GITHUB_PRIVATE_KEY_FILE),
          webhookSecretConfigured: Boolean(webhookSecret),
          commentMode: env.GITHUB_COMMENT_MODE === 'write' ? 'write' : 'disabled',
          ingressEndpoint: '/webhooks/github',
          signatureAlgorithm: 'HMAC-SHA256',
          deliveryDeduplication: 'Atomic FileStore Delivery UUID Index',
          instructions: 'Configure GitHub Webhook with Payload URL http://<host>:4173/webhooks/github, Content-type: application/json, and Secret matching WEBHOOK_SECRET.',
        });
      }

      if (req.method === 'GET' && url.pathname === '/api/admin/audit-logs') {
        const caller = await requireRole(req, res, Roles.ADMIN);
        if (!caller) return;
        const logs = await getAuditLogs();
        return json(res, 200, { logs });
      }

      // ══════════════════════════════════════════════════════════════════════
      // SCAN ENDPOINTS
      // ══════════════════════════════════════════════════════════════════════

      if (req.method === 'GET' && url.pathname === '/api/scans') {
        const user = await optionalAuth(req);
        if (user?.mustChangePassword) {
          return json(res, 403, { error: 'Password change required before accessing application resources', code: 'MUST_CHANGE_PASSWORD', mustChangePassword: true });
        }
        if (!user && !originIsLocal(req)) {
          return json(res, 401, { error: 'Authentication required' });
        }
        const items = await store.all();
        const severity = url.searchParams.get('severity');
        const repository = url.searchParams.get('repository');
        const status = url.searchParams.get('status');
        let filtered = items;
        if (repository) filtered = filtered.filter(i => i.repository?.toLowerCase().includes(repository.toLowerCase()));
        if (status) filtered = filtered.filter(i => i.status === status);
        if (severity) filtered = filtered.filter(i => i.findings?.some(f => f.severity === severity.toUpperCase()));
        return json(res, 200, { items: filtered.slice(0, 100) });
      }

      if (req.method === 'GET' && /^\/api\/scans\/[a-f0-9-]{36}$/.test(url.pathname)) {
        const user = await optionalAuth(req);
        if (user?.mustChangePassword) {
          return json(res, 403, { error: 'Password change required before accessing application resources', code: 'MUST_CHANGE_PASSWORD', mustChangePassword: true });
        }
        if (!user && !originIsLocal(req)) {
          return json(res, 401, { error: 'Authentication required' });
        }
        const id = url.pathname.split('/').pop();
        const items = await store.all();
        const item = items.find(i => i.id === id);
        if (!item) return json(res, 404, { error: 'Scan not found' });
        return json(res, 200, { item });
      }

      // Findings endpoint — flattened across all scans
      if (req.method === 'GET' && url.pathname === '/api/findings') {
        const user = await optionalAuth(req);
        if (user?.mustChangePassword) {
          return json(res, 403, { error: 'Password change required before accessing application resources', code: 'MUST_CHANGE_PASSWORD', mustChangePassword: true });
        }
        if (!user && !originIsLocal(req)) {
          return json(res, 401, { error: 'Authentication required' });
        }
        const items = await store.all();
        const severity = url.searchParams.get('severity');
        const repository = url.searchParams.get('repository');
        const search = url.searchParams.get('q')?.toLowerCase();
        const page = Math.max(1, Number(url.searchParams.get('page') || 1));
        const limit = Math.min(50, Number(url.searchParams.get('limit') || 20));

        let findings = [];
        for (const scan of items) {
          if (scan.status !== 'completed') continue;
          if (repository && !scan.repository?.toLowerCase().includes(repository.toLowerCase())) continue;
          for (const f of (scan.findings || [])) {
            if (severity && f.severity !== severity.toUpperCase()) continue;
            if (search && !f.message?.toLowerCase().includes(search) && !f.rule?.toLowerCase().includes(search) && !f.path?.toLowerCase().includes(search)) continue;
            findings.push({
              ...f,
              scanId: scan.id,
              repository: scan.repository,
              prNumber: scan.prNumber,
              scannedAt: scan.at,
              source: scan.source,
            });
          }
        }
        const total = findings.length;
        const paged = findings.slice((page - 1) * limit, page * limit);
        return json(res, 200, { findings: paged, total, page, limit });
      }

      // Stats / metrics endpoint
      if (req.method === 'GET' && url.pathname === '/api/stats') {
        const user = await optionalAuth(req);
        if (!user && !originIsLocal(req)) {
          return json(res, 401, { error: 'Authentication required' });
        }
        const items = await store.all();
        const completed = items.filter(i => i.status === 'completed');
        const allFindings = completed.flatMap(i => i.findings || []);

        // Compute unique patterns by rule and path
        const uniquePatterns = new Set();
        const uniqueCriticalSet = new Set();
        const uniqueHighSet = new Set();
        for (const f of allFindings) {
          const key = `${f.rule || 'unknown'}@${f.path || 'unknown'}`;
          uniquePatterns.add(key);
          if (f.severity === 'ERROR') uniqueCriticalSet.add(key);
          if (f.severity === 'WARNING') uniqueHighSet.add(key);
        }

        const byRepo = {};
        for (const item of completed) {
          if (!item.repository) continue;
          if (!byRepo[item.repository]) byRepo[item.repository] = { scans: 0, findings: 0 };
          byRepo[item.repository].scans++;
          byRepo[item.repository].findings += (item.findings || []).length;
        }

        return json(res, 200, {
          totalSessions: items.length,
          completedScans: completed.length,
          totalFindings: allFindings.length, // total historical occurrences
          totalOccurrences: allFindings.length,
          historicalOccurrences: allFindings.length,
          uniqueVulnerabilities: uniquePatterns.size,
          criticalFindings: uniqueCriticalSet.size, // navigation badge reads this: displays 1 unique critical pattern!
          uniqueCriticalFindings: uniqueCriticalSet.size,
          uniqueHighFindings: uniqueHighSet.size,
          repositories: Object.entries(byRepo).map(([name, v]) => ({ name, ...v })),
          recentActivity: items.slice(0, 5),
        });
      }

      // ══════════════════════════════════════════════════════════════════════
      // DEMO / SCAN ENDPOINTS
      // ══════════════════════════════════════════════════════════════════════

      if (req.method === 'POST' && url.pathname === '/api/demo/scan') {
        if (!originIsLocal(req) || env.NODE_ENV === 'production') {
          return json(res, 403, { error: 'Demonstration fixture scans are restricted to local development mode' });
        }
        if (!checkRateLimit(scanLimiter, req, res)) return;
        const user = await optionalAuth(req);
        if (user?.mustChangePassword) {
          return json(res, 403, { error: 'Password change required before accessing application resources', code: 'MUST_CHANGE_PASSWORD', mustChangePassword: true });
        }
        let target = url.searchParams.get('target') || 'all';
        if (req.headers['content-type']?.includes('application/json')) {
          try {
            const body = await receiveBody(req);
            if (body && body.length > 0) {
              const parsed = JSON.parse(body.toString('utf8'));
              if (parsed?.target) target = String(parsed.target);
            }
          } catch {}
        }
        if (!['all', 'insecure', 'safe'].includes(target)) {
          target = 'all';
        }
        const result = await scan({ target });
        const item = await store.add({
          source: 'semgrep-fixture',
          repository: 'local/controlled-fixture',
          status: result.status,
          verdict: result.verdict || (result.findings?.length > 0 ? 'vulnerabilities_detected' : result.status === 'completed' ? 'clean' : 'execution_failed'),
          target,
          scannedTarget: result.scannedTarget || (target === 'safe' ? 'fixtures/demo/safe_example.py' : target === 'insecure' ? 'fixtures/demo/insecure_example.py' : 'fixtures/demo'),
          ruleset: result.ruleset || 'rules/semgrep-demo.yml',
          exitCode: result.exitCode ?? (result.status === 'completed' ? 0 : 1),
          findings: result.findings,
          warning: result.warning,
          ...(user ? { triggeredBy: user.id } : {}),
          note: `Real Semgrep execution on bundled controlled files (${target}); not a GitHub PR scan.`,
        });
        return json(res, 200, { item });
      }

      if (req.method === 'POST' && url.pathname === '/api/demo/preview') {
        if (!originIsLocal(req) || env.NODE_ENV === 'production') {
          return json(res, 403, { error: 'Demonstration preview is restricted to local development mode' });
        }
        if (!checkRateLimit(scanLimiter, req, res)) return;
        const user = await optionalAuth(req);
        if (user?.mustChangePassword) {
          return json(res, 403, { error: 'Password change required before accessing application resources', code: 'MUST_CHANGE_PASSWORD', mustChangePassword: true });
        }
        const sample = JSON.parse(await readFile(path.join(ROOT, 'samples/illustrative-scan.json'), 'utf8'));
        const item = await store.add({ ...sample, source: 'illustrative-preview', ...(user ? { triggeredBy: user.id } : {}) });
        return json(res, 200, { item });
      }

      if (req.method === 'POST' && url.pathname === '/api/pr/scan') {
        if (!checkRateLimit(scanLimiter, req, res)) return;
        const user = await optionalAuth(req);
        if (user?.mustChangePassword) {
          return json(res, 403, { error: 'Password change required before accessing application resources', code: 'MUST_CHANGE_PASSWORD', mustChangePassword: true });
        }
        if (!originIsLocal(req) || req.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
          return json(res, 403, { error: 'Local JSON request required' });
        }
        if (!user && req.headers['x-codesentinel-local'] !== '1') {
          return json(res, 401, { error: 'Authentication required' });
        }
        const body = await receiveBody(req);
        let input;
        try { input = JSON.parse(body.toString('utf8')); } catch { return json(res, 400, { error: 'Invalid JSON' }); }
        const currentAllowlist = (await getAllowlist(env.ALLOWED_REPOS)).join(',');
        try { assertRepositoryAllowed(input.repository, currentAllowlist); } catch (e) { return json(res, 403, { error: e.message }); }
        if (!Number.isSafeInteger(input.prNumber) || input.prNumber < 1 || input.prNumber > 9999999) {
          return json(res, 400, { error: 'Invalid PR number' });
        }
        if (!env.GITHUB_TOKEN && !(env.GITHUB_APP_ID && env.GITHUB_PRIVATE_KEY_FILE && input.installationId)) {
          return json(res, 409, { error: 'Configure GITHUB_TOKEN or GitHub App credentials to scan a PR' });
        }
        const { createGitHubClient, configuredGitHubToken } = await import('./github.js');
        try {
          const tok = await configuredGitHubToken({ installationId: input.installationId, env });
          const pr = await createGitHubClient({ token: tok }).pr(input.repository, input.prNumber);
          if (!/^[a-f0-9]{40}$/.test(pr?.head?.sha) || !/^[a-f0-9]{40}$/.test(pr?.base?.sha)) throw new Error('Missing valid PR revision SHAs');
          const scanKey = `${input.repository.toLowerCase()}:${input.prNumber}:${pr.head.sha}`;
          const inserted = await store.addUniqueScan({
            scanKey, source: 'github-pr-scan', repository: input.repository,
            prNumber: input.prNumber, headSha: pr.head.sha, baseSha: pr.base.sha,
            status: 'queued', findings: [], ...(user ? { triggeredBy: user.id } : {}),
            note: 'API metadata authenticated; remote files will be scanned as static text only.',
          });
          if (!inserted.duplicate) worker.enqueue(inserted.item, { installationId: input.installationId });
          return json(res, inserted.duplicate ? 200 : 202, { item: inserted.item, duplicate: inserted.duplicate });
        } catch (e) { return json(res, 502, { error: String(e.message).slice(0, 200) }); }
      }

      // ══════════════════════════════════════════════════════════════════════
      // WEBHOOK (GitHub signed delivery)
      // ══════════════════════════════════════════════════════════════════════

      if (req.method === 'POST' && url.pathname === '/webhooks/github') {
        if (!checkRateLimit(webhookLimiter, req, res)) return;
        if (!webhookSecret) return json(res, 503, { error: 'WEBHOOK_SECRET is not configured' });
        if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
          return json(res, 415, { error: 'Expected application/json' });
        }
        const body = await receiveBody(req);
        if (!verifyGitHubSignature(body, req.headers['x-hub-signature-256'], webhookSecret)) {
          return json(res, 401, { error: 'Invalid webhook signature' });
        }
        const deliveryId = req.headers['x-github-delivery'];
        if (typeof deliveryId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(deliveryId)) {
          return json(res, 400, { error: 'Missing or invalid delivery ID' });
        }
        const metadata = getPRMetadata(req.headers['x-github-event'], body);
        if (!metadata.accepted) {
          return json(res, metadata.reason === 'invalid_json' ? 400 : 202, metadata);
        }
        const currentAllowlist = (await getAllowlist(env.ALLOWED_REPOS)).join(',');
        try { assertRepositoryAllowed(metadata.project, currentAllowlist); } catch { return json(res, 403, { error: 'Repository not allowlisted' }); }
        const result = await store.addUniqueDelivery({
          deliveryId, source: 'github-webhook', status: 'queued',
          repository: metadata.project, prNumber: metadata.prNumber,
          headSha: metadata.headSha, baseSha: metadata.baseSha,
          action: metadata.action, findings: [],
          note: 'Signed webhook accepted. PR inspection is queued; no PR scripts will be executed.',
        });
        if (result.duplicate) return json(res, 200, { received: true, duplicate: true });
        worker.enqueue(result.item, { installationId: metadata.installationId });
        return json(res, 202, { received: true, scanStarted: true, id: result.item.id });
      }

      json(res, 404, { error: 'Not found' });
    } catch (error) {
      if (error.status === 413) return json(res, 413, { error: 'Request too large' });
      console.error('Request failed:', error.message);
      return json(res, 500, { error: 'Internal server error' });
    }
  });
}
