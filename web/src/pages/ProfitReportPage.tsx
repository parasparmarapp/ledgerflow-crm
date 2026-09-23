import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { formatCurrency } from '../lib/currency';
import { ROUTES } from '../routes';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, BarChart3, Calendar, CheckCircle2, Download, RefreshCw, TrendingDown, TrendingUp, XCircle, Printer } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

type ProfitReportRow = {
  id?: number;
  period?: string;
  date?: string;
  label?: string;
  revenue?: number;
  expenses?: number;
  profit?: number;
  margin?: number;
};

type ProfitReportResponse = {
  totalRevenue?: number;
  totalExpenses?: number;
  netProfit?: number;
  profitMargin?: number;
  rows?: ProfitReportRow[];
  data?: ProfitReportRow[];
  periods?: ProfitReportRow[];
};

type ToastState = {
  message: string;
  type: ToastType;
} | null;

function numberValue(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function formatPercent(value: number): string {
  return `${numberValue(value).toFixed(1)}%`;
}

function displayPeriod(row: ProfitReportRow): string {
  return String(row.period || row.label || row.date || 'Period');
}

function escapeCsv(value: string | number): string {
  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

import { useProfitReport } from '../hooks';

export default function ProfitReportPage() {
  const navigate = useNavigate();
  const { report, rows, loading: isLoading, error, refresh } = useProfitReport();
  const [period, setPeriod] = useState('12 months');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  const loadReport = async (refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    try {
      await refresh();
      if (refreshing) showToast('Profit report refreshed.', 'info');
    } catch {
      showToast('Failed to refresh profit report.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const visibleRows = useMemo(() => {
    if (period === '12 months') {
      return rows;
    }

    const limit = period === '30 days' ? 1 : period === '7 days' ? 1 : 1;
    return rows.slice(-limit);
  }, [period, rows]);

  const totals = useMemo(() => {
    const revenueFromRows = visibleRows.reduce(
      (total, row) => total + numberValue(row.revenue),
      0,
    );
    const expensesFromRows = visibleRows.reduce(
      (total, row) => total + numberValue(row.expenses),
      0,
    );
    const profitFromRows = visibleRows.reduce(
      (total, row) => total + numberValue(row.profit),
      0,
    );

    const revenue = visibleRows.length
      ? revenueFromRows
      : numberValue(report?.totalRevenue);
    const expenses = visibleRows.length
      ? expensesFromRows
      : numberValue(report?.totalExpenses);
    const profit = visibleRows.length
      ? profitFromRows
      : numberValue(report?.netProfit);
    const margin = revenue > 0 ? (profit / revenue) * 100 : numberValue(report?.profitMargin);

    return { revenue, expenses, profit, margin };
  }, [report, visibleRows]);

  const chartRows = useMemo(() => {
    const source = visibleRows.length ? visibleRows : rows;
    const maximum = Math.max(
      ...source.map((row) =>
        Math.max(numberValue(row.revenue), numberValue(row.expenses), numberValue(row.profit)),
      ),
      1,
    );

    return source.map((row) => ({
      ...row,
      revenueHeight: (numberValue(row.revenue) / maximum) * 100,
      expensesHeight: (numberValue(row.expenses) / maximum) * 100,
      profitHeight: (Math.max(numberValue(row.profit), 0) / maximum) * 100,
    }));
  }, [rows, visibleRows]);

  const exportReport = () => {
    if (!rows.length) {
      showToast('There is no report data to export.', 'info');
      return;
    }

    const header = ['Period', 'Revenue', 'Expenses', 'Profit', 'Margin'];
    const csvRows = rows.map((row) =>
      [
        displayPeriod(row),
        numberValue(row.revenue),
        numberValue(row.expenses),
        numberValue(row.profit),
        numberValue(row.margin),
      ]
        .map(escapeCsv)
        .join(','),
    );
    const blob = new Blob([[header.map(escapeCsv).join(','), ...csvRows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'profit-report.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Profit report exported successfully.');
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-56 rounded-lg bg-slate-200" />
          <div className="h-4 w-96 max-w-full rounded bg-slate-200" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-36 rounded-2xl border border-slate-200 bg-white" />
            ))}
          </div>
          <div className="h-80 rounded-2xl border border-slate-200 bg-white" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-500" />
          <h1 className="text-lg font-bold text-slate-900">Profit report unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <button
            type="button"
            onClick={() => void loadReport()}
            className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Financial performance overview
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Profit Report
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Track profitability, operating costs, and margin performance over time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(ROUTES.SCREEN_RECURRING_INVOICES)}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            type="button"
            onClick={() => void loadReport(true)}
            disabled={isRefreshing}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportReport}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            Export PDF
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Calendar className="h-4 w-4 text-slate-400" />
          Reporting period
        </div>
        <div className="flex flex-wrap gap-2">
          {['7 days', '30 days', '12 months'].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setPeriod(option)}
              className={`min-h-[40px] rounded-lg px-4 py-2 text-sm font-semibold transition ${
                period === option
                  ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total revenue"
          value={formatCurrency(totals.revenue)}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="emerald"
          helper="Gross income"
        />
        <MetricCard
          label="Total expenses"
          value={formatCurrency(totals.expenses)}
          icon={<TrendingDown className="h-5 w-5" />}
          tone="amber"
          helper="Operating costs"
        />
        <MetricCard
          label="Net profit"
          value={formatCurrency(totals.profit)}
          icon={<BarChart3 className="h-5 w-5" />}
          tone="rose"
          helper="Revenue less expenses"
        />
        <MetricCard
          label="Profit margin"
          value={formatPercent(totals.margin)}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="blue"
          helper="Net profit / revenue"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Profitability trend</h2>
              <p className="mt-1 text-sm text-slate-500">
                Revenue, expenses, and profit by reporting period.
              </p>
            </div>
            <div className="hidden items-center gap-4 text-xs text-slate-500 sm:flex">
              <Legend color="bg-emerald-500" label="Revenue" />
              <Legend color="bg-amber-400" label="Expenses" />
              <Legend color="bg-rose-500" label="Profit" />
            </div>
          </div>

          {chartRows.length ? (
            <div className="flex h-72 items-end gap-3 overflow-x-auto border-b border-slate-100 pb-3">
              {chartRows.map((row, index) => (
                <div
                  key={`${displayPeriod(row)}-${row.id || index}`}
                  className="flex min-w-[52px] flex-1 flex-col items-center justify-end gap-3"
                >
                  <div className="flex h-56 w-full min-w-[42px] items-end justify-center gap-1">
                    <div
                      title={`Revenue: ${formatCurrency(numberValue(row.revenue))}`}
                      className="w-3 rounded-t bg-emerald-500 transition-all hover:bg-emerald-600"
                      style={{ height: `${Math.max(row.revenueHeight, 3)}%` }}
                    />
                    <div
                      title={`Expenses: ${formatCurrency(numberValue(row.expenses))}`}
                      className="w-3 rounded-t bg-amber-400 transition-all hover:bg-amber-500"
                      style={{ height: `${Math.max(row.expensesHeight, 3)}%` }}
                    />
                    <div
                      title={`Profit: ${formatCurrency(numberValue(row.profit))}`}
                      className="w-3 rounded-t bg-rose-500 transition-all hover:bg-rose-600"
                      style={{ height: `${Math.max(row.profitHeight, 3)}%` }}
                    />
                  </div>
                  <span className="max-w-[72px] truncate text-center text-[11px] text-slate-500">
                    {displayPeriod(row)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyReportState />
          )}
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">Profit composition</h2>
            <p className="mt-1 text-sm text-slate-500">
              How current revenue is allocated across costs and profit.
            </p>
          </div>
          <div className="space-y-5">
            <CompositionRow
              label="Net profit"
              amount={totals.profit}
              total={totals.revenue}
              color="bg-rose-500"
            />
            <CompositionRow
              label="Expenses"
              amount={totals.expenses}
              total={totals.revenue}
              color="bg-amber-400"
            />
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-600">Current margin</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatPercent(totals.margin)}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-rose-500 transition-all"
                  style={{ width: `${Math.min(Math.max(totals.margin, 0), 100)}%` }}
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200/80 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Period breakdown</h2>
            <p className="mt-1 text-sm text-slate-500">
              Detailed profitability results from the report.
            </p>
          </div>
          <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {visibleRows.length} periods
          </span>
        </div>

        {visibleRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-semibold">Period</th>
                  <th className="px-6 py-4 text-right font-semibold">Revenue</th>
                  <th className="px-6 py-4 text-right font-semibold">Expenses</th>
                  <th className="px-6 py-4 text-right font-semibold">Net profit</th>
                  <th className="px-6 py-4 text-right font-semibold">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((row, index) => (
                  <tr key={`${displayPeriod(row)}-${row.id || index}`} className="hover:bg-slate-50/70">
                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                      {displayPeriod(row)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm text-slate-700">
                      {formatCurrency(numberValue(row.revenue))}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm text-slate-700">
                      {formatCurrency(numberValue(row.expenses))}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm font-semibold text-slate-900">
                      {formatCurrency(numberValue(row.profit))}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 font-mono text-xs font-semibold text-emerald-700">
                        {formatPercent(
                          typeof row.margin === 'number'
                            ? row.margin
                            : numberValue(row.revenue) > 0
                              ? (numberValue(row.profit) / numberValue(row.revenue)) * 100
                              : 0,
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyReportState />
        )}
      </section>

      {toast ? (
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
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  tone: 'emerald' | 'amber' | 'rose' | 'blue';
}) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-slate-300">
      <div className="mb-5 flex items-start justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <span className={`rounded-lg border p-2.5 ${tones[tone]}`}>{icon}</span>
      </div>
      <div className="font-mono text-2xl font-bold tracking-tight text-slate-900">{value}</div>
      <p className="mt-2 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function CompositionRow({
  label,
  amount,
  total,
  color,
}: {
  label: string;
  amount: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? Math.min(Math.max((amount / total) * 100, 0), 100) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-mono font-semibold text-slate-900">{formatCurrency(amount)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function EmptyReportState() {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 rounded-full bg-slate-100 p-3">
        <BarChart3 className="h-6 w-6 text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-800">No report data available</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        Profitability data will appear here once the report contains completed periods.
      </p>
    </div>
  );
}