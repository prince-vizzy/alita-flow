import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ShoppingCart, Store, WifiOff } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useTrolley } from '../context/TrolleyContext';
import { ADMIN_PIN, unlockAdmin } from '../lib/adminGate';
import InstallButton from '../components/InstallButton';

const LONG_PRESS_MS = 600;

export default function Home() {
  const navigate = useNavigate();
  const { products: shopProducts, isOnline } = useInventory();
  const { products: trolleyProducts } = useTrolley();
  const [pinOpen, setPinOpen] = useState(false);
  const pressTimer = useRef(null);

  const shopOut = shopProducts.filter((p) => p.stock === 0).length;
  const cookedNow = trolleyProducts.reduce((sum, p) => sum + p.cookedStock, 0);

  const startPress = () => {
    pressTimer.current = setTimeout(() => setPinOpen(true), LONG_PRESS_MS);
  };
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  return (
    <div className="ground min-h-dvh text-ink flex flex-col items-center px-5 py-7 font-sans">
      <header className="w-full max-w-md mb-7 flex items-center justify-between gap-3">
        <h1
          className="text-xl font-light tracking-[0.22em] uppercase select-none"
          onPointerDown={startPress}
          onPointerUp={cancelPress}
          onPointerLeave={cancelPress}
          onPointerCancel={cancelPress}
          onContextMenu={(e) => e.preventDefault()}
        >
          Alita Flow<span className="text-sage">.</span>
        </h1>
        <InstallButton />
      </header>

      {!isOnline && (
        <div className="w-full max-w-md mb-4">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-trolley bg-trolley/10 border border-trolley/25 rounded-full px-3 py-1.5">
            <WifiOff className="w-3.5 h-3.5" />
            Offline
          </span>
        </div>
      )}

      <main className="w-full max-w-md flex flex-col gap-4">
        <SectionCard
          accent="var(--color-shop)"
          icon={Store}
          title="Shop"
          subtitle="Plumbing & hardware"
          stats={[
            `${shopProducts.length} items`,
            shopOut > 0 ? `${shopOut} out of stock` : 'all in stock',
          ]}
          onClick={() => navigate('/shop')}
        />

        <SectionCard
          accent="var(--color-trolley)"
          icon={ShoppingCart}
          title="Trolley"
          subtitle="Cooked daily"
          stats={[
            `${trolleyProducts.length} items`,
            cookedNow > 0 ? `${cookedNow} cooked today` : 'nothing cooked yet',
          ]}
          onClick={() => navigate('/trolley')}
        />
      </main>

      {pinOpen && (
        <PinModal
          onClose={() => setPinOpen(false)}
          onSuccess={() => {
            unlockAdmin();
            setPinOpen(false);
            navigate('/dashboard');
          }}
        />
      )}
    </div>
  );
}

function SectionCard({ accent, icon: Icon, title, subtitle, stats, onClick }) {
  return (
    <button
      onClick={onClick}
      className="glass w-full text-left rounded-[28px] p-6 transition-transform duration-200 active:scale-[0.985] hover:bg-white/[0.075]"
    >
      <div className="flex items-center gap-4">
        <div
          className="shrink-0 w-16 h-16 rounded-[20px] grid place-items-center border"
          style={{ backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`, borderColor: `color-mix(in srgb, ${accent} 30%, transparent)` }}
        >
          <Icon className="w-7 h-7" style={{ color: accent }} />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-medium tracking-wide" style={{ color: accent }}>
            {title}
          </h2>
          <p className="text-xs text-ink-3 mt-0.5">{subtitle}</p>
          <p className="mt-1.5 text-[11px] text-ink-3">{stats.join(' · ')}</p>
        </div>

        <ChevronRight className="w-5 h-5 shrink-0 text-ink-3" />
      </div>
    </button>
  );
}

function PinModal({ onClose, onSuccess }) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  const submit = (value) => {
    if (value === ADMIN_PIN) {
      onSuccess();
    } else {
      setShake(true);
      setPin('');
      setTimeout(() => setShake(false), 400);
    }
  };

  const handleChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(value);
    if (value.length === 4) submit(value);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-5"
      onClick={onClose}
    >
      <div
        className={`sheet w-full max-w-xs rounded-[28px] p-6 shadow-2xl ${shake ? 'animate-[shake_0.4s]' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-sm text-ink-2 mb-4">Enter admin PIN</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={handleChange}
          maxLength={4}
          className="w-full text-center text-2xl tracking-[0.6em] bg-transparent border-b border-white/20 focus:border-sage outline-none py-2 text-ink"
        />
        <button
          onClick={onClose}
          className="mt-5 w-full text-xs text-ink-3 hover:text-ink transition-colors"
        >
          Cancel
        </button>
      </div>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}
