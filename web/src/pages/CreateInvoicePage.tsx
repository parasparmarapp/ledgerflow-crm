import React, { useState, useEffect } from 'react';
import { useClients, useProductServices, useInvoices } from '../hooks';
import { formatCurrency } from '../lib/currency';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { Select, DatePicker, ProductItemCombobox, CatalogPickerModal } from '../components';
import { 
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Save,
  Plus,
  Trash2,
  ChevronRight,
  Boxes,
  Package
} from 'lucide-react';

type LineItem = {
  id: string;
  productServiceId?: number;
  description: string;
  group?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountAmount: number;
};

type Toast = {
  message: string;
  type: 'success' | 'error' | 'info';
};

export default function CreateInvoicePage() {
  const navigate = useNavigate();
  const { data: clients = [] } = useClients();
  const { data: products = [] } = useProductServices();
  const { create: createInvoice } = useInvoices();

  const [clientId, setClientId] = useState<number>(0);
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-2026-${String(Math.floor(Math.random() * 900) + 100)}`);
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [status, setStatus] = useState<'draft' | 'sent' | 'paid'>('sent');
  const [sendEmailNotification, setSendEmailNotification] = useState<boolean>(true);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [notes, setNotes] = useState('Thank you for choosing LedgerFlow CRM. Please remit payment by the due date.');
  const [terms, setTerms] = useState('Payment due within 14 days. Bank wire or official cheque accepted.');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // Default line item
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: '1',
      description: 'Consultation & Initial Setup',
      quantity: 1,
      unitPrice: 500,
      taxRate: 10,
      discountAmount: 0,
    },
  ]);

  // Preselect a client only when arriving from a client profile (?clientId=);
  // otherwise the user must choose explicitly so invoices aren't billed to the wrong client.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const queryClientId = Number(searchParams.get('clientId'));
    if (!clientId && queryClientId && clients.some((client) => client.id === queryClientId)) {
      setClientId(queryClientId);
    }
  }, [clients, clientId, searchParams]);

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [taxRates, setTaxRates] = useState<{ id: number; name: string; rate: number; isDefault?: boolean }[]>([]);

  useEffect(() => {
    api.get<{ id: number; name: string; rate: number; isDefault?: boolean }[]>('/settings/tax-rates')
      .then((res) => {
        if (Array.isArray(res) && res.length > 0) {
          setTaxRates(res);
          const def = res.find((r) => r.isDefault);
          if (def) {
            setLineItems((prev) =>
              prev.map((item, idx) =>
                idx === 0 && !item.productServiceId && item.taxRate === 10
                  ? { ...item, taxRate: Number(def.rate) }
                  : item
              )
            );
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleCatalogSelect = (prod: any) => {
    // If there is only 1 item and it's untouched/empty, replace it
    if (
      lineItems.length === 1 &&
      !lineItems[0].productServiceId &&
      (!lineItems[0].description.trim() || lineItems[0].description === 'Consultation & Initial Setup')
    ) {
      setLineItems([
        {
          id: lineItems[0].id,
          productServiceId: prod.id,
          description: prod.name,
          group: prod.group,
          quantity: 1,
          unitPrice: Number(prod.unitPrice || 0),
          taxRate: Number(prod.taxRate !== undefined && prod.taxRate !== null ? prod.taxRate : (taxRates.find((t) => t.isDefault)?.rate ?? 0)),
          discountAmount: 0,
        },
      ]);
    } else {
      addLineItem(prod);
    }
    showToast(`Added "${prod.name}" to invoice`, 'success');
  };

  const addLineItem = (prod?: any) => {
    const defaultRate = taxRates.find((t) => t.isDefault)?.rate ?? 0;
    if (prod) {
      setLineItems((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          productServiceId: prod.id,
          description: prod.name,
          group: prod.group,
          quantity: 1,
          unitPrice: Number(prod.unitPrice || 0),
          taxRate: Number(prod.taxRate !== undefined && prod.taxRate !== null ? prod.taxRate : defaultRate),
          discountAmount: 0,
        },
      ]);
    } else {
      setLineItems((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          description: '',
          quantity: 1,
          unitPrice: 0,
          taxRate: Number(defaultRate),
          discountAmount: 0,
        },
      ]);
    }
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return { ...item, [field]: value };
      })
    );
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) {
      showToast('Invoice must have at least one line item.', 'info');
      return;
    }
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Financial totals calculations
  const subtotal = lineItems.reduce(
    (sum, item) => sum + (Number(item.quantity || 1) * Number(item.unitPrice || 0)),
    0
  );

  const totalTax = lineItems.reduce((sum, item) => {
    const itemTotal = Number(item.quantity || 1) * Number(item.unitPrice || 0);
    return sum + (itemTotal * (Number(item.taxRate || 0) / 100));
  }, 0);

  const grandTotal = Math.max(0, subtotal - discountAmount + totalTax);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!clientId) nextErrors.clientId = 'Please select a client.';
    if (!invoiceNumber.trim()) nextErrors.invoiceNumber = 'Invoice number is required.';
    if (!issueDate) nextErrors.issueDate = 'Issue date is required.';
    if (!dueDate) nextErrors.dueDate = 'Due date is required.';
    if (lineItems.some((i) => !i.description.trim())) {
      nextErrors.lineItems = 'All line items must have a description.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      showToast('Please complete all highlighted fields.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const created = await createInvoice({
        clientId: Number(clientId),
        invoiceNumber: invoiceNumber.trim(),
        issueDate,
        dueDate,
        status,
        subtotal,
        discountAmount,
        taxAmount: totalTax,
        totalAmount: grandTotal,
        amountPaid: status === 'paid' ? grandTotal : 0,
        notes: notes.trim() || undefined,
        terms: terms.trim() || undefined,
        channels: sendEmailNotification ? ['email'] : [],
        notify: sendEmailNotification,
        lineItems: lineItems.map((item) => ({
          productServiceId: item.productServiceId,
          description: item.description,
          quantity: Number(item.quantity || 1),
          unitPrice: Number(item.unitPrice || 0),
          discountAmount: Number(item.discountAmount || 0),
          taxRate: Number(item.taxRate || 0),
          lineTotal: (Number(item.quantity || 1) * Number(item.unitPrice || 0)),
        })),
      });

      showToast('Invoice generated and recorded successfully!', 'success');
      setTimeout(() => {
        navigate(`/invoice-details?id=${created.id}`);
      }, 700);
    } catch (err: any) {
      showToast(err?.message || 'Failed to create invoice.', 'error');
      setIsSubmitting(false);
    }
  };

  const handleSelectProduct = (id: string, prodId: number | '') => {
    if (!prodId) {
      updateLineItem(id, 'productServiceId', undefined);
      return;
    }
    const prod = products.find((p) => p.id === Number(prodId));
    if (prod) {
      setLineItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          return {
            ...item,
            productServiceId: prod.id,
            description: prod.name,
            group: prod.group,
            unitPrice: Number(prod.unitPrice || 0),
            taxRate: Number(prod.taxRate || 0),
          };
        })
      );
    }
  };

  return (
    <div className="min-h-full bg-slate-50 font-sans">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => navigate('/invoices')}
              className="mt-1 p-2 rounded-xl border border-slate-200 bg-white text-slate-600 shadow-xs hover:bg-slate-50 cursor-pointer"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
                <span>Invoicing</span>
                <ChevronRight size={14} />
                <span className="text-slate-700">Create New Invoice</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                New Commercial Invoice
              </h1>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Invoice Metadata */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">
              Invoice Header &amp; Client Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Select
                  label="Client Account"
                  required
                  placeholder="Select a client..."
                  value={clientId}
                  onChange={(val) => setClientId(Number(val))}
                  options={clients.map((c) => ({
                    value: c.id,
                    label: c.name,
                    sublabel: c.companyName || undefined,
                  }))}
                  error={errors.clientId}
                  searchable
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Invoice Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-amber-500 shadow-2xs"
                />
              </div>

              <div>
                <DatePicker
                  label="Issue Date"
                  value={issueDate}
                  onChange={setIssueDate}
                />
              </div>

              <div>
                <DatePicker
                  label="Payment Due Date"
                  value={dueDate}
                  onChange={setDueDate}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-700">Initial Status:</span>
                <div className="flex gap-2">
                  {[
                    { key: 'draft', label: 'Draft' },
                    { key: 'sent', label: 'Sent (Deducts Inventory)' },
                    { key: 'paid', label: 'Paid in Full' },
                  ].map((st) => (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => setStatus(st.key as any)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        status === st.key
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sendEmailNotification}
                  onChange={(e) => setSendEmailNotification(e.target.checked)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span>Email invoice to client immediately upon creation</span>
              </label>
            </div>
          </div>

          {/* 2. Line Items Table with Inline Searchable Product Selector */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                  Invoice Line Items
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Search and pick catalog products with live stock info or add custom line items.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCatalogModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                >
                  <Boxes size={15} />
                  <span>Browse Catalog</span>
                </button>
                <button
                  type="button"
                  onClick={() => addLineItem()}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add Blank Row</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-visible">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-3 min-w-[280px]">Product / Service</th>
                    <th className="px-3 py-3 min-w-[200px]">Description &amp; Notes</th>
                    <th className="px-2 py-3 w-20">Qty</th>
                    <th className="px-3 py-3 w-28">Unit Price</th>
                    <th className="px-2 py-3 w-20">Tax (%)</th>
                    <th className="px-3 py-3 w-28 text-right">Line Total</th>
                    <th className="px-2 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lineItems.map((item) => {
                    const itemLineTotal = Number(item.quantity || 1) * Number(item.unitPrice || 0);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-3 align-top">
                          <ProductItemCombobox
                            products={products}
                            value={item.productServiceId}
                            onChange={(val) => handleSelectProduct(item.id, val)}
                            onOpenCatalogModal={() => setIsCatalogModalOpen(true)}
                            placeholder="Custom / Non-Catalog Item"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                            placeholder="Item description or specifications..."
                            className="w-full min-h-[38px] p-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:border-amber-500"
                          />
                        </td>
                        <td className="px-2 py-3">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(item.id, 'quantity', Number(e.target.value))}
                            className="w-full min-h-[38px] p-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-900 text-center"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => updateLineItem(item.id, 'unitPrice', Number(e.target.value))}
                            className="w-full min-h-[38px] p-2 rounded-lg border border-slate-200 bg-white text-xs font-mono font-bold text-slate-900"
                          />
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex flex-col gap-1">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              value={item.taxRate}
                              onChange={(e) => updateLineItem(item.id, 'taxRate', Number(e.target.value))}
                              className="w-full min-h-[34px] p-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 text-center focus:border-amber-500 focus:outline-none"
                            />
                            {taxRates.length > 0 && (
                              <select
                                value={taxRates.some((t) => Number(t.rate) === Number(item.taxRate)) ? Number(item.taxRate) : 'custom'}
                                onChange={(e) => {
                                  if (e.target.value !== 'custom') {
                                    updateLineItem(item.id, 'taxRate', Number(e.target.value));
                                  }
                                }}
                                className="w-full text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 focus:border-amber-500 focus:outline-none cursor-pointer"
                              >
                                <option value="custom">Preset...</option>
                                {taxRates.map((tr) => (
                                  <option key={tr.id} value={Number(tr.rate)}>
                                    {tr.name} ({Number(tr.rate)}%)
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 font-mono font-bold text-right text-slate-900">
                          {formatCurrency(itemLineTotal)}
                        </td>
                        <td className="px-2 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => removeLineItem(item.id)}
                            className="p-1 rounded text-slate-400 hover:text-red-600 cursor-pointer"
                            title="Remove row"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Subtotal & Totals Box */}
            <div className="pt-4 flex flex-col items-end space-y-2 border-t border-slate-200 text-xs">
              <div className="flex justify-between w-64 text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between w-64 text-slate-600">
                <span>Total Tax Breakdown:</span>
                <span className="font-mono font-semibold text-slate-900">{formatCurrency(totalTax)}</span>
              </div>
              <div className="flex justify-between w-64 text-slate-600 items-center">
                <span>Order Discount:</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value))}
                  className="w-24 p-1 text-right rounded border border-slate-200 font-mono text-xs font-semibold"
                />
              </div>
              <div className="flex justify-between w-64 pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
                <span>Grand Total:</span>
                <span className="font-mono text-amber-700 text-base">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* 4. Notes & Terms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
              <label className="block text-xs font-bold text-slate-700">Customer Notes</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-800"
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
              <label className="block text-xs font-bold text-slate-700">Terms &amp; Conditions</label>
              <textarea
                rows={3}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-800"
              />
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/invoices')}
              className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Creating Invoice...' : 'Generate & Issue Invoice'}
            </button>
          </div>
        </form>
      </div>

      {/* Product Catalog Picker Modal */}
      <CatalogPickerModal
        isOpen={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
        products={products}
        onSelectProduct={handleCatalogSelect}
      />

      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold text-white shadow-xl ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}