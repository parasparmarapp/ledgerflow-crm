import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { formatCurrency } from '../lib/currency';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  FileText,
  CreditCard,
  Users,
  Plus,
  ArrowRight,
  Package,
  CheckCircle2,
  Calendar,
  RefreshCw,
  AlertCircle,
  Shield,
  Layers,
} from 'lucide-react';

interface AgingBucket {
  count: number;
  total: number;
}

interface LowStockItem {
  id: number;
  productId: number;
  name: string;
  sku: string | null;
  quantityOnHand: number;
  reorderThreshold: number;
  unitCost: number;
}

interface RecentInvoice {
  id: number;
  invoiceNumber: string;
  clientName: string;
  clientId: number;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  balanceDue: number;
  status: string;
}

interface RecentPayment {
  id: number;
  receiptNumber: string;
  clientName: string;
  clientId: number;
  invoiceNumber?: string;
  paymentDate: string;
  amount: number;
  method: string;
  status: string;
}

interface DashboardSummary {
  role: string;
  isAdmin: boolean;
  financials: {
    totalSales: number;
    invoicesCount: number;
    cashCollected: number;
    paymentsCount: number;
    totalOutstanding: number;
    totalOverdue: number;
    activeClientsCount: number;
  };
  aging: {
    current: AgingBucket;
    days31to60: AgingBucket;
    days61to90: AgingBucket;
    days90plus: AgingBucket;
  };
  lowStockItems: LowStockItem[];
  recentInvoices: RecentInvoice[];
  recentPayments: RecentPayment[];
}

