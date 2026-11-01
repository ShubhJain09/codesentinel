// API client for CodeSentinel backend
// All tokens are stored in memory only — never in localStorage or cookies set by JS.
// The httpOnly cookie set by the server is used for browser sessions automatically.

import type { User, HealthStatus, Stats, ScanRecord, Finding } from '../types';

const BASE = '/api';

export class ApiError extends Error {
  status: number;
  data?: any;
  field?: string;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
    this.field = data?.field;
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include', // Send httpOnly session cookie
    headers: {
      'content-type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));

  if (!res.ok) {
    throw new ApiError(data.error || `HTTP ${res.status}`, res.status, data);
  }
  return data as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  me: () => request<{ user: User }>('/auth/me'),

  login: (login: string, password: string) =>
    request<{ user: User; token: string; mustChangePassword?: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    }),

  register: (name: string, email: string, password: string) =>
    request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),

  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  updateProfile: (patch: {
    name?: string;
    username?: string;
    bio?: string;
    githubUsername?: string;
    dob?: string;
    currentPassword?: string;
    newPassword?: string;
    password?: string;
  }) =>
    request<{ user: User }>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  uploadAvatar: async (file: File) => {
    const res = await fetch(`${BASE}/auth/avatar`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': file.type || 'application/octet-stream',
      },
      body: file,
    });
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    if (!res.ok) {
      throw new ApiError(data.error || `HTTP ${res.status}`, res.status);
    }
    return data as { user: User; avatarUrl: string };
  },

  removeAvatar: () =>
    request<{ user: User }>('/auth/avatar', {
      method: 'DELETE',
    }),

  revokeOtherSessions: () =>
    request<{ success: boolean }>('/auth/revoke-other-sessions', {
      method: 'POST',
    }),
};

// ── Health ─────────────────────────────────────────────────────────────────────
export const health = {
  get: () => request<HealthStatus>('/health'),
};

// ── Stats ──────────────────────────────────────────────────────────────────────
export const stats = {
  get: () => request<Stats>('/stats'),
};

// ── Scans ──────────────────────────────────────────────────────────────────────
export const scans = {
  list: (params?: { repository?: string; status?: string; severity?: string }) => {
    const q = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v) as [string, string][]);
    return request<{ items: ScanRecord[] }>(`/scans${q.size ? `?${q}` : ''}`);
  },

  get: (id: string) => request<{ item: ScanRecord }>(`/scans/${id}`),

  runDemo: (target?: 'all' | 'insecure' | 'safe') =>
    request<{ item: ScanRecord }>(`/demo/scan${target ? `?target=${target}` : ''}`, { method: 'POST' }),

  runPreview: () => request<{ item: ScanRecord }>('/demo/preview', { method: 'POST' }),

  scanPR: (repository: string, prNumber: number) =>
    request<{ item: ScanRecord; duplicate: boolean }>('/pr/scan', {
      method: 'POST',
      headers: { 'x-codesentinel-local': '1' },
      body: JSON.stringify({ repository, prNumber }),
    }),
};

// ── Findings ───────────────────────────────────────────────────────────────────
export const findings = {
  list: (params?: {
    severity?: string;
    repository?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams(
      Object.entries(params || {})
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)])
    );
    return request<{
      findings: Finding[];
      total: number;
      page: number;
      limit: number;
    }>(`/findings${q.size ? `?${q}` : ''}`);
  },
};

// ── Admin ──────────────────────────────────────────────────────────────────────
export const admin = {
  users: () => request<{ users: User[] }>('/admin/users'),
  createUser: (data: {
    name: string;
    username?: string;
    email: string;
    password?: string;
    role?: string;
    mustChangePassword?: boolean;
  }) =>
    request<{ user: User; temporaryPassword?: string }>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateUser: (id: string, patch: { role?: string }) =>
    request<{ user: User }>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  updateUserStatus: (id: string, status: 'active' | 'disabled') =>
    request<{ user: User }>(`/admin/users/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  resetUserPassword: (id: string, options?: { password?: string; mustChangePassword?: boolean }) =>
    request<{ success: boolean; temporaryPassword?: string }>(`/admin/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    }),
  revokeUserSessions: (id: string) =>
    request<{ success: boolean }>(`/admin/users/${id}/revoke-sessions`, {
      method: 'POST',
    }),
  deleteUser: (id: string) =>
    request<{ success: boolean }>(`/admin/users/${id}`, {
      method: 'DELETE',
    }),
  allowlist: () =>
    request<{ allowlist: string[]; mode: string; policy: string }>('/admin/allowlist'),
  addAllowlist: (repository: string) =>
    request<{ allowlist: string[]; success: boolean }>('/admin/allowlist', {
      method: 'POST',
      body: JSON.stringify({ repository }),
    }),
  removeAllowlist: (repository: string) =>
    request<{ allowlist: string[]; success: boolean }>(`/admin/allowlist/${encodeURIComponent(repository)}`, {
      method: 'DELETE',
    }),
  scanner: () =>
    request<{
      status: string;
      semgrepReady: boolean;
      version: string;
      rulesets: Array<{ path: string; focus: string; rulesCount: number }>;
      timeoutSeconds: number;
      maxBufferBytes: number;
      isolation: string;
      environmentPurged: boolean;
      lastScan: any;
    }>('/admin/scanner'),
  integrations: () =>
    request<{
      githubTokenConfigured: boolean;
      githubAppConfigured: boolean;
      webhookSecretConfigured: boolean;
      commentMode: string;
      ingressEndpoint: string;
      signatureAlgorithm: string;
      deliveryDeduplication: string;
      instructions: string;
    }>('/admin/integrations'),
  auditLogs: () =>
    request<{
      logs: Array<{
        id: string;
        timestamp: string;
        action: string;
        actor: string;
        target: string;
        details: any;
      }>;
    }>('/admin/audit-logs'),
};
