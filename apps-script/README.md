# Wiring the app to the live inventory sheet

This makes the React app read live stock from the "Alitaflow Daily Sales" sheet
and deduct stock when a sale is made. It never writes to the formula-driven
Added/Sold/Spoilt/Remaining columns directly.

It serves both sections of the app:

| Section | Reads | Writes |
| --- | --- | --- |
| Shop | `Inventory` (rows where Business = Hardware) | `Manual-Ledger` — one row per sale (Tsn. Type = Sales) or restock (Tsn. Type = Purchases), which `Tsn Ledgers` then absorbs via its own formula |
| Trolley | `Inventory` (price only, rows where Business = Trolley), `Trolley Inventory`, `Trolley Log` | `Trolley Log` |
| Dashboard | `Tsn Ledgers` (Hardware rows only, raw), `Inventory` (stock counts, Trolley prices), `Trolley Log` | — (read-only) |

`?section=dashboard` ships the raw transaction rows rather than pre-aggregating
them — the `/dashboard` page does the monthly/business grouping client-side,
so there's one source of truth for that logic instead of duplicating it here.
Trolley `sell`/`restock` events only ever land in `Trolley Log`, never in
`Tsn Ledgers`, so `dashboardData()` also reads `Trolley Log` and synthesizes
each row into a transaction (priced from `Inventory`'s Trolley rows) before
returning it — `cook` events are skipped since they're an internal transfer,
not money changing hands. This is what feeds the Trolley section on the
`/dashboard` page.

`dashboardData()` explicitly drops any `business === 'Trolley'` row it reads
from `Tsn Ledgers` itself. That sheet's own merge formula (its Source column)
also pulls in Trolley Log rows, but its Trolley block produces one column
fewer than its Manual-Ledger block, so every fixed-index read past that point
lands one column off *only* for those rows — right now that just makes them
inert (the misread Tsn. Type never matches `Sales`/`Purchases`), but relying
on that by accident is fragile. `trolleyLogAsTransactions()` already reads
`Trolley Log` directly and correctly, so Trolley data only ever comes from
there.

The `/dashboard` page itself is not linked from the home screen. It's opened
by long-pressing the "Alita Flow" logo and entering the PIN (`src/lib/adminGate.js`).

Shop items and their live stock all live on the single `Inventory` tab,
distinguished by a Business column (`Hardware` vs `Trolley`). Trolley item
**prices** are kept there too (that's where you edit them), but Trolley
**quantities** use their own two tabs instead, since `Inventory`'s
Added/Sold/Remaining formulas don't have a way to represent the Trolley's
raw-vs-cooked two-stock model.

`Tsn Ledgers` is a computed view — a spilled array formula that merges
`Manual-Ledger` (shop sales/restocks) with `Trolley Log` (trolley
sell/cook/restock), so nothing gets written there directly. `Manual-Ledger`
itself still has the TSN-ID-style array-formula-driven filter range that
made `getLastRow()` unreliable, so `Code.gs` finds the first row whose Item
cell is genuinely blank and writes only the plain-value columns (Partner,
Doc No., Date, Item, Qty, UoM, Tsn. Type, Amount — the sheet also has a PIN
column the app doesn't use and leaves blank).

Both `Tsn Ledgers`' column order and `Manual-Ledger`'s name and columns have
already shifted multiple times as the sheet owner reorganizes it — if
sales/restocks stop recording or the dashboard reads zero, re-verify both
against a fresh xlsx export before assuming the bug is anywhere else.

## 1. Open the Apps Script editor

In the spreadsheet: **Extensions → Apps Script**.

## 2. Paste the code

Delete whatever is in `Code.gs` and paste in the contents of
[`Code.gs`](./Code.gs) from this folder.

## 3. Create the trolley tabs (one time)

The trolley section needs two tabs the spreadsheet doesn't have. In the
Apps Script editor, pick `setupTrolleySheets` from the function dropdown and
press **Run**. It creates:

- **Trolley Inventory** — `No. | Item Name | Unit Price | Opening Regular`,
  seeded with the current trolley items (Eggs, Sweet Potatoes, Arrow Roots,
  Smokie) and their current on-hand quantities.
- **Trolley Log** — `Timestamp | Item | Type | Qty | Unit`, where Type is
  `restock`, `cook` or `sell`.

Re-running it is safe; it skips tabs that already exist. Prices weren't set
for any trolley item yet, so fill in the real **Unit Price** for each one
afterwards. To add a new trolley item later, just add a row to Trolley
Inventory (and a matching entry in `src/data/trolleyProducts.js` so it has
an emoji before the first sync).

### How the two trolley stocks work

    regular  raw supply on hand   = Opening Regular + restocks − everything cooked
    cooked   ready to sell today  = cooked today − sold today

Cooked stock is derived from *today's* log rows only, so it drops back to zero
by itself at midnight — there's no scheduled trigger to set up and nothing to
reset by hand. Anything cooked on an earlier day that was never sold is that
day's waste, which the app reads back through
`?section=trolley&report=waste&days=7`.

## 4. Deploy as a Web App

1. Click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy**, then **Authorize access** and approve the permissions
   (it needs edit access to this spreadsheet).
5. Copy the **Web app URL** it gives you — it looks like
   `https://script.google.com/macros/s/AKfycb.../exec`.

## 5. Give the app that URL

Paste the URL into `src/config.js` as `INVENTORY_API_URL`.

## Redeploying after edits

If you ever change `Code.gs`, you must create a **new deployment** (or
"Manage deployments" → edit → new version) for changes to take effect on
the existing URL.
