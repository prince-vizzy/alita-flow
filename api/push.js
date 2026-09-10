// The one thing the browser needs before it can subscribe to notifications:
// the VAPID public key. It is public by definition — it is what the push
// service checks the server's signature against — but it lives in an env var
// next to its private half rather than in the Vite bundle, so this route
// hands it over instead.
//
//   GET → { configured, publicKey }
//
// The subscription itself never comes back here. The browser posts it straight
// to the spreadsheet, the same way every other write in this app does.

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY || null;
  const configured = Boolean(publicKey && process.env.VAPID_PRIVATE_KEY);

  // Without the private half nothing can ever be sent, so the app should stay
  // quiet rather than collect subscriptions that lead nowhere.
  return res.status(200).json({ configured, publicKey: configured ? publicKey : null });
}
