import type { Payment, Client, Invoice } from '../types';
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { usePayments, useClients, useInvoices } from '../hooks';
import { formatCurrency } from '../lib/currency';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  Hash,
  Loader2,
  X,
  User as UserIcon,
  Ban,
  RefreshCw,
  Clock,
  ShieldCheck,
} from 'lucide-react';

type ToastData = {
  message: string;
  type: 'success' | 'error' | 'info';
};
type Toast = ToastData | null;

const statusStyles: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  reconciled: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  voided: 'bg-red-50 text-red-700 border-red-200 line-through',
};

function formatDate(value?: string | Date) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(value?: string | Date) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status?: string }) {
  const normalized = String(status || 'pending').toLowerCase();
  const classes = statusStyles[normalized] || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${classes}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {normalized}
    </span>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 py-3.5 last:border-0">
      <div className="mt-0.5 rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-500 shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <div className="mt-0.5 break-words text-sm font-semibold text-slate-800">{value}</div>
      </div>
    </div>
  );
}

export default function PaymentDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const paymentsQuery = usePayments();
  const clientsQuery = useClients();
  const invoicesQuery = useInvoices();

  const [payment, setPayment] = useState<any | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const queryPaymentId = useMemo(() => {
    const value = new URLSearchParams(location.search).get('id');
    const parsed = value ? Number(value) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [location.search]);

  const showToast = (message: string, type: ToastData['type'] = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  const loadPayment = async (id: number) => {
    setLoadingPayment(true);
    try {
      const data = await api.get<any>(`/payments/${id}`);
      setPayment(data);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load payment details', 'error');
    } finally {
      setLoadingPayment(false);
    }
  };

  useEffect(() => {
    if (queryPaymentId > 0) {
      void loadPayment(queryPaymentId);
    } else {
      navigate('/payments', { replace: true });
    }
  }, [queryPaymentId]);

  const client = useMemo(
    () => (payment?.clientId ? clientsQuery.data?.find((c) => c.id === payment.clientId) : null),
    [clientsQuery.data, payment?.clientId]
  );

  const invoice = useMemo(
    () => (payment?.invoiceId ? invoicesQuery.data?.find((i) => i.id === payment.invoiceId) : null),
    [invoicesQuery.data, payment?.invoiceId]
  );

  const handleDownloadReceiptPdf = async () => {
    if (!payment?.id) return;
    setIsDownloadingPdf(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/v1/payments/${payment.id}/receipt.pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Receipt PDF generation failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-${payment.receiptNumber || payment.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast('Receipt PDF downloaded.');
    } catch (err: any) {
      showToast(err?.message || 'Failed to download receipt PDF.', 'error');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleVoid = async () => {
    if (!payment?.id || !voidReason.trim()) {
      showToast('A reason is required to void this payment.', 'error');
      return;
    }
    setIsVoiding(true);
    try {
      const voided = await api.post<any>(`/payments/${payment.id}/void`, { reason: voidReason.trim() });
      setPayment(voided);
      setShowVoidModal(false);
      showToast('Payment voided. Invoice balance recalculated.', 'info');
      void paymentsQuery.refresh();
      void invoicesQuery.refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to void payment.', 'error');
    } finally {
      setIsVoiding(false);
    }
  };

  const isVoided = payment?.status === 'voided';

  if (loadingPayment || paymentsQuery.loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 flex items-center justify-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-amber-600 mr-2" />
        <span>Loading payment details…</span>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-center">
        <CreditCard className="mx-auto h-12 w-12 text-slate-300 mb-3" />
        <h1 className="text-xl font-bold text-slate-900">Payment not found</h1>
        <p className="text-sm text-slate-500 mt-1">Select a payment from the payments list.</p>
        <button
          type="button"
          onClick={() => navigate('/payments-list')}
          className="mt-4 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700"
        >
          Go to Payments
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 pb-12">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Navigation & Header */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <button
              type="button"
              onClick={() => navigate('/payments-list')}
              className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft size={16} />
              Back to Payments List
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                Receipt {payment.receiptNumber || `#${payment.id}`}
              </h1>
              <StatusBadge status={payment.status} />
              {payment.reconciledAt && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  <ShieldCheck size={13} />
                  Reconciled
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Payment transaction record • Immutable financial ledger entry
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadReceiptPdf}
              disabled={isDownloadingPdf}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs"
            >
              <Download size={14} />
              <span>{isDownloadingPdf ? 'Generating…' : 'Receipt PDF'}</span>
            </button>

            {!isVoided && (
              <button
                type="button"
                onClick={() => setShowVoidModal(true)}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-bold text-red-700 hover:bg-red-100 shadow-xs"
              >
                <Ban size={14} />
                <span>Void Payment</span>
              </button>
            )}
          </div>
        </div>

        {/* Void Warning Banner */}
        {isVoided && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-xs text-red-900 shadow-xs">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-sm block">Payment Voided</span>
                <p className="mt-1 text-red-800">
                  This transaction was voided on {formatDateTime(payment.voidedAt)}.
                  {payment.voidReason && <span className="font-semibold block mt-1">Reason: "{payment.voidReason}"</span>}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Metric Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Amount Received</p>
            <p className={`mt-1 font-mono text-2xl font-black ${isVoided ? 'line-through text-slate-400' : 'text-emerald-600'}`}>
              {formatCurrency(Number(payment.amount) || 0)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Recorded via {payment.method?.replace('_', ' ') || 'cash'}</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Payment Date</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{formatDate(payment.paymentDate)}</p>
            <p className="text-[11px] text-slate-400 mt-1">Processed at {formatDateTime(payment.createdAt)}</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Receipt Number</p>
            <p className="mt-1 font-mono text-2xl font-black text-slate-900">{payment.receiptNumber || `#${payment.id}`}</p>
            <p className="text-[11px] text-slate-400 mt-1">Sequential numbering sequence</p>
          </div>
        </div>

        {/* Details Grids */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Transaction Metadata */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-2">Transaction Details</h2>
            <div>
              <DetailRow
                icon={<Hash size={16} />}
                label="Payment ID"
                value={<span className="font-mono">#{payment.id}</span>}
              />
              <DetailRow
                icon={<FileText size={16} />}
                label="Associated Invoice"
                value={
                  <button
                    onClick={() => navigate(`/invoice-details?id=${payment.invoiceId}`)}
                    className="font-bold text-amber-600 hover:text-amber-800 underline decoration-amber-300"
                  >
                    {invoice?.invoiceNumber || `Invoice #${payment.invoiceId}`}
                  </button>
                }
              />
              <DetailRow
                icon={<UserIcon size={16} />}
                label="Client"
                value={
                  <button
                    onClick={() => navigate(`/client-profile?id=${payment.clientId}`)}
                    className="font-bold text-amber-600 hover:text-amber-800 underline decoration-amber-300"
                  >
                    {client?.name || `Client #${payment.clientId}`}
                  </button>
                }
              />
              <DetailRow
                icon={<Calendar size={16} />}
                label="Date of Payment"
                value={formatDate(payment.paymentDate)}
              />
              <DetailRow
                icon={<CreditCard size={16} />}
                label="Channel & Method"
                value={<span className="capitalize">{payment.method?.replace('_', ' ') || 'Cash'}</span>}
              />
              <DetailRow
                icon={<Hash size={16} />}
                label="Transaction Reference"
                value={payment.reference ? <span className="font-mono">{payment.reference}</span> : <span className="text-slate-400">None</span>}
              />
            </div>
          </div>

          {/* Audit & Notes */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Audit Timestamps</h2>
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-slate-500 w-32">Recorded At:</span>
                  <span className="font-bold text-slate-800">{formatDateTime(payment.createdAt)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-slate-400" />
                  <span className="text-slate-500 w-32">Last Updated:</span>
                  <span className="font-bold text-slate-800">{formatDateTime(payment.updatedAt)}</span>
                </div>
                {payment.reconciledAt && (
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-emerald-600" />
                    <span className="text-slate-500 w-32">Reconciled At:</span>
                    <span className="font-bold text-emerald-800">{formatDateTime(payment.reconciledAt)}</span>
                  </div>
                )}
                {payment.voidedAt && (
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-red-600" />
                    <span className="text-slate-500 w-32">Voided At:</span>
                    <span className="font-bold text-red-700">{formatDateTime(payment.voidedAt)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-2">Internal Notes</h2>
              <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                {payment.notes || 'No internal notes recorded for this payment.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* VOID MODAL */}
      {showVoidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button
              onClick={() => setShowVoidModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600 mb-4">
              <Ban size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Void Payment</h2>
            <p className="text-xs text-slate-500 mt-1">
              Voiding this payment marks it invalid and immediately recomputes the invoice's balance due and status.
            </p>

            <div className="my-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reason for voiding <span className="text-red-500">*</span>
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Bounced cheque, payment recorded under wrong invoice, refunded..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowVoidModal(false)}
                disabled={isVoiding}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVoid}
                disabled={isVoiding || !voidReason.trim()}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60 flex items-center gap-2"
              >
                {isVoiding && <RefreshCw size={14} className="animate-spin" />}
                <span>{isVoiding ? 'Voiding…' : 'Confirm Void'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold text-white shadow-xl ${
            toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-slate-800'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}