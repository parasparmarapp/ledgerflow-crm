import type { InventoryItem, Invoice, ProductService } from '../types';
import React, { useEffect, useMemo, useState } from 'react';
import { useInvoices, useInventoryItems, useProductServices } from '../hooks';
import { formatCurrency } from '../lib/currency';
import { ROUTES } from '../routes';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Select } from '../components';
import { ArrowLeft, Calendar, CheckCircle2, ChevronDown, Clock, DollarSign, RefreshCw, XCircle, Activity as ActivityIcon, Package as PackageIcon, Tag as TagIcon } from 'lucide-react';

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function DetailRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="mt-0.5 rounded-lg border border-slate-200 bg-white p-2 text-slate-500">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className="mt-1 break-words text-sm font-semibold text-slate-900">
          {value}
        </p>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p className="mt-3 font-mono text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-600">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

export default function ProductOrServiceDetailsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productsResult = useProductServices();
  const inventoryResult = useInventoryItems();
  const invoicesResult = useInvoices();

  const products = (productsResult.data ?? []) as ProductService[];
  const inventory = (inventoryResult.data ?? []) as InventoryItem[];
  const invoices = (invoicesResult.data ?? []) as Invoice[];

  const [selectedId, setSelectedId] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const queryId = Number(searchParams.get('id'));
    if (queryId && products.some((item) => Number(item?.id ?? 0) === queryId)) {
      setSelectedId(queryId);
    }
  }, [searchParams, products]);

  useEffect(() => {
    if (selectedId === 0 && products.length > 0 && !searchParams.get('id')) {
      setSelectedId(Number(products[0]?.id ?? 0));
    }
  }, [products, selectedId]);

  const product = useMemo(
    () =>
      products.find((item) => Number(item?.id ?? 0) === selectedId) ??
      products[0],
    [products, selectedId],
  );

  const productInventory = useMemo(
    () =>
      inventory.find(
        (item) =>
          Number(item?.productServiceId ?? 0) === Number(product?.id ?? 0),
      ),
    [inventory, product],
  );

  const isLoading =
    Boolean(productsResult.loading) ||
    Boolean(inventoryResult.loading) ||
    Boolean(invoicesResult.loading);

  const error =
    productsResult.error || inventoryResult.error || invoicesResult.error;

  const stockQuantity = Number(productInventory?.quantityOnHand ?? 0);
  const reorderThreshold = Number(productInventory?.reorderThreshold ?? 0);
  const isLowStock =
    Boolean(productInventory) && stockQuantity <= reorderThreshold;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        productsResult.refresh(),
        inventoryResult.refresh(),
        invoicesResult.refresh(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading && products.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-72 rounded-lg bg-slate-200" />
          <div className="h-4 w-96 max-w-full rounded bg-slate-200" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-32 rounded-2xl bg-slate-200" />
            ))}
          </div>
          <div className="h-96 rounded-2xl bg-slate-200" />
        </div>
      </div>
    );
  }

  if (error && products.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 text-red-600" />
            <div>
              <h1 className="font-semibold text-red-900">
                Unable to load product details
              </h1>
              <p className="mt-1 text-sm text-red-700">
                {String(error || "The product data could not be retrieved.")}
              </p>
              <button
                type="button"
                onClick={handleRefresh}
                className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center shadow-sm">
          <PackageIcon className="mx-auto h-10 w-10 text-slate-400" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">
            No products or services found
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Product and service records will appear here once they are available
            in your workspace.
          </p>
          <button
            type="button"
            onClick={() => navigate(ROUTES.SCREEN_RECURRING_INVOICES)}
            className="mt-6 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white transition hover:bg-amber-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Recurring Invoices
          </button>
        </div>
      </div>
    );
  }

  const unitPrice = Number(product.unitPrice ?? 0);
  const costPrice = Number(product.costPrice ?? 0);
  const taxRate = Number(product.taxRate ?? 0);
  const margin =
    costPrice > 0 ? ((unitPrice - costPrice) / costPrice) * 100 : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => navigate(ROUTES.SCREEN_RECURRING_INVOICES)}
              className="mt-1 inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Product or Service Details
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    product.isActive
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-slate-100 text-slate-600"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      product.isActive ? "bg-emerald-500" : "bg-slate-400"
                    }`}
                  />
                  {product.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Review pricing, tax, inventory, and record metadata.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
            <div className="w-56">
              <Select
                value={Number(product.id ?? 0)}
                onChange={(val) => setSelectedId(Number(val) || 0)}
                searchable
                options={products.map((item) => ({
                  value: Number(item.id),
                  label: String(item.name || 'Unnamed record'),
                }))}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Unit price"
            value={formatCurrency(unitPrice)}
            detail="Standard customer-facing price"
            icon={<DollarSign className="h-5 w-5" />}
          />
          <MetricCard
            label="Inventory"
            value={productInventory ? String(stockQuantity) : "—"}
            detail={
              productInventory
                ? `${String(productInventory.location || "No location assigned")}`
                : "No inventory record linked"
            }
            icon={<PackageIcon className="h-5 w-5" />}
          />
          <MetricCard
            label="Tax rate"
            value={`${taxRate.toFixed(2)}%`}
            detail="Applied to invoice line items"
            icon={<TagIcon className="h-5 w-5" />}
          />
          <MetricCard
            label="Invoice records"
            value={String(invoices.length)}
            detail="Available invoice records"
            icon={<ActivityIcon className="h-5 w-5" />}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-20 w-20 rounded-2xl object-cover border border-slate-200 shadow-xs shrink-0 bg-white"
                  />
                ) : (
                  <div className="rounded-2xl bg-rose-50 p-4 text-rose-600 shrink-0">
                    <PackageIcon className="h-8 w-8" />
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Record overview
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    {String(product.name || "Unnamed product or service")}
                  </h2>
                  <p className="mt-1.5 text-sm leading-6 text-slate-500">
                    {String(
                      product.description ||
                        "No description has been added for this record.",
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailRow
                label="Record type"
                value={String(product.type || "—")}
                icon={<TagIcon className="h-4 w-4" />}
              />
              <DetailRow
                label="SKU"
                value={String(product.sku || "Not assigned")}
                icon={<PackageIcon className="h-4 w-4" />}
              />
              <DetailRow
                label="Created"
                value={formatDate(product.createdAt)}
                icon={<Calendar className="h-4 w-4" />}
              />
              <DetailRow
                label="Last updated"
                value={formatDate(product.updatedAt)}
                icon={<Clock className="h-4 w-4" />}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Commercial snapshot
                </p>
                <h2 className="mt-2 text-lg font-bold text-slate-900">
                  Pricing health
                </h2>
              </div>
              {margin > 0 ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <XCircle className="h-5 w-5 text-slate-400" />
              )}
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <span className="text-sm text-slate-500">Cost price</span>
                <span className="font-mono text-sm font-semibold text-slate-900">
                  {costPrice > 0 ? formatCurrency(costPrice) : "Not set"}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <span className="text-sm text-slate-500">Gross margin</span>
                <span className="font-mono text-sm font-semibold text-slate-900">
                  {costPrice > 0 ? `${margin.toFixed(1)}%` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Stock status</span>
                <span
                  className={`text-sm font-semibold ${
                    !productInventory
                      ? "text-slate-500"
                      : isLowStock
                        ? "text-amber-600"
                        : "text-emerald-600"
                  }`}
                >
                  {!productInventory
                    ? "Not tracked"
                    : isLowStock
                      ? "Reorder soon"
                      : "Healthy"}
                </span>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Inventory connection
              </p>
              <h2 className="mt-2 text-lg font-bold text-slate-900">
                Stock record
              </h2>
            </div>
            {productInventory && (
              <span
                className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  isLowStock
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isLowStock ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                />
                {isLowStock ? "Below reorder threshold" : "Stock level healthy"}
              </span>
            )}
          </div>

          {productInventory ? (
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <DetailRow
                label="Quantity on hand"
                value={String(stockQuantity)}
                icon={<PackageIcon className="h-4 w-4" />}
              />
              <DetailRow
                label="Reorder threshold"
                value={String(reorderThreshold)}
                icon={<ActivityIcon className="h-4 w-4" />}
              />
              <DetailRow
                label="Unit cost"
                value={formatCurrency(Number(productInventory.unitCost ?? 0))}
                icon={<DollarSign className="h-4 w-4" />}
              />
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <PackageIcon className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                No inventory record linked
              </p>
              <p className="mt-1 text-sm text-slate-500">
                This product or service is not currently tracked in inventory.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}