'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Send,
  Plus,
  Play,
  Pause,
  RotateCcw,
  XCircle,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  Trash2,
  FileText,
  X,
} from 'lucide-react';
import { campaignsApi, extractErrorMessage } from '../../lib/api';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Recipient / Logs Details Modal
  const [selectedCampaign, setSelectedCampaign] = useState<any | null>(null);
  const [detailsTab, setDetailsTab] = useState<'recipients' | 'logs'>('recipients');
  const [recipients, setRecipients] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const data = await campaignsApi.getAll();
      setCampaigns(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
    // Auto-poll progress every 8 seconds when window is active
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadCampaigns();
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleLaunch = async (id: string) => {
    try {
      await campaignsApi.launch(id);
      loadCampaigns();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const handlePause = async (id: string) => {
    try {
      await campaignsApi.pause(id);
      loadCampaigns();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const handleResume = async (id: string) => {
    try {
      await campaignsApi.resume(id);
      loadCampaigns();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this campaign?')) return;
    try {
      await campaignsApi.cancel(id);
      loadCampaigns();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await campaignsApi.retry(id);
      loadCampaigns();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    try {
      await campaignsApi.delete(id);
      loadCampaigns();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const handleOpenDetails = async (campaign: any) => {
    setSelectedCampaign(campaign);
    setDetailsTab('recipients');
    setLoadingDetails(true);
    try {
      const [recRes, logRes] = await Promise.all([
        campaignsApi.getRecipients(campaign._id, 1, 50),
        campaignsApi.getLogs(campaign._id),
      ]);
      setRecipients(recRes.data || []);
      setLogs(logRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Campaign Execution Engine</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Durable background broadcasting for WhatsApp and Email with multi-account rotation and limit enforcement.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadCampaigns}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 shadow-2xs transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Campaign
          </Link>
        </div>
      </div>

      {/* Campaigns Overview List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
        {loading && campaigns.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600 dark:text-emerald-400" />
            <div className="text-xs font-medium">Loading campaigns...</div>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-16 text-center">
            <Send className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">No campaigns launched yet</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Create your first audience broadcast campaign for WhatsApp or Email.
            </p>
            <Link
              href="/campaigns/new"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Campaign Wizard
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {campaigns.map((c) => {
              const percent = c.totalRecipients > 0 ? Math.round((c.sentCount / c.totalRecipients) * 100) : 0;
              return (
                <div key={c._id} className="p-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">{c.name}</h3>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                            c.channel === 'whatsapp'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                              : 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                          }`}
                        >
                          {c.channel}
                        </span>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${
                            c.status === 'completed'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
                              : c.status === 'running'
                              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60'
                              : c.status === 'paused'
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60'
                              : c.status === 'failed'
                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3">
                        <span>Recipients: <strong className="text-slate-800 dark:text-slate-200">{c.totalRecipients}</strong></span>
                        <span>• Sent: <strong className="text-emerald-700 dark:text-emerald-400">{c.sentCount}</strong></span>
                        <span>• Failed: <strong className="text-rose-700 dark:text-rose-400">{c.failedCount}</strong></span>
                        <span>• Created: {new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-2">
                      {c.status === 'draft' && (
                        <button
                          onClick={() => handleLaunch(c._id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs"
                        >
                          <Play className="w-3 h-3" />
                          Launch
                        </button>
                      )}

                      {c.status === 'running' && (
                        <button
                          onClick={() => handlePause(c._id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 shadow-2xs"
                        >
                          <Pause className="w-3 h-3" />
                          Pause
                        </button>
                      )}

                      {c.status === 'paused' && (
                        <button
                          onClick={() => handleResume(c._id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs"
                        >
                          <Play className="w-3 h-3" />
                          Resume
                        </button>
                      )}

                      {c.failedCount > 0 && (
                        <button
                          onClick={() => handleRetry(c._id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                          title="Retry failed recipients"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Retry Failed
                        </button>
                      )}

                      {(c.status === 'running' || c.status === 'queued') && (
                        <button
                          onClick={() => handleCancel(c._id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200/60 dark:border-rose-800/60"
                        >
                          <XCircle className="w-3 h-3" />
                          Cancel
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenDetails(c)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Audit Log
                      </button>

                      <button
                        onClick={() => handleDelete(c._id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                        title="Delete campaign"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Broadcast Progress</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{percent}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          c.status === 'completed'
                            ? 'bg-emerald-500'
                            : c.status === 'failed'
                            ? 'bg-rose-500'
                            : c.status === 'paused'
                            ? 'bg-amber-500'
                            : 'bg-emerald-600'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {c.errorMessage && (
                    <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs font-medium">
                      {c.errorMessage}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recipient & Logs Details Modal */}
      {selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Campaign Details: {selectedCampaign.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Channel: <strong className="capitalize text-slate-700 dark:text-slate-300">{selectedCampaign.channel}</strong> • Total Recipients: {selectedCampaign.totalRecipients}
                </p>
              </div>
              <button
                onClick={() => setSelectedCampaign(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex border-b border-slate-200 dark:border-slate-800 px-6">
              <button
                onClick={() => setDetailsTab('recipients')}
                className={`py-3 text-xs font-semibold border-b-2 mr-4 ${
                  detailsTab === 'recipients'
                    ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                Recipients List ({recipients.length})
              </button>
              <button
                onClick={() => setDetailsTab('logs')}
                className={`py-3 text-xs font-semibold border-b-2 ${
                  detailsTab === 'logs'
                    ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                Sending Audit Logs ({logs.length})
              </button>
            </div>

            <div className="p-6 max-h-96 overflow-y-auto">
              {loadingDetails ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading details...</div>
              ) : detailsTab === 'recipients' ? (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase">
                    <tr>
                      <th className="px-4 py-2">Contact</th>
                      <th className="px-4 py-2">Identifier</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {recipients.map((r) => (
                      <tr key={r._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">{r.contactId?.fullName || 'Contact'}</td>
                        <td className="px-4 py-2.5 font-mono text-slate-600 dark:text-slate-300 text-[11px]">{r.recipientIdentifier}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                              r.status === 'sent'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                                : r.status === 'failed'
                                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 text-[11px]">
                          {r.sentAt ? new Date(r.sentAt).toLocaleTimeString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase">
                    <tr>
                      <th className="px-4 py-2">Recipient</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Provider ID / Error</th>
                      <th className="px-4 py-2">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {logs.map((l) => (
                      <tr key={l._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-2.5 font-mono text-slate-700 dark:text-slate-300 text-[11px]">{l.recipient}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                              l.status === 'success'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {l.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 truncate max-w-xs text-[11px]">
                          {l.errorMessage || l.providerMessageId || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 text-[11px]">
                          {new Date(l.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-800/50">
              <button
                onClick={() => setSelectedCampaign(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
