import type { Client, ProductService } from '../types';
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useClients, useInvoices, useProductServices } from '../hooks';
import { formatCurrency } from '../lib/currency';
import { useLocation, useNavigate } from 'react-router-dom';
import { Select, DatePicker } from '../components';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  Save,
  Trash2,
  XCircle,
  AlertCircle,
  Edit3,
  ShieldAlert,
  ChevronDown,
} from 'lucide-react';

interface EditableLine {
  id?: number;
  productServiceId?: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRate: number;
  lineTotal: number;
}

type ToastState = {
  message: string;
  type: 'success' | 'error' | 'info';
} | null;

function toDateInput(value?: string | Date): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export default function EditInvoicePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const invoicesQuery = useInvoices();
  const clientsQuery = useClients();
  const catalogQuery = useProductServices();

  const invoices = invoicesQuery.data ?? [];
  const clients = clientsQuery.data ?? [];
  const catalog = catalogQuery.data ?? [];

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number>(0);
  const [invoice, setInvoice] = useState<any | null>(null);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);

  // Form fields
  const [clientId, setClientId] = useState<number>(0);
  const [issueDate, setIssueDate] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [terms, setTerms] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [lines, setLines] = useState<EditableLine[]>([]);

  // States
  const [revisionRequired, setRevisionRequired] = useState(false);
  const [showReviseDialog, setShowReviseDialog] = useState(false);
  const [reviseReason, setReviseReason] = useState('');
  const [isRevising, setIsRevising] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  const queryInvoiceId = useMemo(() => {
    const value = new URLSearchParams(location.search).get('id');
    const parsed = value ? Number(value) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [location.search]);

  useEffect(() => {
    if (queryInvoiceId > 0) {
      setSelectedInvoiceId(queryInvoiceId);
    } else {
      navigate('/invoices', { replace: true });
    }
  }, [queryInvoiceId]);

  const loadInvoice = async (id: number) => {
    if (!id) return;
    setIsLoadingInvoice(true);
    setRevisionRequired(false);
    try {
      const data = await api.get<any>(`/invoices/${id}`);
      setInvoice(data);
      setClientId(data.clientId || 0);
      setIssueDate(toDateInput(data.issueDate));
      setDueDate(toDateInput(data.dueDate));
      setNotes(data.notes || '');
      setTerms(data.terms || '');
      setDiscountAmount(Number(data.discountAmount || 0));

      const rawLines = data.lineItems || [];
      if (rawLines.length > 0) {
        setLines(
          rawLines.map((l: any) => ({
            id: l.id,
            productServiceId: l.productServiceId || null,
            description: l.description || '',
            quantity: Number(l.quantity || 1),
            unitPrice: Number(l.unitPrice || 0),
            discountAmount: Number(l.discountAmount || 0),
            taxRate: Number(l.taxRate || 0),
            lineTotal: Number(l.lineTotal || 0),
          }))
        );
      } else {
        setLines([
          {
            description: '',
            quantity: 1,
            unitPrice: 0,
            discountAmount: 0,
            taxRate: 0,
            lineTotal: 0,
          },
        ]);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to load invoice', 'error');
    } finally {
      setIsLoadingInvoice(false);
    }
  };

  useEffect(() => {
    if (selectedInvoiceId > 0) {
      void loadInvoice(selectedInvoiceId);
    }
  }, [selectedInvoiceId]);

  // Compute line total helper
  const computeLineTotal = (qty: number, price: number, disc: number, taxRate: number) => {
    const gross = qty * price;
    const discounted = Math.max(0, gross - disc);
    const tax = discounted * (taxRate / 100);
    return Math.round((discounted + tax) * 100) / 100;
  };

  const updateLine = (index: number, patch: Partial<EditableLine>) => {
    setLines((prev) => {
      const updated = [...prev];
      const cur = { ...updated[index], ...patch };
      cur.lineTotal = computeLineTotal(cur.quantity, cur.unitPrice, cur.discountAmount, cur.taxRate);
      updated[index] = cur;
      return updated;
    });
  };

  const handleSelectProduct = (index: number, productId: number) => {
    if (!productId) {
      updateLine(index, { productServiceId: null });
      return;
    }
    const product = catalog.find((p) => p.id === productId);
    if (!product) return;

    updateLine(index, {
      productServiceId: product.id,
      description: product.description || product.name,
      unitPrice: Number(product.unitPrice || 0),
      taxRate: Number(product.taxRate || 0),
    });
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        description: '',
        quantity: 1,
        unitPrice: 0,
        discountAmount: 0,
        taxRate: 0,
        lineTotal: 0,
      },
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) {
      showToast('An invoice needs at least one line item.', 'error');
      return;
    }
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  // Preview Totals
  const previewSubtotal = useMemo(() => {
    return lines.reduce((acc, l) => acc + (l.quantity * l.unitPrice), 0);
  }, [lines]);

  const previewDiscount = useMemo(() => {
    return lines.reduce((acc, l) => acc + l.discountAmount, 0) + Number(discountAmount || 0);
  }, [lines, discountAmount]);

  const previewTax = useMemo(() => {
    return lines.reduce((acc, l) => {
      const discounted = Math.max(0, (l.quantity * l.unitPrice) - l.discountAmount);
      return acc + (discounted * (l.taxRate / 100));
    }, 0);
  }, [lines]);

  const previewTotal = useMemo(() => {
    return Math.max(0, Math.round((previewSubtotal - previewDiscount + previewTax) * 100) / 100);
  }, [previewSubtotal, previewDiscount, previewTax]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!clientId) errs.clientId = 'Client is required.';
    if (!issueDate) errs.issueDate = 'Issue date is required.';
    if (!dueDate) errs.dueDate = 'Due date is required.';
    if (dueDate && issueDate && dueDate < issueDate) {
      errs.dueDate = 'Due date cannot be before issue date.';
    }
    if (lines.length === 0) {
      errs.lines = 'At least one line item is required.';
    } else {
      lines.forEach((line, idx) => {
        if (!line.description.trim()) {
          errs[`line_${idx}`] = 'Description is required.';
        }
        if (line.quantity <= 0) {
          errs[`qty_${idx}`] = 'Qty must be > 0.';
        }
        if (line.unitPrice < 0) {
          errs[`price_${idx}`] = 'Price must be >= 0.';
        }
      });
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice?.id) return;
    if (!validate()) {
      showToast('Please correct form errors before saving.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        clientId,
        issueDate,
        dueDate,
        notes: notes.trim() || null,
        terms: terms.trim() || null,
        discountAmount: Number(discountAmount || 0),
        lineItems: lines.map((l) => ({
          productServiceId: l.productServiceId || undefined,
          description: l.description.trim(),
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          discountAmount: Number(l.discountAmount || 0),
          taxRate: Number(l.taxRate || 0),
        })),
      };

      const updated = await api.patch<any>(`/invoices/${invoice.id}`, payload);
      showToast('Invoice updated successfully.', 'success');
      navigate(`/invoice-details?id=${updated.id}`);
    } catch (err: any) {
      const msg = err?.message || 'Failed to update invoice.';
      if (msg.includes('REVISION_REQUIRED') || msg.includes('payments recorded')) {
        setRevisionRequired(true);
        showToast('This invoice has payments recorded. A revision is required before editing.', 'error');
      } else {
        showToast(msg, 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartRevision = async () => {
    if (!invoice?.id || !reviseReason.trim()) {
      showToast('Please specify a revision reason.', 'error');
      return;
    }
    setIsRevising(true);
    try {
      await api.post<any>(`/invoices/${invoice.id}/revise`, { reason: reviseReason.trim() });
      setShowReviseDialog(false);
      setRevisionRequired(false);
      showToast('Revision started. Document unlocked.', 'success');
      void loadInvoice(invoice.id);
    } catch (err: any) {
      showToast(err?.message || 'Failed to start revision.', 'error');
    } finally {
      setIsRevising(false);
    }
  };

  const isCancelled = invoice?.status?.toLowerCase() === 'cancelled';
  const hasPayments = Number(invoice?.amountPaid || 0) > 0;
  const isLocked = isCancelled || (hasPayments && !invoice?.revisionOpen);

  return (
    <div className="min-h-full bg-slate-50 pb-12">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Edit Invoice {invoice?.invoiceNumber || (invoice ? `Draft #${invoice.id}` : '')}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Add or revise line items, update dates, and keep records audit-compliant.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {invoice?.id && (
              <button
                type="button"
                onClick={() => navigate(`/invoice-details?id=${invoice.id}`)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs"
              >
                View Details
              </button>
            )}
          </div>
        </div>

        {/* Invoice Selector if no query param */}
        {!queryInvoiceId && invoices.length > 1 && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <Select
              label="Select Invoice to Edit"
              value={selectedInvoiceId}
              onChange={(val) => setSelectedInvoiceId(Number(val))}
              options={invoices.map((inv) => ({
                value: inv.id,
                label: `${inv.invoiceNumber || `Draft #${inv.id}`} • ${inv.client?.name || `Client #${inv.clientId}`}`,
                sublabel: `${formatCurrency(Number(inv.totalAmount || 0))} (${inv.status})`,
              }))}
              searchable
            />
          </div>
        )}

        {/* Warning Banners */}
        {isCancelled && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-slate-300 bg-slate-100 p-4 text-xs font-bold text-slate-600">
            <ShieldAlert size={18} className="text-slate-400" />
            <span>This invoice has been voided / cancelled. Changes cannot be made.</span>
          </div>
        )}

        {(revisionRequired || (hasPayments && !invoice?.revisionOpen && !isCancelled)) && (
          <div className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50/80 p-5 text-xs text-indigo-900 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-sm block">Revision Required Before Editing</span>
                <p className="text-indigo-700 mt-0.5">
                  Payments are recorded against this invoice ({formatCurrency(Number(invoice?.amountPaid || 0))} paid). To preserve the financial audit trail, click below to open an official revision.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowReviseDialog(true)}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 shrink-0 flex items-center gap-1.5 shadow-xs"
            >
              <Edit3 size={14} />
              <span>Start Revision</span>
            </button>
          </div>
        )}

        {invoice?.revisionOpen && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-bold text-amber-900">
            <CheckCircle2 size={18} className="text-amber-600 shrink-0" />
            <span>Revision #{invoice.revision} is active. Saving your changes will update the invoice and register an audit snapshot.</span>
          </div>
        )}

        {isLoadingInvoice ? (
          <div className="h-96 rounded-2xl border border-slate-200 bg-white p-12 flex items-center justify-center text-slate-400 animate-pulse">
            Loading invoice information...
          </div>
        ) : !invoice ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            No invoice selected.
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Metadata Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Core Invoice Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Select
                    label="Client"
                    required
                    disabled={isLocked}
                    value={clientId}
                    onChange={(val) => setClientId(Number(val))}
                    placeholder="Select a client..."
                    options={clients.map((c) => ({
                      value: c.id,
                      label: c.name,
                      sublabel: c.companyName ? `• ${c.companyName}` : undefined,
                    }))}
                    error={errors.clientId}
                    searchable
                  />
                </div>

                <div>
                  <DatePicker
                    label="Issue Date"
                    required
                    disabled={isLocked}
                    value={issueDate}
                    onChange={setIssueDate}
                    error={errors.issueDate}
                  />
                </div>

                <div>
                  <DatePicker
                    label="Due Date"
                    required
                    disabled={isLocked}
                    value={dueDate}
                    onChange={setDueDate}
                    error={errors.dueDate}
                  />
                </div>
              </div>
            </div>

            {/* Line Items Editor Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Line Items</h2>
                  <p className="text-xs text-slate-400">Add catalog items or manual services</p>
                </div>
                {!isLocked && (
                  <button
                    type="button"
                    onClick={addLine}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 shadow-xs"
                  >
                    <Plus size={14} />
                    <span>Add Item</span>
                  </button>
                )}
              </div>

              <div className="overflow-x-auto p-4">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3 min-w-[200px]">Catalog Item</th>
                      <th className="py-2.5 px-3 min-w-[220px]">Description</th>
                      <th className="py-2.5 px-2 text-right w-20">Qty</th>
                      <th className="py-2.5 px-2 text-right w-28">Unit Price</th>
                      <th className="py-2.5 px-2 text-right w-24">Discount</th>
                      <th className="py-2.5 px-2 text-right w-20">Tax %</th>
                      <th className="py-2.5 px-3 text-right w-28">Total</th>
                      {!isLocked && <th className="py-2.5 px-2 w-10"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3">
                          <Select
                            disabled={isLocked}
                            value={line.productServiceId || ''}
                            onChange={(val) => handleSelectProduct(idx, Number(val))}
                            placeholder="Custom Item"
                            options={[
                              { value: '', label: 'Custom Item' },
                              ...catalog.map((p) => ({
                                value: p.id,
                                label: `${p.name} (${formatCurrency(Number(p.unitPrice))})`,
                              })),
                            ]}
                            searchable
                            className="min-w-[180px]"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            disabled={isLocked}
                            type="text"
                            value={line.description}
                            onChange={(e) => updateLine(idx, { description: e.target.value })}
                            placeholder="Description"
                            className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-800 outline-none focus:border-amber-500"
                          />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <input
                            disabled={isLocked}
                            type="number"
                            min="0.001"
                            step="any"
                            value={line.quantity}
                            onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) || 0 })}
                            className="w-full rounded-lg border border-slate-200 p-2 text-xs text-right font-mono text-slate-800"
                          />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <input
                            disabled={isLocked}
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitPrice}
                            onChange={(e) => updateLine(idx, { unitPrice: Number(e.target.value) || 0 })}
                            className="w-full rounded-lg border border-slate-200 p-2 text-xs text-right font-mono text-slate-800"
                          />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <input
                            disabled={isLocked}
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.discountAmount}
                            onChange={(e) => updateLine(idx, { discountAmount: Number(e.target.value) || 0 })}
                            className="w-full rounded-lg border border-slate-200 p-2 text-xs text-right font-mono text-slate-800"
                          />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <input
                            disabled={isLocked}
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={line.taxRate}
                            onChange={(e) => updateLine(idx, { taxRate: Number(e.target.value) || 0 })}
                            className="w-full rounded-lg border border-slate-200 p-2 text-xs text-right font-mono text-slate-800"
                          />
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(line.lineTotal)}
                        </td>
                        {!isLocked && (
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeLine(idx)}
                              className="text-slate-400 hover:text-red-600 transition"
                              title="Delete Line"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals & Notes footer */}
              <div className="border-t border-slate-200 bg-slate-50/60 p-6 flex flex-col sm:flex-row justify-between gap-6">
                <div className="space-y-4 flex-1 max-w-lg">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                    <textarea
                      disabled={isLocked}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Add notes shown on invoice..."
                      className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Payment Terms</label>
                    <textarea
                      disabled={isLocked}
                      value={terms}
                      onChange={(e) => setTerms(e.target.value)}
                      rows={2}
                      placeholder="Payment terms..."
                      className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 bg-white"
                    />
                  </div>
                </div>

                <div className="w-full sm:w-72 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono font-semibold">{formatCurrency(previewSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Line Discounts:</span>
                    <span className="font-mono font-semibold text-rose-600">
                      -{formatCurrency(lines.reduce((a, b) => a + b.discountAmount, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 items-center">
                    <span>Additional Discount:</span>
                    <input
                      disabled={isLocked}
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                      className="w-24 rounded-lg border border-slate-200 p-1 text-xs text-right font-mono text-slate-800"
                    />
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Estimated Tax:</span>
                    <span className="font-mono font-semibold">{formatCurrency(previewTax)}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-sm text-slate-900">
                    <span>Total Amount:</span>
                    <span className="font-mono text-base">{formatCurrency(previewTotal)}</span>
                  </div>
                  {Number(invoice.amountPaid || 0) > 0 && (
                    <div className="flex justify-between text-emerald-700 font-medium pt-1">
                      <span>Amount Paid:</span>
                      <span className="font-mono font-bold">{formatCurrency(Number(invoice.amountPaid))}</span>
                    </div>
                  )}
                  {Number(invoice.amountPaid || 0) > 0 && (
                    <div className="flex justify-between font-bold text-amber-800 pt-1">
                      <span>Estimated Balance Due:</span>
                      <span className="font-mono">{formatCurrency(Math.max(0, previewTotal - Number(invoice.amountPaid)))}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Submit / Cancel Buttons */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || isLocked}
                className="rounded-xl bg-amber-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-60 flex items-center gap-2 shadow-xs"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>{isSaving ? 'Saving Changes…' : 'Save Invoice'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* REVISION PROMPT MODAL */}
      {showReviseDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-4">
              <Edit3 size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Start Official Revision</h2>
            <p className="text-xs text-slate-500 mt-1">
              Please provide an audit reason for modifying this paid or issued invoice.
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
                onClick={() => setShowReviseDialog(false)}
                disabled={isRevising}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartRevision}
                disabled={isRevising || !reviseReason.trim()}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
              >
                {isRevising && <Loader2 size={14} className="animate-spin" />}
                <span>{isRevising ? 'Starting…' : 'Unlock & Edit'}</span>
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