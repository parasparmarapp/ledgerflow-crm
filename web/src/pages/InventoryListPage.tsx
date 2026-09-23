import type { InventoryItem, ProductService } from '../types';
import { useMemo, useState } from 'react';
import { useInventoryItems, useProductServices } from '../hooks';
import { formatCurrency } from '../lib/currency';
import { ROUTES } from '../routes';
import { useNavigate } from 'react-router-dom';
import { TablePagination } from '../components';
import { AlertCircle, ArrowRight, CheckCircle2, ChevronRight, Download, Edit, Eye, Filter, Plus, RefreshCw, Search, X, XCircle, Package as PackageIcon } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

type ToastState = {
  message: string;
  type: ToastType;
} | null;

function getStatus(item: InventoryItem): 'Healthy' | 'Low stock' | 'Archived' {
  if (item.isArchived) return 'Archived';
  if (Number(item.quantityOnHand) <= Number(item.reorderThreshold)) return 'Low stock';
  return 'Healthy';
}

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: ReturnType<typeof getStatus> }) {
  const styles =
    status === 'Healthy'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'Low stock'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${styles}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'Healthy' ? 'bg-emerald-500' : status === 'Low stock' ? 'bg-amber-500' : 'bg-slate-400'}`} />
      {status}
    </span>
  );
}

function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;

  const Icon = toast.type === 'success' ? CheckCircle2 : toast.type === 'error' ? XCircle : AlertCircle;
  const color = toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-500' : 'bg-indigo-500';

  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${color}`}>
      <Icon size={17} />
      {toast.message}
    </div>
  );
}

