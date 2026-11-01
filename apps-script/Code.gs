// Deploy this bound to the "Alitaflow Daily Sales" spreadsheet.
// See apps-script/README.md for setup steps.

/* --------------------------------- Shop ---------------------------------- */

const INVENTORY_SHEET = 'Inventory';
const TSN_LEDGER_SHEET = 'Tsn Ledgers';
const MANUAL_LEDGER_SHEET = 'Manual-Ledger';

/* -------------------------------- Trolley -------------------------------- */

const TROLLEY_LEDGER_SHEET = 'Trolley - Ledger Entry';
const TROLLEY_ITEMS_SHEET = 'Trolley - Inventory';

// Marks the rows a day's close wrote, in the Narration column, so correcting a
// close finds its own rows and leaves anything entered by hand alone.
const CLOSE_NARRATION = 'Day close';

// One of the sheet's Account dropdown values, and what nearly every existing
// Sales row uses. The close has no way to split takings by account.
const SALES_ACCOUNT = 'Trolley - Mpesa';

/* ---------------------------- Push notifications -------------------------- */

// Where each device that wants the morning summary is filed. Written by the
// browser when the owner turns notifications on; read by the Vercel cron,
// which is the only thing that ever needs the whole list.
const PUSH_SHEET = 'Push Subscriptions';

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

    // The list of devices, for the notification cron only. A subscription is
    // useless without the VAPID private key, but there is no reason to hand
    // out the owner's device endpoints to anyone who guesses the query, so
    // this one read is behind a shared secret.
    if (params.section === 'push') {
      requirePushSecret(params.key);
      return jsonOutput({ subscriptions: pushSubscriptions() });
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

    // Subscribing is the browser saying "notify this device" — it comes with
    // the endpoint the push service just minted, which is the credential, so
    // there is nothing here for the secret to protect.
    if (body.section === 'push') {
      if (action === 'unsubscribe') return jsonOutput(pushUnsubscribe(body.endpoint));
      return jsonOutput(pushSubscribe(body));
    }

    if (body.section === 'trolley') {
      if (action === 'close') return trolleyClose(body);
      if (action === 'addStock') return trolleyRestock(body);
      if (action === 'expense') return trolleyExpense(body);
      // A copy of the app from before the change, still sending single sales.
      return jsonOutput({ error: 'Trolley sales are now recorded when the day is closed.' });
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
// I Sold (formula), J Spoilt (formula), K Remaining (formula), L Code (the
// item code, plain). F-K are array formulas driven by Tsn Ledgers, so this
// tab is read-only from here — never write to it. Column layout here must track the sheet exactly — check it
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
    // Partner only accepts the sheet's own list of named suppliers and
    // customers. The app doesn't know who a restock came from, and a blank
    // is allowed where a made-up name like "Restock" is rejected.
    partner: '',
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
    // (Source = "System Logs"). trolleyLogAsTransactions() below reads Trolley
    // Log directly, so those rows are dropped here — keeping both would count
    // every trolley sale twice. This filter is load-bearing: the merge used
    // to be one column short, which left these rows inert here by accident,
    // but it now carries Trolley Log's Amount and "Ammended Type" columns and
    // lines up, so they arrive with a real Tsn. Type. And that type is
    // "Sales" for restocks as well as sells, so without this a restock would
    // read as revenue. Filtering by business (not source) would also catch
    // legitimate historical Trolley entries that came in through
    // Manual-Ledger before Trolley Log existed — those stay.
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
    transactions: transactions.concat(trolleyLedgerAsTransactions(ss)),
    stock: { outOfStock: outOfStock, lowStock: lowStock },
  };
}

// The trolley ledger, in the same shape as a Tsn Ledgers transaction so it flows
// through the same client-side aggregation. A row is worth Qty x Amount. Spoilt
// and Missing rows move stock but no money, and a Float Top Up is cash moving
// between people rather than spending, so none of those are transactions.
function trolleyLedgerAsTransactions(ss) {
  const out = [];
  readTrolleyLedger(ss).forEach((row) => {
    if (!row.item || !(row.date instanceof Date)) return;
    if (row.type !== 'Sales' && row.type !== 'Purchases') return;

    const total = row.qty * row.amount;
    out.push({
      business: 'Trolley',
      date: row.date.toISOString(),
      item: row.item,
      qty: row.qty,
      type: row.type,
      sales: row.type === 'Sales' ? total : 0,
      expenses: row.type === 'Purchases' ? total : 0,
    });
  });
  return out;
}

