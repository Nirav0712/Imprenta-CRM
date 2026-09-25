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
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-100 p-4 relative overflow-hidden select-none font-sans">
      {/* Dynamic Background Mesh & Glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Grid Pattern Effect */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#f97316 1px, transparent 1px), linear-gradient(to right, #f97316 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      <div className="w-full max-w-md z-10 my-6">
        {/* Brand Logo Container */}
        <div className="flex flex-col items-center mb-7 text-center">
          <div className="relative group p-3 rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.4)] mb-4 transition-all duration-300 hover:scale-105">
            <img
              src="/logo.png"
              alt="Imprenta CRM"
              className="h-16 w-16 object-contain"
            />
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Imprenta <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">CRM</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Smart CRM & Marketing Automation Platform</p>
        </div>

        {/* Card Container */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-7 shadow-2xl backdrop-blur-xl">
          {/* Error Alert */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1 font-medium leading-relaxed">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email / Username Field */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email or Username
              </label>
              <div className="relative group">
                <Mail className="w-4 h-4 text-slate-500 group-focus-within:text-orange-400 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@imprenta.in"
                  autoComplete="username"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/60 transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Password
                </label>
              </div>
              <div className="relative group">
                <Lock className="w-4 h-4 text-slate-500 group-focus-within:text-orange-400 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/60 transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 rounded transition-colors"
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
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:via-amber-600 hover:to-orange-700 text-white text-xs font-semibold shadow-lg shadow-orange-500/25 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Imprenta CRM</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-800/80 text-center">
            <p className="text-[11px] text-slate-500">
              Need access or forgot your password? Contact your workspace administrator.
            </p>
          </div>
        </div>

        {/* Security badge */}
        <div className="mt-6 flex items-center justify-center gap-2 text-slate-400 text-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-orange-400" />
          <span>Encrypted Multi-Tenant Authentication • Imprenta CRM</span>
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
