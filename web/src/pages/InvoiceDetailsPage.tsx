import type { Client, Invoice, InvoiceLineItem } from '../types';
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useInvoices } from '../hooks';
import { formatCurrency } from '../lib/currency';
import { ROUTES } from '../routes';
import { useLocation, useNavigate } from 'react-router-dom';
import { RecordPaymentModal } from '../components';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Mail,
  RefreshCw,
  X,
  XCircle,
  Download,
  Copy,
  Ban,
  Edit3,
  CreditCard,
  PlusCircle,
  Send,
  MessageSquare,
  History,
  ShieldAlert,
} from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

type ToastState = {
  message: string;
  type: ToastType;
} | null;

interface TimelineData {
  payments: any[];
  notifications: any[];
  audit: any[];
  revisions: any[];
}

function formatDate(value?: string | Date): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value?: string | Date): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getStatusClasses(status?: string): string {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'paid') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (normalized === 'partially_paid') return 'border-sky-200 bg-sky-50 text-sky-700';
  if (normalized === 'overdue') return 'border-red-200 bg-red-50 text-red-700';
  if (normalized === 'cancelled') return 'border-slate-300 bg-slate-100 text-slate-500 line-through';
  if (normalized === 'sent') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (normalized === 'viewed') return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

export default function InvoiceDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const invoiceCollection = useInvoices();

  const [invoice, setInvoice] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'lines' | 'payments' | 'timeline'>('lines');

  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendChannels, setSendChannels] = useState<{ email: boolean; sms: boolean }>({ email: true, sms: true });
  const [isSending, setIsSending] = useState(false);

  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  const [showReviseModal, setShowReviseModal] = useState(false);
  const [reviseReason, setReviseReason] = useState('');
  const [isRevising, setIsRevising] = useState(false);

  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const [toast, setToast] = useState<ToastState>(null);

  const queryInvoiceId = useMemo(() => {
    const value = new URLSearchParams(location.search).get('id');
    const parsed = value ? Number(value) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [location.search]);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  const loadInvoiceData = async (invoiceId: number) => {
    if (invoiceId <= 0) return;
    setIsLoadingDetails(true);
    setDetailError(null);
    try {
      const invData = await api.get<any>(`/invoices/${invoiceId}`);
      setInvoice(invData);

      // Load timeline in parallel
      try {
        const timeData = await api.get<TimelineData>(`/invoices/${invoiceId}/timeline`);
        setTimeline(timeData);
      } catch (err) {
        console.warn('Could not load timeline', err);
      }
    } catch (err: any) {
      setDetailError(err?.message || 'We could not load the invoice details.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (queryInvoiceId > 0) {
      void loadInvoiceData(queryInvoiceId);
    } else {
      // No invoice specified: never fall back to an arbitrary record.
      navigate('/invoices', { replace: true });
    }
  }, [queryInvoiceId]);

  const handleRefresh = async () => {
    if (!invoice?.id) return;
    setIsRefreshing(true);
    try {
      await loadInvoiceData(invoice.id);
      showToast('Invoice refreshed.', 'info');
    } catch {
      showToast('Failed to refresh invoice.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!invoice?.id) return;
    const channels: string[] = [];
    if (sendChannels.email) channels.push('email');
    if (sendChannels.sms) channels.push('sms');
    if (channels.length === 0) {
      showToast('Please select at least one delivery channel.', 'error');
      return;
    }

    setIsSending(true);
    try {
      const updated = await api.post<any>(`/invoices/${invoice.id}/send`, { channels });
      setInvoice((prev: any) => ({ ...prev, ...updated }));
      setShowSendModal(false);
      showToast(`Invoice dispatched via ${channels.join(' & ')}.`);
      void loadInvoiceData(invoice.id);
    } catch (err: any) {
      showToast(err?.message || 'Failed to send invoice.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoice?.id) return;
    setIsDownloadingPdf(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/v1/invoices/${invoice.id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('PDF generation failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.invoiceNumber || `invoice-${invoice.id}`}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast('Invoice PDF downloaded.');
    } catch (err: any) {
      showToast(err?.message || 'Failed to download PDF.', 'error');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDuplicate = async () => {
    if (!invoice?.id) return;
    setIsDuplicating(true);
    try {
      const copy = await api.post<any>(`/invoices/${invoice.id}/duplicate`, {});
      showToast(`Duplicated as new draft (#${copy.id}).`, 'success');
      navigate(`/edit-invoice?id=${copy.id}`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to duplicate invoice.', 'error');
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleVoidInvoice = async () => {
    if (!invoice?.id || !voidReason.trim()) {
      showToast('A reason is required to void this invoice.', 'error');
      return;
    }
    setIsVoiding(true);
    try {
      const updated = await api.post<any>(`/invoices/${invoice.id}/void`, { reason: voidReason.trim() });
      setInvoice((prev: any) => ({ ...prev, ...updated }));
      setShowVoidModal(false);
      showToast('Invoice has been voided.', 'info');
      void loadInvoiceData(invoice.id);
    } catch (err: any) {
      showToast(err?.message || 'Cannot void this invoice.', 'error');
    } finally {
      setIsVoiding(false);
    }
  };

  const handleReviseInvoice = async () => {
    if (!invoice?.id || !reviseReason.trim()) {
      showToast('A reason is required to start a revision.', 'error');
      return;
    }
    setIsRevising(true);
    try {
      const updated = await api.post<any>(`/invoices/${invoice.id}/revise`, { reason: reviseReason.trim() });
      setInvoice((prev: any) => ({ ...prev, ...updated }));
      setShowReviseModal(false);
      showToast('Revision started. Unlocked for editing.', 'success');
      navigate(`/edit-invoice?id=${invoice.id}`);
    } catch (err: any) {
      showToast(err?.message || 'Cannot revise invoice.', 'error');
    } finally {
      setIsRevising(false);
    }
  };

  const isDraft = invoice ? !invoice.issuedAt : false;
  const isCancelled = invoice?.status?.toLowerCase() === 'cancelled';
  const isPaidOrPartPaid = invoice?.status?.toLowerCase() === 'paid' || invoice?.status?.toLowerCase() === 'partially_paid';
  const hasPayments = Number(invoice?.amountPaid || 0) > 0;
  const balanceDue = Math.max(0, Number(invoice?.balanceDue ?? (Number(invoice?.totalAmount || 0) - Number(invoice?.amountPaid || 0))));
  const canVoid = !isDraft && !isCancelled && !hasPayments;
  const canRevise = isPaidOrPartPaid && !isCancelled;
  const canEdit = !isCancelled && (isDraft || invoice?.revisionOpen || (!hasPayments && invoice?.issuedAt));

  return (
    <div className="min-h-full bg-slate-50 pb-12">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Navigation & Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate('/invoices')}
              className="mb-2 inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeft size={16} />
              Back to Invoice List
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                {invoice?.invoiceNumber || (invoice ? `Invoice #${invoice.id}` : 'Invoice')}
              </h1>
              {invoice && (
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${getStatusClasses(invoice.status)}`}>
                  <span className="h-2 w-2 rounded-full bg-current" />
                  {invoice.status}
                </span>
              )}
              {invoice?.revisionOpen && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                  Revision Open (Rev #{invoice.revision})
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Client: <span className="font-semibold text-slate-800">{invoice?.client?.name || invoice?.clientName || `Client #${invoice?.clientId}`}</span>
              {invoice?.client?.email ? ` • ${invoice.client.email}` : ''}
              {invoice?.client?.phone ? ` • ${invoice.client.phone}` : ''}
            </p>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing || !invoice}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-60"
              title="Refresh"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf || !invoice}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-60"
            >
              <Download size={14} />
              <span>{isDownloadingPdf ? 'Generating…' : 'PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handleDuplicate}
              disabled={isDuplicating || !invoice}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-60"
            >
              <Copy size={14} />
              <span>Duplicate</span>
            </button>

            {canEdit && (
              <button
                type="button"
                onClick={() => navigate(`/edit-invoice?id=${invoice.id}`)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 text-xs font-bold text-amber-900 shadow-xs hover:bg-amber-100"
              >
                <Edit3 size={14} />
                <span>Edit</span>
              </button>
            )}

            {canRevise && !invoice?.revisionOpen && (
              <button
                type="button"
                onClick={() => setShowReviseModal(true)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 text-xs font-bold text-indigo-700 shadow-xs hover:bg-indigo-100"
                title="Revise paid or part-paid invoice"
              >
                <Edit3 size={14} />
                <span>Revise Invoice</span>
              </button>
            )}

            {canVoid && (
              <button
                type="button"
                onClick={() => setShowVoidModal(true)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 text-xs font-bold text-red-700 shadow-xs hover:bg-red-100"
              >
                <Ban size={14} />
                <span>Void</span>
              </button>
            )}

            {balanceDue > 0 && !isDraft && !isCancelled && (
              <button
                type="button"
                onClick={() => setShowPaymentModal(true)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 cursor-pointer transition"
              >
                <CreditCard size={14} />
                <span>Record Payment</span>
              </button>
            )}

            {!isCancelled && (
              <button
                type="button"
                onClick={() => setShowSendModal(true)}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-amber-600 px-4 text-xs font-bold text-white shadow-xs hover:bg-amber-700"
              >
                <Send size={14} />
                <span>{isDraft ? 'Issue & Send' : 'Send / Resend'}</span>
              </button>
            )}
          </div>
        </div>

        {detailError && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} />
              <span>{detailError}</span>
            </div>
            <button
              onClick={() => queryInvoiceId && loadInvoiceData(queryInvoiceId)}
              className="rounded-lg bg-white px-3 py-1 font-semibold text-red-700 border border-red-200 hover:bg-red-50"
            >
              Retry
            </button>
          </div>
        )}

        {isLoadingDetails ? (
          <div className="h-96 rounded-2xl border border-slate-200 bg-white p-12 flex items-center justify-center text-slate-400 animate-pulse">
            Loading invoice details and timeline...
          </div>
        ) : !invoice ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <h2 className="text-lg font-bold text-slate-900">Invoice not found</h2>
            <p className="text-sm text-slate-500 mt-1">Please select an invoice from the invoice directory.</p>
            <button
              onClick={() => navigate('/invoices')}
              className="mt-4 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700"
            >
              Go to invoices
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top KPI row */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Amount</p>
                <p className="mt-1 font-mono text-2xl font-black text-slate-900">{formatCurrency(Number(invoice.totalAmount || 0))}</p>
                <p className="text-[11px] text-slate-400 mt-1">Net gross with taxes</p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Amount Paid</p>
                <p className="mt-1 font-mono text-2xl font-black text-emerald-600">{formatCurrency(Number(invoice.amountPaid || 0))}</p>
                <p className="text-[11px] text-slate-400 mt-1">Settled payments</p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Balance Due</p>
                <p className={`mt-1 font-mono text-2xl font-black ${balanceDue > 0 ? 'text-amber-600' : 'text-slate-600'}`}>
                  {formatCurrency(balanceDue)}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">{balanceDue === 0 ? 'Fully settled' : 'Outstanding'}</p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Due Date</p>
                <p className="mt-1 text-xl font-black text-slate-900">{formatDate(invoice.dueDate)}</p>
                <p className="text-[11px] text-slate-400 mt-1">Issued {formatDate(invoice.issueDate)}</p>
              </div>
            </div>

            {/* Tab navigation */}
            <div className="border-b border-slate-200 flex gap-4">
              <button
                type="button"
                onClick={() => setActiveTab('lines')}
                className={`pb-3 text-sm font-bold border-b-2 transition ${
                  activeTab === 'lines'
                    ? 'border-amber-600 text-amber-800'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Line Items & Totals ({invoice.lineItems?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('payments')}
                className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === 'payments'
                    ? 'border-amber-600 text-amber-800'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Payment History</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {invoice.payments?.length || 0}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-1.5 ${
                  activeTab === 'timeline'
                    ? 'border-amber-600 text-amber-800'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <History size={15} />
                <span>Audit & Activity</span>
              </button>
            </div>

            {/* TAB 1: LINE ITEMS & AMOUNTS */}
            {activeTab === 'lines' && (
              <div className="space-y-6">
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-900">Billed Items</h3>
                    <span className="text-xs text-slate-400">Values recomputed server-side with Decimal precision</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50/80 font-bold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="py-3 px-6">Description</th>
                          <th className="py-3 px-4 text-right">Qty</th>
                          <th className="py-3 px-4 text-right">Unit Price</th>
                          <th className="py-3 px-4 text-right">Discount</th>
                          <th className="py-3 px-4 text-right">Tax Rate</th>
                          <th className="py-3 px-6 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {invoice.lineItems && invoice.lineItems.length > 0 ? (
                          invoice.lineItems.map((item: any, idx: number) => {
                            const prod = item.product;
                            return (
                              <tr key={item.id || idx} className="hover:bg-slate-50/50">
                                <td className="py-3.5 px-6">
                                  {prod ? (
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-900">{prod.name}</span>
                                        {prod.sku && (
                                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
                                            {prod.sku}
                                          </span>
                                        )}
                                        {prod.group && (
                                          <span className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                            {prod.group}
                                          </span>
                                        )}
                                      </div>
                                      {item.description && item.description !== prod.name && (
                                        <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="font-medium text-slate-900">{item.description || 'Custom line item'}</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono">{Number(item.quantity)}</td>
                                <td className="py-3.5 px-4 text-right font-mono">{formatCurrency(Number(item.unitPrice))}</td>
                                <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                                  {Number(item.discountAmount) > 0 ? formatCurrency(Number(item.discountAmount)) : '—'}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                                  {Number(item.taxRate) > 0 ? `${Number(item.taxRate)}%` : '0%'}
                                </td>
                                <td className="py-3.5 px-6 text-right font-mono font-bold text-slate-900">
                                  {formatCurrency(Number(item.lineTotal))}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400">
                              No line items attached to this invoice.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals Summary Footer */}
                  <div className="border-t border-slate-200 bg-slate-50/60 p-6 flex flex-col sm:flex-row justify-between gap-6">
                    <div className="space-y-3 max-w-md">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Notes</p>
                        <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{invoice.notes || 'None'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Payment Terms</p>
                        <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{invoice.terms || 'Net 14 Days'}</p>
                      </div>
                    </div>

                    <div className="w-full sm:w-72 space-y-2 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal:</span>
                        <span className="font-mono font-semibold">{formatCurrency(Number(invoice.subtotal || 0))}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Discount:</span>
                        <span className="font-mono font-semibold text-rose-600">
                          -{formatCurrency(Number(invoice.discountAmount || 0))}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Tax Amount:</span>
                        <span className="font-mono font-semibold">{formatCurrency(Number(invoice.taxAmount || 0))}</span>
                      </div>
                      <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-sm text-slate-900">
                        <span>Grand Total:</span>
                        <span className="font-mono text-base">{formatCurrency(Number(invoice.totalAmount || 0))}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 font-medium">
                        <span>Amount Paid:</span>
                        <span className="font-mono font-bold">{formatCurrency(Number(invoice.amountPaid || 0))}</span>
                      </div>
                      <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-sm text-amber-700">
                        <span>Balance Due:</span>
                        <span className="font-mono">{formatCurrency(balanceDue)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PAYMENT HISTORY */}
            {activeTab === 'payments' && (
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">Recorded Payments</h3>
                    <p className="text-xs text-slate-400">Transactions credited against this invoice</p>
                  </div>
                  {balanceDue > 0 && !isDraft && !isCancelled && (
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer transition"
                    >
                      <PlusCircle size={14} />
                      <span>Record Payment</span>
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="py-3 px-6">Receipt #</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Method</th>
                        <th className="py-3 px-4">Reference</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {invoice.payments && invoice.payments.length > 0 ? (
                        invoice.payments.map((p: any) => (
                          <tr key={p.id} className="hover:bg-slate-50/50">
                            <td className="py-3.5 px-6 font-mono font-bold text-slate-900">
                              {p.receiptNumber || `#${p.id}`}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">{formatDate(p.paymentDate)}</td>
                            <td className="py-3.5 px-4 capitalize font-medium">{p.method?.replace('_', ' ')}</td>
                            <td className="py-3.5 px-4 font-mono text-slate-500">{p.reference || '—'}</td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                              {formatCurrency(Number(p.amount))}
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  p.status === 'completed' || p.status === 'reconciled'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : p.status === 'voided'
                                      ? 'bg-red-50 text-red-700 line-through'
                                      : 'bg-amber-50 text-amber-700'
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-6 text-right space-x-2">
                              <button
                                onClick={() => navigate(`/payment-details?id=${p.id}`)}
                                className="font-semibold text-amber-600 hover:text-amber-800"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            No payments have been recorded for this invoice yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: TIMELINE & AUDIT */}
            {activeTab === 'timeline' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Audit & Revision History */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <History size={16} className="text-amber-600" />
                      <span>Audit Trail & Revisions</span>
                    </h3>
                  </div>

                  <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {timeline?.revisions && timeline.revisions.length > 0 && (
                      <div className="mb-4 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Revision Snapshots</p>
                        {timeline.revisions.map((rev: any) => (
                          <div key={rev.id} className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs">
                            <div className="flex justify-between font-bold text-indigo-950">
                              <span>Revision #{rev.revision}</span>
                              <span className="text-[10px] text-slate-500 font-normal">{formatDateTime(rev.createdAt)}</span>
                            </div>
                            <p className="text-slate-600 mt-1 italic">Reason: {rev.reason}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {timeline?.audit && timeline.audit.length > 0 ? (
                      timeline.audit.map((entry: any) => (
                        <div key={entry.id} className="flex gap-3 text-xs border-b border-slate-100 pb-3 last:border-0">
                          <div className="mt-1 h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                          <div className="flex-1">
                            <div className="flex justify-between">
                              <span className="font-bold text-slate-800">{entry.action}</span>
                              <span className="text-[10px] text-slate-400">{formatDateTime(entry.createdAt)}</span>
                            </div>
                            <p className="text-slate-600 mt-0.5">{entry.summary || 'Audit event captured'}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">No audit events recorded yet.</p>
                    )}
                  </div>
                </div>

                {/* Notification Delivery Log */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <Mail size={16} className="text-amber-600" />
                      <span>Communication History</span>
                    </h3>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {timeline?.notifications && timeline.notifications.length > 0 ? (
                      timeline.notifications.map((notif: any) => (
                        <div key={notif.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">
                              {notif.channel} • {notif.event}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                                notif.status === 'delivered' || notif.status === 'sent'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : notif.status === 'simulated'
                                    ? 'bg-sky-100 text-sky-800'
                                    : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {notif.status}
                            </span>
                          </div>
                          <p className="font-medium text-slate-800 mt-1">Recipient: {notif.recipient}</p>
                          {notif.subject && <p className="text-slate-600 truncate mt-0.5">Subject: {notif.subject}</p>}
                          <p className="text-[10px] text-slate-400 mt-1.5">{formatDateTime(notif.createdAt)}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">No emails or SMS dispatched for this invoice yet.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SEND MODAL */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button
              onClick={() => setShowSendModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} />
            </button>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 mb-4">
              <Send size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {isDraft ? 'Issue & Send Invoice?' : 'Resend Invoice Notification?'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Select delivery channels for {invoice?.invoiceNumber || `Invoice #${invoice?.id}`}.
            </p>

            <div className="my-5 space-y-3">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendChannels.email}
                  onChange={(e) => setSendChannels((prev) => ({ ...prev, email: e.target.checked }))}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800">Email Delivery</span>
                  <p className="text-slate-500">Includes PDF attachment and public view link</p>
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendChannels.sms}
                  onChange={(e) => setSendChannels((prev) => ({ ...prev, sms: e.target.checked }))}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800">Arkesel SMS</span>
                  <p className="text-slate-500">Sends instant SMS alert with short link</p>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSendModal(false)}
                disabled={isSending}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendInvoice}
                disabled={isSending}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-60 flex items-center gap-2"
              >
                {isSending && <RefreshCw size={14} className="animate-spin" />}
                <span>{isSending ? 'Sending…' : isDraft ? 'Issue & Send' : 'Send'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
            <h2 className="text-lg font-bold text-slate-900">Void Invoice</h2>
            <p className="text-xs text-slate-500 mt-1">
              Voiding cancels this invoice and returns deducted stock to inventory. This cannot be undone.
            </p>

            <div className="my-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reason for cancellation <span className="text-red-500">*</span>
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Order cancelled by customer, duplicated invoice..."
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
                onClick={handleVoidInvoice}
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

      {/* REVISE MODAL */}
      {showReviseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button
              onClick={() => setShowReviseModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-4">
              <Edit3 size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Start Revision</h2>
            <p className="text-xs text-slate-500 mt-1">
              This invoice has recorded payments. Revising it takes an audit snapshot and unlocks the line items for modification.
            </p>

            <div className="my-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reason for revision <span className="text-indigo-500">*</span>
              </label>
              <textarea
                value={reviseReason}
                onChange={(e) => setReviseReason(e.target.value)}
                placeholder="e.g. Scope adjustment agreed with client, discounted unit pricing..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReviseModal(false)}
                disabled={isRevising}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReviseInvoice}
                disabled={isRevising || !reviseReason.trim()}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
              >
                {isRevising && <RefreshCw size={14} className="animate-spin" />}
                <span>{isRevising ? 'Unlocking…' : 'Unlock & Edit'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        invoice={invoice}
        onSuccess={() => {
          showToast('Payment recorded successfully!');
          if (invoice?.id) void loadInvoiceData(invoice.id);
        }}
      />

      {/* Toast Notification */}
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