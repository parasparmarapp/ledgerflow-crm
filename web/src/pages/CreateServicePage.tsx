import { useEffect, useState, ChangeEvent, FormEvent } from 'react';
import { formatCurrency } from '../lib/currency';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Select } from '../components';
import { 
  ArrowLeft, 
  CheckCircle2, 
  ChevronRight, 
  DollarSign, 
  FileText, 
  Layers, 
  XCircle, 
  Tag as TagIcon,
  Boxes,
  ShieldCheck,
  Building2,
  Image as ImageIcon,
  Upload,
  Trash2,
  Plus,
} from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

type ToastState = {
  message: string;
  type: ToastType;
} | null;

type BusinessGroup = string;

type ServiceForm = {
  name: string;
  description: string;
  group: string;
  type: 'product' | 'service';
  initialStock: string;
  sku: string;
  imageUrl: string;
  unitPrice: string;
  costPrice: string;
  taxRate: string;
  isActive: boolean;
};

type FormErrors = Partial<Record<keyof ServiceForm, string>>;

const initialForm: ServiceForm = {
  name: '',
  description: '',
  group: 'Commodities',
  type: 'product',
  initialStock: '10',
  sku: '',
  imageUrl: '',
  unitPrice: '',
  costPrice: '',
  taxRate: '12',
  isActive: true,
};

import { useProductServices } from '../hooks';
import { compressImageFile } from '../lib/imageCompressor';

