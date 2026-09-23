import type { Client, RecurringInvoice } from '../types';
import React, { useEffect, useMemo, useState } from 'react';
import { useClients, useRecurringInvoices } from '../hooks';
import { formatCurrency } from '../lib/currency';
import { ROUTES } from '../routes';
import { useNavigate } from 'react-router-dom';
import { Select, DatePicker, TablePagination } from '../components';
import { AlertCircle, Calendar, CheckCircle2, ChevronRight, DollarSign, Sparkles, Eye, FileText, Plus, RefreshCw, Search, Trash2, X, XCircle } from 'lucide-react';

type Toast = {
  message: string;
  type: "success" | "error" | "info";
};
type ToastState = Toast | null;

type FormState = {
  clientId: number;
  frequency: string;
  nextRunAt: string;
  amount: number;
  isActive: boolean;
  notes: string;
};

const emptyForm: FormState = {
  clientId: 0,
  frequency: "Monthly",
  nextRunAt: "",
  amount: 0,
  isActive: true,
  notes: "",
};

function formatDate(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getClientName(clientId: number, clients: Client[]): string {
  return clients.find((client) => client.id === clientId)?.name || `Client #${clientId}`;
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-500"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`} />
      {active ? "Active" : "Paused"}
    </span>
  );
}

function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;

  const Icon = toast.type === "success" ? CheckCircle2 : toast.type === "error" ? XCircle : AlertCircle;
  const color =
    toast.type === "success"
      ? "bg-emerald-600"
      : toast.type === "error"
        ? "bg-red-500"
        : "bg-indigo-500";

  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${color}`}>
      <Icon size={17} />
      {toast.message}
    </div>
  );
}

export default function RecurringInvoicesPage() {
  const navigate = useNavigate();
  const recurringInvoicesHook = useRecurringInvoices();
  const clientsHook = useClients();

  const recurringInvoices = recurringInvoicesHook.data || [];
  const clients = clientsHook.data || [];
  const loading = recurringInvoicesHook.loading;
  const error = recurringInvoicesHook.error;
  const refresh = recurringInvoicesHook.refresh;
  const create = recurringInvoicesHook.create;
  const update = recurringInvoicesHook.update;
  const remove = recurringInvoicesHook.remove;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringInvoice | null>(null);
  const [selectedItem, setSelectedItem] = useState<RecurringInvoice | null>(null);
  const [deleteItem, setDeleteItem] = useState<RecurringInvoice | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = (message: string, type: Toast["type"] = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (error) {
      showToast(error, "error");
    }
  }, [error]);

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();

    return recurringInvoices.filter((item) => {
      const clientName = getClientName(item.clientId, clients).toLowerCase();
      const matchesSearch =
        !query ||
        clientName.includes(query) ||
        String(item.id).includes(query) ||
        String(item.frequency || "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.isActive) ||
        (statusFilter === "paused" && !item.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [clients, recurringInvoices, search, statusFilter]);

  const paginatedInvoices = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredInvoices.slice(start, start + PAGE_SIZE);
  }, [filteredInvoices, page]);

  const activeCount = recurringInvoices.filter((item) => item.isActive).length;
  const monthlyValue = recurringInvoices
    .filter((item) => item.isActive)
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (item: RecurringInvoice) => {
    setEditingItem(item);
    setForm({
      clientId: item.clientId,
      frequency: item.frequency || "Monthly",
      nextRunAt: item.nextRunAt ? item.nextRunAt.slice(0, 10) : "",
      amount: Number(item.amount || 0),
      isActive: Boolean(item.isActive),
      notes: item.notes || "",
    });
    setFormError("");
    setShowForm(true);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
      showToast("Recurring invoices refreshed.", "info");
    } catch {
      showToast("Unable to refresh recurring invoices.", "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.clientId || !form.nextRunAt || form.amount <= 0) {
      setFormError("Select a client, enter a next run date, and provide an amount greater than zero.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const payload = {
        clientId: Number(form.clientId),
        frequency: form.frequency,
        nextRunAt: form.nextRunAt,
        amount: Number(form.amount),
        isActive: Boolean(form.isActive),
        notes: form.notes.trim() || undefined,
      };

      if (editingItem) {
        await update(editingItem.id, payload);
        showToast("Recurring invoice updated successfully.");
      } else {
        await create(payload);
        showToast("Recurring invoice created successfully.");
      }

      setShowForm(false);
      setEditingItem(null);
      setForm(emptyForm);
    } catch {
      setFormError("We could not save this recurring invoice. Please try again.");
      showToast("Failed to save recurring invoice.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;

    try {
      await remove(deleteItem.id);
      setDeleteItem(null);
      setSelectedItem(null);
      showToast("Recurring invoice deleted successfully.");
    } catch {
      showToast("Failed to delete recurring invoice.", "error");
    }
  };

  const handleToggle = async (item: RecurringInvoice) => {
    try {
      await update(item.id, { isActive: !item.isActive });
      setSelectedItem((current) =>
        current && current.id === item.id ? { ...current, isActive: !item.isActive } : current
      );
      showToast(item.isActive ? "Recurring invoice paused." : "Recurring invoice activated.");
    } catch {
      showToast("Failed to update recurring invoice.", "error");
    }
  };

  const exportCsv = () => {
    const rows = filteredInvoices.map((item) => [
      item.id,
      getClientName(item.clientId, clients),
      item.frequency,
      item.nextRunAt,
      item.amount,
      item.isActive ? "Active" : "Paused",
    ]);

    const csv = [
      ["ID", "Client", "Frequency", "Next Run", "Amount", "Status"],
      ...rows,
    ]
      .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "recurring-invoices.csv";
    link.click();
    URL.revokeObjectURL(url);
    showToast("Recurring invoices exported.");
  };

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-rose-600">
              <FileText size={16} />
              Billing automation
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Recurring invoices</h1>
            <p className="mt-2 text-sm text-slate-500">
              Manage automated invoice schedules and keep predictable revenue flowing.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
          >
            <Plus size={18} />
            New recurring invoice
          </button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total schedules</span>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-slate-600">
                <FileText size={18} />
              </div>
            </div>
            <p className="font-mono text-3xl font-bold tracking-tight text-slate-900">{recurringInvoices.length}</p>
            <p className="mt-2 text-xs text-slate-500">Configured billing schedules</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active schedules</span>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-2.5 text-emerald-600">
                <CheckCircle2 size={18} />
              </div>
            </div>
            <p className="font-mono text-3xl font-bold tracking-tight text-slate-900">{activeCount}</p>
            <p className="mt-2 text-xs text-slate-500">Currently generating invoices</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active run value</span>
              <div className="rounded-lg border border-rose-100 bg-rose-50 p-2.5 text-rose-600">
                <DollarSign size={18} />
              </div>
            </div>
            <p className="font-mono text-3xl font-bold tracking-tight text-slate-900">{formatCurrency(monthlyValue)}</p>
            <p className="mt-2 text-xs text-slate-500">Combined scheduled invoice value</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200/80 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">All recurring invoices</h2>
              <p className="mt-1 text-sm text-slate-500">{filteredInvoices.length} schedules shown</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search schedules..."
                  className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100 sm:w-64"
                />
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <RefreshCw className={isRefreshing ? "animate-spin" : ""} size={16} />
                Refresh
              </button>
              <button
                type="button"
                onClick={exportCsv}
                className="min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Export CSV
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-slate-200/80 px-5 py-4">
            {(["all", "active", "paused"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => {
                  setStatusFilter(filter);
                  setPage(1);
                }}
                className={`min-h-[38px] rounded-lg px-3 text-sm font-medium capitalize transition ${
                  statusFilter === filter
                    ? "bg-rose-50 text-rose-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex min-h-[260px] items-center justify-center gap-3 text-sm text-slate-500">
              <RefreshCw className="animate-spin" size={18} />
              Loading recurring invoices...
            </div>
          ) : error ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 px-6 text-center">
              <AlertCircle className="text-red-500" size={28} />
              <p className="text-sm text-slate-600">{error}</p>
              <button
                type="button"
                onClick={handleRefresh}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Try again
              </button>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-3 rounded-full bg-slate-100 p-4 text-slate-400">
                <FileText size={24} />
              </div>
              <h3 className="font-semibold text-slate-900">No recurring invoices found</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                {search || statusFilter !== "all"
                  ? "Try adjusting your search or status filter."
                  : "Create your first recurring invoice schedule to get started."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  if (!recurringInvoices.length) openCreate();
                }}
                className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white"
              >
                {search || statusFilter !== "all" ? "Reset filters" : "Create schedule"}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-slate-50/80">
                  <tr className="border-b border-slate-200/80 text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3 font-semibold">Client</th>
                    <th className="px-5 py-3 font-semibold">Frequency</th>
                    <th className="px-5 py-3 font-semibold">Next run</th>
                    <th className="px-5 py-3 font-semibold">Amount</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedInvoices.map((item) => {
                    const clientName = getClientName(item.clientId, clients);
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className="cursor-pointer transition hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-xs font-bold text-rose-700">
                              {getInitials(clientName)}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{clientName}</p>
                              <p className="text-xs text-slate-500">Schedule #{item.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">{item.frequency || "—"}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Calendar size={15} className="text-slate-400" />
                            {formatDate(item.nextRunAt)}
                          </div>
                        </td>
                        <td className="px-5 py-4 font-mono text-sm font-semibold text-slate-900">
                          {formatCurrency(Number(item.amount || 0))}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge active={item.isActive} />
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                            <button
                              type="button"
                              aria-label="View recurring invoice"
                              onClick={() => setSelectedItem(item)}
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                            >
                              <Eye size={17} />
                            </button>
                            <button
                              type="button"
                              aria-label="Edit recurring invoice"
                              onClick={() => openEdit(item)}
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                            >
                              <Sparkles size={17} />
                            </button>
                            <button
                              type="button"
                              aria-label="Delete recurring invoice"
                              onClick={() => setDeleteItem(item)}
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <TablePagination
            currentPage={page}
            totalItems={filteredInvoices.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            itemLabel="schedules"
          />
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} />
            </button>
            <h2 className="pr-8 text-lg font-bold text-slate-900">
              {editingItem ? "Edit recurring invoice" : "New recurring invoice"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">Configure when and how much to bill this client.</p>

            <div className="mt-6 space-y-4">
              <Select
                label="Client"
                value={form.clientId}
                onChange={(val) => setForm({ ...form, clientId: Number(val) || 0 })}
                placeholder="Select a client..."
                options={clients.map((client) => ({
                  value: client.id,
                  label: client.name,
                }))}
                searchable
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Frequency"
                  value={form.frequency}
                  onChange={(val) => setForm({ ...form, frequency: String(val) })}
                  options={[
                    { value: 'Weekly', label: 'Weekly' },
                    { value: 'Monthly', label: 'Monthly' },
                    { value: 'Quarterly', label: 'Quarterly' },
                    { value: 'Yearly', label: 'Yearly' },
                  ]}
                />

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-700">Amount</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(event) => setForm({ ...form, amount: Number(event.target.value) || 0 })}
                    className="min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-900 outline-none focus:border-amber-500 shadow-2xs"
                  />
                </label>
              </div>

              <DatePicker
                label="Next run date"
                value={form.nextRunAt}
                onChange={(dateStr) => setForm({ ...form, nextRunAt: dateStr })}
              />

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Notes</span>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  placeholder="Optional billing notes"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-amber-500"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-800">Active schedule</span>
                  <span className="block text-xs text-slate-500">Generate invoices according to this schedule.</span>
                </span>
              </label>

              {formError && <p className="text-sm text-red-600">{formError}</p>}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="min-h-[44px] rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting && <RefreshCw className="animate-spin" size={16} />}
                {editingItem ? "Save changes" : "Create schedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} />
            </button>
            <div className="flex items-start gap-3 pr-8">
              <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
                <FileText size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Recurring invoice details</h2>
                <p className="mt-1 text-sm text-slate-500">Schedule #{selectedItem.id}</p>
              </div>
            </div>

            <div className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-slate-500">Client</span>
                <span className="text-sm font-semibold text-slate-900">{getClientName(selectedItem.clientId, clients)}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-slate-500">Amount</span>
                <span className="font-mono text-sm font-semibold text-slate-900">
                  {formatCurrency(Number(selectedItem.amount || 0))}
                </span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-slate-500">Frequency</span>
                <span className="text-sm font-semibold text-slate-900">{selectedItem.frequency || "—"}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-slate-500">Next run</span>
                <span className="text-sm font-semibold text-slate-900">{formatDate(selectedItem.nextRunAt)}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-slate-500">Status</span>
                <StatusBadge active={selectedItem.isActive} />
              </div>
            </div>

            {selectedItem.notes && (
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</p>
                <p className="mt-2 text-sm text-slate-700">{selectedItem.notes}</p>
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => handleToggle(selectedItem)}
                className="min-h-[44px] rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                {selectedItem.isActive ? "Pause schedule" : "Activate schedule"}
              </button>
              <button
                type="button"
                onClick={() => openEdit(selectedItem)}
                className="min-h-[44px] rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white transition hover:bg-amber-700"
              >
                Edit schedule
              </button>
              <button
                type="button"
                onClick={() => navigate(`${ROUTES.SCREEN_INVOICE_DETAILS}?id=${selectedItem.id}`)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                View invoice details
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setDeleteItem(null)}
              className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} />
            </button>
            <div className="rounded-xl bg-red-50 p-3 text-red-600 w-fit">
              <Trash2 size={22} />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">Delete recurring invoice?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This will permanently remove the schedule for{" "}
              <span className="font-semibold text-slate-700">
                {getClientName(deleteItem.clientId, clients)}
              </span>
              .
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteItem(null)}
                className="min-h-[44px] rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="min-h-[44px] rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Delete schedule
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}