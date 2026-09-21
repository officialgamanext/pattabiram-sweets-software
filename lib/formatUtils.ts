/**
 * Currency and Number Formatting Utilities for Pattabiram Sweets
 * Formats Indian Currency without trailing .00 for whole numbers
 */

export function formatINR(val: number | string | null | undefined, prefix = '₹'): string {
  if (val === null || val === undefined || val === '') return `${prefix} 0`.trim();
  const n = typeof val === 'string' ? parseFloat(val) : Number(val);
  if (isNaN(n)) return `${prefix} 0`.trim();
  const formatted = n.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  });
  return prefix ? `${prefix} ${formatted}` : formatted;
}

export function formatINRClean(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return '₹0';
  const n = typeof val === 'string' ? parseFloat(val) : Number(val);
  if (isNaN(n)) return '₹0';
  return '₹' + n.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  });
}

export function formatNumber(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return '0';
  const n = typeof val === 'string' ? parseFloat(val) : Number(val);
  if (isNaN(n)) return '0';
  return n.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  });
}

export function formatCompactINR(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return '₹0';
  const n = typeof val === 'string' ? parseFloat(val) : Number(val);
  if (isNaN(n)) return '₹0';
  if (n >= 10000000) {
    const cr = (n / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    return `₹${cr} Cr`;
  }
  if (n >= 100000) {
    const lk = (n / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    return `₹${lk} L`;
  }
  if (n >= 1000) {
    const k = (n / 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 });
    return `₹${k} K`;
  }
  return `₹${Math.round(n)}`;
}
