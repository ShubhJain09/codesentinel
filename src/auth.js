import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
export function getUsersFile() {
  return process.env.CODESENTINEL_USERS_FILE || path.join(ROOT, 'data', 'users.json');
}
export function getSessionsFile() {
  return process.env.CODESENTINEL_SESSIONS_FILE || path.join(ROOT, 'data', 'sessions.json');
}

// Secure random 32-byte hex string
function generateToken() {
  return randomBytes(32).toString('hex');
}

// Generate human-friendly strong temporary password (16 chars, mixed case, numbers, symbol)
export function generateTemporaryPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const all = upper + lower + digits + symbols;
  const bytes = randomBytes(16);
  let pwd = [
    upper[bytes[0] % upper.length],
    lower[bytes[1] % lower.length],
    digits[bytes[2] % digits.length],
    symbols[bytes[3] % symbols.length],
  ];
  for (let i = 4; i < 16; i++) {
    pwd.push(all[bytes[i] % all.length]);
  }
  // Shuffle array
  return pwd.sort(() => (randomBytes(1)[0] > 127 ? 1 : -1)).join('');
}

// bcrypt-equivalent: PBKDF2-SHA256 with 200k iterations
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await pbkdf2(password, salt, 200000, 32);
  return `pbkdf2:sha256:200000:${salt}:${key}`;
}

async function pbkdf2(password, salt, iterations, keylen) {
  const { subtle } = globalThis.crypto;
  const enc = new TextEncoder();
  const keyMaterial = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations },
    keyMaterial, keylen * 8
  );
  return Buffer.from(bits).toString('hex');
}

export async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split(':');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') return false;
  const [, , iters, salt, hash] = parts;
  const computed = await pbkdf2(password, salt, Number(iters), 32);
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

// Simple in-process write queue for atomic file writes
function makeQueue() {
  let q = Promise.resolve();
  return fn => {
    const next = q.then(fn);
    q = next.then(() => {}, () => {});
    return next;
  };
}

const usersQueue = makeQueue();
const sessionsQueue = makeQueue();

async function readJSON(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
}

async function writeJSON(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomBytes(8).toString('hex')}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  await rename(tmp, file);
}

// ── User management & invariants ─────────────────────────────────────────────
export const Roles = { OWNER: 'owner', ADMIN: 'admin', USER: 'user' };

export const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'owner', 'root', 'system', 'codesentinel',
  'security', 'support', 'api', 'bot', 'null', 'undefined', 'anonymous',
  'guest', 'operator', 'lead', 'manager', 'audit', 'scanner',
]);

export function validateUsername(username) {
  if (typeof username !== 'string') return false;
  const trimmed = username.trim();
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(trimmed)) return false;
  if (RESERVED_USERNAMES.has(trimmed.toLowerCase())) return false;
  return true;
}

export async function getAllUsers() {
  const users = await readJSON(getUsersFile(), []);
  return users.map(u => ({
    status: 'active',
    mustChangePassword: false,
    bio: '',
    githubUsername: '',
    dob: '',
    avatarFile: null,
    username: u.username || (u.email ? u.email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase() : 'user'),
    ...u,
  }));
}

export async function findUserByEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const users = await getAllUsers();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function findUserByUsername(username) {
  if (!username || typeof username !== 'string') return null;
  const term = username.trim().toLowerCase();
  const users = await getAllUsers();
  return users.find(u => (u.username && u.username.toLowerCase() === term)) ?? null;
}

export async function findUserByLogin(login) {
  if (!login || typeof login !== 'string') return null;
  let term = login.trim().toLowerCase();
  if (term.startsWith('@')) {
    term = term.slice(1).trim();
  }
  const users = await getAllUsers();
  if (term.includes('@')) {
    return users.find(u => u.email.toLowerCase() === term) ?? null;
  }
  return users.find(u => (u.username && u.username.toLowerCase() === term) || u.email.toLowerCase() === term) ?? null;
}

export async function isUsernameTaken(username, excludeUserId = null) {
  if (!username || typeof username !== 'string') return false;
  const term = username.trim().toLowerCase();
  const users = await getAllUsers();
  return users.some(u => u.username && u.username.toLowerCase() === term && u.id !== excludeUserId);
}

export async function findUserById(id) {
  const users = await getAllUsers();
  return users.find(u => u.id === id) ?? null;
}