// Tsn Ledgers is no longer directly writable — it's now a spilled array
// formula (VSTACK/HSTACK in its Source column) that computes itself by
// merging 'Manual-Ledger' (this app's shop sales/restocks) with 'Trolley
// Log' (this app's trolley sell/cook/restock). Writing into Tsn Ledgers'
// cells directly would collide with that formula's spill range. The real
// write target for shop sales/restocks is 'Manual-Ledger':
// A flag (unused), B Partner, C PIN (unused — no PIN concept in the app,
// left blank), D Doc No., E Date, F Item, G Qty, H Amount, I UoM,
// J Tsn. Type, K Item Type, L Narration (left blank — Tsn Ledgers doesn't
// read it) — all plain values, no formulas. The "Shop Ledger Entry" tab has
// the same rows in a different column order, but no formula reads it yet;
// Tsn Ledgers still merges Manual-Ledger, so this stays the write target.
// 'Manual-Ledger' has the same array-formula-driven FilterDatabase range
// trick (spans to row 1473) that made getLastRow() unreliable on the old
// Tsn Ledgers, so find the first row where Item (F) is genuinely blank
// rather than trusting getLastRow() to point at real data.
//
// Both this tab's name (was 'Manual-Ledgers', plural) and Tsn Ledgers'
// column layout (for dashboardData()) have now shifted multiple times —
// verify with a fresh xlsx export before trusting any sheet-name or
// column-index comment in this file blindly.
// Manual-Ledger's UoM column is a strict dropdown of the sheet's own
// abbreviations — Pcs, Pkt, Litre, Ml, Kg, M, Can, Tray — and rejects the
// whole write for anything else, so a sale sent as "Pieces" was never
// recorded. The app keeps its readable labels; they're translated here, so a
// sale queued offline by an older copy of the app still lands. A unit the
// sheet has no word for is left blank rather than failing the sale.
const LEDGER_UNITS = {
  pcs: 'Pcs',
  piece: 'Pcs',
  pieces: 'Pcs',
  pkt: 'Pkt',
  packet: 'Pkt',
  packets: 'Pkt',
  litre: 'Litre',
  litres: 'Litre',
  ml: 'Ml',
  kg: 'Kg',
  m: 'M',
  can: 'Can',
  cans: 'Can',
  tray: 'Tray',
  trays: 'Tray',
};

function ledgerUnit(unit) {
  return LEDGER_UNITS[String(unit || '').trim().toLowerCase()] || '';
}

function appendLedgerRow(ss, entry) {
  const sheet = mustGetSheet(ss, MANUAL_LEDGER_SHEET);
  const targetRow = firstBlankRow(sheet, 6); // F — Item
  if (!targetRow) {
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
        ledgerUnit(entry.unit),
        entry.type,
        'Stock', // Item Type — every existing manual-entry row uses this value
      ],
    ]);
}

/* ---------------------------- Trolley handlers --------------------------- */

