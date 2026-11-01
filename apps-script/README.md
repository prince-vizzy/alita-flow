# Wiring the app to the live inventory sheet

This makes the React app read live stock from the "Alitaflow Daily Sales" sheet
and deduct stock when a sale is made. It never writes to the formula-driven
Added/Sold/Spoilt/Remaining columns directly.

It serves both sections of the app:

| Section | Reads | Writes |
| --- | --- | --- |
| Shop | `Inventory` (rows where Business = Hardware) | `Manual-Ledger` — one row per sale (Tsn. Type = Sales) or restock (Tsn. Type = Purchases), which `Tsn Ledgers` then absorbs via its own formula |
| Trolley | `Trolley - Inventory`, `Trolley - Ledger Entry` | `Trolley - Ledger Entry` |
| Dashboard | `Tsn Ledgers` (Hardware rows only, raw), `Inventory` (stock counts), `Trolley - Ledger Entry` | — (read-only) |
| Notifications | `Push Subscriptions` | `Push Subscriptions` — one row per device that wants the morning summary |

`?section=dashboard` ships the raw transaction rows rather than pre-aggregating
them — the `/dashboard` page does the monthly/business grouping client-side,
so there's one source of truth for that logic instead of duplicating it here.
Trolley rows are read straight from `Trolley - Ledger Entry` and turned into
transactions there too. Sales and Purchases count at Qty x Amount; Spoilt,
Missing and Float Top Up rows carry no revenue or spend.

The `/dashboard` page itself is not linked from the home screen. It's opened
by long-pressing the "Alita Flow" title and entering the PIN, which the server checks (`api/_pin.js`).

**The shop and dashboard sections of `Code.gs` still expect `Inventory`,
`Tsn Ledgers` and `Manual-Ledger`, which the sheet no longer has**, so those
requests fail with `Cannot read properties of null (reading 'getLastRow')`
until they are moved to `Shop - Ledger Entry` and `Shop - Inventory`. The
trolley does not touch those tabs. `Trolley Log` and `Trolley Inventory` are
no longer read or written.

### How the trolley writes to the ledger

Columns D (Date), F (UoM) and I (Item Type) of `Trolley - Ledger Entry` are
array formulas that spill down the whole column, so only B, C, E, G, H, J and
K are written. D carries B down to the next filled B, so every row the app
writes fills B, and a corrected row is zeroed rather than cleared. The next
free row is the first with a blank Tsn. Type (C), because a Float Top Up row
has no Item. Item (E) only accepts names on `Trolley - Inventory`, and a name
that isn't there is rejected, so `src/data/trolleyProducts.js` has to match it.

A close's rows say `Day close` in Narration, which is how correcting a day
finds its own rows and leaves hand-entered ones alone. Sales rows from a close
go to the `Trolley - Mpesa` account; purchases leave Account blank.

`Tsn Ledgers` was a computed view — a spilled array formula that merged
`Manual-Ledger` (shop sales/restocks) with `Trolley Log`, so nothing got written
there directly. `Manual-Ledger`
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

## 3. How trolley stock works

    opening  = Purchases before today − Sales, Spoilt and Missing before today
    closing  = opening + added today − sold today − spoilt today

There is no scheduled trigger and nothing to reset by hand: tomorrow's opening is
the same sum run one day further. Items in the `Potatoes` category have no count,
because the ledger books them as the day's takings at Qty 1. To add a trolley
item, add it to `Trolley - Inventory` and to `src/data/trolleyProducts.js`.

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
