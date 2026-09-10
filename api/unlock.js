// Checks the PIN typed after a long-press on the home screen's title.
//
//   POST { pin } → 200 { ok: true } | 401 wrong | 429 too many tries
//
// Nothing is issued: the browser keeps the PIN for the session and sends it
// with each dashboard call, and api/_pin.js checks it again every time.

import { checkPin } from './_pin.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }

  const result = checkPin(req, body?.pin);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  return res.status(200).json({ ok: true });
}
