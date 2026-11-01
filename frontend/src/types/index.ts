// CodeSentinel shared TypeScript types

export interface User {
  id: string;
  name: string;
  username?: string;
  email: string;
  role: 'owner' | 'admin' | 'user';
  status?: 'active' | 'disabled';
  mustChangePassword?: boolean;
  bio?: string;
  githubUsername?: string;
  dob?: string;
  avatarFile?: string | null;
  createdAt: string;
  twoFactorEnabled: boolean;
}

export interface Finding {
  id: string;
  rule: string;
  path: string;
  line: number | null;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  // Enriched on findings endpoint
  scanId?: string;
  repository?: string;
  prNumber?: number;
  scannedAt?: string;
  source?: string;
  status?: 'open' | 'acknowledged';
}

export interface ScanRecord {
  id: string;
  at: string;
  source: 'semgrep-fixture' | 'github-pr-scan' | 'github-webhook' | 'illustrative-preview';
  repository: string;
  status: 'queued' | 'fetching' | 'scanning' | 'completed' | 'pipeline_failed' | 'scanner_unavailable' | 'scanner_failed' | 'illustrative_only' | 'unsupported_scope';
  findings: Finding[];
  prNumber?: number;
  headSha?: string;
  baseSha?: string;
  action?: string;
  deliveryId?: string;
  scanKey?: string;
  triggeredBy?: string;
  scannedFiles?: number;
  durationMs?: number;
  finishedAt?: string;
  warning?: string | null;
  note?: string;
  comment?: string;
  verdict?: 'clean' | 'vulnerabilities_detected' | 'execution_failed';
  target?: 'all' | 'insecure' | 'safe';
  scannedTarget?: string;
  ruleset?: string;
  exitCode?: number;
}

export interface Stats {
  totalSessions: number;
  completedScans: number;
  totalFindings: number;
  criticalFindings: number;
  highFindings: number;
  uniqueVulnerabilities?: number;
  uniqueCriticalFindings?: number;
  uniqueHighFindings?: number;
  totalOccurrences?: number;
  historicalOccurrences?: number;
  repositories: { name: string; scans: number; findings: number }[];
  recentActivity: ScanRecord[];
}

export interface HealthStatus {
  status: string;
  mode: string;
  version: string;
  semgrep: boolean;
  githubConfigured: boolean;
  allowlistedRepositories: string[];
  commentMode: 'write' | 'disabled';
  mobile: string;
}

export interface ApiError {
  error: string;
}

export type SeverityLevel = 'ERROR' | 'WARNING' | 'INFO';

export function severityLabel(s: SeverityLevel): string {
  return s === 'ERROR' ? 'Critical' : s === 'WARNING' ? 'High' : 'Low';
}

export function severityColor(s: SeverityLevel): string {
  return s === 'ERROR' ? 'critical' : s === 'WARNING' ? 'high' : 'low';
}
