import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Flame, Receipt, X, WifiOff, RefreshCw, Trash2, ChevronDown } from 'lucide-react';
import { useTrolley } from '../context/TrolleyContext';
import { useInventory } from '../context/InventoryContext';
import { fetchTrolleyWaste } from '../lib/inventoryApi';
import { TROLLEY_UNITS, TROLLEY_EXPENSE_ITEMS } from '../data/trolleyProducts';
import QuantityPicker from '../components/QuantityPicker';

const ACCENT = '#ffb020';

export default function TrolleyList() {
  const [modal, setModal] = useState(null); // 'addStock' | 'cook' | 'expense' | null
  const navigate = useNavigate();
  const { products, pendingCount, syncError, clearSyncError } = useTrolley();
  const { isOnline } = useInventory();

  const totalCooked = products.reduce((sum, p) => sum + p.cookedStock, 0);

  return (
    <div className="min-h-dvh bg-[#0a0c0e] text-white flex flex-col items-center px-4 py-6 font-sans relative">
      <div className="absolute inset-0 bg-[radial-gradient(#78350f_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

      <header className="w-full max-w-md mb-6 flex items-center gap-3 z-10">
        <button
          onClick={() => navigate('/')}
          className="p-2 -ml-2 rounded-full text-gray-400 hover:text-white transition-colors"
          aria-label="Back to sections"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1
          className="text-3xl font-extrabold tracking-wider flex-1"
          style={{
            color: ACCENT,
            fontFamily: "'Caveat', 'Comic Sans MS', cursive",
            filter: `drop-shadow(0 0 10px ${ACCENT})`,
          }}
        >
          Trolley<span className="text-purple-400">.</span>
        </h1>
      </header>

      <div className="w-full max-w-md mb-5 flex items-center gap-2 z-10">
        <button
          onClick={() => setModal('addStock')}
          className="flex items-center gap-1.5 text-xs font-medium border rounded-full px-3 py-1.5 transition-colors"
          style={{ color: ACCENT, borderColor: `${ACCENT}80` }}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Stock
        </button>
        <button
          onClick={() => setModal('cook')}
          className="flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 transition-colors text-black font-semibold"
          style={{ backgroundColor: ACCENT }}
        >
          <Flame className="w-3.5 h-3.5" />
          Cook
        </button>
        <button
          onClick={() => setModal('expense')}
          className="flex items-center gap-1.5 text-xs font-medium border rounded-full px-3 py-1.5 transition-colors"
          style={{ color: ACCENT, borderColor: `${ACCENT}80` }}
        >
          <Receipt className="w-3.5 h-3.5" />
          Expense
        </button>
        <span className="ml-auto text-[11px] text-gray-500">
          {totalCooked} cooked today
        </span>
      </div>

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

      <main className="w-full max-w-md grid grid-cols-2 gap-x-4 gap-y-8 z-10">
        {products.map((product) => (
          <div
            key={product.id}
            onClick={() => navigate(`/trolley/product/${product.id}`)}
            className="flex flex-col items-center group cursor-pointer"
          >
            <div className="relative w-full aspect-[4/3] bg-white rounded-[2.5rem] flex items-center justify-center p-3 shadow-lg transform transition duration-200 group-hover:scale-105">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-5xl select-none" aria-hidden="true">
                  {product.emoji}
                </span>
              )}
              {product.cookedStock === 0 && (
                <span className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
                  None cooked
                </span>
              )}
            </div>

            <p className="mt-3 text-sm font-medium text-gray-200 text-center tracking-wide">
              {product.name}
            </p>
            {product.price > 0 && (
              <p className="text-sm font-semibold text-white">{product.price}</p>
            )}
            <div className="mt-1 flex items-center gap-2 text-[11px]">
              <span className="text-gray-500">{product.regularStock} raw</span>
              <span className="text-gray-700">|</span>
              <span style={{ color: ACCENT }}>{product.cookedStock} cooked</span>
            </div>
          </div>
        ))}
      </main>

      <WastePanel />

      {modal === 'addStock' && <AddStockModal onClose={() => setModal(null)} />}
      {modal === 'cook' && <CookModal onClose={() => setModal(null)} />}
      {modal === 'expense' && <ExpenseModal onClose={() => setModal(null)} />}
    </div>
  );
}

/* ----------------------------- Waste report ------------------------------ */

