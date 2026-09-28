// Adds portion info ("servingSize") to every menu item and size-wise prices
// ("variants") to items that come in sizes -- pizzas, curries, biryani, drinks...
// The first size always costs the item's current price, so nothing on the menu
// gets cheaper or dearer by default; bigger sizes are priced from it.
//
//   node scripts/fillMenuSizes.js          -> apply
//   node scripts/fillMenuSizes.js --dry    -> print the sizes and prices only
require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");

// [id, label, price multiplier of the current price]
const SIZES = {
  pizza: [
    ["regular", 'Regular 7" · serves 1', 1],
    ["medium", 'Medium 10" · serves 2', 1.65],
    ["large", 'Large 12" · serves 3-4', 2.2],
  ],
  curry: [
    ["half", "Half · serves 1 (approx 300 g)", 1],
    ["full", "Full · serves 2-3 (approx 550 g)", 1.75],
  ],
  biryani: [
    ["regular", "Regular · serves 1 (approx 500 g)", 1],
    ["family", "Family pack · serves 3 (approx 1.3 kg)", 2.6],
  ],
  wok: [
    ["half", "Half · approx 250 g", 1],
    ["full", "Full · approx 450 g", 1.6],
  ],
  dryStarter: [
    ["half", "Half · 6 pcs", 1],
    ["full", "Full · 10 pcs", 1.6],
  ],
  tikka: [
    ["six", "6 pcs · approx 250 g", 1],
    ["ten", "10 pcs · approx 400 g", 1.6],
  ],
  drink: [
    ["regular", "Regular · 300 ml", 1],
    ["large", "Large · 450 ml", 1.35],
  ],
  fries: [
    ["regular", "Regular · approx 150 g", 1],
    ["large", "Large · approx 250 g", 1.5],
  ],
  soup: [
    ["cup", "Cup · 250 ml", 1],
    ["bowl", "Bowl · 400 ml", 1.5],
  ],
};

