import type { Expense } from '../types';
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { formatCurrency } from '../lib/currency';
import { ROUTES } from '../routes';
import { useNavigate } from 'react-router-dom';
import { Select } from '../components';
import { AlertCircle, ArrowLeft, BarChart3, Calendar, CheckCircle2, ChevronRight, DollarSign, Download, Filter, RefreshCw, Search, X, XCircle, Printer } from 'lucide-react';
import { DateRangeFilter } from '../components/DateRangeFilter';

type ToastType = 'success' | 'error' | 'info';
type Period = '30' | '90' | '365' | 'custom';

interface ToastState {
  message: string;
  type: ToastType;
}

function formatDate(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getInitials(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function escapeCsv(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

import { useExpenseReport } from '../hooks';

export default function ExpenseReportPage() {
  const navigate = useNavigate();
  const { data: expenses, loading, error, refresh } = useExpenseReport();
  const [period, setPeriod] = useState<Period>('30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [category, setCategory] = useState('All categories');
  const [search, setSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  const loadReport = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
      showToast('Expense report refreshed.', 'info');
    } catch {
      showToast('Failed to refresh expense report.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const periodExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const date = new Date(expense.expenseDate);
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
        const days = Number(period) || 30;
        const threshold = new Date();
        threshold.setHours(0, 0, 0, 0);
        threshold.setDate(threshold.getDate() - days);
        return date >= threshold;
      }
      return true;
    });
  }, [expenses, period, startDate, endDate]);

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        periodExpenses
          .map((expense) => String(expense.category || '').trim())
          .filter(Boolean),
      ),
    ).sort();
  }, [periodExpenses]);

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return periodExpenses
      .filter((expense) => {
        const matchesCategory =
          category === 'All categories' ||
          String(expense.category || '') === category;
        const searchable = [
          expense.description,
          expense.category,
          expense.vendor,
          expense.notes,
        ]
          .map((value) => String(value || '').toLowerCase())
          .join(' ');

        return matchesCategory && (!query || searchable.includes(query));
      })
      .sort(
        (first, second) =>
          new Date(second.expenseDate).getTime() -
          new Date(first.expenseDate).getTime(),
      );
  }, [category, periodExpenses, search]);

  const totalAmount = useMemo(
    () =>
      periodExpenses.reduce(
        (total, expense) => total + Number(expense.amount || 0),
        0,
      ),
    [periodExpenses],
  );

  const averageAmount =
    periodExpenses.length > 0 ? totalAmount / periodExpenses.length : 0;

  const highestCategory = useMemo(() => {
    const totals = periodExpenses.reduce<Record<string, number>>(
      (result, expense) => {
        const key = String(expense.category || 'Uncategorized');
        result[key] = (result[key] || 0) + Number(expense.amount || 0);
        return result;
      },
      {},
    );

    return (Object.entries(totals) as [string, number][]).sort(
      (first, second) => second[1] - first[1],
    )[0];
  }, [periodExpenses]);

  const categoryBreakdown = useMemo(() => {
    const totals = periodExpenses.reduce<Record<string, number>>(
      (result, expense) => {
        const key = String(expense.category || 'Uncategorized');
        result[key] = (result[key] || 0) + Number(expense.amount || 0);
        return result;
      },
      {},
    );

    return (Object.entries(totals) as [string, number][])
      .sort((first, second) => second[1] - first[1])
      .slice(0, 5);
  }, [periodExpenses]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    void loadReport();
  };

  const handleExport = () => {
    if (filteredExpenses.length === 0) {
      showToast('There are no expenses to export.', 'info');
      return;
    }

    const rows = [
      ['Description', 'Category', 'Vendor', 'Date', 'Amount'],
      ...filteredExpenses.map((expense) => [
        expense.description || '',
        expense.category || '',
        expense.vendor || '',
        expense.expenseDate || '',
        Number(expense.amount || 0),
      ]),
    ];

    const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `expense-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    showToast('Expense report exported successfully.');
  };

  const renderToastIcon = () => {
    if (toast?.type === 'success') return <CheckCircle2 size={18} />;
    if (toast?.type === 'error') return <XCircle size={18} />;
    return <AlertCircle size={18} />;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate(ROUTES.SCREEN_RECURRING_INVOICES)}
              className="mb-4 inline-flex min-h-[40px] items-center gap-2 rounded-lg text-sm font-medium text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeft size={16} />
              Back to recurring invoices
            </button>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
                <BarChart3 size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Expense Report
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Monitor spending patterns and keep operating costs visible.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={isRefreshing ? 'animate-spin' : ''}
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 cursor-pointer"
            >
              <Download size={16} />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 cursor-pointer"
            >
              <Printer size={16} />
              Export PDF
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Calendar size={16} className="text-slate-400" />
              Reporting period
            </span>
            <div className='flex justify-end align-items-end'>
  <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onChange={(start, end) => {
                setStartDate(start);
                setEndDate(end);
                if (start || end) {
                  setPeriod('custom');
                } else {
                  setPeriod('30');
                }
              }}
              align="right"
              placeholder="Select Date Range"
            />
            </div>
          
          </div>

          <div className="w-full md:w-64">
            <Select
              value={category}
              onChange={(val) => setCategory(val)}
              searchable
              options={[
                { value: 'All categories', label: 'All categories' },
                ...categories.map((item) => ({
                  value: item,
                  label: item,
                })),
              ]}
            />
          </div>
        </div>

        {error ? (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            <span className="flex items-center gap-2">
              <AlertCircle size={18} />
              {error}
            </span>
            <button
              type="button"
              onClick={handleRefresh}
              className="min-h-[40px] rounded-lg bg-white px-3 font-semibold text-red-700 shadow-sm"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Total expenses"
                value={formatCurrency(totalAmount)}
                detail={`${periodExpenses.length} recorded items`}
                icon={<DollarSign size={18} />}
              />
              <MetricCard
                label="Average expense"
                value={formatCurrency(averageAmount)}
                detail="Per recorded item"
                icon={<BarChart3 size={18} />}
              />
              <MetricCard
                label="Top category"
                value={highestCategory?.[0] || '—'}
                detail={
                  highestCategory
                    ? formatCurrency(highestCategory[1])
                    : 'No category data'
                }
                icon={<Filter size={18} />}
                compact
              />
              <MetricCard
                label="Report status"
                value={loading ? 'Loading' : 'Up to date'}
                detail={loading ? 'Fetching latest data' : 'Live report data'}
                icon={<CheckCircle2 size={18} />}
                compact
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm lg:col-span-1">
                <div className="mb-5">
                  <h2 className="text-base font-bold text-slate-900">
                    Spending by category
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Largest contributors in the selected period.
                  </p>
                </div>
                {categoryBreakdown.length === 0 ? (
                  <EmptyState compact message="No category data available." />
                ) : (
                  <div className="space-y-5">
                    {categoryBreakdown.map(([name, amount]) => {
                      const percentage =
                        totalAmount > 0 ? (amount / totalAmount) * 100 : 0;
                      return (
                        <div key={name}>
                          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                            <span className="truncate font-medium text-slate-700">
                              {name}
                            </span>
                            <span className="font-mono text-slate-500">
                              {formatCurrency(amount)}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-rose-500 transition-all"
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm lg:col-span-2">
                <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Expense activity
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Review individual transactions in the selected period.
                    </p>
                  </div>
                  <div className="relative sm:w-64">
                    <Search
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search expenses"
                      className="min-h-[40px] w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    />
                  </div>
                </div>

                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((item) => (
                      <div
                        key={item}
                        className="h-16 animate-pulse rounded-xl bg-slate-100"
                      />
                    ))}
                  </div>
                ) : filteredExpenses.length === 0 ? (
                  <EmptyState
                    message={
                      expenses.length === 0
                        ? 'No expenses have been recorded for this report yet.'
                        : 'No expenses match the current filters.'
                    }
                    action={
                      expenses.length > 0
                        ? {
                            label: 'Reset filters',
                            onClick: () => {
                              setSearch('');
                              setCategory('All categories');
                            },
                          }
                        : undefined
                    }
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                          <th className="pb-3 pr-4 font-semibold">Expense</th>
                          <th className="pb-3 pr-4 font-semibold">Category</th>
                          <th className="pb-3 pr-4 font-semibold">Date</th>
                          <th className="pb-3 pr-4 text-right font-semibold">
                            Amount
                          </th>
                          <th className="pb-3 text-right font-semibold">
                            Details
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredExpenses.map((expense) => (
                          <tr
                            key={expense.id}
                            className="group transition hover:bg-slate-50"
                          >
                            <td className="py-4 pr-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                                  {getInitials(
                                    expense.description || 'Expense',
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-800">
                                    {expense.description || 'Unnamed expense'}
                                  </p>
                                  <p className="truncate text-xs text-slate-500">
                                    {expense.vendor || 'No vendor specified'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 pr-4 text-sm text-slate-600">
                              {expense.category || 'Uncategorized'}
                            </td>
                            <td className="py-4 pr-4 text-sm text-slate-500">
                              {formatDate(expense.expenseDate)}
                            </td>
                            <td className="py-4 pr-4 text-right font-mono text-sm font-semibold text-slate-900">
                              {formatCurrency(Number(expense.amount || 0))}
                            </td>
                            <td className="py-4 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedExpense(expense)}
                                className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                              >
                                View
                                <ChevronRight size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>

      {selectedExpense && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setSelectedExpense(null)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="expense-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedExpense(null)}
              className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close expense details"
            >
              <X size={18} />
            </button>
            <div className="mb-6 pr-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-rose-600">
                Expense detail
              </p>
              <h2
                id="expense-detail-title"
                className="text-xl font-bold text-slate-900"
              >
                {selectedExpense.description || 'Unnamed expense'}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <DetailItem
                label="Amount"
                value={formatCurrency(Number(selectedExpense.amount || 0))}
              />
              <DetailItem
                label="Date"
                value={formatDate(selectedExpense.expenseDate)}
              />
              <DetailItem
                label="Category"
                value={selectedExpense.category || 'Uncategorized'}
              />
              <DetailItem
                label="Vendor"
                value={selectedExpense.vendor || 'Not specified'}
              />
            </div>
            {selectedExpense.notes && (
              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Notes
                </p>
                <p className="text-sm leading-6 text-slate-600">
                  {selectedExpense.notes}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setSelectedExpense(null)}
              className="mt-6 min-h-[44px] w-full rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Close
            </button>
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
          {renderToastIcon()}
          {toast.message}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  compact = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm transition hover:border-slate-300">
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        <span className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-slate-600">
          {icon}
        </span>
      </div>
      <p
        className={`truncate font-bold tracking-tight text-slate-900 ${
          compact ? 'text-xl' : 'font-mono text-2xl'
        }`}
      >
        {value}
      </p>
      <p className="mt-2 truncate text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="break-words text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function EmptyState({
  message,
  compact = false,
  action,
}: {
  message: string;
  compact?: boolean;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center ${
        compact ? 'min-h-[180px] p-5' : 'min-h-[260px] p-8'
      }`}
    >
      <div className="mb-3 rounded-full bg-white p-3 text-slate-400 shadow-sm">
        <BarChart3 size={20} />
      </div>
      <p className="max-w-sm text-sm text-slate-500">{message}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 min-h-[40px] rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}