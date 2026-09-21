'use client';

import React, { useState, useEffect } from 'react';
import { Mail, X, Send, ExternalLink, Loader2, AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import { emailApi, extractErrorMessage } from '../../lib/api';

export interface EmailComposeModalProps {
  contact: {
    _id?: string;
    fullName?: string;
    email?: string;
    alternateEmail?: string;
    company?: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

export function EmailComposeModal({
  contact,
  isOpen,
  onClose,
  onSuccess,
}: EmailComposeModalProps) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [toEmail, setToEmail] = useState('');
  const [ccEmail, setCcEmail] = useState('');
  const [bccEmail, setBccEmail] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const primaryEmail = contact?.email || contact?.alternateEmail || '';
      setToEmail(primaryEmail);
      setSubject('');
      setBody('');
      setCcEmail('');
      setBccEmail('');
      setShowCcBcc(false);
      setErrorMsg(null);

      // Load connected SMTP email accounts
      setLoadingAccounts(true);
      emailApi
        .getAccounts()
        .then((accs) => {
          const valid = accs || [];
          setAccounts(valid);
          if (valid.length > 0) {
            setSelectedAccountId(valid[0]._id);
          }
        })
        .catch((err) => {
          console.error('Failed to load email accounts:', err);
        })
        .finally(() => setLoadingAccounts(false));
    }
  }, [isOpen, contact]);

  if (!isOpen || !contact) return null;

  const handleSendSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toEmail.trim()) {
      setErrorMsg('Recipient email address is required.');
      return;
    }
    if (!subject.trim()) {
      setErrorMsg('Subject line is required.');
      return;
    }
    if (!body.trim()) {
      setErrorMsg('Email message body cannot be empty.');
      return;
    }
    if (!selectedAccountId && accounts.length > 0) {
      setErrorMsg('Please select a sender email account.');
      return;
    }

    setSending(true);
    setErrorMsg(null);

    try {
      if (accounts.length > 0) {
        const ccList = ccEmail.split(',').map((s) => s.trim()).filter(Boolean);
        const bccList = bccEmail.split(',').map((s) => s.trim()).filter(Boolean);

        await emailApi.sendEmail({
          accountId: selectedAccountId,
          toEmail: toEmail.trim(),
          subject: subject.trim(),
          bodyText: body,
          bodyHtml: `<div style="font-family: sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">${body.replace(/\n/g, '<br/>')}</div>`,
          cc: ccList,
          bcc: bccList,
        });

        if (onSuccess) {
          onSuccess(`Email successfully sent to ${toEmail.trim()}`);
        }
        onClose();
      } else {
        // If no SMTP account configured, trigger safe mailto fallback
        handleOpenMailto();
        onClose();
      }
    } catch (err) {
      setErrorMsg(extractErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const handleOpenMailto = () => {
    const params = new URLSearchParams();
    if (subject.trim()) params.append('subject', subject.trim());
    if (body.trim()) params.append('body', body.trim());
    if (ccEmail.trim()) params.append('cc', ccEmail.trim());
    if (bccEmail.trim()) params.append('bcc', bccEmail.trim());

    const queryString = params.toString() ? `?${params.toString()}` : '';
    window.location.href = `mailto:${encodeURIComponent(toEmail.trim())}${queryString}`;
  };

  const contactName =
    contact.fullName?.trim() || `${contact.email || 'Contact'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Compose Email to {contactName}
              </h3>
              <p className="text-[11px] text-slate-500">
                Draft and send through your connected email account or open in default mail client.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSendSmtp} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Account Selector */}
          {accounts.length > 0 ? (
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                From Account (SMTP)
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
              >
                {accounts.map((acc) => (
                  <option key={acc._id} value={acc._id}>
                    {acc.displayName ? `${acc.displayName} <${acc.email}>` : acc.email} (
                    {acc.smtpConfig?.host || 'SMTP'})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200 text-[11px] text-amber-800 flex items-center justify-between">
              <span>No connected SMTP email account found. You can use your device's default email client.</span>
              <button
                type="button"
                onClick={handleOpenMailto}
                className="ml-2 font-semibold text-amber-900 underline hover:text-amber-700 inline-flex items-center gap-1 shrink-0"
              >
                <ExternalLink className="w-3 h-3" />
                Launch Mail Client
              </button>
            </div>
          )}

          {/* Recipient */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-slate-700">To Recipient</label>
              <button
                type="button"
                onClick={() => setShowCcBcc(!showCcBcc)}
                className="text-[10px] font-semibold text-blue-600 hover:text-blue-800"
              >
                {showCcBcc ? 'Hide CC/BCC' : 'Add CC / BCC'}
              </button>
            </div>
            <input
              type="email"
              required
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none font-mono"
              placeholder="recipient@example.com"
            />
          </div>

          {/* Optional CC / BCC */}
          {showCcBcc && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200/60">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">CC</label>
                <input
                  type="text"
                  value={ccEmail}
                  onChange={(e) => setCcEmail(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-200 bg-white focus:outline-none"
                  placeholder="cc@example.com"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">BCC</label>
                <input
                  type="text"
                  value={bccEmail}
                  onChange={(e) => setBccEmail(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-200 bg-white focus:outline-none"
                  placeholder="bcc@example.com"
                />
              </div>
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Subject</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none"
              placeholder="e.g. Follow-up regarding our discussion..."
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Message Body</label>
            <textarea
              required
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none resize-y leading-relaxed"
              placeholder="Type your email content here..."
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleOpenMailto}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              title="Open draft in system default email application (Thunderbird, Outlook, Apple Mail)"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              Open in Default Mail Client
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              {accounts.length > 0 && (
                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-xs disabled:opacity-50 transition-colors"
                >
                  {sending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  {sending ? 'Sending...' : 'Send via AutoMarket'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
