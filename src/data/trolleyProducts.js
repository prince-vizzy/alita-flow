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

// Costs logged straight to the ledger as Purchases, never tracked as stock.
// The ledger's Item column only accepts names on 'Trolley - Inventory', so
// these have to match that tab exactly.
export const TROLLEY_EXPENSE_ITEMS = [
  'Onions',
  'Tomatoes',
  'Vegetables',
  'Salt',
  'Chillie Pepper',
  'Choma Sauce',
  'Chillie Sauce',
  'Charcoal',
  'Gas Refill',
  'Water',
  'Electricity',
  'Serviettes',
  'Sugar Bags',
  'White Bags',
  'Bar Soap',
  'Knive Sharpening',
  'City Council',
  'Electric Kettle',
];

// Item name, fallback emoji, counted — names as 'Trolley - Inventory' spells
// them, in photo order. Counted items carry a stock figure. The others are
// booked in the ledger as the day's takings at Qty 1, so they have no count to
// open or close on. Prices and stock all come from the sheet on the first sync.
const RAW_TROLLEY = [
  ["Eggs", "🥚", true],
  ["Sweet-Potatoes", "🍠", false],
  ["Arrow-Roots", "🥔", false],
  ["Smokie", "🌭", true],
];

export const TROLLEY_PRODUCTS = RAW_TROLLEY.map(([name, emoji, counted], index) => {
  const id = index + 1;
  return {
    id,
    name,
    price: 0,
    emoji,
    image: PHOTOS_BY_ID[id] ?? null,
    counted,
    openingStock: 0,
    addedToday: 0,
    soldToday: 0,
    spoiltToday: 0,
    takingsToday: 0,
    closeSold: 0,
    closeSpoilt: 0,
    closeTakings: 0,
    available: 0,
    closingStock: 0,
    closed: false,
  };
});
