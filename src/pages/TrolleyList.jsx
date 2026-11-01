import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  ClipboardCheck,
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
import { TROLLEY_EXPENSE_ITEMS } from '../data/trolleyProducts';
import QuantityPicker from '../components/QuantityPicker';

const ACCENT = 'var(--color-trolley)';

export default function TrolleyList() {
  const [modal, setModal] = useState(null); // 'addStock' | 'close' | 'expense' | null
  const navigate = useNavigate();
  const { products, pendingCount, syncError, clearSyncError } = useTrolley();
  const { isOnline } = useInventory();

  const counted = products.filter((p) => p.counted);
  const totalOpening = counted.reduce((sum, p) => sum + p.openingStock + p.addedToday, 0);
  const totalClosing = counted.reduce((sum, p) => sum + p.closingStock, 0);
  const closed = products.length > 0 && products.every((p) => p.closed);

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
          <span className="text-2xl font-light text-trolley">{closed ? totalClosing : totalOpening}</span>
          <span className="text-[13px] text-ink-2">{closed ? 'closing stock' : 'opening stock'}</span>
          <span className="ml-auto text-[11px] text-ink-3">{closed ? 'Day closed' : 'Not closed yet'}</span>
        </div>

        <div className="mt-3.5 flex items-center gap-2">
          <button
            onClick={() => setModal('close')}
            className="pill-trolley flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-semibold transition-transform"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            Close day
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
              {product.counted && product.closingStock <= 0 && (
                <span className="absolute top-2 right-2 rounded-full bg-[#8a2f2f] text-white text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
                  None left
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
                    product.closed
                      ? 'text-trolley border-trolley/25 bg-trolley/10'
                      : 'text-ink-3 border-white/10 bg-white/[0.04]'
                  }`}
                >
                  {product.counted
                    ? `${product.closingStock} ${product.closed ? 'closing' : 'on hand'}`
                    : product.closed
                      ? `KES ${product.takingsToday}`
                      : 'Not closed'}
                </span>
              </div>
            </div>
          </button>
        ))}
      </main>

      <SpoiltPanel />

      {modal === 'addStock' && <AddStockModal onClose={() => setModal(null)} />}
      {modal === 'close' && <CloseDayModal onClose={() => setModal(null)} />}
      {modal === 'expense' && <ExpenseModal onClose={() => setModal(null)} />}
    </div>
  );
}

/* ----------------------------- Spoilt report ----------------------------- */

function SpoiltPanel() {
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
        <span>Spoilt — last 7 days</span>
        <ChevronDown
          className={`w-3.5 h-3.5 ml-auto transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="glass mt-2 rounded-[22px] divide-y divide-white/8 overflow-hidden">
          {loading && <p className="text-xs text-ink-3 px-4 py-3">Loading…</p>}
          {error && <p className="text-xs text-[#e88b8b] px-4 py-3">{error}</p>}
          {waste?.length === 0 && (
            <p className="text-xs text-ink-3 px-4 py-3">Nothing recorded as spoilt.</p>
          )}
          {waste?.map((day) => (
            <div key={day.date} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-2">{day.date}</span>
                <span className="text-xs font-medium text-trolley">{day.total} spoilt</span>
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

// Pick an item, say how many came in and what they cost.
function AddStockModal({ onClose }) {
  const [productId, setProductId] = useState(null);
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const { products, addStock } = useTrolley();

  const selected = products.find((p) => String(p.id) === productId);

  async function handleSubmit(e) {
    e.preventDefault();
    const qtyNum = Number(qty);
    if (!selected || !qtyNum || qtyNum <= 0) return;

    setSaving(true);
    setMessage(null);
    try {
      const { queued } = await addStock(selected, qtyNum, Number(cost) || 0);
      setMessage({
        type: 'success',
        text: queued
          ? `Added ${qtyNum} ${selected.name}. Offline, will sync when back online.`
          : `Added ${qtyNum} ${selected.name}.`,
      });
      setQty('');
      setCost('');
      setProductId(null);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet title="Add stock" onClose={onClose}>
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
                  <span className="block text-xs text-ink truncate">{p.name}</span>
                  {p.counted && (
                    <span className="block text-[10px] text-ink-3">{p.closingStock} on hand</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <QuantityPicker value={qty} onChange={setQty} accent={ACCENT} />

        <input
          type="number"
          min="0"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="Total cost (KES), optional"
          aria-label="Total cost in KES"
          className="w-full rounded-full border border-white/12 bg-white/[0.06] text-ink placeholder:text-ink-3/70 text-sm py-3 px-4 text-center focus:outline-none focus:border-white/25"
        />

        <SubmitButton disabled={saving || !qty || !selected}>
          {saving ? 'Saving…' : 'Add stock'}
        </SubmitButton>

        <Result message={message} />
      </form>
    </Sheet>
  );
}

// The day's one sales record. Every item has to be answered, zero included, so
// a blank can't pass for "sold nothing"; spoilt is the only figure left optional.
function CloseDayModal({ onClose }) {
  const { products, closeDay } = useTrolley();
  const [entries, setEntries] = useState(() =>
    Object.fromEntries(
      products.map((p) => [
        p.name,
        {
          sold: p.closed ? String(p.closeSold) : '',
          spoilt: p.closeSpoilt > 0 ? String(p.closeSpoilt) : '',
          takings: p.closed ? String(p.closeTakings) : '',
        },
      ])
    )
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const setEntry = (name, field, value) =>
    setEntries((prev) => ({ ...prev, [name]: { ...prev[name], [field]: value } }));

  const closingOf = (p) =>
    p.available - (Number(entries[p.name].sold) || 0) - (Number(entries[p.name].spoilt) || 0);

  const answered = products.every((p) => entries[p.name][p.counted ? 'sold' : 'takings'] !== '');
  const overdrawn = products.some((p) => p.counted && closingOf(p) < 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!answered || overdrawn) return;

    setSaving(true);
    setMessage(null);
    try {
      const { queued } = await closeDay(
        products.map((p) =>
          p.counted
            ? {
                name: p.name,
                sold: Number(entries[p.name].sold),
                spoilt: Number(entries[p.name].spoilt) || 0,
              }
            : { name: p.name, takings: Number(entries[p.name].takings) }
        )
      );
      setMessage({
        type: 'success',
        text: queued ? 'Day closed. Offline, will sync when back online.' : 'Day closed.',
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet title="Close day" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {products.map((p) => {
          const entry = entries[p.name];
          const closing = closingOf(p);
          return (
            <div key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-ink">{p.name}</span>
                {p.counted && (
                  <span className="text-[11px] text-ink-3">
                    Opening {p.openingStock}
                    {p.addedToday > 0 && ` + ${p.addedToday} added`}
                  </span>
                )}
              </div>

              {p.counted ? (
                <>
                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <CloseField
                      label={`${p.name} units sold`}
                      caption="Sold"
                      value={entry.sold}
                      onChange={(value) => setEntry(p.name, 'sold', value)}
                    />
                    <CloseField
                      label={`${p.name} units spoilt`}
                      caption="Spoilt"
                      placeholder="0"
                      value={entry.spoilt}
                      onChange={(value) => setEntry(p.name, 'spoilt', value)}
                    />
                  </div>
                  <p className={`mt-2 text-xs ${closing < 0 ? 'text-[#e88b8b]' : 'text-trolley'}`}>
                    {closing < 0 ? `${-closing} more than was on hand` : `Closing stock ${closing}`}
                  </p>
                </>
              ) : (
                <div className="mt-2.5">
                  <CloseField
                    label={`${p.name} takings in KES`}
                    caption="Takings (KES)"
                    value={entry.takings}
                    onChange={(value) => setEntry(p.name, 'takings', value)}
                  />
                </div>
              )}
            </div>
          );
        })}

        <SubmitButton disabled={saving || !answered || overdrawn}>
          {saving ? 'Saving…' : 'Close day'}
        </SubmitButton>

        <Result message={message} />
      </form>
    </Sheet>
  );
}

function CloseField({ label, caption, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="block text-[10px] text-ink-3 mb-1">{caption}</span>
      <input
        type="number"
        min="0"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="w-full rounded-full border border-white/12 bg-white/[0.06] text-ink placeholder:text-ink-3/70 text-sm py-2.5 px-3 text-center focus:outline-none focus:border-white/25"
      />
    </label>
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
