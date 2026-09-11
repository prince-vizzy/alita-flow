// Units of measure, word for word as the sheet's UoM dropdown has them
// (Manual-Ledger column I, and the same list on Shop Ledger Entry). That
// dropdown is strict: anything else rejects the whole row and the sale isn't
// recorded. So the app offers the sheet's own words rather than friendlier
// ones of its own — what's picked here is exactly what lands in the ledger.
//
// If the sheet's list changes, change this with it. apps-script/Code.gs
// (ledgerUnit) still translates older spellings like "Pieces", so a sale
// queued offline by an older copy of the app goes through.
export const UNITS = ['Pcs', 'Pkt', 'Litre', 'Ml', 'Kg', 'M', 'Can', 'Tray'];

export const DEFAULT_UNIT = 'Pcs';
