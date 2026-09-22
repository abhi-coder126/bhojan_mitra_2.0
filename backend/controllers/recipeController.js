const Recipe = require("../models/Recipe");
const RawMaterial = require("../models/RawMaterial");
const Product = require("../models/Product");

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

exports.upsertRecipe = async (req, res) => {
  try {
    const { productId, items = [] } = req.body;
    if (!productId) return res.status(400).json({ message: "Product required" });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const rawMaterialIds = items.map((i) => i.rawMaterialId).filter(Boolean);
    const rawMaterials = await RawMaterial.find({ _id: { $in: rawMaterialIds } });
    const rmMap = new Map(rawMaterials.map((rm) => [String(rm._id), rm]));

    const recipeItems = items
      .map((item) => {
        const rm = rmMap.get(String(item.rawMaterialId));
        if (!rm) return null;
        return {
          rawMaterialId: rm._id,
          rawMaterialName: rm.name,
          unit: rm.unit,
          qtyPerUnit: Number(item.qtyPerUnit || 0),
        };
      })
      .filter(Boolean);

    const recipe = await Recipe.findOneAndUpdate(
      { productId },
      { productId, productName: product.name, items: recipeItems },
      { new: true, upsert: true }
    );

    res.json({ success: true, recipe });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteRecipe = async (req, res) => {
  try {
    await Recipe.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Recipe deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Food cost % = (ingredient cost of one unit / selling price) * 100
exports.getFoodCost = async (req, res) => {
  try {
    const recipes = await Recipe.find();
    const products = await Product.find();
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const foodCosts = recipes.map((recipe) => ({
      recipe,
      product: productMap.get(String(recipe.productId)),
    }));

    // compute ingredient cost using current raw material prices
    const rawMaterialIds = [...new Set(recipes.flatMap((r) => r.items.map((i) => String(i.rawMaterialId))))];
    const rawMaterials = await RawMaterial.find({ _id: { $in: rawMaterialIds } });
    const rmCostMap = new Map(rawMaterials.map((rm) => [String(rm._id), Number(rm.costPerUnit || 0)]));

    const result = foodCosts.map(({ recipe, product }) => {
      const ingredientCost = recipe.items.reduce(
        (sum, item) => sum + Number(item.qtyPerUnit || 0) * (rmCostMap.get(String(item.rawMaterialId)) || 0),
        0
      );
      const sellingPrice = Number(product?.sellingPrice || product?.mrp || 0);
      const foodCostPercent = sellingPrice > 0 ? (ingredientCost / sellingPrice) * 100 : 0;

      return {
        productId: recipe.productId,
        productName: recipe.productName,
        ingredientCost: Number(ingredientCost.toFixed(2)),
        sellingPrice,
        foodCostPercent: Number(foodCostPercent.toFixed(2)),
        grossMargin: Number((sellingPrice - ingredientCost).toFixed(2)),
      };
    });

    res.json({ success: true, foodCosts: result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Auto-deduct raw material stock for items sold (used by Sale + RestaurantOrder creation)
exports.deductRawMaterialsForItems = async (items = []) => {
  if (!Array.isArray(items) || items.length === 0) return;

  const productIds = items.map((i) => i.productId).filter(Boolean);
  if (productIds.length === 0) return;

  const recipes = await Recipe.find({ productId: { $in: productIds } });
  if (recipes.length === 0) return;

  const recipeMap = new Map(recipes.map((r) => [String(r.productId), r]));
  const deductions = new Map(); // rawMaterialId -> qty to deduct

  items.forEach((item) => {
    const recipe = recipeMap.get(String(item.productId));
    if (!recipe) return;

    const qtySold = Number(item.qty || 0);
    recipe.items.forEach((ri) => {
      const key = String(ri.rawMaterialId);
      const deductQty = Number(ri.qtyPerUnit || 0) * qtySold;
      deductions.set(key, (deductions.get(key) || 0) + deductQty);
    });
  });

  if (deductions.size === 0) return;

  await RawMaterial.bulkWrite(
    Array.from(deductions.entries()).map(([rawMaterialId, qty]) => ({
      updateOne: {
        filter: { _id: rawMaterialId },
        update: { $inc: { stock: -qty } },
      },
    }))
  );
};
