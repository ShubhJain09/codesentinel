import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CodeSentinelLogo,
  CheckIcon,
} from '../components/ui/AgndexIcons';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Compute password complexity
  const passwordStrength = React.useMemo(() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  }, [password]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !password) {
      setError('All fields are required to provision an operator profile.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await register(email.trim(), password, name.trim());
      navigate('/app');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Registration failed.');
      } else {
        setError('An unexpected error occurred during account creation.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#0E0F12] text-zinc-100 font-sans selection:bg-[#D946EF]/30 selection:text-white">
      {/* ── LEFT EDITORIAL STUDIO PANEL (55%) ─────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-7/12 bg-[#121318] border-r border-white/10 p-12 relative overflow-hidden">
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <CodeSentinelLogo className="size-8 text-[#D946EF]" />
            <div>
              <span className="font-semibold text-xl tracking-tight text-white">
                CodeSentinel
              </span>
              <span className="ml-2.5 text-[11px] font-mono text-zinc-400 bg-white/10 px-2.5 py-0.5 rounded uppercase">
                G385 · PST_PD_143
              </span>
            </div>
          </Link>

          <div className="mt-16 max-w-lg">
            <div className="inline-block rounded-md bg-[#D946EF]/10 px-2.5 py-1 text-xs font-medium text-[#D946EF] mb-4">
              SAFE FIRST-RUN PROVISIONING
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight">
              Provisioning<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D946EF] to-[#818CF8]">
                Operator Account
              </span>
            </h2>
            <p className="text-sm text-zinc-400 mt-4 leading-relaxed max-w-md">
              The first registered account automatically receives the <strong>Owner</strong> role.
              All credentials are salted and hashed using PBKDF2 with 200,000 iterations.
            </p>
          </div>
        </div>

        {/* Guarantees Box */}
        <div className="relative z-10 max-w-lg my-8 rounded-xl bg-[#18191D] border border-white/10 p-5 space-y-3 text-xs text-zinc-400">
          <div className="text-xs font-semibold text-white">
            Security Invariants Enforced
          </div>
          <div className="flex items-start gap-2">
            <CheckIcon className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span>PBKDF2-SHA256 with 200,000 rounds and unique per-user cryptographically random salt.</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckIcon className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span>HttpOnly SameSite=Lax session cookies preventing token exfiltration via XSS.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-xs text-zinc-500 font-mono">
          College Capstone Project PST_PD_143 · Group G385 · Mentor Biplove
        </div>
      </div>

      {/* ── RIGHT AUTHENTICATION FORM PANEL (45%) ─────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 sm:px-12 py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
            <CodeSentinelLogo className="size-7 text-[#D946EF]" />
            <span className="font-semibold text-xl text-white">CodeSentinel</span>
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              Create Operator Profile
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Enroll as an authorized developer or platform administrator.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">
                Full Name
              </label>
              <div className="relative">
                <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Shubh Jain"
                  required
                  className="agndex-input pl-10"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">
                Operator Email
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@codesentinel.local"
                  required
                  className="agndex-input pl-10"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">
                Password (min 8 chars)
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="agndex-input pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              {/* Password complexity indicator */}
              {password && (
                <div className="flex items-center gap-1.5 pt-1">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={`h-1 flex-1 rounded-full ${
                        passwordStrength >= step
                          ? step <= 2
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                          : 'bg-white/10'
                      }`}
                    />
                  ))}
                  <span className="text-[10px] text-zinc-500 ml-1">
                    {passwordStrength <= 2 ? 'Fair' : 'Strong'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">
                Confirm Password
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="agndex-input pl-10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="agndex-btn-primary w-full py-2.5 justify-center mt-2 text-xs"
            >
              {loading ? (
                <span>Provisioning Account…</span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span>Create Account</span>
                  <ArrowRight size={14} />
                </span>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-white/10 space-y-3 text-center">
            <div className="text-xs text-zinc-400">
              Already have an account?{' '}
              <Link to="/login" className="text-[#D946EF] hover:underline font-medium">
                Sign in →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
