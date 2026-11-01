import React, { useState, useEffect } from 'react';
import {
  ProjectIcon,
  InfoIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
} from '../components/ui/AgndexIcons';
import {
  User,
  Shield,
  KeyRound,
  Bell,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Laptop,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { auth, ApiError } from '../lib/api';

export default function SettingsPage() {
  const { user, refresh } = useAuth();

  // Form states
  const [name, setName] = useState(user?.name || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Notification preferences
  const [emailAlerts, setEmailAlerts] = useState(() => {
    return localStorage.getItem('codesentinel_pref_email') !== 'false';
  });
  const [mobileAlerts, setMobileAlerts] = useState(() => {
    return localStorage.getItem('codesentinel_pref_mobile') !== 'false';
  });

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  const handleToggle = (key: string, val: boolean, setter: (v: boolean) => void) => {
    setter(val);
    localStorage.setItem(key, String(val));
    setSuccessMessage('Notification preferences updated.');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (password && password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (password && password !== confirmPassword) {
      setErrorMessage('New passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const patch: { name?: string; password?: string } = {};
      if (name.trim() && name.trim() !== user?.name) patch.name = name.trim();
      if (password) patch.password = password;

      if (Object.keys(patch).length === 0) {
        setErrorMessage('No changes to save.');
        setSaving(false);
        return;
      }

      await auth.updateProfile(patch);
      await refresh();
      setPassword('');
      setConfirmPassword('');
      setSuccessMessage('Account profile updated successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const roleLabel =
    user?.role === 'owner'
      ? 'System Owner (Full Privileges)'
      : user?.role === 'admin'
      ? 'Security Administrator'
      : 'Security Operator';

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 p-4 md:gap-11 md:p-8">
      {/* ── 1. PAGE HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Settings</h1>
        <p className="text-zinc-400">Manage your operator credentials, access tier, and notification channels</p>
      </div>

      {/* ── 2. METADATA STATUS CHIPS ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center md:gap-2">
        <div className="agndex-meta-chip font-medium text-white">
          <ProjectIcon className="size-4 text-zinc-400" />
          CodeSentinel Workspace
        </div>
        <div className="agndex-meta-chip">
          <Shield className="size-4 text-zinc-400" />
          {roleLabel}
        </div>
        <div className="agndex-meta-chip">
          <Laptop className="size-4 text-zinc-400" />
          Active Web Session
        </div>
      </div>

      {/* ── 3. HORIZONTAL DIVIDER ──────────────────────────────────────────── */}
      <div className="border-t border-white/10" />

      {/* ── 4. OPERATOR IDENTITY & PROFILE FORM ────────────────────────────── */}
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="font-medium text-white text-base">Operator Profile</h2>
          <p className="text-sm text-zinc-400">
            Configure your personal operator identity and cryptographic PBKDF2 credentials
          </p>
        </div>

        {successMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-sm text-emerald-400">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-sm text-red-400">
            <AlertCircle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-400">Operator Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="agndex-input"
                placeholder="Full Name"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-400">Email Address (Primary Operator)</label>
              <input
                type="text"
                disabled
                value={user?.email || 'operator@codesentinel.local'}
                className="agndex-input opacity-60 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-400">New Password (Optional, min 8 characters)</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="agndex-input pr-10"
                  placeholder="Leave blank to keep existing password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-zinc-400">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="agndex-input"
                placeholder="Re-enter new password"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="agndex-btn-primary"
            >
              {saving ? 'Updating Settings...' : 'Save Account Settings'}
            </button>
          </div>
        </form>
      </div>

      {/* ── 5. HORIZONTAL DIVIDER ──────────────────────────────────────────── */}
      <div className="border-t border-white/10" />

      {/* ── 6. ACTIVE SESSION & SECURITY ASSURANCE ─────────────────────────── */}
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="font-medium text-white text-base">Session & Cryptographic Hardening</h2>
          <p className="text-sm text-zinc-400">
            Security guarantees for your active browser session and credential storage
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/10 bg-[#202227] p-3.5">
            <span className="text-xs text-zinc-500 block">Password Derivation</span>
            <span className="text-sm font-mono text-zinc-200 mt-1 block">
              PBKDF2-SHA256 (200,000 Rounds)
            </span>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#202227] p-3.5">
            <span className="text-xs text-zinc-500 block">Session Transport</span>
            <span className="text-sm font-mono text-emerald-400 mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" />
              HttpOnly · SameSite=Lax
            </span>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#202227] p-3.5">
            <span className="text-xs text-zinc-500 block">Role Hierarchy</span>
            <span className="text-sm font-mono text-zinc-200 mt-1 block capitalize">
              {user?.role || 'user'}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2 text-zinc-400 text-xs">
          <InfoIcon className="size-4 shrink-0 mt-0.5 text-zinc-500" />
          <p>
            When password rotation is performed, all other active sessions for your operator account are automatically revoked to prevent session hijacking.
          </p>
        </div>
      </div>

      {/* ── 7. HORIZONTAL DIVIDER ──────────────────────────────────────────── */}
      <div className="border-t border-white/10" />

      {/* ── 8. NOTIFICATION PREFERENCES ────────────────────────────────────── */}
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="font-medium text-white text-base">Security Notifications</h2>
          <p className="text-sm text-zinc-400">
            Configure simulated alert dispatching and mobile companion synchronization
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-[#202227] p-4">
            <div>
              <p className="text-sm font-medium text-white">Email Security Alerts</p>
              <p className="text-xs text-zinc-400">
                Logged to security audit stream in local development mode when critical findings are detected.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('codesentinel_pref_email', !emailAlerts, setEmailAlerts)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                emailAlerts ? 'bg-[#D946EF]' : 'bg-zinc-700'
              }`}
              aria-label="Toggle email security alerts"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  emailAlerts ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-[#202227] p-4">
            <div>
              <p className="text-sm font-medium text-white">Mobile Companion Sync</p>
              <p className="text-xs text-zinc-400">
                Pushes alert payloads to the local React Native / Expo companion app (<code className="text-zinc-300">mobile/</code>).
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle('codesentinel_pref_mobile', !mobileAlerts, setMobileAlerts)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                mobileAlerts ? 'bg-[#D946EF]' : 'bg-zinc-700'
              }`}
              aria-label="Toggle mobile companion sync"
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  mobileAlerts ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
