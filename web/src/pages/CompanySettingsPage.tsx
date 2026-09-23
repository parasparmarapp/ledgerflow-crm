import React, { useEffect, useState } from 'react';
import { api } from '../api';
import {
  Building2,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Hash,
  FileText,
  Boxes,
  Bell,
  Mail,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';

interface CompanySettings {
  id?: number;
  companyName: string;
  logoUrl: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  currency: string;
  invoicePrefix: string;
  receiptPrefix: string;
  quotationPrefix: string;
  defaultPaymentTermsDays: number;
  defaultNotes: string;
  defaultTerms: string;
  allowNegativeStock: boolean;
  notifyInvoiceSentEmail: boolean;
  notifyInvoiceSentSms: boolean;
  notifyPaymentEmail: boolean;
  notifyPaymentSms: boolean;
  notifyRemindersEmail: boolean;
  notifyRemindersSms: boolean;
}

const defaultValues: CompanySettings = {
  companyName: '',
  logoUrl: '',
  email: '',
  phone: '',
  address: '',
  taxId: '',
  currency: 'GHS',
  invoicePrefix: 'INV-',
  receiptPrefix: 'RCT-',
  quotationPrefix: 'QT-',
  defaultPaymentTermsDays: 14,
  defaultNotes: '',
  defaultTerms: '',
  allowNegativeStock: false,
  notifyInvoiceSentEmail: true,
  notifyInvoiceSentSms: true,
  notifyPaymentEmail: true,
  notifyPaymentSms: true,
  notifyRemindersEmail: true,
  notifyRemindersSms: true,
};

export default function CompanySettingsPage() {
  const [settings, setSettings] = useState<CompanySettings>(defaultValues);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const data = await api.get<CompanySettings>('/settings/company');
        setSettings({
          companyName: data.companyName || '',
          logoUrl: data.logoUrl || '',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          taxId: data.taxId || '',
          currency: data.currency || 'GHS',
          invoicePrefix: data.invoicePrefix || 'INV-',
          receiptPrefix: data.receiptPrefix || 'RCT-',
          quotationPrefix: data.quotationPrefix || 'QT-',
          defaultPaymentTermsDays: Number(data.defaultPaymentTermsDays || 14),
          defaultNotes: data.defaultNotes || '',
          defaultTerms: data.defaultTerms || '',
          allowNegativeStock: Boolean(data.allowNegativeStock),
          notifyInvoiceSentEmail: data.notifyInvoiceSentEmail ?? true,
          notifyInvoiceSentSms: data.notifyInvoiceSentSms ?? true,
          notifyPaymentEmail: data.notifyPaymentEmail ?? true,
          notifyPaymentSms: data.notifyPaymentSms ?? true,
          notifyRemindersEmail: data.notifyRemindersEmail ?? true,
          notifyRemindersSms: data.notifyRemindersSms ?? true,
        });
      } catch (err: any) {
        showToast(err?.message || 'Failed to load company settings', 'error');
      } finally {
        setLoading(false);
      }
    };
    void fetchSettings();
  }, []);

  const handleChange = (field: keyof CompanySettings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.put<CompanySettings>('/settings/company', settings);
      setSettings(updated);
      showToast('Company settings updated successfully.');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 flex items-center justify-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-amber-600 mr-2" />
        <span>Loading company settings…</span>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 pb-16">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Building2 size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">Company Settings</h1>
                <p className="text-xs text-slate-500">
                  Global branding, tax identifier, document prefixes, inventory policies, and notifications.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-amber-600 px-5 text-xs font-bold text-white shadow-xs hover:bg-amber-700 disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            <span>{saving ? 'Saving…' : 'Save Settings'}</span>
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1: Identity & Contact */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Building2 size={16} className="text-amber-600" />
              <span>Identity & Contact Details</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Company Legal Name *</label>
                <input
                  type="text"
                  required
                  value={settings.companyName}
                  onChange={(e) => handleChange('companyName', e.target.value)}
                  placeholder="e.g. Apex Infrastructure Ltd"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 bg-white outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tax ID / TIN / GSTIN</label>
                <input
                  type="text"
                  value={settings.taxId}
                  onChange={(e) => handleChange('taxId', e.target.value)}
                  placeholder="e.g. C0001234567"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 bg-white outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Official Email</label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="billing@company.com"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 bg-white outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={settings.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="+233 24 123 4567"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 bg-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">Physical Business Address</label>
                <textarea
                  rows={2}
                  value={settings.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="12 Commercial Way, Ridge, Accra, Ghana"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 bg-white outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Currency Code</label>
                <input
                  type="text"
                  value={settings.currency}
                  onChange={(e) => handleChange('currency', e.target.value.toUpperCase())}
                  placeholder="GHS"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold text-slate-800 bg-white outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Default 3-letter currency code (e.g. GHS, USD)</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Company Logo URL</label>
                <input
                  type="url"
                  value={settings.logoUrl}
                  onChange={(e) => handleChange('logoUrl', e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 bg-white outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Used on PDF invoices and receipt headers</p>
              </div>
            </div>
          </div>

          {/* Section 2: Numbering Prefixes */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Hash size={16} className="text-amber-600" />
              <span>Document Number Sequences</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Invoice Prefix</label>
                <input
                  type="text"
                  value={settings.invoicePrefix}
                  onChange={(e) => handleChange('invoicePrefix', e.target.value)}
                  placeholder="INV-"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono text-slate-800 bg-white outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Example: INV-2026-0001</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Receipt Prefix</label>
                <input
                  type="text"
                  value={settings.receiptPrefix}
                  onChange={(e) => handleChange('receiptPrefix', e.target.value)}
                  placeholder="RCT-"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono text-slate-800 bg-white outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Example: RCT-2026-0001</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Quotation Prefix</label>
                <input
                  type="text"
                  value={settings.quotationPrefix}
                  onChange={(e) => handleChange('quotationPrefix', e.target.value)}
                  placeholder="QT-"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono text-slate-800 bg-white outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Example: QT-2026-0001</p>
              </div>
            </div>
          </div>

          {/* Section 3: Default Terms & Notes */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <FileText size={16} className="text-amber-600" />
              <span>Default Invoicing Terms</span>
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Default Payment Window (Days)</label>
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={settings.defaultPaymentTermsDays}
                  onChange={(e) => handleChange('defaultPaymentTermsDays', Number(e.target.value) || 14)}
                  className="w-32 rounded-xl border border-slate-200 p-2.5 text-xs font-mono text-slate-800 bg-white outline-none focus:border-amber-500"
                />
                <span className="text-xs text-slate-500 ml-2">days from issue date</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Default Customer Notes</label>
                <textarea
                  rows={2}
                  value={settings.defaultNotes}
                  onChange={(e) => handleChange('defaultNotes', e.target.value)}
                  placeholder="e.g. Thank you for your business! Please quote invoice number on payment."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 bg-white outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Default Terms & Conditions</label>
                <textarea
                  rows={2}
                  value={settings.defaultTerms}
                  onChange={(e) => handleChange('defaultTerms', e.target.value)}
                  placeholder="e.g. Goods remain property of seller until paid in full. Late payments accrue 2% per month."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 bg-white outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Inventory Policies */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <Boxes size={16} className="text-amber-600" />
              <span>Inventory Policies</span>
            </h2>

            <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 bg-slate-50/50">
              <input
                id="allowNegativeStock"
                type="checkbox"
                checked={settings.allowNegativeStock}
                onChange={(e) => handleChange('allowNegativeStock', e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <label htmlFor="allowNegativeStock" className="cursor-pointer select-none">
                <span className="font-bold text-xs text-slate-800 block">Allow Negative Stock Floor</span>
                <span className="text-[11px] text-slate-500 leading-normal block mt-0.5">
                  When disabled (recommended), invoices and stock adjustments cannot reduce on-hand inventory below zero without explicit admin override.
                </span>
              </label>
            </div>
          </div>

          {/* Section 5: Automated Notifications */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Bell size={16} className="text-amber-600" />
              <span>Automated Dispatch Rules</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 border-b pb-2">
                  <Mail size={14} className="text-amber-600" />
                  <span>Email Dispatches</span>
                </div>
                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifyInvoiceSentEmail}
                    onChange={(e) => handleChange('notifyInvoiceSentEmail', e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Send email when invoice is issued</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifyPaymentEmail}
                    onChange={(e) => handleChange('notifyPaymentEmail', e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Send email receipt when payment is recorded</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifyRemindersEmail}
                    onChange={(e) => handleChange('notifyRemindersEmail', e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Dispatch automated payment reminder emails</span>
                </label>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 border-b pb-2">
                  <MessageSquare size={14} className="text-amber-600" />
                  <span>SMS Dispatches (Arkesel)</span>
                </div>
                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifyInvoiceSentSms}
                    onChange={(e) => handleChange('notifyInvoiceSentSms', e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Send SMS alert when invoice is issued</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifyPaymentSms}
                    onChange={(e) => handleChange('notifyPaymentSms', e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Send SMS receipt when payment is recorded</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifyRemindersSms}
                    onChange={(e) => handleChange('notifyRemindersSms', e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Dispatch automated payment reminder SMS</span>
                </label>
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-600 px-6 text-xs font-bold text-white shadow-xs hover:bg-amber-700 disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span>{saving ? 'Saving Changes…' : 'Save Company Settings'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold text-white shadow-xl ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
