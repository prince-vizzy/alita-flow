import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { PRODUCTS } from '../data/products';
import {
  addStock as addStockApi,
  fetchLiveStock,
  isInventoryApiConfigured,
  sellItem,
} from '../lib/inventoryApi';
import { enqueueAction, getQueue, removeAction } from '../lib/offlineQueue';

const InventoryContext = createContext(null);

const CACHE_KEY = 'alita-flow-products-cache';
const SYNCED_AT_KEY = 'alita-flow-last-synced';

// The offline queue is shared with the trolley section, so only ever touch
// the entries belonging to the shop.
function shopQueue() {
  return getQueue().filter((a) => a.section === 'shop');
}

function loadCachedProducts() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function cacheProducts(products) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(products));
  localStorage.setItem(SYNCED_AT_KEY, String(Date.now()));
}

function applyStockDelta(products, productId, delta) {
  const next = products.map((p) => (p.id === productId ? { ...p, stock: p.stock + delta } : p));
  cacheProducts(next);
  return next;
}

export function InventoryProvider({ children }) {
  const [products, setProducts] = useState(() => loadCachedProducts() ?? PRODUCTS);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(() => shopQueue().length);
  const [syncError, setSyncError] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(() => {
    const raw = localStorage.getItem(SYNCED_AT_KEY);
    return raw ? Number(raw) : null;
  });

  const refresh = useCallback(async () => {
    if (!isInventoryApiConfigured() || !navigator.onLine) return;
    try {
      const liveItems = await fetchLiveStock();
      const stockByName = new Map(liveItems.map((i) => [i.name, i.stock]));
      setProducts((prev) => {
        const next = prev.map((p) =>
          stockByName.has(p.name) ? { ...p, stock: Number(stockByName.get(p.name)) } : p
        );
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
    for (const action of shopQueue()) {
      try {
        if (action.type === 'sell') {
          await sellItem(action.name, action.qty, action.unit, action.timestamp);
        } else {
          await addStockApi(action.name, action.qty, action.unit, action.timestamp);
        }
        removeAction(action.id);
      } catch (err) {
        if (err instanceof TypeError) break; // still offline — retry later, keep the rest queued
        // A real error from the server (e.g. stock ran out in the meantime) can't be retried.
        removeAction(action.id);
        setSyncError(`Couldn't sync ${action.type} of "${action.name}": ${err.message}`);
      }
      setPendingCount(shopQueue().length);
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
      setIsOnline(true);
      syncQueue();
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncQueue]);

  const sell = useCallback(async (product, qty, unit) => {
    if (qty > product.stock) throw new Error('Not enough stock');
    const timestamp = Date.now();

    if (navigator.onLine) {
      try {
        const newStock = await sellItem(product.name, qty, unit, timestamp);
        setProducts((prev) => {
          const next = prev.map((p) =>
            p.id === product.id ? { ...p, stock: Number(newStock) } : p
          );
          cacheProducts(next);
          return next;
        });
        return { stock: newStock, queued: false };
      } catch (err) {
        if (!(err instanceof TypeError)) throw err; // a real server error, not offline
      }
    }

    enqueueAction({ section: 'shop', type: 'sell', name: product.name, qty, unit, timestamp });
    setPendingCount(shopQueue().length);
    const newStock = product.stock - qty;
    setProducts((prev) => applyStockDelta(prev, product.id, -qty));
    return { stock: newStock, queued: true };
  }, []);

  const addStock = useCallback(async (product, qty, unit) => {
    const timestamp = Date.now();

    if (navigator.onLine) {
      try {
        const newStock = await addStockApi(product.name, qty, unit, timestamp);
        setProducts((prev) => {
          const next = prev.map((p) =>
            p.id === product.id ? { ...p, stock: Number(newStock) } : p
          );
          cacheProducts(next);
          return next;
        });
        return { stock: newStock, queued: false };
      } catch (err) {
        if (!(err instanceof TypeError)) throw err;
      }
    }

    enqueueAction({ section: 'shop', type: 'addStock', name: product.name, qty, unit, timestamp });
    setPendingCount(shopQueue().length);
    const newStock = product.stock + qty;
    setProducts((prev) => applyStockDelta(prev, product.id, qty));
    return { stock: newStock, queued: true };
  }, []);

  const value = {
    products,
    isLive,
    error,
    isOnline,
    pendingCount,
    syncError,
    clearSyncError: () => setSyncError(null),
    lastSyncedAt,
    refresh,
    sell,
    addStock,
  };

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error('useInventory must be used within InventoryProvider');
  return ctx;
}
