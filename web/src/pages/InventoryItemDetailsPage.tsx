import type { InventoryItem, ProductService, StockMovement } from '../types';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useProductServices, useStockMovements, useInventoryItems } from '../hooks';
import { formatCurrency } from '../lib/currency';
import { ROUTES } from '../routes';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Plus, RefreshCw, X, XCircle, Package as PackageIcon } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

type ToastState = {
  message: string;
  type: ToastType;
} | null;

type AdjustmentForm = {
  quantityChange: number;
  reason: string;
  notes: string;
};

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: React.ReactNode;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </p>
      <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {subtitle}
      </p>
    </div>
  );
}

function getToastIcon(type: ToastType) {
  if (type === 'success') return <CheckCircle2 className="h-4 w-4" />;
  if (type === 'error') return <XCircle className="h-4 w-4" />;
  return <AlertCircle className="h-4 w-4" />;
}

function DetailValue({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p
        className={`mt-2 break-words text-sm font-semibold text-slate-900 ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default function InventoryItemDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: productServices = [], loading: productsLoading } =
    useProductServices();
  const {
    data: stockMovements = [],
    loading: movementsLoading,
    refresh: refreshMovements,
  } = useStockMovements();
  const { getItem, adjustStock } = useInventoryItems();

  const inventoryId = useMemo(() => {
    const value = new URLSearchParams(location.search).get('id');
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
  }, [location.search]);

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loadingItem, setLoadingItem] = useState(true);
  const [itemError, setItemError] = useState<string | null>(null);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [form, setForm] = useState<AdjustmentForm>({
    quantityChange: 0,
    reason: '',
    notes: '',
  });

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  const loadItem = async () => {
    if (!inventoryId) {
      setItem(null);
      setItemError('No inventory item was selected.');
      setLoadingItem(false);
      return;
    }

    setLoadingItem(true);
    setItemError(null);

    try {
      const response = await getItem(inventoryId);
      setItem(response);
    } catch {
      setItem(null);
      setItemError('Unable to load this inventory item.');
    } finally {
      setLoadingItem(false);
    }
  };

  useEffect(() => {
    void loadItem();
  }, [inventoryId]);

  const product = useMemo<ProductService | undefined>(
    () =>
      productServices.find(
        (entry: ProductService) => entry.id === item?.productServiceId,
      ),
    [item?.productServiceId, productServices],
  );

  const itemMovements = useMemo<StockMovement[]>(
    () =>
      stockMovements
        .filter(
          (movement: StockMovement) =>
            movement.inventoryItemId === item?.id,
        )
        .sort(
          (a: StockMovement, b: StockMovement) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime(),
        ),
    [item?.id, stockMovements],
  );

  const isLowStock =
    item !== null && item.quantityOnHand <= item.reorderThreshold;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadItem(), refreshMovements()]);
    setIsRefreshing(false);
    showToast('Inventory details refreshed.', 'info');
  };

  const handleAdjustment = async () => {
    if (!inventoryId) {
      showToast('A valid inventory item is required.', 'error');
      return;
    }

    if (!form.quantityChange || !form.reason.trim()) {
      showToast('Enter a quantity change and reason.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      await adjustStock(inventoryId, {
        quantityChange: Number(form.quantityChange),
        reason: form.reason.trim(),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      });

      setShowAdjustmentModal(false);
      setForm({ quantityChange: 0, reason: '', notes: '' });
      await Promise.all([loadItem(), refreshMovements()]);
      showToast('Stock adjustment saved successfully.');
    } catch {
      showToast('Failed to save the stock adjustment.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100';

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <button
              type="button"
              onClick={() => navigate(ROUTES.SCREEN_RECURRING_INVOICES)}
              className="mb-4 inline-flex min-h-[40px] items-center gap-2 rounded-lg text-sm font-medium text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Recurring Invoices
            </button>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
                <PackageIcon className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {product?.name || 'Inventory item details'}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Review stock levels, cost information, and adjustment history.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowAdjustmentModal(true)}
              disabled={!item}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Adjust stock
            </button>
          </div>
        </div>

        {loadingItem ? (
          <div className="space-y-6">
            <div className="h-40 animate-pulse rounded-2xl border border-slate-200/80 bg-white" />
            <div className="h-72 animate-pulse rounded-2xl border border-slate-200/80 bg-white" />
          </div>
        ) : itemError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
              <div>
                <h2 className="font-semibold text-red-900">
                  Unable to display inventory details
                </h2>
                <p className="mt-1 text-sm text-red-700">{itemError}</p>
                <button
                  type="button"
                  onClick={loadItem}
                  className="mt-4 min-h-[40px] rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        ) : item ? (
          <>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.25fr_0.75fr]">
              <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Inventory overview
                    </p>
                    <h2 className="mt-2 text-xl font-bold text-slate-900">
                      {product?.name || `Item #${item.id}`}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {product?.sku ? `SKU ${product.sku}` : 'No SKU assigned'}
                    </p>
                  </div>
                  <span
                    className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      isLowStock
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isLowStock ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                    />
                    {isLowStock ? 'Low stock' : 'Healthy stock'}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DetailValue
                    label="Quantity on hand"
                    value={item.quantityOnHand}
                    mono
                  />
                  <DetailValue
                    label="Reorder threshold"
                    value={item.reorderThreshold}
                    mono
                  />
                  <DetailValue
                    label="Unit cost"
                    value={formatCurrency(Number(item.unitCost) || 0)}
                  />
                  <DetailValue
                    label="Inventory value"
                    value={formatCurrency(
                      (Number(item.unitCost) || 0) *
                        (Number(item.quantityOnHand) || 0),
                    )}
                  />
                  <DetailValue
                    label="Location"
                    value={item.location || 'Not specified'}
                  />
                  <DetailValue
                    label="Product type"
                    value={product?.type || 'Not specified'}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Record metadata
                </p>
                <div className="mt-5 space-y-4">
                  <DetailValue label="Inventory ID" value={item.id} mono />
                  <DetailValue
                    label="Product or service ID"
                    value={item.productServiceId}
                    mono
                  />
                  <DetailValue
                    label="Created"
                    value={formatDate(item.createdAt)}
                  />
                  <DetailValue
                    label="Last updated"
                    value={formatDate(item.updatedAt)}
                  />
                  <DetailValue
                    label="Status"
                    value={item.isArchived ? 'Archived' : 'Active'}
                  />
                </div>
              </section>
            </div>

            <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex flex-col justify-between gap-3 border-b border-slate-200/80 p-6 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Stock movement history
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Auditable adjustments recorded for this inventory item.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {itemMovements.length} movement
                  {itemMovements.length === 1 ? '' : 's'}
                </span>
              </div>

              {movementsLoading ? (
                <div className="p-6">
                  <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
                </div>
              ) : itemMovements.length === 0 ? (
                <div className="p-10 text-center">
                  <PackageIcon className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm font-medium text-slate-700">
                    No stock movements yet
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Adjustments for this item will appear here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200/80">
                    <thead className="bg-slate-50/80">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Change
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Reason
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {itemMovements.map((movement) => (
                        <tr key={movement.id} className="transition hover:bg-slate-50/70">
                          <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                            {formatDate(movement.createdAt)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 font-mono text-sm font-semibold">
                            <span
                              className={
                                movement.quantityChange > 0
                                  ? 'text-emerald-600'
                                  : 'text-rose-600'
                              }
                            >
                              {movement.quantityChange > 0 ? '+' : ''}
                              {movement.quantityChange}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-900">
                            {movement.reason || '—'}
                          </td>
                          <td className="max-w-sm px-6 py-4 text-sm text-slate-500">
                            {movement.notes || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>

      {showAdjustmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowAdjustmentModal(false)}
              className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close adjustment dialog"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="pr-8 text-lg font-bold text-slate-900">
              Adjust stock
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Record an increase or decrease for this inventory item.
            </p>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Quantity change
                </span>
                <input
                  className={inputClass}
                  type="number"
                  value={form.quantityChange || ''}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      quantityChange: Number(event.target.value) || 0,
                    }))
                  }
                  placeholder="Use a negative number to remove stock"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Reason
                </span>
                <input
                  className={inputClass}
                  value={form.reason}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                  placeholder="e.g. Purchase receipt or damaged goods"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Notes <span className="font-normal text-slate-400">(optional)</span>
                </span>
                <textarea
                  className={`${inputClass} min-h-[96px] py-3`}
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Add context for the audit trail"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAdjustmentModal(false)}
                className="min-h-[44px] rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdjustment}
                disabled={isSubmitting}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting && <RefreshCw className="h-4 w-4 animate-spin" />}
                Save adjustment
              </button>
            </div>
          </div>
        </div>
      )}

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
          {getToastIcon(toast.type)}
          {toast.message}
        </div>
      )}

      {productsLoading && item && (
        <div className="sr-only" aria-live="polite">
          Loading product information
        </div>
      )}
    </>
  );
}