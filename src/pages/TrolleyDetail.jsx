import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Flame, Sprout, Tag } from 'lucide-react';
import { useTrolley } from '../context/TrolleyContext';
import { isInventoryApiConfigured } from '../lib/inventoryApi';
import {
  TROLLEY_PRICE_OPTIONS,
  TROLLEY_PRICE_PICKER_ITEMS,
  TROLLEY_UNITS,
} from '../data/trolleyProducts';
import { DEFAULT_UNIT } from '../data/units';
import QuantityPicker from '../components/QuantityPicker';

const ACCENT = 'var(--color-trolley)';

export default function TrolleyDetail() {
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState(DEFAULT_UNIT);
  const [price, setPrice] = useState('');
  const [selling, setSelling] = useState(false);
  const [message, setMessage] = useState(null);
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, sell } = useTrolley();

  const product = products.find((p) => String(p.id) === id) ?? products[0];
  // Sold as portions for whatever the customer pays per portion, not qty x a
  // fixed per-unit price — quantity of portions x a chosen price each,
  // rather than a quantity of a fixed-price unit.
  const isPricedItem = TROLLEY_PRICE_PICKER_ITEMS.includes(product.name);

  const qtyChosen = isPricedItem
    ? Number(quantity) > 0 && Number(price) > 0
    : Number(quantity) > 0;
  const canSell = product.cookedStock > 0 && qtyChosen && !selling;

  const total = isPricedItem ? Number(quantity) * Number(price) : 0;

  async function handleSell() {
    if (!isInventoryApiConfigured()) {
      setMessage({ type: 'error', text: 'Live sheet sync is not set up yet.' });
      return;
    }
    setSelling(true);
    setMessage(null);
    try {
      if (isPricedItem) {
        const qty = Number(quantity);
        const amount = qty * Number(price);
        const { cookedStock, queued } = await sell(product, qty, DEFAULT_UNIT, amount);
        setMessage({
          type: 'success',
          text: queued
            ? `Sold ${qty} × KES ${price} — KES ${amount} total, offline, will sync when back online.`
            : `Sold ${qty} × KES ${price} — KES ${amount} total. ${cookedStock} cooked left.`,
        });
        setQuantity('');
        setPrice('');
      } else {
        const { cookedStock, queued } = await sell(product, Number(quantity), unit);
        setMessage({
          type: 'success',
          text: queued
            ? `Sold ${quantity} ${unit} — offline, will sync when back online.`
            : `Sold ${quantity} ${unit}. ${cookedStock} cooked left.`,
        });
        setQuantity('');
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSelling(false);
    }
  }

  return (
    <div className="ground min-h-dvh text-ink flex flex-col items-center px-5 pt-7 pb-40 font-sans">
      <header className="w-full max-w-md mb-5 flex items-center gap-3">
        <button
          onClick={() => navigate('/trolley')}
          className="glass w-10 h-10 rounded-full grid place-items-center text-ink-2 hover:text-ink transition-colors"
          aria-label="Back to trolley"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="flex-1 text-xl font-light tracking-[0.22em] uppercase">
          Trolley<span className="text-trolley">.</span>
        </h1>
      </header>

      <main className="w-full max-w-md flex flex-col gap-4">
        {product.image ? (
          <div className="photo-tile w-full aspect-[4/3] rounded-[28px] p-6 grid place-items-center overflow-hidden">
            <img
              src={product.image}
              alt={product.name}
              className="max-h-full max-w-full object-contain mix-blend-multiply"
            />
          </div>
        ) : (
          <div className="emoji-tile w-full aspect-[4/3] rounded-[28px] grid place-items-center">
            <span className="text-8xl select-none" aria-hidden="true">
              {product.emoji}
            </span>
          </div>
        )}

        <section className="glass rounded-[28px] p-5">
          <h2 className="text-2xl font-light leading-tight">{product.name}</h2>

          {/* Cooked is what's sellable; raw is context for the next cook. */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Spec
              icon={Flame}
              label="Cooked"
              value={product.cookedStock > 0 ? `${product.cookedStock}` : 'None'}
              accent={product.cookedStock > 0}
            />
            <Spec icon={Sprout} label="Raw" value={`${product.regularStock}`} />
            {product.price > 0 && <Spec icon={Tag} label="Price" value={`KES ${product.price}`} />}
          </div>

          <div className="mt-5 flex flex-col items-center gap-3">
            {isPricedItem ? (
              <>
                <p className="text-[11px] text-ink-3 self-start">Portions</p>
                <QuantityPicker value={quantity} onChange={setQuantity} accent={ACCENT} />

                <p className="text-[11px] text-ink-3 self-start mt-2">Price per portion (KES)</p>
                <QuantityPicker
                  value={price}
                  onChange={setPrice}
                  accent={ACCENT}
                  options={TROLLEY_PRICE_OPTIONS}
                  placeholder="Or type a price (KES)"
                />
              </>
            ) : (
              <>
                <QuantityPicker value={quantity} onChange={setQuantity} accent={ACCENT} />

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
              </>
            )}
          </div>

          {message && (
            <p
              className={`mt-4 text-sm text-center ${
                message.type === 'error' ? 'text-[#e88b8b]' : 'text-trolley'
              }`}
            >
              {message.text}
            </p>
          )}
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 px-5 pb-5 pt-3">
        <div className="glass-strong mx-auto w-full max-w-md rounded-[26px] p-2.5 pl-5 flex items-center gap-3 shadow-2xl">
          <div className="min-w-0">
            <p className="text-[10px] text-ink-3">
              {product.cookedStock > 0 ? `${product.cookedStock} cooked left` : 'Nothing cooked'}
            </p>
            <p className="text-lg font-medium leading-tight">
              {/* For portion-priced items the takings are quantity × the
                  chosen price, so show that running total rather than a
                  fixed unit price the item doesn't have. */}
              {isPricedItem
                ? total > 0
                  ? `KES ${total}`
                  : 'Pick a price'
                : product.price > 0
                  ? `KES ${product.price}`
                  : '—'}
            </p>
          </div>
          <button
            onClick={handleSell}
            disabled={!canSell}
            className="pill-trolley ml-auto shrink-0 rounded-[20px] px-8 py-3.5 text-sm font-semibold tracking-wide transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {product.cookedStock === 0 ? 'Sold out' : selling ? 'Selling…' : 'Sold'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Spec({ icon: Icon, label, value, accent }) {
  return (
    <span className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2">
      <Icon className="w-4 h-4 shrink-0 text-ink-3" aria-hidden="true" />
      <span className="leading-tight">
        <span className="block text-[10px] text-ink-3">{label}</span>
        <span
          className="block text-[13px] font-medium"
          style={{ color: accent ? 'var(--color-trolley)' : 'var(--color-ink-2)' }}
        >
          {value}
        </span>
      </span>
    </span>
  );
}
