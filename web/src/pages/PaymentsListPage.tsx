import type { Payment } from '../types';
import { useMemo, useState, useEffect } from 'react';
import { api } from '../api';
import { usePayments } from '../hooks';
import { formatCurrency } from '../lib/currency';
import { ROUTES } from '../routes';
import { useNavigate } from 'react-router-dom';
import { DateRangeFilter, RecordPaymentModal, TablePagination } from '../components';
import { AlertCircle, ArrowRight, CheckCircle2, ChevronRight, Clock, CreditCard, Download, Eye, FileText, Filter, Loader2, MoreVertical, Plus, RefreshCw, Search, Trash2, X, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

type ToastState = {
  message: string;
  type: ToastType;
} | null;

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getStatusClasses(status: string | undefined): string {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'completed' || normalized === 'succeeded' || normalized === 'paid') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (normalized === 'pending' || normalized === 'processing') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (normalized === 'failed' || normalized === 'cancelled' || normalized === 'canceled' || normalized === 'voided') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function getStatusDot(status: string | undefined): string {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'completed' || normalized === 'succeeded' || normalized === 'paid') {
    return 'bg-emerald-500';
  }

  if (normalized === 'pending' || normalized === 'processing') {
    return 'bg-amber-500';
  }

  if (normalized === 'failed' || normalized === 'cancelled' || normalized === 'canceled' || normalized === 'voided') {
    return 'bg-rose-500';
  }

  return 'bg-slate-400';
}

