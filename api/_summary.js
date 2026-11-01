// What yesterday says, and how to say it in one line.
//
// Kept apart from api/notify.js so that the reading of the ledger has no idea
// anything is being pushed anywhere: everything here is a pure function of
// rows in, wording out. That is also what makes it checkable without a phone,
// a VAPID pair or a subscribed device.
//
// Underscore-prefixed files in api/ are not routes.

import { callGemini, isGeminiConfigured } from './_gemini.js';

// Vercel runs in UTC and the shop does not. Every day boundary here is
// Nairobi's, stated rather than inherited, so the notification can never
// disagree with the dashboard about which day a 9pm sale belongs to.
const SHOP_TIMEZONE = 'Africa/Nairobi';

export const SECTIONS = [
  { key: 'shop', business: 'Hardware', label: 'Shop' },
  { key: 'trolley', business: 'Trolley', label: 'Trolley' },
];

// A notification is a glance, so the model gets a tighter brief than the
// dashboard's — but not a tighter clock. Fifteen seconds was under this
// model's floor (a one-word answer round-trips in about eleven), so every
// line fell back to the plain figures. Both sections are written in parallel,
// which leaves this comfortably inside the function's own minute alongside
// the two sheet reads.
const GEMINI_TIMEOUT_MS = 35_000;
const MAX_BODY_CHARS = 180;

const SYSTEM = [
  'You write one-line push notifications for the owner of Alita Flow, a small hardware shop',
  'and food trolley in Kenya. You are given yesterday’s figures for one of the two.',
  'Write a single sentence, at most 180 characters, that tells the owner what yesterday means:',
  'name the item or the number that actually mattered, or say plainly that it was quiet.',
  'Money is Kenyan shillings, written as "KES 1,200".',
  'No markdown, no bullets, no greeting, no preamble like "Yesterday the shop".',
  'Do not repeat the net figure — it is already in the notification title.',
  'Use only what is in the JSON. Never invent an item or a number.',
].join(' ');

/* ---------------------------------- dates -------------------------------- */

const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: SHOP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// en-CA formats as YYYY-MM-DD, which sorts and compares as a plain string.
export function dayKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : DAY_FORMAT.format(date);
}

export function yesterdayKey(now = new Date()) {
  return dayKey(new Date(now.getTime() - 86_400_000));
}

// Midday UTC as the anchor, so stepping a day can never land on a boundary
// that rounds the wrong way when it is read back in Nairobi.
function shiftDay(key, delta) {
  const [year, month, day] = key.split('-').map(Number);
  return dayKey(new Date(Date.UTC(year, month - 1, day + delta, 12)));
}

