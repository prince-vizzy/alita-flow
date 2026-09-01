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
      <div className="sheet rounded-[26px] p-4 shadow-2xl flex items-start gap-3">
        <div className="photo-tile w-10 h-10 rounded-xl p-1 shrink-0">
          <img src={logo} alt="" className="w-full h-full object-contain" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink">Install Alita Flow</p>
          {isIos && !canInstall ? (
            <p className="text-xs text-ink-3 mt-1 flex items-center gap-1 flex-wrap">
              Tap <Share className="w-3.5 h-3.5 inline text-sage" /> then "Add to
              Home Screen"
            </p>
          ) : (
            <>
              <p className="text-xs text-ink-3 mt-1">
                Add it to your home screen for quick, app-like access.
              </p>
              <button
                onClick={handleInstall}
                className="pill-primary mt-3 flex items-center gap-1.5 text-xs font-semibold rounded-full px-3.5 py-2 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                Install
              </button>
            </>
          )}
        </div>

        <button
          onClick={dismiss}
          className="text-ink-3 hover:text-ink transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
