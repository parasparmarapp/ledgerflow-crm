import type { Client } from '../types';
import React, { useState, useEffect } from 'react';
import { useClients } from '../hooks';
import { api } from '../lib/api';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  Mail,
  MapPin,
  Phone,
  UserRound,
  XCircle,
  AlertTriangle,
  BellOff,
  Tag,
  FileText,
} from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

type ToastState = {
  message: string;
  type: ToastType;
} | null;

type ClientFormState = {
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
};

const initialFormState: ClientFormState = {
  name: '',
  companyName: '',
  email: '',
  phone: '',
  billingAddress: '',
  shippingAddress: '',
  taxIdentifier: '',
  segment: '',
  notes: '',
  smsOptOut: false,
  emailOptOut: false,
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs font-medium text-rose-600">{message}</p>;
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
  icon,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  icon?: React.ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </label>
      <div className="relative">
        {icon ? (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span>
        ) : null}
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          className={`min-h-[44px] w-full rounded-xl border bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 ${
            icon ? 'pl-10' : ''
          } ${error ? 'border-rose-300' : 'border-slate-200'}`}
        />
      </div>
      <FieldError message={error} />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
      />
    </div>
  );
}

export default function CreateClientPage() {
  const navigate = useNavigate();
  const { create, loading: isSaving } = useClients();
  const [form, setForm] = useState<ClientFormState>(initialFormState);
  const [errors, setErrors] = useState<Partial<Record<keyof ClientFormState, string>>>({});
  const [toast, setToast] = useState<ToastState>(null);
  const [duplicateClient, setDuplicateClient] = useState<Client | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const updateField = (field: keyof ClientFormState, value: any) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
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
        setCheckingDuplicate(true);
        const params: Record<string, string> = {};
        if (emailTrim) params.email = emailTrim;
        if (phoneTrim) params.phone = phoneTrim;
        const res = await api.get<Client | null>('/clients/duplicates', { params });
        setDuplicateClient(res);
      } catch {
        // Ignore duplicate check failure
      } finally {
        setCheckingDuplicate(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [form.email, form.phone]);

  const validate = () => {
    const nextErrors: Partial<Record<keyof ClientFormState, string>> = {};

    if (!form.name.trim()) {
      nextErrors.name = 'Client name is required.';
    }

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      nextErrors.email = 'Enter a valid email address.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validate()) {
      showToast('Please review the highlighted fields.', 'error');
      return;
    }

    try {
      const created = await create({
        name: form.name.trim(),
        companyName: form.companyName.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        billingAddress: form.billingAddress.trim() || undefined,
        shippingAddress: form.shippingAddress.trim() || undefined,
        taxIdentifier: form.taxIdentifier.trim() || undefined,
        notes: form.notes.trim() || undefined,
        segment: form.segment.trim() || undefined,
        smsOptOut: form.smsOptOut,
        emailOptOut: form.emailOptOut,
        isActive: true,
      });
      showToast('Client created successfully!');
      setTimeout(() => navigate(`/client-profile?id=${created.id}`), 500);
    } catch (err: any) {
      showToast(err?.message || 'Failed to create client. Please try again.', 'error');
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
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                <UserRound className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Create Client
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Add a new client to your workspace with contact info and communication settings.
                </p>
              </div>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-sm text-slate-400 sm:flex">
            <span className="font-medium text-rose-600">Client details</span>
            <ChevronRight className="h-4 w-4" />
            <span>Profile</span>
          </div>
        </div>

        {/* Duplicate Warning Banner */}
        {duplicateClient && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm animate-in fade-in">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <div className="flex-1 text-sm">
              <span className="font-semibold">Potential Duplicate Client Detected:</span>{' '}
              A client with this email or phone is already registered as{' '}
              <span className="font-medium">{duplicateClient.name}</span>
              {duplicateClient.companyName ? ` (${duplicateClient.companyName})` : ''}.
              <div className="mt-2 flex items-center gap-3">
                <Link
                  to={`/client-profile?id=${duplicateClient.id}`}
                  className="font-semibold text-amber-800 underline hover:text-amber-950"
                  target="_blank"
                >
                  View Existing Client Profile #{duplicateClient.id} &rarr;
                </Link>
                <span className="text-xs text-amber-700">You can still proceed if this is an intentional separate entry.</span>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-6">
            {/* Basic Information */}
            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6 border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-900">Basic Information</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Primary identity and contact information for this client.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <TextField
                  label="Client Name"
                  value={form.name}
                  onChange={(val) => updateField('name', val)}
                  placeholder="e.g. Jordan Lee"
                  required
                  icon={<UserRound className="h-4 w-4" />}
                  error={errors.name}
                />
                <TextField
                  label="Company Name"
                  value={form.companyName}
                  onChange={(val) => updateField('companyName', val)}
                  placeholder="e.g. Acme Corp Ltd"
                  icon={<Building2 className="h-4 w-4" />}
                />
                <TextField
                  label="Email Address"
                  value={form.email}
                  onChange={(val) => updateField('email', val)}
                  placeholder="client@example.com"
                  type="email"
                  icon={<Mail className="h-4 w-4" />}
                  error={errors.email}
                />
                <TextField
                  label="Phone Number"
                  value={form.phone}
                  onChange={(val) => updateField('phone', val)}
                  placeholder="e.g. +233 24 000 0000"
                  type="tel"
                  icon={<Phone className="h-4 w-4" />}
                />
                <TextField
                  label="Client Segment / Tag"
                  value={form.segment}
                  onChange={(val) => updateField('segment', val)}
                  placeholder="e.g. VIP, Wholesale, Retail"
                  icon={<Tag className="h-4 w-4" />}
                />
                <TextField
                  label="Tax Identifier"
                  value={form.taxIdentifier}
                  onChange={(val) => updateField('taxIdentifier', val)}
                  placeholder="e.g. TIN / VAT number"
                  icon={<FileText className="h-4 w-4" />}
                />
              </div>
            </section>

            {/* Address Details */}
            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6 border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-900">Address Details</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Billing and shipping addresses used when generating invoices and quotes.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <TextAreaField
                  label="Billing Address"
                  value={form.billingAddress}
                  onChange={(val) => updateField('billingAddress', val)}
                  placeholder="Street, City, Postal Code, Region"
                  rows={3}
                />
                <TextAreaField
                  label="Shipping Address"
                  value={form.shippingAddress}
                  onChange={(val) => updateField('shippingAddress', val)}
                  placeholder="Street, City, Delivery notes"
                  rows={3}
                />
              </div>
            </section>

            {/* Communication Preferences */}
            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <BellOff className="h-5 w-5 text-slate-500" />
                  <h2 className="text-lg font-bold text-slate-900">Communication Preferences</h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Respect client opt-out requests for automated notifications and reminders.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.smsOptOut}
                    onChange={(e) => updateField('smsOptOut', e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="block text-sm font-semibold text-slate-800">
                      Opt-out of SMS Notifications
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Do not send automated SMS payment receipts or reminders to this client.
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
                    <span className="block text-sm font-semibold text-slate-800">
                      Opt-out of Email Notifications
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Do not send automated email invoices, statements, or reminders.
                    </span>
                  </div>
                </label>
              </div>
            </section>

            {/* Notes */}
            <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-slate-900">Internal Notes</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Private notes for your team (never displayed on invoices or receipts).
                </p>
              </div>
              <TextAreaField
                label=""
                value={form.notes}
                onChange={(val) => updateField('notes', val)}
                placeholder="Any special handling instructions, contact preferences, or notes..."
                rows={4}
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
                disabled={isSaving}
                className="min-h-[44px] rounded-xl bg-amber-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50"
              >
                {isSaving ? 'Creating Client...' : 'Create Client'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}