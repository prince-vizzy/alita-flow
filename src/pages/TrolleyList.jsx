import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  Flame,
  Plus,
  Receipt,
  RefreshCw,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';
import { useTrolley } from '../context/TrolleyContext';
import { useInventory } from '../context/InventoryContext';
import { fetchTrolleyWaste } from '../lib/inventoryApi';
import { TROLLEY_EXPENSE_ITEMS, TROLLEY_UNITS } from '../data/trolleyProducts';
import QuantityPicker from '../components/QuantityPicker';

const ACCENT = 'var(--color-trolley)';

export default function TrolleyList() {
  const [modal, setModal] = useState(null); // 'addStock' | 'cook' | 'expense' | null
  const navigate = useNavigate();
  const { products, pendingCount, syncError, clearSyncError } = useTrolley();
  const { isOnline } = useInventory();

  const totalCooked = products.reduce((sum, p) => sum + p.cookedStock, 0);
  const totalRaw = products.reduce((sum, p) => sum + p.regularStock, 0);

  return (
    <div className="ground min-h-dvh text-ink flex flex-col items-center px-5 py-7 font-sans">
      <header className="w-full max-w-md mb-5 flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="p-2 -ml-2 rounded-full text-ink-3 hover:text-ink transition-colors"
          aria-label="Back to sections"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="flex-1 text-xl font-light tracking-[0.22em] uppercase">
          Trolley<span className="text-trolley">.</span>
        </h1>
      </header>

      {/* The day's state, then the three things you do to it. */}
      <section className="glass w-full max-w-md rounded-[26px] p-4 mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-light text-trolley">{totalCooked}</span>
          <span className="text-[13px] text-ink-2">cooked today</span>
          <span className="ml-auto text-[11px] text-ink-3">{totalRaw} raw in stock</span>
        </div>

        <div className="mt-3.5 flex items-center gap-2">
          <button
            onClick={() => setModal('cook')}
            className="pill-trolley flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-semibold transition-transform"
          >
            <Flame className="w-3.5 h-3.5" />
            Cook
          </button>
          <button
            onClick={() => setModal('addStock')}
            className="flex items-center gap-1.5 rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-xs text-ink-2 hover:text-ink transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add stock
          </button>
          <button
            onClick={() => setModal('expense')}
            className="flex items-center gap-1.5 rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-xs text-ink-2 hover:text-ink transition-colors"
          >
            <Receipt className="w-3.5 h-3.5" />
            Expense
          </button>
        </div>
      </section>

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

      <main className="w-full max-w-md grid grid-cols-2 gap-3">
        {products.map((product) => (
          <button
            key={product.id}
            onClick={() => navigate(`/trolley/product/${product.id}`)}
            className="glass group text-left rounded-[26px] p-2.5 transition-transform duration-200 active:scale-[0.98] hover:bg-white/[0.075]"
          >
            <div className="relative w-full aspect-[4/3] rounded-[20px] overflow-hidden">
              {product.image ? (
                <span className="photo-tile absolute inset-0 grid place-items-center p-3">
                  <img
                    src={product.image}
                    alt={product.name}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain mix-blend-multiply"
                  />
                </span>
              ) : (
                <span className="emoji-tile absolute inset-0 grid place-items-center">
                  <span className="text-5xl select-none" aria-hidden="true">
                    {product.emoji}
                  </span>
                </span>
              )}
              {product.cookedStock === 0 && (
                <span className="absolute top-2 right-2 rounded-full bg-[#8a2f2f] text-white text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
                  None cooked
                </span>
              )}
            </div>

            <div className="px-1.5 pt-3 pb-1">
              <p className="text-[13px] text-ink leading-snug truncate">{product.name}</p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">
                  {product.price > 0 ? product.price : '—'}
                </span>
                <span
                  className={`text-[10px] rounded-full px-2 py-0.5 border ${
                    product.cookedStock > 0
                      ? 'text-trolley border-trolley/25 bg-trolley/10'
                      : 'text-ink-3 border-white/10 bg-white/[0.04]'
                  }`}
                >
                  {product.cookedStock > 0 ? `${product.cookedStock} cooked` : `${product.regularStock} raw`}
                </span>
              </div>
            </div>
          </button>
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
    <section className="w-full max-w-md mt-6 mb-10">
      <button
        onClick={toggle}
        aria-expanded={open}
        className="glass w-full flex items-center gap-2 rounded-[22px] px-4 py-3.5 text-xs text-ink-2 hover:text-ink transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>Leftovers — last 7 days</span>
        <ChevronDown
          className={`w-3.5 h-3.5 ml-auto transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="glass mt-2 rounded-[22px] divide-y divide-white/8 overflow-hidden">
          {loading && <p className="text-xs text-ink-3 px-4 py-3">Loading…</p>}
          {error && <p className="text-xs text-[#e88b8b] px-4 py-3">{error}</p>}
          {waste?.length === 0 && (
            <p className="text-xs text-ink-3 px-4 py-3">
              Nothing wasted — everything cooked has been sold.
            </p>
          )}
          {waste?.map((day) => (
            <div key={day.date} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-2">{day.date}</span>
                <span className="text-xs font-medium text-trolley">{day.total} unsold</span>
              </div>
              <p className="mt-1 text-[11px] text-ink-3">
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

// Shared shell for every trolley sheet: a heading, whatever the action needs,
// and one filled amber button.
function Sheet({ title, onClose, children }) {
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

        <h2 className="text-lg font-light tracking-[0.14em] uppercase mb-6">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function SubmitButton({ disabled, children }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="pill-trolley w-full rounded-full py-3.5 text-sm font-semibold tracking-wide transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function Result({ message }) {
  if (!message) return null;
  return (
    <p
      className={`text-sm text-center ${
        message.type === 'error' ? 'text-[#e88b8b]' : 'text-trolley'
      }`}
    >
      {message.text}
    </p>
  );
}

// Pick an item, pick a quantity + unit, submit.
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
    <Sheet title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          {products.map((p) => {
            const isSelected = String(p.id) === productId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setProductId(String(p.id))}
                aria-pressed={isSelected}
                className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-left border transition-colors"
                style={{
                  borderColor: isSelected
                    ? 'color-mix(in srgb, var(--color-trolley) 45%, transparent)'
                    : 'rgba(255,255,255,0.1)',
                  backgroundColor: isSelected
                    ? 'color-mix(in srgb, var(--color-trolley) 12%, transparent)'
                    : 'rgba(255,255,255,0.04)',
                }}
              >
                <span className="text-lg shrink-0" aria-hidden="true">
                  {p.emoji}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-ink truncate">
                    {p.name}
                    {p.price > 0 && <span className="text-ink-3"> · {p.price}</span>}
                  </span>
                  <span className="block text-[10px] text-ink-3">
                    {availableOf(p)} {actionLabel}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-3">
          <QuantityPicker value={qty} onChange={setQty} accent={ACCENT} />
          <div className="relative w-36">
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              aria-label="Unit"
              className="w-full appearance-none rounded-full border border-white/12 bg-white/[0.06] text-ink text-sm py-3 pl-4 pr-9 text-center focus:outline-none focus:border-white/25 cursor-pointer"
            >
              {TROLLEY_UNITS.map((u) => (
                <option className="bg-ground-2" key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <ChevronDown
              className="w-4 h-4 text-ink-3 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
          </div>
        </div>

        <SubmitButton disabled={saving || !qty || !selected}>
          {saving ? 'Saving…' : submitLabel}
        </SubmitButton>

        <Result message={message} />
      </form>
    </Sheet>
  );
}

function AddStockModal({ onClose }) {
  const { addStock } = useTrolley();
  return (
    <ItemActionModal
      title="Add stock"
      actionLabel="raw"
      submitLabel="Add stock"
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
    <Sheet title="Expense" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          {TROLLEY_EXPENSE_ITEMS.map((name) => {
            const isSelected = name === item;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setItem(name)}
                aria-pressed={isSelected}
                className="rounded-2xl px-3 py-2.5 text-left border transition-colors"
                style={{
                  borderColor: isSelected
                    ? 'color-mix(in srgb, var(--color-trolley) 45%, transparent)'
                    : 'rgba(255,255,255,0.1)',
                  backgroundColor: isSelected
                    ? 'color-mix(in srgb, var(--color-trolley) 12%, transparent)'
                    : 'rgba(255,255,255,0.04)',
                }}
              >
                <span className="block text-xs text-ink">{name}</span>
              </button>
            );
          })}
        </div>

        <input
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (KES)"
          aria-label="Amount in KES"
          className="w-full rounded-full border border-white/12 bg-white/[0.06] text-ink placeholder:text-ink-3/70 text-sm py-3 px-4 text-center focus:outline-none focus:border-white/25"
        />

        <SubmitButton disabled={saving || !amount || !item}>
          {saving ? 'Saving…' : 'Log expense'}
        </SubmitButton>

        <Result message={message} />
      </form>
    </Sheet>
  );
}
