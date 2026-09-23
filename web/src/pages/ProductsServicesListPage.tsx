import type { ProductService } from '../types';
import { useMemo, useState } from 'react';
import { useProductServices } from '../hooks';
import { formatCurrency } from '../lib/currency';
import { useNavigate } from 'react-router-dom';
import { Select, TablePagination } from '../components';
import { 
  AlertCircle, 
  CheckCircle2, 
  Download, 
  Edit, 
  Eye, 
  Filter, 
  Plus, 
  RefreshCw, 
  Search, 
  X, 
  XCircle, 
  Package as PackageIcon, 
  Building2,
  Layers,
  Boxes
} from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

type ToastState = {
  message: string;
  type: ToastType;
} | null;

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        active
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-slate-100 text-slate-500'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? 'bg-emerald-500' : 'bg-slate-400'
        }`}
      />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function GroupBadge({ group }: { group?: string }) {
  const grp = group || 'Commodities';
  if (grp === 'Commodities') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
        Commodities
      </span>
    );
  }
  if (grp === 'CCTV') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-sky-50 text-sky-900 border border-sky-300">
        CCTV
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-300">
      Folding Partition
    </span>
  );
}

export default function ProductsServicesListPage() {
  const navigate = useNavigate();
  const { data, loading, error, refresh, remove } = useProductServices();

  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<'All' | 'Commodities' | 'CCTV' | 'Folding Partition'>('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedItem, setSelectedItem] = useState<ProductService | null>(null);
  const [deleteItem, setDeleteItem] = useState<ProductService | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const products = data ?? [];

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((item) => {
      const name = String(item?.name || '').toLowerCase();
      const sku = String(item?.sku || '').toLowerCase();
      const description = String(item?.description || '').toLowerCase();
      const type = String(item?.type || '').toLowerCase();
      const grp = String(item?.group || 'Commodities');

      const matchesSearch =
        !query ||
        name.includes(query) ||
        sku.includes(query) ||
        description.includes(query);

      const matchesGroup = groupFilter === 'All' || grp.toLowerCase() === groupFilter.toLowerCase();
      const matchesType = typeFilter === 'All' || type === typeFilter.toLowerCase();
      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Active' && item?.isActive === true) ||
        (statusFilter === 'Inactive' && item?.isActive === false);

      return matchesSearch && matchesGroup && matchesType && matchesStatus;
    });
  }, [products, search, statusFilter, typeFilter, groupFilter]);

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [filteredProducts, page]);

  const commoditiesCount = products.filter((i) => (i?.group || 'Commodities') === 'Commodities').length;
  const cctvCount = products.filter((i) => i?.group === 'CCTV').length;
  const partitionCount = products.filter((i) => i?.group === 'Folding Partition').length;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
      showToast('Catalog refreshed successfully.', 'success');
    } catch {
      showToast('Unable to refresh the catalog.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExport = () => {
    if (products.length === 0) {
      showToast('There are no items to export.', 'info');
      return;
    }

    const headers = ['ID', 'Name', 'Business Group', 'Type', 'SKU', 'Unit Price', 'Cost Price', 'Tax Rate', 'Status'];
    const rows = filteredProducts.map((item) => [
      item.id,
      item.name,
      item.group || 'Commodities',
      item.type,
      item.sku || '',
      item.unitPrice,
      item.costPrice || 0,
      item.taxRate,
      item.isActive ? 'Active' : 'Inactive',
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
    link.download = `catalog_${groupFilter.toLowerCase().replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Catalog exported successfully to CSV.', 'success');
  };

  const handleDelete = async () => {
    if (!deleteItem || typeof deleteItem.id !== 'number') return;
    setIsDeleting(true);
    try {
      await remove(deleteItem.id);
      setDeleteItem(null);
      setSelectedItem(null);
      showToast('Item archived successfully.', 'success');
    } catch {
      showToast('Failed to archive the selected item.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50 font-sans">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-6 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700">
              <Building2 size={16} />
              Multi-Division Catalog
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Products &amp; Services
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Operating catalog organized under Commodities, CCTV Security Systems, and Folding Partitions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/create-service')}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700 cursor-pointer"
          >
            <Plus size={18} />
            Add Product or Service
          </button>
        </div>

        {/* Business Line Group Tabs */}
        <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {[
            { key: 'All', label: 'All Business Lines', count: products.length },
            { key: 'Commodities', label: 'Commodities', count: commoditiesCount },
            { key: 'CCTV', label: 'CCTV Systems', count: cctvCount },
            { key: 'Folding Partition', label: 'Folding Partitions', count: partitionCount },
          ].map((tab) => {
            const isActive = groupFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setGroupFilter(tab.key as any);
                  setPage(1);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  isActive
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  isActive ? 'bg-amber-800 text-amber-100' : 'bg-slate-100 text-slate-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content Box */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Controls */}
          <div className="border-b border-slate-200 p-4 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    {groupFilter === 'All' ? 'All Catalog Items' : `${groupFilter} Items`}
                  </h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                    {filteredProducts.length}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <Download size={15} />
                  Export CSV
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row">
              <label className="relative block flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by product name, SKU, or description..."
                  className="min-h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-xs text-slate-900 outline-none focus:border-amber-500 focus:bg-white"
                />
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <div className="w-40">
                  <Select
                    value={typeFilter}
                    onChange={(val) => {
                      setTypeFilter(val);
                      setPage(1);
                    }}
                    options={[
                      { value: 'All', label: 'All Types' },
                      { value: 'Product', label: 'Physical Products' },
                      { value: 'Service', label: 'Services & Labor' },
                    ]}
                  />
                </div>

                <div className="w-36">
                  <Select
                    value={statusFilter}
                    onChange={(val) => {
                      setStatusFilter(val);
                      setPage(1);
                    }}
                    options={[
                      { value: 'All', label: 'All Statuses' },
                      { value: 'Active', label: 'Active' },
                      { value: 'Inactive', label: 'Inactive' },
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600 text-sm">
              Failed to load catalog items from PostgreSQL.
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              No matching products or services found under this group.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-3.5">Item Name &amp; SKU</th>
                    <th className="px-6 py-3.5">Business Group</th>
                    <th className="px-6 py-3.5">Type</th>
                    <th className="px-6 py-3.5">Unit Price</th>
                    <th className="px-6 py-3.5">Tax</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedProducts.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt=""
                              className="h-10 w-10 shrink-0 rounded-lg object-cover border border-slate-200 bg-white"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                              <PackageIcon size={18} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">{item.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {item.sku ? `SKU: ${item.sku}` : 'No SKU'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <GroupBadge group={item.group} />
                      </td>
                      <td className="px-6 py-4 capitalize font-semibold text-slate-700">
                        {item.type}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">
                        {formatCurrency(Number(item.unitPrice || 0))}
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-600">
                        {Number(item.taxRate || 0)}%
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge active={item.isActive} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedItem(item)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                            title="View details"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/edit-product-or-service?id=${item.id}`)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-amber-600 cursor-pointer"
                            title="Edit item"
                          >
                            <Edit size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <TablePagination
            currentPage={page}
            totalItems={filteredProducts.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            itemLabel="items"
          />
        </div>
      </div>

      {/* Item Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {selectedItem.imageUrl ? (
                  <img
                    src={selectedItem.imageUrl}
                    alt=""
                    className="h-14 w-14 rounded-xl object-cover border border-slate-200 bg-white shrink-0 shadow-xs"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400 shrink-0">
                    <PackageIcon size={24} />
                  </div>
                )}
                <div>
                  <GroupBadge group={selectedItem.group} />
                  <h3 className="text-lg font-bold text-slate-900 mt-1">{selectedItem.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">SKU: {selectedItem.sku || 'N/A'}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
              {selectedItem.description || 'No description provided for this item.'}
            </p>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block mb-1">Selling Price</span>
                <span className="text-base font-bold text-slate-900 font-mono">
                  {formatCurrency(Number(selectedItem.unitPrice || 0))}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block mb-1">Cost Price (COGS)</span>
                <span className="text-base font-bold text-slate-700 font-mono">
                  {formatCurrency(Number(selectedItem.costPrice || 0))}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <button
                onClick={() => {
                  const id = selectedItem.id;
                  setSelectedItem(null);
                  navigate(`/edit-product-or-service?id=${id}`);
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer flex items-center gap-1.5"
              >
                <Edit size={14} />
                Edit Item
              </button>
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold text-white shadow-xl ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}