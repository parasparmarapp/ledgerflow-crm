import type { Invoice } from '../types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { formatCurrency } from '../lib/currency';
import { ROUTES } from '../routes';
import { useNavigate } from 'react-router-dom';
import { Select } from '../components';
import { AlertCircle, ArrowLeft, ArrowRight, BarChart3, Calendar, CheckCircle2, DollarSign, Download, FileText, RefreshCw, Search, XCircle, Activity as ActivityIcon, Printer } from 'lucide-react';
import { DateRangeFilter } from '../components/DateRangeFilter';

type ToastType = "success" | "error" | "info";
type ToastState = { message: string; type: ToastType } | null;
type Period = "30 days" | "90 days" | "12 months" | "custom";

function formatDate(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusClasses(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes("paid") || normalized.includes("complete")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (normalized.includes("overdue") || normalized.includes("cancel")) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function getStatusDot(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes("paid") || normalized.includes("complete")) {
    return "bg-emerald-500";
  }
  if (normalized.includes("overdue") || normalized.includes("cancel")) {
    return "bg-rose-500";
  }
  return "bg-amber-500";
}

import { useRevenueReport } from '../hooks';

export default function RevenueReportPage() {
  const navigate = useNavigate();
  const { data: invoices, loading: isLoading, error, refresh } = useRevenueReport();
  const [period, setPeriod] = useState<Period>("12 months");
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = useCallback(
    (message: string, type: ToastType = "success") => {
      setToast({ message, type });
      window.setTimeout(() => setToast(null), 3000);
    },
    [],
  );

  const loadReport = useCallback(
    async (showRefreshState = false) => {
      if (showRefreshState) setIsRefreshing(true);
      try {
        await refresh();
        if (showRefreshState) showToast("Revenue report refreshed.", "success");
      } catch {
        if (showRefreshState) showToast("Unable to refresh the report.", "error");
      } finally {
        setIsRefreshing(false);
      }
    },
    [refresh, showToast],
  );

  const periodStart = useMemo(() => {
    const start = new Date();
    if (period === "30 days") start.setDate(start.getDate() - 30);
    if (period === "90 days") start.setDate(start.getDate() - 90);
    if (period === "12 months") start.setFullYear(start.getFullYear() - 1);
    return start;
  }, [period]);

  const periodInvoices = useMemo(
    () =>
      invoices.filter((invoice) => {
        const issueDate = new Date(invoice.issueDate);
        if (Number.isNaN(issueDate.getTime())) return false;
        if (startDate) {
          const s = new Date(startDate);
          if (issueDate < s) return false;
        }
        if (endDate) {
          const e = new Date(`${endDate}T23:59:59.999`);
          if (issueDate > e) return false;
        }
        if (!startDate && !endDate) {
          return issueDate >= periodStart;
        }
        return true;
      }),
    [invoices, periodStart, startDate, endDate],
  );

  const totalRevenue = useMemo(
    () =>
      periodInvoices.reduce(
        (sum, invoice) => sum + Number(invoice.totalAmount || 0),
        0,
      ),
    [periodInvoices],
  );

  const totalCollected = useMemo(
    () =>
      periodInvoices.reduce(
        (sum, invoice) => sum + Number(invoice.amountPaid || 0),
        0,
      ),
    [periodInvoices],
  );

  const outstandingRevenue = Math.max(totalRevenue - totalCollected, 0);

  const collectionRate =
    totalRevenue > 0 ? Math.round((totalCollected / totalRevenue) * 100) : 0;

  const chartData = useMemo(() => {
    const monthMap = new Map<string, number>();

    periodInvoices.forEach((invoice) => {
      const date = new Date(invoice.issueDate);
      if (Number.isNaN(date.getTime())) return;
      const key = date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      monthMap.set(
        key,
        (monthMap.get(key) || 0) + Number(invoice.totalAmount || 0),
      );
    });

    return Array.from(monthMap.entries())
      .map(([label, value]) => ({ label, value }))
      .slice(-6);
  }, [periodInvoices]);

  const maxChartValue = Math.max(...chartData.map((item) => item.value), 1);

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...periodInvoices]
      .filter((invoice) => {
        const invoiceStatus = String(invoice.status || "");
        const matchesStatus =
          statusFilter === "All" ||
          invoiceStatus.toLowerCase() === statusFilter.toLowerCase();

        const searchable = [
          invoice.invoiceNumber,
          invoice.status,
          invoice.issueDate,
          invoice.dueDate,
        ]
          .map((value) => String(value || "").toLowerCase())
          .join(" ");

        return matchesStatus && (!query || searchable.includes(query));
      })
      .sort(
        (a, b) =>
          new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime(),
      );
  }, [periodInvoices, search, statusFilter]);

  const statuses = useMemo(() => {
    const values = new Set(
      periodInvoices
        .map((invoice) => String(invoice.status || "").trim())
        .filter(Boolean),
    );
    return ["All", ...Array.from(values)];
  }, [periodInvoices]);

  const exportReport = () => {
    if (filteredInvoices.length === 0) {
      showToast("There is no report data to export.", "info");
      return;
    }

    const headers = [
      "Invoice number",
      "Issue date",
      "Due date",
      "Status",
      "Revenue",
      "Amount paid",
    ];

    const rows = filteredInvoices.map((invoice) =>
      [
        invoice.invoiceNumber,
        invoice.issueDate,
        invoice.dueDate,
        invoice.status,
        Number(invoice.totalAmount || 0),
        Number(invoice.amountPaid || 0),
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    );

    const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ledgerflow-revenue-report.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Revenue report exported successfully.", "success");
  };

  const toastIcon =
    toast?.type === "success" ? (
      <CheckCircle2 className="h-4 w-4" />
    ) : toast?.type === "error" ? (
      <XCircle className="h-4 w-4" />
    ) : (
      <AlertCircle className="h-4 w-4" />
    );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Revenue tracking active
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Revenue Report
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Monitor invoiced revenue, collections, and outstanding balances.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
           <button
            type="button"
            onClick={() => void loadReport(true)}
            disabled={isRefreshing}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportReport}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer shadow-xs"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            Export PDF
          </button>
         
        </div>
      </div>

      <div className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <Calendar className="h-4 w-4 text-slate-400" />
          Reporting period
        </div>
        <div className="flex flex-wrap items-center gap-3">
          
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
              if (start || end) {
                setPeriod("custom");
              } else {
                setPeriod("12 months");
              }
            }}
            align="right"
            placeholder="Custom Date Range"
          />
        </div>
      </div>

      {error ? (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => void loadReport()}
            className="min-h-[40px] rounded-lg bg-white px-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-100"
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total revenue",
            value: formatCurrency(totalRevenue),
            icon: DollarSign,
            accent: "bg-rose-50 text-rose-600",
          },
          {
            label: "Collected",
            value: formatCurrency(totalCollected),
            icon: CheckCircle2,
            accent: "bg-emerald-50 text-emerald-600",
          },
          {
            label: "Outstanding",
            value: formatCurrency(outstandingRevenue),
            icon: ActivityIcon,
            accent: "bg-amber-50 text-amber-600",
          },
          {
            label: "Collection rate",
            value: `${collectionRate}%`,
            icon: BarChart3,
            accent: "bg-indigo-50 text-indigo-600",
          },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-slate-300"
            >
              <div className="flex items-start justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {metric.label}
                </p>
                <div className={`rounded-lg p-2.5 ${metric.accent}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-5 font-mono text-2xl font-bold tracking-tight text-slate-900">
                {isLoading ? "—" : metric.value}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {period === "12 months" ? "Last 12 months" : `Last ${period}`}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Revenue trend</h2>
              <p className="mt-1 text-sm text-slate-500">
                Monthly invoiced revenue in the selected period.
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2 text-slate-500">
              <BarChart3 className="h-4 w-4" />
            </div>
          </div>
          {chartData.length > 0 ? (
            <div className="flex h-52 items-end gap-3 border-b border-slate-100 pb-0 sm:gap-5">
              {chartData.map((item) => (
                <div
                  key={item.label}
                  className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2"
                >
                  <span className="pointer-events-none rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                    {formatCurrency(item.value)}
                  </span>
                  <div
                    className="w-full max-w-12 rounded-t-lg bg-rose-500 transition-all group-hover:bg-rose-600"
                    style={{
                      height: `${Math.max((item.value / maxChartValue) * 150, 8)}px`,
                    }}
                  />
                  <span className="truncate text-[11px] text-slate-400">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
              No revenue activity in this period.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Revenue health</h2>
              <p className="mt-1 text-sm text-slate-500">
                A concise view of your current collection mix.
              </p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <ActivityIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-slate-500">Collected revenue</span>
                <span className="font-semibold text-slate-900">{collectionRate}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(collectionRate, 100)}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Invoices</p>
                <p className="mt-1 font-mono text-xl font-bold text-slate-900">
                  {periodInvoices.length}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Average invoice</p>
                <p className="mt-1 font-mono text-xl font-bold text-slate-900">
                  {formatCurrency(
                    periodInvoices.length > 0
                      ? totalRevenue / periodInvoices.length
                      : 0,
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-700">
              <FileText className="h-5 w-5 shrink-0" />
              Revenue is calculated from invoice totals issued during the selected period.
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200/80 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Revenue details</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {filteredInvoices.length}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Invoice-level revenue activity for this period.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search invoices..."
                className="min-h-[40px] w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 sm:w-56"
              />
            </div>
            <div className="w-full sm:w-44">
              <Select
                value={statusFilter}
                onChange={(val) => setStatusFilter(val)}
                options={statuses.map((status) => ({
                  value: status,
                  label: status === 'All' ? 'All statuses' : status,
                }))}
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-14 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="rounded-full bg-slate-100 p-3 text-slate-400">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              No revenue records found
            </h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Try changing the reporting period, search term, or status filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("All");
              }}
              className="mt-4 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Reset filters
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200/80">
                  {["Invoice", "Issue date", "Due date", "Revenue", "Collected", "Status"].map(
                    (heading) => (
                      <th
                        key={heading}
                        className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <span className="font-mono text-sm font-semibold text-slate-900">
                        {invoice.invoiceNumber || `INV-${invoice.id}`}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {formatDate(invoice.issueDate)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {formatDate(invoice.dueDate)}
                    </td>
                    <td className="px-5 py-4 font-mono text-sm font-semibold text-slate-900">
                      {formatCurrency(Number(invoice.totalAmount || 0))}
                    </td>
                    <td className="px-5 py-4 font-mono text-sm text-slate-700">
                      {formatCurrency(Number(invoice.amountPaid || 0))}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusClasses(
                          String(invoice.status || "pending"),
                        )}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${getStatusDot(
                            String(invoice.status || "pending"),
                          )}`}
                        />
                        {invoice.status || "Pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast ? (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === "success"
              ? "bg-emerald-600"
              : toast.type === "error"
                ? "bg-red-500"
                : "bg-indigo-500"
          }`}
        >
          {toastIcon}
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}