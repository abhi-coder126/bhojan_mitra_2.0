const Recipe = require("../models/Recipe");
const RawMaterial = require("../models/RawMaterial");
const InventoryTransaction = require("../models/InventoryTransaction");

const round3 = (value) => Math.round(Number(value || 0) * 1000) / 1000;
const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

// Applies one signed stock change to a raw material and writes the ledger row.
// The stock change is a single atomic update, so concurrent orders can't lose
// each other's deductions. A purchase also re-prices the material at its weighted
// average cost: (current stock value + purchase value) / new stock.
const applyMovement = async (materialId, qty, { type, unitCost, reference = "", note = "", actor = "system" }) => {
  const change = round3(qty);
  if (!change) return null;

  let material;
  if (type === "purchase") {
    const cost = Math.max(Number(unitCost || 0), 0);
    const onHand = { $max: ["$stock", 0] };
    material = await RawMaterial.findOneAndUpdate(
      { _id: materialId },
      [
        {
          $set: {
            costPerUnit: {
              $cond: [
                { $gt: [{ $add: [onHand, change] }, 0] },
                {
                  $divide: [
                    { $add: [{ $multiply: [onHand, "$costPerUnit"] }, change * cost] },
                    { $add: [onHand, change] },
                  ],
                },
                cost,
              ],
            },
            stock: { $add: ["$stock", change] },
          },
        },
      ],
      { new: true, updatePipeline: true }
    );
  } else {
    material = await RawMaterial.findOneAndUpdate({ _id: materialId }, { $inc: { stock: change } }, { new: true });
  }
  if (!material) return null;

  const rate = type === "purchase" ? Number(unitCost || 0) : Number(material.costPerUnit || 0);
  await InventoryTransaction.create({
    materialId: material._id,
    materialName: material.name,
    unit: material.unit,
    type,
    qty: change,
    stockBefore: round3(material.stock - change),
    stockAfter: round3(material.stock),
    unitCost: round2(rate),
    value: round2(change * rate),
    reference,
    note,
    actor,
  });

  return material;
};

// Raw material quantities used by `items` (sold dishes), from their recipes.
const ingredientUsage = async (items = []) => {
  const usage = new Map();
  if (!Array.isArray(items) || items.length === 0) return usage;

  const productIds = items.map((item) => item.productId).filter(Boolean);
  if (productIds.length === 0) return usage;

  const recipes = await Recipe.find({ productId: { $in: productIds } });
  const recipeMap = new Map(recipes.map((recipe) => [String(recipe.productId), recipe]));

  items.forEach((item) => {
    const recipe = recipeMap.get(String(item.productId));
    if (!recipe) return;
    const qtySold = Number(item.qty || 0);
    recipe.items.forEach((ingredient) => {
      const key = String(ingredient.rawMaterialId);
      usage.set(key, (usage.get(key) || 0) + Number(ingredient.qtyPerUnit || 0) * qtySold);
    });
  });

  return usage;
};

// A dish was sold: take its ingredients out of stock. Stock may go below zero --
// that means purchases weren't recorded, and the Low Stock view flags it.
const consumeIngredients = async (items, { reference = "", actor = "system" } = {}) => {
  const usage = await ingredientUsage(items);
  for (const [materialId, qty] of usage) {
    await applyMovement(materialId, -qty, { type: "consumption", reference, actor });
  }
  return usage.size > 0;
};

// The sale was undone (order cancelled / bill deleted): put the ingredients back.
const returnIngredients = async (items, { reference = "", note = "", actor = "system" } = {}) => {
  const usage = await ingredientUsage(items);
  for (const [materialId, qty] of usage) {
    await applyMovement(materialId, qty, { type: "reversal", reference, note, actor });
  }
};

module.exports = { applyMovement, consumeIngredients, returnIngredients, ingredientUsage };
