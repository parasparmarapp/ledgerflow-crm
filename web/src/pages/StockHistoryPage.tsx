import type { StockMovement } from '../types';
import React, { useMemo, useState } from 'react';
import { useStockMovements } from '../hooks';
import { useNavigate } from 'react-router-dom';
import { Select, DateRangeFilter, TablePagination } from '../components';
import { AlertCircle, ArrowLeft, Calendar, CheckCircle2, ChevronRight, Download, Filter, RefreshCw, Search, X, XCircle, Activity as ActivityIcon, Package as PackageIcon } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

type ToastState = {
  message: string;
  type: ToastType;
} | null;

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatShortDate(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function getReasonLabel(reason: string | undefined): string {
  const normalized = String(reason || '').trim();
  if (!normalized) return 'Unspecified';
  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getMovementTone(quantity: number): string {
  if (quantity > 0) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (quantity < 0) return 'text-rose-700 bg-rose-50 border-rose-200';
  return 'text-slate-600 bg-slate-50 border-slate-200';
}

function getInitials(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '—';
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export default function StockHistoryPage() {
  const navigate = useNavigate();
  const { data, loading, error, refresh } = useStockMovements();

  const movements = useMemo<StockMovement[]>(
    () => (Array.isArray(data) ? data : []),
    [data],
  );

  const [search, setSearch] = useState('');
  const [reasonFilter, setReasonFilter] = useState('All reasons');
  const [directionFilter, setDirectionFilter] = useState('All movements');
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const handleDateRangeChange = (from: string, to: string) => {
    setStartDate(from);
    setEndDate(to);
    setPage(1);
    refresh({ from: from || undefined, to: to || undefined });
  };

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  const reasons = useMemo(() => {
    const uniqueReasons = new Set<string>(
      movements.map((movement) => getReasonLabel(movement?.reason)),
    );
    return Array.from(uniqueReasons).sort((a, b) => a.localeCompare(b));
  }, [movements]);

  const filteredMovements = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return movements
      .filter((movement) => {
        const searchable = [
          movement?.id,
          movement?.inventoryItemId,
          movement?.userId,
          movement?.reason,
          movement?.notes,
        ]
          .map((value) => String(value ?? ''))
          .join(' ')
          .toLowerCase();

        const matchesSearch =
          normalizedSearch.length === 0 || searchable.includes(normalizedSearch);
        const matchesReason =
          reasonFilter === 'All reasons' ||
          getReasonLabel(movement?.reason) === reasonFilter;

        const quantity = Number(movement?.quantityChange || 0);
        const matchesDirection =
          directionFilter === 'All movements' ||
          (directionFilter === 'Stock in' && quantity > 0) ||
          (directionFilter === 'Stock out' && quantity < 0) ||
          (directionFilter === 'No change' && quantity === 0);

        const movementDate = movement?.createdAt ? movement.createdAt.slice(0, 10) : '';
        const matchesDate =
          (!startDate || movementDate >= startDate) &&
          (!endDate || movementDate <= endDate);

        return matchesSearch && matchesReason && matchesDirection && matchesDate;
      })
      .sort((first, second) => {
        const firstTime = new Date(first?.createdAt || '').getTime();
        const secondTime = new Date(second?.createdAt || '').getTime();
        return secondTime - firstTime;
      });
  }, [directionFilter, endDate, movements, reasonFilter, search, startDate]);

  const paginatedMovements = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredMovements.slice(start, start + PAGE_SIZE);
  }, [filteredMovements, page]);

  const totalUnits = movements.reduce(
    (total, movement) => total + Number(movement?.quantityChange || 0),
    0,
  );
  const inboundCount = movements.filter(
    (movement) => Number(movement?.quantityChange || 0) > 0,
  ).length;
  const outboundCount = movements.filter(
    (movement) => Number(movement?.quantityChange || 0) < 0,
  ).length;
  const uniqueItems = new Set(
    movements.map((movement) => Number(movement?.inventoryItemId || 0)),
  ).size;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
      showToast('Stock history refreshed.', 'success');
    } catch {
      showToast('Unable to refresh stock history.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport = () => {
    const headers = [
      'Movement ID',
      'Inventory Item ID',
      'User ID',
      'Quantity Change',
      'Reason',
      'Notes',
      'Created At',
    ];

    const rows = filteredMovements.map((movement) => [
      String(movement?.id ?? ''),
      String(movement?.inventoryItemId ?? ''),
      String(movement?.userId ?? ''),
      String(movement?.quantityChange ?? ''),
      String(movement?.reason ?? ''),
      String(movement?.notes ?? ''),
      String(movement?.createdAt ?? ''),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((value) => escapeCsv(value)).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'stock-history.csv';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    showToast('Stock history exported successfully.', 'success');
  };

  const resetFilters = () => {
    setSearch('');
    setReasonFilter('All reasons');
    setDirectionFilter('All movements');
    setStartDate('');
    setEndDate('');
    setPage(1);
    refresh();
  };

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500">
              <ActivityIcon className="h-4 w-4 text-rose-500" />
              Inventory audit trail
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Stock history
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Review every inventory adjustment, including its reason, quantity change,
              and recorded timestamp.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={filteredMovements.length === 0}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total movements"
            value={movements.length.toLocaleString('en-US')}
            detail="All recorded adjustments"
            icon={<ActivityIcon className="h-5 w-5" />}
            tone="rose"
          />
          <MetricCard
            label="Net quantity change"
            value={`${totalUnits > 0 ? '+' : ''}${totalUnits.toLocaleString('en-US')}`}
            detail="Across all inventory items"
            icon={<PackageIcon className="h-5 w-5" />}
            tone={totalUnits >= 0 ? 'emerald' : 'amber'}
          />
          <MetricCard
            label="Stock in"
            value={inboundCount.toLocaleString('en-US')}
            detail="Positive adjustments"
            icon={<ChevronRight className="h-5 w-5 rotate-[-90deg]" />}
            tone="emerald"
          />
          <MetricCard
            label="Items affected"
            value={uniqueItems.toLocaleString('en-US')}
            detail={`${outboundCount.toLocaleString('en-US')} stock-out movements`}
            icon={<Filter className="h-5 w-5" />}
            tone="slate"
          />
        </div>

        <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-200/80 p-5 sm:p-6">
           <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">Movement log</h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {filteredMovements.length} of {movements.length}
                  </span>
                </div>
                <p className="mt-1 py-2 text-sm text-slate-500">
                  Search and filter the complete stock movement record.
                </p>
              </div>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

              <div className="flex flex-col flex-wrap gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 sm:min-w-[240px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search movement, item, or reason"
                    className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
                  />
                </div>
                <div className="w-full sm:w-40">
                  <Select
                    value={directionFilter}
                    onChange={(val) => {
                      setDirectionFilter(val);
                      setPage(1);
                    }}
                    options={[
                      { value: 'All movements', label: 'All movements' },
                      { value: 'Stock in', label: 'Stock in' },
                      { value: 'Stock out', label: 'Stock out' },
                      { value: 'No change', label: 'No change' },
                    ]}
                  />
                </div>
                <div className="w-full sm:w-44">
                  <Select
                    value={reasonFilter}
                    onChange={(val) => {
                      setReasonFilter(val);
                      setPage(1);
                    }}
                    searchable
                    options={[
                      { value: 'All reasons', label: 'All reasons' },
                      ...reasons.map((reason) => ({
                        value: reason,
                        label: reason,
                      })),
                    ]}
                  />
                </div>
                <DateRangeFilter
                  startDate={startDate}
                  endDate={endDate}
                  onChange={handleDateRangeChange}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={String(error)} onRetry={handleRefresh} />
          ) : filteredMovements.length === 0 ? (
            <EmptyState hasFilters={Boolean(search || reasonFilter !== 'All reasons' || directionFilter !== 'All movements' || startDate || endDate)} onReset={resetFilters} />
          ) : (
            <>
              <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200/80">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Movement
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Inventory item
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Change
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Reason
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Recorded by
                    </th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Date
                    </th>
                    <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedMovements.map((movement) => {
                    const quantity = Number(movement?.quantityChange || 0);
                    const movementLabel =
                      quantity > 0 ? 'Stock in' : quantity < 0 ? 'Stock out' : 'No change';

                    return (
                      <tr
                        key={movement.id}
                        className="group transition hover:bg-slate-50/70"
                      >
                        <td className="whitespace-nowrap px-5 py-4">
                          <div className="font-mono text-sm font-semibold text-slate-900">
                            MOV-{String(movement?.id ?? 0).padStart(5, '0')}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            {movementLabel}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-500">
                              #{movement?.inventoryItemId ?? 0}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-800">
                                Inventory item
                              </div>
                              <div className="text-xs text-slate-500">
                                ID {movement?.inventoryItemId ?? 0}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 font-mono text-sm font-bold ${getMovementTone(quantity)}`}
                          >
                            {quantity > 0 ? '+' : ''}
                            {quantity.toLocaleString('en-US')}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-700">
                          {getReasonLabel(movement?.reason)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-50 text-[10px] font-bold text-rose-700">
                              {getInitials(`User ${movement?.userId ?? 0}`)}
                            </div>
                            <span className="text-sm text-slate-600">
                              User {movement?.userId ?? 0}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <div className="text-sm text-slate-700">
                            {formatShortDate(movement?.createdAt)}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            {formatDate(movement?.createdAt).split(', ').slice(-1)[0]}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedMovement(movement)}
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                          >
                            View
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <TablePagination
              currentPage={page}
              totalItems={filteredMovements.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              itemLabel="stock movements"
            />
          </>
        )}
        </section>
      </div>

      {selectedMovement ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="movement-details-title"
            className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setSelectedMovement(null)}
              className="absolute right-4 top-4 inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close movement details"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-6 pr-10">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-600">
                <ActivityIcon className="h-4 w-4" />
                Stock movement
              </div>
              <h2 id="movement-details-title" className="text-xl font-bold text-slate-900">
                MOV-{String(selectedMovement?.id ?? 0).padStart(5, '0')}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Full audit information for this inventory adjustment.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <DetailItem label="Inventory item" value={`#${selectedMovement?.inventoryItemId ?? 0}`} />
              <DetailItem label="Recorded by" value={`User ${selectedMovement?.userId ?? 0}`} />
              <DetailItem
                label="Quantity change"
                value={`${Number(selectedMovement?.quantityChange || 0) > 0 ? '+' : ''}${Number(selectedMovement?.quantityChange || 0)}`}
                valueClassName={Number(selectedMovement?.quantityChange || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}
              />
              <DetailItem label="Reason" value={getReasonLabel(selectedMovement?.reason)} />
              <DetailItem label="Created" value={formatDate(selectedMovement?.createdAt)} wide />
              <DetailItem label="Notes" value={String(selectedMovement?.notes || 'No notes added.')} wide />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedMovement(null)}
                className="min-h-[40px] rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Close details
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.type === 'success'
              ? 'bg-emerald-600'
              : toast.type === 'error'
                ? 'bg-red-500'
                : 'bg-indigo-500'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : toast.type === 'error' ? (
            <XCircle className="h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" />
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
  detail,
  icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  tone: 'rose' | 'emerald' | 'amber' | 'slate';
}) {
  const toneClasses = {
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-slate-300">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        <span className={`rounded-lg border p-2.5 ${toneClasses[tone]}`}>{icon}</span>
      </div>
      <div className="mt-4 font-mono text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </div>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function DetailItem({
  label,
  value,
  wide = false,
  valueClassName = 'text-slate-900',
}: {
  label: string;
  value: string;
  wide?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 p-3 ${wide ? 'col-span-2' : ''}`}>
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className={`break-words text-sm font-semibold ${valueClassName}`}>{value}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3 p-5 sm:p-6">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="h-14 animate-pulse rounded-xl bg-slate-100"
        />
      ))}
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 rounded-full bg-rose-50 p-3 text-rose-600">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-bold text-slate-900">Unable to load stock history</h3>
      <p className="mt-2 max-w-md text-sm text-slate-500">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white transition hover:bg-amber-700"
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </button>
    </div>
  );
}

function EmptyState({
  hasFilters,
  onReset,
}: {
  hasFilters: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 rounded-full bg-slate-100 p-3 text-slate-500">
        <Calendar className="h-6 w-6" />
      </div>
      <h3 className="text-base font-bold text-slate-900">
        {hasFilters ? 'No movements match your filters' : 'No stock movements yet'}
      </h3>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        {hasFilters
          ? 'Try adjusting your search or clearing one of the active filters.'
          : 'Inventory adjustments will appear here once they are recorded.'}
      </p>
      {hasFilters ? (
        <button
          type="button"
          onClick={onReset}
          className="mt-5 min-h-[40px] rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
        >
          Reset filters
        </button>
      ) : null}
    </div>
  );
}