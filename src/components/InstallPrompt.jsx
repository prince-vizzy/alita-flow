import { useState } from 'react';
import { Download, X, Share } from 'lucide-react';
import logo from '../assets/logo.svg';
import { useInstallPrompt } from '../context/InstallPromptContext';

const DISMISSED_KEY = 'alita-flow-install-prompt-dismissed';

export default function InstallPrompt() {
  const { canInstall, isIos, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => Boolean(localStorage.getItem(DISMISSED_KEY)));

  const visible = !dismissed && (canInstall || isIos);
  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  }

  async function handleInstall() {
    await install();
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  }

  return (
    <div className="fixed inset-x-4 bottom-4 z-30 max-w-sm mx-auto">
      <div className="bg-[#0d0f12] border border-[#00ff88]/30 rounded-2xl p-4 shadow-2xl flex items-start gap-3">
        <div className="w-10 h-10 bg-white rounded-lg p-1 shrink-0">
          <img src={logo} alt="" className="w-full h-full object-contain" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Install Alita Flow</p>
          {isIos && !canInstall ? (
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1 flex-wrap">
              Tap <Share className="w-3.5 h-3.5 inline text-[#00ff88]" /> then "Add to
              Home Screen"
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-400 mt-1">
                Add it to your home screen for quick, app-like access.
              </p>
              <button
                onClick={handleInstall}
                className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-black bg-[#00ff88] hover:bg-[#00e673] transition-colors rounded-full px-3 py-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Install
              </button>
            </>
          )}
        </div>

        <button
          onClick={dismiss}
          className="text-gray-500 hover:text-white transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
