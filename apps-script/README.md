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
| Notifications | `Push Subscriptions` | `Push Subscriptions` — one row per device that wants the morning summary |

`?section=dashboard` ships the raw transaction rows rather than pre-aggregating
them — the `/dashboard` page does the monthly/business grouping client-side,
so there's one source of truth for that logic instead of duplicating it here.
Trolley `sell`/`restock` events only ever land in `Trolley Log`, never in
`Tsn Ledgers`, so `dashboardData()` also reads `Trolley Log` and synthesizes
each row into a transaction (priced from `Inventory`'s Trolley rows) before
returning it — `cook` events are skipped since they're an internal transfer,
not money changing hands. This is what feeds the Trolley section on the
`/dashboard` page.

`dashboardData()` explicitly drops the `Source = "System Logs"` rows it reads
from `Tsn Ledgers` itself. That sheet's own merge formula also pulls in
Trolley Log rows, and since Trolley Log gained its Amount and "Ammended Type"
columns those rows line up with a real Tsn. Type. Keeping them would count
every trolley sale twice, and "Ammended Type" maps `restock` to `Sales`, so
restocks would count as revenue too. `trolleyLogAsTransactions()` reads
`Trolley Log` directly, so Trolley data only ever comes from there.

Trolley Log writes go into the first row whose Item cell is blank rather than
through `appendRow()`. The "Ammended Type" array formula fills its column down
to the bottom of the grid, so `appendRow()` lands below that instead of
under the last entry. It has already left rows 27–999 empty once, and
`Tsn Ledgers` only merges Trolley Log down to row 1473.

The `/dashboard` page itself is not linked from the home screen. It's opened
by long-pressing the "Alita Flow" title and entering the PIN, which the server checks (`api/_pin.js`).

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

Several `Manual-Ledger` columns are strict dropdowns, and one value outside a
list rejects the whole row — the sale simply isn't recorded, and the app shows
the sheet's "violates the data validation rules" message. `Code.gs` writes
only what the lists allow: the app's "Pieces"/"Packets" become `Pcs`/`Pkt`
(`ledgerUnit()`), and restocks leave Partner blank, since it only accepts the
sheet's named suppliers and customers. If a dropdown changes, check these
first.

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
- **Trolley Log** — `Timestamp | Item | Type | Qty | Unit | Amount`, where
  Type is `restock`, `cook`, `sell` or `expense`. The sheet has since added a
  formula column G, "Ammended Type", which the app never writes to.

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

## 3b. Set PUSH_SECRET (only if you want morning notifications)

The morning summary cron has to read the list of subscribed devices, and that
is the one request here that returns something worth keeping private. It is
behind a shared secret.

In the Apps Script editor: **Project Settings → Script Properties → Add script
property**, name `PUSH_SECRET`, value any long random string. Put the same
value in the Vercel project as `PUSH_SECRET`.

The `Push Subscriptions` tab creates itself the first time a device subscribes
— there is nothing to run. Its columns are:

    Endpoint | p256dh | auth | Label | Subscribed

The endpoint is the identity. A browser that re-subscribes with the same
endpoint updates its row rather than adding a second one, and the notifier
deletes rows the push service reports as gone (404/410) — a reinstalled app or
a new phone cleans itself up.

Skipping this step costs nothing else: subscribing still works, the scheduled
send just refuses with `PUSH_SECRET is not set in the script properties.`

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
