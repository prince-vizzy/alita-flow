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

## Offline behavior

- The full app shell and all product photos are precached, so the catalog
  browses normally with no connection.
- Selling or adding stock while offline queues the action locally (with the
  real timestamp it happened at) and syncs automatically once the device is
  back online.
- If a queued action can no longer succeed once synced (e.g. stock ran out
  in the meantime), it's dropped from the queue and surfaced as an error
  rather than silently lost.
