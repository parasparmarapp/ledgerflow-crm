import type { Invoice } from '../types';
import React, { useEffect, useMemo, useState } from 'react';
import { useInvoices, usePayments } from '../hooks';
import { formatCurrency } from '../lib/currency';
import { Select, DatePicker } from '../components';
import { 
  X, 
  CreditCard, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  FileText,
  Building2,
  Calendar
} from 'lucide-react';

export interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  invoice?: Invoice | null;
  invoices?: Invoice[];
}

export function RecordPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  invoice: propInvoice,
  invoices: propInvoices,
}: RecordPaymentModalProps) {
  const { create: recordPayment } = usePayments();
  const { data: fetchedInvoices = [] } = useInvoices();

  const allInvoices = propInvoices && propInvoices.length > 0 ? propInvoices : fetchedInvoices;

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number>(0);
  const [amount, setAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<string>('bank_transfer');
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Active invoice being paid
  const activeInvoice = useMemo(() => {
    if (propInvoice) return propInvoice;
    if (selectedInvoiceId > 0) {
      return allInvoices.find((i) => i.id === selectedInvoiceId) || null;
    }
    return null;
  }, [propInvoice, selectedInvoiceId, allInvoices]);

  const totalAmount = Number(activeInvoice?.totalAmount || 0);
  const amountPaid = Number(activeInvoice?.amountPaid || 0);
  const balanceDue = Math.max(0, totalAmount - amountPaid);

  // Initialize form when modal opens or invoice changes
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      if (propInvoice) {
        setSelectedInvoiceId(propInvoice.id);
        const due = Math.max(0, Number(propInvoice.totalAmount || 0) - Number(propInvoice.amountPaid || 0));
        setAmount(due > 0 ? String(due) : String(propInvoice.totalAmount || 0));
      } else if (allInvoices.length > 0) {
        const unpaid = allInvoices.find(
          (i) => String(i.status).toLowerCase() !== 'paid' && Number(i.totalAmount) > Number(i.amountPaid || 0)
        ) || allInvoices[0];
        setSelectedInvoiceId(unpaid.id);
        const due = Math.max(0, Number(unpaid.totalAmount || 0) - Number(unpaid.amountPaid || 0));
        setAmount(due > 0 ? String(due) : String(unpaid.totalAmount || 0));
      }
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setReference('');
      setNotes('');
      setMethod('bank_transfer');
    }
  }, [isOpen, propInvoice, allInvoices]);

  const handleInvoiceSelect = (invId: number) => {
    setSelectedInvoiceId(invId);
    const found = allInvoices.find((i) => i.id === invId);
    if (found) {
      const due = Math.max(0, Number(found.totalAmount || 0) - Number(found.amountPaid || 0));
      setAmount(due > 0 ? String(due) : String(found.totalAmount || 0));
    }
  };

  const handlePayFullBalance = () => {
    setAmount(String(balanceDue));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!activeInvoice) {
      setErrorMsg('Please select an invoice to record payment for.');
      return;
    }

    const payAmount = Number(amount);
    if (Number.isNaN(payAmount) || payAmount <= 0) {
      setErrorMsg('Please enter a valid payment amount greater than 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      await recordPayment({
        invoiceId: activeInvoice.id,
        clientId: activeInvoice.clientId || 0,
        amount: payAmount,
        paymentDate,
        method,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to record payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl transition-all my-8">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CreditCard size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Record Payment</h2>
              <p className="text-xs text-slate-500">
                Log a received transaction against an invoice.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Invoice Selection or Summary */}
          {!propInvoice ? (
            <div>
              <Select
                label="Select Invoice"
                required
                placeholder="Choose an invoice..."
                value={selectedInvoiceId}
                onChange={(val) => handleInvoiceSelect(Number(val))}
                options={allInvoices.map((inv) => {
                  const due = Math.max(0, Number(inv.totalAmount || 0) - Number(inv.amountPaid || 0));
                  return {
                    value: inv.id,
                    label: `${inv.invoiceNumber} — ${inv.client?.name || `Client #${inv.clientId}`}`,
                    sublabel: `Total: ${formatCurrency(Number(inv.totalAmount || 0))} | Balance Due: ${formatCurrency(due)}`,
                  };
                })}
                searchable
              />
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">Invoice:</span>
                <span className="font-mono font-bold text-slate-900">{propInvoice.invoiceNumber}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">Client:</span>
                <span className="font-medium text-slate-800">{propInvoice.client?.name || `Client #${propInvoice.clientId}`}</span>
              </div>
            </div>
          )}

          {/* Financial Summary Card */}
          {activeInvoice && (
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 border border-slate-200/80 text-center">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block">Total Invoice</span>
                <span className="text-xs font-mono font-bold text-slate-800">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block">Already Paid</span>
                <span className="text-xs font-mono font-bold text-emerald-600">
                  {formatCurrency(amountPaid)}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block">Balance Due</span>
                <span className="text-xs font-mono font-bold text-rose-600">
                  {formatCurrency(balanceDue)}
                </span>
              </div>
            </div>
          )}

          {/* Amount Paid Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Payment Amount (GH₵) <span className="text-red-500">*</span>
              </label>
              {balanceDue > 0 && (
                <button
                  type="button"
                  onClick={handlePayFullBalance}
                  className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                >
                  Pay Full Balance ({formatCurrency(balanceDue)})
                </button>
              )}
            </div>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white pl-9 pr-4 text-xs font-mono font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* Payment Method & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Select
                label="Payment Method"
                required
                value={method}
                onChange={(val) => setMethod(String(val))}
                options={[
                  { value: 'cash', label: 'Cash' },
                  { value: 'bank_transfer', label: 'Bank Transfer' },
                  { value: 'momo', label: 'Mobile Money (MoMo)' },
                  { value: 'cheque', label: 'Cheque' },
                  { value: 'card', label: 'Credit/Debit Card' },
                ]}
              />
            </div>

            <div>
              <DatePicker
                label="Payment Date"
                value={paymentDate}
                onChange={setPaymentDate}
              />
            </div>
          </div>

          {/* Reference / Transaction ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Reference / Transaction ID
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. MOMO-982347, Cheque #402, Bank Slip Ref"
              className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3.5 text-xs text-slate-900 outline-none focus:border-emerald-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Payment Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Additional internal notes about this payment..."
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[40px] px-4 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[40px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 transition"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  Confirm &amp; Record Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
