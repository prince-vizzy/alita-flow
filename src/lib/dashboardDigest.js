// A compact snapshot of whatever the dashboard is currently showing, small
// enough to send up on every range or tab change.
//
// Only aggregates travel. The raw ledger is both far larger and full of detail
// a written summary has no use for, and it stays on the device that fetched it.

import { formatRangeLabel } from './dashboardStats';

const round = (value) => Math.round(Number(value) || 0);

// Two decimals is more than a shopkeeper's margin ever needs, and a long
// float is pure token cost.
const pct = (value) => (value == null ? null : Math.round(value * 1000) / 10);

// Enough of the axis to see a shape, from the end that matters. A 90-day
// window at daily granularity would otherwise be most of the payload.
const TREND_BUCKETS = 30;

function trend(stats) {
  const from = Math.max(0, stats.buckets.length - TREND_BUCKETS);
  return {
    unit: stats.granularity,
    labels: stats.bucketLabels.slice(from),
    sales: stats.seriesSales.slice(from).map(round),
    net: stats.seriesNet.slice(from).map(round),
  };
}

function namedItems(rows, pick, limit = 6) {
  return (rows ?? []).slice(0, limit).map(pick);
}

export function buildDigest({ section, range, stats, previous, stock, kitchen, waste, today }) {
  const digest = {
    section,
    currency: 'KES',
    lowStockThreshold: 3,
    period: {
      label: formatRangeLabel(stats.window.startKey, stats.window.endKey),
      days: range.days ?? stats.span,
      bucketedBy: stats.granularity,
      tradingPeriods: stats.activeBuckets,
      hasActivity: stats.hasActivity,
    },
    totals: {
      sales: round(stats.totalSales),
      purchases: round(stats.totalSpend),
      net: round(stats.net),
      marginPercent: pct(stats.margin),
      salesLogged: stats.saleCount,
      unitsSold: round(stats.itemsSold),
      averageSale: round(stats.avgSale),
    },
    // Absent on "All time", where there is no equal-length window to compare.
    previousPeriod: previous
      ? {
          sales: round(previous.totalSales),
          purchases: round(previous.totalSpend),
          net: round(previous.net),
        }
      : null,
    trend: trend(stats),
    bestPeriod: stats.best ? { label: stats.best.label, sales: round(stats.best.value) } : null,
    topByRevenue: namedItems(stats.topByRevenue, (i) => ({
      name: i.name,
      revenue: round(i.revenue),
      units: round(i.qty),
    })),
    topByUnits: namedItems(stats.topByUnits, (i) => ({ name: i.name, units: round(i.qty) })),
    // Only the items actually underwater — the positive end of this list is
    // already covered by topByRevenue.
    losingMoney: namedItems(
      (stats.netByItem ?? []).filter((i) => i.net < 0),
      (i) => ({ name: i.name, net: round(i.net), revenue: round(i.revenue), spend: round(i.spend) })
    ),
    salesByWeekday:
      stats.granularity === 'day'
        ? stats.weekday.map((d) => ({ day: d.label, sales: round(d.sales) }))
        : null,
  };

  if (stock) {
    digest.stock = {
      live: stock.live,
      itemsTracked: stock.tracked ?? null,
      outOfStock: stock.outOfStock,
      lowStock: stock.lowStock,
      unitsOnHand: stock.unitsOnHand == null ? null : round(stock.unitsOnHand),
      retailValue: stock.retailValue == null ? null : round(stock.retailValue),
      // What the owner would act on, worst first — the same list the stock
      // table below the charts shows.
      needsAttention: namedItems(stock.attention, (i) => ({
        name: i.name,
        stock: round(i.stock),
        price: round(i.price),
      }), 12),
    };
  }

  if (today) {
    digest.today = {
      sales: round(today.totalSales),
      expenses: round(today.totalSpend),
      net: round(today.net),
      unitsSold: round(today.itemsSold),
      salesLogged: today.saleCount,
    };
  }

  if (kitchen) {
    digest.kitchen = {
      cookedUnitsLeft: round(kitchen.cookedUnits),
      rawUnitsLeft: round(kitchen.rawUnits),
      cookedValueLeft: round(kitchen.cookedValue),
      sellThroughPercent: pct(kitchen.sellThrough),
    };
  }

  // The raw waste rows, not the view built for the chart — that one formats
  // its totals into strings for display.
  if (Array.isArray(waste) && waste.length) {
    const scoped = waste.filter((day) => day.date >= stats.window.startKey);
    if (scoped.length) {
      digest.waste = {
        // Leftovers are cooked but never sold, so they read as what guessing
        // the day wrong costs the trolley.
        days: scoped.length,
        totalUnits: round(scoped.reduce((sum, day) => sum + (Number(day.total) || 0), 0)),
        worstDays: [...scoped]
          .sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0))
          .slice(0, 5)
          .map((day) => ({
            date: day.date,
            units: round(day.total),
            items: (day.items ?? []).map((i) => `${i.name} x${round(i.qty)}`).join(', '),
          })),
      };
    }
  }

  return digest;
}

