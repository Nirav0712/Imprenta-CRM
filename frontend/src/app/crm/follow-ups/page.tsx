'use client';

import React, { useEffect, useState } from 'react';
import {
  CalendarCheck,
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  User,
  Flag,
} from 'lucide-react';
import { crmApi, contactsApi, extractErrorMessage } from '../../../lib/api';

export default function CrmFollowUpsPage() {
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // New Follow-up Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    contactId: '',
    title: '',
    notes: '',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
    priority: 'medium' as 'low' | 'medium' | 'high',
  });
  const [saving, setSaving] = useState(false);

  const loadFollowUps = async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const [tasks, contactList] = await Promise.all([
        crmApi.getFollowUps(filter),
        contactsApi.getAll(),
      ]);
      setFollowUps(tasks || []);
      setContacts(contactList?.contacts || contactList || []);
    } catch (err) {
      setErrorBanner(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFollowUps();
  }, [filter]);

  const handleToggleComplete = async (task: any) => {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    try {
      await crmApi.updateFollowUp(task._id, { status: nextStatus });
      loadFollowUps();
    } catch (err) {
      alert(`Failed to update task: ${extractErrorMessage(err)}`);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.contactId || !form.title || !form.dueDate) {
      alert('Please fill all required fields');
      return;
    }
    setSaving(true);
    try {
      await crmApi.createFollowUp({
        ...form,
        dueDate: new Date(form.dueDate),
      });
      setIsModalOpen(false);
      setForm({
        contactId: '',
        title: '',
        notes: '',
        dueDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
        priority: 'medium',
      });
      loadFollowUps();
    } catch (err) {
      alert(`Failed to schedule follow-up: ${extractErrorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this follow-up?')) return;
    try {
      await crmApi.deleteFollowUp(id);
      loadFollowUps();
    } catch (err) {
      alert(`Delete failed: ${extractErrorMessage(err)}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            CRM Follow-ups & Reminders
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              Task Automation
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Never miss a customer touchpoint. Schedule follow-ups linked to WhatsApp & Email conversations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadFollowUps}
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
            Schedule Follow-up
          </button>
        </div>
      </div>

      {errorBanner && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs w-fit">
        {(['all', 'pending', 'completed'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-1.5 text-xs font-bold rounded-xl capitalize transition-all ${
              filter === tab
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading follow-ups...</div>
        ) : followUps.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">No Follow-ups Found</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Schedule follow-up tasks to ensure your team reaches back to qualified leads on time.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {followUps.map((task) => (
              <div
                key={task._id}
                className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => handleToggleComplete(task)}
                    className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                      task.status === 'completed'
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:border-emerald-500'
                    }`}
                  >
                    {task.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>

                  <div className="space-y-1 min-w-0">
                    <div
                      className={`text-xs font-bold ${
                        task.status === 'completed'
                          ? 'line-through text-slate-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {task.title}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Due: {new Date(task.dueDate).toLocaleDateString()} at {new Date(task.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {task.contactId && (
                        <span>• Contact: <strong className="text-slate-700 dark:text-slate-300">{task.contactId.fullName || 'Contact'}</strong></span>
                      )}
                    </div>
                    {task.notes && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                        {task.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      task.priority === 'high'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400'
                        : task.priority === 'medium'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {task.priority || 'medium'}
                  </span>

                  <button
                    onClick={() => handleDelete(task._id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Schedule Customer Follow-up</h3>
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
                  {contacts.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.fullName || c.firstName || 'Contact'} ({c.company || c.phoneNumber || c.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Action Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Call back regarding WhatsApp API pricing"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Due Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
                    className="mt-1 w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white capitalize"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Notes</label>
                <textarea
                  rows={3}
                  placeholder="Instructions or key questions to address..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
                  {saving ? 'Scheduling...' : 'Save Follow-up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
