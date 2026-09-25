'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  MessageSquare,
  Mail,
  Send,
  Kanban,
  CalendarCheck,
  Activity,
  ArrowUpRight,
  RefreshCw,
  Plus,
  FileSpreadsheet,
  DollarSign,
  UserCheck,
  Inbox,
  Sparkles,
} from 'lucide-react';
import {
  contactsApi,
  whatsappApi,
  emailApi,
  campaignsApi,
  crmApi,
} from '../../lib/api';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalContacts: 0,
    totalLeads: 0,
    pipelineValue: 0,
    pendingFollowUps: 0,
    connectedWhatsApp: 0,
    connectedEmail: 0,
    activeCampaigns: 0,
    recentCampaigns: [] as any[],
    recentActivities: [] as any[],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [cStats, waConnections, emailAccounts, campaigns, pipeline, followUps, activities] =
        await Promise.allSettled([
          contactsApi.getStats(),
          whatsappApi.getConnections(),
          emailApi.getAccounts(),
          campaignsApi.getAll(),
          crmApi.getPipelineSummary(),
          crmApi.getFollowUps('pending'),
          crmApi.getActivities(undefined, undefined, 6),
        ]);

      const totalContacts = cStats.status === 'fulfilled' ? cStats.value.totalContacts : 0;
      const connectedWhatsApp =
        waConnections.status === 'fulfilled'
          ? waConnections.value.filter((w: any) => w.status === 'connected').length
          : 0;

      const connectedEmail =
        emailAccounts.status === 'fulfilled'
          ? emailAccounts.value.filter((e: any) => e.status === 'active').length
          : 0;

      const allCampaigns = campaigns.status === 'fulfilled' ? campaigns.value : [];
      const activeCampaigns = allCampaigns.filter(
        (c: any) => c.status === 'running' || c.status === 'scheduled',
      ).length;

      const pipelineData = pipeline.status === 'fulfilled' ? pipeline.value : { totalDeals: 0, totalPipelineValue: 0 };
      const pendingFollowUps = followUps.status === 'fulfilled' ? followUps.value.length : 0;
      const recentActivities = activities.status === 'fulfilled' ? activities.value : [];

      setStats({
        totalContacts,
        totalLeads: pipelineData.totalDeals,
        pipelineValue: pipelineData.totalPipelineValue,
        pendingFollowUps,
        connectedWhatsApp,
        connectedEmail,
        activeCampaigns,
        recentCampaigns: allCampaigns.slice(0, 5),
        recentActivities,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Welcome to Imprenta CRM
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800">
              Live Real-Time
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your customer relationships, leads, campaigns, and business growth from one platform.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Launch Campaign
          </Link>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Contacts */}
        <Link
          href="/contacts"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-emerald-500/40 transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Contacts</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.totalContacts}</div>
          <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
            <span>Manage database</span>
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </Link>

        {/* CRM Pipeline Value */}
        <Link
          href="/crm/pipeline"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-emerald-500/40 transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pipeline Value</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            ${stats.pipelineValue.toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1 font-medium">
            <span>{stats.totalLeads} active leads</span>
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </Link>

        {/* WhatsApp & Email Hub */}
        <Link
          href="/whatsapp/hub"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-emerald-500/40 transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">WhatsApp Hub</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {stats.connectedWhatsApp} Connected
          </div>
          <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
            <span>Baileys Multi-Device socket</span>
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </Link>

        {/* Pending Follow-ups */}
        <Link
          href="/crm/follow-ups"
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-emerald-500/40 transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Pending Follow-ups</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.pendingFollowUps}</div>
          <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
            <span>Scheduled tasks</span>
            <ArrowUpRight className="w-3 h-3" />
          </div>
        </Link>
      </div>

      {/* Quick Launch & Inboxes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/whatsapp/inbox"
          className="p-5 rounded-2xl bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 transition-colors flex items-center justify-between"
        >
          <div>
            <div className="text-xs font-semibold text-emerald-100 uppercase tracking-wider">Unified Inbox</div>
            <div className="text-lg font-bold mt-1">WhatsApp Web Chat</div>
            <div className="text-xs text-emerald-100/80 mt-0.5">Real-time chats with tick statuses</div>
          </div>
          <Inbox className="w-8 h-8 text-emerald-200" />
        </Link>

        <Link
          href="/email/inbox"
          className="p-5 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white shadow-xs hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors flex items-center justify-between"
        >
          <div>
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Unified Mailbox</div>
            <div className="text-lg font-bold mt-1">Email Client</div>
            <div className="text-xs text-slate-400 mt-0.5">IMAP sync & SMTP sending</div>
          </div>
          <Mail className="w-8 h-8 text-slate-300" />
        </Link>

        <Link
          href="/crm/pipeline"
          className="p-5 rounded-2xl bg-indigo-600 text-white shadow-xs hover:bg-indigo-700 transition-colors flex items-center justify-between"
        >
          <div>
            <div className="text-xs font-semibold text-indigo-100 uppercase tracking-wider">CRM Kanban</div>
            <div className="text-lg font-bold mt-1">Deal Pipeline</div>
            <div className="text-xs text-indigo-100/80 mt-0.5">Drag-and-drop sales stages</div>
          </div>
          <Kanban className="w-8 h-8 text-indigo-200" />
        </Link>
      </div>

      {/* 2-Column: Recent Activities & Broadcast Campaigns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities Timeline */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Recent CRM Activities
            </h2>
            <Link
              href="/crm/activities"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              View all
            </Link>
          </div>

          {stats.recentActivities.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No recent CRM activities recorded. New interactions will appear here automatically.
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentActivities.map((act) => (
                <div
                  key={act._id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {act.type === 'whatsapp' ? (
                      <MessageSquare className="w-4 h-4" />
                    ) : act.type === 'email' ? (
                      <Mail className="w-4 h-4" />
                    ) : (
                      <UserCheck className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {act.title}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(act.performedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {act.description && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {act.description}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Campaigns Overview */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Broadcast Campaigns
            </h2>
            <Link
              href="/campaigns"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              All campaigns
            </Link>
          </div>

          {stats.recentCampaigns.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No active campaigns. Click Launch Campaign to start a broadcast.
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentCampaigns.map((camp) => (
                <div
                  key={camp._id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">{camp.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 capitalize">
                      {camp.type} • {camp.totalRecipients || 0} recipients
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                      camp.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                        : camp.status === 'running'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400 animate-pulse'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {camp.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
