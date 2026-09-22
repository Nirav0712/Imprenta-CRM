'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Send,
  MessageSquare,
  Mail,
  ArrowRight,
  ArrowLeft,
  Users,
  CheckCircle2,
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  RotateCw,
} from 'lucide-react';
import {
  campaignsApi,
  whatsappApi,
  emailApi,
  contactsApi,
  extractErrorMessage,
} from '../../../lib/api';

export default function NewCampaignWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Step 1: Basic & Channel
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp');

  // Step 2: Audience Filter
  const [filterCity, setFilterCity] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterLeadSource, setFilterLeadSource] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [previewContactCount, setPreviewContactCount] = useState<number | null>(null);
  const [countingContacts, setCountingContacts] = useState(false);

  // Step 3: Channel Connections / Accounts
  const [whatsappConnections, setWhatsappConnections] = useState<any[]>([]);
  const [selectedWaConnectionId, setSelectedWaConnectionId] = useState('');

  const [emailAccounts, setEmailAccounts] = useState<any[]>([]);
  const [selectedEmailAccountIds, setSelectedEmailAccountIds] = useState<string[]>([]);
  const [rotationStrategy, setRotationStrategy] = useState<'round_robin' | 'least_used'>('round_robin');

  // Step 4: Content / Template
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [templateVariableMapping, setTemplateVariableMapping] = useState<Record<string, string>>({});
  const [regularWaBody, setRegularWaBody] = useState('');

  const [emailSubject, setEmailSubject] = useState('');
  const [emailBodyHtml, setEmailBodyHtml] = useState('');

  // Step 5: Sending Policy
  const [perMessageDelaySec, setPerMessageDelaySec] = useState(2);
  const [batchSize, setBatchSize] = useState(50);
  const [batchPauseSec, setBatchPauseSec] = useState(60);

  // Load resources
  useEffect(() => {
    whatsappApi
      .getConnections()
      .then((conns) => {
        setWhatsappConnections(conns || []);
        if (conns && conns.length > 0) setSelectedWaConnectionId(conns[0]._id);
      })
      .catch((err) => console.warn('Could not load WA connections:', err));

    emailApi
      .getAccounts()
      .then((accs) => {
        setEmailAccounts(accs || []);
        if (accs && accs.length > 0) setSelectedEmailAccountIds([accs[0]._id]);
      })
      .catch((err) => console.warn('Could not load email accounts:', err));
  }, []);

  // Load templates when WA connection changes
  useEffect(() => {
    if (selectedWaConnectionId) {
      whatsappApi
        .getTemplates(selectedWaConnectionId)
        .then((tpls) => {
          setTemplates(tpls || []);
          if (tpls && tpls.length > 0) {
            handleSelectTemplate(tpls[0]);
          } else {
            setSelectedTemplate(null);
          }
        })
        .catch((err) => console.warn('Could not load templates:', err));
    }
  }, [selectedWaConnectionId]);

  // Update recipient count preview
  const countRecipients = async () => {
    setCountingContacts(true);
    try {
      const res = await contactsApi.getAll({
        page: 1,
        limit: 1,
        city: filterCity || undefined,
        country: filterCountry || undefined,
        leadSource: filterLeadSource || undefined,
        company: filterCompany || undefined,
        search: filterSearch || undefined,
      });
      setPreviewContactCount(res.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setCountingContacts(false);
    }
  };

  useEffect(() => {
    countRecipients();
  }, [filterCity, filterCountry, filterLeadSource, filterCompany, filterSearch, channel]);

  const handleSelectTemplate = (tpl: any) => {
    setSelectedTemplate(tpl);
    const initialMap: Record<string, string> = {};
    (tpl.variables || []).forEach((vNum: string) => {
      initialMap[vNum] = 'firstName'; // Default variable mapping to firstName
    });
    setTemplateVariableMapping(initialMap);
  };

  const handleToggleEmailAccount = (id: string) => {
    setSelectedEmailAccountIds((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((a) => a !== id) : prev) : [...prev, id],
    );
  };

  const handleCreateCampaign = async () => {
    if (!name.trim()) {
      setFormError('Please provide a campaign name');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const payload: any = {
        name,
        channel,
        contactFilters: {
          city: filterCity || undefined,
          country: filterCountry || undefined,
          leadSource: filterLeadSource || undefined,
          company: filterCompany || undefined,
          search: filterSearch || undefined,
        },
        sendingPolicy: {
          perMessageDelaySec: Number(perMessageDelaySec),
          batchSize: Number(batchSize),
          batchPauseSec: Number(batchPauseSec),
        },
      };

      if (channel === 'whatsapp') {
        const selectedConn = whatsappConnections.find((c) => c._id === selectedWaConnectionId);
        if (selectedConn?.providerType === 'official_meta' && selectedTemplate) {
          payload.whatsappConfig = {
            connectionId: selectedWaConnectionId,
            templateId: selectedTemplate.templateId,
            templateName: selectedTemplate.name,
            variableMapping: templateVariableMapping,
          };
        } else {
          payload.whatsappConfig = {
            connectionId: selectedWaConnectionId,
            customMessageBody: regularWaBody || 'Hello {{firstName}}, thank you for reaching out!',
          };
        }
      } else {
        payload.emailConfig = {
          accountIds: selectedEmailAccountIds,
          subject: emailSubject || 'Special Update for {{company}}',
          bodyHtml:
            emailBodyHtml ||
            '<p>Hi {{firstName}},</p><p>We wanted to reach out regarding your inquiry at {{company}}.</p><p>Best regards,<br/>Team</p>',
          rotationStrategy,
        };
      }

      const campaign = await campaignsApi.create(payload);
      // Auto-launch campaign
      await campaignsApi.launch(campaign._id);
      router.push('/campaigns');
    } catch (err) {
      setFormError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Campaign Builder</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure broadcast channels, audience filters, rotation strategies, and policy throttles.
          </p>
        </div>
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Campaigns
        </Link>
      </div>

      {/* Stepper Progress */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
        <div className="flex items-center justify-between text-xs font-semibold">
          {[
            { num: 1, label: 'Channel & Name' },
            { num: 2, label: 'Audience Filter' },
            { num: 3, label: 'Sender Setup' },
            { num: 4, label: 'Content' },
            { num: 5, label: 'Policy & Launch' },
          ].map((s, idx, arr) => (
            <React.Fragment key={s.num}>
              <div
                className={`flex items-center gap-2 ${
                  step >= s.num ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    step >= s.num ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {s.num}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {idx < arr.length - 1 && <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-700" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {formError && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 font-medium">
          {formError}
        </div>
      )}

      {/* STEP 1: CHANNEL & CAMPAIGN NAME */}
      {step === 1 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-2xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Campaign Channel & Name</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Choose the delivery channel and give your campaign a recognizable identifier.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Campaign Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Product Launch Announcement - Q3"
              className="w-full px-4 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Select Channel</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setChannel('whatsapp')}
                className={`p-5 rounded-2xl border-2 text-left transition-all flex items-start gap-4 ${
                  channel === 'whatsapp'
                    ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/40 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850'
                }`}
              >
                <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">WhatsApp Broadcast</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Send verified Meta templates or direct messages to customer phone numbers.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setChannel('email')}
                className={`p-5 rounded-2xl border-2 text-left transition-all flex items-start gap-4 ${
                  channel === 'email'
                    ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/40 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850'
                }`}
              >
                <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">Email Campaign</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Rotate across multiple SMTP accounts with hourly quotas and variable substitution.
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => {
                if (!name.trim()) {
                  setFormError('Please enter a campaign name');
                  return;
                }
                setFormError('');
                setStep(2);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
            >
              Continue to Audience Filter <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: AUDIENCE FILTER */}
      {step === 2 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-2xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Audience Segmentation</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Target specific contact cohorts using dynamic demographic and lead criteria.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-right">
              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">Matched Audience</span>
              <span className="text-lg font-bold text-emerald-900 dark:text-emerald-300">
                {countingContacts ? 'Calculating...' : `${(previewContactCount || 0).toLocaleString()} contacts`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">City Filter</label>
              <input
                type="text"
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                placeholder="e.g. New York, London"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Country Filter</label>
              <input
                type="text"
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
                placeholder="e.g. United States, Germany"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Lead Source</label>
              <input
                type="text"
                value={filterLeadSource}
                onChange={(e) => setFilterLeadSource(e.target.value)}
                placeholder="e.g. Inbound, Website, Conference"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Company / Organization</label>
              <input
                type="text"
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                placeholder="e.g. Acme"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => {
                if ((previewContactCount || 0) === 0) {
                  alert('No eligible contacts found with current filters. Please adjust your criteria.');
                  return;
                }
                setStep(3);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
            >
              Continue to Sender Setup <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: SENDER ACCOUNTS & ROTATION */}
      {step === 3 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-2xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {channel === 'whatsapp' ? 'Select WhatsApp Connection' : 'Select Email Senders & Rotation'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {channel === 'whatsapp'
                ? 'Select the active connection to dispatch this campaign from.'
                : 'Select one or more active email accounts. The queue scheduler will rotate sending across selected accounts.'}
            </p>
          </div>

          {channel === 'whatsapp' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">WhatsApp Connection</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {whatsappConnections.map((c) => (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => setSelectedWaConnectionId(c._id)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selectedWaConnectionId === c._id
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 bg-white dark:bg-slate-850'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-900 dark:text-white">{c.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">{c.phoneNumber || 'Not synced'}</div>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {c.providerType === 'official_meta' ? 'Official Meta API' : 'Regular QR'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Select Sending Accounts (Multi-Account Rotation)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {emailAccounts.map((a) => {
                    const isSelected = selectedEmailAccountIds.includes(a._id);
                    return (
                      <button
                        key={a._id}
                        type="button"
                        onClick={() => handleToggleEmailAccount(a._id)}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 bg-white dark:bg-slate-850'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">{a.name}</span>
                          <span
                            className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                              isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {isSelected && '✓'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">{a.emailAddress}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                          Daily Quota: {a.sentTodayCount || 0} / {a.dailyLimit}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Rotation Strategy</label>
                <select
                  value={rotationStrategy}
                  onChange={(e) => setRotationStrategy(e.target.value as any)}
                  className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                >
                  <option value="round_robin">Round Robin (Distribute evenly per email)</option>
                  <option value="least_used">Least Used (Prioritize accounts with lowest daily quota)</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(4)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
            >
              Continue to Content & Template <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: CONTENT & VARIABLE MAPPING */}
      {step === 4 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-2xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Message Content & Variable Mapping</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Personalize messaging parameters using contact attributes like full name, company, or custom fields.
            </p>
          </div>

          {channel === 'whatsapp' ? (
            <div className="space-y-4">
              {templates.length > 0 ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Select Approved Meta Template
                    </label>
                    <select
                      value={selectedTemplate?.name || ''}
                      onChange={(e) => {
                        const tpl = templates.find((t) => t.name === e.target.value);
                        if (tpl) handleSelectTemplate(tpl);
                      }}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none"
                    >
                      {templates.map((t) => (
                        <option key={t._id} value={t.name}>
                          {t.name} ({t.language}) — {t.status}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedTemplate && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Template Body Preview:</div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                        {selectedTemplate.components?.find((c: any) => c.type === 'BODY')?.text || '(No body)'}
                      </div>

                      {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
                        <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Map Parameters:</div>
                          {selectedTemplate.variables.map((vNum: string) => (
                            <div key={vNum} className="flex items-center gap-3">
                              <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 w-24">
                                Variable &#123;&#123;{vNum}&#125;&#125; →
                              </span>
                              <select
                                value={templateVariableMapping[vNum] || 'firstName'}
                                onChange={(e) =>
                                  setTemplateVariableMapping({
                                    ...templateVariableMapping,
                                    [vNum]: e.target.value,
                                  })
                                }
                                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                              >
                                <option value="firstName">First Name</option>
                                <option value="fullName">Full Name</option>
                                <option value="company">Company</option>
                                <option value="city">City</option>
                                <option value="leadSource">Lead Source</option>
                              </select>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    WhatsApp Message Text (Supports &#123;&#123;firstName&#125;&#125;, &#123;&#123;company&#125;&#125;)
                  </label>
                  <textarea
                    rows={5}
                    value={regularWaBody}
                    onChange={(e) => setRegularWaBody(e.target.value)}
                    placeholder="Hello {{firstName}}, we have an update regarding {{company}}..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Subject Line (Supports &#123;&#123;firstName&#125;&#125;, &#123;&#123;company&#125;&#125;)
                </label>
                <input
                  type="text"
                  required
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Special Announcement for {{company}}"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email HTML Body (Supports HTML and &#123;&#123;firstName&#125;&#125;, &#123;&#123;company&#125;&#125;)
                </label>
                <textarea
                  rows={8}
                  required
                  value={emailBodyHtml}
                  onChange={(e) => setEmailBodyHtml(e.target.value)}
                  placeholder="<p>Hi {{firstName}},</p><p>We wanted to share an exciting update for {{company}}.</p>"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono text-xs focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setStep(3)}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(5)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
            >
              Continue to Sending Policy <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: SENDING POLICY & CONFIRMATION */}
      {step === 5 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-2xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Sending Policy & Launch Review</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Fine-tune inter-message delay and batch intervals before queuing the durable campaign.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Delay Between Messages (Sec)
              </label>
              <input
                type="number"
                min={0}
                max={60}
                value={perMessageDelaySec}
                onChange={(e) => setPerMessageDelaySec(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Batch Size</label>
              <input
                type="number"
                min={1}
                max={500}
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Batch Pause (Sec)</label>
              <input
                type="number"
                min={0}
                value={batchPauseSec}
                onChange={(e) => setBatchPauseSec(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none"
              />
            </div>
          </div>

          {/* Review Summary */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs text-slate-700 dark:text-slate-300">
            <div className="font-bold text-slate-900 dark:text-white">Campaign Summary</div>
            <div className="grid grid-cols-2 gap-2">
              <div>Name: <strong className="text-slate-800 dark:text-slate-200">{name}</strong></div>
              <div>Channel: <strong className="capitalize text-slate-800 dark:text-slate-200">{channel}</strong></div>
              <div>Total Recipients: <strong className="text-emerald-700 dark:text-emerald-400 font-mono">{(previewContactCount || 0).toLocaleString()}</strong></div>
              <div>Per-message delay: <strong className="text-slate-800 dark:text-slate-200">{perMessageDelaySec}s</strong></div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setStep(4)}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleCreateCampaign}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 shadow-xs transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              {submitting ? 'Queuing Broadcast...' : 'Confirm & Launch Campaign'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
