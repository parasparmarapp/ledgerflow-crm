import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { ProductService } from '../types';
import { formatCurrency } from '../lib/currency';
import { 
  Search, 
  X, 
  ChevronDown, 
  Check, 
  Package, 
  Wrench, 
  PlusCircle, 
  Grid,
  Sparkles
} from 'lucide-react';

export interface ProductItemComboboxProps {
  value?: number;
  products: ProductService[];
  onChange: (productServiceId: number | '') => void;
  onOpenCatalogModal?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ProductItemCombobox({
  value,
  products,
  onChange,
  onOpenCatalogModal,
  placeholder = 'Select product or service...',
  disabled = false,
}: ProductItemComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedProduct = useMemo(() => {
    if (!value) return null;
    return products.find((p) => p.id === Number(value)) || null;
  }, [value, products]);

  // Distinct groups
  const groups = useMemo(() => {
    const list = Array.from(new Set(products.map((p) => p.group).filter(Boolean))) as string[];
    return ['All', ...list];
  }, [products]);

  // Filtered products
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

      return matchSearch && matchGroup;
    });
  }, [products, search, selectedGroup]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Auto focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSelect = (id: number | '') => {
    onChange(id);
    setIsOpen(false);
    setSearch('');
  };

  const getGroupBadgeClass = (grp?: string) => {
    const g = (grp || 'Commodities').toLowerCase();
    if (g === 'cctv') return 'bg-sky-50 text-sky-700 border-sky-200';
    if (g === 'folding partition') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (g === 'commodities') return 'bg-amber-50 text-amber-800 border-amber-200';
    return 'bg-purple-50 text-purple-700 border-purple-200';
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full text-left min-h-[38px] px-3 py-1.5 rounded-lg border text-xs flex items-center justify-between gap-2 transition cursor-pointer select-none ${
          disabled
            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
            : isOpen
            ? 'border-amber-500 bg-white ring-2 ring-amber-500/20'
            : selectedProduct
            ? 'border-slate-200 bg-white hover:border-slate-300 text-slate-900 shadow-2xs'
            : 'border-slate-200 bg-slate-50/70 hover:bg-white text-slate-500'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedProduct ? (
            <>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${getGroupBadgeClass(
                  selectedProduct.group
                )}`}
              >
                {selectedProduct.group || 'General'}
              </span>
              <span className="font-semibold text-slate-800 truncate" title={selectedProduct.name}>
                {selectedProduct.name}
              </span>
            </>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-500">
              <Sparkles size={13} className="text-amber-500 shrink-0" />
              <span className="truncate">{placeholder}</span>
            </div>
          )}
        </div>
        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180 text-amber-600' : ''}`} />
      </button>

      {/* Floating Popover Search Dropdown */}
      {isOpen && (
        <div className="absolute left-0 mt-1 w-[380px] sm:w-[440px] max-w-[90vw] bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          
          {/* Header Search Box */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/80 space-y-2">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search catalog by name, SKU, division..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-medium"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Group Filters */}
            {groups.length > 2 && (
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px] scrollbar-none">
                {groups.map((grp) => {
                  const isGrpActive = selectedGroup === grp;
                  return (
                    <button
                      key={grp}
                      type="button"
                      onClick={() => setSelectedGroup(grp)}
                      className={`px-2 py-0.5 rounded-md font-semibold whitespace-nowrap transition cursor-pointer ${
                        isGrpActive
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {grp}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Special Option: Custom / Non-Catalog Item */}
          <div className="p-1 border-b border-slate-100 bg-slate-50/40">
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition cursor-pointer ${
                !value
                  ? 'bg-amber-50/70 text-amber-900 font-semibold'
                  : 'text-slate-700 hover:bg-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-slate-100 text-slate-600">
                  <PlusCircle size={14} />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Custom / Non-Catalog Item</div>
                  <div className="text-[10px] text-slate-400">Manual service, fee, or custom project</div>
                </div>
              </div>
              {!value && <Check size={14} className="text-amber-600" />}
            </button>
          </div>

          {/* Product Items List */}
          <div className="max-h-64 overflow-y-auto p-1 divide-y divide-slate-50">
            {filteredProducts.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                <Package size={22} className="mx-auto text-slate-300 mb-1" />
                No matching catalog items found
              </div>
            ) : (
              filteredProducts.map((p) => {
                const isSelected = selectedProduct?.id === p.id;
                const stock = p.inventoryItem?.quantityOnHand ?? p.initialStock;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelect(p.id)}
                    className={`w-full flex items-start justify-between gap-3 px-3 py-2 rounded-lg text-left transition cursor-pointer group ${
                      isSelected
                        ? 'bg-amber-50/80 text-amber-900 ring-1 ring-amber-400/40'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold border shrink-0 ${getGroupBadgeClass(
                            p.group
                          )}`}
                        >
                          {p.group || 'Commodities'}
                        </span>
                        {p.sku && (
                          <span className="font-mono text-[10px] text-slate-400 shrink-0">
                            {p.sku}
                          </span>
                        )}
                        {p.type === 'service' ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-indigo-600 font-medium">
                            <Wrench size={10} /> Service
                          </span>
                        ) : stock !== undefined ? (
                          <span
                            className={`text-[10px] font-medium ${
                              Number(stock) > 0 ? 'text-emerald-600' : 'text-amber-600'
                            }`}
                          >
                            • {Number(stock) > 0 ? `${stock} in stock` : '0 in stock'}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs font-semibold text-slate-900 leading-snug group-hover:text-amber-900 break-words">
                        {p.name}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-slate-900">
                        {formatCurrency(Number(p.unitPrice || 0))}
                      </div>
                      {p.taxRate ? (
                        <div className="text-[10px] text-slate-400 font-medium">
                          +{p.taxRate}% tax
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Modal trigger footer */}
          {onOpenCatalogModal && (
            <div className="p-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-400">
                {filteredProducts.length} items available
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenCatalogModal();
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 transition cursor-pointer"
              >
                <Grid size={12} />
                <span>Open Catalog Browser</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
