import type { Alert } from '../types';
import React, { useMemo, useState } from 'react';
import { useAlerts } from '../hooks';
import { ROUTES } from '../routes';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Bell, CheckCircle2, ChevronRight, Clock, Download, Eye, FileText, Mail, RefreshCw, Search, X, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

type ToastState = {
  message: string;
  type: ToastType;
} | null;

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const formatLabel = (value?: string) => {
  if (!value) return 'Unknown';
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const getStatusClasses = (status?: string) => {
  const normalized = (status || '').toLowerCase();

  if (normalized === 'resolved' || normalized === 'sent' || normalized === 'read') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

  if (normalized === 'failed' || normalized === 'error') {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }

  return 'bg-amber-50 text-amber-700 border-amber-200';
};

function StatusBadge({ status }: { status?: string }) {
  const normalized = (status || '').toLowerCase();
  const isPositive = normalized === 'resolved' || normalized === 'sent' || normalized === 'read';
  const isNegative = normalized === 'failed' || normalized === 'error';

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
        status,
      )}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isPositive ? 'bg-emerald-500' : isNegative ? 'bg-rose-500' : 'bg-amber-500'
        }`}
      />
      {formatLabel(status)}
    </span>
  );
}

function StatCard({
  label,
  value,
  description,
  icon,
  tone,
}: {
  label: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-slate-300">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-3 font-mono text-3xl font-bold tracking-tight text-slate-900">{value}</p>
        </div>
        <div className={`rounded-xl border p-2.5 ${tone}`}>{icon}</div>
      </div>
      <p className="mt-3 text-sm text-slate-500">{description}</p>
    </div>
  );
}

export default function InvoiceAlertsPage() {
  const navigate = useNavigate();
  const { data, loading, error, refresh, update } = useAlerts();
  const alerts = data || [];

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  const filteredAlerts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return alerts.filter((alert) => {
      const matchesStatus =
        statusFilter === 'all' || (alert.status || '').toLowerCase() === statusFilter;
      const searchable = [
        alert.id,
        alert.invoiceId,
        alert.inventoryItemId,
        alert.channel,
        alert.alertType,
        alert.status,
      ]
        .map((value) => String(value ?? ''))
        .join(' ')
        .toLowerCase();

      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [alerts, search, statusFilter]);

  const pendingCount = alerts.filter((alert) => {
    const status = (alert.status || '').toLowerCase();
    return status !== 'resolved' && status !== 'sent' && status !== 'read';
  }).length;

  const resolvedCount = alerts.filter((alert) => {
    const status = (alert.status || '').toLowerCase();
    return status === 'resolved' || status === 'sent' || status === 'read';
  }).length;

  const emailCount = alerts.filter(
    (alert) => (alert.channel || '').toLowerCase() === 'email',
  ).length;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
      showToast('Alerts refreshed successfully.', 'info');
    } catch {
      showToast('Unable to refresh alerts.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport = () => {
    const headers = ['ID', 'Invoice ID', 'Channel', 'Alert Type', 'Status', 'Created At'];
    const rows = filteredAlerts.map((alert) => [
      alert.id,
      alert.invoiceId ?? '',
      alert.channel ?? '',
      alert.alertType ?? '',
      alert.status ?? '',
      alert.createdAt ?? '',
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'invoice-alerts.csv';
    link.click();
    URL.revokeObjectURL(url);
    showToast('Alert report exported successfully.');
  };

  const handleStatusUpdate = async (status: string) => {
    if (!selectedAlert) return;

    setIsUpdating(true);
    try {
      await update(selectedAlert.id, { status });
      setSelectedAlert({ ...selectedAlert, status });
      showToast('Alert status updated successfully.');
    } catch {
      showToast('Failed to update alert status.', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleViewInvoice = (alert: Alert) => {
    const invoiceId = alert.invoiceId ?? alert.id;
    navigate(`${ROUTES.SCREEN_INVOICE_DETAILS}?id=${invoiceId}`);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
            Monitoring active
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Invoice Alerts</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Monitor invoice delivery, payment, and account alerts from one workspace.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={isRefreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
          >
            <Download className="h-4 w-4" />
            Export report
          </button>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total alerts"
          value={alerts.length}
          description="All alerts in your workspace"
          icon={<Bell className="h-5 w-5" />}
          tone="border-slate-200 bg-slate-50 text-slate-600"
        />
        <StatCard
          label="Needs attention"
          value={pendingCount}
          description="Alerts awaiting resolution"
          icon={<AlertCircle className="h-5 w-5" />}
          tone="border-amber-200 bg-amber-50 text-amber-600"
        />
        <StatCard
          label="Resolved"
          value={resolvedCount}
          description="Successfully processed alerts"
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="border-emerald-200 bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Email alerts"
          value={emailCount}
          description="Alerts configured for email"
          icon={<Mail className="h-5 w-5" />}
          tone="border-indigo-200 bg-indigo-50 text-indigo-600"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-200/80 p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-slate-900">Alert activity</h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {filteredAlerts.length}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Review delivery events and update alert statuses.
              </p>
            </div>

            <div className="relative w-full lg:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search alerts..."
                className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {['all', 'pending', 'sent', 'read', 'resolved', 'failed'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`min-h-[36px] rounded-lg px-3 text-sm font-semibold capitalize transition ${
                  statusFilter === status
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : error ? (
          <div className="p-10 text-center">
            <XCircle className="mx-auto h-10 w-10 text-rose-500" />
            <h3 className="mt-4 font-semibold text-slate-900">Unable to load alerts</h3>
            <p className="mt-1 text-sm text-slate-500">{error}</p>
            <button
              type="button"
              onClick={handleRefresh}
              className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-4 font-semibold text-slate-900">No alerts found</h3>
            <p className="mt-1 text-sm text-slate-500">
              Try adjusting your search or status filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
              className="mt-5 min-h-[40px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-slate-300"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="border-b border-slate-200/80 bg-slate-50/70">
                <tr className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4">Alert</th>
                  <th className="px-6 py-4">Channel</th>
                  <th className="px-6 py-4">Related record</th>
                  <th className="px-6 py-4">Created</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAlerts.map((alert) => (
                  <tr
                    key={alert.id}
                    className="group cursor-pointer transition hover:bg-slate-50/80"
                    onClick={() => setSelectedAlert(alert)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600">
                          {alert.channel?.toLowerCase() === 'email' ? (
                            <Mail className="h-4 w-4" />
                          ) : (
                            <Bell className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {formatLabel(alert.alertType)}
                          </p>
                          <p className="mt-0.5 font-mono text-xs text-slate-400">
                            ALT-{String(alert.id).padStart(5, '0')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatLabel(alert.channel)}</td>
                    <td className="px-6 py-4">
                      <p className="font-mono text-sm text-slate-700">
                        {alert.invoiceId != null ? `Invoice #${alert.invoiceId}` : 'Inventory alert'}
                      </p>
                      {alert.inventoryItemId != null && (
                        <p className="mt-1 text-xs text-slate-400">
                          Item #{alert.inventoryItemId}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{formatDate(alert.createdAt)}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={alert.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedAlert(alert);
                        }}
                        className="inline-flex min-h-[36px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 opacity-0 transition hover:border-slate-300 hover:text-slate-900 group-hover:opacity-100"
                      >
                        <Eye className="h-4 w-4" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setSelectedAlert(null)}
              className="absolute right-4 top-4 inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close alert details"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="pr-10">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900">
                    {formatLabel(selectedAlert.alertType)}
                  </p>
                  <p className="font-mono text-xs text-slate-400">
                    ALT-{String(selectedAlert.id).padStart(5, '0')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Channel
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Mail className="h-4 w-4 text-slate-400" />
                    {formatLabel(selectedAlert.channel)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Current status
                  </p>
                  <div className="mt-2">
                    <StatusBadge status={selectedAlert.status} />
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Created
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Clock className="h-4 w-4 text-slate-400" />
                    {formatDate(selectedAlert.createdAt)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Related invoice
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {selectedAlert.invoiceId != null ? `#${selectedAlert.invoiceId}` : 'Not linked'}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <p className="mb-3 text-sm font-semibold text-slate-900">Update status</p>
                <div className="flex flex-wrap gap-2">
                  {['pending', 'sent', 'read', 'resolved', 'failed'].map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={isUpdating || (selectedAlert.status || '').toLowerCase() === status}
                      onClick={() => handleStatusUpdate(status)}
                      className={`min-h-[40px] rounded-lg border px-3 text-sm font-semibold capitalize transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        (selectedAlert.status || '').toLowerCase() === status
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedAlert(null)}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-slate-300"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleViewInvoice(selectedAlert)}
                  className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  View invoice details
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
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
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : toast.type === 'error' ? (
            <XCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {toast.message}
        </div>
      )}
    </div>
  );
}