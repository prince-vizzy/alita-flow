// Real product photos from the "items" doc, filed by product id.
const photoModules = import.meta.glob('../assets/products/*.{jpg,jpeg,png}', {
  eager: true,
  import: 'default',
});
const PHOTOS_BY_ID = {};
for (const path in photoModules) {
  const id = path.match(/\/(\d+)\.\w+$/)[1];
  PHOTOS_BY_ID[id] = photoModules[path];
}

function placeholderImage(name) {
  return `https://via.placeholder.com/300x300/ffffff/000000?text=${encodeURIComponent(name)}`;
}

// Item name, unit price, remaining stock — from the "Inventory Report" sheet.
const RAW_PRODUCTS = [
  ['Tissue Holder (Phone)', 100, 9],
  ['Tissue Holder (Euro/Finish)', 100, 8],
  ['Toothbrush Holder Square (S)', 100, 3],
  ['Toothbrush Holder Square (O)', 100, 2],
  ['Toothbrush Holder Normal', 100, 3],
  ['Thread Tube Big', 100, 18],
  ['Thread Tube Small', 100, 20],
  ['Brass Hinge', 100, 10],
  ['Cistern Ball Valve', 100, 7],
  ['Garden Tap', 100, 7],
  ['Bottle Trap Viega (1½")', 100, 9],
  ['Bottle Trap Viega (1¼")', 100, 9],
  ['Plastic Tap', 100, 5],
  ['Pillar Knob', 100, 6],
  ['Pillar Star', 100, 9],
  ['Basin Tap Knob', 100, 9],
  ['Basin Tap Star', 100, 10],
  ['Kitchen Spout Big', 100, 4],
  ['Kitchen Spout Little', 100, 7],
  ['Kitchen Spout No. 7', 100, 3],
  ['Kitchen Spout No. 1', 100, 4],
  ['Flexible Basin (½")', 100, 30],
  ['Flexible Tap', 100, 7],
  ['Flexible Long', 100, 16],
  ['Angle Valve Double', 100, 0],
  ['Angle Valve Single', 100, 13],
  ['Arabic Shower Plastic', 100, 4],
  ['Arabic Shower Metallic', 100, 2],
  ['Arabic Shower Crook', 100, 6],
  ['Stop Cock Killer', 100, 10],
  ['Stop Cock Pieter', 100, 3],
  ['Toilet Seat Cover Hydraulic', 100, 5],
  ['Toilet Seat Cover Non-Hydraulic', 100, 4],
  ['Magic Connector (1½")', 100, 13],
  ['Magic Connector (1¼")', 100, 24],
  ['Magic Connector (1")', 100, 14],
  ['Silicon Bathroom', 100, 8],
  ['Silicon Haluken', 100, 20],
  ['Moment Locks', 100, 5],
  ['Flygbone', 100, 5],
  ['Glory', 100, 5],
  ['Brass Locks', 100, 5],
  ['Inner Knobs', 100, 2],
  ['Lorenzetti', 100, 1],
  ['Horizon', 100, 1],
  ['Sink Strainers', 100, 3],
  ['Soap Dishes', 600, 10],
  ['Bib Tap', 100, 9],
];

export const PRODUCTS = RAW_PRODUCTS.map(([name, price, stock], index) => {
  const id = index + 1;
  return {
    id,
    name,
    price,
    stock,
    image: PHOTOS_BY_ID[id] ?? placeholderImage(name),
  };
});