// The trolley runs on one stock figure per item and one record per day:
//
//   opening  = every Purchases row before today, less every Sales, Spoilt and
//              Missing row before today
//   closing  = opening + added today - sold today - spoilt today
//
// Nobody records a sale as it happens. At the end of the day the operator
// enters units sold and spoilt per item, and closing stock follows; tomorrow's
// opening is simply the same sum run one day further, so there is nothing to
// roll over and no trigger to schedule.
//
// Items in the Potatoes category have no count at all. The ledger books them
// as Qty 1 x the day's takings (Sweet-Potatoes stands at 11 bought, 37 "sold"),
// so they close on a KES figure and report no stock.
//
// 'Trolley - Ledger Entry' columns: A flag, B Date Recorded, C Tsn. Type,
// D Date, E Item, F UoM, G Qty, H Amount (per unit, so a row is worth G x H),
// I Item Type, J Account, K Narration, L Doc No., M Partner, N PIN.
// D, F and I are array formulas that spill down the whole column, so writing
// any of them breaks the column — only B, C, E, G, H, J and K are ever written.
// D carries B down to the next filled B, which is why every row written here
// fills B, and why a row is zeroed rather than cleared: blanking one would hand
// its date to whichever rows come after it.
function readTrolleyLedger(ss) {
  const sheet = mustGetSheet(ss, TROLLEY_LEDGER_SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const rows = [];
  sheet
    .getRange(2, 1, lastRow - 1, 11) // A:K
    .getValues()
    .forEach((row, i) => {
      if (!row[2]) return; // C — Tsn. Type
      rows.push({
        at: i + 2,
        type: row[2],
        day: row[3] instanceof Date ? dayKey(row[3]) : '', // D
        date: row[3],
        item: row[4], // E
        qty: Number(row[6]) || 0, // G
        amount: Number(row[7]) || 0, // H
        narration: row[10], // K
      });
    });
  return rows;
}

// Only what the trolley actually sells: 'Trolley - Inventory' also lists sauces,
// charcoal and the council fee, which are costs and never stock.
function trolleyCatalog(ss) {
  const sheet = mustGetSheet(ss, TROLLEY_ITEMS_SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet
    .getRange(2, 2, lastRow - 1, 4) // B:E — No., Item Name, Price, Category
    .getValues()
    .filter((row) => row[1] && (row[3] === 'Stock' || row[3] === 'Potatoes'))
    .map((row) => ({
      id: row[0],
      name: row[1],
      price: Number(row[2]) || 0,
      counted: row[3] === 'Stock',
    }));
}

function trolleyPosition(catalog, rows, day) {
  const byName = {};
  catalog.forEach((item) => {
    byName[item.name] = {
      id: item.id,
      name: item.name,
      price: item.price,
      counted: item.counted,
      openingStock: 0,
      addedToday: 0,
      soldToday: 0,
      spoiltToday: 0,
      takingsToday: 0,
      closeSold: 0,
      closeSpoilt: 0,
      closeTakings: 0,
      otherOut: 0, // Today's rows the owner entered by hand, not this close.
      closed: false,
    };
  });

  rows.forEach((row) => {
    const item = byName[row.item];
    if (!item || row.day > day) return;

    if (row.day !== day) {
      if (row.type === 'Purchases') item.openingStock += row.qty;
      else if (row.type === 'Sales' || row.type === 'Spoilt' || row.type === 'Missing') {
        item.openingStock -= row.qty;
      }
      return;
    }

    const fromClose = row.narration === CLOSE_NARRATION;
    if (row.type === 'Purchases') {
      item.addedToday += row.qty;
    } else if (row.type === 'Sales') {
      item.soldToday += row.qty;
      item.takingsToday += row.qty * row.amount;
      if (fromClose) {
        item.closed = true;
        item.closeSold = row.qty;
        item.closeTakings = row.qty * row.amount;
      } else {
        item.otherOut += row.qty;
      }
    } else if (row.type === 'Spoilt') {
      item.spoiltToday += row.qty;
      if (fromClose) item.closeSpoilt = row.qty;
      else item.otherOut += row.qty;
    } else if (row.type === 'Missing') {
      item.otherOut += row.qty;
    }
  });

  return catalog.map((entry) => {
    const item = byName[entry.name];
    // What this close has to account for, before its own figures come off.
    const available = item.openingStock + item.addedToday - item.otherOut;
    return {
      id: item.id,
      name: item.name,
      price: item.price,
      counted: item.counted,
      openingStock: item.openingStock,
      addedToday: item.addedToday,
      soldToday: item.soldToday,
      spoiltToday: item.spoiltToday,
      takingsToday: item.takingsToday,
      closeSold: item.closeSold,
      closeSpoilt: item.closeSpoilt,
      closeTakings: item.closeTakings,
      available: available,
      closingStock: available - item.closeSold - item.closeSpoilt,
      closed: item.closed,
    };
  });
}

function trolleyItems() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return trolleyPosition(trolleyCatalog(ss), readTrolleyLedger(ss), dayKey(new Date()));
}

// The day's close, one line per item:
//   { name, sold, spoilt }  counted items
//   { name, takings }       Potatoes, in KES
//
// Checked in full before anything is written, so one bad figure can't leave a
// day half closed. Sending the same day again updates its rows rather than
// adding to them: that is how a mistake gets corrected, and it also makes a
// close that reached the sheet just as the connection dropped safe to retry.
function trolleyClose(body) {
  const lines = body.lines;
  if (!Array.isArray(lines) || !lines.length) {
    return jsonOutput({ error: 'A close needs at least one item.' });
  }

  return withScriptLock(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = mustGetSheet(ss, TROLLEY_LEDGER_SHEET);
    const when = body.timestamp ? new Date(body.timestamp) : new Date();
    const day = dayKey(when);
    const rows = readTrolleyLedger(ss);
    const position = trolleyPosition(trolleyCatalog(ss), rows, day);

    const writes = [];
    for (const line of lines) {
      const item = position.find((p) => p.name === line.name);
      if (!item) return jsonOutput({ error: 'Item not found: ' + line.name });

      const sold = Number(line.sold) || 0;
      const spoilt = Number(line.spoilt) || 0;
      const takings = Number(line.takings) || 0;
      if (sold < 0 || spoilt < 0 || takings < 0) {
        return jsonOutput({ error: line.name + ': figures cannot be negative.' });
      }

      if (!item.counted) {
        writes.push({ item: item.name, type: 'Sales', qty: 1, amount: takings, account: SALES_ACCOUNT });
        continue;
      }

      if (sold + spoilt > item.available) {
        return jsonOutput({
          error:
            item.name + ': only ' + item.available + ' on hand, but ' + (sold + spoilt) +
            ' entered. If stock came in, add it first.',
        });
      }
      // Written even at zero: the Sales row is what marks the item closed.
      writes.push({ item: item.name, type: 'Sales', qty: sold, amount: item.price, account: SALES_ACCOUNT });
      if (spoilt > 0 || item.closeSpoilt > 0) {
        writes.push({ item: item.name, type: 'Spoilt', qty: spoilt, amount: item.price, account: '' });
      }
    }

    writes.forEach((entry) => {
      const existing = rows.find(
        (row) =>
          row.day === day &&
          row.item === entry.item &&
          row.type === entry.type &&
          row.narration === CLOSE_NARRATION
      );
      if (existing) {
        sheet.getRange(existing.at, 7, 1, 2).setValues([[entry.qty, entry.amount]]); // G:H
      } else {
        writeTrolleyRow(sheet, {
          date: when,
          type: entry.type,
          item: entry.item,
          qty: entry.qty,
          amount: entry.amount,
          account: entry.account,
          narration: CLOSE_NARRATION,
        });
      }
    });
    SpreadsheetApp.flush();

    return jsonOutput({ ok: true, items: trolleyItems() });
  });
}

