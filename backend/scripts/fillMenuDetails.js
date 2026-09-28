// Fills customer-facing details (description, "what's inside" ingredients, spice
// level) for the current menu, matched by item name. Safe to re-run.
//
//   node scripts/fillMenuDetails.js          -> apply
//   node scripts/fillMenuDetails.js --dry    -> only show what would change
require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");

const MENU = {
  // Refreshers
  "Coconut Mojitos": {
    description: "A tropical, alcohol-free mojito -- tender coconut water shaken with fresh mint and lime, topped with soda over crushed ice.",
    ingredients: ["Coconut water", "Fresh mint", "Lime", "Soda", "Crushed ice"],
  },
  "Blueberry Mojito": {
    description: "Sweet-tart blueberries muddled with mint and lime, lengthened with chilled soda. Bright, fizzy and refreshing.",
    ingredients: ["Blueberry", "Fresh mint", "Lime", "Soda", "Crushed ice"],
  },
  "Lemon Soda": {
    description: "The classic street-style nimbu soda -- fresh lemon juice and chilled soda with a pinch of black salt and roasted cumin. Sweet, salted or mixed.",
    ingredients: ["Fresh lemon", "Soda", "Black salt", "Roasted cumin", "Sugar syrup"],
  },

  // Milk Shake
  "Badam Shake": {
    description: "Rich, chilled almond milk shake with a hint of saffron and cardamom, finished with chopped almonds.",
    ingredients: ["Almonds", "Full-cream milk", "Saffron", "Cardamom", "Sugar"],
  },
  "Strawberry Milk Shake": {
    description: "Creamy shake blended with strawberries and vanilla ice cream -- thick, pink and fruity.",
    ingredients: ["Strawberry", "Milk", "Vanilla ice cream", "Sugar"],
  },

  // Pizza
  "Farm Fresh Pizza": {
    description: "Hand-stretched base loaded with crunchy garden vegetables on house tomato sauce and plenty of mozzarella.",
    ingredients: ["Pizza base", "Tomato sauce", "Mozzarella", "Capsicum", "Onion", "Tomato", "Sweet corn", "Oregano"],
    spiceLevel: "mild",
  },
  "Special Pizza": {
    description: "Our chef's signature pizza -- paneer tikka, olives, jalapenos and three kinds of peppers on a cheese-loaded base.",
    ingredients: ["Pizza base", "Tomato sauce", "Mozzarella", "Paneer tikka", "Black olives", "Jalapenos", "Bell peppers", "Onion"],
    spiceLevel: "medium",
  },
  "lazwaab Pizza": {
    description: "A sweet-and-savoury house favourite: vegetables and pineapple on a creamy cheese base with a touch of chilli flakes.",
    ingredients: ["Pizza base", "Tomato sauce", "Mozzarella", "Pineapple", "Capsicum", "Onion", "Sweet corn", "Chilli flakes"],
    spiceLevel: "mild",
  },

  // Sandwich
  "Paneer Sandwich": {
    description: "Four slices layered with spiced paneer, mint chutney and fresh vegetables, toasted golden with butter.",
    ingredients: ["Bread", "Paneer", "Mint chutney", "Onion", "Tomato", "Capsicum", "Butter", "Chaat masala"],
    spiceLevel: "medium",
  },
  "Chicken Sandwich": {
    description: "Grilled chicken tossed in creamy mayo with lettuce and onion, toasted in buttered bread.",
    ingredients: ["Bread", "Grilled chicken", "Mayonnaise", "Lettuce", "Onion", "Butter", "Black pepper"],
    spiceLevel: "mild",
    // Was saved as "veg" by mistake -- it has chicken.
    foodType: "non-veg",
  },
  "Veg Grilled Sandwich": {
    description: "Bombay-style grilled sandwich with potato, veggies and green chutney, finished with a generous layer of cheese.",
    ingredients: ["Bread", "Boiled potato", "Cucumber", "Tomato", "Onion", "Green chutney", "Cheese", "Butter"],
    spiceLevel: "medium",
  },

  // Burger
  "Allo Tikki Burger": {
    description: "Crispy spiced potato-and-pea patty in a soft toasted bun with tangy sauce, onion and tomato.",
    ingredients: ["Burger bun", "Aloo tikki", "Green peas", "Tomato", "Onion", "Lettuce", "Burger sauce"],
    spiceLevel: "medium",
  },

  // Starters
  "Veg Manchurian": {
    description: "Crisp vegetable dumplings tossed in a glossy Indo-Chinese sauce of garlic, ginger, soy and spring onion.",
    ingredients: ["Cabbage", "Carrot", "Beans", "Garlic", "Ginger", "Soy sauce", "Spring onion", "Corn flour"],
    spiceLevel: "medium",
  },
  "Chilli Paneer Dry": {
    description: "Crispy paneer cubes wok-tossed with capsicum, onion, green chillies and soy-chilli sauce.",
    ingredients: ["Paneer", "Capsicum", "Onion", "Green chilli", "Garlic", "Soy sauce", "Chilli sauce"],
    spiceLevel: "spicy",
  },
  "Chicken Tikka": {
    description: "Boneless chicken marinated overnight in hung curd and spices, char-grilled in the tandoor. Served with mint chutney and onion.",
    ingredients: ["Boneless chicken", "Hung curd", "Kashmiri chilli", "Ginger-garlic", "Garam masala", "Lemon", "Mint chutney"],
    spiceLevel: "medium",
  },
  "Tandoori Chicken (Half)": {
    description: "Half a chicken on the bone, marinated in yoghurt and tandoori masala, roasted smoky in the clay oven.",
    ingredients: ["Chicken (on the bone)", "Curd", "Tandoori masala", "Kashmiri chilli", "Ginger-garlic", "Lemon", "Butter"],
    spiceLevel: "medium",
  },
  "Cheese Garlic Bread": {
    description: "Toasted bread slathered with garlic butter and herbs, baked under a blanket of melted cheese.",
    ingredients: ["Bread", "Garlic butter", "Mozzarella", "Oregano", "Chilli flakes"],
    spiceLevel: "mild",
  },
  "Peri Peri Fries": {
    description: "Golden, crispy fries dusted with fiery-tangy peri peri seasoning. Great for sharing.",
    ingredients: ["Potato", "Peri peri masala", "Salt"],
    spiceLevel: "spicy",
  },

  // Main Course
  "Paneer Butter Masala": {
    description: "Soft paneer in a velvety tomato-cashew gravy finished with butter and cream. Mildly spiced, rich and comforting.",
    ingredients: ["Paneer", "Tomato", "Cashew", "Butter", "Fresh cream", "Kasuri methi", "Garam masala"],
    spiceLevel: "mild",
  },
  "Dal Makhani": {
    description: "Black lentils and kidney beans slow-cooked overnight, finished with butter and cream for a deep, smoky flavour.",
    ingredients: ["Whole black urad dal", "Rajma", "Tomato", "Butter", "Fresh cream", "Ginger-garlic"],
    spiceLevel: "mild",
  },
  "Butter Chicken": {
    description: "Tandoori chicken simmered in a silky, buttery tomato gravy -- the Delhi classic. Best with butter naan.",
    ingredients: ["Tandoori chicken", "Tomato", "Butter", "Fresh cream", "Cashew", "Kasuri methi", "Honey"],
    spiceLevel: "mild",
  },
  "Kadhai Mushroom": {
    description: "Mushrooms and peppers cooked in a kadhai with freshly pounded coriander and red chilli masala.",
    ingredients: ["Mushroom", "Capsicum", "Onion", "Tomato", "Kadhai masala", "Coriander"],
    spiceLevel: "medium",
  },
  "Chole Bhature": {
    description: "Spicy Punjabi chickpea curry served with two fluffy, deep-fried bhature, pickle and onion.",
    ingredients: ["Chickpeas", "Onion", "Tomato", "Chole masala", "Maida bhature", "Pickle"],
    spiceLevel: "medium",
  },
  "Mutton Rogan Josh": {
    description: "Kashmiri-style tender mutton slow-cooked in a fragrant, deep-red gravy of Kashmiri chilli, fennel and ginger.",
    ingredients: ["Mutton", "Curd", "Kashmiri chilli", "Fennel", "Dry ginger", "Whole spices", "Onion"],
    spiceLevel: "spicy",
  },

  // Biryani
  "Veg Biryani": {
    description: "Fragrant basmati rice layered with spiced vegetables, saffron and fried onions, slow-cooked on dum. Served with raita.",
    ingredients: ["Basmati rice", "Mixed vegetables", "Saffron", "Fried onion", "Mint", "Biryani masala", "Raita"],
    spiceLevel: "medium",
  },
  "Hyderabadi Chicken Biryani": {
    description: "Authentic dum biryani -- marinated chicken and long-grain basmati sealed and slow-cooked with saffron, mint and fried onion. Served with raita and salan.",
    ingredients: ["Chicken", "Basmati rice", "Curd", "Saffron", "Fried onion", "Mint", "Biryani masala", "Raita"],
    spiceLevel: "spicy",
  },

  // Chinese
  "Hakka Noodles": {
    description: "Street-style noodles tossed on a high flame with crunchy vegetables, soy and a hint of vinegar.",
    ingredients: ["Noodles", "Cabbage", "Carrot", "Capsicum", "Spring onion", "Soy sauce", "Garlic"],
    spiceLevel: "mild",
  },
  "Schezwan Fried Rice": {
    description: "Wok-fried rice with vegetables in a fiery house Schezwan sauce of red chilli and garlic.",
    ingredients: ["Rice", "Schezwan sauce", "Carrot", "Beans", "Capsicum", "Spring onion", "Garlic"],
    spiceLevel: "spicy",
  },

  // Breads
  "Butter Naan": {
    description: "Soft, pillowy naan baked in the tandoor and brushed with butter.",
    ingredients: ["Refined flour", "Curd", "Butter"],
  },
  "Tandoori Roti": {
    description: "Whole-wheat flatbread baked on the wall of the tandoor -- light, smoky and a little crisp.",
    ingredients: ["Whole wheat flour", "Salt", "Water"],
  },

  // Desserts
  "Gulab Jamun (2 pcs)": {
    description: "Two warm, melt-in-the-mouth khoya dumplings soaked in rose and cardamom sugar syrup.",
    ingredients: ["Khoya", "Sugar syrup", "Cardamom", "Rose water"],
  },
  "Chocolate Brownie Sizzler": {
    description: "A warm chocolate brownie on a sizzling plate, topped with vanilla ice cream and hot chocolate sauce.",
    ingredients: ["Chocolate brownie", "Vanilla ice cream", "Chocolate sauce", "Walnuts"],
  },
  "Vanilla Ice Cream": {
    description: "Two creamy scoops of classic vanilla ice cream.",
    ingredients: ["Milk", "Cream", "Sugar", "Vanilla"],
  },
  "Rasmalai (2 pcs)": {
    description: "Soft chenna discs soaked in chilled, saffron-cardamom milk and garnished with pistachio.",
    ingredients: ["Chenna", "Milk", "Saffron", "Cardamom", "Pistachio"],
  },

  // Beverages
  "Masala Chai": {
    description: "Strong, milky Indian tea brewed with ginger, cardamom and whole spices.",
    ingredients: ["Tea leaves", "Milk", "Ginger", "Cardamom", "Cinnamon", "Sugar"],
  },
  "Cold Coffee": {
    description: "Chilled, frothy coffee blended with milk and a scoop of ice cream.",
    ingredients: ["Coffee", "Milk", "Ice cream", "Sugar", "Ice"],
  },
  "Fresh Lime Water": {
    description: "Freshly squeezed lime with chilled water -- sweet, salted or mixed. Light and refreshing.",
    ingredients: ["Fresh lime", "Water", "Sugar", "Black salt"],
  },
  "Mango Lassi": {
    description: "Thick, chilled yoghurt drink blended with ripe mango pulp and a pinch of cardamom.",
    ingredients: ["Curd", "Mango pulp", "Sugar", "Cardamom"],
  },
  "Filter Coffee": {
    description: "South Indian decoction coffee with frothy hot milk, served the traditional way in a davara-tumbler.",
    ingredients: ["Coffee-chicory decoction", "Milk", "Sugar"],
  },

  // Soups
  "Tomato Shorba": {
    description: "A light, spiced tomato soup tempered with cumin and fresh coriander.",
    ingredients: ["Tomato", "Cumin", "Ginger", "Black pepper", "Coriander"],
    spiceLevel: "mild",
  },
  "Sweet Corn Soup": {
    description: "Comforting creamy soup with sweet corn kernels and finely chopped vegetables.",
    ingredients: ["Sweet corn", "Carrot", "Beans", "Spring onion", "Black pepper", "Corn flour"],
    spiceLevel: "mild",
  },
  "Chicken Hot & Sour Soup": {
    description: "Tangy, peppery Indo-Chinese soup with shredded chicken, vegetables, soy and vinegar.",
    ingredients: ["Shredded chicken", "Cabbage", "Carrot", "Mushroom", "Soy sauce", "Vinegar", "Black pepper", "Chilli"],
    spiceLevel: "spicy",
  },

  // Salads
  "Garden Green Salad": {
    description: "Fresh-cut cucumber, tomato, onion and carrot with lemon and chaat masala.",
    ingredients: ["Cucumber", "Tomato", "Onion", "Carrot", "Lemon", "Chaat masala"],
    spiceLevel: "mild",
  },
  "Paneer Tikka Salad": {
    description: "Grilled paneer tikka on crisp greens and peppers with a tangy mint-yoghurt dressing.",
    ingredients: ["Paneer tikka", "Lettuce", "Capsicum", "Onion", "Cucumber", "Mint-yoghurt dressing"],
    spiceLevel: "mild",
  },

  // Momos
  "Veg Momos (8 pcs)": {
    description: "Eight steamed dumplings filled with finely chopped vegetables, served with spicy red momo chutney.",
    ingredients: ["Refined flour wrapper", "Cabbage", "Carrot", "Onion", "Ginger-garlic", "Momo chutney"],
    spiceLevel: "medium",
  },
  "Chicken Momos (8 pcs)": {
    description: "Eight steamed dumplings stuffed with juicy minced chicken, served with spicy red momo chutney.",
    ingredients: ["Refined flour wrapper", "Minced chicken", "Onion", "Ginger-garlic", "Spring onion", "Momo chutney"],
    spiceLevel: "medium",
  },

  // Rolls
  "Paneer Kathi Roll": {
    description: "Flaky paratha rolled around tandoori paneer, onions and mint chutney. Easy to eat on the go.",
    ingredients: ["Paratha", "Paneer tikka", "Onion", "Capsicum", "Mint chutney", "Chaat masala"],
    spiceLevel: "medium",
  },
  "Chicken Kathi Roll": {
    description: "Kolkata-style roll -- egg-coated paratha wrapped around spiced chicken tikka, onions and chutney.",
    ingredients: ["Paratha", "Egg", "Chicken tikka", "Onion", "Mint chutney", "Lemon"],
    spiceLevel: "medium",
  },

  // South Indian
  "Masala Dosa": {
    description: "Crisp golden rice-lentil crepe filled with spiced potato masala, served with sambhar and coconut chutney.",
    ingredients: ["Rice-urad dosa batter", "Potato masala", "Mustard seeds", "Curry leaves", "Sambhar", "Coconut chutney"],
    spiceLevel: "mild",
  },
  "Idli Sambhar (4 pcs)": {
    description: "Four soft steamed rice cakes with hot sambhar and fresh coconut chutney. Light and wholesome.",
    ingredients: ["Rice-urad idli batter", "Sambhar", "Coconut chutney"],
    spiceLevel: "mild",
  },
};

(async () => {
  const dry = process.argv.includes("--dry");
  await mongoose.connect(process.env.MONGO_URI);
  const products = mongoose.connection.db.collection("products");

  const rows = await products.find({}).project({ name: 1 }).toArray();
  const byName = new Map(rows.map((row) => [row.name, row]));

  let updated = 0;
  for (const [name, details] of Object.entries(MENU)) {
    if (!byName.has(name)) {
      console.log("skip (not on menu):", name);
      continue;
    }
    if (!dry) await products.updateMany({ name }, { $set: details });
    updated += 1;
  }

  const missing = rows.filter((row) => !MENU[row.name]).map((row) => row.name);
  console.log(`${dry ? "Would update" : "Updated"} ${updated} of ${rows.length} items.`);
  if (missing.length) console.log("No details written for:", missing.join(", "));
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
