import React from 'react';

export function PageLoadingSkeleton() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      {/* Top subtle indeterminate progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-amber-500/20 z-50 overflow-hidden pointer-events-none">
        <div className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 animate-progress-bar rounded-full" />
      </div>

      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200/70">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-200 rounded-lg" />
          <div className="h-4 w-72 bg-slate-100 rounded-md" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-28 bg-slate-200 rounded-xl" />
          <div className="h-10 w-32 bg-amber-200/60 rounded-xl" />
        </div>
      </div>

      {/* KPI / Metric Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-3.5 w-20 bg-slate-200 rounded" />
              <div className="w-8 h-8 rounded-lg bg-slate-100" />
            </div>
            <div className="h-6 w-28 bg-slate-200 rounded-md" />
            <div className="h-3 w-36 bg-slate-100 rounded" />
          </div>
        ))}
      </div>

      {/* Filter / Search Bar Skeleton */}
      <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="h-10 w-full sm:w-72 bg-slate-100 rounded-xl" />
        <div className="flex items-center gap-2">
          <div className="h-10 w-24 bg-slate-100 rounded-xl" />
          <div className="h-10 w-24 bg-slate-100 rounded-xl" />
        </div>
      </div>

      {/* Table / List Skeleton */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="h-4 w-32 bg-slate-200 rounded" />
          <div className="h-4 w-16 bg-slate-100 rounded" />
        </div>
        <div className="divide-y divide-slate-100">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100" />
                <div className="space-y-1.5">
                  <div className="h-4 w-40 bg-slate-200 rounded" />
                  <div className="h-3 w-24 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="hidden sm:block h-4 w-24 bg-slate-100 rounded" />
              <div className="hidden md:block h-4 w-20 bg-slate-100 rounded" />
              <div className="h-7 w-20 bg-slate-200 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PageLoadingSkeleton;
