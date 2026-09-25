'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Layers,
  Zap,
} from 'lucide-react';
import Image from 'next/image';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectUrl = searchParams.get('redirect') || '/contacts';

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(redirectUrl);
    }
  }, [isAuthenticated, redirectUrl, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email or username');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);

    try {
      await login({
        email: email.trim(),
        password: password,
      });

      router.replace(redirectUrl);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#070e18] text-slate-100 p-4 relative overflow-hidden select-none font-sans">
      {/* Dynamic Background Mesh & Glows */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(14,165,233,0.12),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(37,99,235,0.08),transparent_50%)]" />
      
      {/* Decorative Circuit Lines Grid Effect */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#38bdf8 1px, transparent 1px), linear-gradient(to right, #38bdf8 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      {/* Floating Ambient Light Orbs */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-cyan-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[440px] z-10 my-6">
        {/* Brand Logo Container */}
        <div className="flex flex-col items-center mb-7 text-center">
          <div className="relative group p-3.5 rounded-2xl bg-[#0c1a2e]/80 border border-cyan-500/20 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-md mb-4.5 transition-all duration-300 hover:border-cyan-500/40">
            {/* Glow behind logo */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-600/10 rounded-2xl blur-md -z-10 group-hover:blur-lg transition-all" />
            
            <img
              src="/logo.png"
              alt="The Digital Connect"
              className="h-14 md:h-16 w-auto object-contain drop-shadow-[0_4px_12px_rgba(14,165,233,0.25)]"
            />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-[11px] font-medium tracking-wide shadow-inner">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>Enterprise CRM & Marketing Suite</span>
          </div>
        </div>

        {/* Glassmorphic Login Card */}
        <div className="relative bg-[#0b1626]/90 border border-slate-800/90 hover:border-slate-700/80 rounded-3xl p-7 md:p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] backdrop-blur-2xl transition-all duration-300 ring-1 ring-white/5">
          {/* Subtle Top Gradient Line */}
          <div className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />

          {/* Form Header */}
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold tracking-tight text-white">
              Welcome Back
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Sign in to access your workspace and automated pipelines
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1 font-medium leading-relaxed">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email / Username Field */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Email or Username
              </label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-400 transition-colors pointer-events-none">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="thedigitalconnect712@gmail.com"
                  autoComplete="username"
                  required
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-[#07111e]/90 border border-slate-700/80 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-400 transition-colors pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-11 py-2.5 text-xs rounded-xl bg-[#07111e]/90 border border-slate-700/80 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-400 p-1 rounded-lg transition-colors cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 hover:from-cyan-500 hover:via-sky-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/25 hover:shadow-cyan-500/35 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Help / Admin Notice */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Protected workspace. Contact your administrator for access credentials.
            </p>
          </div>
        </div>

        {/* Trust & Enterprise Badges */}
        <div className="mt-6 flex flex-col items-center gap-2 text-center text-[11px] text-slate-400">
          <div className="flex items-center gap-2 text-cyan-400/90 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>256-Bit SSL Encrypted Multi-Tenant Architecture</span>
          </div>
          <p className="text-[10px] text-slate-400">
            © {new Date().getFullYear()} The Digital Connect • Group of Chamunda Enterprise
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-[#070e18] text-slate-100">
          <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
