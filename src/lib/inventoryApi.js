import { INVENTORY_API_URL } from '../config';

export function isInventoryApiConfigured() {
  return Boolean(INVENTORY_API_URL);
}

async function getJson(params = {}) {
  const url = new URL(INVENTORY_API_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Inventory fetch failed: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function postAction(payload) {
  // Sent as text/plain so the browser treats this as a "simple request" and
  // skips a CORS preflight — Apps Script web apps don't handle OPTIONS.
  const res = await fetch(INVENTORY_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

/* ---------------------------------- Shop --------------------------------- */

export async function fetchLiveStock() {
  const data = await getJson();
  return data.items; // [{ id, name, price, stock }]
}

export async function sellItem(name, qty, unit, timestamp) {
  const data = await postAction({ action: 'sell', name, qty, unit, timestamp });
  return data.stock;
}

export async function addStock(name, qty, unit, timestamp) {
  const data = await postAction({ action: 'addStock', name, qty, unit, timestamp });
  return data.stock;
}

/* -------------------------------- Trolley -------------------------------- */

export async function fetchTrolleyStock() {
  const data = await getJson({ section: 'trolley' });
  return data.items; // [{ id, name, price, regularStock, cookedStock }]
}

// Restocking raw/uncooked supply — increases regular stock.
export async function addTrolleyStock(name, qty, unit, timestamp) {
  return postAction({ section: 'trolley', action: 'addStock', name, qty, unit, timestamp });
}

// Moves qty out of regular stock and into today's cooked stock.
export async function cookTrolleyItem(name, qty, unit, timestamp) {
  return postAction({ section: 'trolley', action: 'cook', name, qty, unit, timestamp });
}

// Sells from cooked stock only. `amount`, when given, is an explicit KES
// total for portion-priced items (Arrow Roots, Sweet Potatoes) — overrides
// the default qty x per-unit-price calculation.
export async function sellTrolleyItem(name, qty, unit, timestamp, amount) {
  return postAction({ section: 'trolley', action: 'sell', name, qty, unit, timestamp, amount });
}

// Per-day leftovers (cooked but never sold), most recent day first.
export async function fetchTrolleyWaste(days = 7) {
  const data = await getJson({ section: 'trolley', report: 'waste', days });
  return data.waste; // [{ date, items: [{ name, qty }], total }]
}

// Logs a cash cost for a non-stock ingredient (onions, tomatoes, …) — no
// quantity/unit, just a name and a KES amount.
export async function logTrolleyExpense(name, amount, timestamp) {
  return postAction({ section: 'trolley', action: 'expense', name, qty: amount, timestamp });
}

/* -------------------------------- Dashboard ------------------------------- */

export async function fetchDashboardData() {
  const data = await getJson({ section: 'dashboard' });
  return data; // { transactions: [...], stock: { outOfStock, lowStock } }
}
