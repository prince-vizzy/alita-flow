// Deploy this bound to the "Alitaflow Daily Sales" spreadsheet.
// See apps-script/README.md for setup steps.

/* --------------------------------- Shop ---------------------------------- */

const INVENTORY_SHEET = 'Inventory';
const TSN_LEDGER_SHEET = 'Tsn Ledgers';
const MANUAL_LEDGER_SHEET = 'Manual-Ledger';

/* -------------------------------- Trolley -------------------------------- */

const TROLLEY_INVENTORY_SHEET = 'Trolley Inventory';
const TROLLEY_LOG_SHEET = 'Trolley Log';

// Seeded by setupTrolleySheets(). [name, opening regular stock] — matches
// what's currently on hand per the shared Inventory tab. Add more rows in
// the sheet itself later; this list is only used the one time the tab gets
// created.
const TROLLEY_ITEMS = [
  ['Eggs', 30],
  ['Sweet Potatoes', 0],
  ['Arrow Roots', 0],
  ['Smokie', 10],
];

/* -------------------------------- Routing -------------------------------- */

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};

    if (params.section === 'trolley') {
      if (params.report === 'waste') {
        return jsonOutput({ waste: trolleyWaste(Number(params.days) || 7) });
      }
      return jsonOutput({ items: trolleyItems() });
    }

    if (params.section === 'dashboard') {
      return jsonOutput(dashboardData());
    }

    return jsonOutput({ items: shopItems() });
  } catch (err) {
    return jsonOutput({ error: String(err.message || err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action || 'sell';

    if (body.section === 'trolley') {
      if (action === 'addStock') return trolleyAction(body, 'restock');
      if (action === 'cook') return trolleyAction(body, 'cook');
      if (action === 'expense') return trolleyExpense(body);
      return trolleyAction(body, 'sell');
    }

    if (action === 'addStock') return addStock(body);
    return sell(body);
  } catch (err) {
    return jsonOutput({ error: String(err.message || err) });
  }
}

/* ------------------------------ Shop handlers ---------------------------- */

// Inventory columns: A flag, B No., C Item Name, D Unit Selling Price,
// E Business, F Category (formula), G Added (formula), H Cooked (formula),
// I Sold (formula), J Spoilt (formula), K Remaining (formula). F-K are array
// formulas driven by Tsn Ledgers, so this tab is read-only from here — never
// write to it. Column layout here must track the sheet exactly — check it
// with a fresh xlsx export before trusting this comment blindly, since it's
// already shifted twice.
function shopItems() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(INVENTORY_SHEET);
  const lastRow = sheet.getLastRow();
  const data = sheet.getRange(2, 2, lastRow - 1, 10).getValues(); // B:K

  return data
    .filter((row) => row[1] && row[3] === 'Hardware') // Item Name present, Business = Hardware
    .map((row) => ({
      id: row[0],
      name: row[1],
      price: row[2],
      stock: row[9], // K — Remaining
    }));
}

function sell(body) {
  const name = body.name;
  const qty = Number(body.qty);
  const unit = body.unit || '';

  if (!name || !qty || qty <= 0) {
    return jsonOutput({ error: 'name and a positive qty are required' });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inventorySheet = ss.getSheetByName(INVENTORY_SHEET);
  const rowIndex = findInventoryRow(inventorySheet, name);
  if (rowIndex === -1) {
    return jsonOutput({ error: 'Item not found: ' + name });
  }

  const currentStock = inventorySheet.getRange(2 + rowIndex, 11).getValue(); // K
  if (qty > currentStock) {
    return jsonOutput({ error: 'Not enough stock', stock: currentStock });
  }

  const price = inventorySheet.getRange(2 + rowIndex, 4).getValue(); // D
  const when = body.timestamp ? new Date(body.timestamp) : new Date();
  appendLedgerRow(ss, {
    partner: 'Walk-In',
    docNo: 'NA',
    date: when,
    item: name,
    qty: qty,
    unit: unit,
    type: 'Sales',
    amount: price,
  });
  SpreadsheetApp.flush();

  const updatedStock = inventorySheet.getRange(2 + rowIndex, 11).getValue();
  return jsonOutput({ ok: true, stock: updatedStock });
}

function addStock(body) {
  const name = body.name;
  const qty = Number(body.qty);
  const unit = body.unit || '';

  if (!name || !qty || qty <= 0) {
    return jsonOutput({ error: 'name and a positive qty are required' });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inventorySheet = ss.getSheetByName(INVENTORY_SHEET);
  const rowIndex = findInventoryRow(inventorySheet, name);
  if (rowIndex === -1) {
    return jsonOutput({ error: 'Item not found: ' + name });
  }

  const price = inventorySheet.getRange(2 + rowIndex, 4).getValue(); // D
  const when = body.timestamp ? new Date(body.timestamp) : new Date();
  appendLedgerRow(ss, {
    partner: 'Restock',
    docNo: 'NA',
    date: when,
    item: name,
    qty: qty,
    unit: unit,
    type: 'Purchases',
    amount: price,
  });
  SpreadsheetApp.flush();

  const updatedStock = inventorySheet.getRange(2 + rowIndex, 11).getValue(); // K
  return jsonOutput({ ok: true, stock: updatedStock });
}

function findInventoryRow(inventorySheet, name) {
  const lastRow = inventorySheet.getLastRow();
  const names = inventorySheet.getRange(2, 3, lastRow - 1, 1).getValues(); // C
  return names.findIndex((row) => row[0] === name);
}

// Raw transaction rows + a stock summary, for the /dashboard page. The
// client does the aggregation (by month, by business, top items) — this
// just ships the real records rather than duplicating that logic here too.
function dashboardData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const ledgerSheet = ss.getSheetByName(TSN_LEDGER_SHEET);
  const ledgerLastRow = ledgerSheet.getLastRow();
  const ledgerData = ledgerSheet.getRange(2, 3, ledgerLastRow - 1, 17).getValues(); // C:S

  const transactions = ledgerData
    .filter((row) => row[8]) // Item present
    .map((row) => ({
      business: row[0], // C — Business Type
      source: row[4], // G — "Manual Entry" or "System Logs"
      date: row[3] instanceof Date ? row[3].toISOString() : null, // F
      item: row[8], // K
      qty: Number(row[9]) || 0, // L
      type: row[12], // O — Tsn. Type
      sales: Number(row[15]) || 0, // R
      expenses: Number(row[14]) || 0, // Q
    }))
    // Tsn Ledgers' own VSTACK/HSTACK formula merges in Trolley Log rows too
    // (Source = "System Logs"), but that block produces one fewer column
    // than the Manual-Ledger block (no Amount field), so everything from M
    // onward lands one column left of where this fixed-index read expects —
    // O ends up holding "Stock" (Item Type) instead of the real Tsn. Type,
    // and the Sales/Expenses formulas (Q/R) never fire for these rows. That
    // currently makes them inert here (type never equals 'Sales'/'Purchases')
    // rather than double-counted, but it's an accident of a formula bug, not
    // something to depend on — trolleyLogAsTransactions() below already
    // reads Trolley Log directly and correctly, so only the "System Logs"
    // rows are dropped here. Filtering by business (not source) would also
    // catch legitimate historical Trolley entries that came in correctly
    // through Manual-Ledger before Trolley Log existed — those stay.
    .filter((t) => t.source !== 'System Logs')
    .map(({ source, ...t }) => t);

  const invSheet = ss.getSheetByName(INVENTORY_SHEET);
  const invLastRow = invSheet.getLastRow();
  const invData = invSheet.getRange(2, 3, invLastRow - 1, 9).getValues(); // C:K

  let outOfStock = 0;
  let lowStock = 0;
  invData.forEach((row) => {
    const name = row[0]; // C
    const business = row[2]; // E
    const remaining = Number(row[8]) || 0; // K
    if (!name || business !== 'Hardware') return;
    if (remaining <= 0) outOfStock++;
    else if (remaining <= 3) lowStock++;
  });

  return {
    transactions: transactions.concat(trolleyLogAsTransactions(ss)),
    stock: { outOfStock: outOfStock, lowStock: lowStock },
  };
}

// Trolley sell/restock/cook/expense events live in Trolley Log, never in Tsn
// Ledgers, so the dashboard can't see them without this — synthesize each
// row into the same shape as a Tsn Ledgers transaction so it flows through
// the same client-side aggregation. 'cook' is skipped: it's an internal
// transfer (raw -> cooked), not money changing hands.
//
// This also sidesteps a real limitation of the sheet's own Tsn-Ledgers merge:
// its Business Type column is a formula that classifies purely by matching
// the item name against Inventory's Trolley rows. Ingredient expenses
// (onions, tomatoes, …) were deliberately never added to Inventory, so that
// regex would tag them as Hardware. Reading Trolley Log directly and
// hardcoding business: 'Trolley' here avoids that misclassification.
function trolleyLogAsTransactions(ss) {
  const logSheet = ss.getSheetByName(TROLLEY_LOG_SHEET);
  if (!logSheet) return [];
  const lastRow = logSheet.getLastRow();
  if (lastRow < 2) return [];

  const rows = logSheet.getRange(2, 1, lastRow - 1, 6).getValues(); // Timestamp,Item,Type,Qty,Unit,Amount
  const priceByName = trolleyPricesFromInventory(ss);

  const out = [];
  rows.forEach((row) => {
    const when = row[0];
    const name = row[1];
    const type = String(row[2] || '').toLowerCase();
    const qty = Number(row[3]) || 0;
    const explicitAmount = Number(row[5]) || 0; // Amount — set for portion-priced sells
    if (!name || !qty || !(when instanceof Date)) return;

    if (type === 'expense') {
      // Qty holds the KES amount directly for expense rows, not a physical
      // quantity — these are non-stock ingredient costs with no Inventory
      // row and no per-unit price to multiply against.
      out.push({
        business: 'Trolley',
        date: when.toISOString(),
        item: name,
        qty: 0,
        type: 'Purchases',
        sales: 0,
        expenses: qty,
      });
      return;
    }

    if (type !== 'sell' && type !== 'restock') return;

    // Some items (Arrow Roots, Sweet Potatoes) are sold as a portion for a
    // customer-chosen price rather than qty x a fixed per-unit price — the
    // client sends that price explicitly as Amount, which takes priority
    // over the Inventory price lookup when present.
    const price = priceByName[name] || 0;
    const total = explicitAmount || qty * price;
    out.push({
      business: 'Trolley',
      date: when.toISOString(),
      item: name,
      qty: qty,
      type: type === 'sell' ? 'Sales' : 'Purchases',
      sales: type === 'sell' ? total : 0,
      expenses: type === 'restock' ? total : 0,
    });
  });
  return out;
}

// Trolley items' real prices live on the shared Inventory tab (Business =
// Trolley), not the separate Trolley Inventory tab — that tab only tracks
// raw/cooked quantities.
function trolleyPricesFromInventory(ss) {
  const sheet = ss.getSheetByName(INVENTORY_SHEET);
  const lastRow = sheet.getLastRow();
  const data = sheet.getRange(2, 3, lastRow - 1, 3).getValues(); // C:E — Item Name, Price, Business

  const prices = {};
  data.forEach((row) => {
    if (row[0] && row[2] === 'Trolley') prices[row[0]] = row[1];
  });
  return prices;
}

// Tsn Ledgers is no longer directly writable — it's now a spilled array
// formula (VSTACK/HSTACK in its Source column) that computes itself by
// merging 'Manual-Ledger' (this app's shop sales/restocks) with 'Trolley
// Log' (this app's trolley sell/cook/restock). Writing into Tsn Ledgers'
// cells directly would collide with that formula's spill range. The real
// write target for shop sales/restocks is 'Manual-Ledger':
// A flag (unused), B Partner, C PIN (unused — no PIN concept in the app,
// left blank), D Doc No., E Date, F Item, G Qty, H Amount, I UoM,
// J Tsn. Type, K Item Type — all plain values, no formulas.
// 'Manual-Ledger' has the same array-formula-driven FilterDatabase range
// trick (spans to row 1473) that made getLastRow() unreliable on the old
// Tsn Ledgers, so find the first row where Item (F) is genuinely blank
// rather than trusting getLastRow() to point at real data.
//
// Both this tab's name (was 'Manual-Ledgers', plural) and Tsn Ledgers'
// column layout (for dashboardData()) have now shifted multiple times —
// verify with a fresh xlsx export before trusting any sheet-name or
// column-index comment in this file blindly.
function appendLedgerRow(ss, entry) {
  const sheet = mustGetSheet(ss, MANUAL_LEDGER_SHEET);
  const lastRow = sheet.getLastRow();
  const itemCol = sheet.getRange(2, 6, lastRow - 1, 1).getValues(); // F

  let targetRow = -1;
  for (let i = 0; i < itemCol.length; i++) {
    if (!itemCol[i][0]) {
      targetRow = i + 2;
      break;
    }
  }
  if (targetRow === -1) {
    throw new Error('Manual-Ledger is full — no blank row left to record this in');
  }

  sheet
    .getRange(targetRow, 2, 1, 10) // B:K
    .setValues([
      [
        entry.partner,
        '', // PIN — unused
        entry.docNo,
        entry.date,
        entry.item,
        entry.qty,
        entry.amount,
        entry.unit,
        entry.type,
        'Stock', // Item Type — every existing manual-entry row uses this value
      ],
    ]);
}

/* ---------------------------- Trolley handlers --------------------------- */

// The trolley keeps two stocks per item:
//
//   regular  raw supply on hand   = Opening Regular + restocks - everything cooked
//   cooked   ready to sell today  = cooked today - sold today
//
// Because cooked stock is derived from *today's* log rows only, it resets to
// zero on its own at midnight — no scheduled trigger needed. Whatever was
// cooked on an earlier day but never sold is that day's waste, which makes the
// waste report a read over the same log rather than a separate write.
function trolleyState() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const invSheet = mustGetSheet(ss, TROLLEY_INVENTORY_SHEET);
  const logSheet = mustGetSheet(ss, TROLLEY_LOG_SHEET);
  const priceByName = trolleyPricesFromInventory(ss);

  const invLastRow = invSheet.getLastRow();
  const invRows = invLastRow > 1 ? invSheet.getRange(2, 1, invLastRow - 1, 4).getValues() : [];

  const items = {};
  const order = [];
  invRows.forEach((row) => {
    const name = row[1];
    if (!name) return;
    items[name] = {
      id: row[0],
      name: name,
      // Prices are actually kept on the shared Inventory tab (Business =
      // Trolley), not this tab's own Unit Price column — fall back to that
      // column only if the item isn't listed there yet.
      price: priceByName[name] || row[2] || 0,
      regularStock: Number(row[3]) || 0,
    };
    order.push(name);
  });

  const logLastRow = logSheet.getLastRow();
  const logRows = logLastRow > 1 ? logSheet.getRange(2, 1, logLastRow - 1, 5).getValues() : [];

  const perDay = {}; // 'YYYY-MM-DD' -> { itemName: { cooked, sold } }
  function bucket(day, name) {
    if (!perDay[day]) perDay[day] = {};
    if (!perDay[day][name]) perDay[day][name] = { cooked: 0, sold: 0 };
    return perDay[day][name];
  }

  logRows.forEach((row) => {
    const when = row[0];
    const name = row[1];
    const type = String(row[2] || '').toLowerCase();
    const qty = Number(row[3]) || 0;
    if (!name || !qty || !items[name] || !(when instanceof Date)) return;

    const day = dayKey(when);
    if (type === 'restock') {
      items[name].regularStock += qty;
    } else if (type === 'cook') {
      items[name].regularStock -= qty;
      bucket(day, name).cooked += qty;
    } else if (type === 'sell') {
      bucket(day, name).sold += qty;
    }
  });

  return { items: items, order: order, perDay: perDay };
}

function cookedOn(state, name, day) {
  const entry = state.perDay[day] && state.perDay[day][name];
  return entry ? entry.cooked - entry.sold : 0;
}

function trolleyItems() {
  const state = trolleyState();
  const today = dayKey(new Date());

  return state.order.map((name) => {
    const item = state.items[name];
    return {
      id: item.id,
      name: item.name,
      price: item.price,
      regularStock: item.regularStock,
      cookedStock: cookedOn(state, name, today),
    };
  });
}

// One handler for all three trolley writes. `type` is what lands in the log's
// Type column: 'restock', 'cook' or 'sell'. `body.amount`, when present, is
// an explicit KES total for the sale (portion-priced items like Arrow Roots
// and Sweet Potatoes, sold for a customer-chosen price rather than qty x a
// fixed per-unit price) — written to the log's Amount column and preferred
// over the Inventory price lookup in trolleyLogAsTransactions().
function trolleyAction(body, type) {
  const name = body.name;
  const qty = Number(body.qty);
  const unit = body.unit || '';
  const amount = body.amount ? Number(body.amount) : '';

  if (!name || !qty || qty <= 0) {
    return jsonOutput({ error: 'name and a positive qty are required' });
  }

  const state = trolleyState();
  if (!state.items[name]) {
    return jsonOutput({ error: 'Item not found: ' + name });
  }

  const when = body.timestamp ? new Date(body.timestamp) : new Date();
  const today = dayKey(new Date());
  // Validate a sale against the day it actually happened, so an action that
  // was queued offline yesterday and synced today still checks out correctly.
  const actionDay = dayKey(when);

  if (type === 'cook' && qty > state.items[name].regularStock) {
    return jsonOutput({
      error: 'Not enough regular stock',
      regularStock: state.items[name].regularStock,
      cookedStock: cookedOn(state, name, today),
    });
  }

  if (type === 'sell' && qty > cookedOn(state, name, actionDay)) {
    return jsonOutput({
      error: 'Not enough cooked stock',
      regularStock: state.items[name].regularStock,
      cookedStock: cookedOn(state, name, today),
    });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  mustGetSheet(ss, TROLLEY_LOG_SHEET).appendRow([when, name, type, qty, unit, amount]);
  SpreadsheetApp.flush();

  const after = trolleyState();
  return jsonOutput({
    ok: true,
    regularStock: after.items[name].regularStock,
    cookedStock: cookedOn(after, name, dayKey(new Date())),
  });
}

// Logs a cash cost for a non-stock trolley ingredient (onions, tomatoes,
// tomato sauce, barbecue sauce, salt, …) — things bought regularly but never
// tracked as inventory items themselves. Written straight to Trolley Log
// with Qty repurposed as the KES amount, same as every other trolley write;
// trolleyLogAsTransactions() is what turns it into a dashboard transaction.
function trolleyExpense(body) {
  const name = body.name;
  const amount = Number(body.qty);

  if (!name || !amount || amount <= 0) {
    return jsonOutput({ error: 'name and a positive amount are required' });
  }

  const when = body.timestamp ? new Date(body.timestamp) : new Date();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  mustGetSheet(ss, TROLLEY_LOG_SHEET).appendRow([when, name, 'expense', amount, 'KES']);
  SpreadsheetApp.flush();

  return jsonOutput({ ok: true });
}

// Cooked but never sold, per past day. Today is excluded — it isn't over yet.
function trolleyWaste(days) {
  const state = trolleyState();
  const now = new Date();
  const today = dayKey(now);
  const cutoff = dayKey(new Date(now.getTime() - days * 24 * 60 * 60 * 1000));

  return Object.keys(state.perDay)
    .filter((day) => day < today && day >= cutoff)
    .sort()
    .reverse()
    .map((day) => {
      const items = [];
      let total = 0;
      state.order.forEach((name) => {
        const left = cookedOn(state, name, day);
        if (left > 0) {
          items.push({ name: name, qty: left });
          total += left;
        }
      });
      return { date: day, items: items, total: total };
    })
    .filter((day) => day.total > 0);
}

/* --------------------------- One-time trolley setup ---------------------- */

// Run this once from the Apps Script editor (select it in the function
// dropdown, press Run). It creates the two trolley tabs and seeds the items.
// Safe to re-run — it never touches tabs that already exist.
function setupTrolleySheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss.getSheetByName(TROLLEY_INVENTORY_SHEET)) {
    const inv = ss.insertSheet(TROLLEY_INVENTORY_SHEET);
    inv.appendRow(['No.', 'Item Name', 'Unit Price', 'Opening Regular']);
    TROLLEY_ITEMS.forEach((item, i) => inv.appendRow([i + 1, item[0], 0, item[1]]));
    inv.setFrozenRows(1);
    inv.autoResizeColumns(1, 4);
  }

  if (!ss.getSheetByName(TROLLEY_LOG_SHEET)) {
    const log = ss.insertSheet(TROLLEY_LOG_SHEET);
    log.appendRow(['Timestamp', 'Item', 'Type', 'Qty', 'Unit', 'Amount']);
    log.setFrozenRows(1);
    log.autoResizeColumns(1, 6);
  }

  return 'Trolley sheets ready.';
}

/* --------------------------------- Helpers ------------------------------- */

function mustGetSheet(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error(
      'Missing sheet "' + name + '" — run setupTrolleySheets() once from the Apps Script editor.'
    );
  }
  return sheet;
}

// Calendar day in the spreadsheet's own timezone, as YYYY-MM-DD.
function dayKey(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
