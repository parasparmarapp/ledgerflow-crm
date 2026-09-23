import type { InventoryItem, ProductService } from '../types';
import { useEffect, useMemo, useState } from 'react';
import { useInventoryItems, useProductServices } from '../hooks';
import { formatCurrency } from '../lib/currency';
import { ROUTES } from '../routes';
import { useLocation, useNavigate } from 'react-router-dom';
import { Select } from '../components';
import { AlertCircle, ArrowLeft, Check, CheckCircle2, ChevronRight, X, XCircle, Package as PackageIcon } from 'lucide-react';

type ToastType = "success" | "error" | "info";

type ToastState = {
  message: string;
  type: ToastType;
} | null;

type FormState = {
  productServiceId: number;
  quantityOnHand: number;
  reorderThreshold: number;
  unitCost: number;
  location: string;
  isArchived: boolean;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export default function EditInventoryItemPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    data: inventoryItems,
    loading: inventoryLoading,
    error: inventoryError,
    refresh: refreshInventory,
    update: updateInventoryItem,
  } = useInventoryItems();

  const {
    data: productServices,
    loading: productsLoading,
    error: productsError,
    refresh: refreshProductServices,
  } = useProductServices();

  const [selectedItemId, setSelectedItemId] = useState<number>(0);
  const [form, setForm] = useState<FormState>({
    productServiceId: 0,
    quantityOnHand: 0,
    reorderThreshold: 0,
    unitCost: 0,
    location: "",
    isArchived: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const requestedItemId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const parsedId = Number(params.get("id"));
    return Number.isInteger(parsedId) && parsedId > 0 ? parsedId : 0;
  }, [location.search]);

  const selectedItem = useMemo<InventoryItem | undefined>(() => {
    return inventoryItems?.find((item) => item.id === selectedItemId);
  }, [inventoryItems, selectedItemId]);

  const selectedProduct = useMemo<ProductService | undefined>(() => {
    return productServices?.find(
      (product) => product.id === form.productServiceId,
    );
  }, [form.productServiceId, productServices]);

  const showToast = (message: string, type: ToastType = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!inventoryItems || inventoryItems.length === 0) {
      return;
    }

    const itemFromQuery = inventoryItems.find(
      (item) => item.id === requestedItemId,
    );
    const item = itemFromQuery ?? inventoryItems[0];

    setSelectedItemId(item.id);
    setForm({
      productServiceId: item.productServiceId,
      quantityOnHand: item.quantityOnHand,
      reorderThreshold: item.reorderThreshold,
      unitCost: item.unitCost,
      location: item.location || "",
      isArchived: item.isArchived,
    });
  }, [inventoryItems, requestedItemId]);

  const handleItemChange = (itemId: number) => {
    const item = inventoryItems?.find((inventoryItem) => inventoryItem.id === itemId);

    if (!item) {
      return;
    }

    setSelectedItemId(item.id);
    setForm({
      productServiceId: item.productServiceId,
      quantityOnHand: item.quantityOnHand,
      reorderThreshold: item.reorderThreshold,
      unitCost: item.unitCost,
      location: item.location || "",
      isArchived: item.isArchived,
    });
    setErrors({});
  };

  const updateField = <K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validateForm = () => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};

    if (!form.productServiceId) {
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

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSaveRequest = () => {
    if (!selectedItemId || !validateForm()) {
      return;
    }

    setShowConfirmModal(true);
  };

  const handleSave = async () => {
    if (!selectedItemId || !validateForm()) {
      return;
    }

    setIsSaving(true);

    try {
      await updateInventoryItem(selectedItemId, {
        productServiceId: form.productServiceId,
        quantityOnHand: Number(form.quantityOnHand) || 0,
        reorderThreshold: Number(form.reorderThreshold) || 0,
        unitCost: Number(form.unitCost) || 0,
        location: form.location.trim() || undefined,
        isArchived: form.isArchived,
      });

      setShowConfirmModal(false);
      showToast("Inventory item updated successfully.");
      await refreshInventory();
    } catch (error) {
      setShowConfirmModal(false);
      showToast(getErrorMessage(error), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetry = async () => {
    try {
      await Promise.all([refreshInventory(), refreshProductServices()]);
    } catch (error) {
      showToast(getErrorMessage(error), "error");
    }
  };

  const isLoading = inventoryLoading || productsLoading;
  const loadError = inventoryError || productsError;

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mb-4 inline-flex min-h-[40px] items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-500 transition hover:bg-white hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
                <PackageIcon className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Edit Inventory Item
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Update stock levels, costing, and inventory settings.
                </p>
              </div>
            </div>
          </div>

          {selectedItem && (
            <button
              type="button"
              onClick={() =>
                navigate(
                  `${ROUTES.SCREEN_INVENTORY_ITEM_DETAILS}?id=${selectedItem.id}`,
                )
              }
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              View item details
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {isLoading && (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm">
            <div className="animate-pulse space-y-5">
              <div className="h-5 w-48 rounded bg-slate-200" />
              <div className="grid gap-5 md:grid-cols-2">
                <div className="h-12 rounded-lg bg-slate-100" />
                <div className="h-12 rounded-lg bg-slate-100" />
                <div className="h-12 rounded-lg bg-slate-100" />
                <div className="h-12 rounded-lg bg-slate-100" />
              </div>
            </div>
          </div>
        )}

        {!isLoading && loadError && (
          <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-red-500" />
              <div>
                <h2 className="font-semibold text-slate-900">
                  Unable to load inventory data
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {loadError}
                </p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="mt-4 min-h-[40px] rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white transition hover:bg-amber-700"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {!isLoading && !loadError && (!inventoryItems || inventoryItems.length === 0) && (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-10 text-center shadow-sm">
            <PackageIcon className="mx-auto h-10 w-10 text-slate-300" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              No inventory items found
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Create an inventory item before attempting to edit it.
            </p>
            <button
              type="button"
              onClick={() => navigate("/create-item")}
              className="mt-6 min-h-[44px] rounded-xl bg-amber-600 px-5 text-sm font-semibold text-white transition hover:bg-amber-700"
            >
              Create inventory item
            </button>
          </div>
        )}

        {!isLoading &&
          !loadError &&
          inventoryItems &&
          inventoryItems.length > 0 &&
          selectedItem && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
                <div className="mb-7 flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Inventory information
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Changes are applied to the selected inventory record.
                    </p>
                  </div>

                  <div className="min-w-[240px]">
                    <Select
                      label="Inventory record"
                      value={selectedItemId}
                      onChange={(val) => handleItemChange(Number(val))}
                      options={inventoryItems.map((item) => {
                        const product = productServices?.find(
                          (service) => service.id === item.productServiceId,
                        );
                        return {
                          value: item.id,
                          label: product?.name || `Inventory item #${item.id}`,
                          sublabel: `Qty: ${item.quantityOnHand ?? 0}`,
                        };
                      })}
                      searchable
                    />
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Select
                      label="Product or service"
                      value={form.productServiceId}
                      onChange={(val) => updateField("productServiceId", Number(val))}
                      options={(productServices || []).map((product) => ({
                        value: product.id,
                        label: product.name,
                        sublabel: product.type,
                      }))}
                      error={errors.productServiceId}
                      searchable
                    />
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
                      min="0"
                      value={form.quantityOnHand}
                      onChange={(event) =>
                        updateField(
                          "quantityOnHand",
                          Number(event.target.value) || 0,
                        )
                      }
                      className={`min-h-[48px] w-full rounded-xl border bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100 ${
                        errors.quantityOnHand
                          ? "border-red-300"
                          : "border-slate-200"
                      }`}
                    />
                    {errors.quantityOnHand && (
                      <p className="mt-2 text-xs text-red-600">
                        {errors.quantityOnHand}
                      </p>
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
                      min="0"
                      value={form.reorderThreshold}
                      onChange={(event) =>
                        updateField(
                          "reorderThreshold",
                          Number(event.target.value) || 0,
                        )
                      }
                      className={`min-h-[48px] w-full rounded-xl border bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100 ${
                        errors.reorderThreshold
                          ? "border-red-300"
                          : "border-slate-200"
                      }`}
                    />
                    {errors.reorderThreshold && (
                      <p className="mt-2 text-xs text-red-600">
                        {errors.reorderThreshold}
                      </p>
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
                      min="0"
                      step="0.01"
                      value={form.unitCost}
                      onChange={(event) =>
                        updateField(
                          "unitCost",
                          Number(event.target.value) || 0,
                        )
                      }
                      className={`min-h-[48px] w-full rounded-xl border bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100 ${
                        errors.unitCost ? "border-red-300" : "border-slate-200"
                      }`}
                    />
                    {errors.unitCost && (
                      <p className="mt-2 text-xs text-red-600">
                        {errors.unitCost}
                      </p>
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
                      placeholder="e.g. Warehouse A"
                      className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                    />
                  </div>

                  <label className="md:col-span-2 flex min-h-[52px] cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4">
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">
                        Archive item
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        Archived items are retained for historical reporting.
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={form.isArchived}
                      onChange={(event) =>
                        updateField("isArchived", event.target.checked)
                      }
                      className="h-5 w-5 rounded border-slate-300 text-rose-600 focus:ring-amber-500"
                    />
                  </label>
                </div>

                <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveRequest}
                    disabled={isSaving}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" />
                    Save changes
                  </button>
                </div>
              </section>

              {/* Stripped duplicate layout shell */}
            </div>
          )}
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-save-title"
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setShowConfirmModal(false)}
              className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close confirmation dialog"
            >
              <X className="h-5 w-5" />
            </button>
            <h2
              id="confirm-save-title"
              className="pr-8 text-lg font-bold text-slate-900"
            >
              Save inventory changes?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              The selected inventory record will be updated with the values
              entered in this form.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="min-h-[44px] rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Review again
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="min-h-[44px] rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Confirm save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === "success"
              ? "bg-emerald-600"
              : toast.type === "error"
                ? "bg-red-500"
                : "bg-indigo-500"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : toast.type === "error" ? (
            <XCircle className="h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}