function displayStatus(status: string | undefined): string {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getInitials(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) return '—';
  return cleaned
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export default function PaymentsListPage() {
  const navigate = useNavigate();
  const { data: payments, loading, error, refresh, remove } = usePayments();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  const handleDateRangeChange = (from: string, to: string) => {
    setStartDate(from);
    setEndDate(to);
    setPage(1);
    refresh({ from: from || undefined, to: to || undefined });
  };

  const handleDownloadReceiptPdf = async (id: number, receiptNum?: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/v1/payments/${id}/receipt.pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Failed to generate receipt PDF');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${receiptNum || id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast('Receipt PDF downloaded.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Download failed', 'error');
    }
  };

  const paymentData = Array.isArray(payments) ? payments : [];

  // Query backend whenever search, statusFilter, or date range changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      refresh({
        search: search.trim() || undefined,
        status: statusFilter === 'All' ? undefined : statusFilter.toLowerCase(),
        from: startDate || undefined,
        to: endDate || undefined,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [search, statusFilter, startDate, endDate, refresh]);

  const filteredPayments = useMemo(() => {
    return paymentData;
  }, [paymentData]);

  const paginatedPayments = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredPayments.slice(start, start + PAGE_SIZE);
  }, [filteredPayments, page]);

  const totalAmount = useMemo(
    () => filteredPayments.reduce((sum, payment) => sum + Number(payment?.amount || 0), 0),
    [filteredPayments],
  );

  const completedAmount = useMemo(
    () =>
      filteredPayments
        .filter((payment) => {
          const status = String(payment?.status || '').toLowerCase();
          return status === 'completed' || status === 'succeeded' || status === 'paid';
        })
        .reduce((sum, payment) => sum + Number(payment?.amount || 0), 0),
    [filteredPayments],
  );

  const pendingCount = useMemo(
    () =>
      filteredPayments.filter((payment) => {
        const status = String(payment?.status || '').toLowerCase();
        return status === 'pending' || status === 'processing';
      }).length,
    [paymentData],
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
      showToast('Payments refreshed successfully.', 'success');
    } catch {
      showToast('Unable to refresh payments.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport = () => {
    if (filteredPayments.length === 0) {
      showToast('There are no payments to export.', 'info');
      return;
    }

    const rows = [
      ['Payment ID', 'Invoice ID', 'Client ID', 'Amount', 'Payment Date', 'Method', 'Status', 'Reference'],
      ...filteredPayments.map((payment) => [
        String(payment.id),
        String(payment.invoiceId),
        String(payment.clientId),
        String(payment.amount),
        payment.paymentDate,
        payment.method,
        payment.status,
        payment.reference || '',
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'payments.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Payments exported successfully.', 'success');
  };

  const handleDelete = async () => {
    if (!paymentToDelete?.id) return;
    if (!voidReason.trim()) {
      showToast('A reason is required to void this payment.', 'error');
      return;
    }

    setIsDeleting(true);
    try {
      await api.post(`/payments/${paymentToDelete.id}/void`, { reason: voidReason.trim() });
      setPaymentToDelete(null);
      setSelectedPayment(null);
      setVoidReason('');
      showToast('Payment voided successfully. Invoice balance updated.', 'success');
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to void payment.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const statusFilters = ['All', 'Completed', 'Pending', 'Cancelled'];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Payment processing operational
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Payments</h1>
            <p className="mt-2 text-sm text-slate-500">
              Monitor, review, and manage all recorded customer payments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={isRefreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button
              type="button"
              onClick={() => setShowRecordModal(true)}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
            >
              <Plus className="h-4 w-4" />
              Record payment
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total payments</span>
              <span className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-slate-600">
                <CreditCard className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-5 font-mono text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(totalAmount)}
            </p>
            <p className="mt-2 text-xs text-slate-500">{paymentData.length} recorded transactions</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Completed</span>
              <span className="rounded-lg border border-emerald-100 bg-emerald-50 p-2.5 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-5 font-mono text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(completedAmount)}
            </p>
            <p className="mt-2 text-xs text-slate-500">Successfully settled payments</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending</span>
              <span className="rounded-lg border border-amber-100 bg-amber-50 p-2.5 text-amber-600">
                <Clock className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-5 font-mono text-2xl font-bold tracking-tight text-slate-900">{pendingCount}</p>
            <p className="mt-2 text-xs text-slate-500">Awaiting confirmation</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Average payment</span>
              <span className="rounded-lg border border-indigo-100 bg-indigo-50 p-2.5 text-indigo-600">
                <FileText className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-5 font-mono text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(paymentData.length ? totalAmount / paymentData.length : 0)}
            </p>
            <p className="mt-2 text-xs text-slate-500">Across all recorded payments</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-200/80 p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-slate-900">Payment history</h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {filteredPayments.length}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">Search and review your payment activity.</p>
              </div>

              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search payment, invoice, or reference..."
                  className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Filter className="h-3.5 w-3.5" />
                  Status
                </div>
                {statusFilters.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => {
                      setStatusFilter(filter);
                      setPage(1);
                    }}
                    className={`min-h-[36px] rounded-lg px-3 text-sm font-medium transition ${
                      statusFilter === filter
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onChange={handleDateRangeChange}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 px-6 text-center">
              <Loader2 className="h-7 w-7 animate-spin text-amber-600" />
              <p className="text-sm font-medium text-slate-600">Loading payments...</p>
            </div>
          ) : error ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="rounded-full bg-rose-50 p-3 text-rose-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Unable to load payments</p>
                <p className="mt-1 text-sm text-slate-500">{String(error)}</p>
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="rounded-full bg-slate-100 p-3 text-slate-500">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">No payments found</p>
                <p className="mt-1 text-sm text-slate-500">
                  {search || statusFilter !== 'All'
                    ? 'Try adjusting your search or status filter.'
                    : 'Recorded payments will appear here.'}
                </p>
              </div>
              {(search || statusFilter !== 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('All');
                  }}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Reset filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b border-slate-200/80 bg-slate-50/70">
                  <tr>
                    {['Payment', 'Customer / Invoice', 'Date', 'Method', 'Amount', 'Status', ''].map((heading) => (
                      <th
                        key={heading}
                        className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedPayments.map((payment) => (
                    <tr key={payment.id} className="group transition hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-xs font-bold text-rose-700">
                            {getInitials(`P${payment.id}`)}
                          </div>
                          <div>
                            <p className="font-mono text-sm font-semibold text-slate-900">PAY-{payment.id}</p>
                            <p className="text-xs text-slate-500">Invoice #{payment.invoiceId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <p className="text-sm font-medium text-slate-800">
                          {(payment as any).client?.name || (payment as any).client?.companyName || `Client #${payment.clientId}`}
                        </p>
                        <p className="text-xs text-slate-500">
                          {(payment as any).invoice?.invoiceNumber ? `Invoice ${(payment as any).invoice.invoiceNumber}` : `Invoice #${payment.invoiceId}`}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                        {formatDate(payment.paymentDate)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm capitalize text-slate-600">
                        {payment.method || '—'}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-sm font-semibold text-slate-900">
                        {formatCurrency(Number(payment.amount || 0))}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                            payment.status,
                          )}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${getStatusDot(payment.status)}`} />
                          {displayStatus(payment.status)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/payment-details?id=${payment.id}`)}
                            title="View payment receipt details"
                            className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadReceiptPdf(payment.id, (payment as any).receiptNumber)}
                            title="Download Receipt PDF"
                            className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          {payment.status !== 'voided' && (
                            <button
                              type="button"
                              onClick={() => {
                                setVoidReason('');
                                setPaymentToDelete(payment);
                              }}
                              title="Void payment"
                              className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && filteredPayments.length > 0 && (
            <TablePagination
              currentPage={page}
              totalItems={filteredPayments.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              itemLabel="payments"
            />
          )}
        </div>
      </div>

      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setSelectedPayment(null)}
              className="absolute right-4 top-4 inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close payment details"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="pr-10">
              <div className="mb-2 inline-flex rounded-lg bg-rose-50 p-2 text-rose-600">
                <CreditCard className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Payment details</h2>
              <p className="mt-1 text-sm text-slate-500">PAY-{selectedPayment.id}</p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Amount</p>
                <p className="mt-2 font-mono text-xl font-bold text-slate-900">
                  {formatCurrency(Number(selectedPayment.amount || 0))}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</p>
                <span
                  className={`mt-2 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                    selectedPayment.status,
                  )}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${getStatusDot(selectedPayment.status)}`} />
                  {displayStatus(selectedPayment.status)}
                </span>
              </div>
            </div>

            <dl className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-slate-500">Invoice</dt>
                <dd className="font-mono text-sm font-semibold text-slate-800">#{selectedPayment.invoiceId}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-slate-500">Client</dt>
                <dd className="text-sm font-semibold text-slate-800">#{selectedPayment.clientId}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-slate-500">Payment date</dt>
                <dd className="text-sm font-semibold text-slate-800">{formatDate(selectedPayment.paymentDate)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-slate-500">Method</dt>
                <dd className="text-sm font-semibold capitalize text-slate-800">{selectedPayment.method || '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-slate-500">Reference</dt>
                <dd className="max-w-[55%] truncate text-sm font-semibold text-slate-800">
                  {selectedPayment.reference || '—'}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedPayment(null);
                  setPaymentToDelete(selectedPayment);
                }}
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700"
              >
                <Trash2 className="h-4 w-4" />
                Void payment
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setPaymentToDelete(null)}
              className="absolute right-4 top-4 inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close confirmation"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <Trash2 className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">Void this payment?</h2>
            <p className="mt-1 text-xs text-slate-500">
              Receipt {(paymentToDelete as any).receiptNumber || `#${paymentToDelete.id}`} will be voided and the invoice balance recomputed.
            </p>

            <div className="my-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reason for voiding <span className="text-rose-600">*</span>
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Reason is required for audit trail..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPaymentToDelete(null)}
                disabled={isDeleting}
                className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || !voidReason.trim()}
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {isDeleting ? 'Voiding...' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}

      <RecordPaymentModal
        isOpen={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        onSuccess={() => {
          showToast('Payment recorded successfully!');
          refresh();
        }}
      />

      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
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
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 rounded p-1 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}