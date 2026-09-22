'use client';

import React, { useEffect, useState } from 'react';
import {
  Mail,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Inbox,
  ShieldCheck,
  X,
} from 'lucide-react';
import { emailApi, extractErrorMessage } from '../../lib/api';

export default function EmailAccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any | null>(null);

  // Form State
  const [form, setForm] = useState({
    name: 'Primary Outbound Mailbox',
    emailAddress: '',
    provider: 'smtp_imap',
    senderName: '',
    passwordOrToken: '',
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    imapHost: '',
    imapPort: 993,
    imapSecure: true,
    hourlyLimit: 50,
    dailyLimit: 500,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Action states
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const data = await emailApi.getAccounts();
      setAccounts(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleProviderSelect = (provider: string) => {
    let smtpHost = form.smtpHost;
    let smtpPort = form.smtpPort;
    let imapHost = form.imapHost;
    let imapPort = form.imapPort;

    if (provider === 'gmail') {
      smtpHost = 'smtp.gmail.com';
      smtpPort = 587;
      imapHost = 'imap.gmail.com';
      imapPort = 993;
    } else if (provider === 'outlook') {
      smtpHost = 'smtp.office365.com';
      smtpPort = 587;
      imapHost = 'outlook.office365.com';
      imapPort = 993;
    } else if (provider === 'zoho') {
      smtpHost = 'smtp.zoho.com';
      smtpPort = 587;
      imapHost = 'imap.zoho.com';
      imapPort = 993;
    }

    setForm({
      ...form,
      provider,
      smtpHost,
      smtpPort,
      imapHost,
      imapPort,
    });
  };

  const handleOpenAdd = () => {
    setEditingAccount(null);
    setForm({
      name: 'Primary Outbound Mailbox',
      emailAddress: '',
      provider: 'smtp_imap',
      senderName: '',
      passwordOrToken: '',
      smtpHost: '',
      smtpPort: 587,
      smtpSecure: false,
      imapHost: '',
      imapPort: 993,
      imapSecure: true,
      hourlyLimit: 50,
      dailyLimit: 500,
    });
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (acc: any) => {
    setEditingAccount(acc);
    setForm({
      name: acc.name,
      emailAddress: acc.emailAddress,
      provider: acc.provider,
      senderName: acc.senderName,
      passwordOrToken: '', // Keep empty unless updating password
      smtpHost: acc.smtpHost,
      smtpPort: acc.smtpPort,
      smtpSecure: acc.smtpSecure,
      imapHost: acc.imapHost || '',
      imapPort: acc.imapPort || 993,
      imapSecure: acc.imapSecure !== false,
      hourlyLimit: acc.hourlyLimit || 50,
      dailyLimit: acc.dailyLimit || 500,
    });
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    try {
      if (editingAccount) {
        await emailApi.updateAccount(editingAccount._id, form);
      } else {
        await emailApi.createAccount(form);
      }
      setIsAddModalOpen(false);
      loadAccounts();
    } catch (err) {
      setFormError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    try {
      const res = await emailApi.testConnection(id);
      alert(res.message);
      loadAccounts();
    } catch (err) {
      alert(extractErrorMessage(err));
    } finally {
      setTestingId(null);
    }
  };

  const handleSyncInbox = async (id: string) => {
    setSyncingId(id);
    try {
      const res = await emailApi.syncInbox(id);
      alert(res.message);
      loadAccounts();
    } catch (err) {
      alert(extractErrorMessage(err));
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this email account?')) return;
    try {
      await emailApi.deleteAccount(id);
      loadAccounts();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Email Account Senders
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              SMTP / IMAP
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Connect and rotate multiple SMTP / IMAP email accounts with policy-aware daily and hourly limits.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Email Account
        </button>
      </div>

      {/* Account Cards */}
      {loading ? (
        <div className="p-16 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600 dark:text-emerald-400" />
          <div className="text-xs font-medium">Loading email accounts...</div>
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center shadow-2xs">
          <Mail className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">No Email Accounts Connected</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Add Gmail, Outlook, Zoho, or Custom SMTP email accounts to enable high-deliverability rotated email campaigns.
          </p>
          <button
            onClick={handleOpenAdd}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Connect First Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {accounts.map((acc) => {
            const dailyPercent = Math.min(
              100,
              Math.round(((acc.sentTodayCount || 0) / (acc.dailyLimit || 500)) * 100),
            );

            return (
              <div
                key={acc._id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-2xs flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{acc.name}</span>
                        {/* SMTP Status Badge */}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            acc.smtpStatus === 'connected' || acc.status === 'active'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200/60 dark:border-rose-800'
                          }`}
                        >
                          SMTP: {acc.smtpStatus === 'connected' || acc.status === 'active' ? 'Connected' : 'Failed'}
                        </span>

                        {/* IMAP Status Badge */}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            acc.imapStatus === 'connected'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800'
                              : acc.imapStatus === 'disabled_by_provider'
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                              : acc.imapStatus === 'not_configured'
                              ? 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200/60 dark:border-rose-800'
                          }`}
                        >
                          IMAP: {
                            acc.imapStatus === 'connected'
                              ? 'Connected'
                              : acc.imapStatus === 'disabled_by_provider'
                              ? 'Disabled by Provider'
                              : acc.imapStatus === 'not_configured'
                              ? 'Off'
                              : 'Sync Error'
                          }
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 font-mono mt-1">{acc.emailAddress}</div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        Sender: {acc.senderName} ({acc.provider.toUpperCase()})
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(acc)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Edit account"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(acc._id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="Delete account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Quota & Limits Meter */}
                  <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/80 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                      <span>Daily Quota</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {acc.sentTodayCount || 0} / {acc.dailyLimit} sent
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          dailyPercent > 90 ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${dailyPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                      <span>Hourly: {acc.hourlyLimit}/hr</span>
                      <span>SMTP: {acc.smtpHost}:{acc.smtpPort}</span>
                    </div>
                  </div>

                  {/* IMAP Provider Guidance Alert */}
                  {acc.imapStatus === 'disabled_by_provider' && (
                    <div className="mt-3 p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                      <div className="font-semibold flex items-center gap-1 text-amber-950 dark:text-amber-100">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        IMAP Access Disabled in Zoho Settings
                      </div>
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                        Outgoing SMTP is operational. To sync incoming emails, log into Zoho Mail &rarr; <strong>Settings &rarr; Mail Accounts &rarr; check &quot;IMAP Access&quot; &rarr; Save</strong>, then click <em>Test Connection</em> below.
                      </p>
                    </div>
                  )}

                  {acc.errorMessage && acc.imapStatus !== 'disabled_by_provider' && (
                    <div className="mt-2 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs font-medium">
                      {acc.errorMessage}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <button
                    onClick={() => handleTestConnection(acc._id)}
                    disabled={testingId === acc._id}
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingId === acc._id ? 'animate-spin text-emerald-600' : ''}`} />
                    Test Connection
                  </button>

                  <button
                    onClick={() => handleSyncInbox(acc._id)}
                    disabled={syncingId === acc._id}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1.5 transition-colors"
                  >
                    <Inbox className={`w-3.5 h-3.5 ${syncingId === acc._id ? 'animate-spin' : ''}`} />
                    Sync Inbox
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Account Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {editingAccount ? 'Edit Email Account' : 'Connect Email Account'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Passwords and tokens are encrypted securely via AES-256-GCM.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-400 font-medium">
                  {formError}
                </div>
              )}

              {/* Provider Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Provider</label>
                <div className="grid grid-cols-4 gap-2">
                  {['gmail', 'outlook', 'zoho', 'smtp_imap'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleProviderSelect(p)}
                      className={`p-2 rounded-xl text-xs font-semibold border text-center uppercase transition-all ${
                        form.provider === p
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-300'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {p === 'smtp_imap' ? 'Custom' : p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Account Label</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Marketing Team Sender"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address (Login)</label>
                  <input
                    type="email"
                    required
                    value={form.emailAddress}
                    onChange={(e) => setForm({ ...form, emailAddress: e.target.value })}
                    placeholder="sales@company.com"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Sender Name (From Name)</label>
                  <input
                    type="text"
                    required
                    value={form.senderName}
                    onChange={(e) => setForm({ ...form, senderName: e.target.value })}
                    placeholder="Alex from Growth"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Password / App Password {editingAccount && '(Leave blank to retain current)'}
                </label>
                <input
                  type="password"
                  required={!editingAccount}
                  value={form.passwordOrToken}
                  onChange={(e) => setForm({ ...form, passwordOrToken: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">SMTP Host</label>
                  <input
                    type="text"
                    required
                    value={form.smtpHost}
                    onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                    placeholder="smtp.domain.com"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Port</label>
                  <input
                    type="number"
                    required
                    value={form.smtpPort}
                    onChange={(e) => setForm({ ...form, smtpPort: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">IMAP Host (Receiving)</label>
                  <input
                    type="text"
                    value={form.imapHost}
                    onChange={(e) => setForm({ ...form, imapHost: e.target.value })}
                    placeholder="imap.domain.com"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">IMAP Port</label>
                  <input
                    type="number"
                    value={form.imapPort}
                    onChange={(e) => setForm({ ...form, imapPort: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Hourly Limit</label>
                  <input
                    type="number"
                    value={form.hourlyLimit}
                    onChange={(e) => setForm({ ...form, hourlyLimit: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Daily Limit</label>
                  <input
                    type="number"
                    value={form.dailyLimit}
                    onChange={(e) => setForm({ ...form, dailyLimit: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-xs"
                >
                  {submitting ? 'Testing & Saving...' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
