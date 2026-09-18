import React from 'react';

export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full space-y-3 p-4 animate-pulse" aria-busy="true" aria-label="Loading data">
      <div className="h-8 bg-slate-200 rounded-md w-1/4 mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <div className="h-10 bg-slate-200 rounded-md flex-1" />
          <div className="h-10 bg-slate-200 rounded-md w-24" />
          <div className="h-10 bg-slate-200 rounded-md w-16" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm animate-pulse" aria-busy="true">
      <div className="h-4 bg-slate-200 rounded w-1/3 mb-4" />
      <div className="h-8 bg-slate-200 rounded w-1/2 mb-2" />
      <div className="h-3 bg-slate-200 rounded w-2/3" />
    </div>
  );
}
