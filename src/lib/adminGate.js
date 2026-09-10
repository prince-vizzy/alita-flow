// The dashboard is reached by long-pressing the title on the home screen and
// typing the admin PIN. The PIN itself is not in this bundle — api/_pin.js
// holds it and checks it. The browser keeps what was typed for the session,
// so the dashboard can send it with the calls that cost money (Gemini, the
// test notification), and forgets it when the app is closed.

const PIN_KEY = 'alita-admin-pin';

function storedPin() {
  try {
    return sessionStorage.getItem(PIN_KEY);
  } catch {
    return null;
  }
}

export function isAdminUnlocked() {
  return Boolean(storedPin());
}

// Resolves true for the right PIN and false for a wrong one; throws with a
// message worth showing when the server can't be asked (offline, locked out).
export async function unlockAdmin(pin) {
  let res;
  try {
    res = await fetch('/api/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
  } catch {
    throw new Error("You're offline — the PIN is checked online.");
  }

  // `npm run dev` serves no /api at all. Let the dashboard open there so it
  // can be worked on; this branch is compiled out of production builds.
  if (import.meta.env.DEV && res.status === 404) {
    sessionStorage.setItem(PIN_KEY, pin);
    return true;
  }

  if (res.ok) {
    sessionStorage.setItem(PIN_KEY, pin);
    return true;
  }
  if (res.status === 401) return false;

  const data = await res.json().catch(() => null);
  throw new Error(data?.error || `Could not check the PIN (${res.status}).`);
}

// Spread into a fetch's headers for any route behind the PIN.
export function adminHeaders() {
  const pin = storedPin();
  return pin ? { 'X-Admin-Pin': pin } : {};
}