function WastePanel() {
  const [open, setOpen] = useState(false);
  const [waste, setWaste] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && waste === null && !loading) {
      setLoading(true);
      setError(null);
      try {
        setWaste(await fetchTrolleyWaste(7));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <section className="w-full max-w-md mt-10 mb-12 z-10">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 text-xs text-gray-400 hover:text-gray-200 transition-colors border border-gray-800 rounded-2xl px-4 py-3"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>Waste — last 7 days</span>
        <ChevronDown
          className={`w-3.5 h-3.5 ml-auto transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="mt-2 border border-gray-800 rounded-2xl divide-y divide-gray-800 overflow-hidden">
          {loading && <p className="text-xs text-gray-500 px-4 py-3">Loading…</p>}
          {error && <p className="text-xs text-red-400 px-4 py-3">{error}</p>}
          {waste?.length === 0 && (
            <p className="text-xs text-gray-500 px-4 py-3">
              No waste recorded — everything cooked has been sold.
            </p>
          )}
          {waste?.map((day) => (
            <div key={day.date} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300">{day.date}</span>
                <span className="text-xs font-medium" style={{ color: ACCENT }}>
                  {day.total} unsold
                </span>
              </div>
              <p className="mt-1 text-[11px] text-gray-500">
                {day.items.map((i) => `${i.name} ${i.qty}`).join(' · ')}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* -------------------------------- Modals --------------------------------- */

// Shared shell: pick an item, pick a quantity + unit, submit.
function ItemActionModal({ title, actionLabel, submitLabel, availableOf, onSubmit, onClose }) {
  const [productId, setProductId] = useState(null);
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('Pieces');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const { products } = useTrolley();

  const selected = products.find((p) => String(p.id) === productId);

  async function handleSubmit(e) {
    e.preventDefault();
    const qtyNum = Number(qty);
    if (!selected || !qtyNum || qtyNum <= 0) return;

    setSaving(true);
    setMessage(null);
    try {
      const text = await onSubmit(selected, qtyNum, unit);
      setMessage({ type: 'success', text });
      setQty('');
      setProductId(null);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4">
      <div
        className="w-full max-w-sm max-h-[90dvh] overflow-y-auto bg-[#0d0f12] border rounded-3xl p-6 shadow-2xl relative"
        style={{ borderColor: `${ACCENT}4d` }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-semibold mb-6" style={{ color: ACCENT }}>
          {title}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            {products.map((p) => {
              const isSelected = String(p.id) === productId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProductId(String(p.id))}
                  className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-left border transition-colors"
                  style={{
                    borderColor: isSelected ? ACCENT : '#1f2937',
                    backgroundColor: isSelected ? `${ACCENT}1a` : 'transparent',
                  }}
                >
                  <span className="text-lg shrink-0" aria-hidden="true">
                    {p.emoji}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs text-gray-200 truncate">
                      {p.name}
                      {p.price > 0 && <span className="text-gray-400"> · {p.price}</span>}
                    </span>
                    <span className="block text-[10px] text-gray-500">
                      {availableOf(p)} {actionLabel}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-3">
            <QuantityPicker value={qty} onChange={setQty} accent={ACCENT} />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-32 bg-[#d9d9d9] text-black text-sm font-medium py-3 px-4 rounded-full focus:outline-none cursor-pointer text-center"
            >
              {TROLLEY_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={saving || !qty || !selected}
            className="w-full appearance-none text-black font-bold text-lg tracking-wide py-3 rounded-full transition-all duration-200 uppercase active:scale-95 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed disabled:active:scale-100"
            style={saving || !qty || !selected ? undefined : { backgroundColor: ACCENT }}
          >
            {saving ? 'Saving…' : submitLabel}
          </button>

          {message && (
            <p
              className="text-sm text-center"
              style={{ color: message.type === 'error' ? '#f87171' : ACCENT }}
            >
              {message.text}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

function AddStockModal({ onClose }) {
  const { addStock } = useTrolley();
  return (
    <ItemActionModal
      title="Add Stock"
      actionLabel="raw"
      submitLabel="Add Stock"
      availableOf={(p) => p.regularStock}
      onClose={onClose}
      onSubmit={async (product, qty, unit) => {
        const { regularStock, queued } = await addStock(product, qty, unit);
        return queued
          ? `${product.name} will have ${regularStock} raw — offline, will sync when back online.`
          : `${product.name} now has ${regularStock} raw in stock.`;
      }}
    />
  );
}

function CookModal({ onClose }) {
  const { cook } = useTrolley();
  return (
    <ItemActionModal
      title="Cook"
      actionLabel="raw available"
      submitLabel="Cook"
      availableOf={(p) => p.regularStock}
      onClose={onClose}
      onSubmit={async (product, qty, unit) => {
        const { regularStock, cookedStock, queued } = await cook(product, qty, unit);
        const summary = `${product.name}: ${cookedStock} cooked, ${regularStock} raw left.`;
        return queued ? `${summary} Offline — will sync when back online.` : summary;
      }}
    />
  );
}

// Non-stock ingredients (onions, tomatoes, …) — just a name and a KES
// amount, no quantity/unit and no "available" figure to show.
function ExpenseModal({ onClose }) {
  const [item, setItem] = useState(null);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const { expense } = useTrolley();

  async function handleSubmit(e) {
    e.preventDefault();
    const amountNum = Number(amount);
    if (!item || !amountNum || amountNum <= 0) return;

    setSaving(true);
    setMessage(null);
    try {
      const { queued } = await expense(item, amountNum);
      setMessage({
        type: 'success',
        text: queued
          ? `Logged ${item} — KES ${amountNum}. Offline, will sync when back online.`
          : `Logged ${item} — KES ${amountNum}.`,
      });
      setAmount('');
      setItem(null);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4">
      <div
        className="w-full max-w-sm max-h-[90dvh] overflow-y-auto bg-[#0d0f12] border rounded-3xl p-6 shadow-2xl relative"
        style={{ borderColor: `${ACCENT}4d` }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-semibold mb-6" style={{ color: ACCENT }}>
          Expense
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            {TROLLEY_EXPENSE_ITEMS.map((name) => {
              const isSelected = name === item;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setItem(name)}
                  className="rounded-2xl px-3 py-2.5 text-left border transition-colors"
                  style={{
                    borderColor: isSelected ? ACCENT : '#1f2937',
                    backgroundColor: isSelected ? `${ACCENT}1a` : 'transparent',
                  }}
                >
                  <span className="block text-xs text-gray-200">{name}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-center">
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount (KES)"
              className="w-full bg-[#d9d9d9] text-black text-sm font-medium py-3 px-4 rounded-full focus:outline-none text-center"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !amount || !item}
            className="w-full appearance-none text-black font-bold text-lg tracking-wide py-3 rounded-full transition-all duration-200 uppercase active:scale-95 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed disabled:active:scale-100"
            style={saving || !amount || !item ? undefined : { backgroundColor: ACCENT }}
          >
            {saving ? 'Saving…' : 'Log Expense'}
          </button>

          {message && (
            <p
              className="text-sm text-center"
              style={{ color: message.type === 'error' ? '#f87171' : ACCENT }}
            >
              {message.text}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