export async function isSetupRequired() {
  const users = await getAllUsers();
  return users.length === 0;
}

export async function createUser({ name, username, email, password, role, mustChangePassword = false }) {
  return usersQueue(async () => {
    const rawUsers = await readJSON(getUsersFile(), []);
    const normalizedEmail = email.toLowerCase().trim();
    if (rawUsers.some(u => u.email.toLowerCase() === normalizedEmail)) {
      throw Object.assign(new Error('Email already registered'), { status: 409 });
    }

    let finalUsername = (username || '').trim().toLowerCase();
    if (finalUsername) {
      if (!validateUsername(finalUsername)) {
        throw Object.assign(new Error('Invalid username. Must be 3-32 alphanumeric characters, dots, underscores or dashes, and not reserved.'), { status: 400 });
      }
      if (rawUsers.some(u => (u.username || '').toLowerCase() === finalUsername)) {
        throw Object.assign(new Error('Username already taken'), { status: 409 });
      }
    } else {
      let base = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase() || 'user';
      if (RESERVED_USERNAMES.has(base)) base = `${base}.user`;
      finalUsername = base;
      let counter = 1;
      while (rawUsers.some(u => (u.username || '').toLowerCase() === finalUsername)) {
        finalUsername = `${base}${counter++}`;
      }
    }

    const assignedRole = role || (rawUsers.length === 0 ? Roles.OWNER : Roles.USER);
    const id = generateToken().slice(0, 16);
    const user = {
      id,
      name: name.trim(),
      username: finalUsername,
      email: normalizedEmail,
      role: assignedRole,
      status: 'active',
      mustChangePassword: Boolean(mustChangePassword),
      bio: '',
      githubUsername: '',
      dob: '',
      avatarFile: null,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
      twoFactorEnabled: false,
    };
    rawUsers.push(user);
    await writeJSON(getUsersFile(), rawUsers);
    const { passwordHash: _, ...safe } = user;
    return safe;
  });
}

export async function updateUser(id, patch) {
  return usersQueue(async () => {
    const users = await readJSON(getUsersFile(), []);
    const idx = users.findIndex(u => u.id === id);
    if (idx < 0) throw Object.assign(new Error('User not found'), { status: 404 });

    if (patch.username) {
      const u = patch.username.trim().toLowerCase();
      if (!validateUsername(u)) {
        throw Object.assign(new Error('Invalid username. Must be 3-32 alphanumeric characters, dots, underscores or dashes, and not reserved.'), { status: 400 });
      }
      if (users.some((existing, i) => i !== idx && (existing.username || '').toLowerCase() === u)) {
        throw Object.assign(new Error('Username already taken'), { status: 409 });
      }
      patch.username = u;
    }

    if (patch.password) {
      patch = { ...patch, passwordHash: await hashPassword(patch.password) };
      delete patch.password;
    }

    // Prevent removing or demoting the last System Owner
    if (patch.role && patch.role !== Roles.OWNER && users[idx].role === Roles.OWNER) {
      const ownerCount = users.filter(u => u.role === Roles.OWNER).length;
      if (ownerCount <= 1) {
        throw Object.assign(new Error('Cannot demote or remove the last System Owner'), { status: 400 });
      }
    }

    users[idx] = {
      status: 'active',
      mustChangePassword: false,
      bio: '',
      githubUsername: '',
      dob: '',
      avatarFile: null,
      username: users[idx].username || users[idx].email.split('@')[0],
      ...users[idx],
      ...patch,
      id,
    };
    await writeJSON(getUsersFile(), users);
    const { passwordHash: _, ...safe } = users[idx];
    return safe;
  });
}

export async function disableUser(id) {
  return usersQueue(async () => {
    const users = await readJSON(getUsersFile(), []);
    const idx = users.findIndex(u => u.id === id);
    if (idx < 0) throw Object.assign(new Error('User not found'), { status: 404 });
    if (users[idx].role === Roles.OWNER) {
      const activeOwners = users.filter(u => u.role === Roles.OWNER && u.status !== 'disabled');
      if (activeOwners.length <= 1) {
        throw Object.assign(new Error('Cannot disable the last active System Owner'), { status: 400 });
      }
    }
    users[idx].status = 'disabled';
    await writeJSON(getUsersFile(), users);
    await revokeAllUserSessions(id);
    const { passwordHash: _, ...safe } = users[idx];
    return safe;
  });
}

