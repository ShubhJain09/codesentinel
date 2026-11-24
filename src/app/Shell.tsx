import * as Dialog from '@radix-ui/react-dialog';
import {
  BookOpenText,
  ClockCounterClockwise,
  GearSix,
  House,
  List,
  ListChecks,
  Moon,
  Plus,
  Question,
  SealWarning,
  Sun,
  UsersThree,
  X,
  GitBranch,
} from '@phosphor-icons/react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Wordmark, Mark } from '../components/brand';
import { PULL_REQUESTS } from '../data/fixtures';
import { allScans, findingsFor, reviewOf, useStore, useTheme } from '../lib/store';

function useCounts() {
  const s = useStore();
  const open = PULL_REQUESTS.flatMap((pr) => findingsFor(pr)).filter((f) => {
    const st = reviewOf(s, f.fingerprint).status;
    return st === 'open' || st === 'in_review';
  }).length;
  return { scans: allScans(s).length, open };
}

const PRIMARY = [
  { to: '/app', label: 'Home', icon: House, end: true },
  { to: '/app/scans', label: 'Scans', icon: ClockCounterClockwise, end: false, count: 'scans' as const },
  { to: '/app/findings', label: 'Findings', icon: SealWarning, end: false, count: 'open' as const },
  { to: '/app/repositories', label: 'Repositories', icon: GitBranch, end: false },
  { to: '/app/rules', label: 'Rules', icon: ListChecks, end: false },
];

const ADMIN = [
  { to: '/app/members', label: 'Members', icon: UsersThree },
  { to: '/app/settings', label: 'Settings', icon: GearSix },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const counts = useCounts();
  const { pathname } = useLocation();
  const [theme, setTheme] = useTheme();
  // Scan reports and findings belong to "Scans".
  const activeFor = (to: string, end: boolean) => (end ? pathname === to : pathname.startsWith(to));

  return (
    <nav className="sidebar" aria-label="Workspace">
      <div className="sidebar__brand">
        <Link to="/" className="sidebar__logo" aria-label="CodeSentinel homepage" onClick={onNavigate}>
          <Wordmark size={24} />
        </Link>
        <p className="sidebar__workspace">
          <span className="sidebar__ws-name">Sample workspace</span>
          <span className="sidebar__ws-note">Prototype · sample data only</span>
        </p>
      </div>

      <Link to="/app/new-scan" className="btn btn--primary sidebar__new" onClick={onNavigate}>
        <Plus size={18} weight="bold" />
        New scan
      </Link>

      <ul className="sidebar__list">
        {PRIMARY.map(({ to, label, icon: I, end, count }) => {
          const active = activeFor(to, end);
          return (
            <li key={to}>
              <NavLink to={to} end={end} className={`nav${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={onNavigate}>
                <I size={20} weight={active ? 'fill' : 'regular'} aria-hidden="true" />
                <span className="nav__label">{label}</span>
                {count && counts[count] > 0 && (
                  <span className="nav__count tnum" aria-label={`${counts[count]} ${count === 'open' ? 'open findings' : 'scans'}`}>
                    {counts[count]}
                  </span>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>

      <p className="sidebar__heading">Workspace admin</p>
      <ul className="sidebar__list">
        {ADMIN.map(({ to, label, icon: I }) => (
          <li key={to}>
            <NavLink to={to} className="nav" onClick={onNavigate}>
              <I size={20} aria-hidden="true" />
              <span className="nav__label">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="sidebar__foot">
        <NavLink to="/app/help" className="nav" onClick={onNavigate}>
          <Question size={20} aria-hidden="true" />
          <span className="nav__label">Help</span>
        </NavLink>
        <button type="button" className="nav" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-pressed={theme === 'dark'}>
          {theme === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
          <span className="nav__label">{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
        </button>
        <div className="sidebar__account">
          <span className="sidebar__avatar" aria-hidden="true">
            <BookOpenText size={16} />
          </span>
          <span className="sidebar__account-text">
            <span>No account</span>
            <span className="sidebar__account-sub">Sign-in arrives in a later gate</span>
          </span>
        </div>
      </div>
    </nav>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useTheme();

  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="app__sidebar">
        <Sidebar />
      </aside>

      <header className="topbar">
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button type="button" className="btn btn--ghost topbar__menu">
              <List size={20} weight="bold" />
              Menu
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content className="drawer" aria-describedby={undefined}>
              <Dialog.Title className="visually-hidden">Workspace navigation</Dialog.Title>
              <Dialog.Close asChild>
                <button type="button" className="icon-btn drawer__close" aria-label="Close menu">
                  <X size={20} />
                </button>
              </Dialog.Close>
              <Sidebar onNavigate={() => setOpen(false)} />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <Link to="/" className="topbar__logo" aria-label="CodeSentinel homepage">
          <Mark size={24} />
        </Link>
        <Link to="/app/new-scan" className="btn btn--primary btn--sm topbar__new">
          <Plus size={16} weight="bold" />
          New scan
        </Link>
      </header>

      <main id="main" className="app__main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}

export function Crumbs({ children }: { children: ReactNode }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {children}
    </nav>
  );
}
