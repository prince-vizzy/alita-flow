// The dashboard's PIN, checked here rather than in the browser.
//
// The PIN used to be a constant in the bundle and the browser compared against
// it — which hid the dashboard and protected nothing, since anything in the
// bundle is readable by whoever opens the site, and the routes behind it never
// checked at all. Now the browser only ever holds the PIN someone typed, sends
// it with the calls that need it, and this decides.
//
// Set ADMIN_PIN in the Vercel project to change it. Without it the PIN is the
// one the app has always used, so a deploy never locks the owner out.
//
// Underscore-prefixed files in api/ are not routes.

const ADMIN_PIN = String(process.env.ADMIN_PIN || '9193');

// Four digits is ten thousand guesses, which a script gets through in
// minutes. Functions are reused between requests, so counting misses per
// address here is enough to turn that into days — not a vault, but the same
// bar a phone's lock screen sets.
const MAX_MISSES = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const misses = new Map();

function clientAddress(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '');
  return forwarded.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

// Resolves to { ok: true } or { ok: false, status, error }. `pin` defaults to
// the X-Admin-Pin header every dashboard call carries.
export function checkPin(req, pin = req.headers['x-admin-pin']) {
  const who = clientAddress(req);
  const record = misses.get(who);
  const now = Date.now();

  if (record && now - record.since > LOCKOUT_MS) misses.delete(who);
  else if (record && record.count >= MAX_MISSES) {
    return { ok: false, status: 429, error: 'Too many wrong PINs. Try again in a few minutes.' };
  }

  if (pin && String(pin) === ADMIN_PIN) {
    misses.delete(who);
    return { ok: true };
  }

  const current = misses.get(who);
  misses.set(who, { count: (current?.count ?? 0) + 1, since: current?.since ?? now });
  return { ok: false, status: 401, error: 'Wrong PIN.' };
}