export async function enableUser(id) {
  return usersQueue(async () => {
    const users = await readJSON(getUsersFile(), []);
    const idx = users.findIndex(u => u.id === id);
    if (idx < 0) throw Object.assign(new Error('User not found'), { status: 404 });
    users[idx].status = 'active';
    await writeJSON(getUsersFile(), users);
    const { passwordHash: _, ...safe } = users[idx];
    return safe;
  });
}

export async function adminResetPassword(id, newPassword, mustChangePassword = true) {
  return usersQueue(async () => {
    const users = await readJSON(getUsersFile(), []);
    const idx = users.findIndex(u => u.id === id);
    if (idx < 0) throw Object.assign(new Error('User not found'), { status: 404 });
    users[idx].passwordHash = await hashPassword(newPassword);
    users[idx].mustChangePassword = Boolean(mustChangePassword);
    await writeJSON(getUsersFile(), users);
    await revokeAllUserSessions(id);
    const { passwordHash: _, ...safe } = users[idx];
    return safe;
  });
}

export async function deleteUser(id) {
  return usersQueue(async () => {
    const users = await readJSON(getUsersFile(), []);
    const idx = users.findIndex(u => u.id === id);
    if (idx < 0) throw Object.assign(new Error('User not found'), { status: 404 });
    if (users[idx].role === Roles.OWNER) {
      const ownerCount = users.filter(u => u.role === Roles.OWNER).length;
      if (ownerCount <= 1) {
        throw Object.assign(new Error('Cannot delete the last System Owner'), { status: 400 });
      }
    }
    users.splice(idx, 1);
    await writeJSON(getUsersFile(), users);
    await revokeAllUserSessions(id);
    return true;
  });
}

export async function authenticateUser(login, password) {
  const user = await findUserByLogin(login);
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  if (user.status === 'disabled') {
    const err = new Error('This account has been disabled. Please contact your system administrator.');
    err.status = 403;
    throw err;
  }
  const { passwordHash: _, ...safe } = user;
  return safe;
}

// ── Session management ────────────────────────────────────────────────────────
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function createSession(userId) {
  return sessionsQueue(async () => {
    const sessions = await readJSON(getSessionsFile(), []);
    const token = generateToken();
    const session = {
      token,
      userId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    };
    const fresh = sessions.filter(s => new Date(s.expiresAt) > new Date());
    fresh.push(session);
    await writeJSON(getSessionsFile(), fresh.slice(-1000));
    return token;
  });
}

export async function getSessionUser(token) {
  if (typeof token !== 'string' || token.length !== 64) return null;
  const sessions = await readJSON(getSessionsFile(), []);
  const session = sessions.find(s => s.token === token);
  if (!session || new Date(session.expiresAt) <= new Date()) return null;
  const user = await findUserById(session.userId);
  if (!user || user.status === 'disabled') return null;
  return user;
}

export async function deleteSession(token) {
  return sessionsQueue(async () => {
    const sessions = await readJSON(getSessionsFile(), []);
    await writeJSON(getSessionsFile(), sessions.filter(s => s.token !== token));
  });
}

export async function revokeAllUserSessions(userId) {
  return sessionsQueue(async () => {
    const sessions = await readJSON(getSessionsFile(), []);
    await writeJSON(getSessionsFile(), sessions.filter(s => s.userId !== userId));
  });
}

export async function revokeOtherSessions(userId, currentToken) {
  return sessionsQueue(async () => {
    const sessions = await readJSON(getSessionsFile(), []);
    await writeJSON(getSessionsFile(), sessions.filter(s => s.userId !== userId || s.token === currentToken));
  });
}

// ── First-run owner provisioning ──────────────────────────────────────────────
export async function ensureDefaultOwner() {
  const users = await getAllUsers();
  if (users.length > 0) return;
  const email = process.env.INITIAL_OWNER_EMAIL || process.env.OWNER_EMAIL;
  const password = process.env.INITIAL_OWNER_PASSWORD || process.env.OWNER_PASSWORD;
  if (email && password) {
    await createUser({ name: 'System Owner', email, password, role: Roles.OWNER });
    console.log(`[Security] Initial owner provisioned from environment: ${email}`);
  } else {
    console.log('[Security] First-run setup required: First registered account will receive the Owner role.');
  }
}
