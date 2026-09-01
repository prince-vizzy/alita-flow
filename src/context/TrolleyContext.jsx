import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { TROLLEY_PRODUCTS } from '../data/trolleyProducts';
import {
  addTrolleyStock,
  cookTrolleyItem,
  fetchTrolleyStock,
  isInventoryApiConfigured,
  logTrolleyExpense,
  sellTrolleyItem,
} from '../lib/inventoryApi';
import { enqueueAction, getQueue, removeAction } from '../lib/offlineQueue';

const TrolleyContext = createContext(null);

const CACHE_KEY = 'alita-flow-trolley-cache';
const SYNCED_AT_KEY = 'alita-flow-trolley-last-synced';

// The offline queue is shared with the shop, so only ever touch trolley entries.
function trolleyQueue() {
  return getQueue().filter((a) => a.section === 'trolley');
}

// Local calendar day, as YYYY-MM-DD.
function today() {
  return new Date().toLocaleDateString('en-CA');
}

function loadCachedProducts() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { day, products } = JSON.parse(raw);
    if (!Array.isArray(products)) return null;
    // Cooked stock is a per-day figure. If the cache is from an earlier day
    // it's already stale — the server will have rolled it into waste — so
    // show zero rather than yesterday's leftovers.
    if (day !== today()) {
      return products.map((p) => ({ ...p, cookedStock: 0 }));
    }
    return products;
  } catch {
    return null;
  }
}

function cacheProducts(products) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ day: today(), products }));
  localStorage.setItem(SYNCED_AT_KEY, String(Date.now()));
}

function applyDelta(products, productId, regularDelta, cookedDelta) {
  const next = products.map((p) =>
    p.id === productId
      ? {
          ...p,
          regularStock: p.regularStock + regularDelta,
          cookedStock: p.cookedStock + cookedDelta,
        }
      : p
  );
  cacheProducts(next);
  return next;
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

  const refresh = useCallback(async () => {
    if (!isInventoryApiConfigured() || !navigator.onLine) return;
    try {
      const liveItems = await fetchTrolleyStock();
      const byName = new Map(liveItems.map((i) => [i.name, i]));
      setProducts((prev) => {
        const next = prev.map((p) => {
          const live = byName.get(p.name);
          if (!live) return p;
          return {
            ...p,
            price: Number(live.price) || p.price,
            regularStock: Number(live.regularStock) || 0,
            cookedStock: Number(live.cookedStock) || 0,
          };
        });
        cacheProducts(next);
        return next;
      });
      setIsLive(true);
      setError(null);
      setLastSyncedAt(Date.now());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const syncQueue = useCallback(async () => {
    if (!isInventoryApiConfigured() || !navigator.onLine) return;
    for (const action of trolleyQueue()) {
      try {
        if (action.type === 'sell') {
          await sellTrolleyItem(action.name, action.qty, action.unit, action.timestamp, action.amount);
        } else if (action.type === 'cook') {
          await cookTrolleyItem(action.name, action.qty, action.unit, action.timestamp);
        } else if (action.type === 'expense') {
          await logTrolleyExpense(action.name, action.qty, action.timestamp);
        } else {
          await addTrolleyStock(action.name, action.qty, action.unit, action.timestamp);
        }
        removeAction(action.id);
      } catch (err) {
        if (err instanceof TypeError) break; // still offline — retry later, keep the rest queued
        // A real server error (e.g. not enough stock by the time it synced)
        // can't be retried, so drop it and surface it rather than lose it.
        removeAction(action.id);
        setSyncError(`Couldn't sync ${action.type} of "${action.name}": ${err.message}`);
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

  // Shared by all three mutations: try the server first when online, and fall
  // back to queueing only when the failure was the network itself.
  const mutate = useCallback(
    async ({ type, product, qty, unit, amount, regularDelta, cookedDelta, call }) => {
      const timestamp = Date.now();

      if (navigator.onLine) {
        try {
          const result = await call(product.name, qty, unit, timestamp, amount);
          setProducts((prev) => {
            const next = prev.map((p) =>
              p.id === product.id
                ? {
                    ...p,
                    regularStock: Number(result.regularStock),
                    cookedStock: Number(result.cookedStock),
                  }
                : p
            );
            cacheProducts(next);
            return next;
          });
          return {
            regularStock: Number(result.regularStock),
            cookedStock: Number(result.cookedStock),
            queued: false,
          };
        } catch (err) {
          if (!(err instanceof TypeError)) throw err; // a real server error, not offline
        }
      }

      enqueueAction({ section: 'trolley', type, name: product.name, qty, unit, amount, timestamp });
      setPendingCount(trolleyQueue().length);
      setProducts((prev) => applyDelta(prev, product.id, regularDelta, cookedDelta));
      return {
        regularStock: product.regularStock + regularDelta,
        cookedStock: product.cookedStock + cookedDelta,
        queued: true,
      };
    },
    []
  );

  // Restocking raw supply.
  const addStock = useCallback(
    (product, qty, unit) =>
      mutate({
        type: 'addStock',
        product,
        qty,
        unit,
        regularDelta: qty,
        cookedDelta: 0,
        call: addTrolleyStock,
      }),
    [mutate]
  );

  // Moving raw stock onto the grill — regular down, cooked up.
  const cook = useCallback(
    (product, qty, unit) => {
      if (qty > product.regularStock) throw new Error('Not enough regular stock to cook');
      return mutate({
        type: 'cook',
        product,
        qty,
        unit,
        regularDelta: -qty,
        cookedDelta: qty,
        call: cookTrolleyItem,
      });
    },
    [mutate]
  );

  // Customers only ever buy cooked stock. `amount` is an explicit KES total
  // for portion-priced items (Arrow Roots, Sweet Potatoes) — omit it for
  // everything else and the server falls back to qty x per-unit price.
  const sell = useCallback(
    (product, qty, unit, amount) => {
      if (qty > product.cookedStock) throw new Error('Not enough cooked stock');
      return mutate({
        type: 'sell',
        product,
        qty,
        unit,
        amount,
        regularDelta: 0,
        cookedDelta: -qty,
        call: sellTrolleyItem,
      });
    },
    [mutate]
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
    cook,
    sell,
    expense,
  };

  return <TrolleyContext.Provider value={value}>{children}</TrolleyContext.Provider>;
}

export function useTrolley() {
  const ctx = useContext(TrolleyContext);
  if (!ctx) throw new Error('useTrolley must be used within TrolleyProvider');
  return ctx;
}
