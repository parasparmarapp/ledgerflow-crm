import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  className?: string;
}

export function TablePagination({
  currentPage,
  totalItems,
  pageSize = 10,
  onPageChange,
  itemLabel = 'records',
  className = '',
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  // Generate page numbers to show (sliding window up to 5 buttons)
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (safePage <= 3) {
        pages.push(1, 2, 3, 4, 'ellipsis', totalPages);
      } else if (safePage >= totalPages - 2) {
        pages.push(1, 'ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, 'ellipsis', safePage - 1, safePage, safePage + 1, 'ellipsis', totalPages);
      }
    }
    return pages;
  };

  if (totalItems <= pageSize) {
    // If only 1 page with total items <= 10, still show the count if needed, or compact footer
    return (
      <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500 ${className}`}>
        <span>
          Showing <span className="font-semibold text-slate-800">{totalItems}</span> {itemLabel}
        </span>
        <span className="text-[11px] text-slate-400 font-medium">Page 1 of 1 (10 per page)</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500 ${className}`}>
      <div>
        Showing <span className="font-semibold text-slate-800">{startItem}</span> to{' '}
        <span className="font-semibold text-slate-800">{endItem}</span> of{' '}
        <span className="font-semibold text-slate-800">{totalItems}</span> {itemLabel}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {getPageNumbers().map((p, idx) => {
          if (p === 'ellipsis') {
            return (
              <span key={`ellipsis-${idx}`} className="px-1 text-slate-400">
                …
              </span>
            );
          }
          const isActive = p === safePage;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`inline-flex h-8 min-w-[32px] items-center justify-center rounded-lg px-2 text-xs font-semibold transition ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {p}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default TablePagination;
