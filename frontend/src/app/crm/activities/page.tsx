'use client';

import React, { useEffect, useState } from 'react';
import {
  Activity as ActivityIcon,
  MessageSquare,
  Mail,
  Phone,
  Calendar,
  FileText,
  DollarSign,
  Plus,
  RefreshCw,
  User,
  AlertCircle,
} from 'lucide-react';
import { crmApi, contactsApi, extractErrorMessage } from '../../../lib/api';

export default function CrmActivitiesPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // New Activity Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    contactId: '',
    type: 'note' as any,
    title: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  const loadActivities = async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const [acts, contactList] = await Promise.all([
        crmApi.getActivities(undefined, undefined, 100),
        contactsApi.getAll(),
      ]);
      setActivities(Array.isArray(acts) ? acts : []);
      const extractedContacts = Array.isArray(contactList?.data)
        ? contactList.data
        : Array.isArray(contactList)
        ? contactList
        : Array.isArray(contactList?.contacts)
        ? contactList.contacts
        : [];
      setContacts(extractedContacts);
    } catch (err) {
      setErrorBanner(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.contactId || !form.title) {
      alert('Please fill all required fields');
      return;
    }
    setSaving(true);
    try {
      await crmApi.createActivity(form);
      setIsModalOpen(false);
      setForm({ contactId: '', type: 'note', title: '', description: '' });
      loadActivities();
    } catch (err) {
      alert(`Failed to log activity: ${extractErrorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const filtered = activities.filter((a) => filterType === 'all' || a.type === filterType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            CRM Activity Timeline
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              Audit Stream
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time feed of WhatsApp conversations, emails sent, meetings held, and deal movements.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadActivities}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Log Activity
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-x-auto">
        {['all', 'whatsapp', 'email', 'call', 'meeting', 'note', 'deal_update'].map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl capitalize whitespace-nowrap transition-all ${
              filterType === t
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {t.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Timeline Stream */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-6">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading activity stream...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No activities found matching this filter.
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            {filtered.map((act) => (
              <div key={act._id} className="relative flex items-start gap-4">
                {/* Icon Marker */}
                <div className="absolute -left-6 mt-1 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border-2 border-emerald-500 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  {act.type === 'whatsapp' ? (
                    <MessageSquare className="w-3 h-3" />
                  ) : act.type === 'email' ? (
                    <Mail className="w-3 h-3" />
                  ) : act.type === 'call' ? (
                    <Phone className="w-3 h-3" />
                  ) : act.type === 'meeting' ? (
                    <Calendar className="w-3 h-3" />
                  ) : act.type === 'deal_update' ? (
                    <DollarSign className="w-3 h-3" />
                  ) : (
                    <FileText className="w-3 h-3" />
                  )}
                </div>

                {/* Content Box */}
                <div className="flex-1 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-xs text-slate-900 dark:text-white">{act.title}</div>
                    <span className="text-[10px] text-slate-400">
                      {new Date(act.performedAt).toLocaleString()}
                    </span>
                  </div>
                  {act.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {act.description}
                    </p>
                  )}
                  {act.contactId && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                      Contact: <strong className="text-slate-700 dark:text-slate-300">{act.contactId.fullName}</strong> ({act.contactId.company || act.contactId.phoneNumber})
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Log CRM Activity / Note</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Contact</label>
                <select
                  required
                  value={form.contactId}
                  onChange={(e) => setForm({ ...form, contactId: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">Select Contact...</option>
                  {Array.isArray(contacts) &&
                    contacts.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.fullName || c.firstName || 'Contact'} ({c.company || c.phoneNumber || c.email})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Activity Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white capitalize"
                >
                  <option value="note">Note / Log</option>
                  <option value="call">Phone Call</option>
                  <option value="meeting">Meeting Held</option>
                  <option value="deal_update">Deal Update</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Summary / Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Discovery call completed"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Details</label>
                <textarea
                  rows={3}
                  placeholder="Key discussion points, customer objections, next steps..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {saving ? 'Logging...' : 'Save Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
