import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CodeSentinelLogo,
  CheckIcon,
} from '../components/ui/AgndexIcons';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../lib/api';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const cleanLogin = loginId.trim();
    if (!cleanLogin || !password) {
      setError('Please provide your username or email and password.');
      return;
    }

    setLoading(true);
    try {
      await login(cleanLogin, password);
      navigate('/app');
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message || 'Authentication failed. Please verify credentials.');
      } else {
        setError(err?.message || 'An unexpected error occurred during session handshake.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#0E0F12] text-zinc-100 font-sans selection:bg-[#D946EF]/30 selection:text-white">
      {/* ── LEFT EDITORIAL STUDIO PANEL (55%) ─────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-7/12 bg-[#121318] border-r border-white/10 p-12 relative overflow-hidden">
        {/* Top Wordmark & Badges */}
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
              DEVELOPER SECURITY PORTAL
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight">
              Security,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D946EF] to-[#818CF8]">
                before merge.
              </span>
            </h2>
            <p className="text-sm text-zinc-400 mt-4 leading-relaxed max-w-md">
              Automated pull-request static analysis using the Semgrep 1.181.0 engine and timing-safe webhook verification.
              Zero host execution of untrusted code.
            </p>
          </div>
        </div>

        {/* Diagnostic Code Callout */}
        <div className="relative z-10 max-w-lg my-8 rounded-xl bg-[#18191D] border border-white/10 p-5 font-mono text-xs space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-white/10 text-xs text-zinc-400">
            <span>insecure_example.py</span>
            <span className="text-red-400 font-semibold">CWE-95 FLAG</span>
          </div>
          <div className="text-zinc-500"># Insecure dynamic evaluation</div>
          <div className="text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">
            &gt; return eval(user_input)  # ◄ FLAGGED CALL NODE
          </div>
          <div className="text-emerald-400 bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
            + return ast.literal_eval(user_input)
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
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
            <CodeSentinelLogo className="size-7 text-[#D946EF]" />
            <span className="font-semibold text-xl text-white">CodeSentinel</span>
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              Sign in to Workspace
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Access the Dashboard, vulnerability reviews, and scan telemetry.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">
                Username or Email
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="e.g. shubh.mohta or user@example.com"
                  required
                  className="agndex-input pl-10"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">
                Password
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
            </div>

            <button
              type="submit"
              disabled={loading}
              className="agndex-btn-primary w-full py-2.5 justify-center mt-2 text-xs"
            >
              {loading ? (
                <span>Handshaking Session…</span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span>Sign In</span>
                  <ArrowRight size={14} />
                </span>
              )}
            </button>
          </form>

          {/* Bottom links */}
          <div className="pt-4 border-t border-white/10 space-y-3 text-center">
            <div className="text-xs text-zinc-400">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="text-[#D946EF] hover:underline font-medium">
                Create Account →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
