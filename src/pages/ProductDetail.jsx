import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Boxes, ChevronDown, Tag } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { isInventoryApiConfigured } from '../lib/inventoryApi';
import { DEFAULT_UNIT, UNITS } from '../data/units';
import QuantityPicker from '../components/QuantityPicker';

const ACCENT = 'var(--color-shop)';
const LOW_STOCK_AT = 3;

export default function ProductDetail() {
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState(DEFAULT_UNIT);
  const [selling, setSelling] = useState(false);
  const [message, setMessage] = useState(null);
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, sell } = useInventory();

  const product = products.find((p) => String(p.id) === id) ?? products[0];

  const qtyChosen = Number(quantity) > 0;
  const canSell = product.stock > 0 && qtyChosen && !selling;

  async function handleSell() {
    if (!isInventoryApiConfigured()) {
      setMessage({ type: 'error', text: 'Live sheet sync is not set up yet.' });
      return;
    }
    setSelling(true);
    setMessage(null);
    try {
      const { queued } = await sell(product, Number(quantity), unit);
      setMessage({
        type: 'success',
        text: queued
          ? `Sold ${quantity} ${unit} — offline, will sync when back online.`
          : `Sold ${quantity} ${unit}.`,
      });
      setQuantity('');
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
          onClick={() => navigate('/shop')}
          className="glass w-10 h-10 rounded-full grid place-items-center text-ink-2 hover:text-ink transition-colors"
          aria-label="Back to products"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="flex-1 text-xl font-light tracking-[0.22em] uppercase">
          Shop<span className="text-shop">.</span>
        </h1>
      </header>

      {/* my-auto centres the product between the header and the action bar
          on a screen taller than it needs; on a short screen there is no free
          space to share out, so it falls back to a normal top-down scroll. */}
      <main className="w-full max-w-md my-auto flex flex-col gap-4">
        <div className="photo-tile w-full aspect-[4/3] rounded-[28px] p-6 grid place-items-center overflow-hidden">
          <img
            src={product.image}
            alt={product.name}
            className="max-h-full max-w-full object-contain mix-blend-multiply"
          />
        </div>

        <section className="glass rounded-[28px] p-5">
          <h2 className="text-2xl font-light leading-tight">{product.name}</h2>
          {product.code && (
            <p className="mt-1 text-[11px] tracking-[0.14em] uppercase text-ink-3">{product.code}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {product.price > 0 && <Spec icon={Tag} label="Price" value={`KES ${product.price}`} />}
            <Spec
              icon={Boxes}
              label="In stock"
              value={product.stock > 0 ? `${product.stock}` : 'None'}
              tone={
                product.stock <= 0 ? 'out' : product.stock <= LOW_STOCK_AT ? 'low' : 'ok'
              }
            />
          </div>

          <p className="mt-5 text-[11px] text-ink-3">Quantity sold</p>
          <div className="mt-2.5 flex flex-col items-center gap-3">
            <QuantityPicker value={quantity} onChange={setQuantity} accent={ACCENT} />

            <Select value={unit} onChange={setUnit} ariaLabel="Unit" className="w-36">
              {UNITS.map((u) => (
                <option key={u} className="bg-ground-2" value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </div>

          {message && (
            <p
              className={`mt-4 text-sm ${message.type === 'error' ? 'text-[#e88b8b]' : 'text-shop'}`}
            >
              {message.text}
            </p>
          )}
        </section>
      </main>

      {/* The action stays in reach at the bottom of the screen, with the
          number it applies to beside it. */}
      <div className="fixed bottom-0 left-0 right-0 px-5 pb-5 pt-3">
        <div className="glass-strong mx-auto w-full max-w-md rounded-[26px] p-2.5 pl-5 flex items-center gap-3 shadow-2xl">
          <div className="min-w-0">
            <p className="text-[10px] text-ink-3">
              {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
            </p>
            <p className="text-lg font-medium leading-tight">
              {product.price > 0 ? `KES ${product.price}` : '—'}
            </p>
          </div>
          <button
            onClick={handleSell}
            disabled={!canSell}
            className="pill-primary ml-auto shrink-0 rounded-[20px] px-8 py-3.5 text-sm font-semibold tracking-wide transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {product.stock === 0 ? 'Sold out' : selling ? 'Selling…' : 'Sold'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Spec({ icon: Icon, label, value, tone }) {
  const color = tone === 'out' || tone === 'low' ? 'var(--color-trolley)' : 'var(--color-ink-2)';
  return (
    <span className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2">
      <Icon className="w-4 h-4 shrink-0 text-ink-3" aria-hidden="true" />
      <span className="leading-tight">
        <span className="block text-[10px] text-ink-3">{label}</span>
        <span className="block text-[13px] font-medium" style={{ color }}>
          {value}
        </span>
      </span>
    </span>
  );
}

function Select({ value, onChange, ariaLabel, className = '', children }) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="w-full appearance-none rounded-full border border-white/12 bg-white/[0.06] text-ink text-sm py-3 pl-4 pr-9 text-center focus:outline-none focus:border-white/25 cursor-pointer"
      >
        {children}
      </select>
      <ChevronDown
        className="w-4 h-4 text-ink-3 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
}
