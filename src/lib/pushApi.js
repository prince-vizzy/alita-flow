// Turning the morning summary on for this device, and off again.
//
// A push subscription belongs to one browser on one phone, not to an account —
// there is nothing to sign in to here. Switching it on asks the browser for
// permission, has the push service mint an endpoint, and files that endpoint
// in the spreadsheet alongside everything else the app stores. The cron reads
// that list at six each morning.

import { adminHeaders } from './adminGate';
import { subscribeToPush, unsubscribeFromPush } from './inventoryApi';

// iOS only grants push to a PWA that has been added to the home screen, and
// only from 16.4 on. In a plain Safari tab the API is simply absent, which is
// what this catches — the control stays hidden rather than failing on tap.
export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function permissionState() {
  return isPushSupported() ? Notification.permission : 'unsupported';
}

// Whether the server holds a VAPID pair at all. Resolves null rather than
// throwing on a dev server with no functions running, so the dashboard just
// leaves the control out.
export async function fetchPushConfig() {
  try {
    const res = await fetch('/api/push');
    if (!res.ok) return null;
    const data = await res.json();
    return data.configured ? data : null;
  } catch {
    return null;
  }
}

async function registration() {
  // registerSW() in main.jsx has already started this; ready resolves once
  // the worker is actually controlling the page.
  return navigator.serviceWorker.ready;
}

// The live subscription for this device, or null. Read from the browser
// rather than from the sheet — the browser is the one that can revoke it.
export async function currentSubscription() {
  if (!isPushSupported()) return null;
  const sw = await registration();
  return sw.pushManager.getSubscription();
}

export async function enablePush(publicKey) {
  if (!isPushSupported()) throw new Error('This browser cannot show notifications.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked for this site. Allow them in the browser settings and try again.'
        : 'Notifications were not allowed.'
    );
  }

  const sw = await registration();
  // Reuse whatever the browser already has. Subscribing twice with the same
  // key returns the same endpoint anyway, but asking first keeps the sheet
  // from being rewritten on every visit.
  const subscription =
    (await sw.pushManager.getSubscription()) ??
    (await sw.pushManager.subscribe({
      // Every push must be shown to the user. Chrome enforces this, and it is
      // true of what this sends anyway.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  await subscribeToPush(subscription.toJSON(), deviceLabel());
  return subscription;
}

export async function disablePush() {
  const subscription = await currentSubscription();
  if (!subscription) return;

  // Tell the sheet first: if unsubscribing locally succeeded and this failed,
  // the cron would keep pushing at an endpoint nothing is listening on.
  await unsubscribeFromPush(subscription.endpoint);
  await subscription.unsubscribe();
}

// Sends the morning summary right now, to every subscribed device. Behind the
// dashboard PIN, checked on the server.
export async function sendTestNotification() {
  const res = await fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...adminHeaders() },
    body: '{}',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Could not send: ${res.status}`);
  return data;
}

// Enough to tell two devices apart in the sheet without storing anything
// identifying — "the phone" and "the laptop", roughly.
function deviceLabel() {
  const ua = navigator.userAgent;
  const platform = /android/i.test(ua)
    ? 'Android'
    : /iphone|ipad|ipod/i.test(ua)
      ? 'iOS'
      : /windows/i.test(ua)
        ? 'Windows'
        : /mac/i.test(ua)
          ? 'Mac'
          : 'Device';
  const installed = window.matchMedia?.('(display-mode: standalone)').matches;
  return `${platform}${installed ? ' (installed)' : ' (browser)'}`;
}

// VAPID keys travel as base64url; PushManager wants raw bytes.
function urlBase64ToUint8Array(base64) {
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
