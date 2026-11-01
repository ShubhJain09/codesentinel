import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { auth, ApiError } from '../lib/api';
import { StatusBadge } from '../components/ui/StatusBadge';
import {
  User as UserIcon,
  Mail,
  Lock,
  Camera,
  Trash2,
  Calendar,
  Github,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Laptop,
  KeyRound,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function MyProfilePage() {
  const { user, refreshUser, logout } = useAuth();

  // Profile fields state
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [githubUsername, setGithubUsername] = useState('');
  const [dob, setDob] = useState('');

  // Password fields state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Status and feedback states
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    username?: string;
    githubUsername?: string;
    dob?: string;
    bio?: string;
  }>({});

  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarBuster, setAvatarBuster] = useState(Date.now());

  const [revokingSessions, setRevokingSessions] = useState(false);
  const [sessionSuccess, setSessionSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state with authenticated user
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setUsername(user.username || '');
      setBio(user.bio || '');
      setGithubUsername(user.githubUsername || '');
      setDob(user.dob || '');
    }
  }, [user]);

  // Determine if form is pristine (unchanged)
  const isPristine = useMemo(() => {
    if (!user) return true;
    return (
      name.trim() === (user.name || '').trim() &&
      username.trim().toLowerCase() === (user.username || '').trim().toLowerCase() &&
      bio.trim() === (user.bio || '').trim() &&
      githubUsername.trim() === (user.githubUsername || '').trim() &&
      dob === (user.dob || '')
    );
  }, [user, name, username, bio, githubUsername, dob]);

  // Handle Profile Update
  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    setFieldErrors({});

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFieldErrors((prev) => ({ ...prev, name: 'Full name is required (1-80 characters)' }));
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername && !/^[a-zA-Z0-9._-]{3,32}$/.test(cleanUsername)) {
      setFieldErrors((prev) => ({
        ...prev,
        username: 'Username must be 3-32 characters (letters, numbers, dots, dashes, underscores)',
      }));
      return;
    }

    setSavingProfile(true);
    try {
      await auth.updateProfile({
        name: trimmedName,
        username: cleanUsername,
        bio: bio.trim(),
        githubUsername: githubUsername.trim(),
        dob: dob || '',
      });
      await refreshUser();
      setProfileSuccess('Profile details saved successfully.');
      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to update profile';
      if (err instanceof ApiError && err.field) {
        setFieldErrors((prev) => ({ ...prev, [err.field as string]: errorMsg }));
      } else if (errorMsg.toLowerCase().includes('username')) {
        setFieldErrors((prev) => ({ ...prev, username: errorMsg }));
      } else if (errorMsg.toLowerCase().includes('github')) {
        setFieldErrors((prev) => ({ ...prev, githubUsername: errorMsg }));
      } else if (errorMsg.toLowerCase().includes('birth') || errorMsg.toLowerCase().includes('dob')) {
        setFieldErrors((prev) => ({ ...prev, dob: errorMsg }));
      } else {
        setProfileError(errorMsg);
      }
    } finally {
      setSavingProfile(false);
    }
  }

  // Handle Password Update
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Please provide your current password');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setSavingPassword(true);
    try {
      await auth.updateProfile({
        currentPassword,
        newPassword,
      });
      await refreshUser();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess('Password changed securely. Other active sessions have been revoked.');
      setTimeout(() => setPasswordSuccess(null), 5000);
    } catch (err: any) {
      setPasswordError(err?.message || 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  }

  // Handle Avatar File Upload
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAvatarError('Please select a PNG, JPEG, or WebP image');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Avatar image must be smaller than 2MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      await auth.uploadAvatar(file);
      setAvatarBuster(Date.now());
      await refreshUser();
    } catch (err: any) {
      setAvatarError(err?.message || 'Failed to upload photo');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // Handle Avatar Removal
  async function handleRemoveAvatar() {
    setAvatarError(null);
    setUploadingAvatar(true);
    try {
      await auth.removeAvatar();
      setAvatarBuster(Date.now());
      await refreshUser();
    } catch (err: any) {
      setAvatarError(err?.message || 'Failed to remove photo');
    } finally {
      setUploadingAvatar(false);
    }
  }

  // Handle Revoke Other Sessions
  async function handleRevokeOtherSessions() {
    setRevokingSessions(true);
    setSessionSuccess(null);
    try {
      await auth.revokeOtherSessions();
      setSessionSuccess('All other active browser sessions have been signed out.');
      setTimeout(() => setSessionSuccess(null), 5000);
    } catch (err: any) {
      setProfileError(err?.message || 'Failed to revoke other sessions');
    } finally {
      setRevokingSessions(false);
    }
  }

  const userInitial = (user?.name || user?.username || 'U')[0]?.toUpperCase();
  const avatarUrl = user?.id ? `/api/users/${user.id}/avatar?t=${avatarBuster}` : null;

  return (
    <div className="min-h-full bg-[#18191E] p-6 sm:p-8 lg:p-10 text-zinc-100">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header - Clean Agndex style */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              My Profile
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Manage your personal identity, login credentials, and active session security.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-red-500/10 hover:text-red-400 border border-white/10 text-xs font-medium text-zinc-300 transition-colors"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Section 1: Avatar & Identity Summary */}
        <div className="bg-[#202227] rounded-xl border border-white/10 p-6 flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="relative group shrink-0">
            <div className="size-20 rounded-full overflow-hidden bg-[#18191E] border border-white/10 flex items-center justify-center shadow-lg">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user?.name || 'Profile Avatar'}
                  className="size-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <span className="text-2xl font-bold text-[#D946EF]">{userInitial}</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#D946EF] text-white hover:bg-[#C026D3] shadow-md transition-transform active:scale-95 disabled:opacity-50"
              title="Upload new photo"
            >
              <Camera size={13} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h2 className="text-base font-semibold text-white">{user?.name}</h2>
              {user?.username && (
                <span className="text-xs font-mono text-[#D946EF] bg-[#D946EF]/10 px-2 py-0.5 rounded border border-[#D946EF]/20 w-fit mx-auto sm:mx-0">
                  @{user.username}
                </span>
              )}
              <StatusBadge status={user?.role || 'member'} size="xs" className="w-fit mx-auto sm:mx-0" />
            </div>

            <p className="text-xs text-zinc-400">
              {user?.email} · Joined {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Recently'}
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-colors"
              >
                {uploadingAvatar ? (
                  <>
                    <RefreshCw size={12} className="animate-spin text-[#D946EF]" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Camera size={12} />
                    <span>Upload photo</span>
                  </>
                )}
              </button>

              {user?.avatarFile && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={uploadingAvatar}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-rose-500/10 hover:text-rose-400 border border-white/10 text-xs font-medium text-zinc-300 transition-colors"
                >
                  <Trash2 size={12} />
                  <span>Remove</span>
                </button>
              )}
            </div>

            {avatarError && (
              <p className="text-xs text-rose-400 flex items-center gap-1.5 pt-1">
                <AlertCircle size={13} />
                <span>{avatarError}</span>
              </p>
            )}
            <p className="text-[11px] text-zinc-500">
              PNG, JPEG, or WebP up to 2MB. Magic-byte validated.
            </p>
          </div>
        </div>

        {/* Section 2: Personal Information */}
        <div className="bg-[#202227] rounded-xl border border-white/10 p-6 space-y-6">
          <div className="border-b border-white/10 pb-4">
            <h3 className="text-base font-semibold text-white">Personal Information</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Update your public display identity and personal settings.
            </p>
          </div>

          {profileSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={14} className="shrink-0" />
              <span>{profileSuccess}</span>
            </div>
          )}

          {profileError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <UserIcon size={14} className="absolute left-3 top-3 text-zinc-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: undefined }));
                    }}
                    required
                    maxLength={80}
                    placeholder="e.g. Alex Mercer"
                    className={cn(
                      'w-full bg-[#18191E] border rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors',
                      fieldErrors.name
                        ? 'border-rose-500 focus:border-rose-500'
                        : 'border-white/10 focus:border-[#D946EF]'
                    )}
                  />
                </div>
                {fieldErrors.name && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-1">
                    <AlertCircle size={12} />
                    <span>{fieldErrors.name}</span>
                  </p>
                )}
              </div>

              {/* Unique Username */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Unique Username <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-zinc-500 font-mono">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value.toLowerCase());
                      if (fieldErrors.username) setFieldErrors((p) => ({ ...p, username: undefined }));
                    }}
                    required
                    placeholder="username"
                    className={cn(
                      'w-full bg-[#18191E] border rounded-lg pl-8 pr-3 py-2 text-xs text-white font-mono placeholder-zinc-500 focus:outline-none transition-colors',
                      fieldErrors.username
                        ? 'border-rose-500 focus:border-rose-500'
                        : 'border-white/10 focus:border-[#D946EF]'
                    )}
                  />
                </div>
                {fieldErrors.username ? (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-1">
                    <AlertCircle size={12} />
                    <span>{fieldErrors.username}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-zinc-500 mt-1">
                    You can log in using either this username or your email.
                  </p>
                )}
              </div>

              {/* Email Address (Primary - Read Only) */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Primary Email
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-3 text-zinc-500" />
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full bg-[#18191E]/60 border border-white/5 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-400 cursor-not-allowed"
                  />
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Primary workspace email for security alerts and notifications.
                </p>
              </div>

              {/* GitHub Handle */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  GitHub Profile
                </label>
                <div className="relative">
                  <Github size={14} className="absolute left-3 top-3 text-zinc-500" />
                  <input
                    type="text"
                    value={githubUsername}
                    onChange={(e) => {
                      setGithubUsername(e.target.value);
                      if (fieldErrors.githubUsername)
                        setFieldErrors((p) => ({ ...p, githubUsername: undefined }));
                    }}
                    placeholder="e.g. username or https://github.com/username"
                    className={cn(
                      'w-full bg-[#18191E] border rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors',
                      fieldErrors.githubUsername
                        ? 'border-rose-500 focus:border-rose-500'
                        : 'border-white/10 focus:border-[#D946EF]'
                    )}
                  />
                </div>
                {fieldErrors.githubUsername ? (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-1">
                    <AlertCircle size={12} />
                    <span>{fieldErrors.githubUsername}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Accepts GitHub username or profile URL. Connects to PR reviews and attributions.
                  </p>
                )}
              </div>
            </div>

            {/* Date of Birth (Confidential) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <Calendar size={13} className="text-zinc-400" />
                  <span>Date of Birth</span>
                </label>
                <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                  <Lock size={11} className="text-zinc-500" />
                  <span>Private to you</span>
                </span>
              </div>
              <input
                type="date"
                value={dob}
                onChange={(e) => {
                  setDob(e.target.value);
                  if (fieldErrors.dob) setFieldErrors((p) => ({ ...p, dob: undefined }));
                }}
                max={new Date().toISOString().split('T')[0]}
                className={cn(
                  'w-full sm:w-64 bg-[#18191E] border rounded-lg px-3 py-2 text-xs text-white focus:outline-none transition-colors',
                  fieldErrors.dob
                    ? 'border-rose-500 focus:border-rose-500'
                    : 'border-white/10 focus:border-[#D946EF]'
                )}
              />
              {fieldErrors.dob ? (
                <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-1">
                  <AlertCircle size={12} />
                  <span>{fieldErrors.dob}</span>
                </p>
              ) : (
                <p className="text-[11px] text-zinc-500 mt-1">
                  Stored confidentially. Never displayed in team lists, scan logs, or audit records.
                </p>
              )}
            </div>

            {/* Bio */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-300">
                  Bio / Responsibilities
                </label>
                <span className="text-[10px] text-zinc-500">
                  {bio.length}/280
                </span>
              </div>
              <textarea
                value={bio}
                onChange={(e) => {
                  setBio(e.target.value);
                  if (fieldErrors.bio) setFieldErrors((p) => ({ ...p, bio: undefined }));
                }}
                maxLength={280}
                rows={3}
                placeholder="Share your focus area, security domain, or team responsibilities..."
                className={cn(
                  'w-full bg-[#18191E] border rounded-lg p-3 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors resize-none',
                  fieldErrors.bio
                    ? 'border-rose-500 focus:border-rose-500'
                    : 'border-white/10 focus:border-[#D946EF]'
                )}
              />
              {fieldErrors.bio && (
                <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-1">
                  <AlertCircle size={12} />
                  <span>{fieldErrors.bio}</span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-zinc-500">
                {isPristine ? 'All changes saved' : 'Unsaved changes'}
              </span>
              <button
                type="submit"
                disabled={savingProfile || isPristine}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D946EF] hover:bg-[#C026D3] text-white text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                {savingProfile ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Section 3: Password & Security */}
        <div className="bg-[#202227] rounded-xl border border-white/10 p-6 space-y-6">
          <div className="border-b border-white/10 pb-4">
            <h3 className="text-base font-semibold text-white">Password & Security</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Rotate your account password. Updating your password automatically invalidates all other active sessions.
            </p>
          </div>

          {passwordSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={14} className="shrink-0" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          {passwordError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Current Password */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Current Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <KeyRound size={14} className="absolute left-3 top-3 text-zinc-500" />
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="w-full bg-[#18191E] border border-white/10 rounded-lg pl-9 pr-9 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="absolute right-3 top-2.5 text-zinc-500 hover:text-white"
                  >
                    {showCurrentPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  New Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-3 text-zinc-500" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    maxLength={128}
                    placeholder="Min. 8 characters"
                    className="w-full bg-[#18191E] border border-white/10 rounded-lg pl-9 pr-9 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-3 top-2.5 text-zinc-500 hover:text-white"
                  >
                    {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Confirm New Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-3 text-zinc-500" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    className="w-full bg-[#18191E] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D946EF] transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-zinc-500">
                PBKDF2-SHA256 encrypted with 200,000 salt iterations.
              </span>
              <button
                type="submit"
                disabled={savingPassword}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-medium transition-all disabled:opacity-50"
              >
                {savingPassword ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>Update Password</span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Section 4: Active Sessions */}
        <div className="bg-[#202227] rounded-xl border border-white/10 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <h3 className="text-base font-semibold text-white">Active Sessions</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Manage connected devices and browser authorizations for your account.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRevokeOtherSessions}
              disabled={revokingSessions}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/5 hover:bg-rose-500/10 hover:text-rose-300 border border-white/10 text-xs font-medium text-zinc-300 transition-colors disabled:opacity-50"
            >
              <LogOut size={13} />
              <span>{revokingSessions ? 'Revoking...' : 'Sign Out Other Sessions'}</span>
            </button>
          </div>

          {sessionSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={14} className="shrink-0" />
              <span>{sessionSuccess}</span>
            </div>
          )}

          <div className="divide-y divide-white/5">
            <div className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400">
                  <Laptop size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white">Current Session</span>
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] text-emerald-400 font-medium">Active now</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Authorized via HTTP-only session cookie · Valid for 7 days
                  </p>
                </div>
              </div>
              <StatusBadge status="active" label="This Device" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
