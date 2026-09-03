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
