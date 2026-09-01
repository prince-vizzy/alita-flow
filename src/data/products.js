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

// Item name, unit price, remaining stock, id of an existing photo to reuse
// (null = no photo yet, falls back to a text placeholder), item code — price
// and code cross-checked 1:1 by name against "Alitaflow Stock.pdf" (the
// shop's own code/price list). Renamed/new items intentionally get no photo
// rather than risk matching the wrong picture to the wrong product.
const RAW_PRODUCTS = [
  ["Tissue Holder (Phone)", 800, 8, 1, "AFS-0001"],
  ["Tissue Holder (Europnize)", 350, 8, 49, "AFS-0002"],
  ["Toothbrush Holder Square (S)", 950, 3, 3, "AFS-0003"],
  ["Toothbrush Holder Square (D)", 1500, 1, 50, "AFS-0004"],
  ["Toothbrush Holder Normal", 700, 3, 5, "AFS-0005"],
  ["Thread Tape Big", 100, 18, 51, "AFS-0006"],
  ["Thread Tape Small", 30, 19, 52, "AFS-0007"],
  ["Brass Hinge", 0, 0, 8, "AFS-0008"],
  ["Garden Tap", 500, 10, 10, "AFS-0009"],
  ["Bottle Trap Viega (1½\")", 450, 19, 11, "AFS-0010"],
  ["Bottle Trap Viega (1¼\")", 450, -1, 12, "AFS-0011"],
  ["Plastic Tap", 200, 5, 13, "AFS-0012"],
  ["Pillar Knob", 550, 14, 14, "AFS-0013"],
  ["Pillar Star", 550, 10, 15, "AFS-0014"],
  ["Basin Tap Knob", 0, 0, 16, "AFS-0015"],
  ["Basin Tap Star", 0, 0, 17, "AFS-0016"],
  ["Kitchen Spout No. 7, Big", 1500, 3, 53, "AFS-0017"],
  ["Kitchen Spout Lirlee", 950, 7, 54, "AFS-0018"],
  ["Kitchen Spout No. 7, Small", 1200, 3, 55, "AFS-0019"],
  ["Kitchen Spout Boii", 1400, 3, 56, "AFS-0020"],
  ["Flexible Basin (½\")", 0, 0, 22, "AFS-0021"],
  ["Flexible Tap", 0, 0, 23, "AFS-0022"],
  ["Flexible Long", 0, 0, 24, "AFS-0023"],
  ["Angle Valve Double", 450, 10, 25, "AFS-0024"],
  ["Angle Valve Single", 300, 17, 26, "AFS-0025"],
  ["Arabic Shower Plastic", 650, 7, 27, "AFS-0026"],
  ["Arabic Shower Metallic", 700, 5, 28, "AFS-0027"],
  ["Stop Cock Lirlee", 1000, 13, 57, "AFS-0028"],
  ["Stop Cock Pretex", 900, 4, 58, "AFS-0029"],
  ["Toilet Seat Cover Hydraulic", 800, 9, 32, "AFS-0030"],
  ["Toilet Seat Cover Non-Hydraulic", 500, 0, 33, "AFS-0031"],
  ["Magic Connector (1½\")", 300, 19, 34, "AFS-0032"],
  ["Magic Connector (1¼\")", 250, 30, 35, "AFS-0033"],
  ["Moment Locks", 1200, 5, 39, "AFS-0034"],
  ["Glory Locks", 1200, 5, 59, "AFS-0035"],
  ["Brass Locks", 1150, 5, 42, "AFS-0036"],
  ["Inner Knobs", 0, 0, 43, "AFS-0037"],
  ["Sink Strainers", 450, 2, 46, "AFS-0038"],
  ["Soap Dishes", 350, 10, 47, "AFS-0039"],
  ["Bib Tap", 450, 9, 48, "AFS-0040"],
  ["Magic Connector (4\")", 500, 19, 60, "AFS-0041"],
  ["Arabic Shower Grohe/No.7", 1000, 5, 61, "AFS-0042"],
  ["Switch*", 0, -1, 62, "AFS-0043"],
  ["Enerbras Shower", 2500, 1, 63, "AFS-0044"],
  ["Bosh Lock", 250, 20, 64, "AFS-0045"],
  ["Flex Tube Lirlee (1½\")", 150, 11, 65, "AFS-0046"],
  ["Silicone Hightech", 500, 7, 66, "AFS-0047"],
  ["Wall Tap Star", 550, 8, 67, "AFS-0048"],
  ["Wall Tap Knob", 550, 9, 68, "AFS-0049"],
  ["Concrete Nail", 0, -14, 69, "AFS-0050"],
  ["Lorezentti Shower", 1700, 1, 70, "AFS-0051"],
  ["Horizon Shower", 1700, 3, 71, "AFS-0052"],
  ["Flex Tube Brazil", 100, -6, 72, "AFS-0053"],
  ["Flex Tube Brazil (1½\")", 100, 58, 73, "AFS-0054"],
  ["Flex Tube Italy (1½\")", 100, 6, 74, "AFS-0055"],
  ["Female Elbow (20x½\")", 50, 20, 75, "AFS-0056"],
  ["Female Elbow (25×½\")", 50, 20, 76, "AFS-0057"],
  ["Female Socket (20½\")", 40, 20, 77, "AFS-0058"],
  ["Female Socket (25½\")", 40, 20, 78, "AFS-0059"],
  ["Female Socket (32×1\")", 50, 40, 79, "AFS-0060"],
  ["Female Socket (32¾\")", 70, 0, 80, "AFS-0061"],
  ["Male Socket (20×½\")", 50, 20, 81, "AFS-0062"],
  ["Male Socket (25×½\")", 40, 20, 82, "AFS-0063"],
  ["Male Socket (32×1\")", 70, 20, 83, "AFS-0064"],
  ["Plain Socket 20mm", 20, 20, 84, "AFS-0065"],
  ["Plain Socket 25mm", 20, 20, 85, "AFS-0066"],
  ["Plain Socket 32mm", 30, 20, 86, "AFS-0067"],
  ["PPR Pipe 10x25mm", 300, 10, 87, "AFS-0068"],
  ["PPR Pipe 20x20mm", 230, 20, 88, "AFS-0069"],
  ["3-Way Extension", 0, -1, 89, "AFS-0070"],
  ["Max Bulb NW", 0, -3, 90, "AFS-0071"],
  ["Silicon Kitchen", 300, 22, 91, "AFS-0072"],
  ["Boss White-200 Grams", 150, 9, 92, "AFS-0073"],
  ["Tissue Holder Plastic", 400, 8, 93, "AFS-0074"],
  ["Gistern Ball Valve", 450, 8, 94, "AFS-0075"],
  ["Towel Rings", 700, 5, 95, "AFS-0080"],
  ["Flyglobe Locks", 1150, 5, 96, "AFS-0081"],
  ["Union PPR 20cm", 150, 13, 97, "AFS-0082"],
  ["Union PPR 25cm", 100, 19, 98, "AFS-0083"],
  ["PVC Bend (20x1½\")", 180, 20, 99, "AFS-0084"],
  ["PVC Bend (30x2½\")", 150, 30, 100, "AFS-0085"],
  ["PVC Bend (70x3½\")", 100, 70, 101, "AFS-0086"],
  ["Female Tee PPR (20x½\")", 60, 26, 102, "AFS-0087"],
  ["Female Tee PPR (25x½\")", 80, 31, 103, "AFS-0088"],
  ["Female Tee PPR (25x¾\")", 60, 37, null, "AFS-0089"],
  ["Sprout Shower Tap", 0, 3, 104, "AFS-0090"],
  ["Sprout Tap Big Stainless Pillar", 0, 4, 105, "AFS-0091"],
  ["Stop Cock Concelled Pegler", 0, 10, 106, "AFS-0092"],
  ["Steel Nails (2½\")", 0, 1, 107, "AFS-0093"],
  ["Corner Shelf Double", 0, 1, 108, "AFS-0094"],
  ["Sprout Pillar Brimix", 0, 4, 109, "AFS-0095"],
  ["Fastener China", 0, 20, 110, "AFS-0096"],
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
