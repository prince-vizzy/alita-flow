import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, X, Download, Share, WifiOff, RefreshCw } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useInstallPrompt } from '../context/InstallPromptContext';

export default function ProductList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  const [showInstallTip, setShowInstallTip] = useState(false);
  const [searchBarVisible, setSearchBarVisible] = useState(true);
  const lastScrollY = useRef(0);
  const navigate = useNavigate();
  const { products, isOnline, pendingCount, syncError, clearSyncError } = useInventory();
  const { canInstall, isIos, installed, install } = useInstallPrompt();

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

  function handleDownloadClick() {
    if (canInstall) {
      install();
    } else {
      setShowInstallTip((v) => !v);
    }
  }

  function installTipText() {
    if (isIos) return 'Tap the Share icon, then "Add to Home Screen".';
    return "Your browser hasn't offered to install this app yet — try reloading the page, or use Chrome/Edge on Android or desktop.";
  }

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const suggestions = searchTerm ? filtered.slice(0, 6) : [];

  function goToProduct(id) {
    setShowSuggestions(false);
    navigate(`/product/${id}`);
  }

  return (
    <div className="min-h-dvh bg-[#0a0c0e] text-white flex flex-col items-center px-4 py-6 font-sans relative">

      {/* Background Glow Effects / Constellation simulation */}
      <div className="absolute inset-0 bg-[radial-gradient(#15803d_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

      {/* Header / Logo */}
      <header className="w-full max-w-md mb-6 flex items-center justify-between">
        <h1
          className="text-3xl sm:text-4xl font-extrabold text-[#00ff88] tracking-wider drop-shadow-[0_0_10px_#00ff88]"
          style={{ fontFamily: "'Caveat', 'Comic Sans MS', cursive" }}
        >
          Alita Flow<span className="text-purple-400">.</span>
        </h1>
        <div className="flex items-center gap-2 relative">
          {!installed && (
            <button
              onClick={handleDownloadClick}
              className="p-2 rounded-full text-[#00ff88] border border-[#00ff88]/50 hover:bg-[#00ff88]/10 transition-colors"
              aria-label="Install app"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          {showInstallTip && (
            <div className="absolute top-full right-0 mt-2 w-56 bg-[#0d0f12] border border-[#00ff88]/30 rounded-xl p-3 shadow-2xl z-30 text-xs text-gray-300 flex items-start gap-1.5">
              {isIos && <Share className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#00ff88]" />}
              <span>{installTipText()}</span>
            </div>
          )}
          <button
            onClick={() => setShowAddStock(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-[#00ff88] border border-[#00ff88]/50 hover:bg-[#00ff88]/10 transition-colors rounded-full px-3 py-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Stock
          </button>
        </div>
      </header>

      {(!isOnline || pendingCount > 0 || syncError) && (
        <div className="w-full max-w-md mb-4 flex flex-col gap-2 z-10">
          {(!isOnline || pendingCount > 0) && (
            <div className="flex items-center gap-2 text-xs font-medium text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-full px-3 py-1.5 w-fit">
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
            </div>
          )}
          {syncError && (
            <div className="flex items-center justify-between gap-2 text-xs text-red-400 bg-red-400/10 border border-red-400/30 rounded-2xl px-3 py-2">
              <span>{syncError}</span>
              <button onClick={clearSyncError} className="shrink-0 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Glowing Search Bar */}
      <div
        className={`w-full max-w-md mb-10 sticky top-2 z-20 transition-transform duration-300 ${
          searchBarVisible ? 'translate-y-0' : '-translate-y-24'
        }`}
      >
        <div className="relative group">
          {/* Glowing Outer Shadow Container */}
          <div className="absolute -inset-1 bg-gradient-to-r from-[#00cc66] via-[#00ff88] to-[#00cc66] rounded-full blur-md opacity-80 group-hover:opacity-100 transition duration-300"></div>

          <div className="relative flex items-center bg-[#0d0f12] rounded-full border border-[#00ff88]/50 px-4 py-2.5 shadow-2xl">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
              placeholder="Angle Valve Double"
              className="w-full bg-transparent text-gray-300 placeholder-gray-500 text-sm focus:outline-none px-2"
            />
            <button className="p-1.5 rounded-full bg-[#00ff88]/10 text-[#00ff88] hover:text-white transition-colors">
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#0d0f12] border border-[#00ff88]/30 rounded-2xl shadow-2xl overflow-hidden">
            {suggestions.map((product) => (
              <button
                key={product.id}
                onMouseDown={() => goToProduct(product.id)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#00ff88]/10 transition-colors border-b border-gray-800 last:border-b-0"
              >
                <span className="text-sm text-gray-200 truncate">{product.name}</span>
                <span className="text-xs text-[#00ff88] shrink-0">{product.stock} in stock</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product Grid */}
      <main className="w-full max-w-md grid grid-cols-2 gap-x-4 gap-y-8 pb-12 z-10">
        {filtered.map((product) => (
          <div
            key={product.id}
            onClick={() => navigate(`/product/${product.id}`)}
            className="flex flex-col items-center group cursor-pointer"
          >
            {/* Rounded Pill Container for Image */}
            <div className="relative w-full aspect-[4/3] bg-white rounded-[2.5rem] flex items-center justify-center p-3 shadow-lg transform transition duration-200 group-hover:scale-105">
              <img
                src={product.image}
                alt={product.name}
                className="max-h-full max-w-full object-contain"
              />
              {product.stock === 0 && (
                <span className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
                  Out
                </span>
              )}
            </div>
            {/* Product Title */}
            <p className="mt-3 text-sm font-medium text-gray-200 text-center tracking-wide">
              {product.name}
            </p>
            <p className="text-xs text-[#00ff88]">{product.stock} in stock</p>
          </div>
        ))}
      </main>

      {showAddStock && (
        <AddStockModal products={products} onClose={() => setShowAddStock(false)} />
      )}

    </div>
  );
}

function AddStockModal({ products, onClose }) {
  const [productId, setProductId] = useState(null);
  const [itemSearch, setItemSearch] = useState('');
  const [showMatches, setShowMatches] = useState(false);
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('Pieces');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const { addStock } = useInventory();

  const selectedProduct = products.find((p) => String(p.id) === productId);
  const matches = products.filter((p) =>
    p.name.toLowerCase().includes(itemSearch.toLowerCase())
  );

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
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm max-h-[90dvh] overflow-y-auto bg-[#0d0f12] border border-[#00ff88]/30 rounded-3xl p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-semibold text-[#00ff88] mb-6">Add Stock</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
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
                className="w-full bg-[#d9d9d9] text-black text-sm font-medium py-3 pl-10 pr-4 rounded-full focus:outline-none"
              />
            </div>

            {showMatches && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-2xl bg-[#d9d9d9]">
                {matches.length === 0 && (
                  <p className="text-sm text-gray-600 px-4 py-3">No items match.</p>
                )}
                {matches.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={() => selectProduct(p)}
                    className="w-full text-left px-4 py-2.5 text-sm text-black hover:bg-black/10"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-3">
            <input
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Qty"
              className="w-20 bg-[#d9d9d9] text-black text-sm font-medium py-3 px-4 rounded-full focus:outline-none text-center"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-32 bg-[#d9d9d9] text-black text-sm font-medium py-3 px-4 rounded-full focus:outline-none cursor-pointer text-center"
            >
              <option value="Pieces">Pieces</option>
              <option value="Packets">Packets</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={saving || !qty || !selectedProduct}
            className="w-full bg-[#00cc66] hover:bg-[#00e673] active:scale-95 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold text-lg tracking-wide py-3 rounded-full transition-all duration-200 uppercase"
          >
            {saving ? 'Adding…' : 'Add Stock'}
          </button>

          {message && (
            <p
              className={`text-sm text-center ${
                message.type === 'error' ? 'text-red-400' : 'text-[#00ff88]'
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
