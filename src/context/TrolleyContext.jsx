import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { TROLLEY_PRODUCTS } from '../data/trolleyProducts';
import {
  addTrolleyStock,
  closeTrolleyDay,
  fetchTrolleyStock,
  isInventoryApiConfigured,
  logTrolleyExpense,
} from '../lib/inventoryApi';
import { enqueueAction, getQueue, removeAction } from '../lib/offlineQueue';

const TrolleyContext = createContext(null);

// A new key rather than the old one: what the old cache holds is raw and cooked
// counts under item names the sheet no longer uses.
const CACHE_KEY = 'alita-flow-trolley-cache-v2';
const SYNCED_AT_KEY = 'alita-flow-trolley-last-synced';

// The offline queue is shared with the shop, so only ever touch trolley entries.
function trolleyQueue() {
  return getQueue().filter((a) => a.section === 'trolley');
}

// Local calendar day, as YYYY-MM-DD.
function today() {
  return new Date().toLocaleDateString('en-CA');
}

// The figures the server sends for an item, onto the catalog's name and photo.
function withLive(product, live) {
  return {
    ...product,
    price: Number(live.price) || 0,
    counted: Boolean(live.counted),
    openingStock: Number(live.openingStock) || 0,
    addedToday: Number(live.addedToday) || 0,
    soldToday: Number(live.soldToday) || 0,
    spoiltToday: Number(live.spoiltToday) || 0,
    takingsToday: Number(live.takingsToday) || 0,
    closeSold: Number(live.closeSold) || 0,
    closeSpoilt: Number(live.closeSpoilt) || 0,
    closeTakings: Number(live.closeTakings) || 0,
    available: Number(live.available) || 0,
    closingStock: Number(live.closingStock) || 0,
    closed: Boolean(live.closed),
  };
}

function mergeLive(products, items) {
  const byName = new Map(items.map((i) => [i.name, i]));
  return products.map((p) => (byName.has(p.name) ? withLive(p, byName.get(p.name)) : p));
}

// Last night's closing is this morning's opening, so a device that hasn't
// reached the server yet today can still show the right day.
function rolledOver(product) {
  return {
    ...product,
    openingStock: product.closingStock,
    addedToday: 0,
    soldToday: 0,
    spoiltToday: 0,
    takingsToday: 0,
    closeSold: 0,
    closeSpoilt: 0,
    closeTakings: 0,
    available: product.closingStock,
    closed: false,
  };
}

// The item list always comes from TROLLEY_PRODUCTS; the cache only lends its
// figures to items it already knew. Unlike the shop, the trolley can't just
// drop its cache when the list changes: it holds figures the server hasn't
// seen yet (stock added or a day closed offline). So a newly added item turns
// up on every device, and one taken off the list goes away, without touching
// anyone's pending figures.
function loadCachedProducts() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { day, products } = JSON.parse(raw);
    if (!Array.isArray(products)) return null;
    const byName = new Map(products.map((p) => [p.name, p]));
    return TROLLEY_PRODUCTS.map((p) => {
      const known = byName.get(p.name);
      if (!known) return p;
      const merged = { ...known, id: p.id, image: p.image, emoji: p.emoji };
      return day === today() ? merged : rolledOver(merged);
    });
  } catch {
    return null;
  }
}

function cacheProducts(products) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ day: today(), products }));
  localStorage.setItem(SYNCED_AT_KEY, String(Date.now()));
}

// A close queued offline, shown as if the server had already taken it.
function applyClose(product, line) {
  if (!product.counted) {
    return { ...product, closed: true, closeTakings: line.takings, takingsToday: line.takings };
  }
  const othersSold = product.soldToday - product.closeSold;
  const othersSpoilt = product.spoiltToday - product.closeSpoilt;
  return {
    ...product,
    closed: true,
    closeSold: line.sold,
    closeSpoilt: line.spoilt,
    soldToday: othersSold + line.sold,
    spoiltToday: othersSpoilt + line.spoilt,
    takingsToday: (othersSold + line.sold) * product.price,
    closingStock: product.available - line.sold - line.spoilt,
  };
}

