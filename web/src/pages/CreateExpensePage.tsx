import type { Expense } from '../types';
import React, { useState, FormEvent, ChangeEvent } from 'react';
import { useExpenses } from '../hooks';
import { formatCurrency } from '../lib/currency';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from '../components';
import { ArrowLeft, Calendar, CheckCircle2, DollarSign, FileText, XCircle, AlertCircle, RefreshCw, Tag as TagIcon } from 'lucide-react';

type ToastState = {
  message: string;
  type: 'success' | 'error' | 'info';
} | null;

type ExpenseForm = {
  description: string;
  category: string;
  amount: string;
  expenseDate: string;
  vendor: string;
  notes: string;
};

type FieldErrors = Partial<Record<keyof ExpenseForm, string>>;

function FieldLabel({
  htmlFor,
  icon,
  children,
  required = false,
}: {
  htmlFor: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
      <span className="text-slate-400">{icon}</span>
      {children}
      {required ? <span className="text-rose-500">*</span> : null}
    </label>
  );
}

function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;

  const Icon = toast.type === 'success' ? CheckCircle2 : toast.type === 'error' ? XCircle : AlertCircle;
  const background =
    toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-500' : 'bg-indigo-500';

  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${background}`}>
      <Icon size={18} />
      <span>{toast.message}</span>
    </div>
  );
}

export default function CreateExpensePage() {
  const navigate = useNavigate();
  const { data, loading, error, create, refresh } = useExpenses();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState<ExpenseForm>({
    description: '',
    category: '',
    amount: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    vendor: '',
    notes: '',
  });

  const recentExpenses: Expense[] = Array.isArray(data) ? data.slice(0, 3) : [];

  const showToast = (message: string, type: ToastState extends null ? never : 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  const updateField = (field: keyof ExpenseForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = (): FieldErrors => {
    const nextErrors: FieldErrors = {};
    if (!form.description.trim()) nextErrors.description = 'Enter a description.';
    if (!form.category.trim()) nextErrors.category = 'Enter a category.';
    if (!form.amount || Number(form.amount) <= 0) nextErrors.amount = 'Enter an amount greater than zero.';
    if (!form.expenseDate) nextErrors.expenseDate = 'Select an expense date.';
    return nextErrors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      showToast('Review the highlighted fields.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      await create({
        description: form.description.trim(),
        category: form.category.trim(),
        amount: Number(form.amount) || 0,
        expenseDate: form.expenseDate,
        ...(form.vendor.trim() ? { vendor: form.vendor.trim() } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      });
      showToast('Expense created successfully!');
      setForm({
        description: '',
        category: '',
        amount: '',
        expenseDate: new Date().toISOString().slice(0, 10),
        vendor: '',
        notes: '',
      });
      setErrors({});
    } catch {
      showToast('Failed to create expense.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    try {
      await refresh();
      showToast('Expense data refreshed.', 'info');
    } catch {
      showToast('Unable to refresh expense data.', 'error');
    }
  };

  const inputClass = (field: keyof ExpenseForm) =>
    `min-h-[44px] w-full rounded-xl border bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 ${
      errors[field] ? 'border-red-300' : 'border-slate-200'
    }`;

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mb-4 inline-flex min-h-[40px] items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-500 transition hover:bg-white hover:text-slate-900"
            >
              <ArrowLeft size={17} />
              Back
            </button>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-rose-100 p-3 text-rose-600">
                <DollarSign size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create Expense</h1>
                <p className="mt-1 text-sm text-slate-500">Record a business expense and keep your accounts up to date.</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {error ? (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
            <div className="flex items-center gap-3">
              <AlertCircle size={18} />
              <span>We couldn&apos;t load expense data. You can still try saving this expense.</span>
            </div>
            <button type="button" onClick={handleRefresh} className="font-semibold underline underline-offset-2">
              Retry
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)]">
          <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-7 border-b border-slate-100 pb-5">
              <h2 className="text-lg font-bold text-slate-900">Expense details</h2>
              <p className="mt-1 text-sm text-slate-500">Add the essential information for this transaction.</p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldLabel htmlFor="description" icon={<FileText size={16} />} required>
                  Description
                </FieldLabel>
                <input
                  id="description"
                  type="text"
                  value={form.description}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => updateField('description', event.target.value)}
                  placeholder="e.g. Office supplies"
                  className={inputClass('description')}
                  aria-invalid={Boolean(errors.description)}
                />
                {errors.description ? <p className="mt-2 text-xs text-red-600">{errors.description}</p> : null}
              </div>

              <div>
                <FieldLabel htmlFor="category" icon={<TagIcon size={16} />} required>
                  Category
                </FieldLabel>
                <input
                  id="category"
                  type="text"
                  value={form.category}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => updateField('category', event.target.value)}
                  placeholder="e.g. Software"
                  className={inputClass('category')}
                  aria-invalid={Boolean(errors.category)}
                />
                {errors.category ? <p className="mt-2 text-xs text-red-600">{errors.category}</p> : null}
              </div>

              <div>
                <FieldLabel htmlFor="amount" icon={<DollarSign size={16} />} required>
                  Amount
                </FieldLabel>
                <div className="relative">
                  <input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => updateField('amount', event.target.value)}
                    placeholder="0.00"
                    className={`${inputClass('amount')} pr-16`}
                    aria-invalid={Boolean(errors.amount)}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-slate-400">
                    GHS
                  </span>
                </div>
                {errors.amount ? <p className="mt-2 text-xs text-red-600">{errors.amount}</p> : null}
              </div>

              <div>
                <DatePicker
                  label="Expense date"
                  required
                  value={form.expenseDate}
                  onChange={(dateStr) => updateField('expenseDate', dateStr)}
                  error={errors.expenseDate}
                />
              </div>

              <div>
                <FieldLabel htmlFor="vendor" icon={<FileText size={16} />}>
                  Vendor
                </FieldLabel>
                <input
                  id="vendor"
                  type="text"
                  value={form.vendor}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => updateField('vendor', event.target.value)}
                  placeholder="Optional vendor name"
                  className={inputClass('vendor')}
                />
              </div>

              <div className="sm:col-span-2">
                <FieldLabel htmlFor="notes" icon={<FileText size={16} />}>
                  Notes
                </FieldLabel>
                <textarea
                  id="notes"
                  rows={4}
                  value={form.notes}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateField('notes', event.target.value)}
                  placeholder="Add any context or supporting details"
                  className={`${inputClass('notes')} py-3`}
                />
              </div>
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-amber-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {isSubmitting ? 'Saving expense...' : 'Save expense'}
              </button>
            </div>
          </form>

          {/* Stripped duplicate layout shell */}
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  );
}