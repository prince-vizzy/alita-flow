import { INVENTORY_API_URL } from '../config';

export function isInventoryApiConfigured() {
  return Boolean(INVENTORY_API_URL);
}

export async function fetchLiveStock() {
  const res = await fetch(INVENTORY_API_URL);
  if (!res.ok) throw new Error(`Inventory fetch failed: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.items; // [{ id, name, price, stock }]
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
  return data.stock;
}

export async function sellItem(name, qty, unit, timestamp) {
  return postAction({ action: 'sell', name, qty, unit, timestamp });
}

export async function addStock(name, qty, unit, timestamp) {
  return postAction({ action: 'addStock', name, qty, unit, timestamp });
}