export function TrolleyProvider({ children }) {
  const [products, setProducts] = useState(() => loadCachedProducts() ?? TROLLEY_PRODUCTS);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState(null);
  const [pendingCount, setPendingCount] = useState(() => trolleyQueue().length);
  const [syncError, setSyncError] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(() => {
    const raw = localStorage.getItem(SYNCED_AT_KEY);
    return raw ? Number(raw) : null;
  });

  const applyLive = useCallback((items) => {
    setProducts((prev) => {
      const next = mergeLive(prev, items);
      cacheProducts(next);
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!isInventoryApiConfigured() || !navigator.onLine) return;
    try {
      applyLive(await fetchTrolleyStock());
      setIsLive(true);
      setError(null);
      setLastSyncedAt(Date.now());
    } catch (err) {
      setError(err.message);
    }
  }, [applyLive]);

  const syncQueue = useCallback(async () => {
    if (!isInventoryApiConfigured() || !navigator.onLine) return;
    for (const action of trolleyQueue()) {
      try {
        if (action.type === 'close') {
          await closeTrolleyDay(action.lines, action.timestamp);
        } else if (action.type === 'expense') {
          await logTrolleyExpense(action.name, action.qty, action.timestamp);
        } else if (action.type === 'addStock') {
          await addTrolleyStock(action.name, action.qty, action.cost, action.timestamp);
        } else {
          // A sale or cook queued by the old version of the app. There's nowhere
          // to send it now, so say what it was rather than dropping it quietly.
          throw new Error('single sales are no longer recorded — include it in the day close');
        }
        removeAction(action.id);
      } catch (err) {
        if (err instanceof TypeError) break; // still offline — retry later, keep the rest queued
        // A real server error (e.g. more entered than was on hand) can't be
        // retried, so drop it and surface it rather than lose it.
        removeAction(action.id);
        setSyncError(`Couldn't sync ${action.type} of "${action.name ?? 'the day'}": ${err.message}`);
      }
      setPendingCount(trolleyQueue().length);
    }
    await refresh();
  }, [refresh]);

  useEffect(() => {
    refresh();
    syncQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleOnline() {
      syncQueue();
    }
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [syncQueue]);

  // Both stock writes try the server first when online, and fall back to
  // queueing only when the failure was the network itself. The server answers
  // with the whole list, since one close touches every item.
  const send = useCallback(
    async (call, queued, applyOffline) => {
      if (navigator.onLine) {
        try {
          const { items } = await call();
          applyLive(items);
          return { queued: false };
        } catch (err) {
          if (!(err instanceof TypeError)) throw err; // a real server error, not offline
        }
      }

      enqueueAction({ section: 'trolley', ...queued });
      setPendingCount(trolleyQueue().length);
      setProducts((prev) => {
        const next = prev.map(applyOffline);
        cacheProducts(next);
        return next;
      });
      return { queued: true };
    },
    [applyLive]
  );

  // Stock coming in. `cost` is what the whole delivery cost, if known.
  const addStock = useCallback(
    (product, qty, cost) => {
      const timestamp = Date.now();
      return send(
        () => addTrolleyStock(product.name, qty, cost, timestamp),
        { type: 'addStock', name: product.name, qty, cost, timestamp },
        (p) =>
          p.id === product.id
            ? {
                ...p,
                addedToday: p.addedToday + qty,
                available: p.available + qty,
                closingStock: p.closingStock + qty,
              }
            : p
      );
    },
    [send]
  );

  // The end-of-day record. `lines` holds { name, sold, spoilt } for counted
  // items and { name, takings } for the rest. Closing again the same day
  // corrects the earlier figures rather than adding to them.
  const closeDay = useCallback(
    (lines) => {
      const timestamp = Date.now();
      const byName = new Map(lines.map((line) => [line.name, line]));
      return send(
        () => closeTrolleyDay(lines, timestamp),
        { type: 'close', lines, timestamp },
        (p) => (byName.has(p.name) ? applyClose(p, byName.get(p.name)) : p)
      );
    },
    [send]
  );

  // Logs a cash cost for a non-stock ingredient — no product, no stock
  // delta, just a name and a KES amount going straight to the dashboard.
  const expense = useCallback(async (name, amount) => {
    const timestamp = Date.now();

    if (navigator.onLine) {
      try {
        await logTrolleyExpense(name, amount, timestamp);
        return { queued: false };
      } catch (err) {
        if (!(err instanceof TypeError)) throw err; // a real server error, not offline
      }
    }

    enqueueAction({ section: 'trolley', type: 'expense', name, qty: amount, timestamp });
    setPendingCount(trolleyQueue().length);
    return { queued: true };
  }, []);

  const value = {
    products,
    isLive,
    error,
    pendingCount,
    syncError,
    clearSyncError: () => setSyncError(null),
    lastSyncedAt,
    refresh,
    addStock,
    closeDay,
    expense,
  };

  return <TrolleyContext.Provider value={value}>{children}</TrolleyContext.Provider>;
}

export function useTrolley() {
  const ctx = useContext(TrolleyContext);
  if (!ctx) throw new Error('useTrolley must be used within TrolleyProvider');
  return ctx;
}
