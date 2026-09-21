'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Send,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Pause,
  Play,
  XCircle,
  BarChart3,
  Users,
} from 'lucide-react';
import { campaignsApi, extractErrorMessage } from '../../../lib/api';

export default function WhatsAppCampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const loadCampaigns = async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const data = await campaignsApi.getAll({ type: 'whatsapp' });
      setCampaigns(data || []);
    } catch (err) {
      setErrorBanner(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const handleStart = async (id: string) => {
    try {
      await campaignsApi.start(id);
      loadCampaigns();
    } catch (err) {
      alert(`Failed to start campaign: ${extractErrorMessage(err)}`);
    }
  };

  const handlePause = async (id: string) => {
    try {
      await campaignsApi.pause(id);
      loadCampaigns();
    } catch (err) {
      alert(`Failed to pause campaign: ${extractErrorMessage(err)}`);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this campaign?')) return;
    try {
      await campaignsApi.cancel(id);
      loadCampaigns();
    } catch (err) {
      alert(`Failed to cancel campaign: ${extractErrorMessage(err)}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            WhatsApp Campaigns
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              Bulk Broadcasts
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create, schedule, and track WhatsApp broadcasts across segmented customer lists.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadCampaigns}
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
            New WhatsApp Campaign
          </Link>
        </div>
      </div>

      {errorBanner && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* Campaigns Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading WhatsApp campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <Send className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">No WhatsApp Campaigns Found</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Launch targeted broadcast messages with dynamic variables, personalized names, and tracking.
            </p>
            <Link
              href="/campaigns/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create First Campaign
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {campaigns.map((camp) => (
              <div key={camp._id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">{camp.name}</h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                        camp.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                          : camp.status === 'running'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400 animate-pulse'
                          : camp.status === 'paused'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {camp.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Created on {new Date(camp.createdAt).toLocaleDateString()} • {camp.totalRecipients || 0} Total Recipients
                  </p>
                </div>

                {/* Metrics */}
                <div className="flex items-center gap-6 text-xs font-medium">
                  <div className="text-center">
                    <div className="text-slate-400 text-[10px] uppercase">Sent</div>
                    <div className="text-emerald-600 dark:text-emerald-400 font-bold">{camp.sentCount || 0}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-400 text-[10px] uppercase">Delivered</div>
                    <div className="text-blue-600 dark:text-blue-400 font-bold">{camp.deliveredCount || 0}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-slate-400 text-[10px] uppercase">Failed</div>
                    <div className="text-rose-600 dark:text-rose-400 font-bold">{camp.failedCount || 0}</div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 ml-2">
                    {camp.status === 'draft' || camp.status === 'paused' ? (
                      <button
                        onClick={() => handleStart(camp._id)}
                        className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                        title="Start Broadcast"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    ) : camp.status === 'running' ? (
                      <button
                        onClick={() => handlePause(camp._id)}
                        className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition-colors"
                        title="Pause Broadcast"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    ) : null}

                    {camp.status !== 'completed' && camp.status !== 'cancelled' && (
                      <button
                        onClick={() => handleCancel(camp._id)}
                        className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 hover:bg-rose-100 transition-colors"
                        title="Cancel Broadcast"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