// Stock coming in. `cost` is what the whole delivery cost, optional, and is
// stored per unit because that's how column H is read.
function trolleyRestock(body) {
  const name = body.name;
  const qty = Number(body.qty);
  const cost = Number(body.cost) || 0;

  if (!name || !qty || qty <= 0) {
    return jsonOutput({ error: 'name and a positive qty are required' });
  }

  return withScriptLock(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    writeTrolleyRow(mustGetSheet(ss, TROLLEY_LEDGER_SHEET), {
      date: body.timestamp ? new Date(body.timestamp) : new Date(),
      type: 'Purchases',
      item: name,
      qty: qty,
      amount: cost ? cost / qty : '',
    });
    SpreadsheetApp.flush();
    return jsonOutput({ ok: true, items: trolleyItems() });
  });
}

// A cash cost with no stock behind it (onions, charcoal, the council fee):
// one Purchases row of Qty 1 x the amount paid.
function trolleyExpense(body) {
  const name = body.name;
  const amount = Number(body.qty);

  if (!name || !amount || amount <= 0) {
    return jsonOutput({ error: 'name and a positive amount are required' });
  }

  return withScriptLock(() => {
    writeTrolleyRow(mustGetSheet(SpreadsheetApp.getActiveSpreadsheet(), TROLLEY_LEDGER_SHEET), {
      date: body.timestamp ? new Date(body.timestamp) : new Date(),
      type: 'Purchases',
      item: name,
      qty: 1,
      amount: amount,
    });
    SpreadsheetApp.flush();
    return jsonOutput({ ok: true });
  });
}

// Fills the next free row, leaving the formula columns alone. Free is judged
// on C, not E: a Float Top Up row has a type but no item, and would otherwise
// be overwritten.
function writeTrolleyRow(sheet, entry) {
  const at = firstBlankRow(sheet, 3);
  if (!at) {
    throw new Error(TROLLEY_LEDGER_SHEET + ' is full — no blank row left to record this in');
  }

  const tz = Session.getScriptTimeZone();
  const day = Utilities.parseDate(dayKey(entry.date), tz, 'yyyy-MM-dd');
  sheet.getRange(at, 2, 1, 2).setValues([[day, entry.type]]); // B:C
  sheet.getRange(at, 5).setValue(entry.item); // E
  sheet.getRange(at, 7, 1, 2).setValues([[entry.qty, entry.amount]]); // G:H
  sheet.getRange(at, 10, 1, 2).setValues([[entry.account || '', entry.narration || '']]); // J:K
}

