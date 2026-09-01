import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ArrowLeft } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { isInventoryApiConfigured } from '../lib/inventoryApi';

const QUANTITY_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);

export default function ProductDetail() {
  const [quantity, setQuantity] = useState('Quantity sold');
  const [unit, setUnit] = useState('Pieces');
  const [selling, setSelling] = useState(false);
  const [message, setMessage] = useState(null);
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, sell } = useInventory();

  const product = products.find((p) => String(p.id) === id) ?? products[0];

  const qtyChosen = quantity !== 'Quantity sold';
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
      setQuantity('Quantity sold');
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSelling(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[#0a0c0e] text-white flex flex-col items-center px-6 py-8 font-sans relative overflow-hidden">

      {/* Background Node Network / Grid Effect */}
      <div className="absolute inset-0 bg-[radial-gradient(#15803d_1.5px,transparent_1.5px)] [background-size:32px_32px] opacity-25 pointer-events-none" />

      {/* Header / Logo */}
      <header className="w-full max-w-sm mb-8 z-10 flex items-center gap-3">
        <button
          onClick={() => navigate('/shop')}
          className="p-2 -ml-2 rounded-full text-gray-400 hover:text-white transition-colors"
          aria-label="Back to products"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1
          className="text-3xl font-extrabold text-[#00ff88] tracking-wider drop-shadow-[0_0_12px_#00ff88]"
          style={{ fontFamily: "'Caveat', 'Comic Sans MS', cursive" }}
        >
          Shop<span className="text-purple-400">.</span>
        </h1>
      </header>

      {/* Main Content Card Container */}
      <main className="w-full max-w-sm flex flex-col items-center z-10">

        {/* Product Image Capsule */}
        <div className="w-full aspect-[4/3] bg-white rounded-[2.5rem] flex items-center justify-center p-6 shadow-2xl mb-8">
          <img
            src={product.image}
            alt={product.name}
            className="max-h-full max-w-full object-contain"
          />
        </div>

        {/* Product Title */}
        <h2 className="text-2xl font-medium text-gray-100 tracking-wide text-center">
          {product.name}
        </h2>
        {product.price > 0 && (
          <p className="text-xl font-semibold text-white mt-1">{product.price}</p>
        )}
        <p className="text-sm text-[#00ff88] mb-8">
          {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
        </p>

        {/* Control Controls / Dropdowns Row */}
        <div className="w-full flex items-center gap-3 mb-12">

          {/* Quantity Sold Dropdown */}
          <div className="relative flex-1">
            <select
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full appearance-none bg-[#d9d9d9] text-black text-sm font-medium py-3 pl-4 pr-8 rounded-full focus:outline-none cursor-pointer shadow-md"
            >
              <option value="Quantity sold">Quantity sold</option>
              {QUANTITY_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-black absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Unit Dropdown */}
          <div className="relative w-32">
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full appearance-none bg-[#d9d9d9] text-black text-base font-normal py-3 pl-5 pr-8 rounded-full focus:outline-none cursor-pointer shadow-md text-center"
            >
              <option value="Pieces">Pieces</option>
              <option value="Packets">Packets</option>
            </select>
            <ChevronDown className="w-4 h-4 text-black absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

        </div>

        {/* CTA Button */}
        <button
          onClick={handleSell}
          disabled={!canSell}
          className="w-48 bg-[#00cc66] hover:bg-[#00e673] active:scale-95 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:active:scale-100 text-white font-black text-2xl tracking-wider py-3 rounded-full transition-all duration-200 shadow-[0_0_20px_rgba(0,204,102,0.4)] disabled:shadow-none uppercase"
        >
          {product.stock === 0 ? 'Sold Out' : selling ? 'Selling…' : 'Sold'}
        </button>

        {message && (
          <p
            className={`mt-4 text-sm ${
              message.type === 'error' ? 'text-red-400' : 'text-[#00ff88]'
            }`}
          >
            {message.text}
          </p>
        )}

      </main>

    </div>
  );
}
