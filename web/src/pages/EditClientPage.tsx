import type { Client } from '../types';
import React, { useEffect, useMemo, useState } from 'react';
import { useClients } from '../hooks';
import { api } from '../lib/api';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Select } from '../components';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Mail,
  Phone,
  X,
  XCircle,
  AlertTriangle,
  Building2,
  Tag,
  FileText,
  BellOff,
  UserRound,
} from 'lucide-react';

type ToastState = {
  message: string;
  type: 'success' | 'error' | 'info';
} | null;

type FormState = {
  name: string;
  companyName: string;
  email: string;
  phone: string;
  billingAddress: string;
  shippingAddress: string;
  taxIdentifier: string;
  segment: string;
  notes: string;
  smsOptOut: boolean;
  emailOptOut: boolean;
  isActive: boolean;
};

function toFormState(client?: Client): FormState {
  return {
    name: client?.name || '',
    companyName: client?.companyName || '',
    email: client?.email || '',
    phone: client?.phone || '',
    billingAddress: client?.billingAddress || '',
    shippingAddress: client?.shippingAddress || '',
    taxIdentifier: client?.taxIdentifier || '',
    segment: client?.segment || '',
    notes: client?.notes || '',
    smsOptOut: Boolean(client?.smsOptOut),
    emailOptOut: Boolean(client?.emailOptOut),
    isActive: client?.isActive ?? true,
  };
}

