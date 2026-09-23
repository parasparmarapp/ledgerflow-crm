import React, { useState, useRef } from 'react';
import { api } from '../lib/api';
import { Select } from './Select';
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Download,
  X,
  HelpCircle,
  FileDown,
} from 'lucide-react';

export interface ImportSummary {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; error: string }[];
}

interface ColumnMapping {
  name: string;
  companyName: string;
  email: string;
  phone: string;
  billingAddress: string;
  shippingAddress: string;
  segment: string;
  taxIdentifier: string;
  notes: string;
}

const DEFAULT_MAPPING: ColumnMapping = {
  name: '',
  companyName: '',
  email: '',
  phone: '',
  billingAddress: '',
  shippingAddress: '',
  segment: '',
  taxIdentifier: '',
  notes: '',
};

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.every((v) => !v)) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

export interface ClientImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ClientImportModal({ isOpen, onClose, onSuccess }: ClientImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'result'>('upload');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>(DEFAULT_MAPPING);
  const [onDuplicate, setOnDuplicate] = useState<'skip' | 'update'>('skip');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [showMappingExplanation, setShowMappingExplanation] = useState(true);

  if (!isOpen) return null;

  const resetState = () => {
    setStep('upload');
    setCsvHeaders([]);
    setRawRows([]);
    setMapping(DEFAULT_MAPPING);
    setErrorMessage(null);
    setSummary(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'Name',
      'Company Name',
      'Email',
      'Phone',
      'Billing Address',
      'Shipping Address',
      'Segment',
      'Tax ID',
      'Notes',
    ];
    const sampleRows = [
      [
        'Acme Corporation',
        'Acme Corp LLC',
        'billing@acme.com',
        '+1 555-0199',
        '123 Market St, Suite 400, San Francisco, CA',
        '123 Market St, Suite 400, San Francisco, CA',
        'Enterprise',
        'US-123456789',
        'VIP client with net-30 payment terms',
      ],
      [
        'Global Tech Solutions',
        'Global Tech Ltd',
        'contact@globaltech.io',
        '+1 555-0245',
        '456 Innovation Way, Austin, TX',
        '456 Innovation Way, Austin, TX',
        'SMB',
        'US-987654321',
        'Quarterly software retainer',
      ],
    ];

    const csvContent = [
      headers.join(','),
      ...sampleRows.map((row) =>
        row.map((val) => `"${val.replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'clients_import_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const autoMapHeaders = (headers: string[]): ColumnMapping => {
    const map = { ...DEFAULT_MAPPING };
    const lower = headers.map((h) => ({ original: h, lower: h.toLowerCase().replace(/[^a-z0-9]/g, '') }));

    const findMatch = (candidates: string[]) => {
      const found = lower.find((l) => candidates.includes(l.lower));
      return found ? found.original : '';
    };

    map.name = findMatch(['name', 'clientname', 'fullname', 'client', 'contactname']);
    map.companyName = findMatch(['company', 'companyname', 'organization', 'business', 'org']);
    map.email = findMatch(['email', 'emailaddress', 'contactemail']);
    map.phone = findMatch(['phone', 'phonenumber', 'mobile', 'tel', 'cell']);
    map.billingAddress = findMatch(['billingaddress', 'address', 'streetaddress', 'location']);
    map.shippingAddress = findMatch(['shippingaddress', 'deliveryaddress']);
    map.segment = findMatch(['segment', 'group', 'tag', 'category', 'type', 'clienttype']);
    map.taxIdentifier = findMatch(['taxid', 'taxidentifier', 'tin', 'vat', 'vatnumber', 'taxnumber']);
    map.notes = findMatch(['notes', 'comments', 'description', 'remarks']);

    return map;
  };

  const handleFileUpload = (file: File) => {
    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const { headers, rows } = parseCsv(text);
        if (headers.length === 0 || rows.length === 0) {
          setErrorMessage('The CSV file appears to be empty or improperly formatted.');
          return;
        }
        setCsvHeaders(headers);
        setRawRows(rows);
        setMapping(autoMapHeaders(headers));
        setStep('map');
      } catch (err: any) {
        setErrorMessage(err?.message || 'Failed to read CSV file.');
      }
    };
    reader.readAsText(file);
  };

  const getMappedRows = () => {
    return rawRows.map((r) => ({
      name: mapping.name ? r[mapping.name]?.trim() : '',
      companyName: mapping.companyName ? r[mapping.companyName]?.trim() || undefined : undefined,
      email: mapping.email ? r[mapping.email]?.trim() || undefined : undefined,
      phone: mapping.phone ? r[mapping.phone]?.trim() || undefined : undefined,
      billingAddress: mapping.billingAddress ? r[mapping.billingAddress]?.trim() || undefined : undefined,
      shippingAddress: mapping.shippingAddress ? r[mapping.shippingAddress]?.trim() || undefined : undefined,
      segment: mapping.segment ? r[mapping.segment]?.trim() || undefined : undefined,
      taxIdentifier: mapping.taxIdentifier ? r[mapping.taxIdentifier]?.trim() || undefined : undefined,
      notes: mapping.notes ? r[mapping.notes]?.trim() || undefined : undefined,
    }));
  };

  const handleExecuteImport = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const rows = getMappedRows().filter((r) => r.name);
      if (rows.length === 0) {
        throw new Error('No valid rows to import. Ensure the "Client Name" column is mapped correctly.');
      }

      const res = await api.post<ImportSummary>('/clients/import', {
        rows,
        onDuplicate,
      });

      setSummary(res);
      setStep('result');
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to process import.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col my-8 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <Upload className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Import Clients CSV</h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Bulk import or update client records from your spreadsheet.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stepper bar */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-2.5 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                step === 'upload' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              1
            </span>
            <span className={step === 'upload' ? 'text-amber-700 font-bold' : 'text-slate-500'}>
              Upload File
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                step === 'map' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              2
            </span>
            <span className={step === 'map' ? 'text-amber-700 font-bold' : 'text-slate-500'}>
              Map Columns
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                step === 'preview' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              3
            </span>
            <span className={step === 'preview' ? 'text-amber-700 font-bold' : 'text-slate-500'}>
              Preview
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                step === 'result' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              4
            </span>
            <span className={step === 'result' ? 'text-amber-700 font-bold' : 'text-slate-500'}>
              Finish
            </span>
          </div>

          {step === 'upload' && (
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50 hover:border-rose-300"
            >
              <Download className="h-3.5 w-3.5" />
              Download Template
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {errorMessage && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Template Download Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-rose-100 bg-rose-50/50 p-4 text-left">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm text-rose-600 border border-rose-100">
                    <FileDown className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Need the official CSV format?
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-600">
                      Download our pre-formatted template with sample rows. When you upload it, all columns will map automatically.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-rose-700 shadow-sm border border-rose-200 hover:bg-rose-50 transition"
                >
                  <Download className="h-4 w-4" />
                  Download CSV Template
                </button>
              </div>

              {/* Upload Dropzone */}
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="mx-auto flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center transition hover:border-rose-400 hover:bg-rose-50/30"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 mb-3">
                  <FileSpreadsheet className="h-7 w-7" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Click to select CSV file or drag and drop here
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Standard comma-separated format (.csv) up to 5,000 rows
                </p>
                <button
                  type="button"
                  className="mt-4 inline-flex min-h-[38px] items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                >
                  <Upload className="h-4 w-4" />
                  Select CSV File
                </button>
              </div>

              <div className="border-t border-slate-100 pt-4 text-left">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Recognized Fields
                </h4>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {[
                    'Name (Required)',
                    'Company Name',
                    'Email Address',
                    'Phone Number',
                    'Billing Address',
                    'Shipping Address',
                    'Segment / Category',
                    'Tax ID / VAT',
                    'Notes',
                  ].map((field) => (
                    <span
                      key={field}
                      className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: MAP COLUMNS */}
          {step === 'map' && (
            <div className="space-y-5">
              {/* Column Mapping Explanation Banner */}
              {showMappingExplanation && (
                <div className="relative rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-sky-900">
                  <button
                    type="button"
                    onClick={() => setShowMappingExplanation(false)}
                    className="absolute right-2 top-2 p-1 text-sky-400 hover:text-sky-600"
                    title="Dismiss"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="flex items-start gap-2.5">
                    <HelpCircle className="h-5 w-5 shrink-0 text-sky-600 mt-0.5" />
                    <div className="text-xs leading-relaxed">
                      <p className="font-semibold text-sky-950">
                        What does &ldquo;Map Columns&rdquo; mean?
                      </p>
                      <p className="mt-1 text-sky-800">
                        Different systems name columns differently (for example, your file might use <strong>&ldquo;Customer&rdquo;</strong> while LedgerFlow uses <strong>&ldquo;Client Name&rdquo;</strong>, or <strong>&ldquo;Mobile&rdquo;</strong> instead of <strong>&ldquo;Phone&rdquo;</strong>).
                      </p>
                      <p className="mt-1 text-sky-800">
                        Column mapping lets you match the header from your CSV with the corresponding LedgerFlow field so data lands in the right place. We&apos;ve automatically matched best guesses below.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Map CSV Columns</h3>
                  <p className="text-xs text-slate-500">
                    Found {rawRows.length} rows and {csvHeaders.length} columns in your file.
                  </p>
                </div>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                {(
                  [
                    { key: 'name', label: 'Client Name', required: true },
                    { key: 'companyName', label: 'Company Name' },
                    { key: 'email', label: 'Email Address' },
                    { key: 'phone', label: 'Phone Number' },
                    { key: 'billingAddress', label: 'Billing Address' },
                    { key: 'shippingAddress', label: 'Shipping Address' },
                    { key: 'segment', label: 'Segment / Category' },
                    { key: 'taxIdentifier', label: 'Tax ID / VAT' },
                    { key: 'notes', label: 'Notes / Remarks' },
                  ] as { key: keyof ColumnMapping; label: string; required?: boolean }[]
                ).map(({ key, label, required }) => (
                  <div key={key}>
                    <Select
                      label={`${label}${required ? ' *' : ''}`}
                      required={required}
                      value={mapping[key]}
                      onChange={(val) => setMapping((m) => ({ ...m, [key]: val }))}
                      placeholder="— Do not import —"
                      options={[
                        { value: '', label: '— Do not import —' },
                        ...csvHeaders.map((h) => ({
                          value: h,
                          label: h,
                        })),
                      ]}
                    />
                  </div>
                ))}
              </div>

              {/* Duplicate Strategy */}
              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-semibold text-slate-900 mb-1.5">Duplicate Strategy</h4>
                <p className="text-[11px] text-slate-500 mb-3">
                  How should LedgerFlow handle records with matching email or phone numbers?
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <label
                    className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                      onDuplicate === 'skip'
                        ? 'border-rose-300 bg-rose-50/40 ring-1 ring-rose-200'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="modalDupStrategy"
                      value="skip"
                      checked={onDuplicate === 'skip'}
                      onChange={() => setOnDuplicate('skip')}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="block text-xs font-semibold text-slate-800">
                        Skip Duplicates (Recommended)
                      </span>
                      <span className="block text-[11px] text-slate-500 mt-0.5">
                        Keep existing clients unchanged and skip matching rows.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition ${
                      onDuplicate === 'update'
                        ? 'border-rose-300 bg-rose-50/40 ring-1 ring-rose-200'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="modalDupStrategy"
                      value="update"
                      checked={onDuplicate === 'update'}
                      onChange={() => setOnDuplicate('update')}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="block text-xs font-semibold text-slate-800">
                        Update Existing Clients
                      </span>
                      <span className="block text-[11px] text-slate-500 mt-0.5">
                        Overwrite existing client details with incoming data.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Data Preview</h3>
                  <p className="text-xs text-slate-500">
                    Previewing first 5 of {rawRows.length} client records before importing.
                  </p>
                </div>
                <span className="rounded-md bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                  Duplicate: {onDuplicate === 'skip' ? 'Skip' : 'Update'}
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 font-semibold text-slate-600 uppercase text-[10px] tracking-wider sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Company</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Phone</th>
                      <th className="px-3 py-2">Segment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {getMappedRows()
                      .slice(0, 5)
                      .map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium text-slate-900">
                            {row.name || <span className="text-rose-500 italic">Missing (Required)</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{row.companyName || '—'}</td>
                          <td className="px-3 py-2 text-slate-600">{row.email || '—'}</td>
                          <td className="px-3 py-2 text-slate-600">{row.phone || '—'}</td>
                          <td className="px-3 py-2 text-slate-600">{row.segment || '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 4: RESULT */}
          {step === 'result' && summary && (
            <div className="py-2 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-3">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Import Complete</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Processed {rawRows.length} rows successfully.
              </p>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-xl font-bold text-emerald-700">{summary.created}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 mt-0.5">
                    Created
                  </p>
                </div>
                <div className="rounded-xl bg-indigo-50 p-3">
                  <p className="text-xl font-bold text-indigo-700">{summary.updated}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-800 mt-0.5">
                    Updated
                  </p>
                </div>
                <div className="rounded-xl bg-slate-100 p-3">
                  <p className="text-xl font-bold text-slate-700">{summary.skipped}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 mt-0.5">
                    Skipped
                  </p>
                </div>
              </div>

              {summary.errors && summary.errors.length > 0 && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left">
                  <div className="flex items-center gap-1.5 text-amber-900 font-semibold text-xs mb-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    Row Warnings ({summary.errors.length})
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1 text-[11px] text-amber-800">
                    {summary.errors.map((err, i) => (
                      <div key={i}>
                        Row {err.row}: {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-3.5">
          {step === 'upload' && (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-white transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl bg-amber-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition"
              >
                Browse CSV File
              </button>
            </>
          )}

          {step === 'map' && (
            <>
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-white transition"
              >
                &larr; Choose Different File
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!mapping.name) {
                    setErrorMessage('Please select a column for "Client Name".');
                    return;
                  }
                  setErrorMessage(null);
                  setStep('preview');
                }}
                className="rounded-xl bg-amber-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition"
              >
                Preview Data &rarr;
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                type="button"
                onClick={() => setStep('map')}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-white transition"
              >
                &larr; Back to Mapping
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition disabled:opacity-50"
              >
                {isSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                {isSubmitting ? 'Importing...' : `Import ${rawRows.length} Clients`}
              </button>
            </>
          )}

          {step === 'result' && (
            <div className="flex w-full justify-end gap-2.5">
              <button
                type="button"
                onClick={resetState}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-white transition"
              >
                Import Another
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl bg-amber-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
