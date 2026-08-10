// Deploy this bound to the "Alitaflow Daily Sales" spreadsheet.
// See apps-script/README.md for setup steps.

const INVENTORY_SHEET = 'Inventory';
const FORM_RESPONSES_SHEET = 'Form Responses';
const MANUAL_SHEET = 'Manual Sales & Expenses';

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(INVENTORY_SHEET);
  const lastRow = sheet.getLastRow();
  const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues(); // A:G

  const items = data
    .filter((row) => row[1]) // Item Name present
    .map((row) => ({
      id: row[0],
      name: row[1],
      price: row[2],
      stock: row[6], // final "Remaining" column
    }));

  return ContentService.createTextOutput(JSON.stringify({ items }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const action = body.action || 'sell';

  if (action === 'addStock') return addStock(body);
  return sell(body);
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

  const currentStock = inventorySheet.getRange(2 + rowIndex, 7).getValue(); // G
  if (qty > currentStock) {
    return jsonOutput({ error: 'Not enough stock', stock: currentStock });
  }

  const when = body.timestamp ? new Date(body.timestamp) : new Date();
  const formSheet = ss.getSheetByName(FORM_RESPONSES_SHEET);
  formSheet.appendRow([when, name, qty, unit]);
  SpreadsheetApp.flush();

  const updatedStock = inventorySheet.getRange(2 + rowIndex, 7).getValue();
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

  // Purchase Unit Price must be non-blank or this row gets misread as a sale.
  const purchasePrice = inventorySheet.getRange(2 + rowIndex, 3).getValue(); // C

  const when = body.timestamp ? new Date(body.timestamp) : new Date();
  const manualSheet = ss.getSheetByName(MANUAL_SHEET);
  manualSheet.appendRow([when, name, qty, unit, purchasePrice, '']);
  SpreadsheetApp.flush();

  const updatedStock = inventorySheet.getRange(2 + rowIndex, 7).getValue();
  return jsonOutput({ ok: true, stock: updatedStock });
}

function findInventoryRow(inventorySheet, name) {
  const lastRow = inventorySheet.getLastRow();
  const names = inventorySheet.getRange(2, 2, lastRow - 1, 1).getValues(); // B
  return names.findIndex((row) => row[0] === name);
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
