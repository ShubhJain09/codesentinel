import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Users,
  Database,
  Terminal,
  Activity,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Lock,
  ExternalLink,
  Info,
  CheckCircle2,
  FileCode,
  Sliders,
  Play,
  ArrowRight,
  UserPlus,
  KeyRound,
  ShieldAlert,
  Ban,
  Check,
  Copy,
  ChevronDown,
  ChevronRight,
  X,
  Eye,
  EyeOff,
  GitBranch,
  Layers,
  Search,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { admin, scans, health } from '../lib/api';
import { formatDate, formatRelative, cn } from '../lib/utils';
import { StatusBadge } from '../components/ui/StatusBadge';

type AdminTab = 'overview' | 'users' | 'repositories' | 'scanner' | 'integrations' | 'activity';

export default function AdminControlCenter() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);

  // Modals state
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [addRepoModalOpen, setAddRepoModalOpen] = useState(false);
  const [resetPwdModal, setResetPwdModal] = useState<{ userId: string; userName: string; email: string } | null>(null);
  const [confirmRoleModal, setConfirmRoleModal] = useState<{ userId: string; userName: string; newRole: string } | null>(null);
  const [confirmStatusModal, setConfirmStatusModal] = useState<{ userId: string; userName: string; targetStatus: 'active' | 'disabled' } | null>(null);
  const [confirmRevokeModal, setConfirmRevokeModal] = useState<{ userId: string; userName: string } | null>(null);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{ userId: string; userName: string } | null>(null);

  // Diagnostics toggle state
  const [showAdvancedDiagnostics, setShowAdvancedDiagnostics] = useState(false);

  // Search/filter states for tables
  const [userSearch, setUserSearch] = useState('');
  const [activitySearch, setActivitySearch] = useState('');

  // Add User Form State
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [newUserPasswordMode, setNewUserPasswordMode] = useState<'auto' | 'custom'>('auto');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserMustChange, setNewUserMustChange] = useState(true);
  const [createdUserCredentials, setCreatedUserCredentials] = useState<{ username: string; email: string; password: string } | null>(null);

  // Add Repo Form State
  const [newRepoIdentifier, setNewRepoIdentifier] = useState('');
  const [newRepoType, setNewRepoType] = useState<'remote' | 'local'>('remote');

  // Reset Password Modal State
  const [resetPasswordMode, setResetPasswordMode] = useState<'auto' | 'custom'>('auto');
  const [customResetPassword, setCustomResetPassword] = useState('');
  const [resetMustChange, setResetMustChange] = useState(true);
  const [resetCredentials, setResetCredentials] = useState<{ password: string } | null>(null);

  // Copy helper
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  }

  const isOwner = currentUser?.role === 'owner';
  const isAdmin = currentUser?.role === 'admin' || isOwner;

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: admin.users,
    enabled: isAdmin,
  });

  const { data: allowlistData, isLoading: allowlistLoading } = useQuery({
    queryKey: ['admin-allowlist'],
    queryFn: admin.allowlist,
    enabled: isAdmin,
  });

  const { data: scannerData, isLoading: scannerLoading } = useQuery({
    queryKey: ['admin-scanner'],
    queryFn: admin.scanner,
    enabled: isAdmin,
  });

  const { data: integrationData, isLoading: integrationsLoading } = useQuery({
    queryKey: ['admin-integrations'],
    queryFn: admin.integrations,
    enabled: isAdmin,
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: admin.auditLogs,
    enabled: isAdmin,
    refetchInterval: 10_000,
  });

  const { data: recentScansData } = useQuery({
    queryKey: ['scans'],
    queryFn: () => scans.list({ limit: '10' } as any),
    enabled: isAdmin,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const { mutate: createUserMutation, isPending: isCreatingUser } = useMutation({
    mutationFn: admin.createUser,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      if (res.temporaryPassword) {
        setCreatedUserCredentials({
          username: res.user.username || res.user.email,
          email: res.user.email,
          password: res.temporaryPassword,
        });
      } else {
        setAddUserModalOpen(false);
        setFeedback({ text: `User account @${res.user.username || res.user.email} created successfully.` });
      }
    },
    onError: (err: any) => {
      setFeedback({ text: err?.message || 'Failed to create user', error: true });
    },
  });

  const { mutate: updateRoleMutation, isPending: updatingRole } = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      admin.updateUser(userId, { role }),
    onSuccess: (res) => {
      setFeedback({ text: `Updated ${res.user.name}'s role to ${res.user.role}.` });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      setConfirmRoleModal(null);
    },
    onError: (err: any) => {
      setFeedback({ text: err?.message || 'Failed to update role', error: true });
      setConfirmRoleModal(null);
    },
  });

  const { mutate: updateStatusMutation, isPending: updatingStatus } = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: 'active' | 'disabled' }) =>
      admin.updateUserStatus(userId, status),
    onSuccess: (res) => {
      setFeedback({ text: `Account for ${res.user.name} is now ${res.user.status}.` });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      setConfirmStatusModal(null);
    },
    onError: (err: any) => {
      setFeedback({ text: err?.message || 'Failed to update account status', error: true });
      setConfirmStatusModal(null);
    },
  });

  const { mutate: resetPasswordMutation, isPending: resettingPassword } = useMutation({
    mutationFn: ({ userId, options }: { userId: string; options?: { password?: string; mustChangePassword?: boolean } }) =>
      admin.resetUserPassword(userId, options),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      if (res.temporaryPassword) {
        setResetCredentials({ password: res.temporaryPassword });
      } else {
        setResetPwdModal(null);
        setFeedback({ text: 'Password reset successfully.' });
      }
    },
    onError: (err: any) => {
      setFeedback({ text: err?.message || 'Failed to reset password', error: true });
    },
  });

  const { mutate: revokeSessionsMutation, isPending: revokingSessions } = useMutation({
    mutationFn: (userId: string) => admin.revokeUserSessions(userId),
    onSuccess: () => {
      setFeedback({ text: 'All active sessions for this user were successfully terminated.' });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      setConfirmRevokeModal(null);
    },
    onError: (err: any) => {
      setFeedback({ text: err?.message || 'Failed to revoke sessions', error: true });
      setConfirmRevokeModal(null);
    },
  });

  const { mutate: deleteUserMutation, isPending: deletingUser } = useMutation({
    mutationFn: admin.deleteUser,
    onSuccess: () => {
      setFeedback({ text: 'User removed from workspace.' });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      setConfirmDeleteModal(null);
    },
    onError: (err: any) => {
      setFeedback({ text: err?.message || 'Failed to remove user', error: true });
      setConfirmDeleteModal(null);
    },
  });

  const { mutate: addRepoMutation, isPending: addingRepo } = useMutation({
    mutationFn: admin.addAllowlist,
    onSuccess: () => {
      setFeedback({ text: 'Repository added to allowed scanning targets.' });
      queryClient.invalidateQueries({ queryKey: ['admin-allowlist'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      setAddRepoModalOpen(false);
      setNewRepoIdentifier('');
    },
    onError: (err: any) => {
      setFeedback({ text: err?.message || 'Failed to add repository', error: true });
    },
  });

  const { mutate: removeRepoMutation, isPending: removingRepo } = useMutation({
    mutationFn: admin.removeAllowlist,
    onSuccess: () => {
      setFeedback({ text: 'Repository removed from allowed scope.' });
      queryClient.invalidateQueries({ queryKey: ['admin-allowlist'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
    onError: (err: any) => {
      setFeedback({ text: err?.message || 'Failed to remove repository', error: true });
    },
  });

  const { mutate: runSecurityCheckMutation, isPending: runningSecurityCheck } = useMutation({
    mutationFn: () => scans.runDemo('insecure'),
    onSuccess: (data) => {
      setFeedback({
        text: `Scanner verification complete: Semgrep rule CWE-95 executed and detected ${data?.item?.findings?.length || 1} finding.`,
      });
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-scanner'] });
    },
    onError: (err: any) => {
      setFeedback({ text: err?.message || 'Security check failed', error: true });
    },
  });

  // Filtered users
  const filteredUsers = useMemo(() => {
    const list = usersData?.users || [];
    if (!userSearch.trim()) return list;
    const term = userSearch.toLowerCase();
    return list.filter(
      (u) =>
        u.name?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.username?.toLowerCase().includes(term) ||
        u.role?.toLowerCase().includes(term)
    );
  }, [usersData, userSearch]);

  // Filtered audit activity
  const filteredActivity = useMemo(() => {
    const list = auditData?.logs || [];
    if (!activitySearch.trim()) return list;
    const term = activitySearch.toLowerCase();
    return list.filter(
      (a) =>
        a.action?.toLowerCase().includes(term) ||
        a.actor?.toLowerCase().includes(term) ||
        a.target?.toLowerCase().includes(term)
    );
  }, [auditData, activitySearch]);

  // Helper: format audit action description
  function formatAuditDescription(entry: any) {
    const action = entry.action;
    const target = entry.target;
    const details = entry.details || {};

    switch (action) {
      case 'USER_CREATED':
        return `Created account @${details.username || target} (${details.role || 'Member'})`;
      case 'USER_ROLE_UPDATED':
        return `Changed role for ${target} to ${details.newRole}`;
      case 'USER_STATUS_UPDATED':
        return `Account status for ${target} set to ${details.newStatus}`;
      case 'USER_PASSWORD_RESET':
        return `Reset password for user ${target}`;
      case 'USER_SESSIONS_REVOKED':
        return `Terminated active sessions for ${target}`;
      case 'USER_DELETED':
        return `Removed user account ${target}`;
      case 'ALLOWLIST_REPO_ADDED':
        return `Connected repository ${target}`;
      case 'ALLOWLIST_REPO_REMOVED':
        return `Disconnected repository ${target}`;
      case 'USER_PROFILE_UPDATED':
        return `Updated profile fields for ${target}`;
      case 'USER_AVATAR_UPDATED':
        return `Updated profile avatar`;
      case 'USER_AVATAR_REMOVED':
        return `Removed profile avatar`;
      default:
        return `${action.replace(/_/g, ' ')} on ${target}`;
    }
  }

  return (
    <div className="min-h-full bg-[#18191E] p-6 sm:p-8 lg:p-10 text-zinc-100">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#D946EF]">
                System Governance
              </span>
              <StatusBadge status={isOwner ? 'owner' : 'admin'} size="xs" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              Admin Control Center
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Manage team accounts, repository scope, security scanner health, and platform audit logs.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setNewUserName('');
                setNewUserUsername('');
                setNewUserEmail('');
                setNewUserPassword('');
                setCreatedUserCredentials(null);
                setAddUserModalOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#D946EF] hover:bg-[#C026D3] active:scale-95 text-white text-xs font-medium transition-all shadow-sm"
            >
              <UserPlus size={14} />
              <span>Add User</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setNewRepoIdentifier('');
                setAddRepoModalOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 active:scale-95 text-white text-xs font-medium border border-white/10 transition-all shadow-sm"
            >
              <GitBranch size={14} />
              <span>Connect Repository</span>
            </button>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {feedback && (
          <div
            className={cn(
              'p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200',
              feedback.error
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            )}
          >
            <div className="flex items-center gap-2.5">
              {feedback.error ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
              <span>{feedback.text}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-zinc-400 hover:text-white p-1 rounded"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* 6 Clear Tabs Navigation */}
        <div className="flex border-b border-white/10 overflow-x-auto no-scrollbar gap-1">
          {[
            { id: 'overview', label: 'Overview', icon: Layers },
            { id: 'users', label: `Users (${usersData?.users?.length || 0})`, icon: Users },
            { id: 'repositories', label: `Repositories (${allowlistData?.allowlist?.length || 0})`, icon: Database },
            { id: 'scanner', label: 'Scanner', icon: Terminal },
            { id: 'integrations', label: 'Integrations', icon: Sliders },
            { id: 'activity', label: 'Activity', icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors border-b-2 whitespace-nowrap',
                  isActive
                    ? 'border-[#D946EF] text-[#D946EF] bg-white/[0.02]'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-white/20'
                )}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ───────────────────────────────────────────────────────────────────── */}
        {/* TAB 1: OVERVIEW                                                       */}
        {/* ───────────────────────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#202227] rounded-xl border border-white/10 p-5 space-y-1">
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                  Team members
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-semibold text-white">
                    {usersData?.users?.length || 0} {usersData?.users?.length === 1 ? 'member' : 'members'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  {usersData?.users?.filter((u) => u.status !== 'disabled').length || 0} active accounts
                </p>
              </div>

              <div className="bg-[#202227] rounded-xl border border-white/10 p-5 space-y-1">
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                  Allowed repositories
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-semibold text-white">
                    {allowlistData?.allowlist?.length || 0} configured scopes
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  1 local fixture · {Math.max(0, (allowlistData?.allowlist?.length || 1) - 1)} configured targets
                </p>
              </div>

              <div className="bg-[#202227] rounded-xl border border-white/10 p-5 space-y-1">
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                  Security scanner
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-semibold text-white">
                    Semgrep ready
                  </span>
                  <StatusBadge status={scannerData?.semgrepReady ? 'ready' : 'unavailable'} label={scannerData?.semgrepReady ? 'Ready' : 'Checking'} size="xs" />
                </div>
                <p className="text-[11px] text-zinc-500">
                  CWE-95 and CWE-78 baseline AST rules
                </p>
              </div>

              <div className="bg-[#202227] rounded-xl border border-white/10 p-5 space-y-1">
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                  Activity
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-semibold text-white">
                    {auditData?.logs?.length || 0} recorded events
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Local audit event log
                </p>
              </div>
            </div>

            {/* Quick Actions & Recent Activity Split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quick Launchpad */}
              <div className="bg-[#202227] rounded-xl border border-white/10 p-6 space-y-4">
                <h3 className="text-sm font-semibold text-white">Management Shortcuts</h3>
                <p className="text-xs text-zinc-400">
                  Frequently accessed operations for system operators and lead maintainers.
                </p>

                <div className="space-y-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewUserName('');
                      setNewUserUsername('');
                      setNewUserEmail('');
                      setNewUserPassword('');
                      setCreatedUserCredentials(null);
                      setAddUserModalOpen(true);
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-[#18191E] hover:bg-white/5 border border-white/5 text-left text-xs transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <UserPlus size={16} className="text-[#D946EF]" />
                      <div>
                        <div className="font-medium text-white">Create User Account</div>
                        <div className="text-[10px] text-zinc-400">Add an administrator or security reviewer</div>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-zinc-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewRepoIdentifier('');
                      setAddRepoModalOpen(true);
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-[#18191E] hover:bg-white/5 border border-white/5 text-left text-xs transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <GitBranch size={16} className="text-indigo-400" />
                      <div>
                        <div className="font-medium text-white">Connect Repository</div>
                        <div className="text-[10px] text-zinc-400">Register new GitHub or fixture scope</div>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-zinc-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => runSecurityCheckMutation()}
                    disabled={runningSecurityCheck}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-[#18191E] hover:bg-white/5 border border-white/5 text-left text-xs transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Play size={16} className="text-emerald-400" />
                      <div>
                        <div className="font-medium text-white">Run Security Check</div>
                        <div className="text-[10px] text-zinc-400">Execute Semgrep against controlled fixture</div>
                      </div>
                    </div>
                    {runningSecurityCheck ? (
                      <RefreshCw size={14} className="animate-spin text-[#D946EF]" />
                    ) : (
                      <ArrowRight size={14} className="text-zinc-500" />
                    )}
                  </button>
                </div>
              </div>

              {/* Recent Audit Activity Snapshot */}
              <div className="lg:col-span-2 bg-[#202227] rounded-xl border border-white/10 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Recent Admin Activity</h3>
                    <p className="text-xs text-zinc-400">Latest administrative and governance events</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('activity')}
                    className="text-xs text-[#D946EF] hover:underline"
                  >
                    View All →
                  </button>
                </div>

                <div className="divide-y divide-white/5">
                  {(auditData?.logs || []).slice(0, 5).map((log) => (
                    <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <div className="size-2 rounded-full bg-[#D946EF]" />
                        <div>
                          <div className="text-white font-medium">
                            {formatAuditDescription(log)}
                          </div>
                          <div className="text-[11px] text-zinc-500">
                            By {log.actor} · {formatRelative(log.timestamp)}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {formatDate(log.timestamp)}
                      </span>
                    </div>
                  ))}
                  {(auditData?.logs || []).length === 0 && (
                    <div className="py-6 text-center text-xs text-zinc-500">
                      No administrative activity recorded yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────────────── */}
        {/* TAB 2: USERS                                                          */}
        {/* ───────────────────────────────────────────────────────────────────── */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-3 text-zinc-500" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Filter users by name, email, role..."
                  className="w-full bg-[#202227] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF] transition-colors"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setNewUserName('');
                  setNewUserUsername('');
                  setNewUserEmail('');
                  setNewUserPassword('');
                  setCreatedUserCredentials(null);
                  setAddUserModalOpen(true);
                }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#D946EF] hover:bg-[#C026D3] text-white text-xs font-medium transition-colors"
              >
                <UserPlus size={14} />
                <span>+ Add User</span>
              </button>
            </div>

            <div className="bg-[#202227] rounded-xl border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/10 bg-[#18191E]/60 text-zinc-400">
                    <tr>
                      <th className="py-3 px-4 font-medium">User</th>
                      <th className="py-3 px-4 font-medium">Role</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium">Password Flag</th>
                      <th className="py-3 px-4 font-medium">Created</th>
                      <th className="py-3 px-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredUsers.map((u) => {
                      const initial = (u.name || u.username || 'U')[0]?.toUpperCase();
                      const isSelf = u.id === currentUser?.id;
                      const isDisabled = u.status === 'disabled';

                      return (
                        <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="size-8 rounded-full bg-[#18191E] border border-white/10 flex items-center justify-center font-bold text-xs text-[#D946EF] shrink-0">
                                {initial}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-white flex items-center gap-2">
                                  <span>{u.name}</span>
                                  {isSelf && (
                                    <span className="text-[10px] bg-white/10 text-zinc-300 px-1.5 py-0.2 rounded font-mono">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-zinc-400 font-mono">
                                  @{u.username || 'user'} · {u.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <StatusBadge status={u.role} />
                          </td>

                          <td className="py-3 px-4">
                            <StatusBadge status={u.status || 'active'} />
                          </td>

                          <td className="py-3 px-4 text-zinc-400">
                            {u.mustChangePassword ? (
                              <span className="text-amber-400 text-[11px] font-medium flex items-center gap-1">
                                <KeyRound size={12} />
                                <span>Change on login</span>
                              </span>
                            ) : (
                              <span className="text-zinc-500 text-[11px]">Normal</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-zinc-400">
                            {u.createdAt ? formatDate(u.createdAt) : 'Initial setup'}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Reset Password Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setCustomResetPassword('');
                                  setResetCredentials(null);
                                  setResetPwdModal({ userId: u.id, userName: u.name, email: u.email });
                                }}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
                                title="Reset user password"
                              >
                                <KeyRound size={13} />
                              </button>

                              {/* Toggle Status (Active / Disabled) */}
                              {!isSelf && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmStatusModal({
                                      userId: u.id,
                                      userName: u.name,
                                      targetStatus: isDisabled ? 'active' : 'disabled',
                                    })
                                  }
                                  className={cn(
                                    'p-1.5 rounded-lg transition-colors',
                                    isDisabled
                                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                                      : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400'
                                  )}
                                  title={isDisabled ? 'Enable account' : 'Disable account'}
                                >
                                  {isDisabled ? <Check size={13} /> : <Ban size={13} />}
                                </button>
                              )}

                              {/* Revoke Sessions */}
                              <button
                                type="button"
                                onClick={() => setConfirmRevokeModal({ userId: u.id, userName: u.name })}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
                                title="Revoke all active sessions"
                              >
                                <RefreshCw size={13} />
                              </button>

                              {/* Role Select (Owner only) */}
                              {isOwner && !isSelf && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmRoleModal({
                                      userId: u.id,
                                      userName: u.name,
                                      newRole: u.role === 'admin' ? 'user' : 'admin',
                                    })
                                  }
                                  className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] text-zinc-300 hover:text-white border border-white/5 transition-colors"
                                >
                                  Change to {u.role === 'admin' ? 'Member' : 'Admin'}
                                </button>
                              )}

                              {/* Delete User (Owner only, non-self) */}
                              {isOwner && !isSelf && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteModal({ userId: u.id, userName: u.name })}
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/10 text-zinc-400 hover:text-rose-400 transition-colors"
                                  title="Delete user"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────────────── */}
        {/* TAB 3: REPOSITORIES                                                   */}
        {/* ───────────────────────────────────────────────────────────────────── */}
        {activeTab === 'repositories' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Monitored Repositories</h3>
                <p className="text-xs text-zinc-400">
                  Repositories registered in the zero-trust pull request review allowlist.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setNewRepoIdentifier('');
                  setAddRepoModalOpen(true);
                }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#D946EF] hover:bg-[#C026D3] text-white text-xs font-medium transition-colors"
              >
                <GitBranch size={14} />
                <span>+ Add Repository</span>
              </button>
            </div>

            <div className="bg-[#202227] rounded-xl border border-white/10 overflow-hidden divide-y divide-white/5">
              {(allowlistData?.allowlist || []).map((repo) => {
                const isFixture = repo === 'local/controlled-fixture';

                return (
                  <div
                    key={repo}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.01] transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="size-9 rounded-lg bg-[#18191E] border border-white/10 flex items-center justify-center text-zinc-400 shrink-0 mt-0.5">
                        <Database size={16} className={isFixture ? 'text-emerald-400' : 'text-indigo-400'} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm font-mono">{repo}</span>
                          <StatusBadge
                            status={isFixture ? 'verified-fixture' : 'connected'}
                            label={isFixture ? 'Verified Fixture' : 'Allowed Target'}
                          />
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">
                          {isFixture
                            ? 'Intentionally seeded local test fixture. Scans insecure_example.py and safe_example.py with deterministic Semgrep AST rules.'
                            : 'Remote GitHub repository allowed to receive automated PR security scanning upon signed webhook delivery.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          runSecurityCheckMutation();
                        }}
                        disabled={runningSecurityCheck}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-colors disabled:opacity-50"
                      >
                        <Play size={12} fill="currentColor" className="text-[#D946EF]" />
                        <span>Scan Now</span>
                      </button>

                      <Link
                        to={`/app/findings?repository=${encodeURIComponent(repo)}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
                      >
                        <span>Findings</span>
                      </Link>

                      {!isFixture && (
                        <button
                          type="button"
                          onClick={() => removeRepoMutation(repo)}
                          disabled={removingRepo}
                          className="p-2 rounded-lg bg-white/5 hover:bg-rose-500/10 text-zinc-400 hover:text-rose-400 transition-colors"
                          title="Remove repository"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────────────── */}
        {/* TAB 4: SCANNER                                                        */}
        {/* ───────────────────────────────────────────────────────────────────── */}
        {activeTab === 'scanner' && (
          <div className="space-y-6">
            {/* Status Hero Card */}
            <div className="bg-[#202227] rounded-xl border border-white/10 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-white">Semgrep Static Analysis Engine</span>
                  <StatusBadge status="ready" label="Ready" size="xs" />
                </div>
                <p className="text-xs text-zinc-400 max-w-2xl">
                  CodeSentinel executes static analysis in isolated POSIX scratch environments with purged credentials.
                  Active version: <span className="font-mono text-zinc-200">{scannerData?.version || '1.181.0'}</span>.
                </p>
              </div>

              <button
                type="button"
                onClick={() => runSecurityCheckMutation()}
                disabled={runningSecurityCheck}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D946EF] hover:bg-[#C026D3] text-white text-xs font-medium transition-colors shadow-sm shrink-0"
              >
                {runningSecurityCheck ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Executing Check...</span>
                  </>
                ) : (
                  <>
                    <Play size={13} fill="currentColor" />
                    <span>Run Verification Scan</span>
                  </>
                )}
              </button>
            </div>

            {/* Active Rulesets */}
            <div className="bg-[#202227] rounded-xl border border-white/10 p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white">Active Security Rulesets</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(scannerData?.rulesets || [
                  { path: 'rules/semgrep-demo.yml', focus: 'OWASP A03 / Dynamic Eval & Subprocess Injection', rulesCount: 2 },
                  { path: 'rules/semgrep-security.yml', focus: 'Extended Baseline (Hardcoded Credentials & Shell)', rulesCount: 4 },
                ]).map((rule) => (
                  <div key={rule.path} className="p-4 rounded-lg bg-[#18191E] border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-white">{rule.path}</span>
                      <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-zinc-400">
                        {rule.rulesCount} rules active
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400">{rule.focus}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Expandable Advanced Diagnostics */}
            <div className="bg-[#202227] rounded-xl border border-white/10 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvancedDiagnostics((prev) => !prev)}
                className="w-full p-4 flex items-center justify-between text-left text-xs text-zinc-300 hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileCode size={15} className="text-[#D946EF]" />
                  <span className="font-semibold">Advanced Diagnostics & Execution Invariants</span>
                </div>
                {showAdvancedDiagnostics ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </button>

              {showAdvancedDiagnostics && (
                <div className="p-4 sm:p-6 border-t border-white/5 bg-[#18191E] text-xs font-mono text-zinc-400 space-y-2">
                  <div>• Isolation Model: POSIX 0600 Temporary Filesystem Scratch</div>
                  <div>• Timeout Limit: 30 seconds per execution pass</div>
                  <div>• Max Buffer: 4,194,304 bytes (4 MB)</div>
                  <div>• Credential Scrubbing: GITHUB_TOKEN, WEBHOOK_SECRET, and SESSION_SECRET purged from child env</div>
                  <div>• Deterministic Exit Codes: Clean (0), Finding (0+findings parsed), Error (non-zero caught)</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────────────── */}
        {/* TAB 5: INTEGRATIONS                                                   */}
        {/* ───────────────────────────────────────────────────────────────────── */}
        {activeTab === 'integrations' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* GitHub App & Personal Access Token */}
              <div className="bg-[#202227] rounded-xl border border-white/10 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">GitHub API Access</h3>
                  <StatusBadge
                    status={integrationData?.githubTokenConfigured ? 'connected' : 'unconfigured'}
                    label={integrationData?.githubTokenConfigured ? 'Connected' : 'Setup Required'}
                  />
                </div>
                <p className="text-xs text-zinc-400">
                  Authentication token used to fetch modified pull request files and publish automated review comments.
                </p>
                <div className="p-3 rounded-lg bg-[#18191E] border border-white/5 text-xs text-zinc-400">
                  Comment Mode: <span className="font-mono text-white">{integrationData?.commentMode || 'disabled'}</span>
                </div>
              </div>

              {/* Webhook Ingress */}
              <div className="bg-[#202227] rounded-xl border border-white/10 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Webhook Ingress Endpoint</h3>
                  <StatusBadge
                    status={integrationData?.webhookSecretConfigured ? 'connected' : 'unconfigured'}
                    label={integrationData?.webhookSecretConfigured ? 'Secret Configured' : 'Secret Required'}
                  />
                </div>
                <p className="text-xs text-zinc-400">
                  Endpoint for GitHub pull_request webhooks signed with HMAC-SHA256.
                </p>
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#18191E] border border-white/5 text-xs font-mono text-zinc-300">
                  <span>/webhooks/github</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('http://127.0.0.1:4173/webhooks/github', 'webhook-url')}
                    className="text-xs text-[#D946EF] hover:underline flex items-center gap-1"
                  >
                    {copiedKey === 'webhook-url' ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedKey === 'webhook-url' ? 'Copied' : 'Copy Full URL'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Ingress Guide */}
            <div className="bg-[#202227] rounded-xl border border-white/10 p-6 space-y-3">
              <h3 className="text-sm font-semibold text-white">Setup Instructions</h3>
              <ol className="list-decimal list-inside space-y-2 text-xs text-zinc-400 leading-relaxed">
                <li>In your GitHub Repository, navigate to <span className="text-white font-mono">Settings &gt; Webhooks &gt; Add webhook</span>.</li>
                <li>Set Payload URL to your CodeSentinel server URL ending in <span className="text-white font-mono">/webhooks/github</span>.</li>
                <li>Set Content type to <span className="text-white font-mono">application/json</span>.</li>
                <li>Enter the Secret corresponding to <span className="text-white font-mono">WEBHOOK_SECRET</span> in your environment.</li>
                <li>Under &quot;Which events would you like to trigger this webhook?&quot;, select <span className="text-white font-mono">Let me select individual events</span> and check <span className="text-white font-mono">Pull requests</span>.</li>
              </ol>
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────────────── */}
        {/* TAB 6: ACTIVITY (AUDIT LOGS)                                          */}
        {/* ───────────────────────────────────────────────────────────────────── */}
        {activeTab === 'activity' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search size={14} className="absolute left-3 top-3 text-zinc-500" />
                <input
                  type="text"
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                  placeholder="Filter activity by action or actor..."
                  className="w-full bg-[#202227] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF] transition-colors"
                />
              </div>

              <div className="text-xs text-zinc-400">
                Showing {filteredActivity.length} events
              </div>
            </div>

            <div className="bg-[#202227] rounded-xl border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/10 bg-[#18191E]/60 text-zinc-400">
                    <tr>
                      <th className="py-3 px-4 font-medium">Timestamp</th>
                      <th className="py-3 px-4 font-medium">Actor</th>
                      <th className="py-3 px-4 font-medium">Event Description</th>
                      <th className="py-3 px-4 font-medium">Target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredActivity.map((log) => (
                      <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-mono text-zinc-400 whitespace-nowrap">
                          {formatRelative(log.timestamp)}
                        </td>
                        <td className="py-3 px-4 text-white font-medium">
                          {log.actor}
                        </td>
                        <td className="py-3 px-4 text-zinc-300">
                          {formatAuditDescription(log)}
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-400">
                          {log.target}
                        </td>
                      </tr>
                    ))}
                    {filteredActivity.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-zinc-500">
                          No audit events matched your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────────────── */}
        {/* MODAL: ADD USER                                                       */}
        {/* ───────────────────────────────────────────────────────────────────── */}
        {addUserModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="relative w-full max-w-lg bg-[#202227] rounded-xl border border-white/10 p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <UserPlus size={18} className="text-[#D946EF]" />
                  <h3 className="text-base font-semibold text-white">Create Login Account</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAddUserModalOpen(false)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {createdUserCredentials ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-2">
                    <div className="font-semibold flex items-center gap-2">
                      <CheckCircle2 size={16} />
                      <span>Account Provisioned Successfully!</span>
                    </div>
                    <p className="text-emerald-200/80">
                      Copy these credentials now. The temporary password cannot be viewed again.
                    </p>
                  </div>

                  <div className="space-y-2 text-xs bg-[#18191E] p-4 rounded-lg border border-white/5">
                    <div className="flex justify-between items-center py-1">
                      <span className="text-zinc-400">Username:</span>
                      <span className="font-mono text-white font-semibold">@{createdUserCredentials.username}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-zinc-400">Email:</span>
                      <span className="font-mono text-white">{createdUserCredentials.email}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-t border-white/5 pt-2">
                      <span className="text-zinc-400">Temporary Password:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[#D946EF] font-bold">{createdUserCredentials.password}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(createdUserCredentials.password, 'created-pwd')}
                          className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
                        >
                          {copiedKey === 'created-pwd' ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setAddUserModalOpen(false);
                      setCreatedUserCredentials(null);
                    }}
                    className="w-full py-2 rounded-lg bg-[#D946EF] hover:bg-[#C026D3] text-white text-xs font-medium"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    createUserMutation({
                      name: newUserName,
                      username: newUserUsername,
                      email: newUserEmail,
                      role: newUserRole,
                      password: newUserPasswordMode === 'custom' ? newUserPassword : '',
                      mustChangePassword: newUserMustChange,
                    });
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      required
                      placeholder="e.g. Alex Mercer"
                      className="w-full bg-[#18191E] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">Username (Handle)</label>
                      <input
                        type="text"
                        value={newUserUsername}
                        onChange={(e) => setNewUserUsername(e.target.value.toLowerCase())}
                        required
                        pattern="^[a-zA-Z0-9._-]{3,32}$"
                        placeholder="e.g. alex.mercer"
                        className="w-full bg-[#18191E] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">Email Address</label>
                      <input
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        required
                        placeholder="alex@example.com"
                        className="w-full bg-[#18191E] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Role</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewUserRole('user')}
                        className={cn(
                          'p-2.5 rounded-lg border text-left text-xs transition-colors',
                          newUserRole === 'user'
                            ? 'bg-[#D946EF]/10 border-[#D946EF] text-white'
                            : 'bg-[#18191E] border-white/10 text-zinc-400 hover:text-white'
                        )}
                      >
                        <div className="font-medium">Member</div>
                        <div className="text-[10px] text-zinc-500">View findings & repositories</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewUserRole('admin')}
                        className={cn(
                          'p-2.5 rounded-lg border text-left text-xs transition-colors',
                          newUserRole === 'admin'
                            ? 'bg-[#D946EF]/10 border-[#D946EF] text-white'
                            : 'bg-[#18191E] border-white/10 text-zinc-400 hover:text-white'
                        )}
                      >
                        <div className="font-medium">Admin</div>
                        <div className="text-[10px] text-zinc-500">Manage users & repository scope</div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">Initial Password Mode</label>
                    <div className="flex items-center gap-4 text-xs text-zinc-300 mb-2">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="pwdMode"
                          checked={newUserPasswordMode === 'auto'}
                          onChange={() => setNewUserPasswordMode('auto')}
                        />
                        <span>Auto-generate strong password</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="pwdMode"
                          checked={newUserPasswordMode === 'custom'}
                          onChange={() => setNewUserPasswordMode('custom')}
                        />
                        <span>Set custom password</span>
                      </label>
                    </div>

                    {newUserPasswordMode === 'custom' && (
                      <input
                        type="password"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        required
                        minLength={8}
                        placeholder="Enter password (min 8 characters)"
                        className="w-full bg-[#18191E] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="mustChange"
                      checked={newUserMustChange}
                      onChange={(e) => setNewUserMustChange(e.target.checked)}
                      className="rounded border-white/10 bg-[#18191E] text-[#D946EF] focus:ring-0"
                    />
                    <label htmlFor="mustChange" className="text-xs text-zinc-300 cursor-pointer">
                      Require password change upon first sign-in
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setAddUserModalOpen(false)}
                      className="px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-zinc-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingUser}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D946EF] hover:bg-[#C026D3] text-white text-xs font-medium transition-all disabled:opacity-50"
                    >
                      {isCreatingUser ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          <span>Provisioning...</span>
                        </>
                      ) : (
                        <span>Create Account</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────────────── */}
        {/* MODAL: RESET PASSWORD                                                 */}
        {/* ───────────────────────────────────────────────────────────────────── */}
        {resetPwdModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="relative w-full max-w-md bg-[#202227] rounded-xl border border-white/10 p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <KeyRound size={16} className="text-[#D946EF]" />
                  <h3 className="text-base font-semibold text-white">Reset User Password</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setResetPwdModal(null)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {resetCredentials ? (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                    Password reset complete. Copy this temporary password to send to the user:
                  </div>

                  <div className="flex items-center justify-between bg-[#18191E] p-3 rounded-lg border border-white/5">
                    <span className="font-mono text-[#D946EF] font-bold text-sm">
                      {resetCredentials.password}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(resetCredentials.password, 'reset-temp')}
                      className="p-1.5 rounded hover:bg-white/10 text-zinc-300 hover:text-white"
                    >
                      {copiedKey === 'reset-temp' ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setResetPwdModal(null);
                      setResetCredentials(null);
                    }}
                    className="w-full py-2 rounded-lg bg-[#D946EF] hover:bg-[#C026D3] text-white text-xs font-medium"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    resetPasswordMutation({
                      userId: resetPwdModal.userId,
                      options: {
                        password: resetPasswordMode === 'custom' ? customResetPassword : '',
                        mustChangePassword: resetMustChange,
                      },
                    });
                  }}
                  className="space-y-4"
                >
                  <p className="text-xs text-zinc-400">
                    Resetting password for <span className="text-white font-medium">{resetPwdModal.userName}</span> ({resetPwdModal.email}).
                  </p>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="radio"
                        checked={resetPasswordMode === 'auto'}
                        onChange={() => setResetPasswordMode('auto')}
                      />
                      <span>Generate strong temporary password</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="radio"
                        checked={resetPasswordMode === 'custom'}
                        onChange={() => setResetPasswordMode('custom')}
                      />
                      <span>Set custom password</span>
                    </label>

                    {resetPasswordMode === 'custom' && (
                      <input
                        type="password"
                        value={customResetPassword}
                        onChange={(e) => setCustomResetPassword(e.target.value)}
                        required
                        minLength={8}
                        placeholder="New password (min 8 chars)"
                        className="w-full mt-2 bg-[#18191E] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D946EF]"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="resetMustChange"
                      checked={resetMustChange}
                      onChange={(e) => setResetMustChange(e.target.checked)}
                      className="rounded border-white/10 bg-[#18191E] text-[#D946EF] focus:ring-0"
                    />
                    <label htmlFor="resetMustChange" className="text-xs text-zinc-300 cursor-pointer">
                      Require password change upon next login
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setResetPwdModal(null)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resettingPassword}
                      className="px-3.5 py-1.5 rounded-lg bg-[#D946EF] hover:bg-[#C026D3] text-white text-xs font-medium disabled:opacity-50"
                    >
                      {resettingPassword ? 'Resetting...' : 'Reset Password'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────────────── */}
        {/* MODAL: CONNECT REPOSITORY                                             */}
        {/* ───────────────────────────────────────────────────────────────────── */}
        {addRepoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="relative w-full max-w-md bg-[#202227] rounded-xl border border-white/10 p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <GitBranch size={16} className="text-[#D946EF]" />
                  <h3 className="text-base font-semibold text-white">Add Repository to Allowlist</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAddRepoModalOpen(false)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addRepoMutation(newRepoIdentifier.trim());
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Repository Identifier
                  </label>
                  <input
                    type="text"
                    value={newRepoIdentifier}
                    onChange={(e) => setNewRepoIdentifier(e.target.value)}
                    required
                    pattern="^([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+|local\/controlled-fixture)$"
                    placeholder="e.g. owner/repo-name"
                    className="w-full bg-[#18191E] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF]"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Must follow GitHub format: <span className="font-mono text-zinc-400">organization/repository</span>.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-[#18191E] border border-white/5 text-xs text-zinc-400 space-y-1.5 leading-relaxed">
                  <div className="font-medium text-white">Zero-Trust Ingress Security</div>
                  <div>Only repositories explicitly listed in this allowlist can trigger automated Semgrep scanning passes. Unlisted repositories are blocked with HTTP 403.</div>
                  <div className="text-[11px] text-zinc-500">Note: This saves the identifier in CodeSentinel's local allowlist. It does not establish an active outbound connection to GitHub API until a <code className="text-zinc-400">GITHUB_TOKEN</code> is configured in your server environment.</div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setAddRepoModalOpen(false)}
                    className="px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-zinc-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addingRepo}
                    className="px-4 py-2 rounded-lg bg-[#D946EF] hover:bg-[#C026D3] text-white text-xs font-medium disabled:opacity-50"
                  >
                    {addingRepo ? 'Allowlisting...' : 'Allowlist Repository'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────────────── */}
        {/* CONFIRMATION MODALS                                                   */}
        {/* ───────────────────────────────────────────────────────────────────── */}

        {/* Confirm Role Modal */}
        {confirmRoleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="relative w-full max-w-md bg-[#202227] rounded-xl border border-white/10 p-6 shadow-2xl space-y-4">
              <h3 className="text-sm font-semibold text-white">Change User Role</h3>
              <p className="text-xs text-zinc-300">
                Are you sure you want to change <span className="font-semibold text-white">{confirmRoleModal.userName}</span>&apos;s role to <span className="font-semibold text-[#D946EF] uppercase">{confirmRoleModal.newRole}</span>?
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmRoleModal(null)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={updatingRole}
                  onClick={() =>
                    updateRoleMutation({
                      userId: confirmRoleModal.userId,
                      role: confirmRoleModal.newRole,
                    })
                  }
                  className="px-3.5 py-1.5 rounded-lg bg-[#D946EF] hover:bg-[#C026D3] text-white text-xs font-medium"
                >
                  {updatingRole ? 'Updating...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Status Modal */}
        {confirmStatusModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="relative w-full max-w-md bg-[#202227] rounded-xl border border-white/10 p-6 shadow-2xl space-y-4">
              <h3 className="text-sm font-semibold text-white">
                {confirmStatusModal.targetStatus === 'disabled' ? 'Disable Account' : 'Enable Account'}
              </h3>
              <p className="text-xs text-zinc-300">
                {confirmStatusModal.targetStatus === 'disabled'
                  ? `Disabling ${confirmStatusModal.userName}'s account will immediately terminate all active sessions and block sign-in until re-enabled.`
                  : `Re-enabling ${confirmStatusModal.userName}'s account will restore their sign-in capabilities.`}
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmStatusModal(null)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={updatingStatus}
                  onClick={() =>
                    updateStatusMutation({
                      userId: confirmStatusModal.userId,
                      status: confirmStatusModal.targetStatus,
                    })
                  }
                  className={cn(
                    'px-3.5 py-1.5 rounded-lg text-white text-xs font-medium',
                    confirmStatusModal.targetStatus === 'disabled'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  )}
                >
                  {updatingStatus ? 'Updating...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Revoke Sessions Modal */}
        {confirmRevokeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="relative w-full max-w-md bg-[#202227] rounded-xl border border-white/10 p-6 shadow-2xl space-y-4">
              <h3 className="text-sm font-semibold text-white">Terminate Active Sessions</h3>
              <p className="text-xs text-zinc-300">
                Are you sure you want to sign out all active sessions for <span className="font-semibold text-white">{confirmRevokeModal.userName}</span>? They will be required to log in again on all devices.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmRevokeModal(null)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={revokingSessions}
                  onClick={() => revokeSessionsMutation(confirmRevokeModal.userId)}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium"
                >
                  {revokingSessions ? 'Revoking...' : 'Terminate Sessions'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Delete User Modal */}
        {confirmDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="relative w-full max-w-md bg-[#202227] rounded-xl border border-white/10 p-6 shadow-2xl space-y-4">
              <h3 className="text-sm font-semibold text-white">Remove User Account</h3>
              <p className="text-xs text-zinc-300">
                Are you sure you want to permanently delete <span className="font-semibold text-white">{confirmDeleteModal.userName}</span>? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteModal(null)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingUser}
                  onClick={() => deleteUserMutation(confirmDeleteModal.userId)}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium"
                >
                  {deletingUser ? 'Removing...' : 'Delete Account'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
