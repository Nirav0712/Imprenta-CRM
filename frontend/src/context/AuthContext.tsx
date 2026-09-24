'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { setAuthToken, setTenantOrganizationId, authApi, extractErrorMessage } from '../lib/api';

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  organizationId: string;
  role: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  organizationId: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  switchOrganization: (orgId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function parseJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string>('default-org');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  const logout = useCallback(() => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('token');
      localStorage.removeItem('user_profile');
      localStorage.removeItem('organization_id');
      if (pathname !== '/login') {
        router.push('/login');
      }
    }
  }, [pathname, router]);

  // Initialize from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const storedToken = localStorage.getItem('auth_token') || localStorage.getItem('jwt_token') || localStorage.getItem('token');
      const storedOrgId = localStorage.getItem('organization_id') || 'default-org';
      const storedProfile = localStorage.getItem('user_profile');

      if (storedToken) {
        const payload = parseJwtPayload(storedToken);
        const now = Math.floor(Date.now() / 1000);

        if (payload && payload.exp && payload.exp < now) {
          console.warn('[Auth] Stored session has expired. Clearing session.');
          logout();
          setIsLoading(false);
          return;
        }

        const org = (payload?.organizationId || payload?.orgId || storedOrgId || 'default-org').trim();
        const userProfile: UserProfile = storedProfile
          ? JSON.parse(storedProfile)
          : {
              id: payload?.sub || 'user',
              email: payload?.email || 'admin@imprenta.internal',
              name: payload?.name || 'Administrator',
              organizationId: org,
              role: payload?.role || 'admin',
            };

        setAuthToken(storedToken);
        setTenantOrganizationId(org);
        setToken(storedToken);
        setUser(userProfile);
        setOrganizationId(org);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('[Auth] Error restoring session:', err);
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  const login = async (credentials: { email: string; password: string }) => {
    setIsLoading(true);
    try {
      let res: any = null;
      try {
        res = await authApi.login({
          email: credentials.email.trim(),
          password: credentials.password,
        });
      } catch (primaryErr: any) {
        // If primary call failed (e.g. 502 Vercel rewrite, 404 or network issue), try direct fetch to backend
        const fallbackUrl = isLocal
          ? 'http://localhost:4000/api/auth/login'
          : 'https://backendcrm.imprenta.in/api/auth/login';

        try {
          const fallbackFetch = await fetch(fallbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: credentials.email.trim(), password: credentials.password }),
          });
          if (fallbackFetch.ok) {
            res = await fallbackFetch.json();
          } else {
            const errData = await fallbackFetch.json().catch(() => ({}));
            throw new Error(errData.message || extractErrorMessage(primaryErr));
          }
        } catch (fallbackErr: any) {
          throw new Error(fallbackErr.message || extractErrorMessage(primaryErr));
        }
      }

      if (res && res.accessToken) {
        const receivedToken = res.accessToken;
        const payload = parseJwtPayload(receivedToken);
        const resolvedOrg = res.user?.organizationId || payload?.organizationId || 'default-org';

        const profile: UserProfile = {
          id: res.user?.id || payload?.sub || 'user',
          email: res.user?.email || credentials.email.trim(),
          name: res.user?.name || payload?.name || 'Administrator',
          organizationId: resolvedOrg,
          role: res.user?.role || payload?.role || 'admin',
        };

        setAuthToken(receivedToken);
        setTenantOrganizationId(resolvedOrg);
        setToken(receivedToken);
        setUser(profile);
        setOrganizationId(resolvedOrg);
        setIsAuthenticated(true);

        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', receivedToken);
          localStorage.setItem('organization_id', resolvedOrg);
          localStorage.setItem('user_profile', JSON.stringify(profile));
        }
      } else {
        throw new Error('Authentication failed: missing access token from server response');
      }
    } catch (err: any) {
      throw new Error(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const switchOrganization = (newOrgId: string) => {
    const trimmed = newOrgId.trim();
    if (!trimmed) return;
    setOrganizationId(trimmed);
    setTenantOrganizationId(trimmed);
    if (user) {
      const updatedUser = { ...user, organizationId: trimmed };
      setUser(updatedUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem('user_profile', JSON.stringify(updatedUser));
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        organizationId,
        isAuthenticated,
        isLoading,
        login,
        logout,
        switchOrganization,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
