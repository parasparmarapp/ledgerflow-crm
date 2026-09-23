import type { Expense } from '../types';
import { useMemo, useState } from 'react';
import { useExpenses } from '../hooks';
import { formatCurrency } from '../lib/currency';
import { ROUTES } from '../routes';
import { useNavigate } from 'react-router-dom';
import { Select, DateRangeFilter, TablePagination } from '../components';
import { AlertCircle, BarChart3, Calendar, CheckCircle2, ChevronRight, Download, Eye, FileText, Filter, Plus, RefreshCw, Search, Trash2, X, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

type ToastState = {
  message: string;
  type: ToastType;
} | null;

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

function getInitials(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export default function ExpenseListPage() {
  const navigate = useNavigate();
  const { data, loading, error, refresh, remove } = useExpenses();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All categories');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  const handleDateRangeChange = (from: string, to: string) => {
    setStartDate(from);
    setEndDate(to);
    setPage(1);
    refresh({ from: from || undefined, to: to || undefined });
  };

  const expenses = Array.isArray(data) ? data : [];

  const categories = useMemo(() => {
    const values = expenses
      .map((expense) => String(expense?.category || '').trim())
      .filter(Boolean);
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return expenses.filter((expense) => {
      const description = String(expense?.description || '').toLowerCase();
      const category = String(expense?.category || '').toLowerCase();
      const vendor = String(expense?.vendor || '').toLowerCase();
      const matchesSearch =
        !query ||
        description.includes(query) ||
        category.includes(query) ||
        vendor.includes(query) ||
        String(expense?.id || '').includes(query);

      const matchesCategory =
        categoryFilter === 'All categories' ||
        String(expense?.category || '') === categoryFilter;

      const expenseDateStr = expense?.expenseDate ? String(expense.expenseDate).slice(0, 10) : '';
      const matchesDate =
        (!startDate || (expenseDateStr && expenseDateStr >= startDate)) &&
        (!endDate || (expenseDateStr && expenseDateStr <= endDate));

      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [categoryFilter, expenses, search, startDate, endDate]);

  const paginatedExpenses = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredExpenses.slice(start, start + PAGE_SIZE);
  }, [filteredExpenses, page]);

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, expense) => sum + Number(expense?.amount || 0), 0),
    [expenses],
  );

  const currentMonthTotal = useMemo(() => {
    const now = new Date();
    return expenses
      .filter((expense) => {
        const date = new Date(expense?.expenseDate || '');
        return (
          !Number.isNaN(date.getTime()) &&
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
        );
      })
      .reduce((sum, expense) => sum + Number(expense?.amount || 0), 0);
  }, [expenses]);

  const averageExpense = expenses.length > 0 ? totalExpenses / expenses.length : 0;

  const largestExpense = expenses.reduce<Expense | null>((largest, expense) => {
    if (!largest || Number(expense?.amount || 0) > Number(largest?.amount || 0)) {
      return expense;
    }
    return largest;
  }, null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
      showToast('Expenses refreshed successfully.', 'info');
    } catch {
      showToast('Unable to refresh expenses.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDelete = async () => {
    if (!expenseToDelete || typeof remove !== 'function') return;

    setIsDeleting(true);
    try {
      await remove(expenseToDelete.id);
      setExpenseToDelete(null);
      setSelectedExpense(null);
      showToast('Expense deleted successfully.');
    } catch {
      showToast('Failed to delete expense.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = () => {
    if (filteredExpenses.length === 0) {
      showToast('There are no expenses to export.', 'info');
      return;
    }

    const headers = ['ID', 'Description', 'Category', 'Vendor', 'Amount', 'Expense Date'];
    const rows = filteredExpenses.map((expense) => [
      expense.id,
      expense.description || '',
      expense.category || '',
      expense.vendor || '',
      Number(expense.amount || 0).toFixed(2),
      expense.expenseDate || '',
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ledgerflow-expenses.csv';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    showToast('Expense export downloaded.');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              Financial operations
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Expense List</h1>
            <p className="mt-1 text-sm text-slate-500">
              Review, search, and manage your business expenses in one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={isRefreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button
              type="button"
              onClick={() => navigate(ROUTES.CREATE_EXPENSE)}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
            >
              <Plus className="h-4 w-4" />
              Create expense
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total expenses
              </span>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-rose-600">
                <BarChart3 className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-4 font-mono text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(totalExpenses)}
            </p>
            <p className="mt-1 text-xs text-slate-500">{expenses.length} recorded entries</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                This month
              </span>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-indigo-600">
                <Calendar className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-4 font-mono text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(currentMonthTotal)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Based on expense date</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Average expense
              </span>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-emerald-600">
                <FileText className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-4 font-mono text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(averageExpense)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Across all recorded expenses</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Largest expense
              </span>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-amber-600">
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-4 font-mono text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(Number(largestExpense?.amount || 0))}
            </p>
            <p className="mt-1 truncate text-xs text-slate-500">
              {largestExpense?.description || 'No expense recorded'}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-200/80 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-slate-900">All expenses</h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {filteredExpenses.length}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Search by description, vendor, category, or expense ID.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="relative block">
                  <span className="sr-only">Search expenses</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search expenses..."
                    className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100 sm:w-64"
                  />
                </label>

                <div className="w-full sm:w-48">
                  <Select
                    value={categoryFilter}
                    onChange={(val) => {
                      setCategoryFilter(val);
                      setPage(1);
                    }}
                    options={[
                      { value: 'All categories', label: 'All categories' },
                      ...categories.map((category) => ({
                        value: category,
                        label: category,
                      })),
                    ]}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end border-t border-slate-100 pt-4">
              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onChange={handleDateRangeChange}
              />
            </div>
          </div>

          {loading ? (
            <div className="space-y-4 p-6">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="rounded-full bg-red-50 p-3 text-red-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">Could not load expenses</h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">{String(error)}</p>
              <button
                type="button"
                onClick={handleRefresh}
                className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="rounded-full bg-slate-100 p-3 text-slate-500">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-bold text-slate-900">
                {expenses.length === 0 ? 'No expenses yet' : 'No matching expenses'}
              </h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                {expenses.length === 0
                  ? 'Create your first expense to start tracking business spending.'
                  : 'Try adjusting your search or category filter.'}
              </p>
              {expenses.length === 0 ? (
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.CREATE_EXPENSE)}
                  className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  <Plus className="h-4 w-4" />
                  Create expense
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setCategoryFilter('All categories');
                  }}
                  className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="border-b border-slate-200/80 bg-slate-50/70">
                    <tr>
                      {['Expense', 'Category', 'Vendor', 'Date', 'Amount', 'Actions'].map((heading) => (
                        <th
                          key={heading}
                          className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedExpenses.map((expense) => (
                      <tr key={expense.id} className="transition hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-xs font-bold text-rose-700">
                              {getInitials(String(expense.description || 'Expense'))}
                            </div>
                            <div>
                              <p className="max-w-[220px] truncate text-sm font-semibold text-slate-900">
                                {expense.description || 'Untitled expense'}
                              </p>
                              <p className="font-mono text-xs text-slate-400">
                                EXP-{String(expense.id).padStart(4, '0')}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                            {expense.category || 'Uncategorized'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                          {expense.vendor || '—'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                          {formatDate(expense.expenseDate)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 font-mono text-sm font-semibold text-slate-900">
                          {formatCurrency(Number(expense.amount || 0))}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              title="View expense"
                              onClick={() => setSelectedExpense(expense)}
                              className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="Delete expense"
                              onClick={() => setExpenseToDelete(expense)}
                              className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-600 transition hover:border-red-200 hover:bg-red-100"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <TablePagination
                currentPage={page}
                totalItems={filteredExpenses.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
                itemLabel="expenses"
              />
            </>
          )}
        </div>
      </div>

      {selectedExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setSelectedExpense(null)}
              className="absolute right-4 top-4 inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="pr-10">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">
                Expense details
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                {selectedExpense.description || 'Untitled expense'}
              </h2>
              <p className="mt-1 font-mono text-xs text-slate-400">
                EXP-{String(selectedExpense.id).padStart(4, '0')}
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Amount</p>
                <p className="mt-2 font-mono text-lg font-bold text-slate-900">
                  {formatCurrency(Number(selectedExpense.amount || 0))}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Date</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {formatDate(selectedExpense.expenseDate)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Category</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {selectedExpense.category || 'Uncategorized'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Vendor</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {selectedExpense.vendor || 'Not provided'}
                </p>
              </div>
            </div>

            {selectedExpense.notes && (
              <div className="mt-4 rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {selectedExpense.notes}
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedExpense(null)}
                className="min-h-[40px] rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {expenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setExpenseToDelete(null)}
              className="absolute right-4 top-4 inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
              <Trash2 className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">Delete this expense?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This will permanently remove{' '}
              <span className="font-semibold text-slate-700">
                {expenseToDelete.description || 'this expense'}
              </span>
              . This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                disabled={isDeleting}
                className="min-h-[40px] rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting && <RefreshCw className="h-4 w-4 animate-spin" />}
                {isDeleting ? 'Deleting...' : 'Delete expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
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