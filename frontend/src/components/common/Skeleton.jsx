import React from 'react';

export function Skeleton({ className = '', variant = 'text', width, height }) {
  const baseClasses = 'animate-pulse bg-stone-200/80 rounded';

  const style = {};
  if (width) style.width = width;
  if (height) style.height = height;

  if (variant === 'circle') {
    return <div className={`${baseClasses} rounded-full ${className}`} style={style} />;
  }

  if (variant === 'card') {
    return (
      <div className={`bg-white rounded-2xl border border-stone-200 p-6 shadow-soft space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="h-4 bg-stone-200 rounded w-1/3 animate-pulse" />
          <div className="h-6 w-16 bg-stone-200 rounded-full animate-pulse" />
        </div>
        <div className="h-8 bg-stone-200 rounded w-2/3 animate-pulse" />
        <div className="h-4 bg-stone-200 rounded w-1/2 animate-pulse" />
      </div>
    );
  }

  return <div className={`${baseClasses} ${className}`} style={style} />;
}

export function SkeletonRow({ cols = 4, className = '' }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-${cols} gap-4 ${className}`}>
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} variant="card" />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="w-full bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-soft">
      <div className="p-4 border-b border-stone-100 flex gap-4 bg-stone-50/50">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 bg-stone-200 rounded flex-1 animate-pulse" />
        ))}
      </div>
      <div className="divide-y divide-stone-100 p-2">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="p-4 flex gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="h-4 bg-stone-100 rounded flex-1 animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Skeleton;
