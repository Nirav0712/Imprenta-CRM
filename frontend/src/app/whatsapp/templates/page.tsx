'use client';

import React, { useEffect, useState } from 'react';
import {
  FileCode,
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Sparkles,
  MessageSquare,
  Send,
  Copy,
  Zap,
  ShieldCheck,
  QrCode,
} from 'lucide-react';
import { whatsappApi, extractErrorMessage } from '../../../lib/api';

interface QuickSnippet {
  id: string;
  name: string;
  category: string;
  bodyText: string;
  variables: string[];
}

const DEFAULT_REGULAR_SNIPPETS: QuickSnippet[] = [
  {
    id: 'snip_1',
    name: 'Order Confirmation & Receipt',
    category: 'TRANSACTIONAL',
    bodyText: 'Hello {{name}}, thank you for your order! Your booking ID is {{order_id}}. We are preparing your shipment and will update you shortly.',
    variables: ['name', 'order_id'],
  },
  {
    id: 'snip_2',
    name: 'Appointment Reminder',
    category: 'UTILITY',
    bodyText: 'Hi {{name}}, this is a friendly reminder for your scheduled appointment on {{date}} at {{time}}. Please reply YES to confirm.',
    variables: ['name', 'date', 'time'],
  },
  {
    id: 'snip_3',
    name: 'Special Festive Offer',
    category: 'MARKETING',
    bodyText: 'Exciting news {{name}}! Get an exclusive 25% discount on all our premium services this week with code FESTIVE25. Visit our store to claim!',
    variables: ['name'],
  },
  {
    id: 'snip_4',
    name: 'Customer Support Welcome',
    category: 'SUPPORT',
    bodyText: 'Hi {{name}}, welcome to our VIP support channel. How can our team assist you today?',
    variables: ['name'],
  },
];

