import type { ProductService } from '../types';
import React, { useEffect, useMemo, useState } from 'react';
import { useProductServices } from '../hooks';
import { formatCurrency } from '../lib/currency';
import { ROUTES } from '../routes';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Select } from '../components';
import { compressImageFile } from '../lib/imageCompressor';
import { api } from '../lib/api';
import {
  ArrowLeft, 
  CheckCircle2,
  ChevronRight,
  DollarSign,
  Edit,
  Eye,
  Plus,
  RefreshCw,
  Save,
  Search,
  X,
  XCircle, 
  Package as PackageIcon,
  Image as ImageIcon,
  Upload,
  Trash2
} from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

type Toast = {
  message: string;
  type: ToastType;
} | null;

type ProductForm = {
  name: string;
  description: string;
  type: string;
  group: string;
  sku: string;
  imageUrl: string;
  unitPrice: number;
  costPrice: number;
  taxRate: number;
  isActive: boolean;
};

function getInitialForm(item?: ProductService): ProductForm {
  return {
    name: item?.name || '',
    description: item?.description || '',
    type: item?.type || 'Product',
    group: item?.group || 'Commodities',
    sku: item?.sku || '',
    imageUrl: item?.imageUrl || '',
    unitPrice: Number(item?.unitPrice) || 0,
    costPrice: Number(item?.costPrice) || 0,
    taxRate: Number(item?.taxRate) || 0,
    isActive: item?.isActive ?? true,
  };
}

function FieldLabel({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-2 block text-sm font-semibold text-slate-700">
      {children}
      {required ? <span className="ml-1 text-rose-500">*</span> : null}
    </label>
  );
}

