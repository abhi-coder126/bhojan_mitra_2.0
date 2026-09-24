const mongoose = require("mongoose");
const { branchScopePlugin } = require("../utils/tenant");

const recipeItemSchema = new mongoose.Schema(
  {
    rawMaterialId: { type: mongoose.Schema.Types.ObjectId, ref: "RawMaterial", required: true },
    rawMaterialName: String,
    unit: String,
    qtyPerUnit: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const recipeSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, unique: true },
    productName: String,
    items: [recipeItemSchema],
  },
  { timestamps: true }
);

recipeSchema.plugin(branchScopePlugin);

module.exports = mongoose.model("Recipe", recipeSchema);
