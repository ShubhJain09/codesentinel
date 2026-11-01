import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  ProjectIcon,
  IndexesIcon,
  CheckIcon,
} from '../components/ui/AgndexIcons';
import {
  Users,
  Shield,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  Check,
  Minus,
  ArrowRight,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { admin } from '../lib/api';
import { formatDate } from '../lib/utils';

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMatrixModal, setShowMatrixModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: admin.users,
  });

  const { mutate: updateRole } = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      admin.updateUser(userId, { role }),
    onSuccess: (res) => {
      setMessage({ text: `Updated ${res.user.name}'s role to ${res.user.role}.` });
      setTimeout(() => setMessage(null), 4000);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setUpdatingId(null);
    },
    onError: (err: any) => {
      setMessage({ text: err.message || 'Failed to update role.', error: true });
      setUpdatingId(null);
    },
  });

  const isOwner = currentUser?.role === 'owner';
  const isAdmin = currentUser?.role === 'admin' || isOwner;
  const users = data?.users || [];

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 p-4 md:gap-11 md:p-8">
      {/* ── 1. PAGE HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Team &amp; Roles</h1>
        <p className="text-zinc-400">
          Manage project members and role permissions
        </p>
      </div>

      {/* ── 2. METADATA CHIPS ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center md:gap-2">
        <div className="agndex-meta-chip font-medium text-white">
          <ProjectIcon className="size-4 text-zinc-400" />
          CodeSentinel Workspace
        </div>
        <button
          type="button"
          onClick={() => {
            searchInputRef.current?.focus();
            searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          className="agndex-meta-chip hover:bg-[#262930] hover:text-white transition-colors cursor-pointer text-left group"
          title="Click to search & inspect members"
        >
          <Users className="size-4 text-zinc-400 group-hover:text-[#D946EF] transition-colors" />
          <span>{users.length} {users.length === 1 ? 'Member' : 'Members'}</span>
        </button>
        <button
          type="button"
          onClick={() => setShowMatrixModal(true)}
          className="agndex-meta-chip hover:bg-[#262930] hover:text-white transition-colors cursor-pointer text-left group"
          title="Inspect Role Permissions Matrix"
        >
          <IndexesIcon className="size-4 text-zinc-400 group-hover:text-[#D946EF] transition-colors" />
          <span>{isOwner ? 'Owner Access' : isAdmin ? 'Admin Access' : 'Member Access'}</span>
        </button>
      </div>

      {/* ── 3. HORIZONTAL DIVIDER ──────────────────────────────────────────── */}
      <div className="border-t border-white/10" />

      {message && (
        <div
          className={`rounded-xl border p-3.5 text-xs flex items-center gap-2 ${
            message.error
              ? 'bg-red-500/10 border-red-500/20 text-red-400'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          }`}
        >
          <CheckIcon className="size-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {/* ── 4. MEMBERS LIST ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 md:gap-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="font-semibold text-white text-base tracking-tight">Project Members</h2>
            <span className="text-xs text-zinc-400 font-normal">
              ({filteredUsers.length} of {users.length} active)
            </span>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="size-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter members..."
              className="agndex-input h-9 pl-10 text-xs"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {isLoading ? (
            <div className="rounded-xl border border-white/5 bg-[#202227] p-8 text-center text-sm text-zinc-400">
              Loading team directory...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-[#202227] p-8 text-center text-sm text-zinc-400">
              No project members match &quot;{searchQuery}&quot;.
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="ml-2 text-[#D946EF] underline hover:text-[#e879f9]"
              >
                Clear filter
              </button>
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isSelf = u.id === currentUser?.id;
              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[#202227] px-3.5 py-3 transition-colors hover:bg-[#262930] md:pr-4 border border-white/5"
                >
                  <div className="flex items-center gap-3 overflow-hidden md:gap-4">
                    <div className="size-10 rounded-full bg-gradient-to-tr from-[#D946EF] to-[#818CF8] flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {u.name?.[0] || 'O'}
                    </div>

                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium tracking-tight text-white">
                          {u.name}
                        </span>
                        {isSelf && (
                          <span className="rounded bg-white/10 px-1.5 py-0.2 text-[10px] text-zinc-300">
                            You
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-zinc-400">
                        {u.email} • Joined {formatDate(u.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isOwner && !isSelf ? (
                      <select
                        value={u.role}
                        disabled={updatingId === u.id}
                        onChange={(e) => {
                          setUpdatingId(u.id);
                          updateRole({ userId: u.id, role: e.target.value });
                        }}
                        className="rounded-lg border border-white/10 bg-[#18191D] px-2.5 py-1 text-xs text-zinc-200 focus:outline-none"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                        <option value="owner">Owner</option>
                      </select>
                    ) : (
                      <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium text-zinc-300 capitalize">
                        {u.role}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── 5. ROLE DEFINITIONS ────────────────────────────────────────────── */}
      <div className="border-t border-white/10" />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-white">Role Hierarchy</h2>
          <button
            type="button"
            onClick={() => setShowMatrixModal(true)}
            className="text-xs text-[#D946EF] hover:underline flex items-center gap-1"
          >
            <span>View Full Permissions Matrix</span>
            <ArrowRight className="size-3.5" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/5 bg-[#202227] p-4 flex flex-col gap-1">
            <span className="text-xs font-semibold text-white">Owner</span>
            <p className="text-xs text-zinc-400">Full system access, role administration, security secret rotation.</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#202227] p-4 flex flex-col gap-1">
            <span className="text-xs font-semibold text-white">Admin</span>
            <p className="text-xs text-zinc-400">Execute scans, acknowledge vulnerability risks, configure targets.</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#202227] p-4 flex flex-col gap-1">
            <span className="text-xs font-semibold text-white">User</span>
            <p className="text-xs text-zinc-400">Read-only view of scans, vulnerabilities, and telemetry.</p>
          </div>
        </div>
      </div>

      {/* ── 6. ROLE PERMISSIONS MATRIX MODAL ───────────────────────────────── */}
      {showMatrixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#18191D] p-6 shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-[#D946EF]/10 border border-[#D946EF]/20 flex items-center justify-center text-[#D946EF]">
                  <ShieldCheck className="size-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Role Permissions Matrix</h3>
                  <p className="text-xs text-zinc-400">Granular access control policies and governance</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMatrixModal(false)}
                className="size-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Current User Badge */}
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#202227] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="size-7 rounded-full bg-gradient-to-tr from-[#D946EF] to-[#818CF8] flex items-center justify-center text-xs font-bold text-white">
                  {currentUser?.name?.[0] || 'U'}
                </div>
                <div>
                  <span className="text-xs text-zinc-400">Your Current Session</span>
                  <p className="text-sm font-semibold text-white">{currentUser?.name} ({currentUser?.email})</p>
                </div>
              </div>
              <span className="rounded-full bg-[#D946EF]/15 border border-[#D946EF]/30 px-3 py-1 text-xs font-semibold text-[#D946EF] capitalize">
                {currentUser?.role === 'owner' ? 'System Owner' : currentUser?.role === 'admin' ? 'Administrator' : 'Standard User'}
              </span>
            </div>

            {/* Permissions Matrix Table */}
            <div className="rounded-xl border border-white/10 bg-[#202227] overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 bg-[#18191E] text-zinc-400">
                    <th className="py-2.5 px-3 font-medium">Capability / Action</th>
                    <th className="py-2.5 px-2 text-center font-medium">User</th>
                    <th className="py-2.5 px-2 text-center font-medium">Admin</th>
                    <th className="py-2.5 px-2 text-center font-medium">Owner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-300">
                  <tr>
                    <td className="py-2 px-3">View Scans, Vulnerabilities &amp; Pipeline</td>
                    <td className="py-2 px-2 text-center text-emerald-400"><Check className="size-3.5 mx-auto" /></td>
                    <td className="py-2 px-2 text-center text-emerald-400"><Check className="size-3.5 mx-auto" /></td>
                    <td className="py-2 px-2 text-center text-emerald-400"><Check className="size-3.5 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Trigger AST Security Scans</td>
                    <td className="py-2 px-2 text-center text-zinc-500"><Minus className="size-3.5 mx-auto" /></td>
                    <td className="py-2 px-2 text-center text-emerald-400"><Check className="size-3.5 mx-auto" /></td>
                    <td className="py-2 px-2 text-center text-emerald-400"><Check className="size-3.5 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Acknowledge Finding Risks</td>
                    <td className="py-2 px-2 text-center text-zinc-500"><Minus className="size-3.5 mx-auto" /></td>
                    <td className="py-2 px-2 text-center text-emerald-400"><Check className="size-3.5 mx-auto" /></td>
                    <td className="py-2 px-2 text-center text-emerald-400"><Check className="size-3.5 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Manage Repository Allowlist</td>
                    <td className="py-2 px-2 text-center text-zinc-500"><Minus className="size-3.5 mx-auto" /></td>
                    <td className="py-2 px-2 text-center text-emerald-400"><Check className="size-3.5 mx-auto" /></td>
                    <td className="py-2 px-2 text-center text-emerald-400"><Check className="size-3.5 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">View Immutable Audit Governance Logs</td>
                    <td className="py-2 px-2 text-center text-zinc-500"><Minus className="size-3.5 mx-auto" /></td>
                    <td className="py-2 px-2 text-center text-emerald-400"><Check className="size-3.5 mx-auto" /></td>
                    <td className="py-2 px-2 text-center text-emerald-400"><Check className="size-3.5 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-medium text-white">Promote / Demote User Roles</td>
                    <td className="py-2 px-2 text-center text-zinc-500"><Minus className="size-3.5 mx-auto" /></td>
                    <td className="py-2 px-2 text-center text-zinc-500"><Minus className="size-3.5 mx-auto" /></td>
                    <td className="py-2 px-2 text-center text-emerald-400"><Check className="size-3.5 mx-auto" /></td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-medium text-white">Demote or Remove Last Owner</td>
                    <td className="py-2 px-2 text-center text-red-400"><X className="size-3.5 mx-auto" /></td>
                    <td className="py-2 px-2 text-center text-red-400"><X className="size-3.5 mx-auto" /></td>
                    <td className="py-2 px-2 text-center text-red-400"><X className="size-3.5 mx-auto" /></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Last-Owner Protection Alert */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-start gap-2.5">
              <Lock className="size-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <span className="font-semibold text-amber-200">System Invariant:</span> CodeSentinel guarantees system availability by prohibiting the demotion or deletion of the last registered System Owner.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-white/10">
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowMatrixModal(false);
                    navigate('/app/admin/control-center');
                  }}
                  className="agndex-btn-primary text-xs h-8 px-3.5 gap-1.5"
                >
                  <ShieldCheck className="size-3.5" />
                  <span>Open Admin Control Center</span>
                </button>
              ) : (
                <span className="text-xs text-zinc-500">Contact System Owner for elevated privileges</span>
              )}

              <button
                type="button"
                onClick={() => setShowMatrixModal(false)}
                className="rounded-lg border border-white/10 px-3.5 py-1.5 text-xs text-zinc-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