function ToastMessage({ toast }: { toast: Toast }) {
  if (!toast) return null;

  const Icon = toast.type === 'success' ? CheckCircle2 : toast.type === 'error' ? XCircle : CheckCircle2;
  const background =
    toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-500' : 'bg-indigo-500';

  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${background}`}>
      <Icon size={18} />
      <span>{toast.message}</span>
    </div>
  );
}

export default function EditProductOrServicePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data, loading, error, refresh, update } = useProductServices();

  const products = useMemo(() => data || [], [data]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(getInitialForm());
  const [search, setSearch] = useState('');
  const [isCustomGroup, setIsCustomGroup] = useState(false);
  const [customGroupInput, setCustomGroupInput] = useState('');
  const [taxRates, setTaxRates] = useState<{ id: number; name: string; rate: number; isDefault?: boolean }[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [toast, setToast] = useState<Toast>(null);

  const allGroups = useMemo(() => {
    const defaultGroups = ['Commodities', 'CCTV', 'Folding Partition'];
    const fromProducts = products.map((p) => p.group).filter((g): g is string => Boolean(g));
    return Array.from(new Set([...defaultGroups, ...fromProducts]));
  }, [products]);

  const selectedItem = useMemo(
    () => products.find((item) => item.id === selectedId),
    [products, selectedId],
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;

    return products.filter((item) => {
      const name = String(item?.name || '').toLowerCase();
      const sku = String(item?.sku || '').toLowerCase();
      const type = String(item?.type || '').toLowerCase();
      return name.includes(query) || sku.includes(query) || type.includes(query);
    });
  }, [products, search]);

  useEffect(() => {
    api.get<{ id: number; name: string; rate: number; isDefault?: boolean }[]>('/settings/tax-rates')
      .then((res) => { if (Array.isArray(res)) setTaxRates(res); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (products.length === 0) return;

    const rawId = searchParams.get('id');
    const queryId = rawId ? Number(rawId) : null;
    let target = queryId ? products.find((p) => p.id === queryId) : undefined;
    if (!target) {
      target = (selectedId ? products.find((p) => p.id === selectedId) : null) || products[0];
    }

    if (target && target.id !== selectedId) {
      setSelectedId(target.id);
      setForm(getInitialForm(target));
      const isCustom = Boolean(target.group && !['Commodities', 'CCTV', 'Folding Partition'].includes(target.group));
      setIsCustomGroup(isCustom);
      setCustomGroupInput(isCustom ? (target.group || '') : '');
    }
  }, [searchParams, products]);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  const handleSelect = (item: ProductService) => {
    setSelectedId(item.id);
    setForm(getInitialForm(item));
    setFieldError('');
    const isCustom = Boolean(item.group && !['Commodities', 'CCTV', 'Folding Partition'].includes(item.group));
    setIsCustomGroup(isCustom);
    setCustomGroupInput(isCustom ? (item.group || '') : '');
    navigate(`/edit-product-or-service?id=${item.id}`, { replace: true });
  };

  const updateField = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (fieldError) setFieldError('');
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      showToast('Image size must be less than 15MB.', 'error');
      return;
    }
    try {
      const dataUrl = await compressImageFile(file);
      setForm((c) => ({ ...c, imageUrl: dataUrl }));
      showToast('Image uploaded and optimized.', 'info');
    } catch {
      showToast('Failed to process selected image.', 'error');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
      showToast('Product and service data refreshed.', 'info');
    } catch {
      showToast('Unable to refresh products and services.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedItem) {
      showToast('Select a product or service to edit.', 'error');
      return;
    }

    if (!form.name.trim()) {
      setFieldError('A name is required.');
      return;
    }

    if (form.unitPrice < 0 || form.costPrice < 0 || form.taxRate < 0) {
      setFieldError('Prices and tax rate cannot be negative.');
      return;
    }

    setShowSaveModal(true);
  };

  const confirmSave = async () => {
    if (!selectedItem) return;

    const finalGroup = (isCustomGroup ? customGroupInput.trim() : form.group) || 'General';

    setIsSaving(true);
    try {
      await update(selectedItem.id, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        group: finalGroup,
        sku: form.sku.trim() || undefined,
        imageUrl: form.imageUrl.trim() || null,
        unitPrice: Number(form.unitPrice) || 0,
        costPrice: Number(form.costPrice) || 0,
        taxRate: Number(form.taxRate) || 0,
        isActive: form.isActive,
      });
      setShowSaveModal(false);
      showToast('Product or service updated successfully.');
      await refresh();
    } catch {
      showToast('Failed to save product or service.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <button
              type="button"
              onClick={() => navigate('/products-services-list')}
              className="mb-4 inline-flex min-h-[40px] items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-500 transition hover:bg-white hover:text-slate-900"
            >
              <ArrowLeft size={17} />
              Back to Products &amp; Services
            </button>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
                <Edit size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit Product or Service</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Update pricing, classification, and availability details.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={isRefreshing ? 'animate-spin' : ''} size={17} />
            Refresh
          </button>
        </div>

        {error ? (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <span>We could not load your products and services.</span>
            <button
              type="button"
              onClick={handleRefresh}
              className="min-h-[40px] rounded-lg bg-white px-3 font-semibold text-red-700 shadow-sm hover:bg-red-100"
            >
              Try again
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(280px,360px)_1fr]">
          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="border-b border-slate-200/80 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-slate-900">Catalog</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {products.length} {products.length === 1 ? 'record' : 'records'}
                  </p>
                </div>
                <PackageIcon size={20} className="text-slate-400" />
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search catalog..."
                  className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
            </div>

            <div className="max-h-[620px] overflow-y-auto p-2">
              {loading ? (
                <div className="space-y-2 p-3">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-8 text-center">
                  <PackageIcon className="mx-auto mb-3 text-slate-300" size={28} />
                  <p className="text-sm font-medium text-slate-600">No matching records</p>
                  <p className="mt-1 text-xs text-slate-400">Try a different search term.</p>
                </div>
              ) : (
                filteredProducts.map((item) => {
                  const active = item.id === selectedId;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className={`mb-2 flex min-h-[72px] w-full items-center justify-between rounded-xl p-3 text-left transition border cursor-pointer ${
                        active
                          ? 'bg-rose-50/90 border-rose-300 ring-1 ring-rose-300 border-l-4 border-l-rose-600 shadow-xs'
                          : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-lg object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                            <PackageIcon size={18} />
                          </div>
                        )}
                        <span className="min-w-0">
                          <span className={`block truncate text-sm font-semibold ${active ? 'text-rose-700' : 'text-slate-800'}`}>
                            {item.name || 'Unnamed item'}
                          </span>
                          <span className="mt-1 block truncate text-xs text-slate-500">
                            <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600 mr-1.5">
                              {item.group || 'Commodities'}
                            </span>
                            {item.type || 'Uncategorized'} {item.sku ? `· ${item.sku}` : ''}
                          </span>
                        </span>
                      </div>
                      <span className="ml-3 flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums text-slate-700">
                          {formatCurrency(Number(item.unitPrice) || 0)}
                        </span>
                        <ChevronRight size={16} className={active ? 'text-rose-500' : 'text-slate-300'} />
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
            {selectedItem ? (
              <form onSubmit={handleSubmit}>
                <div className="mb-7 flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-6 sm:flex-row sm:items-start">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        ID #{selectedItem.id}
                      </span>
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                        {form.group}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          form.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {form.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">Item details</h2>
                    <p className="mt-1 text-sm text-slate-500">Make changes to this catalog record.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`${ROUTES.SCREEN_PRODUCT_OR_SERVICE_DETAILS}?id=${selectedItem.id}`)}
                    className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                  >
                    <Eye size={16} />
                    View details
                  </button>
                </div>

                {fieldError ? (
                  <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {fieldError}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                  <div className="md:col-span-3">
                    <FieldLabel required>Business Line / Group</FieldLabel>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {allGroups.map((grp) => {
                        const isSelected = !isCustomGroup && form.group === grp;
                        return (
                          <button
                            key={grp}
                            type="button"
                            onClick={() => {
                              setIsCustomGroup(false);
                              updateField('group', grp);
                            }}
                            className={`flex items-center justify-center rounded-xl border px-3 py-2.5 text-xs font-bold transition sm:text-sm cursor-pointer ${
                              isSelected
                                ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-xs'
                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                          >
                            {grp}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomGroup(true);
                        }}
                        className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition sm:text-sm cursor-pointer ${
                          isCustomGroup
                            ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-xs'
                            : 'border-dashed border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        <Plus size={14} />
                        <span>Custom Line</span>
                      </button>
                    </div>

                    {isCustomGroup && (
                      <div className="mt-3">
                        <input
                          type="text"
                          placeholder="Enter new business line group name..."
                          value={customGroupInput}
                          onChange={(e) => {
                            setCustomGroupInput(e.target.value);
                            updateField('group', e.target.value);
                          }}
                          className="min-h-[44px] w-full rounded-xl border border-rose-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                          autoFocus
                        />
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-3">
                    <FieldLabel required>Name</FieldLabel>
                    <input
                      value={form.name}
                      onChange={(event) => updateField('name', event.target.value)}
                      className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                      required
                    />
                  </div>

                  <div>
                    <Select
                      label="Type"
                      required
                      value={form.type}
                      onChange={(val) => updateField('type', val)}
                      options={[
                        { value: 'Product', label: 'Product' },
                        { value: 'Service', label: 'Service' },
                      ]}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <FieldLabel>SKU</FieldLabel>
                    <input
                      value={form.sku}
                      onChange={(event) => updateField('sku', event.target.value)}
                      placeholder="Optional SKU"
                      className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <FieldLabel>Description</FieldLabel>
                    <textarea
                      value={form.description}
                      onChange={(event) => updateField('description', event.target.value)}
                      rows={4}
                      placeholder="Describe this product or service..."
                      className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    />
                  </div>

                  <div className="md:col-span-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-rose-50 p-1.5 text-rose-600">
                          <ImageIcon size={16} />
                        </div>
                        <span className="text-sm font-semibold text-slate-800">Product Image</span>
                        <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          Optional
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                      {form.imageUrl ? (
                        <div className="relative group shrink-0">
                          <img
                            src={form.imageUrl}
                            alt="Product preview"
                            className="h-24 w-24 rounded-xl object-cover border border-slate-200 shadow-xs bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => updateField('imageUrl', '')}
                            className="absolute -top-2 -right-2 p-1 rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 transition cursor-pointer"
                            title="Remove image"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center h-24 w-24 rounded-xl border-2 border-dashed border-slate-200 bg-white hover:bg-slate-50 hover:border-rose-400 transition cursor-pointer shrink-0">
                          <Upload size={20} className="text-slate-400 mb-1" />
                          <span className="text-[11px] font-semibold text-slate-600">Upload File</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageFileChange}
                            className="hidden"
                          />
                        </label>
                      )}

                      <div className="flex-1 w-full space-y-2">
                        <label className="block text-xs font-semibold text-slate-700">
                          Or Image Web URL
                        </label>
                        <input
                          type="url"
                          value={form.imageUrl}
                          onChange={(e) => updateField('imageUrl', e.target.value)}
                          placeholder="https://example.com/images/product.jpg"
                          className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none transition focus:border-amber-400"
                        />
                        <p className="text-[11px] text-slate-400">
                          Supports PNG, JPG, WebP, or SVG formats under 5MB.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <FieldLabel required>Unit price</FieldLabel>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.unitPrice}
                        onChange={(event) => updateField('unitPrice', Number(event.target.value) || 0)}
                        className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Cost price</FieldLabel>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.costPrice}
                        onChange={(event) => updateField('costPrice', Number(event.target.value) || 0)}
                        className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                      />
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Tax rate (%)</FieldLabel>
                    {taxRates.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {taxRates.map((tr) => {
                          const isSel = Number(form.taxRate) === Number(tr.rate);
                          return (
                            <button
                              key={tr.id}
                              type="button"
                              onClick={() => updateField('taxRate', Number(tr.rate))}
                              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold border transition cursor-pointer ${
                                isSel
                                  ? 'border-amber-500 bg-amber-50 text-amber-800 font-bold'
                                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                              }`}
                              title={tr.name}
                            >
                              {tr.name} ({Number(tr.rate)}%)
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.taxRate}
                      onChange={(event) => updateField('taxRate', Number(event.target.value) || 0)}
                      className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    />
                  </div>

                  <div className="flex items-end">
                    <label className="flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(event) => updateField('isActive', event.target.checked)}
                        className="h-4 w-4 accent-rose-600"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-700">Available for use</span>
                        <span className="block text-xs text-slate-500">Keep this record active in invoices.</span>
                      </span>
                    </label>
                  </div>
                </div>

                <div className="mt-8 flex flex-col-reverse justify-end gap-3 border-t border-slate-200/80 pt-6 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => navigate('/products-services-list')}
                    className="min-h-[44px] rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
                  >
                    <Save size={17} />
                    Save changes
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
                <PackageIcon className="mb-4 text-slate-300" size={44} />
                <h2 className="text-lg font-bold text-slate-900">Select a product or service</h2>
                <p className="mt-2 max-w-sm text-sm text-slate-500">
                  Choose a record from the catalog to begin editing.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      {showSaveModal && selectedItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowSaveModal(false)}
              disabled={isSaving}
              className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close confirmation"
            >
              <X size={18} />
            </button>
            <div className="mb-5 rounded-xl bg-rose-50 p-3 text-rose-600 w-fit">
              <Save size={21} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Save changes?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This will update <span className="font-semibold text-slate-700">{selectedItem.name}</span> in your catalog.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                disabled={isSaving}
                className="min-h-[44px] rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSave}
                disabled={isSaving}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                {isSaving ? 'Saving...' : 'Confirm update'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ToastMessage toast={toast} />
    </div>
  );
}