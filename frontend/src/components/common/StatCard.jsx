import React from 'react';
import { Card } from './Card';
import Badge from './Badge';

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  badgeStatus,
  trend,
  trendPositive = true,
  trendLabel,
  className = '',
  loading = false,
  highlightColor = 'forest', // 'forest', 'gold', 'leaf', 'slate'
  footer,
}) {
  const highlightStyles = {
    forest: 'border-l-4 border-l-forest',
    gold: 'border-l-4 border-l-gold',
    leaf: 'border-l-4 border-l-leaf',
    slate: 'border-l-4 border-l-slate-400',
    rose: 'border-l-4 border-l-rose-500',
    none: '',
  }[highlightColor] || '';

  return (
    <Card
      className={`relative hover:shadow-card transition-all duration-200 ${highlightStyles} ${className}`}
      bodyClassName="p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {badgeStatus ? (
            <Badge status={badgeStatus} label={badge} size="sm" />
          ) : badge ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 font-medium border border-stone-200">
              {badge}
            </span>
          ) : null}
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-soybean-100 text-forest-700 flex items-center justify-center border border-forest-100/50 flex-shrink-0">
              <Icon className="w-4 h-4 text-forest" />
            </div>
          )}
        </div>
      </div>

      <div className="mt-1 flex items-baseline gap-2 flex-wrap">
        <div className="font-serif text-2xl lg:text-3xl font-bold text-ink tracking-tight">
          {value ?? '—'}
        </div>
        {trend !== undefined && trend !== null && (
          <span
            className={`text-xs font-bold px-1.5 py-0.5 rounded ${
              trendPositive
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-rose-50 text-rose-700'
            }`}
          >
            {trend}
          </span>
        )}
      </div>

      {trendLabel && (
        <span className="text-[11px] text-ink-muted block mt-0.5">{trendLabel}</span>
      )}

      {subtitle && (
        <p className="text-xs text-ink-muted mt-2 border-t border-stone-100 pt-2 flex items-center justify-between">
          <span>{subtitle}</span>
        </p>
      )}

      {footer && <div className="mt-3 pt-2 border-t border-stone-100 text-xs">{footer}</div>}
    </Card>
  );
}

export default StatCard;
