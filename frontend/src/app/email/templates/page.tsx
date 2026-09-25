'use client';

import React, { useState } from 'react';
import {
  FileCode,
  Plus,
  Mail,
  Sparkles,
  CheckCircle2,
  Copy,
  Trash2,
} from 'lucide-react';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  category: string;
  bodyHtml: string;
  variables: string[];
}

const INITIAL_TEMPLATES: EmailTemplate[] = [
  {
    id: '1',
    name: 'B2B Welcome Introduction',
    subject: 'Welcome to Imprenta CRM, {{firstName}}!',
    category: 'Onboarding',
    bodyHtml: `<p>Hi {{firstName}},</p><p>Thank you for connecting with us at {{company}}. We are thrilled to show you how our Imprenta CRM platform can streamline your customer relationships and outbound campaigns.</p><p>Best regards,<br/>The Team</p>`,
    variables: ['firstName', 'company'],
  },
  {
    id: '2',
    name: 'Product Demo Follow-Up',
    subject: 'Quick recap from our discussion, {{firstName}}',
    category: 'Sales',
    bodyHtml: `<p>Hello {{firstName}},</p><p>Following up on our recent product demo for {{company}}. Attached you will find our custom proposal and integration roadmap.</p><p>Feel free to reply directly with any questions!</p>`,
    variables: ['firstName', 'company'],
  },
  {
    id: '3',
    name: 'Special Promotion Offer',
    subject: 'Exclusive growth offer for {{company}}',
    category: 'Marketing',
    bodyHtml: `<p>Dear {{fullName}},</p><p>We are offering special annual subscription pricing for high-volume WhatsApp & Email automation teams.</p><p>Claim your discount before the end of the quarter!</p>`,
    variables: ['fullName', 'company'],
  },
];

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>(INITIAL_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(INITIAL_TEMPLATES[0]);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newTmpl, setNewTmpl] = useState({
    name: '',
    subject: '',
    category: 'Marketing',
    bodyHtml: '',
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTmpl.name || !newTmpl.subject) return;

    const created: EmailTemplate = {
      id: String(Date.now()),
      name: newTmpl.name,
      subject: newTmpl.subject,
      category: newTmpl.category,
      bodyHtml: newTmpl.bodyHtml || `<p>Hello {{firstName}},</p><p>Your message content here.</p>`,
      variables: ['firstName', 'company'],
    };

    setTemplates([created, ...templates]);
    setSelectedTemplate(created);
    setIsNewModalOpen(false);
    setNewTmpl({ name: '', subject: '', category: 'Marketing', bodyHtml: '' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Email Templates
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
              HTML & Text
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Build reusable email templates with merge tags, formatted HTML, and live preview rendering.
          </p>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Template
        </button>
      </div>

      {/* Templates Grid & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map((tmpl) => (
            <div
              key={tmpl.id}
              onClick={() => setSelectedTemplate(tmpl)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                selectedTemplate?.id === tmpl.id
                  ? 'bg-blue-50/50 dark:bg-blue-950/40 border-blue-500 dark:border-blue-500'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs text-slate-900 dark:text-white truncate">{tmpl.name}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {tmpl.category}
                </span>
              </div>
              <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-2 truncate">
                Subject: <span className="font-normal text-slate-500">{tmpl.subject}</span>
              </div>
              <div
                className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 prose-sm"
                dangerouslySetInnerHTML={{ __html: tmpl.bodyHtml }}
              />
            </div>
          ))}
        </div>

        {/* Live Preview Panel */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4 h-fit">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Email Render Simulator
          </h2>

          {selectedTemplate ? (
            <div className="space-y-3">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-3">
                <div className="text-xs">
                  <span className="text-slate-400 font-medium">Subject: </span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedTemplate.subject}</span>
                </div>
                <div
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs leading-relaxed text-slate-800 dark:text-slate-200 space-y-2"
                  dangerouslySetInnerHTML={{ __html: selectedTemplate.bodyHtml }}
                />
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Variables Detected:</span>
                  <span className="font-mono text-emerald-600 font-semibold">{selectedTemplate.variables.join(', ')}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Category:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedTemplate.category}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400">Select a template to preview.</div>
          )}
        </div>
      </div>

      {/* New Template Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Create New Email Template</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Template Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Sales Outreach"
                  value={newTmpl.name}
                  onChange={(e) => setNewTmpl({ ...newTmpl, name: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Subject Line</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Special invitation for {{company}}"
                  value={newTmpl.subject}
                  onChange={(e) => setNewTmpl({ ...newTmpl, subject: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">HTML Body Content</label>
                <textarea
                  rows={5}
                  placeholder="<p>Hi {{firstName}},</p><p>Your message here...</p>"
                  value={newTmpl.bodyHtml}
                  onChange={(e) => setNewTmpl({ ...newTmpl, bodyHtml: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
