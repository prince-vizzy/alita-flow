// All dashboard aggregation lives here so the page component stays a layout.
//
// The API ships raw ledger rows ({ business, date, item, qty, type, sales,
// expenses }); everything the dashboard shows is derived from them here.

/* --------------------------------- dates -------------------------------- */

// Day key in the shop's *local* calendar day (en-CA formats as YYYY-MM-DD).
// Transaction dates arrive as UTC ISO strings, so slicing the string directly
// would file anything logged before 03:00 EAT under the previous day.
export function dayKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-CA');
}

export function todayKey() {
  return dayKey(new Date());
}

function parseDayKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function shiftDays(key, delta) {
  const date = parseDayKey(key);
  date.setDate(date.getDate() + delta);
  return dayKey(date);
}

function daysBetween(startKey, endKey) {
  const ms = parseDayKey(endKey) - parseDayKey(startKey);
  return Math.round(ms / 86400000) + 1;
}

function enumerateDays(startKey, endKey) {
  const out = [];
  let cursor = startKey;
  // Guard against a stray far-past row producing a runaway axis.
  while (cursor <= endKey && out.length < 800) {
    out.push(cursor);
    cursor = shiftDays(cursor, 1);
  }
  return out;
}

function enumerateMonths(startKey, endKey) {
  const out = [];
  const cursor = parseDayKey(`${startKey.slice(0, 7)}-01`);
  const end = parseDayKey(`${endKey.slice(0, 7)}-01`);
  while (cursor <= end && out.length < 240) {
    out.push(dayKey(cursor).slice(0, 7));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

// Weeks run Monday to Sunday and are numbered the ISO way, because that is
// what the sheet's own Week column does (ISOWEEKNUM, "Wk-36") — the dashboard's
// weekly breakdown has to land every sale in the same week the sheet's
// Weekly Report does, or the two could never be checked against each other.
function weekStartKey(key) {
  const date = parseDayKey(key);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return dayKey(date);
}

function isoWeekNumber(key) {
  // The week belongs to whichever year its Thursday falls in.
  const thursday = parseDayKey(key);
  thursday.setDate(thursday.getDate() + 3 - ((thursday.getDay() + 6) % 7));
  const jan4 = new Date(thursday.getFullYear(), 0, 4);
  return 1 + Math.round(((thursday - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}

function enumerateWeeks(startKey, endKey) {
  const out = [];
  let cursor = weekStartKey(startKey);
  while (cursor <= endKey && out.length < 520) {
    out.push(cursor);
    cursor = shiftDays(cursor, 7);
  }
  return out;
}

export function formatWeekLabel(key) {
  return `Wk-${String(isoWeekNumber(key)).padStart(2, '0')}`;
}

// "Aug 31 – Sep 6": what a week number means, for the table beside it.
export function formatWeekSpan(key) {
  return `${formatDayLabel(key)} – ${formatDayLabel(shiftDays(key, 6))}`;
}

export function formatDayLabel(key) {
  return parseDayKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// "Aug '26" — a bare "Aug 26" reads as a day of the month on an axis that
// also carries daily labels elsewhere on the page.
export function formatMonthLabel(key) {
  const month = parseDayKey(`${key}-01`).toLocaleDateString(undefined, { month: 'short' });
  return `${month} '${key.slice(2, 4)}`;
}

export function formatRangeLabel(startKey, endKey) {
  if (startKey === endKey) return formatDayLabel(startKey);
  const sameYear = startKey.slice(0, 4) === endKey.slice(0, 4);
  const start = parseDayKey(startKey).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : '2-digit',
  });
  return `${start} to ${formatDayLabel(endKey)}`;
}

/* --------------------------------- ranges -------------------------------- */

export const RANGES = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: 'all', label: 'All time', days: null },
];

// The window a range preset resolves to, plus the equal-length window
// immediately before it — that second window is what every "vs previous"
// delta on the KPI tiles is measured against.
export function resolveWindow(range, rows) {
  const endKey = todayKey();
  if (range.days) {
    const startKey = shiftDays(endKey, -(range.days - 1));
    return {
      startKey,
      endKey,
      previous: { startKey: shiftDays(startKey, -range.days), endKey: shiftDays(startKey, -1) },
    };
  }
  const dated = rows.map((r) => r.day).filter(Boolean).sort();
  return { startKey: dated[0] ?? endKey, endKey, previous: null };
}

/* ------------------------------- aggregation ----------------------------- */

export function normalize(transactions) {
  return transactions
    .map((t) => ({ ...t, day: dayKey(t.date) }))
    .filter((t) => t.day && t.item);
}

function sumBy(rows, pick) {
  return rows.reduce((acc, row) => acc + (Number(pick(row)) || 0), 0);
}

function inWindow(rows, { startKey, endKey }) {
  return rows.filter((r) => r.day >= startKey && r.day <= endKey);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Totals only — used for the previous window, where no charts are drawn and
// only the headline numbers are needed for the deltas.
export function computeTotals(rows, window) {
  const scoped = inWindow(rows, window);
  const sales = scoped.filter((t) => t.type === 'Sales');
  const purchases = scoped.filter((t) => t.type === 'Purchases');
  const totalSales = sumBy(sales, (t) => t.sales);
  const totalSpend = sumBy(purchases, (t) => t.expenses);
  return {
    totalSales,
    totalSpend,
    net: totalSales - totalSpend,
    saleCount: sales.length,
    itemsSold: sumBy(sales, (t) => t.qty),
    avgSale: sales.length ? totalSales / sales.length : 0,
    margin: totalSales ? (totalSales - totalSpend) / totalSales : null,
  };
}

// The full picture for one window: totals, a continuous time axis (gap days
// are zeros, never silently collapsed), per-item breakdowns and a weekday
// profile.
export function computeStats(rows, window, { itemOrder = [] } = {}) {
  const totals = computeTotals(rows, window);
  const scoped = inWindow(rows, window);
  const sales = scoped.filter((t) => t.type === 'Sales');
  const purchases = scoped.filter((t) => t.type === 'Purchases');

  const span = daysBetween(window.startKey, window.endKey);
  // Past a quarter of daily points the axis stops being readable, so the same
  // data rolls up to months. Charts read `granularity` and relabel themselves
  // rather than each deciding on their own.
  const granularity = span <= 92 ? 'day' : 'month';
  const buckets =
    granularity === 'day'
      ? enumerateDays(window.startKey, window.endKey)
      : enumerateMonths(window.startKey, window.endKey);
  const bucketOf = (row) => (granularity === 'day' ? row.day : row.day.slice(0, 7));

  const index = new Map(buckets.map((key, i) => [key, i]));
  const seriesSales = buckets.map(() => 0);
  const seriesSpend = buckets.map(() => 0);
  const seriesQty = buckets.map(() => 0);

  sales.forEach((t) => {
    const i = index.get(bucketOf(t));
    if (i === undefined) return;
    seriesSales[i] += Number(t.sales) || 0;
    seriesQty[i] += Number(t.qty) || 0;
  });
  purchases.forEach((t) => {
    const i = index.get(bucketOf(t));
    if (i === undefined) return;
    seriesSpend[i] += Number(t.expenses) || 0;
  });

  const bucketLabels = buckets.map((key) =>
    granularity === 'day' ? formatDayLabel(key) : formatMonthLabel(key)
  );

  // Weekly and monthly roll-ups are always available alongside the main axis,
  // bucketed exactly as the sheet's Weekly and Monthly Report tabs bucket
  // them, so the breakdown card can show either without re-aggregating.
  const rollUp = (keys, keyOf) => {
    const index = new Map(keys.map((key, i) => [key, i]));
    const totalSales = keys.map(() => 0);
    const totalSpend = keys.map(() => 0);
    sales.forEach((t) => {
      const i = index.get(keyOf(t.day));
      if (i !== undefined) totalSales[i] += Number(t.sales) || 0;
    });
    purchases.forEach((t) => {
      const i = index.get(keyOf(t.day));
      if (i !== undefined) totalSpend[i] += Number(t.expenses) || 0;
    });
    return [totalSales, totalSpend];
  };
  const monthKeys = enumerateMonths(window.startKey, window.endKey);
  const [monthlySales, monthlySpend] = rollUp(monthKeys, (day) => day.slice(0, 7));
  const weekKeys = enumerateWeeks(window.startKey, window.endKey);
  const [weeklySales, weeklySpend] = rollUp(weekKeys, weekStartKey);

  // Per item: revenue, units, what was spent under that same name, and the
  // ledger's own net for it — no cost-allocation model, just its own rows.
  const itemMap = new Map();
  const itemRow = (name) => {
    if (!itemMap.has(name)) itemMap.set(name, { name, revenue: 0, spend: 0, qty: 0, count: 0 });
    return itemMap.get(name);
  };
  sales.forEach((t) => {
    const row = itemRow(t.item);
    row.revenue += Number(t.sales) || 0;
    row.qty += Number(t.qty) || 0;
    row.count += 1;
  });
  purchases.forEach((t) => {
    itemRow(t.item).spend += Number(t.expenses) || 0;
  });
  const items = [...itemMap.values()].map((row) => ({ ...row, net: row.revenue - row.spend }));

  // Weekday profile — daily granularity only; over a monthly axis it would
  // compare an unequal count of each weekday and read as noise.
  const weekdayTotals = WEEKDAYS.map((label) => ({ label, sales: 0, days: new Set() }));
  sales.forEach((t) => {
    const slot = weekdayTotals[parseDayKey(t.day).getDay()];
    slot.sales += Number(t.sales) || 0;
    slot.days.add(t.day);
  });
  // Monday-first reads better for a trading week than the JS Sunday-first order.
  const weekday = [...weekdayTotals.slice(1), weekdayTotals[0]].map((slot) => ({
    label: slot.label,
    sales: slot.sales,
    activeDays: slot.days.size,
  }));

  const bestIndex = seriesSales.reduce((best, value, i) => (value > seriesSales[best] ? i : best), 0);
  const activeBuckets = seriesSales.filter((v) => v > 0).length;

  return {
    ...totals,
    window,
    span,
    granularity,
    buckets,
    bucketLabels,
    seriesSales,
    seriesSpend,
    seriesQty,
    seriesNet: seriesSales.map((v, i) => v - seriesSpend[i]),
    monthKeys,
    monthLabels: monthKeys.map(formatMonthLabel),
    monthlySales,
    monthlySpend,
    weekKeys,
    weekLabels: weekKeys.map(formatWeekLabel),
    weeklySales,
    weeklySpend,
    items,
    topByRevenue: [...items]
      .filter((i) => i.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8),
    topByUnits: [...items]
      .filter((i) => i.qty > 0)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8),
    netByItem: [...items]
      .filter((i) => i.revenue > 0 || i.spend > 0)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      .slice(0, 8)
      .sort((a, b) => b.net - a.net),
    weekday,
    best: activeBuckets ? { label: bucketLabels[bestIndex], value: seriesSales[bestIndex] } : null,
    avgPerActiveBucket: activeBuckets ? totals.totalSales / activeBuckets : 0,
    activeBuckets,
    // Units sold per bucket split by item — a grouped series in a fixed item
    // order, so an item keeps its color slot no matter what sold that day.
    qtyByItem: buildQtyByItem(sales, buckets, bucketOf, itemOrder),
    hasActivity: scoped.length > 0,
  };
}

function buildQtyByItem(sales, buckets, bucketOf, itemOrder) {
  const names = [...new Set(sales.map((t) => t.item))].sort((a, b) => {
    const ai = itemOrder.indexOf(a);
    const bi = itemOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  const index = new Map(buckets.map((key, i) => [key, i]));
  // Four slots is the categorical ceiling for grouped bars here; anything
  // past that would need a generated hue, which is never the answer.
  return names.slice(0, 4).map((name) => {
    const values = buckets.map(() => 0);
    sales
      .filter((t) => t.item === name)
      .forEach((t) => {
        const i = index.get(bucketOf(t));
        if (i !== undefined) values[i] += Number(t.qty) || 0;
      });
    return { name, values };
  });
}

// Today's trading, independent of the selected range — the trolley runs a
// daily cycle (opening stock in the morning, closed at night), so these stay
// pinned to today whatever window the rest of the page shows.
export function computeToday(rows) {
  const key = todayKey();
  const today = rows.filter((t) => t.day === key);
  const sales = today.filter((t) => t.type === 'Sales');
  const totalSales = sumBy(sales, (t) => t.sales);
  const totalSpend = sumBy(
    today.filter((t) => t.type === 'Purchases'),
    (t) => t.expenses
  );
  return {
    totalSales,
    totalSpend,
    net: totalSales - totalSpend,
    itemsSold: sumBy(sales, (t) => t.qty),
    saleCount: sales.length,
  };
}

// Percentage change against the previous equal-length window. Null when
// there's no comparable window (All time) or the baseline was zero — a
// percentage against zero is noise, not a signal.
export function delta(current, previous) {
  if (previous == null || !Number.isFinite(previous) || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}
