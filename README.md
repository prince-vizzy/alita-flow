# Alita Flow

A React + Vite PWA for browsing inventory, selling items, and adding stock.
Stock is synced live to a Google Sheet and the app works offline (browsing,
selling, and restocking all queue and sync automatically once back online).

**Live:** https://alita-flow.vercel.app

## Sections

The app opens on a chooser with two independent businesses behind it:

- **Shop** (`/shop`) — plumbing and hardware. One stock number per item.
- **Trolley** (`/trolley`) — food cooked and sold daily. Two stock numbers per
  item: **regular** (raw supply on hand) and **cooked** (ready to sell today).

Each section has its own product data, context, and sheet tabs, and they share
only the offline queue — which tags every action with its section so the two
never process each other's pending changes.

### How trolley stock moves

    Add Stock →  regular +n
    Cook      →  regular −n, cooked +n
    Sold      →  cooked −n

Customers only ever buy cooked stock, so selling is blocked until something has
been cooked. Cooked stock is derived from the current day's log rows only, so
it resets to zero on its own each midnight; anything cooked but unsold on an
earlier day shows up in the **Waste — last 7 days** panel on the trolley
screen.

## Stack

- React + Vite, Tailwind CSS v4
- `vite-plugin-pwa` for offline support (precached app shell + product photos)
- Google Sheets as the backend, via an Apps Script Web App (see
  [`apps-script/`](./apps-script))

## Development

```
npm install
npm run dev
```

## Building / deploying

```
npm run build
npx vercel --prod --yes
```

## Live inventory sync

The app reads/writes stock through a Google Apps Script Web App bound to
the inventory spreadsheet — see [`apps-script/README.md`](./apps-script/README.md)
for how to deploy or update it. Point the app at your deployment by setting
`INVENTORY_API_URL` in `src/config.js`.

## Dashboard insights (Gemini)

The Alita Flow mark sits in the bottom-right corner of the dashboard.
Gemini writes a short read of whatever range is selected and offers it as a
speech bubble; tapping the mark opens that reading into a conversation where
you can ask about the same slice. The bubble can be waved away without
opening anything, and the thread resets when you change tab or range —
answers about numbers no longer on screen would only mislead.

Every question carries two things
([`src/lib/dashboardDigest.js`](./src/lib/dashboardDigest.js)):

- `onScreen` — the slice being looked at: totals, the trend series, top items,
  the stock attention list.
- `book` — everything the business holds: the full price list with item codes
  and current stock, the trolley items, every item ever traded with its
  lifetime revenue, units, spend and the day it last sold, monthly totals per
  business, and the waste log.

Nothing is fine-tuned or "trained" — the model has no memory between
questions, so each one has to carry the data it needs. Everything sent is
aggregated; individual ledger rows never leave the device. A year of trading
plus the whole catalogue comes to about 32 KB.

The mark bobs gently while it waits, and holds still while the conversation
is open or when the browser asks for reduced motion.

The API key stays on the server. [`api/gemini.js`](./api/gemini.js) is a Vercel
function that holds it; the browser only ever talks to `/api/gemini`. **Never
move the key into a `VITE_` variable** — anything in the Vite bundle is
readable by whoever opens the site.

Setup:

1. Get a key at https://aistudio.google.com/apikey
2. Vercel → project → Settings → Environment Variables → `GEMINI_API_KEY`
3. Locally, copy [`.env.example`](./.env.example) to `.env.local`

Without a key the card doesn't render at all and nothing else changes.
`GEMINI_MODEL` overrides the default `gemini-3.8-flash`.

Note that `npm run dev` (Vite alone) does not serve `/api`, so the card stays
hidden in normal local development. Use `npx vercel dev` to exercise it.

Summaries are cached per section + range + refresh, so switching tabs or going
back to a range you've already looked at costs nothing; the ↻ on the card
forces a rewrite.

## The dashboard and its PIN

There is no sign-in: the shop and trolley open for anyone with the app. The
dashboard is reached the way it always was — **long-press the "Alita Flow"
title** on the home screen and type the four-digit admin PIN. Once it's
accepted, a second long-press goes straight in until the app is closed. The
dashboard's back arrow returns to the section chooser.

What changed underneath is where the PIN lives. It used to be a constant in
the bundle, compared in the browser — which hid the dashboard and protected
nothing, since anything in the bundle is readable by whoever opens the site,
and for a while `/api/gemini` would answer plain `curl` from anyone who found
the URL and spend the Gemini quota doing it. Now:

- The PIN is held by the server ([`api/_pin.js`](./api/_pin.js)). The browser
  sends what was typed to `/api/unlock` and keeps it for the session.