// servingSize = what one order of the default size is; sizes = key of SIZES.
const MENU = {
  "Coconut Mojitos": { servingSize: "300 ml glass", sizes: "drink" },
  "Blueberry Mojito": { servingSize: "300 ml glass", sizes: "drink" },
  "Lemon Soda": { servingSize: "300 ml glass", sizes: "drink" },
  "Badam Shake": { servingSize: "300 ml glass", sizes: "drink" },
  "Strawberry Milk Shake": { servingSize: "300 ml glass", sizes: "drink" },
  "Cold Coffee": { servingSize: "300 ml glass", sizes: "drink" },
  "Mango Lassi": { servingSize: "300 ml glass", sizes: "drink" },
  "Fresh Lime Water": { servingSize: "300 ml glass", sizes: "drink" },
  "Masala Chai": { servingSize: "150 ml cup" },
  "Filter Coffee": { servingSize: "150 ml davara-tumbler" },

  "Farm Fresh Pizza": { servingSize: '7" regular · 4 slices', sizes: "pizza" },
  "Special Pizza": { servingSize: '7" regular · 4 slices', sizes: "pizza" },
  "lazwaab Pizza": { servingSize: '7" regular · 4 slices', sizes: "pizza" },

  "Paneer Sandwich": { servingSize: "4 slices · approx 220 g" },
  "Chicken Sandwich": { servingSize: "2 triangles · approx 200 g" },
  "Veg Grilled Sandwich": { servingSize: "4 slices · approx 230 g" },
  "Allo Tikki Burger": { servingSize: "1 burger · approx 200 g" },

  "Veg Manchurian": { servingSize: "6 pcs in gravy", sizes: "dryStarter" },
  "Chilli Paneer Dry": { servingSize: "6 pcs · approx 200 g", sizes: "dryStarter" },
  "Chicken Tikka": { servingSize: "6 pcs · approx 250 g", sizes: "tikka" },
  "Tandoori Chicken (Half)": { servingSize: "Half chicken · 4 pcs · approx 400 g" },
  "Cheese Garlic Bread": { servingSize: "4 pcs" },
  "Peri Peri Fries": { servingSize: "approx 150 g", sizes: "fries" },

  "Paneer Butter Masala": { servingSize: "Half · approx 300 g", sizes: "curry" },
  "Dal Makhani": { servingSize: "Half · approx 300 g", sizes: "curry" },
  "Butter Chicken": { servingSize: "Half · approx 300 g", sizes: "curry" },
  "Kadhai Mushroom": { servingSize: "Half · approx 300 g", sizes: "curry" },
  "Mutton Rogan Josh": { servingSize: "Half · approx 300 g", sizes: "curry" },
  "Chole Bhature": { servingSize: "Chole bowl + 2 bhature" },

  "Veg Biryani": { servingSize: "approx 500 g · with raita", sizes: "biryani" },
  "Hyderabadi Chicken Biryani": { servingSize: "approx 500 g · with raita & salan", sizes: "biryani" },

  "Hakka Noodles": { servingSize: "Half · approx 250 g", sizes: "wok" },
  "Schezwan Fried Rice": { servingSize: "Half · approx 250 g", sizes: "wok" },

  "Butter Naan": { servingSize: "1 pc" },
  "Tandoori Roti": { servingSize: "1 pc" },

  "Gulab Jamun (2 pcs)": { servingSize: "2 pcs" },
  "Chocolate Brownie Sizzler": { servingSize: "1 brownie + 1 scoop" },
  "Vanilla Ice Cream": { servingSize: "2 scoops · approx 120 g" },
  "Rasmalai (2 pcs)": { servingSize: "2 pcs" },

  "Tomato Shorba": { servingSize: "250 ml cup", sizes: "soup" },
  "Sweet Corn Soup": { servingSize: "250 ml cup", sizes: "soup" },
  "Chicken Hot & Sour Soup": { servingSize: "250 ml cup", sizes: "soup" },

  "Garden Green Salad": { servingSize: "approx 200 g" },
  "Paneer Tikka Salad": { servingSize: "approx 250 g" },

  "Veg Momos (8 pcs)": { servingSize: "8 pcs · with chutney" },
  "Chicken Momos (8 pcs)": { servingSize: "8 pcs · with chutney" },

  "Paneer Kathi Roll": { servingSize: "1 roll · approx 220 g" },
  "Chicken Kathi Roll": { servingSize: "1 roll · approx 230 g" },

  "Masala Dosa": { servingSize: "1 dosa · with sambhar & chutney" },
  "Idli Sambhar (4 pcs)": { servingSize: "4 idlis · with sambhar & chutney" },
};

// 610.75 -> 609: menu-style prices ending in 9.
const menuPrice = (value) => Math.max(Math.round(value / 10) * 10 - 1, 1);

(async () => {
  const dry = process.argv.includes("--dry");
  await mongoose.connect(process.env.MONGO_URI);
  const products = mongoose.connection.db.collection("products");
  const rows = await products.find({}).project({ name: 1, mrp: 1, sellingPrice: 1, variants: 1 }).toArray();

  let updated = 0;
  for (const row of rows) {
    const plan = MENU[row.name];
    if (!plan) {
      console.log("no plan for:", row.name);
      continue;
    }
    const base = Number(row.mrp || row.sellingPrice || 0);
    // Sizes someone already set up by hand are kept as they are.
    const keepExisting = (row.variants || []).length > 0;
    const variants = plan.sizes && base > 0 && !keepExisting
      ? SIZES[plan.sizes].map(([id, label, factor]) => ({ id, label, price: factor === 1 ? base : menuPrice(base * factor) }))
      : [];

    const update = { servingSize: plan.servingSize, ...(variants.length ? { variants } : {}) };
    console.log(`${row.name} (₹${base}) -> ${plan.servingSize}${variants.length ? " | " + variants.map((v) => `${v.label} ₹${v.price}`).join(" / ") : ""}${keepExisting ? " | kept existing sizes" : ""}`);
    if (!dry) await products.updateOne({ _id: row._id }, { $set: update });
    updated += 1;
  }

  console.log(`${dry ? "Would update" : "Updated"} ${updated} of ${rows.length} items.`);
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
