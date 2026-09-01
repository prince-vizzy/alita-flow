import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ArrowLeft } from 'lucide-react';
import { useTrolley } from '../context/TrolleyContext';
import { isInventoryApiConfigured } from '../lib/inventoryApi';
import { TROLLEY_UNITS, TROLLEY_PRICE_PICKER_ITEMS, TROLLEY_PRICE_OPTIONS } from '../data/trolleyProducts';
import QuantityPicker from '../components/QuantityPicker';

const ACCENT = '#ffb020';

export default function TrolleyDetail() {
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('Pieces');
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
        const total = qty * Number(price);
        const { cookedStock, queued } = await sell(product, qty, 'Pieces', total);
        setMessage({
          type: 'success',
          text: queued
            ? `Sold ${qty} × KES ${price} — KES ${total} total, offline, will sync when back online.`
            : `Sold ${qty} × KES ${price} — KES ${total} total. ${cookedStock} cooked left.`,
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
    <div className="min-h-dvh bg-[#0a0c0e] text-white flex flex-col items-center px-6 py-8 font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(#78350f_1.5px,transparent_1.5px)] [background-size:32px_32px] opacity-25 pointer-events-none" />

      <header className="w-full max-w-sm mb-8 z-10 flex items-center gap-3">
        <button
          onClick={() => navigate('/trolley')}
          className="p-2 -ml-2 rounded-full text-gray-400 hover:text-white transition-colors"
          aria-label="Back to trolley"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1
          className="text-3xl font-extrabold tracking-wider"
          style={{
            color: ACCENT,
            fontFamily: "'Caveat', 'Comic Sans MS', cursive",
            filter: `drop-shadow(0 0 12px ${ACCENT})`,
          }}
        >
          Trolley<span className="text-purple-400">.</span>
        </h1>
      </header>

      <main className="w-full max-w-sm flex flex-col items-center z-10">
        <div className="w-full aspect-[4/3] bg-white rounded-[2.5rem] flex items-center justify-center p-6 shadow-2xl mb-8">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-8xl select-none" aria-hidden="true">
              {product.emoji}
            </span>
          )}
        </div>

        <h2 className="text-2xl font-medium text-gray-100 tracking-wide text-center">
          {product.name}
        </h2>
        {product.price > 0 && (
          <p className="text-xl font-semibold text-white mt-1">{product.price}</p>
        )}

        {/* Cooked is what's sellable; raw is shown for context only. */}
        <div className="mt-2 mb-8 flex items-center gap-3 text-sm">
          <span style={{ color: ACCENT }}>
            {product.cookedStock > 0 ? `${product.cookedStock} cooked` : 'None cooked'}
          </span>
          <span className="text-gray-700">|</span>
          <span className="text-gray-500">{product.regularStock} raw</span>
        </div>

        <div className="w-full flex flex-col items-center gap-3 mb-12">
          {isPricedItem ? (
            <>
              <p className="text-xs text-gray-500">Quantity</p>
              <QuantityPicker value={quantity} onChange={setQuantity} accent={ACCENT} />

              <p className="text-xs text-gray-500 mt-2">Price per portion (KES)</p>
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

              <div className="relative w-32">
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full appearance-none bg-[#d9d9d9] text-black text-base font-normal py-3 pl-5 pr-8 rounded-full focus:outline-none cursor-pointer shadow-md text-center"
                >
                  {TROLLEY_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-black absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </>
          )}
        </div>

        <button
          onClick={handleSell}
          disabled={!canSell}
          className="w-48 text-black font-black text-2xl tracking-wider py-3 rounded-full transition-all duration-200 uppercase active:scale-95 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed disabled:active:scale-100 disabled:shadow-none"
          style={
            canSell
              ? { backgroundColor: ACCENT, boxShadow: `0 0 20px ${ACCENT}66` }
              : undefined
          }
        >
          {product.cookedStock === 0 ? 'Sold Out' : selling ? 'Selling…' : 'Sold'}
        </button>

        {message && (
          <p
            className="mt-4 text-sm text-center"
            style={{ color: message.type === 'error' ? '#f87171' : ACCENT }}
          >
            {message.text}
          </p>
        )}
      </main>
    </div>
  );
}
