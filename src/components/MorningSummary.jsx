import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bell, BellOff, Check, Loader2, Send } from 'lucide-react';
import {
  currentSubscription,
  disablePush,
  enablePush,
  fetchPushConfig,
  isPushSupported,
  permissionState,
  sendTestNotification,
} from '../lib/pushApi';
import { INK, STATUS } from '../lib/vizTheme';

// The one switch for the morning summary, at the foot of the dashboard.
//
// It only ever speaks for the device it is on: a subscription belongs to one
// browser, so "on" here means this phone, and turning it on again on the
// laptop adds a second one rather than moving it. The control renders nothing
// at all where push cannot work — a Safari tab, a dev server with no
// functions, a project with no VAPID keys — rather than offering a switch
// that would fail on tap.

export default function MorningSummary({ accent }) {
  const [publicKey, setPublicKey] = useState(null);
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(null); // 'toggle' | 'test'
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null);

  useEffect(() => {
    let alive = true;

    async function look() {
      if (!isPushSupported()) return setReady(true);

      const config = await fetchPushConfig();
      if (!alive) return;
      if (!config) return setReady(true);

      setPublicKey(config.publicKey);
      const subscription = await currentSubscription();
      if (!alive) return;
      setOn(Boolean(subscription) && permissionState() === 'granted');
      setReady(true);
    }

    look();
    return () => {
      alive = false;
    };
  }, []);

  const toggle = useCallback(async () => {
    setBusy('toggle');
    setError(null);
    setSent(null);
    try {
      if (on) {
        await disablePush();
        setOn(false);
      } else {
        await enablePush(publicKey);
        setOn(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }, [on, publicKey]);

  const test = useCallback(async () => {
    setBusy('test');
    setError(null);
    setSent(null);
    try {
      const result = await sendTestNotification();
      setSent(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }, []);

  // Nothing to offer: either the browser has no push, or the server has no
  // keys. Either way a switch here would be a lie.
  if (!ready || !publicKey) return null;

  return (
    <section className="glass w-full rounded-[22px] px-4 py-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span
          className="shrink-0 w-9 h-9 rounded-full grid place-items-center"
          style={{ backgroundColor: `color-mix(in srgb, ${accent} 16%, transparent)`, color: accent }}
        >
          {on ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
        </span>

        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-medium text-ink">Morning summary</h2>
          <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: INK.muted }}>
            {on
              ? 'This device gets yesterday’s shop and trolley numbers at 6am, one notification each.'
              : 'Get yesterday’s shop and trolley numbers at 6am, as two notifications on this device.'}
          </p>
        </div>

        <button
          onClick={toggle}
          disabled={busy !== null}
          className="shrink-0 text-[11px] font-medium rounded-full px-3.5 py-2 border transition-colors disabled:opacity-40"
          style={
            on
              ? { borderColor: 'rgba(255,255,255,0.16)', color: INK.secondary }
              : {
                  borderColor: `color-mix(in srgb, ${accent} 34%, transparent)`,
                  backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`,
                  color: accent,
                }
          }
        >
          {busy === 'toggle' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : on ? 'Turn off' : 'Turn on'}
        </button>
      </div>

      {on && (
        <button
          onClick={test}
          disabled={busy !== null}
          className="self-start flex items-center gap-1.5 text-[11px] rounded-full px-3 py-1.5 border border-white/12 bg-white/[0.05] text-ink-3 hover:text-ink transition-colors disabled:opacity-40"
        >
          {busy === 'test' ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Send className="w-3 h-3" />
          )}
          Send one now
        </button>
      )}

      {/* What actually went out, so a test is a test and not a guess — the
          notification itself may well arrive after this line does. */}
      {sent && (
        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-[11px]" style={{ color: STATUS.good }}>
            <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {sent.devices
              ? `Sent ${sent.sent} to ${sent.devices} device${sent.devices === 1 ? '' : 's'}.`
              : 'No device has notifications switched on yet.'}
          </p>
          {sent.notifications?.map((note) => (
            <p key={note.section} className="text-[11px] leading-relaxed pl-5" style={{ color: INK.muted }}>
              <span className="text-ink">{note.title}</span> — {note.body}
            </p>
          ))}
        </div>
      )}

      {error && (
        <p className="flex items-start gap-1.5 text-[11px]" style={{ color: STATUS.critical }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
          {error}
        </p>
      )}
    </section>
  );
}
