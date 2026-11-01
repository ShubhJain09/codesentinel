import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CodeSentinelLogo,
  HomeIcon,
  ShieldAlertIcon,
  HistoryIcon,
  RepositoriesIcon,
  PipelineIcon,
  KeyIcon,
  DocsIcon,
  SettingsIcon,
  LogoutIcon,
  ProjectIcon,
  CaretDownIcon,
  MonitorIcon,
  CheckIcon,
} from './ui/AgndexIcons';
import {
  Menu,
  X,
  Users,
  Search,
  ChevronsUpDown,
  BadgeCheck,
  Shield,
  ShieldCheck,
  UserPlus,
  User as UserIcon,
  Play,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { scans, stats, health, auth } from '../lib/api';
import { CommandSearch } from './ui/CommandSearch';
import { StatusBadge } from './ui/StatusBadge';

export default function AppLayout() {
  const { user, logout, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<'CodeSentinel Core' | 'local/controlled-fixture'>('CodeSentinel Core');
  const [quickScanNotification, setQuickScanNotification] = useState<string | null>(null);

  // Mandatory password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const handleMandatoryPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    setUpdatingPassword(true);
    try {
      await auth.updateProfile({ currentPassword, newPassword });
      await refresh();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setQuickScanNotification('Password established. Welcome to CodeSentinel.');
    } catch (err: any) {
      setPasswordError(err?.message || 'Failed to update password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const dropdownRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);

  // Close popovers on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (projectRef.current && !projectRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Poll system stats & health
  const { data: statsData } = useQuery({
    queryKey: ['stats'],
    queryFn: stats.get,
    refetchInterval: 10_000,
  });

  const { data: healthData } = useQuery({
    queryKey: ['health'],
    queryFn: health.get,
    refetchInterval: 15_000,
  });

  // Fast scan trigger
  const { mutate: runQuickScan, isPending: isScanning } = useMutation({
    mutationFn: scans.runDemo,
    onSuccess: (data) => {
      setQuickScanNotification(
        `Security review complete: ${data?.item?.findings?.length ?? 0} finding(s) detected via Semgrep 1.181.0`
      );
      setTimeout(() => setQuickScanNotification(null), 5000);
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['findings-recent'] });
    },
  });

  // Keyboard shortcut listener: Cmd+K / Ctrl+K and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setUserDropdownOpen(false);
        setProjectDropdownOpen(false);
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close mobile drawer on route transition
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Determine current page name for breadcrumb
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/app') return 'Dashboard';
    if (path.startsWith('/app/findings')) return 'Vulnerabilities';
    if (path.startsWith('/app/scans')) return 'Scan History';
    if (path.startsWith('/app/repositories')) return 'Repositories';
    if (path.startsWith('/app/pipeline')) return 'Pipeline';
    if (path.startsWith('/app/profile')) return 'My Profile';
    if (path.startsWith('/app/admin/control-center')) return 'Control Center';
    if (path.startsWith('/app/admin')) return 'Team & Roles';
    if (path.startsWith('/app/integrations')) return 'Integrations';
    if (path.startsWith('/app/settings')) return 'Settings';
    if (path.startsWith('/docs')) return 'Documentation';
    return 'Workspace';
  };

  const navGroups = [
    {
      label: 'General',
      items: [
        { to: '/app', name: 'Dashboard', icon: HomeIcon, end: true },
        { to: '/app/findings', name: 'Vulnerabilities', icon: ShieldAlertIcon, badge: statsData?.criticalFindings },
        { to: '/app/scans', name: 'Scan History', icon: HistoryIcon },
      ],
    },
    {
      label: 'Settings',
      items: [
        { to: '/app/repositories', name: 'Repositories', icon: RepositoriesIcon },
        { to: '/app/integrations', name: 'Integrations', icon: KeyIcon },
        { to: '/app/pipeline', name: 'Pipeline', icon: PipelineIcon },
      ],
    },
    {
      label: 'Administration',
      items: [
        { to: '/app/admin/control-center', name: 'Control Center', icon: ShieldCheck },
        { to: '/app/profile', name: 'My Profile', icon: UserIcon },
        { to: '/docs', name: 'Docs', icon: DocsIcon },
      ],
    },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0E0F12] font-sans text-zinc-100 select-none">
      {/* ── 1. GLOBAL COMMAND SEARCH PALETTE ──────────────────────────────── */}
      <CommandSearch
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onTriggerDemoScan={() => runQuickScan()}
      />

      {/* ── 2. AGNDEX EXPANDED DESKTOP SIDEBAR ─────────────────────────────── */}
      <aside className="hidden md:flex w-[276px] flex-col justify-between bg-[#0E0F12] shrink-0 h-full z-30">
        <div className="flex flex-col">
          {/* Header Branding */}
          <div className="flex items-center justify-between gap-2 px-5 pt-6 pb-2">
            <Link to="/" className="flex items-center gap-2.5 group">
              <CodeSentinelLogo className="size-6 text-[#D946EF]" />
              <span className="text-xl font-semibold tracking-tight text-white">
                CodeSentinel
              </span>
            </Link>
            <span className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium text-zinc-300">
              Security Workspace
            </span>
          </div>

          {/* Nav Groups */}
          <div className="mt-7 flex flex-col gap-6 px-4 overflow-y-auto">
            {navGroups.map((group) => (
              <div key={group.label} className="flex flex-col">
                <span className="mb-2 px-3 text-xs font-normal text-zinc-500">
                  {group.label}
                </span>
                <div className="flex flex-col gap-1">
                  {group.items.map((item) => {
                    const isActive = item.end
                      ? location.pathname === item.to
                      : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={cn(
                          'flex items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-sm tracking-tight transition-colors',
                          isActive
                            ? 'bg-[#22242A] text-white font-medium'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                        )}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <item.icon className={cn('size-4 shrink-0', isActive ? 'text-white' : 'text-zinc-400')} />
                          <span className="truncate">{item.name}</span>
                        </div>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="rounded-md bg-red-500/20 px-2 py-0.5 text-[11px] font-medium text-red-400">
                            {item.badge}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Footer: Unified Account Profile Area with Popover Menu */}
        <div className="px-4 pb-5 flex flex-col gap-1.5 relative">
          <div ref={dropdownRef} className="relative">
            {userDropdownOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-full rounded-xl border border-white/10 bg-[#18191D] p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex flex-col gap-2 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-gradient-to-tr from-[#D946EF] to-[#818CF8] overflow-hidden flex items-center justify-center text-sm font-semibold text-white shrink-0 border border-white/10">
                      {user?.avatarFile ? (
                        <img
                          src={`/api/users/${user.id}/avatar`}
                          alt={user?.name || 'User Avatar'}
                          className="size-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <span>{user?.name?.[0] || 'O'}</span>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <p className="text-sm font-medium text-white leading-tight break-words">{user?.name || 'Security Operator'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={user?.role || 'member'} size="xs" />
                        <StatusBadge status={user?.status || 'active'} size="xs" />
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-zinc-400 break-all pl-0.5 mt-0.5 font-mono">
                    {user?.username ? `@${user.username} · ` : ''}{user?.email || 'operator@codesentinel.local'}
                  </div>
                </div>

                <div className="mt-2 flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      navigate('/app/profile');
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-white hover:bg-white/5 transition-colors text-left"
                  >
                    <UserIcon size={14} className="text-[#D946EF] shrink-0" />
                    <span>My Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      navigate('/app/settings');
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-normal text-zinc-300 hover:bg-white/5 transition-colors text-left"
                  >
                    <BadgeCheck size={14} className="text-zinc-400 shrink-0" />
                    <span>Account Settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      navigate('/app/admin/control-center');
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-normal text-zinc-300 hover:bg-white/5 transition-colors text-left"
                  >
                    <ShieldCheck size={14} className="text-zinc-400 shrink-0" />
                    <span>Admin Control Center</span>
                  </button>

                  <div className="my-1 border-t border-white/10" />

                  <button
                    type="button"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      handleLogout();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-normal text-red-400 hover:bg-red-500/10 transition-colors text-left"
                  >
                    <LogoutIcon className="size-3.5 shrink-0" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex w-full items-center justify-between gap-2.5 rounded-xl border border-white/5 bg-[#18191E] p-2.5 text-left hover:bg-[#202227] hover:border-white/10 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-8 rounded-full bg-gradient-to-tr from-[#D946EF] to-[#818CF8] overflow-hidden flex items-center justify-center text-xs font-bold text-white shrink-0 border border-white/10">
                  {user?.avatarFile ? (
                    <img
                      src={`/api/users/${user.id}/avatar`}
                      alt={user?.name || 'User Avatar'}
                      className="size-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <span>{user?.name?.[0] || 'O'}</span>
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-white leading-tight break-words">
                    {user?.name || 'Security Operator'}
                  </span>
                  <span className="text-[11px] text-zinc-400 font-normal">
                    {user?.role === 'owner' ? 'System Owner' : user?.role === 'admin' ? 'Security Lead' : 'Security Operator'}
                  </span>
                </div>
              </div>
              <ChevronsUpDown size={14} className="text-zinc-500 shrink-0" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── 3. MAIN WORKSPACE WITH AGNDEX ROUNDED INNER CANVAS ─────────────── */}
      <main className="flex-1 overflow-hidden md:bg-[#0E0F12] md:p-2.5 flex flex-col min-w-0">
        <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-[#18191E] border border-white/5 shadow-2xl">
          {/* Topbar matching Agndex Topbar */}
          <header className="sticky top-0 z-40 flex h-14 md:h-16 shrink-0 items-center justify-between gap-4 px-4 md:px-8 border-b border-white/5 bg-[#18191E]/90 backdrop-blur-sm">
            {/* Left: Mobile trigger & Breadcrumbs */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5"
              >
                <Menu size={18} />
              </button>

              <nav className="hidden md:flex items-center gap-2 text-sm text-zinc-400">
                <span>CodeSentinel</span>
                <span className="text-zinc-600">|</span>
                <span>{selectedProject}</span>
                <span className="text-zinc-600">|</span>
                <span className="font-medium text-white">{getPageTitle()}</span>
              </nav>
            </div>

            {/* Right: Project Selector & Fast Action Buttons */}
            <div className="flex items-center gap-3">
              {/* Notification Pill if scan just ran */}
              {quickScanNotification && (
                <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                  <CheckIcon className="size-3.5" />
                  <span>{quickScanNotification}</span>
                </div>
              )}

              {/* Command Palette Trigger */}
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#202227] hover:bg-[#262930] text-zinc-400 hover:text-zinc-200 border border-white/10 text-xs transition-colors"
              >
                <Search size={13} />
                <span className="text-xs">Search...</span>
                <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-black/40 text-zinc-400 border border-white/10">
                  ⌘K
                </kbd>
              </button>

              {/* Project Dropdown */}
              <div ref={projectRef} className="relative">
                <button
                  type="button"
                  onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
                  className="flex h-10 items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#202227] px-3 text-sm text-zinc-200 hover:bg-[#262930] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <ProjectIcon className="size-4 text-zinc-400" />
                    <span className="font-normal text-xs md:text-sm">{selectedProject}</span>
                  </span>
                  <CaretDownIcon className={cn('size-4 text-zinc-400 transition-transform', projectDropdownOpen && 'rotate-180')} />
                </button>

                {projectDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-xl border border-white/10 bg-[#202227] p-1.5 shadow-2xl z-50">
                    <div className="px-3 py-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Monitored Workspaces
                    </div>
                    <button
                      onClick={() => {
                        setSelectedProject('CodeSentinel Core');
                        setProjectDropdownOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs text-left transition-colors',
                        selectedProject === 'CodeSentinel Core' ? 'bg-white/10 text-white font-medium' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                      )}
                    >
                      <div>
                        <div className="font-medium text-white">CodeSentinel Core</div>
                        <div className="text-[10px] text-zinc-500">Primary Workspace</div>
                      </div>
                      {selectedProject === 'CodeSentinel Core' && <CheckIcon className="size-3.5 text-[#D946EF]" />}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedProject('local/controlled-fixture');
                        setProjectDropdownOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs text-left transition-colors',
                        selectedProject === 'local/controlled-fixture' ? 'bg-white/10 text-white font-medium' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                      )}
                    >
                      <div>
                        <div className="font-medium text-white">local/controlled-fixture</div>
                        <div className="text-[10px] text-zinc-500">Controlled Test Fixture Scope</div>
                      </div>
                      {selectedProject === 'local/controlled-fixture' && <CheckIcon className="size-3.5 text-[#D946EF]" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Run Scan Header Button */}
              <button
                type="button"
                onClick={() => runQuickScan()}
                disabled={isScanning}
                className="flex items-center gap-2 h-10 px-3.5 rounded-lg bg-[#D946EF] hover:bg-[#C026D3] active:scale-95 text-white text-xs font-medium transition-all disabled:opacity-50 shadow-sm"
              >
                {isScanning ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Scanning...</span>
                  </>
                ) : (
                  <>
                    <Play size={13} fill="currentColor" />
                    <span className="hidden sm:inline">Run Scan</span>
                  </>
                )}
              </button>
            </div>
          </header>

          {/* Scrollable Workspace Body */}
          <div className="flex-1 overflow-y-auto">
            <Suspense fallback={<div className="flex-1 min-h-[400px] bg-[#18191E]" />}>
              <Outlet />
            </Suspense>
          </div>
        </div>
      </main>

      {/* ── 4. RESPONSIVE MOBILE SLIDE-OUT DRAWER ─────────────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex w-72 flex-col justify-between bg-[#0E0F12] border-r border-white/10 p-5 z-50">
            <div className="flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <CodeSentinelLogo className="size-6 text-[#D946EF]" />
                  <span className="font-semibold text-white">CodeSentinel</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded text-zinc-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-6 flex flex-col gap-6">
                {navGroups.map((group) => (
                  <div key={group.label} className="flex flex-col gap-1">
                    <span className="px-2 text-xs text-zinc-500">{group.label}</span>
                    {group.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
                      >
                        <item.icon className="size-4" />
                        <span>{item.name}</span>
                      </NavLink>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex flex-col gap-2">
              <div className="flex items-center gap-2.5 px-2 py-1">
                <div className="size-8 rounded-full bg-gradient-to-tr from-[#D946EF] to-[#818CF8] overflow-hidden flex items-center justify-center text-xs font-bold text-white shrink-0 border border-white/10">
                  {user?.avatarFile ? (
                    <img
                      src={`/api/users/${user.id}/avatar`}
                      alt={user?.name || 'User Avatar'}
                      className="size-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <span>{user?.name?.[0] || 'O'}</span>
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-xs font-medium text-white">{user?.name || 'Security Operator'}</span>
                  <span className="text-[10px] text-zinc-400 capitalize">{user?.role === 'owner' ? 'Owner' : 'Operator'}</span>
                </div>
              </div>
              <NavLink
                to="/app/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
              >
                <UserIcon size={14} className="text-[#D946EF]" />
                <span>My Profile</span>
              </NavLink>
              <NavLink
                to="/app/settings"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
              >
                <BadgeCheck size={14} />
                <span>Account Settings</span>
              </NavLink>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 text-xs text-red-400 hover:bg-red-500/10 px-2 py-1.5 rounded-lg transition-colors text-left"
              >
                <LogoutIcon className="size-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory password change blocking modal */}
      {user?.mustChangePassword && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#202227] rounded-2xl border border-[#D946EF]/30 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              <div className="w-10 h-10 rounded-xl bg-[#D946EF]/10 border border-[#D946EF]/20 flex items-center justify-center text-[#D946EF]">
                <Shield size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Password Change Required</h3>
                <p className="text-xs text-zinc-400">Establish your permanent password to continue</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#18191E] border border-white/5 text-xs text-zinc-300 space-y-1 leading-relaxed">
              <p>Your account was provisioned or reset with a temporary password.</p>
              <p className="text-zinc-500 text-[11px]">Protected platform resources, scanning triggers, and API endpoints remain locked until you set a permanent password.</p>
            </div>

            {passwordError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {passwordError}
              </div>
            )}

            <form onSubmit={handleMandatoryPasswordChange} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Current / Temporary Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                  placeholder="Enter temporary password"
                  className="w-full bg-[#18191E] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF] font-mono"
                />
              </div>
              <div>
                <label className="block text-zinc-300 font-medium mb-1">New Permanent Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Minimum 8 characters"
                  className="w-full bg-[#18191E] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF] font-mono"
                />
              </div>
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Re-enter new password"
                  className="w-full bg-[#18191E] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF] font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={logout}
                  className="text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  Sign Out
                </button>
                <button
                  type="submit"
                  disabled={updatingPassword}
                  className="px-4 py-2 rounded-lg bg-[#D946EF] hover:bg-[#C026D3] text-white font-medium transition-colors disabled:opacity-50"
                >
                  {updatingPassword ? 'Updating...' : 'Set Password & Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
