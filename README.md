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

The Alita Flow mark sits in the bottom-right corner of the admin dashboard.
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

## Offline behavior

- The full app shell and all product photos are precached, so the catalog
  browses normally with no connection.
- Selling or adding stock while offline queues the action locally (with the
  real timestamp it happened at) and syncs automatically once the device is
  back online.
- If a queued action can no longer succeed once synced (e.g. stock ran out
  in the meantime), it's dropped from the queue and surfaced as an error
  rather than silently lost.
