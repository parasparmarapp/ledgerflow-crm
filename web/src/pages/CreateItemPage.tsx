import type { ProductService } from '../types';
import React, { useState } from 'react';
import { useProductServices } from '../hooks';
import { useNavigate, Link } from 'react-router-dom';
import { Select } from '../components';
import { api } from '../lib/api';
import { formatCurrency } from '../lib/currency';
import {
  ArrowLeft,
  Boxes,
  Check,
  CheckCircle2,
  AlertTriangle,
  Info,
  Package as PackageIcon,
  Warehouse,
  Coins,
  ShieldAlert,
  Loader2,
  XCircle,
  ExternalLink,
} from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

type ItemFormState = {
  productServiceId: number;
  quantityOnHand: number;
  reorderThreshold: number;
  unitCost: number;
  location: string;
};

type FieldErrors = Partial<Record<keyof ItemFormState, string>>;

export default function CreateItemPage() {
  const navigate = useNavigate();
  const productServicesQuery = useProductServices();
  const productServices: ProductService[] = productServicesQuery.data ?? [];

  const [form, setForm] = useState<ItemFormState>({
    productServiceId: 0,
    quantityOnHand: 0,
    reorderThreshold: 5,
    unitCost: 0,
    location: '',
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  const updateField = <K extends keyof ItemFormState>(
    field: K,
    value: ItemFormState[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const selectedProduct = productServices.find(
    (product) => product.id === form.productServiceId,
  );

  const handleProductSelect = (idStr: string | number) => {
    const id = Number(idStr) || 0;
    const prod = productServices.find((p) => p.id === id);
    setForm((current) => ({
      ...current,
      productServiceId: id,
      unitCost: prod?.costPrice ? Number(prod.costPrice) : current.unitCost,
    }));
    setErrors((current) => ({ ...current, productServiceId: undefined }));
  };

  const validate = (): FieldErrors => {
    const nextErrors: FieldErrors = {};

    if (form.productServiceId <= 0) {
      nextErrors.productServiceId = 'Please select a catalog product or service.';
    }
    if (form.quantityOnHand < 0) {
      nextErrors.quantityOnHand = 'Initial quantity cannot be negative.';
    }
    if (form.reorderThreshold < 0) {
      nextErrors.reorderThreshold = 'Reorder threshold cannot be negative.';
    }
    if (form.unitCost < 0) {
      nextErrors.unitCost = 'Unit cost cannot be negative.';
    }

    return nextErrors;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      showToast('Please correct the highlighted fields.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/inventory', {
        productServiceId: form.productServiceId,
        quantityOnHand: Number(form.quantityOnHand) || 0,
        reorderThreshold: Number(form.reorderThreshold) || 0,
        unitCost: Number(form.unitCost) || 0,
        location: form.location.trim() || 'Main Warehouse',
      });

      showToast(
        `Inventory record created for "${selectedProduct?.name || 'Item'}".`,
        'success',
      );

      window.setTimeout(() => {
        navigate('/inventory-list');
      }, 700);
    } catch (err: any) {
      showToast(
        err?.message || 'Failed to create inventory record. Please try again.',
        'error',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalValuation = Number(form.quantityOnHand || 0) * Number(form.unitCost || 0);

  const getStockStatus = () => {
    const qty = Number(form.quantityOnHand || 0);
    const threshold = Number(form.reorderThreshold || 0);
    if (qty === 0) {
      return {
        label: 'Out of Stock Opening',
        color: 'bg-slate-100 text-slate-700 border-slate-200',
        badge: 'Zero balance',
      };
    }
    if (qty <= threshold) {
      return {
        label: 'Low Stock Alert Level',
        color: 'bg-amber-50 text-amber-800 border-amber-200',
        badge: 'At or below reorder threshold',
      };
    }
    return {
      label: 'Healthy Stock Level',
      color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      badge: 'Above reorder threshold',
    };
  };

  const stockStatus = getStockStatus();

  return (
    <div className="min-h-full bg-slate-50 pb-16">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Navigation / Header */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => navigate('/inventory-list')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer mb-4"
          >
            <ArrowLeft size={16} />
            <span>Back to Inventory Stock</span>
          </button>

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-200/50 shadow-xs">
                <Boxes size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                  Add Inventory Item
                </h1>
                <p className="mt-1 text-xs text-slate-500">
                  Connect catalog products to stock tracking, establish opening quantities, and set automated reorder alerts.
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-xs">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Inventory Setup Mode</span>
            </div>
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left 2 Cols: Form Setup */}
            <div className="lg:col-span-2 space-y-6">
              {/* Card 1: Product Link */}
              <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
                <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <PackageIcon size={18} className="text-amber-600" />
                      1. Connect Product or Service
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select which item in your catalog will be tracked in inventory.
                    </p>
                  </div>
                  <Link
                    to="/create-service"
                    className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-800"
                  >
                    <span>+ New Product</span>
                    <ExternalLink size={12} />
                  </Link>
                </div>

                <div>
                  <Select
                    label="Catalog Item"
                    required
                    value={form.productServiceId}
                    onChange={handleProductSelect}
                    disabled={productServicesQuery.loading}
                    placeholder={
                      productServicesQuery.loading
                        ? 'Loading catalog products...'
                        : 'Choose product to track in stock...'
                    }
                    options={productServices.map((product) => ({
                      value: product.id,
                      label: `${product.name} ${product.sku ? `(${product.sku})` : ''}`,
                      sublabel: `${product.group || 'Commodities'} · ${product.type}`,
                    }))}
                    searchable
                  />
                  {errors.productServiceId && (
                    <p className="mt-1.5 text-xs font-medium text-rose-600 flex items-center gap-1">
                      <AlertTriangle size={13} />
                      {errors.productServiceId}
                    </p>
                  )}

                  {selectedProduct && (
                    <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/50 p-3.5 flex items-start gap-3">
                      {selectedProduct.imageUrl ? (
                        <img
                          src={selectedProduct.imageUrl}
                          alt=""
                          className="h-12 w-12 rounded-lg object-cover border border-amber-200 shrink-0 bg-white"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                          <PackageIcon size={20} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 truncate">
                            {selectedProduct.name}
                          </span>
                          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            {selectedProduct.group || 'General'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {selectedProduct.description || 'No description entered.'}
                        </p>
                        <div className="mt-2 flex items-center gap-4 text-xs font-mono text-slate-600">
                          <span>Selling Price: <strong className="text-slate-900">{formatCurrency(Number(selectedProduct.unitPrice) || 0)}</strong></span>
                          {selectedProduct.sku && <span>SKU: <strong>{selectedProduct.sku}</strong></span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Card 2: Stock Quantities & Thresholds */}
              <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
                <div className="mb-5 border-b border-slate-100 pb-4">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Boxes size={18} className="text-indigo-600" />
                    2. Quantity &amp; Reorder Threshold
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Define initial physical stock on hand and trigger points for replenishment alerts.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label
                      htmlFor="quantityOnHand"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700"
                    >
                      Opening Quantity on Hand <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="quantityOnHand"
                      type="number"
                      min={0}
                      step={1}
                      value={form.quantityOnHand}
                      onChange={(e) =>
                        updateField('quantityOnHand', Number(e.target.value) || 0)
                      }
                      className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                      placeholder="0"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      Units physically present right now in your warehouse/shop.
                    </p>
                    {errors.quantityOnHand && (
                      <p className="mt-1 text-xs font-medium text-rose-600">
                        {errors.quantityOnHand}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="reorderThreshold"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700"
                    >
                      Reorder Threshold <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="reorderThreshold"
                      type="number"
                      min={0}
                      step={1}
                      value={form.reorderThreshold}
                      onChange={(e) =>
                        updateField('reorderThreshold', Number(e.target.value) || 0)
                      }
                      className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                      placeholder="5"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      Alert triggers when inventory drops to or below this count.
                    </p>
                    {errors.reorderThreshold && (
                      <p className="mt-1 text-xs font-medium text-rose-600">
                        {errors.reorderThreshold}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* Card 3: Unit Cost & Storage Location */}
              <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
                <div className="mb-5 border-b border-slate-100 pb-4">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Coins size={18} className="text-emerald-600" />
                    3. Unit Valuation &amp; Storage Facility
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Specify the purchase/production unit cost and assigned warehouse storage location.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label
                      htmlFor="unitCost"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700"
                    >
                      Unit Cost
                    </label>
                    <div className="relative">
                      <input
                        id="unitCost"
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.unitCost}
                        onChange={(e) =>
                          updateField('unitCost', Number(e.target.value) || 0)
                        }
                        className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-mono font-bold text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                        placeholder="0.00"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Cost per unit for inventory asset valuation calculation.
                    </p>
                    {errors.unitCost && (
                      <p className="mt-1 text-xs font-medium text-rose-600">
                        {errors.unitCost}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="location"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700"
                    >
                      Storage Location
                    </label>
                    <div className="relative">
                      <input
                        id="location"
                        type="text"
                        value={form.location}
                        onChange={(e) => updateField('location', e.target.value)}
                        placeholder="e.g. Main Warehouse, Bay 4-A"
                        className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Physical bin, rack, or branch location for stock pickers.
                    </p>
                  </div>
                </div>
              </section>
            </div>

            {/* Right Column: Live Summary Card & Guidelines */}
            <div className="space-y-6">
              {/* Summary Card */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sticky top-6">
                <div className="border-b border-slate-100 pb-4 mb-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Live Record Preview
                  </span>
                  <h3 className="text-lg font-black text-slate-900 mt-1">
                    {selectedProduct?.name || 'Unassigned Product'}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {selectedProduct?.sku ? `SKU: ${selectedProduct.sku}` : 'SKU: None'}
                  </p>
                </div>

                {/* Stock Status Badge */}
                <div className={`rounded-xl border p-3 mb-4 ${stockStatus.color}`}>
                  <div className="flex items-center gap-2 font-bold text-xs">
                    {Number(form.quantityOnHand) <= Number(form.reorderThreshold) ? (
                      <ShieldAlert size={16} />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    <span>{stockStatus.label}</span>
                  </div>
                  <p className="text-[11px] mt-1 opacity-80">{stockStatus.badge}</p>
                </div>

                {/* Calculated Metrics */}
                <div className="space-y-3 py-2 border-b border-slate-100 text-xs text-slate-600">
                  <div className="flex justify-between items-center">
                    <span>Opening Units:</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {form.quantityOnHand} units
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Reorder Alert At:</span>
                    <span className="font-bold text-slate-900 font-mono">
                      &le; {form.reorderThreshold} units
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Unit Cost:</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {formatCurrency(Number(form.unitCost) || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Storage Facility:</span>
                    <span className="font-bold text-slate-900">
                      {form.location.trim() || 'Main Warehouse'}
                    </span>
                  </div>
                </div>

                {/* Total Valuation */}
                <div className="pt-4 mb-6">
                  <span className="block text-xs font-semibold text-slate-500">
                    Total Opening Stock Valuation
                  </span>
                  <span className="block text-2xl font-black text-slate-900 font-mono mt-1">
                    {formatCurrency(totalValuation)}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2.5">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 text-sm font-bold text-white shadow-xs transition hover:bg-amber-700 disabled:opacity-60 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Creating Item…</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>Create Inventory Item</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/inventory-list')}
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                {/* Audit helper note */}
                <div className="mt-5 rounded-xl bg-slate-50 border border-slate-100 p-3 text-[11px] text-slate-500 flex items-start gap-2">
                  <Info size={15} className="shrink-0 text-slate-400 mt-0.5" />
                  <span>
                    Saving this record automatically logs an opening stock ledger transaction and activates live inventory tracking for invoices.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === 'success'
              ? 'bg-emerald-600'
              : toast.type === 'error'
              ? 'bg-red-500'
              : 'bg-indigo-500'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={18} />
          ) : (
            <XCircle size={18} />
          )}
          {toast.message}
        </div>
      )}
    </div>
  );
}