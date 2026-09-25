'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  MessageSquare,
  Mail,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Inbox,
  Send,
  FileCode,
  UserCheck,
  Kanban,
  CalendarCheck,
  Activity,
  Compass,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface NavChild {
  label: string;
  href: string;
  icon: any;
  badge?: string;
}

interface NavParent {
  label: string;
  icon: any;
  href?: string;
  children?: NavChild[];
}

const NAVIGATION: NavParent[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Contacts',
    href: '/contacts',
    icon: Users,
  },
  {
    label: 'Import Data',
    href: '/import-data',
    icon: FileSpreadsheet,
  },
  {
    label: 'WhatsApp',
    icon: MessageSquare,
    children: [
      { label: 'WhatsApp Hub', href: '/whatsapp/hub', icon: MessageSquare },
      { label: 'WhatsApp Inbox', href: '/whatsapp/inbox', icon: Inbox },
      { label: 'WhatsApp Campaigns', href: '/whatsapp/campaigns', icon: Send },
      { label: 'WhatsApp Templates', href: '/whatsapp/templates', icon: FileCode },
    ],
  },
  {
    label: 'Email',
    icon: Mail,
    children: [
      { label: 'Email Hub', href: '/email/hub', icon: Mail },
      { label: 'Email Inbox', href: '/email/inbox', icon: Inbox },
      { label: 'Email Campaigns', href: '/email/campaigns', icon: Send },
      { label: 'Email Templates', href: '/email/templates', icon: FileCode },
    ],
  },
  {
    label: 'CRM',
    icon: UserCheck,
    children: [
      { label: 'Leads', href: '/crm/leads', icon: Users },
      { label: 'Pipeline', href: '/crm/pipeline', icon: Kanban },
      { label: 'Follow-ups', href: '/crm/follow-ups', icon: CalendarCheck },
      { label: 'Activities', href: '/crm/activities', icon: Activity },
      { label: 'Lead Sources', href: '/crm/sources', icon: Compass },
    ],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: SlidersHorizontal,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({
    WhatsApp: true,
    Email: true,
    CRM: true,
  });

  // Auto-expand parent if current route matches child
  useEffect(() => {
    NAVIGATION.forEach((item) => {
      if (item.children) {
        const hasActiveChild = item.children.some(
          (c) =>
            pathname === c.href ||
            (c.href === '/whatsapp/inbox' && pathname === '/inbox/whatsapp') ||
            (c.href === '/email/inbox' && pathname === '/inbox/email') ||
            (c.href === '/whatsapp/hub' && pathname === '/whatsapp') ||
            (c.href === '/email/hub' && pathname === '/email'),
        );
        if (hasActiveChild) {
          setExpandedParents((prev) => ({ ...prev, [item.label]: true }));
        }
      }
    });
  }, [pathname]);

  const toggleParent = (label: string) => {
    setExpandedParents((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  const isRouteActive = (href?: string) => {
    if (!href) return false;
    if (href === '/dashboard') return pathname === '/' || pathname === '/dashboard';
    if (href === '/contacts') return pathname === '/contacts';
    if (href === '/import-data') return pathname === '/import-data' || pathname === '/contacts/import';
    if (href === '/whatsapp/hub') return pathname === '/whatsapp/hub' || pathname === '/whatsapp';
    if (href === '/whatsapp/inbox') return pathname === '/whatsapp/inbox' || pathname === '/inbox/whatsapp';
    if (href === '/email/hub') return pathname === '/email/hub' || pathname === '/email';
    if (href === '/email/inbox') return pathname === '/email/inbox' || pathname === '/inbox/email';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <aside
      className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col flex-shrink-0 transition-all duration-300 z-30 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-slate-900/80 dark:bg-slate-800 border border-slate-700/60 flex items-center justify-center p-1 shadow-sm flex-shrink-0 overflow-hidden">
            <img src="/logo.png" alt="TDC" className="w-full h-full object-contain" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-bold text-slate-900 dark:text-white text-xs tracking-tight truncate">
                The Digital Connect
              </div>
              <div className="text-[9px] font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider truncate">
                GROUP OF CHAMUNDA ENT.
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {NAVIGATION.map((item) => {
          const Icon = item.icon;

          if (item.children) {
            const isParentExpanded = expandedParents[item.label] ?? true;
            const hasActiveChild = item.children.some((c) => isRouteActive(c.href));

            if (collapsed) {
              return (
                <div key={item.label} className="relative group py-1">
                  <button
                    onClick={() => setCollapsed(false)}
                    className={`w-full flex items-center justify-center p-2.5 rounded-xl transition-all ${
                      hasActiveChild
                        ? 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-400 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                    title={item.label}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                </div>
              );
            }

            return (
              <div key={item.label} className="space-y-0.5 pt-2">
                <button
                  onClick={() => toggleParent(item.label)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                    hasActiveChild
                      ? 'text-cyan-700 dark:text-cyan-400'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {isParentExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>

                {isParentExpanded && (
                  <div className="pl-3 space-y-0.5 border-l border-slate-200/80 dark:border-slate-800 ml-4 my-1">
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      const active = isRouteActive(child.href);

                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            active
                              ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 font-semibold shadow-2xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <ChildIcon
                              className={`w-3.5 h-3.5 flex-shrink-0 ${
                                active ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'
                              }`}
                            />
                            <span className="truncate">{child.label}</span>
                          </div>
                          {child.badge && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300">
                              {child.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // Top Level Single Link
          const active = isRouteActive(item.href);

          return (
            <Link
              key={item.label}
              href={item.href || '#'}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 font-semibold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              } ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={`w-4 h-4 flex-shrink-0 ${
                  active ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'
                }`}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer Status Widget */}
      {!collapsed && (
        <div className="p-3 border-t border-slate-100 dark:border-slate-800">
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-2.5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  Durable Engine
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">v4.0</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
              Multi-Device WhatsApp & SMTP/IMAP active on :4000
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
