'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, Loader2 } from 'lucide-react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublicRoute = pathname === '/login';

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isPublicRoute) {
      const returnUrl = encodeURIComponent(pathname);
      router.replace(`/login?redirect=${returnUrl}`);
    }
  }, [isLoading, isAuthenticated, isPublicRoute, pathname, router]);

  // If on login page, allow rendering directly
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // If loading session state, show loading spinner
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <ShieldCheck className="w-7 h-7 animate-pulse" />
            <Loader2 className="w-14 h-14 absolute animate-spin text-emerald-500/30" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-slate-200">The Digital Connect CRM</h3>
            <p className="text-xs text-slate-500 mt-0.5">Verifying secure tenant session...</p>
          </div>
        </div>
      </div>
    );
  }

  // If not authenticated, block protected content while redirecting
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
