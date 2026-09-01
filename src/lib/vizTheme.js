// Chart palette + shared formatters for the dashboard.
//
// Colors are the dataviz reference palette's dark column, re-validated
// against this app's own chart surface (#0d0f12) rather than the skill's
// default surface:
//
//   node scripts/validate_palette.js "#3987e5,#d95926,#199e70,#c98500" \
//     --mode dark --surface "#0d0f12"
//   → all checks PASS (worst adjacent CVD ΔE 8.4 protan, normal-vision 19.8)
//
// The four categorical slots are assigned in fixed order and never cycled or
// re-sorted by rank, so an item keeps its color when a filter changes which
// items are on screen.
export const SURFACE = '#0d0f12';

export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500'];

// Named roles for the two-series charts every panel shares, so "sales is
// blue, money going out is orange" holds across the whole dashboard.
export const SALES_COLOR = SERIES[0];
export const SPEND_COLOR = SERIES[1];

// Diverging pair for net-per-item (warm/cool poles, gray-free midpoint at 0).
// Validated as a pair on this surface: CVD ΔE 19.2, normal-vision 29.0.
export const DIVERGING = { positive: '#3987e5', negative: '#e66767' };

// Fixed status palette — never themed, never reused as a series color, and
// always shipped with an icon + label so the color is not carrying the
// meaning alone.
export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
};

export const INK = {
  primary: '#ffffff',
  secondary: '#c3c2b7',
  muted: '#898781',
  grid: '#2c2c2a',
  axis: '#383835',
};

/* ------------------------------ formatters ------------------------------- */

export function formatCompact(value) {
  const n = Math.round(Number(value) || 0);
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString();
}

export function formatMoney(value) {
  return `KES ${formatCompact(value)}`;
}

export function formatExact(value) {
  return Math.round(Number(value) || 0).toLocaleString();
}

export function formatUnits(value) {
  const n = Number(value) || 0;
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1);
}

export function formatPercent(value, digits = 0) {
  if (!Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}
