import React from 'react';
import { Sprout } from 'lucide-react';
import Button from './Button';

export function EmptyState({
  icon: Icon = Sprout,
  title = 'No records found',
  description = 'There is currently no data recorded for this section.',
  actionLabel,
  onAction,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 md:p-12 bg-stone-50/60 rounded-2xl border border-dashed border-stone-300 ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-forest-50 border border-forest-100/80 flex items-center justify-center text-forest-600 mb-4 shadow-sm">
        <Icon className="w-7 h-7 text-forest" />
      </div>
      <h4 className="font-serif text-lg font-semibold text-ink mb-1">{title}</h4>
      <p className="text-sm text-ink-muted max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
