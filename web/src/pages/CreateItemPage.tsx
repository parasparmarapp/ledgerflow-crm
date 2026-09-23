import type { ProductService } from '../types';
import React, { useState } from 'react';
import { useProductServices } from '../hooks';
import { ROUTES } from '../routes';
import { useNavigate } from 'react-router-dom';
import { Select } from '../components';
import { ArrowLeft, Check, CheckCircle2, ChevronDown, XCircle, Package as PackageIcon } from 'lucide-react';

type ToastType = "success" | "error" | "info";

type ItemFormState = {
  productServiceId: number;
  quantityOnHand: number;
  reorderThreshold: number;
  unitCost: number;
  location: string;
  isArchived: boolean;
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
    location: "",
    isArchived: false,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  const showToast = (message: string, type: ToastType = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  const updateField = <K extends keyof ItemFormState>(
    field: K,
    value: ItemFormState[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = (): FieldErrors => {
    const nextErrors: FieldErrors = {};

    if (form.productServiceId <= 0) {
      nextErrors.productServiceId = "Select a product or service.";
    }
    if (form.quantityOnHand < 0) {
      nextErrors.quantityOnHand = "Quantity cannot be negative.";
    }
    if (form.reorderThreshold < 0) {
      nextErrors.reorderThreshold = "Reorder threshold cannot be negative.";
    }
    if (form.unitCost < 0) {
      nextErrors.unitCost = "Unit cost cannot be negative.";
    }

    return nextErrors;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      showToast("Review the highlighted fields.", "error");
      return;
    }

    setIsSubmitting(true);
    showToast("Item details are ready to review.", "success");

    window.setTimeout(() => {
      setIsSubmitting(false);
      navigate(ROUTES.SCREEN_RECURRING_INVOICES);
    }, 500);
  };

  const handleCancel = () => {
    navigate(ROUTES.SCREEN_RECURRING_INVOICES);
  };

  const selectedProduct = productServices.find(
    (product) => product.id === form.productServiceId,
  );

  const inputClass =
    "min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10";

  const errorClass = "mt-1.5 text-xs font-medium text-rose-600";

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={handleCancel}
          className="mb-6 inline-flex min-h-[40px] items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <ArrowLeft size={17} />
          Return to recurring invoices
        </button>

        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <PackageIcon size={22} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Create item
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Add an inventory item and define its stock thresholds for accurate
              tracking.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-left shadow-sm sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Inventory setup
            </p>
            <p className="mt-1 text-sm font-medium text-slate-700">
              New stock record
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 border-b border-slate-100 pb-5">
              <h2 className="text-lg font-bold text-slate-900">
                Item details
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Connect this inventory record to an existing product or service.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <Select
                  label="Product or service"
                  required
                  value={form.productServiceId}
                  onChange={(val) => updateField("productServiceId", Number(val) || 0)}
                  disabled={productServicesQuery.loading}
                  placeholder={
                    productServicesQuery.loading
                      ? "Loading products and services..."
                      : "Select a product or service..."
                  }
                  options={productServices.map((product) => ({
                    value: product.id,
                    label: product.name,
                    sublabel: product.type,
                  }))}
                  searchable
                />
                {errors.productServiceId && (
                  <p className={errorClass}>{errors.productServiceId}</p>
                )}
                {productServicesQuery.error && (
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    <span>
                      {String(productServicesQuery.error || "Unable to load products.")}
                    </span>
                    <button
                      type="button"
                      onClick={() => productServicesQuery.refresh()}
                      className="font-semibold underline underline-offset-2"
                    >
                      Retry
                    </button>
                  </div>
                )}
                {selectedProduct && (
                  <p className="mt-2 text-xs text-slate-500">
                    {selectedProduct.description || "No description available."}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="quantityOnHand"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Quantity on hand
                </label>
                <input
                  id="quantityOnHand"
                  type="number"
                  min={0}
                  step={1}
                  value={form.quantityOnHand}
                  onChange={(event) =>
                    updateField(
                      "quantityOnHand",
                      Number(event.target.value) || 0,
                    )
                  }
                  className={inputClass}
                />
                {errors.quantityOnHand && (
                  <p className={errorClass}>{errors.quantityOnHand}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="reorderThreshold"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Reorder threshold
                </label>
                <input
                  id="reorderThreshold"
                  type="number"
                  min={0}
                  step={1}
                  value={form.reorderThreshold}
                  onChange={(event) =>
                    updateField(
                      "reorderThreshold",
                      Number(event.target.value) || 0,
                    )
                  }
                  className={inputClass}
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  Get notified when stock reaches this level.
                </p>
                {errors.reorderThreshold && (
                  <p className={errorClass}>{errors.reorderThreshold}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="unitCost"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Unit cost
                </label>
                <input
                  id="unitCost"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.unitCost}
                  onChange={(event) =>
                    updateField("unitCost", Number(event.target.value) || 0)
                  }
                  className={inputClass}
                />
                {errors.unitCost && (
                  <p className={errorClass}>{errors.unitCost}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="location"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Storage location
                </label>
                <input
                  id="location"
                  type="text"
                  value={form.location}
                  onChange={(event) =>
                    updateField("location", event.target.value)
                  }
                  placeholder="e.g. Main warehouse"
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Archive item
                </h2>
                <p className="mt-1 max-w-xl text-sm text-slate-500">
                  Archived items stay available for historical records but are
                  excluded from active inventory views.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.isArchived}
                onClick={() => updateField("isArchived", !form.isArchived)}
                className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition ${
                  form.isArchived ? "bg-rose-600" : "bg-slate-200"
                }`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                    form.isArchived ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>
          </section>

          <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-200/80 pt-6 sm:flex-row">
            <button
              type="button"
              onClick={handleCancel}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check size={17} />
              {isSubmitting ? "Preparing..." : "Create item"}
            </button>
          </div>
        </form>
      </div>

      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === "success"
              ? "bg-emerald-600"
              : toast.type === "error"
                ? "bg-red-500"
                : "bg-indigo-500"
          }`}
        >
          {toast.type === "success" ? (
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