// Two phones closing at once would otherwise both pick the same free row.
function withScriptLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// What was recorded as spoilt, per past day. Today is excluded — it isn't over.
function trolleyWaste(days) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const now = new Date();
  const today = dayKey(now);
  const cutoff = dayKey(new Date(now.getTime() - days * 24 * 60 * 60 * 1000));

  const byDay = {};
  readTrolleyLedger(ss).forEach((row) => {
    if (row.type !== 'Spoilt' || !row.qty || row.day >= today || row.day < cutoff) return;
    if (!byDay[row.day]) byDay[row.day] = { date: row.day, items: [], total: 0 };
    byDay[row.day].items.push({ name: row.item, qty: row.qty });
    byDay[row.day].total += row.qty;
  });

  return Object.keys(byDay)
    .sort()
    .reverse()
    .map((day) => byDay[day]);
}

/* --------------------------- Push notification store ---------------------- */

// One row per device that has asked for the morning summary:
//
//   Endpoint | p256dh | auth | Label | Subscribed
//
// The endpoint is the identity — the push service mints a fresh one whenever
// the browser re-subscribes, so an old row for a device that has moved on is
// dead weight rather than a duplicate. The cron prunes those itself: a push
// service answers 404 or 410 for an endpoint it has retired, and the notifier
// unsubscribes on that.
function pushSheet(ss) {
  const existing = ss.getSheetByName(PUSH_SHEET);
  if (existing) return existing;

  const sheet = ss.insertSheet(PUSH_SHEET);
  sheet.appendRow(['Endpoint', 'p256dh', 'auth', 'Label', 'Subscribed']);
  sheet.setFrozenRows(1);
  return sheet;
}

function pushSubscriptions() {
  const sheet = pushSheet(SpreadsheetApp.getActiveSpreadsheet());
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet
    .getRange(2, 1, lastRow - 1, 4)
    .getValues()
    .filter(function (row) {
      return row[0] && row[1] && row[2];
    })
    .map(function (row) {
      return {
        endpoint: String(row[0]),
        keys: { p256dh: String(row[1]), auth: String(row[2]) },
        label: String(row[3] || ''),
      };
    });
}

// Upsert by endpoint. A browser that re-subscribes with the same endpoint
// after a permission reset should refresh its keys, not add a second row.
function pushSubscribe(body) {
  const sub = body.subscription || {};
  const keys = sub.keys || {};
  if (!sub.endpoint || !keys.p256dh || !keys.auth) {
    throw new Error('A push subscription needs an endpoint and both keys.');
  }

  const sheet = pushSheet(SpreadsheetApp.getActiveSpreadsheet());
  const row = ['' + sub.endpoint, '' + keys.p256dh, '' + keys.auth, body.label || '', new Date()];
  const at = pushRowFor(sheet, sub.endpoint);

  if (at) sheet.getRange(at, 1, 1, 5).setValues([row]);
  else sheet.appendRow(row);

  SpreadsheetApp.flush();
  return { ok: true, devices: Math.max(sheet.getLastRow() - 1, 0) };
}

function pushUnsubscribe(endpoint) {
  if (!endpoint) throw new Error('An endpoint is required to unsubscribe.');

  const sheet = pushSheet(SpreadsheetApp.getActiveSpreadsheet());
  const at = pushRowFor(sheet, endpoint);
  if (at) {
    sheet.deleteRow(at);
    SpreadsheetApp.flush();
  }
  return { ok: true, removed: Boolean(at) };
}

// 1-based sheet row for an endpoint, or 0 if it isn't filed yet.
function pushRowFor(sheet, endpoint) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const endpoints = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < endpoints.length; i++) {
    if (String(endpoints[i][0]) === String(endpoint)) return i + 2;
  }
  return 0;
}

// Set PUSH_SECRET under Project Settings -> Script Properties. Without it the
// device list stays sealed rather than falling open, so a half-finished setup
// fails loudly instead of quietly publishing.
function requirePushSecret(given) {
  const expected = PropertiesService.getScriptProperties().getProperty('PUSH_SECRET');
  if (!expected) throw new Error('PUSH_SECRET is not set in the script properties.');
  if (String(given || '') !== expected) throw new Error('Not authorised.');
}

/* --------------------------------- Helpers ------------------------------- */

// First row below the header whose `col` cell is genuinely blank, or 0 if
// there is none. getLastRow() can't be trusted to find it on these tabs: an
// array formula that writes "" down a whole column counts as content, so it
// reports the bottom of the formula's range instead of the last real entry.
function firstBlankRow(sheet, col) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 2;
  const values = sheet.getRange(2, col, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (!values[i][0]) return i + 2;
  }
  return 0;
}

function mustGetSheet(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error('Missing sheet "' + name + '" — has the tab been renamed?');
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