export default function EditClientPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryId = Number(searchParams.get('id')) || 0;

  const { data: clients = [], loading, error, refresh, update } = useClients();

  const [selectedClientId, setSelectedClientId] = useState<number>(queryId);
  const [form, setForm] = useState<FormState>(toFormState());
  const [fieldError, setFieldError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [duplicateClient, setDuplicateClient] = useState<Client | null>(null);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId),
    [clients, selectedClientId]
  );

  useEffect(() => {
    if (queryId > 0 && clients.some((c) => c.id === queryId)) {
      setSelectedClientId(queryId);
    } else if (queryId === 0 || (!loading && clients.length > 0)) {
      // Missing or unknown client id: go back to the list instead of editing another client.
      navigate('/clients', { replace: true });
    }
  }, [clients, queryId, loading]);

  useEffect(() => {
    if (selectedClient) {
      setForm(toFormState(selectedClient));
      setFieldError('');
      setDuplicateClient(null);
    }
  }, [selectedClient]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (fieldError) setFieldError('');
  };

  // Debounced duplicate detection
  useEffect(() => {
    const emailTrim = form.email.trim();
    const phoneTrim = form.phone.trim();
    if (!emailTrim && !phoneTrim) {
      setDuplicateClient(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const params: Record<string, string> = {};
        if (emailTrim) params.email = emailTrim;
        if (phoneTrim) params.phone = phoneTrim;
        const res = await api.get<Client | null>('/clients/duplicates', { params });
        if (res && res.id !== selectedClientId) {
          setDuplicateClient(res);
        } else {
          setDuplicateClient(null);
        }
      } catch {
        // Ignore
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [form.email, form.phone, selectedClientId]);

  const validate = () => {
    if (!selectedClient) {
      setFieldError('Select a client to edit.');
      return false;
    }

    if (!form.name.trim()) {
      setFieldError('Client name is required.');
      return false;
    }

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setFieldError('Enter a valid email address.');
      return false;
    }

    return true;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !selectedClient) return;

    setSaving(true);
    try {
      await update(selectedClient.id, {
        name: form.name.trim(),
        companyName: form.companyName.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        billingAddress: form.billingAddress.trim() || undefined,
        shippingAddress: form.shippingAddress.trim() || undefined,
        taxIdentifier: form.taxIdentifier.trim() || undefined,
        segment: form.segment.trim() || undefined,
        notes: form.notes.trim() || undefined,
        smsOptOut: form.smsOptOut,
        emailOptOut: form.emailOptOut,
        isActive: form.isActive,
      });

      showToast('Client updated successfully.');
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update client.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50">
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-rose-600' : 'bg-indigo-600'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <XCircle className="h-5 w-5 shrink-0" />
          )}
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="rounded-md p-1 transition hover:bg-white/10"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mb-2 inline-flex min-h-[36px] items-center gap-2 rounded-lg text-sm font-medium text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Edit Client
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Update client contact details, address records, and communication preferences.
            </p>
          </div>

          {selectedClient && (
            <Link
              to={`/client-profile?id=${selectedClient.id}`}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <UserRound className="h-4 w-4 text-slate-500" />
              View Client Profile
            </Link>
          )}
        </div>

        {/* Client Selector (if not locked to query param or just to switch easily) */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Select Client to Edit
          </label>
          <Select
            value={selectedClientId}
            onChange={(val) => setSelectedClientId(Number(val))}
            searchable
            options={clients.map((c) => ({
              value: c.id,
              label: `${c.name}${c.companyName ? ` (${c.companyName})` : ''}`,
              sublabel: c.email || c.phone || 'No direct contact',
            }))}
          />
        </div>

        {/* Duplicate warning */}
        {duplicateClient && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <div className="flex-1 text-sm">
              <span className="font-semibold">Duplicate match with another client:</span>{' '}
              Another client ({duplicateClient.name} #{duplicateClient.id}) is already using this email or phone.
              <div className="mt-1">
                <Link
                  to={`/client-profile?id=${duplicateClient.id}`}
                  className="font-semibold text-amber-800 underline hover:text-amber-950"
                  target="_blank"
                >
                  View conflicting client profile #{duplicateClient.id} &rarr;
                </Link>
              </div>
            </div>
          </div>
        )}

        {fieldError && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{fieldError}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Identity & Basic */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900">Basic Information</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Client Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Company Name</label>
                <input
                  type="text"
                  value={form.companyName}
                  onChange={(e) => updateField('companyName', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Phone Number</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Segment / Tag</label>
                <input
                  type="text"
                  value={form.segment}
                  onChange={(e) => updateField('segment', e.target.value)}
                  placeholder="e.g. VIP, Wholesale"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Tax Identifier</label>
                <input
                  type="text"
                  value={form.taxIdentifier}
                  onChange={(e) => updateField('taxIdentifier', e.target.value)}
                  placeholder="e.g. TIN / VAT"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                />
              </div>
            </div>
          </section>

          {/* Addresses */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900">Address Details</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Billing Address</label>
                <textarea
                  rows={3}
                  value={form.billingAddress}
                  onChange={(e) => updateField('billingAddress', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Shipping Address</label>
                <textarea
                  rows={3}
                  value={form.shippingAddress}
                  onChange={(e) => updateField('shippingAddress', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                />
              </div>
            </div>
          </section>

          {/* Communication Preferences & Status */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <BellOff className="h-5 w-5 text-slate-500" />
                <h2 className="text-lg font-bold text-slate-900">Communication & Status</h2>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.smsOptOut}
                  onChange={(e) => updateField('smsOptOut', e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-amber-500"
                />
                <div>
                  <span className="block text-sm font-semibold text-slate-800">SMS Opt-out</span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    Suppress automated SMS notifications.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.emailOptOut}
                  onChange={(e) => updateField('emailOptOut', e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-amber-500"
                />
                <div>
                  <span className="block text-sm font-semibold text-slate-800">Email Opt-out</span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    Suppress automated email notices.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => updateField('isActive', e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-amber-500"
                />
                <div>
                  <span className="block text-sm font-semibold text-slate-800">Active Status</span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    Uncheck to archive client.
                  </span>
                </div>
              </label>
            </div>
          </section>

          {/* Notes */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Internal Notes</h2>
            <textarea
              rows={4}
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
              placeholder="Internal account history and team notes..."
            />
          </section>

          {/* Actions */}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] rounded-xl bg-amber-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}