- `/api/gemini` and the dashboard's **Send one now** (`POST /api/notify`) check
  it again on every call, from an `X-Admin-Pin` header.
- Five wrong PINs from one address lock that address out for fifteen minutes,
  so the ten thousand possible PINs can't simply be tried in a loop.

To change the PIN, set `ADMIN_PIN` in Vercel → Settings → Environment
Variables and redeploy. Unset, it is the PIN the app has always used.

`npm run dev` serves no `/api`, so there the PIN box lets any four digits
through; that branch is compiled out of production builds.

The dashboard opens onto whatever it loaded last and refreshes underneath (the
↻ in the header spins while it does). The sheet takes several seconds to
answer — more on a phone's connection — and the page used to show "Loading…"
for all of it on every visit. Insights wait for the fresh numbers rather than
writing a read of the cached ones.

## Morning summary notifications

At 06:00 Nairobi time every device that has switched them on gets two push
notifications — one for the shop, one for the trolley — reading yesterday.

    Shop: KES 7,600 net
    Brass Locks carried the day at KES 4,400; three items are down to their
    last few.

    Trolley: KES 340 down
    Eggs sold through but 22 were cooked and never sold — the third quiet
    Tuesday in a row.

The title is computed from the ledger and is always exact. The line under it
is written by the same Gemini model the dashboard uses
([`api/_summary.js`](./api/_summary.js)), from yesterday's totals, the day
before, the week's average, and either the shop's stock alerts or the
trolley's leftovers. If Gemini is slow, rate-limited or switched off, the
plain figures go out instead — the notification is never skipped over a
model that would not answer.

Days are Nairobi's, stated explicitly rather than inherited: Vercel runs in
UTC, and a 9pm sale would otherwise be filed under the wrong day.

### How it fits together

| Piece | Does |
| --- | --- |
| [`src/sw.js`](./src/sw.js) | Receives the push and shows it. The worker is hand-written now (`injectManifest`) rather than generated, because a push has to be handled with no page open. |
| [`src/lib/pushApi.js`](./src/lib/pushApi.js) | Asks permission, subscribes, and files the endpoint in the sheet. |
| [`src/components/MorningSummary.jsx`](./src/components/MorningSummary.jsx) | The switch at the foot of the dashboard, and **Send one now**. |
| `Push Subscriptions` tab | One row per device. Written by the browser, read only by the cron. |
| [`api/notify.js`](./api/notify.js) | The cron endpoint and the sender. |
| [`api/push.js`](./api/push.js) | Hands the browser the VAPID public key. |

A subscription belongs to one browser on one phone, not to an account — there
is nothing to sign in to. Turning it on again on a second device adds a second
row rather than moving the first. Dead endpoints (a reinstalled app, cleared
site data, a new phone) come back as 404/410 from the push service and are
deleted from the sheet automatically.

### Setup

1. Generate a VAPID pair once and keep it — changing it unsubscribes every
   device:

       node -e "console.log(require('web-push').generateVAPIDKeys())"

2. In Vercel → Settings → Environment Variables, set `VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a `mailto:` for you), `PUSH_SECRET`
   (any long random string) and `CRON_SECRET` (likewise).
3. In the Apps Script editor: Project Settings → Script Properties → add
   `PUSH_SECRET` with the *same* value, then redeploy the web app. That secret
   gates the one request that returns the list of subscribed devices.
4. Deploy. The cron in [`vercel.json`](./vercel.json) runs `/api/notify` at
   `0 3 * * *` (03:00 UTC = 06:00 EAT).
5. Open the dashboard on the phone, switch **Morning summary** on, and tap
   **Send one now** to check it end to end.

Without the VAPID keys the control does not render and nothing else changes.
Without `CRON_SECRET` the scheduled send refuses rather than standing open to
anyone who finds the URL.

### Caveats

- **iOS** only delivers web push to a PWA that has been **added to the home
  screen**, on 16.4 or later. In a plain Safari tab the API is absent and the
  control stays hidden. Android Chrome works from a browser tab.
- On Vercel's Hobby plan a cron fires **once a day, within the hour** of its
  schedule — near six, not at six exactly.
- `npm run dev` does not serve `/api`, so the control stays hidden in normal
  local development. Use `npx vercel dev`.

## Offline behavior

- The full app shell and all product photos are precached, so the catalog
  browses normally with no connection.
- Selling or adding stock while offline queues the action locally (with the
  real timestamp it happened at) and syncs automatically once the device is
  back online.
- If a queued action can no longer succeed once synced (e.g. stock ran out
  in the meantime), it's dropped from the queue and surfaced as an error
  rather than silently lost.
