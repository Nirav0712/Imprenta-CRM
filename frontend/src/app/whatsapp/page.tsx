'use client';

import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  QrCode,
  ShieldCheck,
  Plus,
  RefreshCw,
  Trash2,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ExternalLink,
  X,
} from 'lucide-react';
import { whatsappApi, extractErrorMessage } from '../../lib/api';

export default function WhatsAppHubPage() {
  const [connections, setConnections] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'official' | 'regular' | 'templates'>('official');

  // Modals
  const [isAddOfficialModalOpen, setIsAddOfficialModalOpen] = useState(false);
  const [isTestSendModalOpen, setIsTestSendModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);

  // Form states
  const [officialForm, setOfficialForm] = useState({
    name: 'Meta Cloud Official Connection',
    wabaId: '',
    phoneId: '',
    apiVersion: 'v20.0',
    accessToken: '',
    appSecret: '',
    webhookVerifyToken: 'marketing_auto_meta_verify_token_2026',
  });
  const [submittingOfficial, setSubmittingOfficial] = useState(false);
  const [officialError, setOfficialError] = useState('');

  // Regular QR state
  const [generatingQr, setGeneratingQr] = useState(false);
  const [activeQrSession, setActiveQrSession] = useState<{ id: string; qrCode: string } | null>(null);
  const [pairedSuccess, setPairedSuccess] = useState<string | null>(null);

  // Form states
  const [testSendForm, setTestSendForm] = useState({
    connectionId: '',
    recipientPhone: '',
    templateName: '',
    variables: {} as Record<string, string>,
  });
  const [sendingTest, setSendingTest] = useState(false);
  const [testSendResult, setTestSendResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [connList, tplList] = await Promise.allSettled([
        whatsappApi.getConnections(),
        whatsappApi.getTemplates(),
      ]);

      setConnections(connList.status === 'fulfilled' ? connList.value : []);
      setTemplates(tplList.status === 'fulfilled' ? tplList.value : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateOfficial = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingOfficial(true);
    setOfficialError('');

    try {
      await whatsappApi.createConnection({
        ...officialForm,
        providerType: 'official_meta',
      });
      setIsAddOfficialModalOpen(false);
      loadData();
    } catch (err) {
      setOfficialError(extractErrorMessage(err));
    } finally {
      setSubmittingOfficial(false);
    }
  };

  // Poll connection status while QR modal is open
  useEffect(() => {
    if (!activeQrSession?.id) return;

    const interval = setInterval(async () => {
      try {
        const res = await whatsappApi.getConnectionStatus(activeQrSession.id);
        if (res.status === 'connected') {
          setActiveQrSession(null);
          setPairedSuccess(`WhatsApp connected successfully! Phone: ${res.phoneNumber || 'Paired'}`);
          loadData();
          setTimeout(() => setPairedSuccess(null), 8000);
        } else if (res.qrCodeData && res.qrCodeData !== activeQrSession.qrCode) {
          setActiveQrSession((prev) => (prev ? { ...prev, qrCode: res.qrCodeData } : null));
        }
      } catch (err) {
        // ignore polling error
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeQrSession?.id, activeQrSession?.qrCode]);

  const handleCreateRegularQr = async () => {
    setGeneratingQr(true);
    try {
      const conn = await whatsappApi.createConnection({
        name: `Regular WhatsApp (${new Date().toLocaleDateString()})`,
        providerType: 'regular_qr',
      });
      // Immediately open modal with returned connection and QR
      setActiveQrSession({ id: conn._id, qrCode: conn.qrCodeData || '' });
      loadData();
    } catch (err) {
      alert(extractErrorMessage(err));
    } finally {
      setGeneratingQr(false);
    }
  };

  const handleOpenRegularQr = async (conn: any) => {
    setActiveQrSession({ id: conn._id, qrCode: conn.qrCodeData || '' });
    if (!conn.qrCodeData) {
      setGeneratingQr(true);
      try {
        const res = await whatsappApi.testConnection(conn._id);
        if (res.data?.qrCode) {
          setActiveQrSession({ id: conn._id, qrCode: res.data.qrCode });
        }
        loadData();
      } catch (err) {
        alert(extractErrorMessage(err));
      } finally {
        setGeneratingQr(false);
      }
    }
  };

  const handleRefreshQr = async () => {
    if (!activeQrSession?.id) return;
    setGeneratingQr(true);
    try {
      const res = await whatsappApi.testConnection(activeQrSession.id);
      if (res.data?.qrCode) {
        setActiveQrSession({ id: activeQrSession.id, qrCode: res.data.qrCode });
      }
      loadData();
    } catch (err) {
      alert(extractErrorMessage(err));
    } finally {
      setGeneratingQr(false);
    }
  };

  const handleSyncTemplates = async (id: string) => {
    try {
      await whatsappApi.syncTemplates(id);
      loadData();
      alert('Templates synced successfully from Meta Business API');
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const handleDeleteConnection = async (id: string) => {
    if (!confirm('Are you sure you want to remove this WhatsApp connection?')) return;
    try {
      await whatsappApi.deleteConnection(id);
      loadData();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const handleOpenTestSend = (tpl: any) => {
    setSelectedTemplate(tpl);
    const initialVars: Record<string, string> = {};
    (tpl.variables || []).forEach((v: string) => {
      initialVars[v] = '';
    });
    setTestSendForm({
      connectionId: tpl.connectionId,
      recipientPhone: '',
      templateName: tpl.name,
      variables: initialVars,
    });
    setTestSendResult(null);
    setIsTestSendModalOpen(true);
  };

  const handleExecuteTestSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingTest(true);
    setTestSendResult(null);

    try {
      const res = await whatsappApi.sendMessage({
        connectionId: testSendForm.connectionId,
        recipientPhoneNumber: testSendForm.recipientPhone,
        templateName: testSendForm.templateName,
        templateVariables: testSendForm.variables,
      });

      if (res.status === 'failed') {
        setTestSendResult({ success: false, message: res.errorMessage || 'Send failed' });
      } else {
        setTestSendResult({ success: true, message: `Message sent successfully! Provider ID: ${res.providerMessageId}` });
      }
    } catch (err) {
      setTestSendResult({ success: false, message: extractErrorMessage(err) });
    } finally {
      setSendingTest(false);
    }
  };

  const officialConnections = connections.filter((c) => c.providerType === 'official_meta');
  const regularConnections = connections.filter((c) => c.providerType === 'regular_qr');

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">WhatsApp Hub</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure official Meta Cloud Business API connections, manage templates, and connect regular WhatsApp QR sessions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddOfficialModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Official Meta API
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('official')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'official'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Official Meta API ({officialConnections.length})
        </button>
        <button
          onClick={() => setActiveTab('regular')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'regular'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Regular WhatsApp QR ({regularConnections.length})
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'templates'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Approved Templates ({templates.length})
        </button>
      </div>

      {/* TAB 1: OFFICIAL META CONNECTIONS */}
      {activeTab === 'official' && (
        <div className="space-y-6">
          {officialConnections.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
              <ShieldCheck className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900">No Official Meta Connection Configured</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Connect your Meta WhatsApp Business Platform credentials (WABA ID, Phone ID, Access Token) to send pre-approved template messages.
              </p>
              <button
                onClick={() => setIsAddOfficialModalOpen(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Configure Meta Connection
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {officialConnections.map((conn) => (
                <div
                  key={conn._id}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{conn.name}</span>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                            conn.status === 'connected'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                          }`}
                        >
                          {conn.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 font-mono">
                        Phone: {conn.phoneNumber || 'Not synced'}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteConnection(conn._id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete connection"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px] font-semibold uppercase">WABA ID</span>
                      <span className="font-mono text-slate-700 text-[11px] truncate block">{conn.wabaId}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-semibold uppercase">Phone ID</span>
                      <span className="font-mono text-slate-700 text-[11px] truncate block">{conn.phoneId}</span>
                    </div>
                  </div>

                  {conn.errorMessage && (
                    <div className="p-2 rounded bg-rose-50 text-rose-700 text-xs font-medium">
                      {conn.errorMessage}
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      onClick={() => handleSyncTemplates(conn._id)}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Sync Templates
                    </button>

                    <span className="text-[11px] text-slate-400">
                      API: {conn.apiVersion || 'v20.0'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: REGULAR WHATSAPP QR CONNECTIONS */}
      {activeTab === 'regular' && (
        <div className="space-y-6">
          <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <strong className="font-semibold">Independent QR Connection Adapter:</strong> Regular WhatsApp runs in an isolated socket session and does not use the official Meta Business Platform. Rate limits and safety throttles are enforced.
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleCreateRegularQr}
              disabled={generatingQr}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <QrCode className="w-3.5 h-3.5" />
              {generatingQr ? 'Generating QR Code...' : 'Generate New QR Code'}
            </button>
          </div>

          {/* Modal Overlay for Active QR Session */}
          {activeQrSession && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl animate-in zoom-in-95">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-semibold text-emerald-700">
                      {activeQrSession.qrCode ? 'Ready to Scan' : 'Connecting Baileys Socket...'}
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveQrSession(null)}
                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900">Scan QR Code with WhatsApp</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    Open WhatsApp on your phone &gt; <strong>Linked Devices</strong> &gt; <strong>Link a Device</strong>.
                  </p>
                </div>

                <div className="p-4 bg-white border border-slate-200 rounded-2xl inline-block shadow-sm min-w-[280px] min-h-[280px] flex items-center justify-center">
                  {activeQrSession.qrCode ? (
                    <img
                      src={activeQrSession.qrCode}
                      alt="WhatsApp QR Code"
                      className="w-64 h-64 mx-auto object-contain rounded-lg"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 p-8">
                      <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
                      <p className="text-xs text-slate-500 font-medium">Connecting to WhatsApp Multi-Device...</p>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-slate-400">
                  Status updates automatically in real time upon scanning.
                </p>

                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={handleRefreshQr}
                    disabled={generatingQr}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 shadow-2xs transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${generatingQr ? 'animate-spin' : ''}`} />
                    Refresh QR
                  </button>
                  <button
                    onClick={() => setActiveQrSession(null)}
                    className="px-5 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Regular Connections List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {regularConnections.map((conn) => (
              <div
                key={conn._id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{conn.name}</span>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                          conn.status === 'connected'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : conn.status === 'qr_ready'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {conn.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 font-mono">
                      Phone: {conn.phoneNumber || 'Not paired'}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteConnection(conn._id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete connection"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
                  <span>Linked: {conn.lastSeen ? new Date(conn.lastSeen).toLocaleDateString() : 'Never'}</span>
                  {conn.status !== 'connected' ? (
                    <button
                      onClick={() => handleOpenRegularQr(conn)}
                      disabled={generatingQr}
                      className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      View QR / Connect
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Active
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: TEMPLATES CATALOG */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          {templates.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
              <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900">No Templates Synchronized</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Sync templates from your Meta Business Platform connection to browse approved message formats.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {templates.map((tpl) => {
                const bodyComp = tpl.components?.find((c: any) => c.type === 'BODY');
                return (
                  <div
                    key={tpl._id}
                    className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900 truncate">{tpl.name}</span>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                            tpl.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                          }`}
                        >
                          {tpl.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-wide">
                        {tpl.category} • {tpl.language}
                      </div>

                      <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-700 leading-relaxed font-sans">
                        {bodyComp?.text || '(No body text)'}
                      </div>

                      {tpl.variables && tpl.variables.length > 0 && (
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase">Variables:</span>
                          {tpl.variables.map((v: string) => (
                            <span
                              key={v}
                              className="px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-800 text-[10px] font-mono"
                            >
                              &#123;&#123;{v}&#125;&#125;
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                      <button
                        onClick={() => handleOpenTestSend(tpl)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                      >
                        <Send className="w-3 h-3" />
                        Test Send
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Official Meta Connection Modal */}
      {isAddOfficialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Add Meta WhatsApp Business Connection</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Credentials are encrypted securely via AES-256-GCM.
                </p>
              </div>
              <button
                onClick={() => setIsAddOfficialModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOfficial} className="p-6 space-y-4">
              {officialError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                  {officialError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Connection Name</label>
                <input
                  type="text"
                  required
                  value={officialForm.name}
                  onChange={(e) => setOfficialForm({ ...officialForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  placeholder="Primary Business Line"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">WABA Account ID</label>
                  <input
                    type="text"
                    required
                    value={officialForm.wabaId}
                    onChange={(e) => setOfficialForm({ ...officialForm, wabaId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none font-mono"
                    placeholder="109238472910394"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number ID</label>
                  <input
                    type="text"
                    required
                    value={officialForm.phoneId}
                    onChange={(e) => setOfficialForm({ ...officialForm, phoneId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none font-mono"
                    placeholder="102938475619283"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">System User Access Token</label>
                <input
                  type="password"
                  required
                  value={officialForm.accessToken}
                  onChange={(e) => setOfficialForm({ ...officialForm, accessToken: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none font-mono"
                  placeholder="EAABw..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">App Secret (HMAC Verification)</label>
                  <input
                    type="password"
                    value={officialForm.appSecret}
                    onChange={(e) => setOfficialForm({ ...officialForm, appSecret: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none font-mono"
                    placeholder="Optional for signature check"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Webhook Verify Token</label>
                  <input
                    type="text"
                    value={officialForm.webhookVerifyToken}
                    onChange={(e) => setOfficialForm({ ...officialForm, webhookVerifyToken: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddOfficialModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOfficial}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {submittingOfficial ? 'Validating Connection...' : 'Save & Verify Connection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Send Template Modal */}
      {isTestSendModalOpen && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Test Send Template</h3>
                <p className="text-xs text-slate-500 mt-0.5">Template: {selectedTemplate.name}</p>
              </div>
              <button
                onClick={() => setIsTestSendModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteTestSend} className="p-6 space-y-4">
              {testSendResult && (
                <div
                  className={`p-3 rounded-lg text-xs font-medium ${
                    testSendResult.success
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                      : 'bg-rose-50 border border-rose-200 text-rose-700'
                  }`}
                >
                  {testSendResult.message}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Recipient Phone Number</label>
                <input
                  type="text"
                  required
                  value={testSendForm.recipientPhone}
                  onChange={(e) => setTestSendForm({ ...testSendForm, recipientPhone: e.target.value })}
                  placeholder="+15551234567"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none font-mono"
                />
              </div>

              {(selectedTemplate.variables || []).map((vNum: string) => (
                <div key={vNum}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Variable &#123;&#123;{vNum}&#125;&#125;
                  </label>
                  <input
                    type="text"
                    required
                    value={testSendForm.variables[vNum] || ''}
                    onChange={(e) =>
                      setTestSendForm({
                        ...testSendForm,
                        variables: { ...testSendForm.variables, [vNum]: e.target.value },
                      })
                    }
                    placeholder={`Value for parameter ${vNum}`}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              ))}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsTestSendModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingTest}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {sendingTest ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
