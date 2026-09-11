import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, RefreshCw, Search, WifiOff, X } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { DEFAULT_UNIT, UNITS } from '../data/units';
import InstallButton from '../components/InstallButton';

const LOW_STOCK_AT = 3;

// Stock-state filters, in the order they read: everything, then the two
// states worth acting on.
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'in', label: 'In stock' },
  { key: 'low', label: 'Low' },
  { key: 'out', label: 'Out' },
];

function matchesFilter(product, filter) {
  if (filter === 'in') return product.stock > 0;
  if (filter === 'low') return product.stock > 0 && product.stock <= LOW_STOCK_AT;
  if (filter === 'out') return product.stock <= 0;
  return true;
}

export default function ProductList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchBarVisible, setSearchBarVisible] = useState(true);
  const lastScrollY = useRef(0);
  const navigate = useNavigate();
  const { products, isOnline, pendingCount, syncError, clearSyncError } = useInventory();

  useEffect(() => {
    function handleScroll() {
      const y = window.scrollY;
      if (y < 40) {
        setSearchBarVisible(true);
      } else if (y > lastScrollY.current + 5) {
        setSearchBarVisible(false);
      } else if (y < lastScrollY.current - 5) {
        setSearchBarVisible(true);
      }
      lastScrollY.current = y;
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const searched = products.filter((p) => {
    const term = searchTerm.toLowerCase();
    return p.name.toLowerCase().includes(term) || (p.code && p.code.toLowerCase().includes(term));
  });
  const filtered = searched.filter((p) => matchesFilter(p, filter));

  // Suggestions ignore the chip filter — typing a name should find it even
  // when the current chip would have hidden it.
  const suggestions = searchTerm ? searched.slice(0, 6) : [];

  const counts = {
    all: products.length,
    in: products.filter((p) => matchesFilter(p, 'in')).length,
    low: products.filter((p) => matchesFilter(p, 'low')).length,
    out: products.filter((p) => matchesFilter(p, 'out')).length,
  };

  function goToProduct(id) {
    setShowSuggestions(false);
    navigate(`/shop/product/${id}`);
  }

  return (
    <div className="ground min-h-dvh text-ink flex flex-col items-center px-5 py-7 font-sans">
      <header className="w-full max-w-md mb-5 flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="p-2 -ml-2 rounded-full text-ink-3 hover:text-ink transition-colors shrink-0"
          aria-label="Back to sections"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="flex-1 text-xl font-light tracking-[0.22em] uppercase">
          Shop<span className="text-shop">.</span>
        </h1>
        <InstallButton />
      </header>

      {(!isOnline || pendingCount > 0 || syncError) && (
        <div className="w-full max-w-md mb-4 flex flex-col gap-2">
          {(!isOnline || pendingCount > 0) && (
            <span className="inline-flex w-fit items-center gap-2 text-xs font-medium text-trolley bg-trolley/10 border border-trolley/25 rounded-full px-3 py-1.5">
              {!isOnline ? (
                <WifiOff className="w-3.5 h-3.5" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              )}
              {!isOnline && pendingCount > 0
                ? `Offline · ${pendingCount} change${pendingCount === 1 ? '' : 's'} pending`
                : !isOnline
                  ? 'Offline'
                  : `Syncing ${pendingCount} change${pendingCount === 1 ? '' : 's'}…`}
            </span>
          )}
          {syncError && (
            <div className="glass flex items-center justify-between gap-2 text-xs text-[#e88b8b] rounded-2xl px-3 py-2">
              <span>{syncError}</span>
              <button onClick={clearSyncError} className="shrink-0 hover:text-ink" aria-label="Dismiss">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      <div
        className={`w-full max-w-md sticky top-2 z-20 transition-transform duration-300 ${
          searchBarVisible ? 'translate-y-0' : '-translate-y-28'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="glass-strong relative flex-1 flex items-center gap-2 rounded-full pl-4 pr-3 py-3">
            <Search className="w-4 h-4 shrink-0 text-ink-3" aria-hidden="true" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
              placeholder="Search items, codes…"
              aria-label="Search items"
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-3/70 focus:outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="shrink-0 text-ink-3 hover:text-ink transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowAddStock(true)}
            className="glass-strong shrink-0 w-12 h-12 rounded-2xl grid place-items-center text-sage hover:bg-white/[0.13] transition-colors"
            aria-label="Add stock"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="popover absolute left-0 right-0 mt-2 rounded-3xl overflow-hidden">
            {suggestions.map((product) => (
              <button
                key={product.id}
                onMouseDown={() => goToProduct(product.id)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.07] transition-colors border-b border-white/8 last:border-b-0"
              >
                <span className="min-w-0">
                  <span className="block text-sm text-ink truncate">{product.name}</span>
                  {product.code && (
                    <span className="block text-[10px] text-ink-3 tracking-wide">{product.code}</span>
                  )}
                </span>
                <span className="text-xs shrink-0 flex items-center gap-2">
                  {product.price > 0 && <span className="text-ink font-medium">{product.price}</span>}
                  <span className={product.stock > 0 ? 'text-shop' : 'text-trolley'}>
                    {product.stock > 0 ? `${product.stock} left` : 'out'}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stock-state chips: the filter row sits above everything it scopes. */}
      <div className="w-full max-w-md mt-4 mb-5 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={active}
              className={`shrink-0 rounded-2xl px-4 py-2 text-xs transition-colors border ${
                active
                  ? 'border-shop/35 bg-shop/12 text-shop'
                  : 'border-white/10 bg-white/[0.04] text-ink-3 hover:text-ink-2'
              }`}
            >
              {f.label}
              <span className="ml-1.5 opacity-60">{counts[f.key]}</span>
            </button>
          );
        })}
      </div>

      <main className="w-full max-w-md grid grid-cols-2 gap-3 pb-14">
        {filtered.map((product) => (
          <button
            key={product.id}
            onClick={() => navigate(`/shop/product/${product.id}`)}
            className="glass group text-left rounded-[26px] p-2.5 transition-transform duration-200 active:scale-[0.98] hover:bg-white/[0.075]"
          >
            <div className="photo-tile relative w-full aspect-[4/3] rounded-[20px] p-3 grid place-items-center overflow-hidden">
              {/* The photos are shot on white, which otherwise reads as a hard
                  square inside the rounded tile. Multiply blends their white
                  into the tile exactly, leaving only the product. */}
              <img
                src={product.image}
                alt={product.name}
                loading="lazy"
                className="max-h-full max-w-full object-contain mix-blend-multiply transition-transform duration-200 group-hover:scale-105"
              />
              {product.stock <= 0 && (
                <span className="absolute top-2 right-2 rounded-full bg-[#8a2f2f] text-white text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
                  Out
                </span>
              )}
            </div>

            <div className="px-1.5 pt-3 pb-1">
              <p className="text-[13px] text-ink leading-snug line-clamp-2 min-h-[2.4em]">
                {product.name}
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">
                  {product.price > 0 ? product.price : '—'}
                </span>
                <span
                  className={`text-[10px] rounded-full px-2 py-0.5 border ${
                    product.stock <= 0
                      ? 'text-trolley border-trolley/25 bg-trolley/10'
                      : product.stock <= LOW_STOCK_AT
                        ? 'text-trolley border-trolley/25 bg-trolley/10'
                        : 'text-shop border-shop/25 bg-shop/10'
                  }`}
                >
                  {product.stock <= 0 ? 'none' : `${product.stock} left`}
                </span>
              </div>
            </div>
          </button>
        ))}

        {filtered.length === 0 && (
          <p className="col-span-2 text-center text-sm text-ink-3 py-12">
            Nothing matches that yet.
          </p>
        )}
      </main>

      {showAddStock && <AddStockModal products={products} onClose={() => setShowAddStock(false)} />}
    </div>
  );
}

function AddStockModal({ products, onClose }) {
  const [productId, setProductId] = useState(null);
  const [itemSearch, setItemSearch] = useState('');
  const [showMatches, setShowMatches] = useState(false);
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState(DEFAULT_UNIT);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const { addStock } = useInventory();

  const selectedProduct = products.find((p) => String(p.id) === productId);
  const matches = products.filter((p) => {
    const term = itemSearch.toLowerCase();
    return p.name.toLowerCase().includes(term) || (p.code && p.code.toLowerCase().includes(term));
  });

  function selectProduct(p) {
    setProductId(String(p.id));
    setItemSearch(p.name);
    setShowMatches(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const product = products.find((p) => String(p.id) === productId);
    const qtyNum = Number(qty);
    if (!product || !qtyNum || qtyNum <= 0) return;

    setSaving(true);
    setMessage(null);
    try {
      const { stock, queued } = await addStock(product, qtyNum, unit);
      setMessage({
        type: 'success',
        text: queued
          ? `${product.name} will have ${stock} in stock — offline, will sync when back online.`
          : `${product.name} now has ${stock} in stock.`,
      });
      setQty('');
      setProductId(null);
      setItemSearch('');
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-6">
      <div className="sheet w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-[28px] p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-ink-3 hover:text-ink transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-lg font-light tracking-[0.14em] uppercase mb-6">Add stock</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="relative">
            <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-4 py-3">
              <Search className="w-4 h-4 shrink-0 text-ink-3" aria-hidden="true" />
              <input
                type="text"
                value={itemSearch}
                onChange={(e) => {
                  setItemSearch(e.target.value);
                  setShowMatches(true);
                  setProductId(null);
                }}
                onFocus={() => setShowMatches(true)}
                onBlur={() => setTimeout(() => setShowMatches(false), 100)}
                placeholder="Search item…"
                aria-label="Search item"
                className="w-full bg-transparent text-sm text-ink placeholder:text-ink-3/70 focus:outline-none"
              />
            </div>

            {showMatches && (
              <div className="popover mt-2 max-h-44 overflow-y-auto rounded-2xl">
                {matches.length === 0 && (
                  <p className="text-sm text-ink-3 px-4 py-3">No items match.</p>
                )}
                {matches.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={() => selectProduct(p)}
                    className="w-full text-left px-4 py-2.5 text-sm text-ink-2 hover:bg-white/[0.06] transition-colors"
                  >
                    {p.name}
                    {p.code && <span className="ml-2 text-xs text-ink-3">{p.code}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Qty"
              aria-label="Quantity"
              className="w-24 rounded-full border border-white/12 bg-white/[0.06] text-center text-sm text-ink placeholder:text-ink-3/70 py-3 px-4 focus:outline-none focus:border-sage/50"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              aria-label="Unit"
              className="flex-1 rounded-full border border-white/12 bg-white/[0.06] text-center text-sm text-ink py-3 px-4 focus:outline-none focus:border-sage/50 cursor-pointer"
            >
              {UNITS.map((u) => (
                <option key={u} className="bg-ground-2" value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={saving || !qty || !selectedProduct}
            className="pill-primary w-full rounded-full py-3.5 text-sm font-semibold tracking-wide transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Adding…' : 'Add stock'}
          </button>

          {message && (
            <p
              className={`text-sm text-center ${
                message.type === 'error' ? 'text-[#e88b8b]' : 'text-shop'
              }`}
            >
              {message.text}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
