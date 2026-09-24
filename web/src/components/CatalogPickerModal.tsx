import React, { useState, useMemo, useEffect } from 'react';
import type { ProductService } from '../types';
import { formatCurrency } from '../lib/currency';
import { 
  X, 
  Search, 
  Package, 
  Wrench, 
  Check, 
  Plus, 
  Boxes, 
  Building2, 
  Tag, 
  ArrowRight,
  Sparkles
} from 'lucide-react';

export interface CatalogPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductService[];
  onSelectProduct: (product: ProductService) => void;
}

export function CatalogPickerModal({
  isOpen,
  onClose,
  products,
  onSelectProduct,
}: CatalogPickerModalProps) {
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<'all' | 'product' | 'service'>('all');
  const [addedIds, setAddedIds] = useState<Record<number, number>>({});

  // Reset state on modal open
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedGroup('All');
      setTypeFilter('all');
      setAddedIds({});
    }
  }, [isOpen]);

  // Distinct business line groups
  const groups = useMemo(() => {
    const list = Array.from(
      new Set(products.map((p) => p.group).filter(Boolean))
    ) as string[];
    return ['All', ...list];
  }, [products]);

  // Filtered catalog
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.group && p.group.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q));

      const matchGroup =
        selectedGroup === 'All' ||
        (p.group || 'Commodities').toLowerCase() === selectedGroup.toLowerCase();

      const matchType =
        typeFilter === 'all' || (p.type || 'product').toLowerCase() === typeFilter;

      return matchSearch && matchGroup && matchType;
    });
  }, [products, search, selectedGroup, typeFilter]);

  if (!isOpen) return null;

  const handleAdd = (p: ProductService) => {
    onSelectProduct(p);
    setAddedIds((prev) => ({
      ...prev,
      [p.id]: (prev[p.id] || 0) + 1,
    }));
  };

  const getGroupBadge = (grp?: string) => {
    const g = (grp || 'Commodities').toLowerCase();
    if (g === 'cctv') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
          CCTV
        </span>
      );
    }
    if (g === 'folding partition') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Folding Partition
        </span>
      );
    }
    if (g === 'commodities') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
          Commodities
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
        {grp || 'General'}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                <Boxes size={18} />
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Product &amp; Service Catalog
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Browse products and services to add them directly as line items on this invoice.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search & Filters Bar */}
        <div className="p-4 border-b border-slate-100 space-y-3 bg-white">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, SKU, or description..."
                className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-medium transition"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Type Filter */}
            <div className="flex rounded-xl border border-slate-200 p-0.5 bg-slate-50 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  typeFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Items
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('product')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  typeFilter === 'product'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Products
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('service')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  typeFilter === 'service'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Services
              </button>
            </div>
          </div>

          {/* Business Line Group Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-thin">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Building2 size={13} /> Division:
            </span>
            {groups.map((grp) => {
              const isActive = selectedGroup === grp;
              return (
                <button
                  key={grp}
                  type="button"
                  onClick={() => setSelectedGroup(grp)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    isActive
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {grp}
                </button>
              );
            })}
          </div>
        </div>

        {/* Catalog Items List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
          {filteredProducts.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Package size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-700">No catalog items match your search</p>
              <p className="text-xs text-slate-400 mt-1">
                Try searching for something else or change category filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredProducts.map((p) => {
                const addCount = addedIds[p.id] || 0;
                const stock = p.inventoryItem?.quantityOnHand ?? p.initialStock;
                const isOutOfStock = p.type === 'product' && stock !== undefined && Number(stock) <= 0;

                return (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-amber-300 hover:shadow-xs transition bg-white flex flex-col justify-between gap-3"
                  >
                    <div>
                      {/* Top tags */}
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {getGroupBadge(p.group)}
                          {p.sku && (
                            <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {p.sku}
                            </span>
                          )}
                        </div>

                        {p.type === 'service' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded">
                            <Wrench size={10} /> Service
                          </span>
                        ) : stock !== undefined ? (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              Number(stock) > 0
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {Number(stock) > 0 ? `${stock} in stock` : 'Out of stock'}
                          </span>
                        ) : null}
                      </div>

                      {/* Product Name */}
                      <h4 className="text-sm font-bold text-slate-900 line-clamp-2">
                        {p.name}
                      </h4>

                      {/* Description preview */}
                      {p.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                          {p.description}
                        </p>
                      )}
                    </div>

                    {/* Bottom Price & Add Action */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold font-mono text-slate-900">
                          {formatCurrency(Number(p.unitPrice || 0))}
                        </div>
                        {p.taxRate ? (
                          <div className="text-[10px] text-slate-400 font-medium">
                            +{p.taxRate}% VAT / Tax
                          </div>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAdd(p)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          addCount > 0
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                            : 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs'
                        }`}
                      >
                        {addCount > 0 ? (
                          <>
                            <Check size={14} />
                            <span>Added ({addCount})</span>
                          </>
                        ) : (
                          <>
                            <Plus size={14} />
                            <span>Add to Invoice</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Showing <span className="font-bold text-slate-800">{filteredProducts.length}</span> items
            {Object.keys(addedIds).length > 0 && (
              <span className="ml-2 font-bold text-emerald-600">
                • {Object.values(addedIds).reduce((a, b) => a + b, 0)} added to invoice
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
          >
            Done Adding Items
          </button>
        </div>

      </div>
    </div>
  );
}
