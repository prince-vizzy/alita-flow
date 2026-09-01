import { useState } from 'react';
import { Download, Share } from 'lucide-react';
import { useInstallPrompt } from '../context/InstallPromptContext';

export default function InstallButton({ accent = '#00ff88' }) {
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
        style={{ color: accent, borderColor: `${accent}80` }}
        aria-label="Install app"
      >
        <Download className="w-4 h-4" />
      </button>
      {showTip && (
        <div
          className="absolute top-full right-0 mt-2 w-56 bg-[#0d0f12] border rounded-xl p-3 shadow-2xl z-30 text-xs text-gray-300 flex items-start gap-1.5"
          style={{ borderColor: `${accent}4d` }}
        >
          {isIos && <Share className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: accent }} />}
          <span>{tipText}</span>
        </div>
      )}
    </div>
  );
}
