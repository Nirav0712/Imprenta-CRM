'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Plus,
  RefreshCw,
  Clock,
  ChevronRight,
  History,
  ShieldCheck,
  Bookmark,
  Trash2,
  AlertTriangle,
  FileText,
  UserCheck,
  UserX,
} from 'lucide-react';
import { importsApi, extractErrorMessage } from '../../../lib/api';

const STANDARD_FIELDS = [
  { key: 'fullName', label: 'Full Name' },
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'phoneNumber', label: 'Phone Number (WhatsApp)' },
  { key: 'email', label: 'Email Address' },
  { key: 'company', label: 'Company' },
  { key: 'website', label: 'Website' },
  { key: 'city', label: 'City' },
  { key: 'country', label: 'Country' },
  { key: 'designation', label: 'Designation / Title' },
  { key: 'leadSource', label: 'Lead Source' },
];

export default function ImportWizardPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Uploaded parsed payload
  const [parsedPayload, setParsedPayload] = useState<{
    filename: string;
    fileFormat: string;
    totalRows: number;
    headers: string[];
    suggestedMapping: Record<string, string>;
    previewRows: any[];
    allRows: any[];
  } | null>(null);

  // Mapping state: fileHeader -> contactField
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Dynamic Custom Fields to create on the fly
  const [newCustomFields, setNewCustomFields] = useState<
    Array<{ key: string; label: string; type: string }>
  >([]);

  // Reusable Mapping Presets
  const [savedPresets, setSavedPresets] = useState<any[]>([]);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);

  // Preview & validation state
  const [previewResult, setPreviewResult] = useState<{
    previewRows: any[];
    errors: any[];
    totalRows: number;
    validRowsCount: number;
    invalidRowsCount: number;
    warningCount: number;
    duplicateCandidatesCount: number;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Import execution & history state
  const [importing, setImporting] = useState(false);
  const [importJobResult, setImportJobResult] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchHistoryAndPresets = async () => {
    setHistoryLoading(true);
    try {
      const [hist, presets] = await Promise.allSettled([
        importsApi.getHistory(),
        importsApi.getMappings(),
      ]);
      setHistory(hist.status === 'fulfilled' ? hist.value : []);
      setSavedPresets(presets.status === 'fulfilled' ? presets.value : []);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoryAndPresets();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      const ext = selected.name.split('.').pop()?.toLowerCase();
      if (!['csv', 'xlsx', 'xls', 'xml'].includes(ext || '')) {
        setUploadError('Unsupported file type. Please upload a .csv, .xlsx, .xls, or .xml file.');
        return;
      }
      if (selected.size > 20 * 1024 * 1024) {
        setUploadError('File size exceeds 20MB limit.');
        return;
      }
      setFile(selected);
      setUploadError('');
    }
  };

  const handleUploadFile = async () => {
    if (!file) {
      setUploadError('Please choose a file to upload');
      return;
    }

    setUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await importsApi.upload(formData);
      setParsedPayload(res);
      setColumnMapping(res.suggestedMapping || {});
      setStep(2);
    } catch (err) {
      setUploadError(extractErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleMappingChange = (header: string, value: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [header]: value,
    }));
  };

  const handleAddCustomField = (header: string) => {
    const cleanKey = header.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!newCustomFields.some((f) => f.key === cleanKey)) {
      setNewCustomFields((prev) => [
        ...prev,
        { key: cleanKey, label: header, type: 'text' },
      ]);
    }
    handleMappingChange(header, cleanKey);
  };

  const handleApplyPreset = (preset: any) => {
    if (!preset?.mapping) return;
    setColumnMapping((prev) => ({
      ...prev,
      ...preset.mapping,
    }));
  };

  const handleSavePreset = async () => {
    if (!presetNameInput.trim()) {
      alert('Please enter a preset name');
      return;
    }
    try {
      await importsApi.saveMapping(presetNameInput.trim(), columnMapping);
      setPresetNameInput('');
      setIsSavingPreset(false);
      fetchHistoryAndPresets();
      alert('Mapping preset saved successfully');
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const handleDeletePreset = async (id: string) => {
    if (!confirm('Are you sure you want to delete this mapping preset?')) return;
    try {
      await importsApi.deleteMapping(id);
      fetchHistoryAndPresets();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const handleProceedToPreview = async () => {
    if (!parsedPayload) return;
    setPreviewLoading(true);
    try {
      const res = await importsApi.preview({
        columnMapping,
        rows: parsedPayload.allRows,
      });
      setPreviewResult(res);
      setStep(3);
    } catch (err) {
      alert(extractErrorMessage(err));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!parsedPayload) return;
    setImporting(true);
    try {
      const res = await importsApi.execute({
        filename: parsedPayload.filename,
        fileFormat: parsedPayload.fileFormat,
        columnMapping,
        newCustomFields,
        rows: parsedPayload.allRows,
      });
      setImportJobResult(res);
      setStep(5);
      fetchHistoryAndPresets();
    } catch (err) {
      alert(extractErrorMessage(err));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Data Import Engine</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Secure multi-format parser supporting CSV, XLSX, XLS, and XML with dynamic column mapping & MongoDB Atlas persistence.
          </p>
        </div>
        <Link
          href="/contacts"
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Contacts
        </Link>
      </div>

      {/* 5-Step Stepper Wizard Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
        <div className="flex items-center justify-between text-xs font-semibold">
          {[
            { num: 1, label: '1. File Upload' },
            { num: 2, label: '2. Column Mapping' },
            { num: 3, label: '3. Data Preview & Validation' },
            { num: 4, label: '4. Confirmation' },
            { num: 5, label: '5. Import Result' },
          ].map((s, idx, arr) => (
            <React.Fragment key={s.num}>
              <div
                className={`flex items-center gap-2 ${
                  step >= s.num ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                    step >= s.num ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {s.num}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {idx < arr.length - 1 && <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* STEP 1: FILE UPLOAD */}
      {step === 1 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-2xs space-y-6">
          <div className="text-center max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Upload Audience Spreadsheet or Feed</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Supports CSV, XLSX, XLS, and XML feeds up to 20MB. Safe entity expansion disabled.
            </p>
          </div>

          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/50 dark:bg-slate-800/40 transition-colors">
            <input
              type="file"
              id="file-upload"
              accept=".csv, .xlsx, .xls, .xml"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="file-upload" className="cursor-pointer block">
              <FileSpreadsheet className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
              {file ? (
                <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{file.name}</div>
              ) : (
                <>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700">
                    Click to browse file
                  </span>{' '}
                  <span className="text-xs text-slate-500 dark:text-slate-400">from your local system</span>
                </>
              )}
              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">UTF-8 CSV with quotes, Excel Workbooks, XML Feeds</div>
            </label>
          </div>

          {uploadError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-medium">
              {uploadError}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleUploadFile}
              disabled={!file || uploading}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 shadow-xs transition-colors"
            >
              {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {uploading ? 'Parsing File Safely...' : 'Proceed to Column Mapping'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: DYNAMIC COLUMN MAPPING & PRESETS */}
      {step === 2 && parsedPayload && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Map File Columns to Contact Fields</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                File: <strong className="text-slate-800 dark:text-slate-200">{parsedPayload.filename}</strong> (
                {parsedPayload.totalRows.toLocaleString()} rows, {parsedPayload.headers.length} columns detected)
              </p>
            </div>

            {/* Presets Manager */}
            <div className="flex items-center gap-2">
              {savedPresets.length > 0 && (
                <select
                  onChange={(e) => {
                    const preset = savedPresets.find((p) => p._id === e.target.value);
                    if (preset) handleApplyPreset(preset);
                  }}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200"
                >
                  <option value="">Load Saved Mapping Preset...</option>
                  {savedPresets.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={() => setIsSavingPreset(!isSavingPreset)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
              >
                <Bookmark className="w-3.5 h-3.5" />
                Save Preset
              </button>
            </div>
          </div>

          {/* Preset Name Input Drawer */}
          {isSavingPreset && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center gap-3">
              <input
                type="text"
                value={presetNameInput}
                onChange={(e) => setPresetNameInput(e.target.value)}
                placeholder="Preset Name (e.g. Apollo Leads Export)..."
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                type="button"
                onClick={handleSavePreset}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsSavingPreset(false)}
                className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Mapping Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {parsedPayload.headers.map((header) => {
              const currentValue = columnMapping[header] || '';
              const sampleValue = parsedPayload.previewRows[0]?.[header] || '';

              return (
                <div
                  key={header}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/50 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{header}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs mt-0.5">
                        Sample: <span className="font-mono text-slate-700 dark:text-slate-300">{String(sampleValue || '(empty)')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={currentValue}
                      onChange={(e) => handleMappingChange(header, e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">-- Select Contact Field --</option>
                      <option value="__ignore__">❌ Do not import (Ignore column)</option>
                      <optgroup label="Standard Fields">
                        {STANDARD_FIELDS.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                      </optgroup>
                      {newCustomFields.length > 0 && (
                        <optgroup label="New Custom Fields">
                          {newCustomFields.map((cf) => (
                            <option key={cf.key} value={cf.key}>
                              {cf.label} (Custom)
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>

                    <button
                      type="button"
                      onClick={() => handleAddCustomField(header)}
                      title="Create dynamic custom field from this header"
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs flex items-center gap-1 flex-shrink-0 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline text-[11px]">New Field</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleProceedToPreview}
              disabled={previewLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors"
            >
              {previewLoading ? 'Validating Records...' : 'Continue to Preview & Validation'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: DATA PREVIEW & VALIDATION */}
      {step === 3 && previewResult && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Data Preview & Validation Checks</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Review accepted vs invalid records and warnings before finalizing import into MongoDB Atlas.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep(2)}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Back to Mapping
              </button>
              <button
                onClick={() => setStep(4)}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
              >
                Proceed to Confirmation <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Metrics Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Rows</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">{previewResult.totalRows.toLocaleString()}</div>
            </div>

            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
              <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" />
                Valid Records
              </div>
              <div className="text-xl font-bold text-emerald-900 dark:text-emerald-200 mt-1">{previewResult.validRowsCount.toLocaleString()}</div>
            </div>

            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl">
              <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 uppercase flex items-center gap-1">
                <UserX className="w-3.5 h-3.5" />
                Invalid / Skipped
              </div>
              <div className="text-xl font-bold text-rose-900 dark:text-rose-200 mt-1">{previewResult.invalidRowsCount.toLocaleString()}</div>
            </div>

            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl">
              <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Warnings / Duplicates
              </div>
              <div className="text-xl font-bold text-amber-900 dark:text-amber-200 mt-1">
                {previewResult.warningCount + previewResult.duplicateCandidatesCount}
              </div>
            </div>
          </div>

          {/* Row-Level Errors List */}
          {previewResult.errors.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                Row-Level Issues & Warnings ({previewResult.errors.length} detected)
              </div>
              <ul className="list-disc pl-5 text-xs text-amber-800 dark:text-amber-300 space-y-1 max-h-36 overflow-y-auto">
                {previewResult.errors.map((err, i) => (
                  <li key={i}>
                    Row {err.row}: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Normalized Preview Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-800/80 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between">
              <span>Sample Normalized Output (First 10 Rows)</span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">Shows how records will be stored in database</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-4 py-2.5">Full Name</th>
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5">Phone</th>
                    <th className="px-4 py-2.5">Company</th>
                    <th className="px-4 py-2.5">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {previewResult.previewRows.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-2 text-slate-400 dark:text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                      <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span>{r.fullName || `${r.firstName || ''} ${r.lastName || ''}`.trim() || '—'}</span>
                          {r.isDuplicateCandidate && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              Duplicate
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{r.email || '—'}</td>
                      <td className="px-4 py-2 font-mono text-slate-600 dark:text-slate-300">{r.phoneNumber || '—'}</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{r.company || '—'}</td>
                      <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{[r.city, r.country].filter(Boolean).join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: IMPORT CONFIRMATION */}
      {step === 4 && parsedPayload && previewResult && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-2xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Confirm Contact Import</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Review final import summary before writing records into MongoDB Atlas.
            </p>
          </div>

          <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3 text-xs text-slate-700 dark:text-slate-300">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-semibold uppercase">Source File</span>
                <strong className="text-slate-900 dark:text-white text-sm">{parsedPayload.filename}</strong>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-semibold uppercase">Target Database</span>
                <strong className="text-slate-900 dark:text-white text-sm">MongoDB Atlas (contacts)</strong>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 grid grid-cols-3 gap-3">
              <div>
                <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-semibold uppercase">Total Rows</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{previewResult.totalRows.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-semibold uppercase">Valid Contacts to Insert</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">{previewResult.validRowsCount.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500 block text-[10px] font-semibold uppercase">Skipped Rows</span>
                <span className="font-bold text-rose-700 dark:text-rose-400">{previewResult.invalidRowsCount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setStep(3)}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              Back
            </button>
            <button
              onClick={handleExecuteImport}
              disabled={importing}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 shadow-xs transition-colors"
            >
              {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {importing ? 'Saving to MongoDB Atlas...' : `Confirm & Commit ${previewResult.validRowsCount.toLocaleString()} Contacts`}
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: IMPORT RESULT */}
      {step === 5 && importJobResult && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-2xs text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Import Job Completed</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Contacts have been successfully processed, validated, and persisted in MongoDB Atlas.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800 rounded-xl">
              <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">Successful</div>
              <div className="text-xl font-bold text-emerald-900 dark:text-emerald-200">{importJobResult.successfulRows}</div>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800 rounded-xl">
              <div className="text-xs text-amber-700 dark:text-amber-400 font-semibold">Warnings</div>
              <div className="text-xl font-bold text-amber-900 dark:text-amber-200">{importJobResult.warningCount}</div>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-800 rounded-xl">
              <div className="text-xs text-rose-700 dark:text-rose-400 font-semibold">Skipped / Failed</div>
              <div className="text-xl font-bold text-rose-900 dark:text-rose-200">{importJobResult.failedRows}</div>
            </div>
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <Link
              href="/contacts"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
            >
              View Contacts Table
            </Link>
            <button
              onClick={() => {
                setStep(1);
                setFile(null);
                setParsedPayload(null);
                setPreviewResult(null);
                setImportJobResult(null);
              }}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}

      {/* Import History Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Import History & Audit Trail</h2>
          </div>
          <button
            onClick={fetchHistoryAndPresets}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 font-medium"
          >
            <RefreshCw className={`w-3 h-3 ${historyLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
            No previous imports on record.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase">
                <tr>
                  <th className="px-5 py-3">Filename</th>
                  <th className="px-5 py-3">Format</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Total Rows</th>
                  <th className="px-5 py-3">Successful</th>
                  <th className="px-5 py-3">Warnings/Errors</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((h) => (
                  <tr key={h._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{h.filename}</td>
                    <td className="px-5 py-3 uppercase font-mono text-[11px] text-slate-600 dark:text-slate-300">{h.fileFormat}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${
                          h.status === 'completed'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : h.status === 'failed'
                            ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        }`}
                      >
                        {h.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-700 dark:text-slate-300">{h.totalRows}</td>
                    <td className="px-5 py-3 font-mono text-emerald-700 dark:text-emerald-400 font-semibold">{h.successfulRows}</td>
                    <td className="px-5 py-3 font-mono text-amber-700 dark:text-amber-400">{h.warningCount + h.failedRows}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{new Date(h.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