export default function CreateServicePage() {
  const navigate = useNavigate();
  const { create, data: existingProducts = [] } = useProductServices();
  const [form, setForm] = useState<ServiceForm>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [isCustomGroup, setIsCustomGroup] = useState(false);
  const [customGroupInput, setCustomGroupInput] = useState('');
  const [taxRates, setTaxRates] = useState<{ id: number; name: string; rate: number; isDefault?: boolean }[]>([]);

  useEffect(() => {
    api.get<{ id: number; name: string; rate: number; isDefault?: boolean }[]>('/settings/tax-rates')
      .then((res) => {
        if (Array.isArray(res) && res.length > 0) {
          setTaxRates(res);
          const def = res.find((r) => r.isDefault);
          if (def) {
            setForm((current) => ({ ...current, taxRate: String(def.rate) }));
          }
        }
      })
      .catch(() => {});
  }, []);

  const allGroups: string[] = [
    'Commodities',
    'CCTV',
    'Folding Partition',
    ...Array.from(new Set(existingProducts.map((p) => p.group).filter((g): g is string => Boolean(g)))),
  ].filter((v, i, a) => a.indexOf(v) === i);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
  };

  const updateField = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const validate = (): FormErrors => {
    const nextErrors: FormErrors = {};

    if (!form.name.trim()) {
      nextErrors.name = 'Enter a product or service name.';
    }

    if (!form.unitPrice.trim() || Number(form.unitPrice) <= 0) {
      nextErrors.unitPrice = 'Enter a valid unit price greater than 0.';
    }

    if (form.costPrice.trim() && Number(form.costPrice) < 0) {
      nextErrors.costPrice = 'Cost price cannot be negative.';
    }

    if (Number(form.taxRate) < 0 || Number(form.taxRate) > 100) {
      nextErrors.taxRate = 'Tax rate must be between 0 and 100.';
    }

    if (form.type === 'product' && form.initialStock && Number(form.initialStock) < 0) {
      nextErrors.initialStock = 'Initial stock cannot be negative.';
    }

    if (isCustomGroup && !customGroupInput.trim()) {
      nextErrors.group = 'Please enter a name for the new business line.';
    }

    return nextErrors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      showToast(nextErrors.group || 'Please correct highlighted fields.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const finalGroup = (isCustomGroup ? customGroupInput.trim() : form.group) || 'General';
      await create({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        group: finalGroup,
        type: form.type,
        sku: form.sku.trim() || undefined,
        imageUrl: form.imageUrl.trim() || undefined,
        unitPrice: Number(form.unitPrice),
        costPrice: form.costPrice.trim() ? Number(form.costPrice) : undefined,
        taxRate: Number(form.taxRate || 0),
        initialStock: form.type === 'product' ? Number(form.initialStock || 0) : undefined,
        isActive: form.isActive,
      });

      showToast('Item successfully added to catalog!', 'success');
      setTimeout(() => {
        navigate('/products-services-list');
      }, 700);
    } catch (err: any) {
      showToast(err?.message || 'Failed to save product or service.', 'error');
      setIsSubmitting(false);
    }
  };

  const handleImageFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
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

  const handleCancel = () => {
    navigate('/products-services-list');
  };

  const previewPrice = Number(form.unitPrice) || 0;
  const previewTax = Number(form.taxRate) || 0;

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={handleCancel}
              className="mt-1 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 cursor-pointer"
              aria-label="Go back"
            >
              <ArrowLeft size={19} />
            </button>
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
                <span>Products &amp; Services</span>
                <ChevronRight size={15} />
                <span className="text-slate-700 font-semibold">New Catalog Item</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Add Product or Service
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Register a new item categorized under Commodities, CCTV, or Folding Partition.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">

              {/* 1. Business Line Selection */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600 border border-amber-200">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-900">1. Select Business Line Group</h2>
                      <p className="text-sm text-slate-500">
                        Assign this item to an existing business line or create a new one.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {allGroups.map((grp) => {
                    const isSelected = !isCustomGroup && form.group === grp;
                    return (
                      <button
                        key={grp}
                        type="button"
                        onClick={() => {
                          setIsCustomGroup(false);
                          setForm((c) => ({ ...c, group: grp }));
                          setErrors((c) => ({ ...c, group: undefined }));
                        }}
                        className={`p-4 rounded-xl border text-left transition cursor-pointer ${
                          isSelected
                            ? grp === 'Commodities'
                              ? 'border-amber-500 bg-amber-50/70 text-amber-900 ring-2 ring-amber-500/20'
                              : grp === 'CCTV'
                              ? 'border-sky-500 bg-sky-50/70 text-sky-900 ring-2 ring-sky-500/20'
                              : grp === 'Folding Partition'
                              ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 ring-2 ring-emerald-500/20'
                              : 'border-purple-500 bg-purple-50/70 text-purple-900 ring-2 ring-purple-500/20'
                            : 'border-slate-200 bg-slate-50 hover:bg-white text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold uppercase tracking-wider">
                            {grp}
                          </span>
                          {isSelected && <CheckCircle2 size={16} className="text-current" />}
                        </div>
                        <p className="text-xs opacity-75">
                          {grp === 'Commodities' && 'Raw materials, bulk steel, copper, timber'}
                          {grp === 'CCTV' && 'Surveillance, IP cameras, NVRs, cabling'}
                          {grp === 'Folding Partition' && 'Acoustic walls, sliding partitions'}
                          {!['Commodities', 'CCTV', 'Folding Partition'].includes(grp) && 'Custom business line'}
                        </p>
                      </button>
                    );
                  })}

                  {/* Add New Line Option */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomGroup(true);
                      setErrors((c) => ({ ...c, group: undefined }));
                    }}
                    className={`p-4 rounded-xl border border-dashed text-left transition cursor-pointer flex flex-col justify-center ${
                      isCustomGroup
                        ? 'border-amber-500 bg-amber-50/70 text-amber-900 ring-2 ring-amber-500/20'
                        : 'border-slate-300 bg-slate-50/50 hover:bg-white text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Plus size={14} className="text-amber-600" />
                        + Add New Line
                      </span>
                      {isCustomGroup && <CheckCircle2 size={16} className="text-amber-600" />}
                    </div>
                    <p className="text-xs opacity-75">
                      Define a new division or category
                    </p>
                  </button>
                </div>

                {/* Custom Business Line Input */}
                {isCustomGroup && (
                  <div className="mt-4 p-4 rounded-xl border border-amber-300 bg-amber-50/40">
                    <label className="block text-xs font-bold text-amber-900 mb-1.5">
                      New Business Line Name <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={customGroupInput}
                        onChange={(e) => {
                          setCustomGroupInput(e.target.value);
                          setErrors((c) => ({ ...c, group: undefined }));
                        }}
                        placeholder="e.g. Solar Energy, IT Services, Electrical Supplies"
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                        autoFocus
                      />
                    </div>
                    {errors.group && (
                      <p className="mt-1 text-xs text-red-600 font-medium">{errors.group}</p>
                    )}
                  </div>
                )}
              </section>

              {/* 2. Item Details */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center gap-3">
                  <div className="rounded-xl bg-slate-100 p-2.5 text-slate-700">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900">2. Item Information</h2>
                    <p className="text-sm text-slate-500">
                      Describe the item and its specifications.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="name" className="mb-2 block text-sm font-semibold text-slate-700">
                      Item Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="name"
                      name="name"
                      value={form.name}
                      onChange={updateField}
                      placeholder="e.g. 4K UltraHD Dome IP Camera (8MP IR)"
                      className={`min-h-[44px] w-full rounded-xl border bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 ${
                        errors.name ? 'border-red-400' : 'border-slate-200'
                      }`}
                    />
                    {errors.name && <p className="mt-1.5 text-xs text-red-600">{errors.name}</p>}
                  </div>

                  <div>
                    <Select
                      label="Category Type"
                      value={form.type}
                      onChange={(val) => {
                        setForm((current) => ({ ...current, type: val as 'product' | 'service' }));
                        setErrors((current) => ({ ...current, type: undefined }));
                      }}
                      options={[
                        { value: 'product', label: 'Physical Product (Track Inventory)' },
                        { value: 'service', label: 'Labor / Professional Service' },
                      ]}
                    />
                  </div>

                  <div>
                    <label htmlFor="sku" className="mb-2 block text-sm font-semibold text-slate-700">
                      SKU / Catalog Code
                    </label>
                    <input
                      id="sku"
                      name="sku"
                      value={form.sku}
                      onChange={updateField}
                      placeholder="e.g. CCTV-CAM-001"
                      className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  {form.type === 'product' && (
                    <div className="sm:col-span-2 p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center gap-2 mb-2 text-slate-800 font-semibold text-sm">
                        <Boxes size={18} className="text-amber-600" />
                        <span>Initial Stock on Hand</span>
                      </div>
                      <input
                        id="initialStock"
                        name="initialStock"
                        type="number"
                        min="0"
                        value={form.initialStock}
                        onChange={updateField}
                        placeholder="10"
                        className="min-h-[40px] w-48 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-amber-500"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        An inventory tracking record will be automatically initialized for this product.
                      </p>
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label htmlFor="description" className="mb-2 block text-sm font-semibold text-slate-700">
                      Description &amp; Specifications
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={form.description}
                      onChange={updateField}
                      rows={3}
                      placeholder="Detailed item description for quotation and invoicing..."
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                </div>
              </section>

              {/* 3. Optional Product Image */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
                    <ImageIcon size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-slate-900">3. Product Image</h2>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-semibold">Optional</span>
                    </div>
                    <p className="text-sm text-slate-500">
                      Upload an item picture or paste an image URL to show in catalog and quotes.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    {form.imageUrl ? (
                      <div className="relative group shrink-0">
                        <img
                          src={form.imageUrl}
                          alt="Product preview"
                          className="h-28 w-28 rounded-xl object-cover border border-slate-200 shadow-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setForm((c) => ({ ...c, imageUrl: '' }))}
                          className="absolute -top-2 -right-2 p-1 rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 transition cursor-pointer"
                          title="Remove image"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-28 w-28 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-amber-400 transition cursor-pointer shrink-0">
                        <Upload size={22} className="text-slate-400 mb-1" />
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
                        name="imageUrl"
                        value={form.imageUrl}
                        onChange={updateField}
                        placeholder="https://example.com/images/product.jpg"
                        className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs text-slate-900 outline-none transition focus:border-amber-500"
                      />
                      <p className="text-[11px] text-slate-400">
                        Supports PNG, JPG, WebP, or SVG formats under 5MB.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* 4. Pricing */}
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center gap-3">
                  <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
                    <DollarSign size={20} />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900">4. Pricing &amp; Tax Structure</h2>
                    <p className="text-sm text-slate-500">
                      Set billing prices, cost of goods, and applicable tax rate.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                  <div>
                    <label htmlFor="unitPrice" className="mb-2 block text-sm font-semibold text-slate-700">
                      Unit Sale Price (GH₵) <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="unitPrice"
                      name="unitPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.unitPrice}
                      onChange={updateField}
                      placeholder="285.00"
                      className={`min-h-[44px] w-full rounded-xl border bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-amber-500 ${
                        errors.unitPrice ? 'border-red-400' : 'border-slate-200'
                      }`}
                    />
                    {errors.unitPrice && <p className="mt-1.5 text-xs text-red-600">{errors.unitPrice}</p>}
                  </div>

                  <div>
                    <label htmlFor="costPrice" className="mb-2 block text-sm font-semibold text-slate-700">
                      Cost Price / COGS (GH₵)
                    </label>
                    <input
                      id="costPrice"
                      name="costPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.costPrice}
                      onChange={updateField}
                      placeholder="165.00"
                      className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="taxRate" className="mb-2 block text-sm font-semibold text-slate-700">
                      Tax Rate (%)
                    </label>
                    {taxRates.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2.5">
                        {taxRates.map((tr) => {
                          const isSel = Number(form.taxRate) === Number(tr.rate);
                          return (
                            <button
                              key={tr.id}
                              type="button"
                              onClick={() => setForm((prev) => ({ ...prev, taxRate: String(tr.rate) }))}
                              className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition cursor-pointer ${
                                isSel
                                  ? 'border-amber-500 bg-amber-50 text-amber-800 font-bold shadow-xs'
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
                      id="taxRate"
                      name="taxRate"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={form.taxRate}
                      onChange={updateField}
                      placeholder="18"
                      className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-amber-500"
                    />
                  </div>
                </div>
              </section>
            </div>

            {/* Right Summary Sidebar */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sticky top-24">
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider mb-4">
                  Summary Preview
                </h3>

                {form.imageUrl && (
                  <div className="mb-4">
                    <img
                      src={form.imageUrl}
                      alt="Preview"
                      className="h-32 w-full rounded-xl object-cover border border-slate-200"
                    />
                  </div>
                )}

                <div className="space-y-3 pb-4 border-b border-slate-100 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Group:</span>
                    <span className="font-bold text-slate-900">
                      {isCustomGroup ? (customGroupInput.trim() || 'New Business Line') : form.group}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Type:</span>
                    <span className="capitalize font-semibold text-slate-900">{form.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Selling Price:</span>
                    <span className="font-bold text-slate-900">{formatCurrency(previewPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tax Rate:</span>
                    <span className="font-semibold text-slate-700">{previewTax}%</span>
                  </div>
                </div>

                <div className="pt-4 space-y-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md shadow-amber-600/20 transition cursor-pointer disabled:opacity-60"
                  >
                    {isSubmitting ? 'Saving to Database...' : 'Save to Catalog'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}