import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, ShoppingCart, ChevronRight, WifiOff } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useTrolley } from '../context/TrolleyContext';
import { ADMIN_PIN, unlockAdmin } from '../lib/adminGate';
import InstallButton from '../components/InstallButton';

const SHOP_ACCENT = '#00ff88';
const TROLLEY_ACCENT = '#ffb020';

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
    <div className="min-h-dvh bg-[#0a0c0e] text-white flex flex-col items-center px-4 py-6 font-sans relative">
      <div className="absolute inset-0 bg-[radial-gradient(#15803d_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

      <header className="w-full max-w-md mb-10 flex items-center justify-between z-10">
        <h1
          className="text-3xl sm:text-4xl font-extrabold text-[#00ff88] tracking-wider drop-shadow-[0_0_10px_#00ff88] select-none"
          style={{ fontFamily: "'Caveat', 'Comic Sans MS', cursive" }}
          onPointerDown={startPress}
          onPointerUp={cancelPress}
          onPointerLeave={cancelPress}
          onPointerCancel={cancelPress}
          onContextMenu={(e) => e.preventDefault()}
        >
          Alita Flow<span className="text-purple-400">.</span>
        </h1>
        <InstallButton />
      </header>

      {!isOnline && (
        <div className="w-full max-w-md mb-4 z-10">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-full px-3 py-1.5 w-fit">
            <WifiOff className="w-3.5 h-3.5" />
            Offline
          </div>
        </div>
      )}

      <main className="w-full max-w-md flex flex-col gap-5 z-10">
        <SectionCard
          accent={SHOP_ACCENT}
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
          accent={TROLLEY_ACCENT}
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-xs rounded-3xl border border-white/10 bg-[#0d0f12] p-6 shadow-2xl ${shake ? 'animate-[shake_0.4s]' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-sm text-gray-400 mb-4">Enter admin PIN</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={handleChange}
          maxLength={4}
          className="w-full text-center text-2xl tracking-[0.6em] bg-transparent border-b-2 border-white/20 focus:border-[#3987e5] outline-none py-2 text-white"
        />
        <button
          onClick={onClose}
          className="mt-5 w-full text-xs text-gray-500 hover:text-gray-300 transition-colors"
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

function SectionCard({ accent, icon: Icon, title, subtitle, stats, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left group relative rounded-[2rem] border bg-[#0d0f12] p-6 shadow-2xl transition-transform duration-200 active:scale-[0.98] hover:scale-[1.02]"
      style={{ borderColor: `${accent}4d` }}
    >
      <div
        className="absolute -inset-px rounded-[2rem] opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-300 pointer-events-none"
        style={{ background: `linear-gradient(90deg, ${accent}33, ${accent}66, ${accent}33)` }}
      />
      <div className="relative flex items-center gap-4">
        <div
          className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border"
          style={{ backgroundColor: `${accent}1a`, borderColor: `${accent}4d` }}
        >
          <Icon className="w-7 h-7" style={{ color: accent }} />
        </div>

        <div className="flex-1 min-w-0">
          <h2
            className="text-2xl font-bold tracking-wide"
            style={{ color: accent, fontFamily: "'Caveat', 'Comic Sans MS', cursive" }}
          >
            {title}
          </h2>
          <p className="text-xs text-gray-400">{subtitle}</p>
          <p className="mt-1.5 text-[11px] text-gray-500">{stats.join(' · ')}</p>
        </div>

        <ChevronRight
          className="w-5 h-5 shrink-0 text-gray-600 group-hover:translate-x-1 transition-transform"
          style={{ color: accent }}
        />
      </div>
    </button>
  );
}
