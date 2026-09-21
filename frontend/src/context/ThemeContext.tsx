'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { settingsApi } from '../lib/api';

export type ThemeMode = 'light' | 'dark' | 'custom';
export type HeaderStyle = 'DEFAULT' | 'GLASS' | 'SOLID' | 'CINEMATIC';

export interface ThemeConfig {
  mode: ThemeMode;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
  headerStyle: HeaderStyle;
  stickyHeader: boolean;
  topColorBar: boolean;
  borderRadius: string;
  shadow: string;
}

export const DEFAULT_LIGHT_THEME: ThemeConfig = {
  mode: 'light',
  primaryColor: '#10b981',
  secondaryColor: '#0f172a',
  accentColor: '#06b6d4',
  backgroundColor: '#f8fafc',
  surfaceColor: '#ffffff',
  textColor: '#0f172a',
  mutedTextColor: '#64748b',
  borderColor: '#e2e8f0',
  headerStyle: 'DEFAULT',
  stickyHeader: true,
  topColorBar: false,
  borderRadius: 'md',
  shadow: 'sm',
};

export const DEFAULT_DARK_THEME: ThemeConfig = {
  mode: 'dark',
  primaryColor: '#10b981',
  secondaryColor: '#38bdf8',
  accentColor: '#a855f7',
  backgroundColor: '#090d16',
  surfaceColor: '#111827',
  textColor: '#f8fafc',
  mutedTextColor: '#94a3b8',
  borderColor: '#1f2937',
  headerStyle: 'CINEMATIC',
  stickyHeader: true,
  topColorBar: true,
  borderRadius: 'md',
  shadow: 'md',
};

interface ThemeContextType {
  theme: ThemeConfig;
  setTheme: (theme: ThemeConfig) => void;
  updateThemeField: <K extends keyof ThemeConfig>(field: K, value: ThemeConfig[K]) => void;
  setMode: (mode: ThemeMode) => void;
  saveTheme: () => Promise<void>;
  resetTheme: () => Promise<void>;
  isSaving: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeConfig>(DEFAULT_LIGHT_THEME);
  const [isSaving, setIsSaving] = useState(false);

  // Apply CSS Variables to Document
  const applyThemeToDOM = useCallback((cfg: ThemeConfig) => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;

    if (cfg.mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Dynamic CSS Custom Properties
    root.style.setProperty('--theme-primary', cfg.primaryColor);
    root.style.setProperty('--theme-secondary', cfg.secondaryColor);
    root.style.setProperty('--theme-accent', cfg.accentColor);
    root.style.setProperty('--theme-bg', cfg.backgroundColor);
    root.style.setProperty('--theme-surface', cfg.surfaceColor);
    root.style.setProperty('--theme-text', cfg.textColor);
    root.style.setProperty('--theme-muted', cfg.mutedTextColor);
    root.style.setProperty('--theme-border', cfg.borderColor);

    const radiusMap: Record<string, string> = {
      none: '0px',
      sm: '4px',
      md: '8px',
      lg: '12px',
      xl: '16px',
      '2xl': '24px',
      full: '9999px',
    };
    root.style.setProperty('--theme-radius', radiusMap[cfg.borderRadius] || '8px');
  }, []);

  // Initial Load from API
  useEffect(() => {
    settingsApi
      .getTheme()
      .then((serverTheme) => {
        if (serverTheme) {
          const merged: ThemeConfig = {
            ...DEFAULT_LIGHT_THEME,
            ...serverTheme,
          };
          setThemeState(merged);
          applyThemeToDOM(merged);
        }
      })
      .catch(() => {
        // Fallback to default
        applyThemeToDOM(DEFAULT_LIGHT_THEME);
      });
  }, [applyThemeToDOM]);

  const setTheme = (newTheme: ThemeConfig) => {
    setThemeState(newTheme);
    applyThemeToDOM(newTheme);
  };

  const updateThemeField = <K extends keyof ThemeConfig>(field: K, value: ThemeConfig[K]) => {
    setThemeState((prev) => {
      const next = { ...prev, [field]: value };
      applyThemeToDOM(next);
      return next;
    });
  };

  const setMode = (mode: ThemeMode) => {
    let next: ThemeConfig;
    if (mode === 'dark') {
      next = { ...DEFAULT_DARK_THEME, mode: 'dark' };
    } else if (mode === 'light') {
      next = { ...DEFAULT_LIGHT_THEME, mode: 'light' };
    } else {
      next = { ...theme, mode: 'custom' };
    }
    setThemeState(next);
    applyThemeToDOM(next);
  };

  const saveTheme = async () => {
    setIsSaving(true);
    try {
      await settingsApi.updateTheme(theme);
    } finally {
      setIsSaving(false);
    }
  };

  const resetTheme = async () => {
    setIsSaving(true);
    try {
      await settingsApi.resetTheme();
      setThemeState(DEFAULT_LIGHT_THEME);
      applyThemeToDOM(DEFAULT_LIGHT_THEME);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        updateThemeField,
        setMode,
        saveTheme,
        resetTheme,
        isSaving,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
