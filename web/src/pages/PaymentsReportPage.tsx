import type { Payment } from '../types';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { formatCurrency } from '../lib/currency';
import { ROUTES } from '../routes';
import { useNavigate } from 'react-router-dom';
import { Select } from '../components';
import { AlertCircle, ArrowLeft, BarChart3, Calendar, CheckCircle2, ChevronRight, Clock, Download, Eye, FileText, RefreshCw, Search, X, XCircle, Printer } from 'lucide-react';
import { DateRangeFilter } from '../components/DateRangeFilter';

type Period = "7" | "30" | "90" | "all" | "custom";
type ToastType = "success" | "error" | "info";

type Toast = {
  message: string;
  type: ToastType;
};

function statusClasses(status: string): string {
  const normalized = status.toLowerCase();

  if (normalized === "completed" || normalized === "paid" || normalized === "succeeded") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (normalized === "pending" || normalized === "processing") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  if (normalized === "failed" || normalized === "cancelled" || normalized === "canceled") {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }

  return "bg-slate-50 text-slate-600 border-slate-200";
}

function formatDate(value: string | undefined): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function isWithinPeriod(dateValue: string | undefined, period: Period): boolean {
  if (period === "all") return true;
  if (!dateValue) return false;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - Number(period));

  return date >= cutoff;
}

function initials(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("") || "—";
}

import { usePaymentsReport } from "../hooks";

