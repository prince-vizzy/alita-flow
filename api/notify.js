// The morning summary. One push for the shop, one for the trolley, each
// carrying a written read of what yesterday did.
//
//   GET   the cron, at 03:00 UTC = 06:00 in Nairobi. Vercel signs these with
//         CRON_SECRET; without that env var set the route stays shut, because
//         an open one lets a stranger buzz the owner's phone at will.
//   POST  the same send, triggered by hand from the dashboard's "Send one
//         now" button, which passes the admin PIN the page is already behind.
//
// The wording lives in api/_summary.js. This file is the plumbing: who is
// allowed to ask, where the figures come from, and where they go.
//
// Devices live in the spreadsheet, filed by the browser when notifications
// are switched on — see the Push Subscriptions tab and apps-script/Code.gs.

import webpush from 'web-push';
import { composeNotifications, yesterdayKey } from './_summary.js';
import { INVENTORY_API_URL } from '../src/config.js';
import { checkPin } from './_pin.js';

// The sheet is the slow part, not the model: the dashboard read alone measures
// around fourteen seconds, and Gemini is allowed thirty-five on top of it.
// Nothing waits on this but a cron, so the ceiling is set well clear of the
// two rather than at the sum of their best cases.
export const maxDuration = 120;

export default async function handler(req, res) {
  const auth = await authorize(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  if (!INVENTORY_API_URL) {
    return res
      .status(503)
      .json({ error: 'INVENTORY_API_URL is not set, so there is nothing to read.' });
  }
  if (!vapidReady()) {
    return res
      .status(503)
      .json({ error: 'VAPID keys are not set on the server, so nothing can be pushed.' });
  }

  const day = yesterdayKey();

  let ledger;
  let waste;
  try {
    [ledger, waste] = await Promise.all([fetchLedger(), fetchWaste()]);
  } catch (err) {
    console.error('Morning summary could not read the sheet', err);
    return res.status(502).json({ error: 'Could not read the sheet.' });
  }

  const notifications = await composeNotifications(ledger, waste, day);

  let subscriptions;
  try {
    subscriptions = await fetchSubscriptions();
  } catch (err) {
    console.error('Morning summary could not read the device list', err);
    return res.status(502).json({ error: 'Could not read the device list.' });
  }

  if (!subscriptions.length) {
    return res.status(200).json({
      day,
      devices: 0,
      sent: 0,
      notifications,
      note: 'No device has notifications switched on yet.',
    });
  }

  const outcome = await deliver(subscriptions, notifications);

  return res.status(200).json({ day, devices: subscriptions.length, ...outcome, notifications });
}

/* --------------------------------- access -------------------------------- */

// Two ways in, and neither is "anyone who finds the URL".
async function authorize(req) {
  if (req.method === 'GET') {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      return {
        ok: false,
        status: 503,
        error: 'CRON_SECRET is not set, so the scheduled send is switched off.',
      };
    }
    if (req.headers.authorization !== `Bearer ${secret}`) {
      return { ok: false, status: 401, error: 'Not authorised.' };
    }
    return { ok: true };
  }

  // "Send one now" from the dashboard. Held to the same bar as the dashboard
  // itself: the PIN, checked on the server.
  if (req.method === 'POST') {
    return checkPin(req);
  }

  return { ok: false, status: 405, error: 'Method not allowed' };
}

function vapidReady() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/* --------------------------------- reading -------------------------------- */

async function readSheet(params) {
  const url = new URL(INVENTORY_API_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheet responded ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

function fetchLedger() {
  return readSheet({ section: 'dashboard' });
}

// Only the trolley note uses this, and only for the one day. Three days
// covers the window even when the sheet's own day boundary and ours disagree.
async function fetchWaste() {
  try {
    const data = await readSheet({ section: 'trolley', report: 'waste', days: 3 });
    return data.waste ?? [];
  } catch (err) {
    // The spoilt log enriches one of the two notes; it is not worth losing
    // both notifications over.
    console.error('Spoilt log unavailable for the morning summary', err);
    return [];
  }
}

async function fetchSubscriptions() {
  const secret = process.env.PUSH_SECRET;
  if (!secret) throw new Error('PUSH_SECRET is not set on the server.');
  const data = await readSheet({ section: 'push', key: secret });
  return Array.isArray(data.subscriptions) ? data.subscriptions : [];
}

/* ------------------------------- the sending ------------------------------ */

async function deliver(subscriptions, notifications) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:alita-flow@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  let sent = 0;
  const failed = [];
  const retired = [];

  for (const subscription of subscriptions) {
    for (const note of notifications) {
      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify({ title: note.title, body: note.body, tag: note.tag, url: note.url }),
          // Yesterday's numbers are stale by tonight, so a phone that has been
          // off all day should get them on the next boot but not the one after.
          { TTL: 12 * 60 * 60 }
        );
        sent += 1;
      } catch (err) {
        // 404 and 410 are the push service saying this endpoint is gone for
        // good — a reinstalled app, cleared site data, a new phone. Nothing
        // will ever reach it again, so the row goes.
        if (err.statusCode === 404 || err.statusCode === 410) {
          retired.push(subscription.endpoint);
          break;
        }
        console.error('Push failed', err.statusCode, err.body);
        failed.push({ endpoint: short(subscription.endpoint), status: err.statusCode ?? null });
      }
    }
  }

  for (const endpoint of retired) await retire(endpoint);

  return { sent, failed, retired: retired.length };
}

async function retire(endpoint) {
  try {
    await fetch(INVENTORY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ section: 'push', action: 'unsubscribe', endpoint }),
    });
  } catch (err) {
    console.error('Could not retire a dead push endpoint', err);
  }
}

// Endpoints are long and identify a device; the tail is enough to tell two
// apart in a log line.
const short = (endpoint) => `…${String(endpoint).slice(-12)}`;
