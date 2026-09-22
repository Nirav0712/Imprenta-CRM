'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Check,
  Eye,
  Building,
  MapPin,
  Mail,
  Phone,
  Globe,
  Tag,
  Calendar,
  Layers,
  User,
  Briefcase,
  Clock,
  Activity,
  FileText,
  CheckCircle2,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { contactsApi, customFieldsApi, crmApi, extractErrorMessage } from '../../lib/api';
import { ContactActionButtons } from '../../components/crm/ContactActionButtons';
import { EmailComposeModal } from '../../components/crm/EmailComposeModal';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterLeadSource, setFilterLeadSource] = useState('');
  const [hasDuplicatesOnly, setHasDuplicatesOnly] = useState(false);
  const [filterCustomKey, setFilterCustomKey] = useState('');
  const [filterCustomVal, setFilterCustomVal] = useState('');
  const [exporting, setExporting] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any | null>(null);
  const [detailContact, setDetailContact] = useState<any | null>(null);
  const [detailActivities, setDetailActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [emailModalContact, setEmailModalContact] = useState<any | null>(null);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Form State
  const initialFormData = {
    firstName: '',
    lastName: '',
    fullName: '',
    email: '',
    alternateEmail: '',
    phoneNumber: '',
    whatsappNumber: '',
    company: '',
    department: '',
    designation: '',
    website: '',
    city: '',
    country: '',
    status: 'lead',
    owner: '',
    leadSource: '',
    tags: '',
    notes: '',
    customFields: {} as Record<string, any>,
  };

  const [formData, setFormData] = useState(initialFormData);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load Custom Fields definitions
  useEffect(() => {
    customFieldsApi
      .getAll()
      .then((cfs) => setCustomFields(cfs || []))
      .catch((err) => {
        console.warn('Could not load custom fields:', err);
      });
  }, []);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await contactsApi.getAll({
        page,
        limit: 15,
        search: search || undefined,
        status: filterStatus || undefined,
        department: filterDepartment || undefined,
        owner: filterOwner || undefined,
        city: filterCity || undefined,
        country: filterCountry || undefined,
        leadSource: filterLeadSource || undefined,
        hasDuplicateFlags: hasDuplicatesOnly ? 'true' : undefined,
        customFieldKey: filterCustomKey || undefined,
        customFieldValue: filterCustomVal || undefined,
      });

      setContacts(res.data || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error(err);
      showToast(extractErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [
    page,
    search,
    filterStatus,
    filterDepartment,
    filterOwner,
    filterCity,
    filterCountry,
    filterLeadSource,
    hasDuplicatesOnly,
    filterCustomKey,
    filterCustomVal,
  ]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(contacts.map((c) => c._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleDeleteSingle = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this contact from MongoDB Atlas?')) return;
    try {
      await contactsApi.delete(id);
      showToast('Contact deleted successfully.', 'success');
      if (detailContact?._id === id) setDetailContact(null);
      fetchContacts();
    } catch (err) {
      showToast(extractErrorMessage(err), 'error');
    }
  };

  const handleDeleteBulk = async () => {
    if (!confirm(`Are you sure you want to permanently delete ${selectedIds.length} selected contact(s)?`)) return;
    try {
      await contactsApi.deleteBulk(selectedIds);
      showToast(`${selectedIds.length} contact(s) deleted successfully.`, 'success');
      setSelectedIds([]);
      fetchContacts();
    } catch (err) {
      showToast(extractErrorMessage(err), 'error');
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await contactsApi.exportCsv({
        search: search || undefined,
        status: filterStatus || undefined,
        department: filterDepartment || undefined,
        leadSource: filterLeadSource || undefined,
        city: filterCity || undefined,
        country: filterCountry || undefined,
      });
      showToast('CSV export downloaded successfully.', 'success');
    } catch (err) {
      showToast(`Export failed: ${extractErrorMessage(err)}`, 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingContact(null);
    setFormData(initialFormData);
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (contact: any) => {
    setEditingContact(contact);
    setFormData({
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      fullName: contact.fullName || '',
      email: contact.email || '',
      alternateEmail: contact.alternateEmail || '',
      phoneNumber: contact.phoneNumber || '',
      whatsappNumber: contact.whatsappNumber || '',
      company: contact.company || '',
      department: contact.department || '',
      designation: contact.designation || '',
      website: contact.website || '',
      city: contact.city || '',
      country: contact.country || '',
      status: contact.status || 'lead',
      owner: contact.owner || '',
      leadSource: contact.leadSource || '',
      tags: Array.isArray(contact.tags) ? contact.tags.join(', ') : contact.tags || '',
      notes: contact.notes || '',
      customFields: contact.customFields || {},
    });
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleOpenDetail = async (contactId: string) => {
    try {
      const fullContact = await contactsApi.getById(contactId);
      setDetailContact(fullContact);

      // Fetch linked CRM activities
      setLoadingActivities(true);
      try {
        const activities = await crmApi.getActivities(contactId, undefined, 10);
        setDetailActivities(activities || []);
      } catch (err) {
        setDetailActivities([]);
      } finally {
        setLoadingActivities(false);
      }
    } catch (err) {
      showToast(extractErrorMessage(err), 'error');
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    // Client-side validation
    const hasName =
      formData.fullName.trim() ||
      formData.firstName.trim() ||
      formData.lastName.trim() ||
      formData.company.trim();

    if (!hasName) {
      setFormError('Please provide a Contact Name, First/Last Name, or Company.');
      setSubmitting(false);
      return;
    }

    // Email format validation if provided
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email.trim() && !emailRegex.test(formData.email.trim())) {
      setFormError('Please enter a valid primary email address format (e.g. name@domain.com).');
      setSubmitting(false);
      return;
    }
    if (formData.alternateEmail.trim() && !emailRegex.test(formData.alternateEmail.trim())) {
      setFormError('Please enter a valid alternate email address format.');
      setSubmitting(false);
      return;
    }

    try {
      const tagsArray = formData.tags
        ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [];

      const payload = {
        ...formData,
        tags: tagsArray,
      };

      if (editingContact) {
        await contactsApi.update(editingContact._id, payload);
        showToast('Contact updated successfully.', 'success');
      } else {
        await contactsApi.create(payload);
        showToast('New contact created successfully.', 'success');
      }
      setIsAddModalOpen(false);
      fetchContacts();
    } catch (err) {
      setFormError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'customer':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'prospect':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'active':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'inactive':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'lead':
      default:
        return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Banner */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-medium animate-in slide-in-from-top duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : toast.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : toast.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-sky-400 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">CRM Contacts</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {total} Total
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Browse, manage, search, and initiate realistic direct communication with contacts stored in MongoDB Atlas.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportCsv}
            disabled={exporting || contacts.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs disabled:opacity-50 transition-colors"
            title="Download current contact filter as CSV"
          >
            {exporting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
            ) : (
              <Download className="w-3.5 h-3.5 text-slate-600" />
            )}
            Export CSV
          </button>

          <Link
            href="/contacts/import"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Import File
          </Link>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Contact
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Main search bar */}
          <div className="relative flex-1 min-w-[280px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email, phone, company, dept..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="">All Statuses</option>
              <option value="lead">Lead</option>
              <option value="prospect">Prospect</option>
              <option value="customer">Customer</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            {/* Department */}
            <input
              type="text"
              placeholder="Department..."
              value={filterDepartment}
              onChange={(e) => {
                setFilterDepartment(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 w-28 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />

            {/* Owner */}
            <input
              type="text"
              placeholder="Owner..."
              value={filterOwner}
              onChange={(e) => {
                setFilterOwner(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 w-24 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />

            {/* Lead Source */}
            <input
              type="text"
              placeholder="Source..."
              value={filterLeadSource}
              onChange={(e) => {
                setFilterLeadSource(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-2 text-xs rounded-lg border border-slate-200 w-24 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />

            {/* Custom Field Selector */}
            {customFields.length > 0 && (
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
                <select
                  value={filterCustomKey}
                  onChange={(e) => {
                    setFilterCustomKey(e.target.value);
                    setPage(1);
                  }}
                  className="px-2 py-1 text-xs bg-transparent text-slate-700 focus:outline-none"
                >
                  <option value="">Custom Field...</option>
                  {customFields.map((cf) => (
                    <option key={cf.key} value={cf.key}>
                      {cf.label}
                    </option>
                  ))}
                </select>
                {filterCustomKey && (
                  <input
                    type="text"
                    placeholder="Value..."
                    value={filterCustomVal}
                    onChange={(e) => {
                      setFilterCustomVal(e.target.value);
                      setPage(1);
                    }}
                    className="w-20 px-2 py-1 text-xs bg-white rounded border border-slate-200 focus:outline-none"
                  />
                )}
              </div>
            )}

            {/* Duplicates Toggle */}
            <button
              onClick={() => {
                setHasDuplicatesOnly(!hasDuplicatesOnly);
                setPage(1);
              }}
              className={`px-3 py-2 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-colors ${
                hasDuplicatesOnly
                  ? 'bg-amber-50 border-amber-300 text-amber-800 font-semibold'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Duplicates Only
            </button>

            {/* Bulk Delete Button */}
            {selectedIds.length > 0 && (
              <button
                onClick={handleDeleteBulk}
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected ({selectedIds.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-16 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
            <div className="text-xs font-medium">Loading contact database from MongoDB Atlas...</div>
          </div>
        ) : contacts.length === 0 ? (
          <div className="p-16 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-800">No contacts found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Get started by uploading your contacts spreadsheet or adding individual records manually.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link
                href="/contacts/import"
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
              >
                Upload File
              </Link>
              <button
                onClick={handleOpenAdd}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Add Manually
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4 w-8">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={selectedIds.length === contacts.length && contacts.length > 0}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </th>
                  <th className="px-4 py-3">Contact Profile</th>
                  <th className="px-4 py-3">Communication</th>
                  <th className="px-4 py-3">Organization & Dept</th>
                  <th className="px-4 py-3">Status & Owner</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contacts.map((c) => {
                  const isSelected = selectedIds.includes(c._id);
                  const hasDuplicate = c.duplicateFlags && c.duplicateFlags.length > 0;
                  const contactName =
                    c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unnamed Contact';

                  return (
                    <tr
                      key={c._id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isSelected ? 'bg-emerald-50/40' : ''
                      }`}
                    >
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(c._id)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>

                      {/* Name & Title */}
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenDetail(c._id)}
                              className="text-left font-semibold text-slate-900 hover:text-emerald-700 hover:underline flex items-center gap-1.5"
                            >
                              <span>{contactName}</span>
                            </button>
                            {hasDuplicate && (
                              <span
                                title={`Duplicate detected for ${c.duplicateFlags.map((d: any) => d.field).join(', ')}`}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-100 text-amber-800 border border-amber-200"
                              >
                                Duplicate
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {c.designation || c.city ? (
                              <span>
                                {[c.designation, c.city, c.country].filter(Boolean).join(' • ')}
                              </span>
                            ) : (
                              <span className="text-slate-400">No title/location</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Communication Handles */}
                      <td className="px-4 py-3 text-slate-600">
                        <div className="space-y-0.5">
                          {c.email ? (
                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-700">
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{c.email}</span>
                            </div>
                          ) : (
                            <div className="text-slate-400 italic text-[11px]">No email</div>
                          )}
                          {c.phoneNumber || c.whatsappNumber ? (
                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{c.phoneNumber || c.whatsappNumber}</span>
                            </div>
                          ) : (
                            <div className="text-slate-400 italic text-[11px]">No phone</div>
                          )}
                        </div>
                      </td>

                      {/* Organization & Department */}
                      <td className="px-4 py-3 text-slate-600">
                        <div className="space-y-0.5">
                          <div className="font-medium text-slate-800 flex items-center gap-1.5">
                            <Building className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{c.company || '—'}</span>
                          </div>
                          {c.department && (
                            <div className="text-[11px] text-slate-500 pl-4.5">
                              {c.department}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status & Owner */}
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider ${getStatusBadge(
                              c.status,
                            )}`}
                          >
                            {c.status || 'lead'}
                          </span>
                          {c.owner && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1">
                              <User className="w-2.5 h-2.5 text-slate-400" />
                              <span>{c.owner}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Actions: Exactly 3 Primary Buttons (WhatsApp, Email, Call) + Secondary */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* THREE ACTION BUTTONS AT END OF EVERY ROW */}
                          <ContactActionButtons
                            contact={c}
                            onOpenEmail={(contact) => setEmailModalContact(contact)}
                            onShowToast={showToast}
                            size="sm"
                          />

                          {/* Secondary options dropdown / icon buttons */}
                          <div className="flex items-center border-l border-slate-200 pl-1.5 ml-1 gap-0.5">
                            <button
                              onClick={() => handleOpenDetail(c._id)}
                              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                              title="View contact details"
                              aria-label="View contact details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(c)}
                              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                              title="Edit contact"
                              aria-label="Edit contact"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSingle(c._id)}
                              className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                              title="Delete contact"
                              aria-label="Delete contact"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-700">{contacts.length}</span> of{' '}
            <span className="font-semibold text-slate-700">{total}</span> records
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium px-2 text-slate-700">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* CONTACT DETAIL DRAWER / MODAL */}
      {detailContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Detail Header with Actions */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/60 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">
                    {detailContact.fullName || 'Contact Profile'}
                  </h3>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider ${getStatusBadge(
                      detailContact.status,
                    )}`}
                  >
                    {detailContact.status || 'lead'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <span>
                    {[detailContact.designation, detailContact.company, detailContact.department]
                      .filter(Boolean)
                      .join(' • ') || 'No company specified'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Dedicated Action Buttons on Detail Page */}
                <ContactActionButtons
                  contact={detailContact}
                  onOpenEmail={(contact) => {
                    setDetailContact(null);
                    setEmailModalContact(contact);
                  }}
                  onShowToast={showToast}
                  size="md"
                  showLabels={true}
                />

                <button
                  onClick={() => setDetailContact(null)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Detail Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
              {/* Duplicate Warning */}
              {detailContact.duplicateFlags && detailContact.duplicateFlags.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Duplicate Match Detected
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    This contact shares matching credentials ({detailContact.duplicateFlags.map((d: any) => d.field).join(', ')}) with an existing contact in the database.
                  </p>
                </div>
              )}

              {/* Contact Information Card */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-3">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-600" />
                  Contact Information
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Email</span>
                    <span className="text-slate-800 font-medium font-mono text-[11px]">{detailContact.email || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Alternate Email</span>
                    <span className="text-slate-800 font-medium font-mono text-[11px]">{detailContact.alternateEmail || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Phone Number</span>
                    <span className="text-slate-800 font-mono text-[11px]">{detailContact.phoneNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">WhatsApp Number</span>
                    <span className="text-slate-800 font-mono text-[11px]">{detailContact.whatsappNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Company</span>
                    <span className="text-slate-800 font-medium">{detailContact.company || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Department</span>
                    <span className="text-slate-800 font-medium">{detailContact.department || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Designation</span>
                    <span className="text-slate-800 font-medium">{detailContact.designation || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Location</span>
                    <span className="text-slate-800 font-medium">
                      {[detailContact.city, detailContact.country].filter(Boolean).join(', ') || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Website</span>
                    <span className="text-slate-800 font-medium">{detailContact.website || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Owner</span>
                    <span className="text-slate-800 font-medium">{detailContact.owner || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Lead Source</span>
                    <span className="text-slate-800 font-medium">{detailContact.leadSource || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] font-semibold uppercase">Tenant Org</span>
                    <span className="text-slate-800 font-mono text-[11px]">{detailContact.organizationId || 'default-org'}</span>
                  </div>
                </div>
              </div>

              {/* Tags */}
              {detailContact.tags && detailContact.tags.length > 0 && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2">
                  <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-slate-600" />
                    Tags
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {detailContact.tags.map((t: string) => (
                      <span
                        key={t}
                        className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200/80 text-slate-800"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {detailContact.notes && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2">
                  <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-600" />
                    Notes
                  </div>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{detailContact.notes}</p>
                </div>
              )}

              {/* Dynamic Custom Fields */}
              {detailContact.customFields && Object.keys(detailContact.customFields).length > 0 && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-3">
                  <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Custom Attributes
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {Object.entries(detailContact.customFields).map(([k, v]) => (
                      <div key={k}>
                        <span className="text-slate-400 block text-[10px] font-semibold uppercase">{k}</span>
                        <span className="text-slate-800 font-medium">{String(v || '—')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked CRM Activity Timeline */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-3">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-slate-600" />
                  Recent Activity Timeline
                </div>

                {loadingActivities ? (
                  <div className="text-slate-400 text-xs py-2 flex items-center gap-2">
                    <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
                    Loading activities...
                  </div>
                ) : detailActivities.length === 0 ? (
                  <div className="text-slate-400 text-xs py-1">No recorded CRM activities for this contact yet.</div>
                ) : (
                  <div className="space-y-2.5">
                    {detailActivities.map((act) => (
                      <div
                        key={act._id}
                        className="p-2.5 rounded-lg bg-white border border-slate-200/60 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800">{act.title}</span>
                          <span className="text-[10px] text-slate-400">
                            {act.performedAt ? new Date(act.performedAt).toLocaleDateString() : ''}
                          </span>
                        </div>
                        {act.description && (
                          <div className="text-slate-600 text-[11px]">{act.description}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const toEdit = { ...detailContact };
                    setDetailContact(null);
                    handleOpenEdit(toEdit);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit Profile
                </button>
                <button
                  onClick={() => handleDeleteSingle(detailContact._id)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>

              <button
                onClick={() => setDetailContact(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT CONTACT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingContact ? 'Edit Contact Profile' : 'Add New CRM Contact'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter audience profile details, communication endpoints, and company attributes.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                  {formError}
                </div>
              )}

              {/* Name Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                    placeholder="Doe"
                  />
                </div>
              </div>

              {/* Communication Endpoints */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Alternate Email</label>
                  <input
                    type="email"
                    value={formData.alternateEmail}
                    onChange={(e) => setFormData({ ...formData, alternateEmail: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                    placeholder="john.work@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile Phone (For Calls)
                  </label>
                  <input
                    type="text"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none font-mono"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={formData.whatsappNumber}
                    onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none font-mono"
                    placeholder="+1 (555) 123-4567 (if different)"
                  />
                </div>
              </div>

              {/* Organization, Department, Role */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                    placeholder="Acme Inc."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                    placeholder="Engineering / Sales"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                    placeholder="Director of Sales"
                  />
                </div>
              </div>

              {/* Status, Owner, Lead Source */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none font-semibold"
                  >
                    <option value="lead">Lead</option>
                    <option value="prospect">Prospect</option>
                    <option value="customer">Customer</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Owner</label>
                  <input
                    type="text"
                    value={formData.owner}
                    onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                    placeholder="Sales Rep Name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lead Source</label>
                  <input
                    type="text"
                    value={formData.leadSource}
                    onChange={(e) => setFormData({ ...formData, leadSource: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                    placeholder="Website / Referral"
                  />
                </div>
              </div>

              {/* Location & Website */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none"
                    placeholder="San Francisco"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none"
                    placeholder="United States"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Website</label>
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none"
                    placeholder="https://example.com"
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none"
                  placeholder="VIP, Enterprise, Automotive"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none resize-y"
                  placeholder="Key background context, preferences, call notes..."
                />
              </div>

              {/* Dynamic Custom Fields */}
              {customFields.length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="text-xs font-semibold text-slate-700">Custom Attributes</div>
                  <div className="grid grid-cols-2 gap-3">
                    {customFields.map((cf) => (
                      <div key={cf.key}>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          {cf.label}
                        </label>
                        <input
                          type={cf.type === 'number' ? 'number' : cf.type === 'date' ? 'date' : 'text'}
                          value={formData.customFields[cf.key] || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              customFields: {
                                ...formData.customFields,
                                [cf.key]: e.target.value,
                              },
                            })
                          }
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/60 p-4 -mx-6 -mb-6">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-xs"
                >
                  {submitting ? 'Saving to Database...' : editingContact ? 'Update Contact' : 'Save Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK EMAIL COMPOSE DIALOG */}
      <EmailComposeModal
        contact={emailModalContact}
        isOpen={Boolean(emailModalContact)}
        onClose={() => setEmailModalContact(null)}
        onSuccess={(msg) => showToast(msg, 'success')}
      />
    </div>
  );
}
