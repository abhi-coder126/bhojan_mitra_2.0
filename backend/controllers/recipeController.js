const Recipe = require("../models/Recipe");
const RawMaterial = require("../models/RawMaterial");
const Product = require("../models/Product");
const { logAudit, getActor } = require("../utils/auditLog");

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

exports.getRecipes = async (req, res) => {
  try {
    const recipes = await Recipe.find().sort({ productName: 1 });
    res.json({ success: true, recipes });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getRecipeByProduct = async (req, res) => {
  try {
    const recipe = await Recipe.findOne({ productId: req.params.productId });
    res.json({ success: true, recipe: recipe || null });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Quantities are per ONE portion sold, in the raw material's own unit (e.g. 0.2 kg).
exports.upsertRecipe = async (req, res) => {
  try {
    const { productId, items = [] } = req.body;
    if (!productId) return res.status(400).json({ message: "Select a menu item" });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Menu item not found" });

    const rawMaterialIds = items.map((i) => i.rawMaterialId).filter(Boolean);
    const rawMaterials = await RawMaterial.find({ _id: { $in: rawMaterialIds } });
    const rmMap = new Map(rawMaterials.map((rm) => [String(rm._id), rm]));

    const seen = new Set();
    const recipeItems = [];
    for (const item of items) {
      const rm = rmMap.get(String(item.rawMaterialId));
      const qtyPerUnit = Number(item.qtyPerUnit);
      if (!rm) continue;
      if (!(qtyPerUnit > 0)) {
        return res.status(400).json({ message: `Enter a quantity above 0 for ${rm.name}` });
      }
      if (seen.has(String(rm._id))) {
        return res.status(400).json({ message: `${rm.name} is added twice -- combine it into one line` });
      }
      seen.add(String(rm._id));
      recipeItems.push({ rawMaterialId: rm._id, rawMaterialName: rm.name, unit: rm.unit, qtyPerUnit });
    }

    if (recipeItems.length === 0) {
      return res.status(400).json({ message: "Add at least one ingredient" });
    }

    const recipe = await Recipe.findOneAndUpdate(
      { productId },
      { productId, productName: product.name, items: recipeItems },
      { new: true, upsert: true }
    );

    await logAudit({
      actor: getActor(req),
      action: "recipe_saved",
      entity: "Recipe",
      entityId: recipe._id,
      newValue: `${product.name}: ${recipeItems.map((i) => `${i.qtyPerUnit} ${i.unit} ${i.rawMaterialName}`).join(", ")}`,
    });

    res.json({ success: true, recipe });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findByIdAndDelete(req.params.id);
    if (!recipe) return res.status(404).json({ message: "Recipe not found" });
    res.json({ success: true, message: "Recipe deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Food cost % = ingredient cost of one portion / selling price excl. GST.
// Menu prices (mrp) are GST-inclusive, and GST isn't revenue, so it is backed out
// first -- otherwise every dish would look cheaper to make than it really is.
// Also reports how many portions the current stock can still make.
exports.getFoodCost = async (req, res) => {
  try {
    const recipes = await Recipe.find();
    const products = await Product.find({ _id: { $in: recipes.map((r) => r.productId) } }).lean();
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const rawMaterialIds = [...new Set(recipes.flatMap((r) => r.items.map((i) => String(i.rawMaterialId))))];
    const rawMaterials = await RawMaterial.find({ _id: { $in: rawMaterialIds } });
    const rmMap = new Map(rawMaterials.map((rm) => [String(rm._id), rm]));

    const foodCosts = recipes
      .map((recipe) => {
        const product = productMap.get(String(recipe.productId));
        let portionsPossible = Infinity;
        let limitingIngredient = "";

        const ingredients = recipe.items.map((item) => {
          const rm = rmMap.get(String(item.rawMaterialId));
          const qty = Number(item.qtyPerUnit || 0);
          const cost = qty * Number(rm?.costPerUnit || 0);
          const canMake = rm && qty > 0 ? Math.max(Math.floor(Number(rm.stock || 0) / qty), 0) : 0;
          if (canMake < portionsPossible) {
            portionsPossible = canMake;
            limitingIngredient = rm?.name || item.rawMaterialName;
          }
          return {
            name: rm?.name || item.rawMaterialName,
            unit: rm?.unit || item.unit,
            qty,
            cost: round2(cost),
            missing: !rm,
          };
        });

        const ingredientCost = ingredients.reduce((sum, item) => sum + item.cost, 0);
        const priceInclGst = Number(product?.mrp || product?.sellingPrice || 0);
        const gst = Number(product?.gst || 0);
        const sellingPrice = gst > 0 ? priceInclGst / (1 + gst / 100) : priceInclGst;
        const foodCostPercent = sellingPrice > 0 ? (ingredientCost / sellingPrice) * 100 : 0;

        return {
          recipeId: recipe._id,
          productId: recipe.productId,
          productName: product?.name || recipe.productName,
          ingredients,
          ingredientCost: round2(ingredientCost),
          priceInclGst: round2(priceInclGst),
          sellingPrice: round2(sellingPrice),
          foodCostPercent: round2(foodCostPercent),
          grossMargin: round2(sellingPrice - ingredientCost),
          portionsPossible: Number.isFinite(portionsPossible) ? portionsPossible : 0,
          limitingIngredient,
        };
      })
      .sort((a, b) => b.foodCostPercent - a.foodCostPercent);

    res.json({ success: true, foodCosts });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
