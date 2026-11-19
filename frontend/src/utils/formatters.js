/**
 * Utility formatters for VELAAN IQ
 * Handles string decimals, Indian currency formatting (en-IN),
 * USD, quantities in MT, and IST timestamps.
 */

export function parseNum(val, fallback = 0) {
  if (val === null || val === undefined || val === '') return fallback;
  const n = Number(val);
  return Number.isNaN(n) ? fallback : n;
}

export function formatINR(val, digits = 2) {
  if (val === null || val === undefined || val === '') return '—';
  const num = parseNum(val);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(num);
}

export function formatUSD(val, digits = 2) {
  if (val === null || val === undefined || val === '') return '—';
  const num = parseNum(val);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(num);
}

export function formatCurrency(val, currency = 'INR', digits = 2) {
  if (currency === 'USD') return formatUSD(val, digits);
  return formatINR(val, digits);
}

export function formatMT(val, digits = 2) {
  if (val === null || val === undefined || val === '') return '—';
  const num = parseNum(val);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(num);
  return `${formatted} MT`;
}

export function formatNumber(val, digits = 2) {
  if (val === null || val === undefined || val === '') return '—';
  const num = parseNum(val);
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(num);
}

export function formatPercent(val, digits = 2) {
  if (val === null || val === undefined || val === '') return '—';
  const num = parseNum(val);
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(digits)}%`;
}

/**
 * Format timestamp in Asia/Kolkata (IST)
 */
export function formatDateIST(dateStr, includeTime = true) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);

    const options = {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...(includeTime ? { hour: '2-digit', minute: '2-digit', hour12: true } : {}),
    };
    return new Intl.DateTimeFormat('en-IN', options).format(d);
  } catch {
    return String(dateStr);
  }
}

/**
 * Display relative age: "2 days ago", "3 hours ago", "just now"
 */
export function formatRelativeTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateStr);

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 30) {
      return formatDateIST(dateStr, false);
    }
    if (diffDay >= 1) {
      return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    }
    if (diffHour >= 1) {
      return `${diffHour} hr${diffHour > 1 ? 's' : ''} ago`;
    }
    if (diffMin >= 1) {
      return `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
    }
    return 'just now';
  } catch {
    return String(dateStr);
  }
}