export default function InventoryListPage() {
  const navigate = useNavigate();
  const { data, loading, error, refresh } = useInventoryItems();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Healthy' | 'Low stock' | 'Archived'>('All');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const items = data ?? [];
  const productsResult = useProductServices();
  const productById = useMemo(() => {
    const map = new Map<number, ProductService>();
    ((productsResult.data ?? []) as ProductService[]).forEach((product) => map.set(product.id, product));
    return map;
  }, [productsResult.data]);
  const productLabel = (item: InventoryItem) => productById.get(item.productServiceId)?.name ?? `Product #${item.productServiceId}`;
  const productSku = (item: InventoryItem) => productById.get(item.productServiceId)?.sku;

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const status = getStatus(item);
      const matchesStatus = statusFilter === 'All' || status === statusFilter;
      const searchable = [
        String(item?.id ?? ''),
        String(item?.productServiceId ?? ''),
        String(item?.location ?? ''),
      ]
        .join(' ')
        .toLowerCase();

      return matchesStatus && (!query || searchable.includes(query));
    });
  }, [items, search, statusFilter]);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page]);

  const healthyCount = items.filter((item) => getStatus(item) === 'Healthy').length;
  const lowStockCount = items.filter((item) => getStatus(item) === 'Low stock').length;
  const archivedCount = items.filter((item) => getStatus(item) === 'Archived').length;
  const totalValue = items.reduce(
    (sum, item) => sum + Number(item.quantityOnHand || 0) * Number(item.unitCost || 0),
    0,
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
      showToast('Inventory refreshed successfully.', 'success');
    } catch {
      showToast('Unable to refresh inventory.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport = () => {
    if (filteredItems.length === 0) {
      showToast('There are no inventory items to export.', 'info');
      return;
    }

    const header = ['ID', 'Product service ID', 'Quantity on hand', 'Reorder threshold', 'Unit cost', 'Location', 'Status'];
    const rows = filteredItems.map((item) => [
      item.id,
      item.productServiceId,
      item.quantityOnHand,
      item.reorderThreshold,
      item.unitCost,
      item.location ?? '',
      getStatus(item),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'inventory.csv';
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('Inventory export downloaded.', 'success');
  };

  const navigateTo = (route: string) => {
    navigate(route);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Inventory operations
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Inventory</h1>
          <p className="mt-1 text-sm text-slate-500">Monitor stock levels, costs, and reorder thresholds.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
          >
            <Download size={16} />
            Export
          </button>
          <button
            type="button"
            onClick={() => navigateTo(ROUTES.CREATE_ITEM)}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
          >
            <Plus size={17} />
            Add item
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total items</span>
            <span className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-slate-600"><PackageIcon size={18} /></span>
          </div>
          <p className="font-mono text-3xl font-bold tracking-tight text-slate-900">{items.length}</p>
          <p className="mt-2 text-xs text-slate-500">Across all inventory locations</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Healthy stock</span>
            <span className="rounded-lg border border-emerald-100 bg-emerald-50 p-2 text-emerald-600"><CheckCircle2 size={18} /></span>
          </div>
          <p className="font-mono text-3xl font-bold tracking-tight text-slate-900">{healthyCount}</p>
          <p className="mt-2 text-xs text-slate-500">Items above reorder threshold</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Low stock</span>
            <span className="rounded-lg border border-amber-100 bg-amber-50 p-2 text-amber-600"><AlertCircle size={18} /></span>
          </div>
          <p className="font-mono text-3xl font-bold tracking-tight text-slate-900">{lowStockCount}</p>
          <p className="mt-2 text-xs text-slate-500">Items requiring attention</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Stock value</span>
            <span className="rounded-lg border border-indigo-100 bg-indigo-50 p-2 text-indigo-600"><PackageIcon size={18} /></span>
          </div>
          <p className="font-mono text-2xl font-bold tracking-tight text-slate-900">{formatCurrency(totalValue)}</p>
          <p className="mt-2 text-xs text-slate-500">{archivedCount} archived items excluded from alerts</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200/80 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Inventory items</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{filteredItems.length}</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">Search and inspect your current inventory.</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative block">
              <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search inventory..."
                className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100 sm:w-56"
              />
            </label>
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
              <Filter size={15} className="ml-2 mr-1 text-slate-400" />
              {(['All', 'Healthy', 'Low stock', 'Archived'] as const).map((filter) => (
                <button
                  type="button"
                  key={filter}
                  onClick={() => {
                    setStatusFilter(filter);
                    setPage(1);
                  }}
                  className={`min-h-[32px] rounded-lg px-2.5 text-xs font-semibold transition ${statusFilter === filter ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="h-14 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <AlertCircle size={32} className="mb-3 text-red-500" />
            <h3 className="font-semibold text-slate-900">Unable to load inventory</h3>
            <p className="mt-1 max-w-md text-sm text-slate-500">{String(error)}</p>
            <button type="button" onClick={handleRefresh} className="mt-5 min-h-[40px] rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700">
              Try again
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <PackageIcon size={34} className="mb-3 text-slate-300" />
            <h3 className="font-semibold text-slate-900">{items.length === 0 ? 'No inventory items yet' : 'No matching items'}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {items.length === 0 ? 'Add your first item to start tracking stock.' : 'Try adjusting your search or status filter.'}
            </p>
            <button
              type="button"
              onClick={() => (items.length === 0 ? navigateTo(ROUTES.CREATE_ITEM) : (setSearch(''), setStatusFilter('All')))}
              className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700"
            >
              {items.length === 0 ? <><Plus size={16} /> Add item</> : 'Reset filters'}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="border-b border-slate-200/80 bg-slate-50/70">
                <tr>
                  {['Item', 'Quantity', 'Unit cost', 'Location', 'Updated', 'Status', ''].map((heading) => (
                    <th key={heading} className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedItems.map((item) => {
                  const status = getStatus(item);
                  return (
                    <tr key={item.id} className="group transition hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <button type="button" onClick={() => setSelectedItem(item)} className="text-left">
                          <div className="font-semibold text-slate-900 group-hover:text-amber-700">{productLabel(item)}</div>
                          <div className="mt-1 text-xs text-slate-500">{productSku(item) ? `SKU ${productSku(item)} · ` : ''}Item #{item.id}</div>
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`font-mono text-sm font-semibold ${status === 'Low stock' ? 'text-amber-700' : 'text-slate-700'}`}>{item.quantityOnHand}</span>
                        <span className="ml-1 text-xs text-slate-400">/ threshold {item.reorderThreshold}</span>
                      </td>
                      <td className="px-5 py-4 font-mono text-sm text-slate-700">{formatCurrency(Number(item.unitCost || 0))}</td>
                      <td className="px-5 py-4 text-sm text-slate-600">{item.location || 'Unassigned'}</td>
                      <td className="px-5 py-4 text-sm text-slate-500">{formatDate(item.updatedAt)}</td>
                      <td className="px-5 py-4"><StatusBadge status={status} /></td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" title="View details" onClick={() => setSelectedItem(item)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Eye size={17} /></button>
                          <button type="button" title="Edit item" onClick={() => navigateTo(`${ROUTES.EDIT_INVENTORY_ITEM}?id=${item.id}`)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600"><Edit size={17} /></button>
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
          totalItems={filteredItems.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          itemLabel="items"
        />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">Showing {filteredItems.length} of {items.length} inventory items</p>
        <button type="button" onClick={() => navigateTo(ROUTES.STOCK_HISTORY)} className="inline-flex min-h-[40px] items-center gap-2 text-sm font-semibold text-amber-700 hover:text-amber-800">
          View stock history <ArrowRight size={16} />
        </button>
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <button type="button" onClick={() => setSelectedItem(null)} className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
            <div className="mb-6 pr-8">
              <div className="mb-2 flex items-center gap-2"><PackageIcon size={20} className="text-rose-600" /><span className="text-sm font-semibold text-slate-500">Inventory item #{selectedItem.id}</span></div>
              <h2 className="text-xl font-bold text-slate-900">Stock overview</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Product service</p><p className="mt-1 font-semibold text-slate-900">{productLabel(selectedItem)}</p></div>
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p><div className="mt-2"><StatusBadge status={getStatus(selectedItem)} /></div></div>
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quantity on hand</p><p className="mt-1 font-mono text-lg font-bold text-slate-900">{selectedItem.quantityOnHand}</p></div>
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reorder threshold</p><p className="mt-1 font-mono text-lg font-bold text-slate-900">{selectedItem.reorderThreshold}</p></div>
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unit cost</p><p className="mt-1 font-mono text-lg font-bold text-slate-900">{formatCurrency(Number(selectedItem.unitCost || 0))}</p></div>
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location</p><p className="mt-1 font-semibold text-slate-900">{selectedItem.location || 'Unassigned'}</p></div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setSelectedItem(null)} className="min-h-[40px] rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200">Close</button>
              <button type="button" onClick={() => navigateTo(`${ROUTES.EDIT_INVENTORY_ITEM}?id=${selectedItem.id}`)} className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700"><Edit size={16} /> Edit item</button>
              <button type="button" onClick={() => navigateTo(`${ROUTES.INVENTORY_ITEM_DETAILS}?id=${selectedItem.id}`)} className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Full details <ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}