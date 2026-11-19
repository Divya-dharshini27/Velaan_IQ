import React from 'react';

const STATUS_CONFIGS = {
  // Decision actions
  BUY: {
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    dot: 'bg-emerald-600',
    label: 'BUY',
  },
  WAIT: {
    bg: 'bg-amber-50 text-amber-800 border-amber-200/80',
    dot: 'bg-amber-500',
    label: 'WAIT',
  },
  REVIEW: {
    bg: 'bg-slate-100 text-slate-800 border-slate-300',
    dot: 'bg-slate-600',
    label: 'REVIEW',
  },

  // Inventory statuses
  HEALTHY: {
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-600',
    label: 'Healthy',
  },
  WATCH: {
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    label: 'Watch',
  },
  REORDER_REQUIRED: {
    bg: 'bg-orange-50 text-orange-800 border-orange-200',
    dot: 'bg-orange-600',
    label: 'Reorder Required',
  },
  CRITICAL: {
    bg: 'bg-rose-50 text-rose-800 border-rose-200',
    dot: 'bg-rose-600',
    label: 'Critical',
  },
  DATA_INSUFFICIENT: {
    bg: 'bg-stone-100 text-stone-700 border-stone-200',
    dot: 'bg-stone-400',
    label: 'Data Insufficient',
  },

  // Sourcing routes
  DOMESTIC: {
    bg: 'bg-forest-50 text-forest-800 border-forest-200',
    dot: 'bg-forest-600',
    label: 'Domestic',
  },
  INTERNATIONAL: {
    bg: 'bg-amber-50 text-gold-dark border-amber-200/90',
    dot: 'bg-gold',
    label: 'International',
  },
  MIXED: {
    bg: 'bg-teal-50 text-teal-800 border-teal-200',
    dot: 'bg-teal-600',
    label: 'Mixed Routes',
  },

  // Data Quality Statuses
  VALID: {
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Valid Data',
  },
  WARNING: {
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    label: 'Warning',
  },
  UNUSUAL_CHANGE: {
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    label: 'Unusual Change',
  },
  STALE: {
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    label: 'Stale Data',
  },
  INCOMPLETE: {
    bg: 'bg-orange-50 text-orange-800 border-orange-200',
    dot: 'bg-orange-500',
    label: 'Incomplete',
  },
  BASELINE_FALLBACK: {
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    label: 'Baseline Used',
  },
  CONFIRMED: {
    bg: 'bg-blue-50 text-blue-800 border-blue-200',
    dot: 'bg-blue-500',
    label: 'Confirmed',
  },
  IN_TRANSIT: {
    bg: 'bg-purple-50 text-purple-800 border-purple-200',
    dot: 'bg-purple-500',
    label: 'In Transit',
  },
  RECEIVED: {
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
    label: 'Received',
  },
  CANCELLED: {
    bg: 'bg-stone-100 text-stone-600 border-stone-200',
    dot: 'bg-stone-400',
    label: 'Cancelled',
  },
};

export function Badge({
  status,
  label,
  size = 'md',
  dot = true,
  className = '',
  customColor = null,
}) {
  const normKey = (status || '').toUpperCase().trim();
  const config = STATUS_CONFIGS[normKey] || {
    bg: 'bg-stone-100 text-stone-700 border-stone-200',
    dot: 'bg-stone-400',
    label: status || 'Unknown',
  };

  const displayText = label !== undefined ? label : config.label;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-semibold',
    lg: 'text-sm px-3.5 py-1.5 font-bold tracking-wide',
  }[size] || 'text-xs px-2.5 py-1 font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border transition-colors ${
        customColor || config.bg
      } ${sizeClasses} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            normKey === 'BUY' || normKey === 'CRITICAL' ? 'animate-pulse' : ''
          } ${config.dot}`}
        />
      )}
      <span>{displayText}</span>
    </span>
  );
}

export default Badge;
