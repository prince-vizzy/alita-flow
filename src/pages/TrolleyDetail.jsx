import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Coins, Package, PackageCheck, PackagePlus, Tag, Trash2 } from 'lucide-react';
import { useTrolley } from '../context/TrolleyContext';

export default function TrolleyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products } = useTrolley();

  const product = products.find((p) => String(p.id) === id) ?? products[0];

  return (
    <div className="ground min-h-dvh text-ink flex flex-col items-center px-5 pt-7 pb-10 font-sans">
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

          <div className="mt-4 flex flex-wrap gap-2">
            {product.counted ? (
              <>
                <Spec icon={Package} label="Opening" value={product.openingStock} />
                <Spec icon={PackagePlus} label="Added today" value={product.addedToday} />
                <Spec icon={Coins} label="Sold" value={product.closed ? product.soldToday : '—'} />
                <Spec icon={Trash2} label="Spoilt" value={product.closed ? product.spoiltToday : '—'} />
                <Spec
                  icon={PackageCheck}
                  label={product.closed ? 'Closing' : 'On hand before close'}
                  value={product.closingStock}
                  accent
                />
                {product.price > 0 && <Spec icon={Tag} label="Price" value={`KES ${product.price}`} />}
              </>
            ) : (
              <Spec
                icon={Coins}
                label="Takings today"
                value={product.closed ? `KES ${product.takingsToday}` : '—'}
                accent={product.closed}
              />
            )}
          </div>

          <p className="mt-4 text-xs text-ink-3">
            {product.closed
              ? "Today is closed. Close the day again from the trolley screen to correct it."
              : 'Sales are recorded when the day is closed, from the trolley screen.'}
          </p>
        </section>
      </main>
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
