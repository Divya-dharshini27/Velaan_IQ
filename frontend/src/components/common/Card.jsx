import React from 'react';

export function Card({
  children,
  title,
  subtitle,
  action,
  icon: Icon,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  hoverEffect = false,
  badge = null,
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-stone-200/80 shadow-soft overflow-hidden transition-all duration-200 ${
        hoverEffect ? 'hover:shadow-card hover:border-forest-200' : ''
      } ${className}`}
    >
      {(title || subtitle || action || Icon || badge) && (
        <div
          className={`px-6 py-4 border-b border-stone-100 flex items-center justify-between gap-4 flex-wrap bg-white/50 ${headerClassName}`}
        >
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="w-9 h-9 rounded-xl bg-forest-50 text-forest-700 flex items-center justify-center border border-forest-100/80 shadow-sm flex-shrink-0">
                <Icon className="w-5 h-5 text-forest" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {title && (
                  <h3 className="font-serif text-lg font-semibold text-ink tracking-tight">
                    {title}
                  </h3>
                )}
                {badge}
              </div>
              {subtitle && (
                <p className="text-xs text-ink-muted mt-0.5 font-normal">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={`p-6 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

export default Card;
