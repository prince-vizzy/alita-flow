// Trolley items, from trolley.docx. Optional photos: drop them in
// src/assets/trolley/ named by id (1.jpg, 2.jpg, …) and they get picked up.
// Without a photo an item falls back to its emoji tile, which — unlike a
// remote placeholder URL — still renders with no connection.
const photoModules = import.meta.glob('../assets/trolley/*.{jpg,jpeg,png}', {
  eager: true,
  import: 'default',
});
const PHOTOS_BY_ID = {};
for (const path in photoModules) {
  const id = path.match(/\/(\d+)\.\w+$/)[1];
  PHOTOS_BY_ID[id] = photoModules[path];
}

// Trolley goods are sold loose, by tray, by weight or by the packet — only
// the units that make sense for food, but spelled as the sheet's UoM list
// spells them (see data/units.js), since Tsn Ledgers merges Trolley Log's
// Unit column into the same UoM column as the shop's.
export const TROLLEY_UNITS = ['Pcs', 'Tray', 'Kg', 'Pkt'];

// Ingredients bought regularly for the trolley but never tracked as stock
// items themselves — no Inventory row, no cook/sell flow, just a recurring
// cash cost logged straight to the dashboard as a Trolley expense.
export const TROLLEY_EXPENSE_ITEMS = ['Onions', 'Tomatoes', 'Tomato Sauce', 'Barbecue Sauce', 'Salt'];

// Sold as a portion for whatever the customer pays, not qty x a fixed
// per-unit price — the Sell screen shows a price picker for these instead
// of the usual quantity picker.
export const TROLLEY_PRICE_PICKER_ITEMS = ['Arrow Roots', 'Sweet Potatoes'];
export const TROLLEY_PRICE_OPTIONS = [20, 30, 40, 50, 60, 70, 80, 90, 100];

// Item name, unit price, fallback emoji, opening regular stock — from the
// "Inventory" tab (Business = Trolley). Prices are blank there for now; the
// "Trolley Inventory" sheet is the source of truth and overwrites these on
// the first sync.
const RAW_TROLLEY = [
  ["Eggs", 0, "🥚", 30],
  ["Sweet Potatoes", 0, "🍠", 0],
  ["Arrow Roots", 0, "🥔", 0],
  ["Smokie", 0, "🌭", 10],
  ["Smocha", 0, "🌯", 0],
];

export const TROLLEY_PRODUCTS = RAW_TROLLEY.map(([name, price, emoji, regularStock], index) => {
  const id = index + 1;
  return {
    id,
    name,
    price,
    emoji,
    image: PHOTOS_BY_ID[id] ?? null,
    regularStock,
    cookedStock: 0,
  };
});