export default function WhatsAppTemplatesPage() {
  const [activeTab, setActiveTab] = useState<'official' | 'regular'>('official');
  const [templates, setTemplates] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);

  // Regular snippets state
  const [snippets, setSnippets] = useState<QuickSnippet[]>(DEFAULT_REGULAR_SNIPPETS);
  const [selectedSnippet, setSelectedSnippet] = useState<QuickSnippet | null>(DEFAULT_REGULAR_SNIPPETS[0]);

  const loadData = async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const [conns, tmpls] = await Promise.all([
        whatsappApi.getConnections(),
        whatsappApi.getTemplates(selectedConnectionId || undefined),
      ]);
      setConnections(conns || []);
      setTemplates(tmpls || []);

      if (tmpls && tmpls.length > 0 && !selectedTemplate) {
        setSelectedTemplate(tmpls[0]);
      }
    } catch (err) {
      setErrorBanner(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedConnectionId]);

  const handleSync = async () => {
    const metaConn = connections.find((c) => c._id === selectedConnectionId && c.providerType === 'official_meta')
      || connections.find((c) => c.providerType === 'official_meta');

    if (!metaConn) {
      alert('Please select or configure an Official Meta Cloud API connection to sync templates.');
      return;
    }

    setSyncing(true);
    try {
      await whatsappApi.syncTemplates(metaConn._id);
      setSuccessToast('Templates synced successfully from Meta Business Manager!');
      loadData();
    } catch (err) {
      alert(`Template sync failed: ${extractErrorMessage(err)}`);
    } finally {
      setSyncing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccessToast('Copied to clipboard!');
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const officialConnections = connections.filter((c) => c.providerType === 'official_meta');
  const regularConnections = connections.filter((c) => c.providerType === 'regular_qr');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            WhatsApp Template Center
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              Provider Separated
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage pre-approved Meta Cloud API templates and regular WhatsApp reusable message snippets.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={selectedConnectionId}
            onChange={(e) => setSelectedConnectionId(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
          >
            <option value="">All WhatsApp Accounts</option>
            {connections.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} ({c.providerType === 'official_meta' ? 'Meta Official' : 'Regular QR'})
              </option>
            ))}
          </select>

          {activeTab === 'official' && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
              title="Sync official templates from Meta WABA"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              Sync from Meta
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('official')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'official'
              ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          Official Meta Cloud API Templates ({templates.length})
        </button>
        <button
          onClick={() => setActiveTab('regular')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'regular'
              ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <QrCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          Regular WhatsApp Quick Snippets ({snippets.length})
        </button>
      </div>

      {errorBanner && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {successToast && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in">
          <Sparkles className="w-4 h-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {/* TAB 1: OFFICIAL META CLOUD TEMPLATES */}
      {activeTab === 'official' && (
        <div className="space-y-4">
          <div className="bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Meta WhatsApp Business Platform Rules:</strong> Official Cloud API templates must be pre-approved by Meta before broadcasting. Variables use numbered tokens like <code className="bg-emerald-100 dark:bg-emerald-900 px-1 py-0.5 rounded font-mono">{'{{1}}'}</code>, <code className="bg-emerald-100 dark:bg-emerald-900 px-1 py-0.5 rounded font-mono">{'{{2}}'}</code>.
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              {loading ? (
                <div className="p-12 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600 dark:text-emerald-400" />
                  Loading approved templates...
                </div>
              ) : templates.length === 0 ? (
                <div className="p-12 text-center space-y-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <FileCode className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">No Meta Templates Found</div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Click <strong>Sync from Meta</strong> to import pre-approved templates from your Meta WhatsApp Business Manager.
                  </p>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-2xs transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    Sync Templates Now
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {templates.map((tmpl) => (
                    <div
                      key={tmpl._id}
                      onClick={() => setSelectedTemplate(tmpl)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        selectedTemplate?._id === tmpl._id
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/40 border-emerald-500 shadow-sm'
                          : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {tmpl.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            tmpl.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                              : tmpl.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                          }`}
                        >
                          {tmpl.status || 'APPROVED'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                        Category: <span className="font-medium text-slate-700 dark:text-slate-300">{tmpl.category || 'MARKETING'}</span> • Lang: <span className="font-medium text-slate-700 dark:text-slate-300">{tmpl.language || 'en_US'}</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 font-sans">
                        {tmpl.bodyText || tmpl.components?.find((c: any) => c.type === 'BODY')?.text || '[Template content]'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Template Live Preview Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4 h-fit sticky top-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Meta Template Simulator
              </h2>

              {selectedTemplate ? (
                <div className="space-y-3">
                  <div className="bg-[#efeae2]/40 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
                      WhatsApp Bubble Preview
                    </div>
                    <div className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white p-3.5 rounded-2xl rounded-tl-none text-xs leading-relaxed shadow-2xs">
                      {selectedTemplate.bodyText ||
                        selectedTemplate.components?.find((c: any) => c.type === 'BODY')?.text ||
                        'Preview template content with variables like {{1}}, {{2}}'}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400 dark:text-slate-500">Template ID / Name:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedTemplate.name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400 dark:text-slate-500">Category:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedTemplate.category || 'MARKETING'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400 dark:text-slate-500">Language:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedTemplate.language || 'en_US'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      copyToClipboard(
                        selectedTemplate.bodyText ||
                          selectedTemplate.components?.find((c: any) => c.type === 'BODY')?.text ||
                          selectedTemplate.name,
                      )
                    }
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Template Text
                  </button>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">
                  Select a template on the left to preview its content and variables.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REGULAR WHATSAPP SNIPPETS */}
      {activeTab === 'regular' && (
        <div className="space-y-4">
          <div className="bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/60 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-200">
            <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Regular WhatsApp Snippets:</strong> These quick replies & broadcast templates execute immediately over your linked WhatsApp Baileys connection without Meta approval delay. Named tokens like <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded font-mono">{'{{name}}'}</code>, <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded font-mono">{'{{company}}'}</code> are auto-merged from your contact list.
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {snippets.map((snip) => (
                  <div
                    key={snip.id}
                    onClick={() => setSelectedSnippet(snip)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      selectedSnippet?.id === snip.id
                        ? 'bg-blue-50/50 dark:bg-blue-950/40 border-blue-500 shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {snip.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-400 uppercase">
                        {snip.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 font-sans">
                      {snip.bodyText}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Snippet Live Preview */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4 h-fit sticky top-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Regular Snippet Simulator
              </h2>

              {selectedSnippet ? (
                <div className="space-y-3">
                  <div className="bg-[#efeae2]/40 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="text-[10px] font-bold text-blue-800 dark:text-blue-400 uppercase tracking-wider">
                      Live Chat Preview
                    </div>
                    <div className="bg-emerald-600 text-white p-3.5 rounded-2xl rounded-tr-none text-xs leading-relaxed shadow-2xs">
                      {selectedSnippet.bodyText}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400 dark:text-slate-500">Snippet Name:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{selectedSnippet.name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400 dark:text-slate-500">Variables:</span>
                      <div className="flex gap-1 flex-wrap">
                        {selectedSnippet.variables.map((v) => (
                          <span key={v} className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[10px] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => copyToClipboard(selectedSnippet.bodyText)}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-2xs transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy Snippet
                  </button>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">
                  Select a snippet to preview.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
