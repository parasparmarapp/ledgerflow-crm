import React, { useEffect, useState } from 'react';
import { api } from '../api';
import {
  Percent,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Check,
} from 'lucide-react';

interface TaxRate {
  id: number;
  name: string;
  rate: number;
  components?: any;
  isDefault: boolean;
  isActive: boolean;
}

export default function TaxRatesPage() {
  const [rates, setRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<Partial<TaxRate> | null>(null);
  const [componentsList, setComponentsList] = useState<{ name: string; rate: number }[]>([]);
  const [saving, setSaving] = useState(false);

  const [rateToDelete, setRateToDelete] = useState<TaxRate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  const fetchRates = async () => {
    setLoading(true);
    try {
      const data = await api.get<TaxRate[]>('/settings/tax-rates');
      setRates(Array.isArray(data) ? data : []);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load tax rates', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRates();
  }, []);

  const openModal = (rate?: TaxRate) => {
    if (rate) {
      setEditingRate(rate);
      let parsedComps: { name: string; rate: number }[] = [];
      if (Array.isArray(rate.components)) {
        parsedComps = rate.components;
      }
      setComponentsList(parsedComps);
    } else {
      setEditingRate({
        name: '',
        rate: 0,
        isDefault: false,
        isActive: true,
      });
      setComponentsList([]);
    }
    setModalOpen(true);
  };

  const handleAddComponent = () => {
    setComponentsList((prev) => [...prev, { name: '', rate: 0 }]);
  };

  const handleRemoveComponent = (idx: number) => {
    setComponentsList((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleComponentChange = (idx: number, field: 'name' | 'rate', val: any) => {
    setComponentsList((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRate?.name?.trim() || editingRate.rate === undefined) {
      showToast('Name and total tax rate are required.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: editingRate.name.trim(),
        rate: Number(editingRate.rate),
        components: componentsList.length > 0 ? componentsList : undefined,
        isDefault: Boolean(editingRate.isDefault),
        isActive: editingRate.isActive ?? true,
      };

      if (editingRate.id) {
        await api.patch(`/settings/tax-rates/${editingRate.id}`, payload);
        showToast('Tax rate updated successfully.');
      } else {
        await api.post('/settings/tax-rates', payload);
        showToast('Tax rate created successfully.');
      }
      setModalOpen(false);
      void fetchRates();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save tax rate.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!rateToDelete) return;
    setDeleting(true);
    try {
      await api.del(`/settings/tax-rates/${rateToDelete.id}`);
      showToast(`Tax rate "${rateToDelete.name}" deleted successfully.`);
      setRateToDelete(null);
      void fetchRates();
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete tax rate.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50 pb-16">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Percent size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">Tax Rates Management</h1>
                <p className="text-xs text-slate-500">
                  Configure VAT, NHIL, GETFund, GST rates, and multi-component breakdowns applied to line items.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchRates}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => openModal()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 shadow-xs"
            >
              <Plus size={15} />
              <span>New Tax Rate</span>
            </button>
          </div>
        </div>

        {/* Rates Table */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-6">Tax Rate Name</th>
                  <th className="py-3 px-4 text-right">Total Rate</th>
                  <th className="py-3 px-4">Component Breakdown</th>
                  <th className="py-3 px-4 text-center">Default</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin mb-2 text-amber-600" />
                      Loading configured tax rates…
                    </td>
                  </tr>
                ) : rates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No tax rates configured. Click "New Tax Rate" to get started.
                    </td>
                  </tr>
                ) : (
                  rates.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-6 font-bold text-slate-900">{r.name}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                        {Number(r.rate)}%
                      </td>
                      <td className="py-3.5 px-4">
                        {Array.isArray(r.components) && r.components.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {r.components.map((c: any, i: number) => (
                              <span
                                key={i}
                                className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200"
                              >
                                {c.name}: {c.rate}%
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Single rate</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {r.isDefault ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 px-2.5 py-0.5 text-[10px] font-bold border border-amber-200">
                            <Check size={11} /> Default
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            r.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700 line-through'
                          }`}
                        >
                          {r.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right space-x-2">
                        <button
                          onClick={() => openModal(r)}
                          className="font-semibold text-slate-600 hover:text-slate-900 p-1"
                          title="Edit Rate"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setRateToDelete(r)}
                          className="font-semibold text-red-600 hover:text-red-800 p-1 transition-colors"
                          title="Delete Tax Rate"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {modalOpen && editingRate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            >
              <X size={18} />
            </button>
            <h2 className="text-base font-bold text-slate-900">
              {editingRate.id ? 'Edit Tax Rate' : 'New Tax Rate'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Specify tax rate percentage and optional sub-components.</p>

            <form onSubmit={handleSave} className="my-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Rate Name *</label>
                <input
                  type="text"
                  required
                  value={editingRate.name || ''}
                  onChange={(e) => setEditingRate((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Standard VAT 15%"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Total Rate Percentage (%) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  step="0.001"
                  value={editingRate.rate || ''}
                  onChange={(e) => setEditingRate((prev) => ({ ...prev, rate: Number(e.target.value) || 0 }))}
                  placeholder="15.0"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-slate-800 font-mono"
                />
              </div>

              {/* Sub-components repeater */}
              <div className="border rounded-xl p-3 bg-slate-50/50 space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-slate-700">Components (Optional Breakdown)</span>
                  <button
                    type="button"
                    onClick={handleAddComponent}
                    className="text-amber-600 font-bold hover:text-amber-800 flex items-center gap-1"
                  >
                    <Plus size={13} />
                    <span>Add Component</span>
                  </button>
                </div>
                {componentsList.map((comp, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Name (e.g. NHIL)"
                      value={comp.name}
                      onChange={(e) => handleComponentChange(idx, 'name', e.target.value)}
                      className="flex-1 rounded-lg border border-slate-200 p-1.5 text-xs bg-white"
                    />
                    <input
                      type="number"
                      step="0.001"
                      placeholder="Rate %"
                      value={comp.rate || ''}
                      onChange={(e) => handleComponentChange(idx, 'rate', Number(e.target.value) || 0)}
                      className="w-24 rounded-lg border border-slate-200 p-1.5 text-xs bg-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveComponent(idx)}
                      className="text-slate-400 hover:text-red-600 p-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingRate.isDefault || false}
                    onChange={(e) => setEditingRate((prev) => ({ ...prev, isDefault: e.target.checked }))}
                    className="rounded text-amber-600"
                  />
                  <span className="font-semibold text-slate-800">Set as default tax rate on new invoices/catalog items</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingRate.isActive ?? true}
                    onChange={(e) => setEditingRate((prev) => ({ ...prev, isActive: e.target.checked }))}
                    className="rounded text-amber-600"
                  />
                  <span className="font-semibold text-slate-800">Tax rate is active</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-60 flex items-center gap-1.5"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  <span>Save Tax Rate</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION POPUP */}
      {rateToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <button
              onClick={() => !deleting && setRateToDelete(null)}
              disabled={deleting}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <AlertTriangle size={22} />
              </div>
              <div className="flex-1 pt-0.5">
                <h2 className="text-base font-bold text-slate-900">Delete Tax Rate</h2>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Are you sure you want to permanently delete{' '}
                  <span className="font-bold text-slate-900">"{rateToDelete.name}"</span> ({Number(rateToDelete.rate)}%)?
                  This will remove it from the system immediately.
                </p>
                {rateToDelete.isDefault && (
                  <div className="mt-2.5 rounded-lg bg-amber-50 border border-amber-200/60 p-2.5 text-[11px] font-semibold text-amber-800 flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0 text-amber-600" />
                    <span>This is currently set as your default tax rate.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5 border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setRateToDelete(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-60 shadow-xs shadow-red-200"
              >
                {deleting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold text-white shadow-xl ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
