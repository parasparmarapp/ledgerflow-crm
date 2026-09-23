import type { Expense } from '../types';
import { useEffect, useMemo, useState, ChangeEvent, FormEvent } from 'react';
import { useExpenses } from '../hooks';
import { formatCurrency } from '../lib/currency';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Select, DatePicker } from '../components';
import { ArrowLeft, Calendar, CheckCircle2, CircleDollarSign, FileText, RefreshCw, Save, X, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

type ExpenseForm = {
  description: string;
  category: string;
  amount: number;
  expenseDate: string;
  vendor: string;
  notes: string;
};

type ToastState = {
  message: string;
  type: ToastType;
} | null;

function toDateInputValue(value: string | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

function getExpenseForm(expense: Expense | undefined): ExpenseForm {
  return {
    description: expense?.description || '',
    category: expense?.category || '',
    amount: Number(expense?.amount) || 0,
    expenseDate: toDateInputValue(expense?.expenseDate),
    vendor: expense?.vendor || '',
    notes: expense?.notes || '',
  };
}

function FieldLabel({ children, required = false }: { children: string; required?: boolean }) {
  return (
    <label className="mb-2 block text-sm font-medium text-slate-700">
      {children}
      {required ? <span className="ml-1 text-rose-600">*</span> : null}
    </label>
  );
}

export default function EditExpensePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data, loading, error, refresh, update } = useExpenses();

  const expenses = Array.isArray(data) ? data : [];
  const requestedId = Number(searchParams.get('id') || 0);

  const [selectedId, setSelectedId] = useState<number>(requestedId);
  const [form, setForm] = useState<ExpenseForm>(getExpenseForm(undefined));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const selectedExpense = useMemo(
    () =>
      expenses.find((expense) => expense.id === selectedId) ||
      (requestedId > 0 ? expenses.find((expense) => expense.id === requestedId) : undefined) ||
      expenses[0],
    [expenses, requestedId, selectedId],
  );

  useEffect(() => {
    if (selectedExpense) {
      setSelectedId(selectedExpense.id);
      setForm(getExpenseForm(selectedExpense));
      setFieldErrors({});
    }
  }, [selectedExpense]);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  const updateField = (field: keyof ExpenseForm, value: string | number) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: '' }));
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!form.description.trim()) errors.description = 'Enter a description.';
    if (!form.category.trim()) errors.category = 'Enter a category.';
    if (form.amount <= 0) errors.amount = 'Amount must be greater than zero.';
    if (!form.expenseDate) errors.expenseDate = 'Select an expense date.';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedExpense || !validateForm()) return;
    setShowConfirm(true);
  };

  const handleSave = async () => {
    if (!selectedExpense) return;

    setIsSaving(true);
    try {
      await update(selectedExpense.id, {
        description: form.description.trim(),
        category: form.category.trim(),
        amount: Number(form.amount) || 0,
        expenseDate: form.expenseDate,
        vendor: form.vendor.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      setShowConfirm(false);
      showToast('Expense updated successfully.');
    } catch {
      showToast('Failed to update expense.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
      showToast('Expense data refreshed.', 'info');
    } catch {
      showToast('Unable to refresh expense data.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExpenseSelect = (id: number) => {
    const expense = expenses.find((item) => item.id === id);
    setSelectedId(id);
    setForm(getExpenseForm(expense));
    setFieldErrors({});
  };

  const handleExpenseChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const id = Number(event.target.value) || 0;
    handleExpenseSelect(id);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-56 rounded-lg bg-slate-200" />
          <div className="h-4 w-96 max-w-full rounded bg-slate-200" />
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="h-12 rounded-lg bg-slate-100" />
              <div className="h-12 rounded-lg bg-slate-100" />
              <div className="h-12 rounded-lg bg-slate-100" />
              <div className="h-12 rounded-lg bg-slate-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div>
              <h1 className="text-lg font-semibold text-rose-900">Unable to load expenses</h1>
              <p className="mt-1 text-sm text-rose-700">{error}</p>
              <button
                type="button"
                onClick={handleRefresh}
                className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedExpense) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit Expense</h1>
            <p className="mt-1 text-sm text-slate-500">
              Update expense details and keep your records accurate.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className={isRefreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Refresh
          </button>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center shadow-sm">
          <FileText className="mx-auto h-10 w-10 text-slate-400" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No expenses available</h2>
          <p className="mt-2 text-sm text-slate-500">
            Create an expense before attempting to edit one.
          </p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-6 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-4 inline-flex min-h-[40px] items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit Expense</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review and update the selected expense entry.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        >
          <RefreshCw className={isRefreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Refresh data
        </button>
      </div>

      {expenses.length > 1 ? (
        <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm max-w-xl">
          <Select
            label="Expense record"
            value={selectedExpense.id}
            onChange={(val) => handleExpenseSelect(Number(val))}
            options={expenses.map((expense) => ({
              value: expense.id,
              label: expense.description || 'Untitled expense',
              sublabel: formatCurrency(Number(expense.amount) || 0),
            }))}
            searchable
          />
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-5">
            <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
              <CircleDollarSign className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Expense information</h2>
              <p className="text-sm text-slate-500">Fields marked with an asterisk are required.</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <FieldLabel required>Description</FieldLabel>
              <input
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                placeholder="e.g. Office supplies"
                className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
              {fieldErrors.description ? (
                <p className="mt-2 text-sm text-rose-600">{fieldErrors.description}</p>
              ) : null}
            </div>

            <div>
              <FieldLabel required>Category</FieldLabel>
              <input
                value={form.category}
                onChange={(event) => updateField('category', event.target.value)}
                placeholder="e.g. Operations"
                className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
              {fieldErrors.category ? (
                <p className="mt-2 text-sm text-rose-600">{fieldErrors.category}</p>
              ) : null}
            </div>

            <div>
              <FieldLabel required>Amount</FieldLabel>
              <div className="relative">
                <CircleDollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => updateField('amount', Number(event.target.value) || 0)}
                  className="min-h-[44px] w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                />
              </div>
              {fieldErrors.amount ? (
                <p className="mt-2 text-sm text-rose-600">{fieldErrors.amount}</p>
              ) : null}
            </div>

            <div>
              <DatePicker
                label="Expense date"
                required
                value={form.expenseDate}
                onChange={(dateStr) => updateField('expenseDate', dateStr)}
                error={fieldErrors.expenseDate}
              />
            </div>

            <div>
              <FieldLabel>Vendor</FieldLabel>
              <input
                value={form.vendor}
                onChange={(event) => updateField('vendor', event.target.value)}
                placeholder="Optional vendor name"
                className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="md:col-span-2">
              <FieldLabel>Notes</FieldLabel>
              <textarea
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                rows={5}
                placeholder="Add any useful context about this expense..."
                className="w-full resize-y rounded-lg border border-slate-300 px-3 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-rose-200"
          >
            <Save className="h-4 w-4" />
            Save changes
          </button>
        </div>
      </form>

      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close confirmation"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mb-5 rounded-xl bg-rose-50 p-3 text-rose-600">
              <Save className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Save expense changes?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This will update the expense record with the information you entered.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="min-h-[40px] rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {isSaving ? 'Saving...' : 'Confirm update'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === 'success'
              ? 'bg-emerald-600'
              : toast.type === 'error'
                ? 'bg-red-500'
                : 'bg-indigo-500'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : toast.type === 'error' ? (
            <XCircle className="h-4 w-4 shrink-0" />
          ) : (
            <RefreshCw className="h-4 w-4 shrink-0" />
          )}
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}