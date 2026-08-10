# Alita Flow

A React + Vite PWA for browsing inventory, selling items, and adding stock,
built for a plumbing/hardware shop. Stock is synced live to a Google Sheet
and the app works offline (browsing, selling, and restocking all queue and
sync automatically once back online).

**Live:** https://alita-flow.vercel.app

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
