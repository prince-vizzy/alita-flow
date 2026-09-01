import { useState } from 'react';
import { Download, Share } from 'lucide-react';
import { useInstallPrompt } from '../context/InstallPromptContext';

export default function InstallButton({ accent = 'var(--color-sage)' }) {
  const [showTip, setShowTip] = useState(false);
  const { canInstall, isIos, installed, install } = useInstallPrompt();

  if (installed) return null;

  function handleClick() {
    if (canInstall) {
      install();
    } else {
      setShowTip((v) => !v);
    }
  }

  const tipText = isIos
    ? 'Tap the Share icon, then "Add to Home Screen".'
    : "Your browser hasn't offered to install this app yet — try reloading the page, or use Chrome/Edge on Android or desktop.";

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className="p-2 rounded-full border transition-colors"
        style={{ color: accent, borderColor: 'rgba(255,255,255,0.16)' }}
        aria-label="Install app"
      >
        <Download className="w-4 h-4" />
      </button>
      {showTip && (
        <div
          className="glass-strong absolute top-full right-0 mt-2 w-56 rounded-2xl p-3 shadow-2xl z-30 text-xs text-ink-2 flex items-start gap-1.5"
        >
          {isIos && <Share className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: accent }} />}
          <span>{tipText}</span>
        </div>
      )}
    </div>
  );
}
