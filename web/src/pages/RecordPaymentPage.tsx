import type { Invoice, Payment } from '../types';
import React, { useMemo, useState } from 'react';
import { useInvoices, usePayments } from '../hooks';
import { api } from '../lib/api';
import { formatCurrency } from '../lib/currency';
import { ROUTES } from '../routes';
import { useNavigate } from 'react-router-dom';
import { Select, DatePicker } from '../components';
import { AlertCircle, ArrowRight, Calendar, CheckCircle2, ChevronRight, CreditCard, FileText, Loader2, RefreshCw, Search, XCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

type ToastState = {
  message: string;
  type: ToastType;
} | null;

type PaymentForm = {
  invoiceId: number;
  amount: number;
  paymentDate: string;
  method: string;
  reference: string;
  notes: string;
};

function ActionButton({
  children,
  onClick,
  type = 'button',
  disabled = false,
  variant = 'primary',
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
}) {
  const styles =
    variant === 'primary'
      ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-sm'
      : variant === 'secondary'
        ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
        : 'text-slate-600 hover:bg-slate-100';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

function FieldLabel({
  label,
  required = false,
}: {
  label: string;
  required?: boolean;
}) {
  return (
    <label className="mb-2 block text-sm font-semibold text-slate-700">
      {label}
      {required ? <span className="ml-1 text-rose-600">*</span> : null}
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const isPaid = normalized === 'paid' || normalized === 'completed';
  const isOverdue = normalized === 'overdue';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        isPaid
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : isOverdue
            ? 'border-rose-200 bg-rose-50 text-rose-700'
            : 'border-amber-200 bg-amber-50 text-amber-700'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isPaid ? 'bg-emerald-500' : isOverdue ? 'bg-rose-500' : 'bg-amber-500'
        }`}
      />
      {status || 'Pending'}
    </span>
  );
}

export default function RecordPaymentPage() {
  const navigate = useNavigate();
  const { data: invoices = [], loading, error, refresh } = useInvoices();
  const { create: recordPayment } = usePayments();

  const [form, setForm] = useState<PaymentForm>({
    invoiceId: 0,
    amount: 0,
    paymentDate: new Date().toISOString().slice(0, 10),
    method: 'Bank transfer',
    reference: '',
    notes: '',
  });
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [fieldError, setFieldError] = useState('');

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return invoices;

    return invoices.filter((invoice: Invoice) => {
      const invoiceNumber = String(invoice?.invoiceNumber || '').toLowerCase();
      const status = String(invoice?.status || '').toLowerCase();
      return invoiceNumber.includes(query) || status.includes(query) || String(invoice?.id || '').includes(query);
    });
  }, [invoices, search]);

  const selectedInvoice = useMemo(
    () => invoices.find((invoice: Invoice) => invoice.id === form.invoiceId),
    [form.invoiceId, invoices],
  );

  const selectedBalance = selectedInvoice
    ? Math.max(Number(selectedInvoice.totalAmount || 0) - Number(selectedInvoice.amountPaid || 0), 0)
    : 0;

  const totalOutstanding = useMemo(
    () =>
      invoices.reduce(
        (total: number, invoice: Invoice) =>
          total + Math.max(Number(invoice?.totalAmount || 0) - Number(invoice?.amountPaid || 0), 0),
        0,
      ),
    [invoices],
  );

  const handleInvoiceChange = (invoiceId: number) => {
    const invoice = invoices.find((item: Invoice) => item.id === invoiceId);
    const balance = invoice
      ? Math.max(Number(invoice.totalAmount || 0) - Number(invoice.amountPaid || 0), 0)
      : 0;

    setForm((current) => ({
      ...current,
      invoiceId,
      amount: balance,
    }));
    setFieldError('');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
      showToast('Invoice data refreshed.', 'info');
    } catch {
      showToast('Unable to refresh invoice data.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.invoiceId) {
      setFieldError('Select an invoice before recording a payment.');
      return;
    }

    if (!form.amount || form.amount <= 0) {
      setFieldError('Enter a payment amount greater than zero.');
      return;
    }

    if (selectedBalance > 0 && form.amount > selectedBalance) {
      setFieldError('Payment amount cannot exceed the remaining invoice balance.');
      return;
    }

    if (!form.paymentDate || !form.method) {
      setFieldError('Complete all required payment fields.');
      return;
    }

    setIsSubmitting(true);
    setFieldError('');

    try {
      const created = await recordPayment({
        invoiceId: form.invoiceId,
        clientId: selectedInvoice?.clientId ?? 0,
        amount: Number(form.amount),
        paymentDate: form.paymentDate,
        method: form.method,
        reference: form.reference.trim() || undefined,
        notes: form.notes.trim() || undefined,
        status: 'Completed',
      } as any);

      showToast('Payment recorded successfully.');
      window.setTimeout(() => navigate(`/payment-details?id=${created.id}`), 700);
      setForm({
        invoiceId: 0,
        amount: 0,
        paymentDate: new Date().toISOString().slice(0, 10),
        method: 'Bank transfer',
        reference: '',
        notes: '',
      });
      await refresh();
    } catch {
      showToast('Failed to record payment.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500">
            <CreditCard className="h-4 w-4" />
            Payments
            <ChevronRight className="h-4 w-4 text-slate-300" />
            Record payment
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Record Payment</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Apply a customer payment to an outstanding invoice and keep your accounts up to date.
          </p>
        </div>
        <ActionButton variant="secondary" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh invoices
        </ActionButton>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Open invoices</p>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900">{invoices.length}</p>
          <p className="mt-1 text-xs text-slate-500">Available for payment allocation</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Outstanding balance</p>
          <p className="mt-2 font-mono text-2xl font-bold text-slate-900">{formatCurrency(totalOutstanding)}</p>
          <p className="mt-1 text-xs text-slate-500">Across loaded invoices</p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">Selected balance</p>
          <p className="mt-2 font-mono text-2xl font-bold text-rose-700">{formatCurrency(selectedBalance)}</p>
          <p className="mt-1 text-xs text-rose-600">
            {selectedInvoice ? selectedInvoice.invoiceNumber : 'Choose an invoice to begin'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200/80 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Select an invoice</h2>
              <p className="mt-1 text-sm text-slate-500">Choose the invoice that should receive this payment.</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search invoices..."
                className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[280px] items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
              Loading invoices...
            </div>
          ) : error ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
              <AlertCircle className="h-8 w-8 text-rose-500" />
              <p className="mt-3 font-semibold text-slate-900">Unable to load invoices</p>
              <p className="mt-1 text-sm text-slate-500">{String(error)}</p>
              <ActionButton className="mt-4" onClick={handleRefresh}>
                Try again
              </ActionButton>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
              <FileText className="h-9 w-9 text-slate-300" />
              <p className="mt-3 font-semibold text-slate-900">
                {search ? 'No matching invoices' : 'No invoices available'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {search ? 'Try a different search term.' : 'Invoices will appear here when they are available.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Invoice</th>
                    <th className="px-6 py-3 font-semibold">Due date</th>
                    <th className="px-6 py-3 text-right font-semibold">Total</th>
                    <th className="px-6 py-3 text-right font-semibold">Balance</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.map((invoice: Invoice) => {
                    const balance = Math.max(
                      Number(invoice.totalAmount || 0) - Number(invoice.amountPaid || 0),
                      0,
                    );
                    const isSelected = invoice.id === form.invoiceId;

                    return (
                      <tr
                        key={invoice.id}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-rose-50/60' : 'hover:bg-slate-50'
                        }`}
                        onClick={() => handleInvoiceChange(invoice.id)}
                      >
                        <td className="px-6 py-4">
                          <p className="font-mono text-sm font-semibold text-slate-900">
                            {invoice.invoiceNumber || `INV-${invoice.id}`}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">Client ID #{invoice.clientId}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-US') : '—'}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-sm text-slate-700">
                          {formatCurrency(Number(invoice.totalAmount || 0))}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-sm font-semibold text-slate-900">
                          {formatCurrency(balance)}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={String(invoice.status || 'Pending')} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            aria-label={`Select ${invoice.invoiceNumber || `invoice ${invoice.id}`}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleInvoiceChange(invoice.id);
                            }}
                            className={`rounded-lg p-2 transition-colors ${
                              isSelected
                                ? 'bg-amber-600 text-white'
                                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                            }`}
                          >
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">Payment details</h2>
            <p className="mt-1 text-sm text-slate-500">Enter the details exactly as received.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <FieldLabel label="Selected invoice" required />
              <div className="flex min-h-[46px] items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
                {selectedInvoice ? (
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="font-mono font-semibold text-slate-900">
                      {selectedInvoice.invoiceNumber || `INV-${selectedInvoice.id}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleInvoiceChange(0)}
                      className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                      aria-label="Clear selected invoice"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <span className="text-slate-400">Select an invoice from the list</span>
                )}
              </div>
            </div>

            <div>
              <FieldLabel label="Payment amount" required />
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount || ''}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      amount: Number(event.target.value) || 0,
                    }))
                  }
                  className="min-h-[46px] w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  placeholder="0.00"
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">Remaining balance: {formatCurrency(selectedBalance)}</p>
            </div>

            <div>
              <DatePicker
                label="Payment date"
                required
                value={form.paymentDate}
                onChange={(dateStr) => setForm((current) => ({ ...current, paymentDate: dateStr }))}
              />
            </div>

            <div>
              <Select
                label="Payment method"
                required
                value={form.method}
                onChange={(val) => setForm((current) => ({ ...current, method: String(val) }))}
                options={[
                  { value: 'E-Payment', label: 'E-Payment (Electronic / Online)' },
                  { value: 'Cash Payment', label: 'Cash Payment' },
                  { value: 'Bank transfer', label: 'Bank transfer' },
                  { value: 'Credit card', label: 'Credit card' },
                  { value: 'Debit card', label: 'Debit card' },
                  { value: 'Check', label: 'Check' },
                  { value: 'Other', label: 'Other' },
                ]}
              />
            </div>

            <div>
              <FieldLabel label="Reference number" />
              <input
                value={form.reference}
                onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))}
                placeholder="e.g. transaction or check number"
                className="min-h-[46px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div>
              <FieldLabel label="Notes" />
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                rows={3}
                placeholder="Add an internal note..."
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>

            {fieldError ? (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{fieldError}</span>
              </div>
            ) : null}

            <ActionButton type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {isSubmitting ? 'Recording payment...' : 'Record payment'}
            </ActionButton>
          </form>
        </section>
      </div>

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
            <CheckCircle2 className="h-4 w-4" />
          ) : toast.type === 'error' ? (
            <XCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}