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

// Item name, unit selling price, remaining stock, id of an existing photo to
// reuse (null = no photo yet, falls back to a text placeholder), item code.
//
// Taken from the LIVE Inventory tab of the "Alitaflow Daily Sales" sheet —
// the Hardware rows, in the sheet's order — not from
// Alitaflow_Inventory_Tracker.xlsx, which this list used to follow. The code
// is the sheet's Code column (HDW-/PLB-/ELC-/NEW-), not its AFS "No.": that
// one is a SEQUENCE over row positions and renumbers whenever a row is added
// or removed, so it names a place in the sheet, not an item. Items the sheet
// hasn't coded yet carry null and show no code.
//
// Rows with no Business set are left out, exactly as the Apps Script leaves
// them out of live stock, and a name the sheet lists twice appears once —
// sales are matched by name, so both rows are the same item to the app.
//
// That matters because the sheet is not a copy of this list, it is the thing
// the app actually works against: stock is read from it and every sale is
// written back by matching the item NAME. When the two drifted apart, items
// here that the sheet spelled differently ("Kitchen Spout No.7 (Big)" against
// its "Kitchen Spout No. 7, Big") showed stale stock and could not be sold at
// all, because the write had no row to find. So the sheet names items and
// this file follows, never the other way round.
//
// Photos are the one thing the sheet has no opinion about, so they are
// carried over from the previous list by matching each item to the row it
// replaces; anything uncertain keeps no photo rather than risk showing the
// wrong picture.
const RAW_PRODUCTS = [
  ["Tissue Holder (Phone)", 800, 6, 1, "HDW-018"],
  ["Tissue Holder (Europnize)", 350, 7, 49, "HDW-019"],
  ["Toothbrush Holder Square (S)", 950, 3, 3, "HDW-021"],
  ["Toothbrush Holder Square (D)", 1400, 0, 50, "HDW-022"],
  ["Toothbrush Holder Normal", 700, 3, 5, "HDW-023"],
  ["Thread Tape Big", 100, 16, null, "HDW-024"],
  ["Thread Tape Small", 30, 17, 52, "HDW-025"],
  ["Brass Hinge", 0, 0, null, null],
  ["Garden Tap", 500, 8, 10, "PLB-037"],
  ["Bottle Trap Viega (1½\")", 450, 19, 11, "PLB-038"],
  ["Bottle Trap Viega (1¼\")", 450, -1, 11, "PLB-039"],
  ["Plastic Tap", 250, 5, 13, "PLB-040"],
  ["Pillar Knob", 550, 14, 14, "PLB-001"],
  ["Pillar Star", 550, 10, 15, "PLB-002"],
  ["Basin Tap Knob", 0, 0, null, null],
  ["Basin Tap Star", 0, 0, null, null],
  ["Kitchen Spout No. 7, Big", 1400, 3, 53, "PLB-005"],
  ["Kitchen Spout Lirlee", 950, 7, 54, "PLB-006"],
  ["Kitchen Spout No. 7, Small", 1200, 3, 55, "PLB-007"],
  ["Kitchen Spout Boii", 1400, 3, 56, "PLB-008"],
  ["Flexible Basin (½\")", 0, 0, null, null],
  ["Flexible Tap", 0, 0, null, null],
  ["Flexible Long", 0, 0, null, null],
  ["Angle Valve Double", 450, 9, 25, "PLB-013"],
  ["Angle Valve Single", 300, 17, 26, "PLB-014"],
  ["Arabic Shower Plastic", 650, -1, 27, "PLB-015"],
  ["Arabic Shower Metallic", 700, 4, 28, "PLB-016"],
  ["Stop Cock Lirlee", 1000, 13, 57, "PLB-032"],
  ["Stop Cock Pretex", 900, 4, 58, "PLB-033"],
  ["Toilet Seat Cover Hydraulic", 800, 9, 32, "PLB-035"],
  ["Toilet Seat Cover Non-Hydraulic", 500, -1, 33, "PLB-034"],
  ["Magic Connector (1½\") - Normal", 300, 19, 34, null],
  ["Magic Connector (1¼\") - Normal", 250, 30, 35, null],
  ["Moment Locks", 1350, 5, 39, "HDW-008"],
  ["Glory Locks", 1300, 5, 59, "HDW-010"],
  ["Brass Locks", 1000, 1, 42, "HDW-011"],
  ["Inner Knobs", 0, 0, null, null],
  ["Sink Strainers", 450, 2, 46, "HDW-015"],
  ["Soap Dishes", 350, 10, 47, "HDW-016"],
  ["Bib Tap ½", 450, 9, 48, "HDW-017"],
  ["Magic Connector (4\")", 450, 19, null, "HDW-005"],
  ["Arabic Shower Grohe/No.7", 1000, 4, 61, "PLB-017"],
  ["Switch*", 0, -1, null, null],
  ["Enerbras Shower", 2500, 1, null, "HDW-012"],
  ["Bosh Lock", 250, 20, null, "HDW-002"],
  ["Flex Tube Lirlee (1½\")", 150, 9, 65, "PLB-009"],
  ["Silicone Hightech", 500, 7, 66, "HDW-006"],
  ["Wall Tap Star", 550, 8, 67, "PLB-004"],
  ["Wall Tap Knob", 550, 9, 68, "PLB-003"],
  ["Concrete Nails (Steel Nails, 2½\")", 5, 130, null, "NEW-001"],
  ["Lorezentti Shower", 1500, 1, null, "HDW-014"],
  ["Horizon Shower", 1700, 3, null, "HDW-013"],
  ["Flex Tube Brazil", 130, -6, 73, "PLB-010"],
  ["Flex Tube Brazil (1½\")", 100, 58, 72, "PLB-012"],
  ["Flex Tube Italy (1½\")", 100, 6, 74, "PLB-011"],
  ["Female Elbow (20x½\")", 50, 20, 75, "PLB-029"],
  ["Female Elbow (25×½\")", 50, 20, 76, "PLB-028"],
  ["Female Socket (20½\")", 40, 20, 77, "PLB-019"],
  ["Female Socket (25½\")", 40, 20, 78, "PLB-018"],
  ["Female Socket (32×1\")", 70, 40, 79, "PLB-021"],
  ["Female Socket (32¾\")", 50, 0, 80, "PLB-020"],
  ["Male Socket (20×½\")", 50, 20, 81, "PLB-023"],
  ["Male Socket (25×½\")", 40, 20, 82, "PLB-022"],
  ["Male Socket (32×1\")", 70, 20, 83, "PLB-024"],
  ["Plain Socket 20mm", 20, 20, 84, "PLB-025"],
  ["Plain Socket 25mm", 20, 20, 85, "PLB-026"],
  ["Plain Socket 32mm", 30, 20, 86, "PLB-027"],
  ["PPR Pipe 10x25mm", 300, 10, 87, "PLB-031"],
  ["PPR Pipe 20x20mm", 230, 20, 88, "PLB-030"],
  ["3-Way Extension, 3M", 800, 1, null, "ELC-016"],
  ["Max Bulb-9W", 100, 95, null, "ELC-003"],
  ["Silicon Knicker", 300, 20, null, "HDW-007"],
  ["Boss White-200 Grams", 150, 9, 92, "HDW-028"],
  ["Tissue Holder Plastic", 400, 7, 93, "HDW-020"],
  ["Gistern Ball Valve", 450, 7, 94, "PLB-036"],
  ["Towel Rings", 700, 5, 95, "HDW-001"],
  ["Flyglobe Locks", 950, 5, 96, "HDW-009"],
  ["Union PPR 20cm", 150, 13, 97, "HDW-026"],
  ["Union PPR 25cm", 100, 19, 98, "HDW-027"],
  ["PVC Bend (20x1½\")", 180, 20, 99, "HDW-029"],
  ["PVC Bend (30x2½\")", 150, 30, null, "HDW-030"],
  ["PVC Bend (70x3½\")", 100, 70, null, "HDW-031"],
  ["Female Tee PPR (20x½\")", 60, 26, 102, "HDW-032"],
  ["Female Tee PPR (25x½\")", 80, 31, 103, "HDW-033"],
  ["Female Tee PPR (25x¾\")", 60, 37, 103, "HDW-034"],
  ["Sprout Shower Tap", 0, 3, null, null],
  ["Sprout Tap Big Stainless Pillar", 0, 4, null, null],
  ["Stop Cock Concelled Pegler", 0, 10, null, null],
  ["Corner Shelf Double", 1400, 1, 108, "NEW-002"],
  ["Sprout Pillar Brimix", 0, 4, 109, null],
  ["Window Fastener China", 150, 20, null, "NEW-004"],
  ["LED 9W AC", 0, 10, null, null],
  ["9W Velmex 2 in 1 Blue", 0, 7, null, null],
  ["Adapter Snake 2Pin", 0, 1, null, null],
  ["Hanging Big", 0, 2, null, null],
  ["Music Bulb", 0, 0, null, null],
  ["Patress Single", 0, 5, null, null],
  ["Straight Holder Big", 0, 8, null, null],
  ["Switch Box Single", 0, 2, null, null],
  ["4-Way Extension, 3M", 1000, 2, null, "ELC-017"],
  ["LED Wall Light-24W", 380, 17, null, "ELC-029"],
  ["Optonica LED Strip", 0, 50, null, null],
  ["1 Gang 2 Way Switches", 150, 7, null, "ELC-010"],
  ["2 Gang 2 Way Switches", 180, 10, null, "ELC-011"],
  ["3 Gang 2 Way Switches", 250, 10, null, "ELC-012"],
  ["4 Gang 2 Way Switches", 300, 10, null, "ELC-013"],
  ["Double Multi-Function Socket With Switch", 350, 5, null, "ELC-033"],
  ["Multi-Function Socket With Switch", 280, 9, null, "ELC-034"],
  ["20A Water Heater Switch", 300, 9, null, "ELC-036"],
  ["45A Air Conditioner Switch", 600, 10, null, "ELC-035"],
  ["45A Cooker & 13A Socket", 700, 5, null, "ELC-037"],
  ["25A Outlet", 300, 10, null, "ELC-039"],
  ["3-Way Adapter, 13A", 250, 8, null, "ELC-038"],
  ["Magic Connector (1½\") - Chrome", 350, 0, null, "HDW-003"],
  ["Magic Connector (1¼\") - Chrome", 250, 0, null, "HDW-004"],
  ["Spout Pillar Brimix", 750, 0, null, "NEW-003"],
  ["Bulb 5W", 30, 0, null, "ELC-001"],
  ["Bulb 7W", 100, 0, null, "ELC-002"],
  ["Bulb 12W", 100, 0, null, "ELC-004"],
  ["Bulb 20W", 100, 0, null, "ELC-005"],
  ["Bulb 30W", 200, 0, null, "ELC-006"],
  ["Bulb Filament 40W", 150, 0, null, "ELC-007"],
  ["Socket - Single", 100, 0, null, "ELC-008"],
  ["Socket - Double", 200, 0, null, "ELC-009"],
];

export const PRODUCTS = RAW_PRODUCTS.map(([name, price, stock, photoId, code], index) => {
  const id = index + 1;
  return {
    id,
    name,
    price,
    stock,
    code,
    image: photoId ? PHOTOS_BY_ID[photoId] : placeholderImage(name),
  };
});
