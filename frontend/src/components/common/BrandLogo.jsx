import React from 'react';

export function BrandLogo({
  variant = 'dark', // 'dark' (for sidebar/dark bg), 'light' (for cream/white bg)
  size = 'md',     // 'sm', 'md', 'lg'
  showTagline = true,
  className = '',
}) {
  const isDark = variant === 'dark';

  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
  }[size] || 'w-9 h-9';

  const titleSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
  }[size] || 'text-xl';

  const tamilSizes = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  }[size] || 'text-xs';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Soybean Pod & Leaf SVG Icon */}
      <div
        className={`${iconSizes} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
          isDark
            ? 'bg-forest-900 border border-forest-700/60'
            : 'bg-forest-50 border border-forest-200/80'
        }`}
      >
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full p-1.5"
        >
          {/* Soybean Pod */}
          <path
            d="M13 36C10 27 13 16 24 8C35 16 38 27 35 36C32 41 28 43 24 43C20 43 16 41 13 36Z"
            fill={isDark ? '#3E9B5F' : '#14432A'}
          />
          {/* Pod Center Seam */}
          <path
            d="M24 9C24 16 25 28 24 43"
            stroke={isDark ? '#14432A' : '#3E9B5F'}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Golden Soybean Seeds */}
          <circle cx="24" cy="18" r="4" fill="#D9A441" />
          <circle cx="24" cy="27" r="4.2" fill="#D9A441" />
          <circle cx="24" cy="35" r="3.6" fill="#D9A441" />
          {/* Upper Leaf Sprout */}
          <path
            d="M24 9C27 4 35 4 39 7C41 12 37 17 31 18C27 16 25 13 24 9Z"
            fill="#D9A441"
          />
        </svg>
      </div>

      {/* Typography */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span
            className={`font-serif font-bold tracking-tight ${titleSizes} ${
              isDark ? 'text-white' : 'text-forest'
            }`}
          >
            VELAAN IQ
          </span>
          <span
            className={`px-1.5 py-0.5 text-[9px] font-semibold tracking-wider rounded uppercase ${
              isDark
                ? 'bg-forest-700/80 text-gold-light border border-gold/30'
                : 'bg-forest-100 text-forest-800 border border-forest-200'
            }`}
          >
            ABT-CPD
          </span>
        </div>
        <span
          className={`font-tamil font-medium leading-tight ${tamilSizes} ${
            isDark ? 'text-forest-200' : 'text-earth'
          }`}
        >
          வேளாண் IQ
        </span>
        {showTagline && (
          <span
            className={`text-[10px] tracking-wide mt-0.5 hidden sm:block ${
              isDark ? 'text-stone-300' : 'text-ink-muted'
            }`}
          >
            Soybean procurement intelligence
          </span>
        )}
      </div>
    </div>
  );
}

export default BrandLogo;