function dayLabel(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/* -------------------------------- the figures ------------------------------ */

export function totalsFor(rows, business, day) {
  const items = new Map();
  let sales = 0;
  let spend = 0;
  let saleCount = 0;
  let units = 0;

  for (const row of rows) {
    if (row.business !== business || dayKey(row.date) !== day) continue;

    if (row.type === 'Sales') {
      const revenue = Number(row.sales) || 0;
      const qty = Number(row.qty) || 0;
      sales += revenue;
      units += qty;
      saleCount += 1;
      const entry = items.get(row.item) ?? { name: row.item, revenue: 0, units: 0 };
      entry.revenue += revenue;
      entry.units += qty;
      items.set(row.item, entry);
    } else if (row.type === 'Purchases') {
      spend += Number(row.expenses) || 0;
    }
  }

  return {
    sales: Math.round(sales),
    purchases: Math.round(spend),
    net: Math.round(sales - spend),
    salesLogged: saleCount,
    unitsSold: Math.round(units),
    topItems: [...items.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3)
      .map((i) => ({ name: i.name, revenue: Math.round(i.revenue), units: Math.round(i.units) })),
  };
}

// What the day is worth comparing against. Without this the model has no way
// to tell a good Tuesday from a bad one.
function recentAverage(rows, business, day) {
  let total = 0;
  for (let back = 1; back <= 7; back += 1) {
    total += totalsFor(rows, business, shiftDay(day, -back)).sales;
  }
  return Math.round(total / 7);
}

/* ------------------------------- the wording ------------------------------ */

const money = (value) => `KES ${Math.round(Number(value) || 0).toLocaleString('en-US')}`;

function titleFor(label, totals) {
  if (!totals.salesLogged && !totals.purchases) return `${label}: nothing recorded`;
  if (totals.net > 0) return `${label}: ${money(totals.net)} net`;
  if (totals.net < 0) return `${label}: ${money(Math.abs(totals.net))} down`;
  return `${label}: level`;
}

// What goes out when Gemini is slow, rate-limited, or switched off entirely.
// It says less, but it is never wrong and it always arrives.
function plainBody(totals) {
  if (!totals.salesLogged && !totals.purchases) {
    return 'No sales or purchases recorded yesterday.';
  }
  const parts = [`${money(totals.sales)} in, ${money(totals.purchases)} out`];
  const best = totals.topItems[0];
  if (best) parts.push(`best was ${best.name} at ${money(best.revenue)}`);
  return `${parts.join(' · ')}.`;
}

// The model is asked for one plain line; this is what catches it when it
// reaches for a bullet or a second paragraph anyway.
function tidy(text) {
  const line = text
    .split('\n')
    .map((part) => part.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean)[0];
  if (!line) return '';
  return line.length > MAX_BODY_CHARS ? `${line.slice(0, MAX_BODY_CHARS - 1).trimEnd()}…` : line;
}

/* ------------------------------ putting it together ------------------------ */

// The JSON the model is asked to read. Small on purpose — a notification line
// needs yesterday, something to compare it against, and the one thing unique
// to that section.
export function digestFor(section, ledger, waste, day) {
  const rows = ledger.transactions ?? [];

  const digest = {
    section: section.key,
    date: day,
    currency: 'KES',
    yesterday: totalsFor(rows, section.business, day),
    dayBefore: totalsFor(rows, section.business, shiftDay(day, -1)),
    averageDailySalesWeekBefore: recentAverage(rows, section.business, day),
  };

  if (section.key === 'shop' && ledger.stock) {
    digest.stock = { outOfStock: ledger.stock.outOfStock, lowStock: ledger.stock.lowStock };
  }
  if (section.key === 'trolley') {
    // Recorded as spoilt at that day's close.
    const spoilt = (waste ?? []).find((entry) => entry.date === day);
    digest.spoiltUnits = spoilt ? spoilt.total : 0;
    digest.spoiltItems = spoilt?.items ?? [];
  }

  return digest;
}

export async function composeNotification(section, ledger, waste, day) {
  const digest = digestFor(section, ledger, waste, day);
  const totals = digest.yesterday;

  const title = titleFor(section.label, totals);
  let body = plainBody(totals);
  let writtenBy = 'figures';

  if (isGeminiConfigured()) {
    const result = await callGemini({
      system: SYSTEM,
      input: `Write the notification line for the ${section.key}.\n\n${JSON.stringify(digest)}`,
      timeoutMs: GEMINI_TIMEOUT_MS,
      temperature: 0.5,
    });
    if (result.ok) {
      const line = tidy(result.text);
      if (line) {
        body = line;
        writtenBy = 'gemini';
      }
    } else {
      // A summary that arrives in plainer words beats one that does not
      // arrive, so this is logged and stepped over.
      console.error(`Gemini could not write the ${section.key} line`, result.error);
    }
  }

  return {
    section: section.key,
    title,
    body,
    writtenBy,
    tag: `alita-${section.key}-summary`,
    url: '/dashboard',
    date: day,
    dateLabel: dayLabel(day),
  };
}

export function composeNotifications(ledger, waste, day) {
  return Promise.all(SECTIONS.map((section) => composeNotification(section, ledger, waste, day)));
}