export default function PaymentsReportPage() {
  const navigate = useNavigate();
  const { data: payments, loading, error, refresh } = usePaymentsReport();
  const [period, setPeriod] = useState<Period>("30");
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (message: string, type: ToastType = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  const loadReport = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
      showToast("Payments report refreshed.", "success");
    } catch {
      showToast("Unable to refresh payments report.", "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return payments
      .filter((payment) => {
        if (!payment?.paymentDate) return false;
        const date = new Date(payment.paymentDate);
        if (Number.isNaN(date.getTime())) return false;
        if (startDate) {
          const s = new Date(startDate);
          if (date < s) return false;
        }
        if (endDate) {
          const e = new Date(`${endDate}T23:59:59.999`);
          if (date > e) return false;
        }
        if (!startDate && !endDate) {
          return isWithinPeriod(payment?.paymentDate, period);
        }
        return true;
      })
      .filter((payment) => {
        if (statusFilter === "all") return true;
        return (payment?.status || "").toLowerCase() === statusFilter;
      })
      .filter((payment) => {
        if (!query) return true;

        return [
          String(payment?.id || ""),
          String(payment?.invoiceId || ""),
          String(payment?.clientId || ""),
          String(payment?.method || ""),
          String(payment?.reference || ""),
          String(payment?.status || ""),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((first, second) => {
        const firstDate = new Date(first?.paymentDate || first?.createdAt || "").getTime();
        const secondDate = new Date(second?.paymentDate || second?.createdAt || "").getTime();
        return secondDate - firstDate;
      });
  }, [payments, period, search, statusFilter]);

  const periodPayments = useMemo(
    () => payments.filter((payment) => isWithinPeriod(payment?.paymentDate, period)),
    [payments, period],
  );

  const totalAmount = useMemo(
    () => periodPayments.reduce((sum, payment) => sum + Number(payment?.amount || 0), 0),
    [periodPayments],
  );

  const completedAmount = useMemo(
    () =>
      periodPayments
        .filter((payment) => {
          const status = (payment?.status || "").toLowerCase();
          return status === "completed" || status === "paid" || status === "succeeded";
        })
        .reduce((sum, payment) => sum + Number(payment?.amount || 0), 0),
    [periodPayments],
  );

  const averageAmount = periodPayments.length ? totalAmount / periodPayments.length : 0;

  const methodBreakdown = useMemo(() => {
    const breakdown = new Map<string, number>();

    periodPayments.forEach((payment) => {
      const method = payment?.method || "Other";
      breakdown.set(method, (breakdown.get(method) || 0) + Number(payment?.amount || 0));
    });

    return Array.from(breakdown.entries())
      .sort((first, second) => second[1] - first[1])
      .slice(0, 5);
  }, [periodPayments]);

  const exportReport = () => {
    if (!filteredPayments.length) {
      showToast("There are no payments to export.", "info");
      return;
    }

    const headers = ["Payment ID", "Invoice ID", "Client ID", "Amount", "Payment Date", "Method", "Status", "Reference"];
    const rows = filteredPayments.map((payment) =>
      [
        payment?.id,
        payment?.invoiceId,
        payment?.clientId,
        Number(payment?.amount || 0).toFixed(2),
        payment?.paymentDate || "",
        payment?.method || "",
        payment?.status || "",
        payment?.reference || "",
      ]
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "payments-report.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Payments report exported successfully.");
  };

  const refreshReport = async () => {
    setIsRefreshing(true);
    await loadReport();
    setIsRefreshing(false);
    showToast("Payments report refreshed.", "info");
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPeriod("30");
  };

  const statuses = useMemo(() => {
    const values = new Set(
      payments
        .map((payment) => (payment?.status || "").toLowerCase())
        .filter(Boolean),
    );
    return ["all", ...Array.from(values)];
  }, [payments]);

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
                <BarChart3 size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payments Report</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Review payment performance, collection activity, and settlement trends.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void refreshReport()}
              disabled={isRefreshing || loading}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              type="button"
              onClick={exportReport}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 cursor-pointer"
            >
              <Download size={16} />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 cursor-pointer"
            >
              <Printer size={16} />
              Export PDF
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Calendar size={17} className="text-slate-400" />
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
                  setPeriod("30");
                }
              }}
              align="right"
              placeholder="Select Date Range"
            />
          </div>
        </div>

        {error ? (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} />
              <div>
                <p className="font-semibold">Could not load the payments report</p>
                <p className="mt-1 text-sm text-rose-700">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadReport()}
              className="min-h-[40px] rounded-lg bg-white px-3 text-sm font-semibold text-rose-700 shadow-sm ring-1 ring-rose-200"
            >
              Retry
            </button>
          </div>
        ) : null}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Total collected",
              value: formatCurrency(totalAmount),
              icon: <BarChart3 size={18} />,
              note: `${periodPayments.length} payments in period`,
            },
            {
              label: "Completed payments",
              value: formatCurrency(completedAmount),
              icon: <CheckCircle2 size={18} />,
              note: "Settled successfully",
            },
            {
              label: "Average payment",
              value: formatCurrency(averageAmount),
              icon: <ActivityIcon />,
              note: "Per recorded payment",
            },
            {
              label: "Payment volume",
              value: String(periodPayments.length),
              icon: <FileText size={18} />,
              note: "Transactions recorded",
            },
          ].map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-slate-300"
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {metric.label}
                </span>
                <span className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-slate-600">
                  {metric.icon}
                </span>
              </div>
              <div className="font-mono text-2xl font-bold tracking-tight text-slate-900">
                {loading ? "—" : metric.value}
              </div>
              <p className="mt-2 text-xs text-slate-500">{metric.note}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Collection overview</h2>
                <p className="mt-1 text-sm text-slate-500">Payment activity for the selected period.</p>
              </div>
              <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                Live report
              </span>
            </div>
            <div className="flex h-40 items-end gap-2 border-b border-slate-100 pb-3">
              {Array.from({ length: 12 }).map((_, index) => {
                const maximum = Math.max(...periodPayments.map((payment) => Number(payment?.amount || 0)), 1);
                const payment = periodPayments[index];
                const amount = Number(payment?.amount || 0);
                const height = payment ? Math.max(12, Math.round((amount / maximum) * 100)) : 8;

                return (
                  <div key={index} className="group flex h-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-md bg-rose-200 transition-all group-hover:bg-rose-500"
                      style={{ height: `${height}%` }}
                      title={payment ? formatCurrency(amount) : "No payment"}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex justify-between text-[11px] font-medium uppercase tracking-wide text-slate-400">
              <span>Earlier</span>
              <span>Most recent</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-base font-bold text-slate-900">Payment methods</h2>
              <p className="mt-1 text-sm text-slate-500">Collected amount by method.</p>
            </div>
            {methodBreakdown.length ? (
              <div className="space-y-4">
                {methodBreakdown.map(([method, amount]) => {
                  const percentage = totalAmount ? Math.round((amount / totalAmount) * 100) : 0;

                  return (
                    <div key={method}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-medium capitalize text-slate-700">{method}</span>
                        <span className="font-mono text-xs text-slate-500">{formatCurrency(amount)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-rose-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-[150px] items-center justify-center text-center text-sm text-slate-500">
                No payment method data for this period.
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200/80 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Payment transactions</h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {filteredPayments.length}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">Search and inspect individual payment records.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search payments..."
                  className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 sm:w-64"
                />
              </div>
              <div className="w-full sm:w-44">
                <Select
                  value={statusFilter}
                  onChange={(val) => setStatusFilter(val)}
                  options={statuses.map((status) => ({
                    value: status,
                    label: status === 'all' ? 'All statuses' : status,
                  }))}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="space-y-4 p-6">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : filteredPayments.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="bg-slate-50/80">
                  <tr className="border-b border-slate-200/80 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-4">Payment</th>
                    <th className="px-6 py-4">Client / Invoice</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Method</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayments.map((payment) => {
                    const status = payment?.status || "Unknown";
                    const displayName = `Client ${payment?.clientId ?? "—"}`;

                    return (
                      <tr key={payment.id} className="transition hover:bg-slate-50/70">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                              {initials(`P${payment?.id ?? ""}`)}
                            </div>
                            <span className="font-mono text-sm font-semibold text-slate-900">
                              PAY-{String(payment?.id ?? 0).padStart(5, "0")}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-slate-800">{displayName}</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            Invoice #{payment?.invoiceId ?? "—"}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {formatDate(payment?.paymentDate || payment?.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-sm capitalize text-slate-600">
                          {payment?.method || "—"}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-sm font-semibold text-slate-900">
                          {formatCurrency(Number(payment?.amount || 0))}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusClasses(status)}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedPayment(payment)}
                            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Eye size={16} />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 rounded-2xl bg-slate-100 p-4 text-slate-400">
                <Search size={24} />
              </div>
              <h3 className="font-semibold text-slate-900">No payments found</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Try adjusting the reporting period, search term, or status filter.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Reset filters
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedPayment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setSelectedPayment(null)}
              className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close payment details"
            >
              <X size={18} />
            </button>
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
                <FileText size={21} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Payment details</h2>
                <p className="font-mono text-xs text-slate-500">
                  PAY-{String(selectedPayment.id ?? 0).padStart(5, "0")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Amount</p>
                <p className="mt-2 font-mono text-xl font-bold text-slate-900">
                  {formatCurrency(Number(selectedPayment.amount || 0))}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</p>
                <span
                  className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusClasses(selectedPayment.status || "")}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {selectedPayment.status || "Unknown"}
                </span>
              </div>
            </div>

            <dl className="mt-6 divide-y divide-slate-100">
              {[
                ["Client ID", selectedPayment.clientId],
                ["Invoice ID", selectedPayment.invoiceId],
                ["Payment date", formatDate(selectedPayment.paymentDate)],
                ["Method", selectedPayment.method || "—"],
                ["Reference", selectedPayment.reference || "—"],
                ["Created", formatDate(selectedPayment.createdAt)],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-right font-medium capitalize text-slate-800">{String(value)}</dd>
                </div>
              ))}
            </dl>

            <button
              type="button"
              onClick={() => setSelectedPayment(null)}
              className="mt-6 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Close details
            </button>
          </div>
        </div>
      ) : null}

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
          {toast.type === "success" ? (
            <CheckCircle2 size={17} />
          ) : toast.type === "error" ? (
            <XCircle size={17} />
          ) : (
            <Clock size={17} />
          )}
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}

function ActivityIcon() {
  return <BarChart3 size={18} />;
}