/* ---------------------------------- book --------------------------------- */

// Everything the app holds, as opposed to the slice on screen: the full price
// list and stock position for both businesses, and what the whole ledger says
// about every item ever traded. Without this a question like "what hasn't
// sold in months" or "what is a Bulb 9W worth" can't be answered at all,
// because the on-screen digest only ever carries one section over one range.
//
// It is rebuilt only when the dashboard refetches, and every question in a
// session reuses it.

// Sorted by revenue, so if this ever has to be trimmed it loses the items
// that matter least.
const MAX_LEDGER_ITEMS = 400;

function lifetimeByItem(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = `${row.business}\u0000${row.item}`;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        business: row.business,
        item: row.item,
        revenue: 0,
        units: 0,
        spend: 0,
        sales: 0,
        firstDay: row.day,
        lastSoldDay: null,
      };
      map.set(key, entry);
    }
    if (row.day < entry.firstDay) entry.firstDay = row.day;
    if (row.type === 'Sales') {
      entry.revenue += Number(row.sales) || 0;
      entry.units += Number(row.qty) || 0;
      entry.sales += 1;
      if (!entry.lastSoldDay || row.day > entry.lastSoldDay) entry.lastSoldDay = row.day;
    } else if (row.type === 'Purchases') {
      entry.spend += Number(row.expenses) || 0;
    }
  }

  return [...map.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, MAX_LEDGER_ITEMS)
    .map((e) => ({
      business: e.business,
      item: e.item,
      revenue: round(e.revenue),
      units: round(e.units),
      spend: round(e.spend),
      net: round(e.revenue - e.spend),
      sales: e.sales,
      firstDay: e.firstDay,
      lastSoldDay: e.lastSoldDay,
    }));
}

function monthlyByBusiness(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = `${row.business}\u0000${row.day.slice(0, 7)}`;
    let entry = map.get(key);
    if (!entry) {
      entry = { business: row.business, month: row.day.slice(0, 7), sales: 0, purchases: 0 };
      map.set(key, entry);
    }
    if (row.type === 'Sales') entry.sales += Number(row.sales) || 0;
    else if (row.type === 'Purchases') entry.purchases += Number(row.expenses) || 0;
  }
  return [...map.values()]
    .sort((a, b) => a.month.localeCompare(b.month) || a.business.localeCompare(b.business))
    .map((e) => ({ ...e, sales: round(e.sales), purchases: round(e.purchases) }));
}

// The price list the shop actually works from: the catalogue's own codes and
// prices, with live stock written over them wherever the sheet has a figure
// for that name.
function priceList(catalogue, liveItems) {
  const live = new Map((liveItems ?? []).map((item) => [item.name, item]));
  return (catalogue ?? []).map((product) => {
    const current = live.get(product.name);
    return {
      code: product.code ?? null,
      name: product.name,
      price: round(current?.price ?? product.price),
      stock: round(current?.stock ?? product.stock),
    };
  });
}

export function buildBook({ rows = [], catalogue, shopItems, trolleyItems, waste }) {
  const items = priceList(catalogue, shopItems);
  const days = rows.map((r) => r.day).filter(Boolean).sort();

  return {
    note: 'The whole book, not the view on screen. Use it for anything the on-screen digest cannot answer.',
    currency: 'KES',
    ledgerCovers: days.length ? { from: days[0], to: days[days.length - 1], rows: rows.length } : null,
    shop: {
      itemsInCatalogue: items.length,
      stockIsLive: Boolean(shopItems),
      outOfStock: items.filter((i) => i.stock <= 0).length,
      lowStock: items.filter((i) => i.stock > 0 && i.stock <= 3).length,
      unitsOnHand: items.reduce((sum, i) => sum + Math.max(i.stock, 0), 0),
      retailValue: items.reduce((sum, i) => sum + Math.max(i.stock, 0) * i.price, 0),
      // Every item the shop sells, with its code, price and what is left.
      priceList: items,
    },
    trolley: (trolleyItems ?? []).map((item) => ({
      name: item.name,
      price: round(item.price),
      rawStock: round(item.regularStock),
      cookedStock: round(item.cookedStock),
    })),
    // One row per item per business across the entire ledger.
    lifetimeByItem: lifetimeByItem(rows),
    monthlyByBusiness: monthlyByBusiness(rows),
    trolleyWaste: (waste ?? []).map((day) => ({
      date: day.date,
      units: round(day.total),
      items: (day.items ?? []).map((i) => `${i.name} x${round(i.qty)}`).join(', '),
    })),
  };
}
