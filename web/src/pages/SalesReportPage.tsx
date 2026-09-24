import type { Invoice } from '../types';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { formatCurrency } from '../lib/currency';
import { ROUTES } from '../routes';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, BarChart3, Calendar, CheckCircle2, Download, Eye, FileText, RefreshCw, Search, X, XCircle, Printer } from 'lucide-react';
import { DateRangeFilter } from '../components/DateRangeFilter';

type ToastType = 'success' | 'error' | 'info';

type ToastState = {
  message: string;
  type: ToastType;
} | null;

type DateRange = '30' | '90' | '365' | 'custom';

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getStatusClasses(status: string | undefined): string {
  const normalized = String(status || '').toLowerCase();

  if (normalized.includes('paid') || normalized.includes('complete')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

  if (normalized.includes('cancel') || normalized.includes('void')) {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }

  if (normalized.includes('overdue')) {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }

  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function getStatusDot(status: string | undefined): string {
  const normalized = String(status || '').toLowerCase();

  if (normalized.includes('paid') || normalized.includes('complete')) {
    return 'bg-emerald-500';
  }

  if (normalized.includes('cancel') || normalized.includes('void')) {
    return 'bg-rose-500';
  }

  if (normalized.includes('overdue')) {
    return 'bg-amber-500';
  }

  return 'bg-slate-400';
}

function getInvoiceStatus(invoice: Invoice): string {
  return String(invoice.status || 'Pending');
}

import { useSalesReport } from '../hooks';

export default function SalesReportPage() {
  const navigate = useNavigate();
  const { data: invoices, loading: isLoading, error, refresh } = useSalesReport();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('30');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  const loadReport = async (showRefreshState = false) => {
    if (showRefreshState) setIsRefreshing(true);
    try {
      await refresh();
      if (showRefreshState) showToast('Sales report refreshed.', 'info');
    } catch {
      showToast('Failed to refresh sales report.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = new Date();
    const rangeDays = Number(dateRange) || 30;
    const earliestDate = new Date(now);
    earliestDate.setDate(now.getDate() - rangeDays);

    return invoices
      .filter((invoice) => {
        if (!query) return true;
        return [
          invoice.invoiceNumber,
          invoice.status,
          String(invoice.clientId),
        ].some((value) => String(value || '').toLowerCase().includes(query));
      })
      .filter((invoice) => {
        const issueDate = new Date(invoice.issueDate);
        if (Number.isNaN(issueDate.getTime())) return true;
        if (startDate) {
          const s = new Date(startDate);
          if (issueDate < s) return false;
        }
        if (endDate) {
          const e = new Date(`${endDate}T23:59:59.999`);
          if (issueDate > e) return false;
        }
        if (!startDate && !endDate) {
          return issueDate >= earliestDate;
        }
        return true;
      })
      .sort(
        (first, second) =>
          new Date(second.issueDate).getTime() -
          new Date(first.issueDate).getTime(),
      );
  }, [dateRange, startDate, endDate, invoices, search]);

  const metrics = useMemo(() => {
    const totalSales = filteredInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.totalAmount || 0),
      0,
    );
    const collected = filteredInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.amountPaid || 0),
      0,
    );
    const outstanding = Math.max(totalSales - collected, 0);
    const average = filteredInvoices.length
      ? totalSales / filteredInvoices.length
      : 0;

    return {
      totalSales,
      collected,
      outstanding,
      average,
      count: filteredInvoices.length,
    };
  }, [filteredInvoices]);

  const chartData = useMemo(() => {
    const buckets = new Map<string, number>();

    filteredInvoices.forEach((invoice) => {
      const date = new Date(invoice.issueDate);
      if (Number.isNaN(date.getTime())) return;
      const key = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      buckets.set(
        key,
        Number(buckets.get(key) || 0) + Number(invoice.totalAmount || 0),
      );
    });

    return Array.from(buckets.entries()).slice(-7);
  }, [filteredInvoices]);

  const chartMax = Math.max(...chartData.map(([, value]) => value), 1);

  const handleExport = () => {
    if (!filteredInvoices.length) {
      showToast('There is no report data to export.', 'info');
      return;
    }

    const header = [
      'Invoice Number',
      'Client ID',
      'Issue Date',
      'Due Date',
      'Status',
      'Total Amount',
      'Amount Paid',
    ];

    const rows = filteredInvoices.map((invoice) => [
      invoice.invoiceNumber,
      invoice.clientId,
      invoice.issueDate,
      invoice.dueDate,
      getInvoiceStatus(invoice),
      invoice.totalAmount,
      invoice.amountPaid,
    ]);

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sales-report.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Sales report exported successfully.');
  };

  function setPeriod(arg0: string) {
    throw new Error('Function not implemented.');
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-start">
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
                  Sales Report
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Review invoice performance, collections, and outstanding sales.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void loadReport(true)}
              disabled={isRefreshing}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
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
        

        {error ? (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} />
              <p className="text-sm font-medium">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadReport()}
              className="min-h-[40px] rounded-lg bg-white px-3 text-sm font-semibold text-rose-700 shadow-sm"
            >
              Retry
            </button>
          </div>
        ) : null}
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


        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: 'Total sales',
              value: formatCurrency(metrics.totalSales),
              icon: BarChart3,
            },
            {
              label: 'Collected',
              value: formatCurrency(metrics.collected),
              icon: CheckCircle2,
            },
            {
              label: 'Outstanding',
              value: formatCurrency(metrics.outstanding),
              icon: Calendar,
            },
            {
              label: 'Average invoice',
              value: formatCurrency(metrics.average),
              icon: FileText,
            },
          ].map((metric) => {
            const MetricIcon = metric.icon;
            return (
              <div
                key={metric.label}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-slate-300"
              >
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {metric.label}
                  </span>
                  <span className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-slate-600">
                    <MetricIcon size={18} />
                  </span>
                </div>
                <p className="font-mono text-2xl font-bold tracking-tight text-slate-900">
                  {isLoading ? '—' : metric.value}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Based on the selected reporting period
                </p>
              </div>
            );
          })}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Sales activity
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Daily invoice value across the selected period.
                </p>
              </div>
             
            </div>

            {chartData.length ? (
              <div className="flex h-56 items-end gap-3 border-b border-l border-slate-200 px-3 pb-2 pt-5">
                {chartData.map(([label, value]) => (
                  <div
                    key={label}
                    className="group flex h-full flex-1 flex-col items-center justify-end gap-2"
                  >
                    <div className="relative flex w-full flex-1 items-end justify-center">
                      <div className="absolute bottom-full mb-2 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white group-hover:block">
                        {formatCurrency(value)}
                      </div>
                      <div
                        className="w-full max-w-12 rounded-t-lg bg-rose-500 transition hover:bg-rose-600"
                        style={{
                          height: `${Math.max((value / chartMax) * 100, 5)}%`,
                        }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-400">{label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                No sales activity for this period.
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-slate-900">Report summary</h2>
              <p className="mt-1 text-sm text-slate-500">
                A quick view of the current sales data.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <span className="text-sm text-slate-500">Invoices included</span>
                <span className="font-mono text-sm font-semibold text-slate-900">
                  {metrics.count}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <span className="text-sm text-slate-500">Collection rate</span>
                <span className="font-mono text-sm font-semibold text-emerald-600">
                  {metrics.totalSales
                    ? `${Math.round((metrics.collected / metrics.totalSales) * 100)}%`
                    : '0%'}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <span className="text-sm text-slate-500">Reporting window</span>
                <span className="text-sm font-semibold text-slate-900">
                  {dateRange === '365' ? '12 months' : `${dateRange} days`}
                </span>
              </div>
              <div className="rounded-xl bg-rose-50 p-4">
                <div className="flex items-start gap-3">
                  <Calendar className="mt-0.5 text-amber-600" size={18} />
                  <p className="text-sm leading-6 text-rose-800">
                    Sales are calculated from invoice totals and filtered by issue date.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Invoice performance
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {filteredInvoices.length} invoice
                {filteredInvoices.length === 1 ? '' : 's'} in this view
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search invoice or client ID"
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">
              <RefreshCw size={18} className="mr-2 animate-spin" />
              Loading sales report…
            </div>
          ) : filteredInvoices.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    {['Invoice', 'Issue date', 'Due date', 'Total', 'Collected', 'Status', ''].map(
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
                  {filteredInvoices.map((invoice) => {
                    const status = getInvoiceStatus(invoice);
                    return (
                      <tr key={invoice.id} className="transition hover:bg-slate-50/70">
                        <td className="px-5 py-4">
                          <p className="font-mono text-sm font-semibold text-slate-900">
                            {invoice.invoiceNumber || `INV-${invoice.id}`}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Client ID {invoice.clientId}
                          </p>
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
                        <td className="px-5 py-4 font-mono text-sm text-slate-600">
                          {formatCurrency(Number(invoice.amountPaid || 0))}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                              status,
                            )}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${getStatusDot(status)}`}
                            />
                            {status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedInvoice(invoice)}
                            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
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
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-500">
                <FileText size={22} />
              </div>
              <h3 className="font-semibold text-slate-900">No invoices found</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Adjust your search or reporting period to see sales activity.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setDateRange('365');
                }}
                className="mt-4 min-h-[40px] rounded-lg bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Reset filters
              </button>
            </div>
          )}
        </section>
      </div>

      {selectedInvoice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setSelectedInvoice(null)}
              className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close invoice details"
            >
              <X size={18} />
            </button>
            <div className="mb-6 pr-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">
                Invoice details
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                {selectedInvoice.invoiceNumber || `INV-${selectedInvoice.id}`}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Client ID</p>
                <p className="mt-1 font-mono text-sm font-semibold text-slate-900">
                  {selectedInvoice.clientId}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Status</p>
                <p className="mt-1 text-sm font-semibold capitalize text-slate-900">
                  {getInvoiceStatus(selectedInvoice)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Issue date</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatDate(selectedInvoice.issueDate)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Due date</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatDate(selectedInvoice.dueDate)}
                </p>
              </div>
              <div className="rounded-xl bg-rose-50 p-4">
                <p className="text-xs text-rose-600">Invoice total</p>
                <p className="mt-1 font-mono text-lg font-bold text-rose-700">
                  {formatCurrency(Number(selectedInvoice.totalAmount || 0))}
                </p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-xs text-emerald-600">Amount collected</p>
                <p className="mt-1 font-mono text-lg font-bold text-emerald-700">
                  {formatCurrency(Number(selectedInvoice.amountPaid || 0))}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedInvoice(null)}
              className="mt-6 min-h-[44px] w-full rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Close details
            </button>
          </div>
        </div>
      ) : null}

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
            <CheckCircle2 size={18} />
          ) : toast.type === 'error' ? (
            <XCircle size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}