function formatDate(val?: string) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'all' | '30d' | 'this_month'>('all');

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      const now = new Date();
      if (timeRange === '30d') {
        const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        params.from = from.toISOString();
      } else if (timeRange === 'this_month') {
        const from = new Date(now.getFullYear(), now.getMonth(), 1);
        params.from = from.toISOString();
      }

      const res = await api.get<DashboardSummary>('/dashboard/summary', { params });
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard summary.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [timeRange]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200 mb-6" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="h-64 animate-pulse rounded-2xl bg-slate-200 lg:col-span-2" />
            <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-900">
          <AlertCircle className="h-10 w-10 text-rose-600 mx-auto mb-3" />
          <h2 className="text-lg font-bold">Unable to load dashboard</h2>
          <p className="mt-1 text-sm text-rose-700">{error || 'An unexpected error occurred.'}</p>
          <button
            type="button"
            onClick={fetchDashboard}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { isAdmin, financials, aging, lowStockItems, recentInvoices, recentPayments } = data;
  const totalAgingAmount =
    aging.current.total + aging.days31to60.total + aging.days61to90.total + aging.days90plus.total;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header & Filter */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isAdmin
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-indigo-100 text-indigo-800'
                }`}
              >
                <Shield className="h-3 w-3" />
                {isAdmin ? 'Executive / Admin View' : 'Operations / Staff View'}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Business Overview
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Live financial positions, receivables aging, inventory alerts, and transaction flow.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              {(
                [
                  { id: 'all', label: 'All Time' },
                  { id: 'this_month', label: 'This Month' },
                  { id: '30d', label: 'Last 30 Days' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTimeRange(t.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    timeRange === t.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={fetchDashboard}
              title="Refresh Dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 shadow-sm"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Quick Action Bar */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link
            to="/create-invoice"
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-rose-300 hover:shadow-md group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-sm font-bold text-slate-900">New Invoice</span>
              <span className="block text-xs text-slate-500">Draft & Issue</span>
            </div>
          </Link>

          <Link
            to="/payments"
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-sm font-bold text-slate-900">Payments</span>
              <span className="block text-xs text-slate-500">Record & Receipts</span>
            </div>
          </Link>

          <Link
            to="/create-client"
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-sm font-bold text-slate-900">Add Client</span>
              <span className="block text-xs text-slate-500">Create profile</span>
            </div>
          </Link>

          <Link
            to="/inventory"
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-amber-300 hover:shadow-md group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-sm font-bold text-slate-900">Inventory</span>
              <span className="block text-xs text-slate-500">Stock & Alerts</span>
            </div>
          </Link>
        </div>

        {/* PRIMARY KPIS */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isAdmin ? (
            <>
              {/* Total Sales */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Total Invoiced
                  </span>
                  <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                    <FileText className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-2.5 text-xl font-bold tracking-tight text-slate-900">
                  {formatCurrency(financials.totalSales)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {financials.invoicesCount} issued invoices in period
                </p>
              </div>

              {/* Cash Collected */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Cash Collected
                  </span>
                  <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-2.5 text-xl font-bold tracking-tight text-emerald-700">
                  {formatCurrency(financials.cashCollected)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {financials.paymentsCount} completed receipts
                </p>
              </div>

              {/* Outstanding Receivables */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Total Outstanding
                  </span>
                  <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                    <DollarSign className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-2.5 text-xl font-bold tracking-tight text-slate-900">
                  {formatCurrency(financials.totalOutstanding)}
                </p>
                <p className="mt-1 text-xs text-slate-400">Uncollected balances</p>
              </div>

              {/* Overdue Amount */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Overdue Receivables
                  </span>
                  <div className="rounded-xl bg-rose-50 p-2 text-rose-600">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                </div>
                <p
                  className={`mt-2.5 text-xl font-bold tracking-tight ${
                    financials.totalOverdue > 0 ? 'text-rose-600' : 'text-slate-900'
                  }`}
                >
                  {formatCurrency(financials.totalOverdue)}
                </p>
                <p className="mt-1 text-xs text-slate-400">Past due date</p>
              </div>
            </>
          ) : (
            <>
              {/* Staff View */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Active Clients
                  </span>
                  <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                    <Users className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-2.5 text-xl font-bold tracking-tight text-slate-900">
                  {financials.activeClientsCount}
                </p>
                <p className="mt-1 text-xs text-slate-400">Registered CRM client accounts</p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Invoices Issued
                  </span>
                  <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                    <FileText className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-2.5 text-xl font-bold tracking-tight text-slate-900">
                  {financials.invoicesCount}
                </p>
                <p className="mt-1 text-xs text-slate-400">Total active billing cycles</p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Overdue Invoices
                  </span>
                  <div className="rounded-xl bg-rose-50 p-2 text-rose-600">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                </div>
                <p
                  className={`mt-2.5 text-xl font-bold tracking-tight ${
                    financials.totalOverdue > 0 ? 'text-rose-600' : 'text-slate-900'
                  }`}
                >
                  {formatCurrency(financials.totalOverdue)}
                </p>
                <p className="mt-1 text-xs text-slate-400">Require payment follow-up</p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Low Stock Alerts
                  </span>
                  <div className="rounded-xl bg-amber-50 p-2 text-amber-600">
                    <Package className="h-5 w-5" />
                  </div>
                </div>
                <p
                  className={`mt-2.5 text-xl font-bold tracking-tight ${
                    lowStockItems.length > 0 ? 'text-amber-600' : 'text-slate-900'
                  }`}
                >
                  {lowStockItems.length}
                </p>
                <p className="mt-1 text-xs text-slate-400">Items below reorder point</p>
              </div>
            </>
          )}
        </div>

        {/* OVERDUE AGING ANALYSIS & LOW STOCK ALERT */}
        <div className="mb-8 grid gap-6 lg:grid-cols-3">
          {/* Overdue Aging Analysis */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Receivables Aging Breakdown
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Unpaid balances grouped by overdue duration.
                </p>
              </div>
              <span className="text-sm font-bold text-slate-900">
                Total: {formatCurrency(totalAgingAmount)}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              {[
                {
                  label: 'Current (0–30d)',
                  data: aging.current,
                  color: 'bg-emerald-500',
                  bg: 'bg-emerald-50',
                  text: 'text-emerald-800',
                },
                {
                  label: '31–60 Days',
                  data: aging.days31to60,
                  color: 'bg-blue-500',
                  bg: 'bg-blue-50',
                  text: 'text-blue-800',
                },
                {
                  label: '61–90 Days',
                  data: aging.days61to90,
                  color: 'bg-amber-500',
                  bg: 'bg-amber-50',
                  text: 'text-amber-800',
                },
                {
                  label: '90+ Days',
                  data: aging.days90plus,
                  color: 'bg-rose-500',
                  bg: 'bg-rose-50',
                  text: 'text-rose-800',
                },
              ].map((bucket) => {
                const percent =
                  totalAgingAmount > 0
                    ? Math.round((bucket.data.total / totalAgingAmount) * 100)
                    : 0;

                return (
                  <div
                    key={bucket.label}
                    className={`rounded-xl border border-slate-100 p-4 ${bucket.bg}`}
                  >
                    <span className="text-xs font-semibold text-slate-600 block">
                      {bucket.label}
                    </span>
                    <p className={`mt-1.5 text-base font-bold tracking-tight ${bucket.text}`}>
                      {formatCurrency(bucket.data.total)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {bucket.data.count} invoice{bucket.data.count === 1 ? '' : 's'} ({percent}%)
                    </p>
                    <div className="mt-3 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full ${bucket.color}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Low Stock Alerts Widget */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-amber-500" />
                <h2 className="text-base font-bold text-slate-900">Low Stock Alert</h2>
              </div>
              <Link
                to="/inventory"
                className="text-xs font-semibold text-rose-600 hover:text-rose-800"
              >
                View all &rarr;
              </Link>
            </div>

            {lowStockItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                <p className="text-sm font-semibold text-slate-900">All stock levels healthy</p>
                <p className="text-xs text-slate-400 mt-0.5">No products below reorder point.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockItems.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/60 p-3"
                  >
                    <div>
                      <span className="block text-xs font-bold text-slate-900">{item.name}</span>
                      <span className="block text-[11px] text-slate-500 font-mono">
                        {item.sku || 'No SKU'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">
                        {item.quantityOnHand} left
                      </span>
                      <span className="block text-[10px] text-slate-500 mt-0.5">
                        Min: {item.reorderThreshold}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RECENT INVOICES & PAYMENTS */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Invoices */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Recent Invoices</h2>
                <p className="text-xs text-slate-500">Latest client billing records</p>
              </div>
              <Link
                to="/invoices"
                className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1"
              >
                All Invoices <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {recentInvoices.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No invoices yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-4 hover:bg-slate-50/80 transition"
                  >
                    <div>
                      <Link
                        to={`/invoice-details?id=${inv.id}`}
                        className="text-sm font-bold text-slate-900 hover:text-rose-600"
                      >
                        {inv.invoiceNumber}
                      </Link>
                      <div className="text-xs text-slate-500 mt-0.5">
                        <Link to={`/client-profile?id=${inv.clientId}`} className="hover:underline">
                          {inv.clientName}
                        </Link>{' '}
                        • Due {formatDate(inv.dueDate)}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="block text-sm font-bold text-slate-900">
                        {formatCurrency(inv.totalAmount)}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize mt-1 ${
                          inv.status === 'paid'
                            ? 'bg-emerald-50 text-emerald-700'
                            : inv.status === 'overdue'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Payments */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Recent Collections</h2>
                <p className="text-xs text-slate-500">Latest completed payment receipts</p>
              </div>
              <Link
                to="/payments"
                className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1"
              >
                All Payments <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {recentPayments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No payments yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentPayments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-4 hover:bg-slate-50/80 transition"
                  >
                    <div>
                      <Link
                        to={`/payments?id=${p.id}`}
                        className="text-sm font-bold text-slate-900 hover:text-rose-600"
                      >
                        {p.receiptNumber}
                      </Link>
                      <div className="text-xs text-slate-500 mt-0.5">
                        <Link to={`/client-profile?id=${p.clientId}`} className="hover:underline">
                          {p.clientName}
                        </Link>{' '}
                        • {p.method} • {formatDate(p.paymentDate)}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="block text-sm font-bold text-emerald-700">
                        {formatCurrency(p.amount)}
                      </span>
                      <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 capitalize mt-1">
                        {p.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
