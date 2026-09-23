import type { Payment } from '../types';
import { useMemo, useState } from 'react';
import { api } from '../api';
import { usePayments } from '../hooks';
import { formatCurrency } from '../lib/currency';
import { ROUTES } from '../routes';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ChevronRight, Download, Eye, RefreshCw, Search, X, XCircle, Activity as ActivityIcon } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

type ToastState = {
  message: string;
  type: ToastType;
} | null;

export default function PaymentReconciliationPage() {
  const navigate = useNavigate();
  const { data: payments, loading, error, refresh, reconcile } = usePayments();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  const paymentRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return (payments || []).filter((payment) => {
      const paymentStatus = String(payment?.status || '').toLowerCase();
      const searchableText = [
        payment?.id,
        payment?.invoiceId,
        payment?.clientId,
        payment?.method,
        payment?.reference,
        payment?.paymentDate,
      ]
        .map((value) => String(value ?? ''))
        .join(' ')
        .toLowerCase();

      const matchesSearch =
        normalizedSearch.length === 0 || searchableText.includes(normalizedSearch);

      const matchesStatus =
        statusFilter === 'all' || paymentStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [payments, search, statusFilter]);

  const selectedPayments = useMemo(
    () => (payments || []).filter((payment) => selectedIds.includes(payment.id)),
    [payments, selectedIds],
  );

  const totalAmount = useMemo(
    () =>
      paymentRows.reduce(
        (sum, payment) => sum + Number(payment?.amount || 0),
        0,
      ),
    [paymentRows],
  );

  const reconciledCount = useMemo(
    () =>
      (payments || []).filter(
        (payment) =>
          String(payment?.status || '').toLowerCase() === 'reconciled',
      ).length,
    [payments],
  );

  const pendingCount = useMemo(
    () =>
      (payments || []).filter((payment) => {
        const status = String(payment?.status || '').toLowerCase();
        return status === 'pending' || status === 'unreconciled';
      }).length,
    [payments],
  );

  const toggleSelection = (id: number) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  };

  const toggleVisibleSelection = () => {
    const visibleIds = paymentRows.map((payment) => payment.id);
    const allVisibleSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selectedIds.includes(id));

    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds])),
    );
  };

  const reconcileSelected = async () => {
    if (selectedIds.length === 0) {
      showToast('Select at least one payment to reconcile.', 'info');
      return;
    }

    setIsReconciling(true);
    try {
      await reconcile(selectedIds);
      setSelectedIds([]);
      await refresh();
      showToast(
        `${selectedIds.length} payment${selectedIds.length === 1 ? '' : 's'} reconciled successfully.`,
      );
    } catch {
      showToast('Failed to reconcile selected payments.', 'error');
    } finally {
      setIsReconciling(false);
    }
  };

  const refreshPayments = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
      showToast('Payments refreshed.', 'info');
    } catch {
      showToast('Unable to refresh payments.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const exportPayments = () => {
    if (paymentRows.length === 0) {
      showToast('There are no payments to export.', 'info');
      return;
    }

    const header = 'Payment ID,Invoice ID,Client ID,Amount,Date,Method,Status,Reference';
    const rows = paymentRows.map((payment) =>
      [
        payment.id,
        payment.invoiceId,
        payment.clientId,
        Number(payment.amount || 0),
        payment.paymentDate,
        payment.method,
        payment.status,
        payment.reference || '',
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(','),
    );

    const blob = new Blob([[header, ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'payment-reconciliation.csv';
    link.click();
    URL.revokeObjectURL(url);
    showToast('Payment reconciliation exported.', 'success');
  };

  const statusClass = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === 'reconciled' || normalized === 'completed') {
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    }
    if (normalized === 'cancelled' || normalized === 'failed') {
      return 'border-red-200 bg-red-50 text-red-700';
    }
    return 'border-amber-200 bg-amber-50 text-amber-700';
  };

  const formatDate = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? value || '—'
      : parsed.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
  };

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Reconciliation workspace active
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Payment Reconciliation
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Review incoming payments, resolve outstanding matches, and keep
              your ledger in sync.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={refreshPayments}
              disabled={isRefreshing}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={isRefreshing ? 'animate-spin' : ''}
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={exportPayments}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
            >
              <Download size={16} />
              Export CSV
            </button>
            <button
              type="button"
              onClick={reconcileSelected}
              disabled={isReconciling || selectedIds.length === 0}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 size={16} />
              {isReconciling ? 'Reconciling…' : 'Reconcile selected'}
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Visible payments
            </p>
            <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-slate-900">
              {paymentRows.length}
            </p>
            <p className="mt-2 text-xs text-slate-500">Current filtered view</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Visible amount
            </p>
            <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-slate-900">
              {formatCurrency(totalAmount)}
            </p>
            <p className="mt-2 text-xs text-slate-500">Across displayed payments</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Reconciled
            </p>
            <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-slate-900">
              {reconciledCount}
            </p>
            <p className="mt-2 text-xs text-emerald-600">Matches confirmed</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Needs review
            </p>
            <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-slate-900">
              {pendingCount}
            </p>
            <p className="mt-2 text-xs text-amber-600">Pending or unreconciled</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-200/80 p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    Payment matching queue
                  </h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {paymentRows.length}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Select payments that have been matched against your bank
                  activity.
                </p>
              </div>

              <div className="relative w-full lg:max-w-sm">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search payments..."
                  className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`min-h-[36px] rounded-lg px-3 text-sm font-semibold transition ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`min-h-[36px] rounded-lg px-3 text-sm font-semibold transition ${
                  statusFilter === 'pending'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('unreconciled')}
                className={`min-h-[36px] rounded-lg px-3 text-sm font-semibold transition ${
                  statusFilter === 'unreconciled'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Unreconciled
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('reconciled')}
                className={`min-h-[36px] rounded-lg px-3 text-sm font-semibold transition ${
                  statusFilter === 'reconciled'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Reconciled
              </button>
            </div>
          </div>

          {error ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <AlertCircle size={30} className="text-red-500" />
              <h3 className="mt-4 text-base font-bold text-slate-900">
                Could not load payments
              </h3>
              <p className="mt-2 text-sm text-slate-500">{String(error)}</p>
              <button
                type="button"
                onClick={refreshPayments}
                className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700"
              >
                <RefreshCw size={16} />
                Try again
              </button>
            </div>
          ) : loading ? (
            <div className="space-y-3 p-6">
              <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : paymentRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <ActivityIcon size={32} className="text-slate-300" />
              <h3 className="mt-4 text-base font-bold text-slate-900">
                No payments found
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Try adjusting your search or status filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                }}
                className="mt-5 min-h-[40px] rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200/80">
                    <th className="w-14 px-5 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={
                          paymentRows.length > 0 &&
                          paymentRows.every((payment) =>
                            selectedIds.includes(payment.id),
                          )
                        }
                        onChange={toggleVisibleSelection}
                        aria-label="Select visible payments"
                        className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-amber-500"
                      />
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Payment
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Invoice / Client
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Date
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Amount
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentRows.map((payment) => {
                    const status = String(payment?.status || 'pending');
                    const isSelected = selectedIds.includes(payment.id);

                    return (
                      <tr
                        key={payment.id}
                        className={`transition hover:bg-slate-50 ${
                          isSelected ? 'bg-rose-50/40' : ''
                        }`}
                      >
                        <td className="px-5 py-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection(payment.id)}
                            aria-label={`Select payment ${payment.id}`}
                            className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-amber-500"
                          />
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-mono text-sm font-semibold text-slate-900">
                            PAY-{String(payment.id).padStart(5, '0')}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {payment.method || 'Payment'}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-slate-800">
                            INV-{String(payment.invoiceId).padStart(5, '0')}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Client #{payment.clientId}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                          {formatDate(payment.paymentDate)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right font-mono text-sm font-semibold text-slate-900">
                          {formatCurrency(Number(payment.amount || 0))}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(
                              status,
                            )}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedPayment(payment)}
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Eye size={16} />
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedIds.length > 0 && (
          <div className="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 sm:flex-row sm:items-center">
            <p className="text-sm font-medium text-rose-800">
              {selectedIds.length} payment{selectedIds.length === 1 ? '' : 's'}{' '}
              selected
              {selectedPayments.length > 0 && (
                <span className="ml-1 text-rose-600">
                  · {formatCurrency(
                    selectedPayments.reduce(
                      (sum, payment) => sum + Number(payment.amount || 0),
                      0,
                    ),
                  )}
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="inline-flex min-h-[36px] items-center justify-center rounded-lg px-3 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-detail-title"
            className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setSelectedPayment(null)}
              className="absolute right-4 top-4 inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close payment details"
            >
              <X size={18} />
            </button>

            <div className="pr-10">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Payment inspection
              </p>
              <h2
                id="payment-detail-title"
                className="mt-2 text-xl font-bold text-slate-900"
              >
                PAY-{String(selectedPayment.id).padStart(5, '0')}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Review payment metadata before reconciling.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Amount
                </p>
                <p className="mt-2 font-mono text-lg font-bold text-slate-900">
                  {formatCurrency(Number(selectedPayment.amount || 0))}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </p>
                <p className="mt-2 text-sm font-semibold capitalize text-slate-900">
                  {selectedPayment.status || 'Pending'}
                </p>
              </div>
            </div>

            <dl className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-slate-500">Invoice</dt>
                <dd className="font-mono text-sm font-semibold text-slate-900">
                  INV-{String(selectedPayment.invoiceId).padStart(5, '0')}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-slate-500">Client</dt>
                <dd className="text-sm font-semibold text-slate-900">
                  #{selectedPayment.clientId}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-slate-500">Payment date</dt>
                <dd className="text-sm font-semibold text-slate-900">
                  {formatDate(selectedPayment.paymentDate)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-slate-500">Method</dt>
                <dd className="text-sm font-semibold capitalize text-slate-900">
                  {selectedPayment.method || '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-slate-500">Reference</dt>
                <dd className="max-w-[220px] truncate text-sm font-semibold text-slate-900">
                  {selectedPayment.reference || '—'}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate(
                    `${ROUTES.SCREEN_PAYMENT_DETAILS}?id=${selectedPayment.id}`,
                  );
                }}
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700"
              >
                View payment details
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-[60] flex max-w-sm items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === 'success'
              ? 'bg-emerald-600'
              : toast.type === 'error'
                ? 'bg-red-500'
                : 'bg-indigo-500'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={18} />
          ) : toast.type === 'error' ? (
            <XCircle size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}