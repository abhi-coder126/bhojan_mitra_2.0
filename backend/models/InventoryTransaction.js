const mongoose = require("mongoose");
const { branchScopePlugin } = require("../utils/tenant");

// Stock ledger for raw materials: every change to a raw material's stock writes one
// row, so the current stock can always be explained (opening + purchases - usage -
// wastage +/- count corrections).
const inventoryTransactionSchema = new mongoose.Schema(
  {
    materialId: { type: mongoose.Schema.Types.ObjectId, ref: "RawMaterial", required: true },
    materialName: { type: String, default: "" },
    unit: { type: String, default: "" },
    type: {
      type: String,
      enum: [
        "opening", // stock entered when the material was created
        "purchase", // stock received from a supplier
        "consumption", // used by a sold dish (from its recipe)
        "reversal", // consumption given back (order cancelled / bill deleted)
        "wastage", // spoiled, expired, spilled
        "adjustment", // physical count correction
      ],
      required: true,
    },
    // Signed: positive adds stock, negative removes it.
    qty: { type: Number, required: true },
    stockBefore: { type: Number, default: 0 },
    stockAfter: { type: Number, default: 0 },
    unitCost: { type: Number, default: 0 },
    // qty * unitCost, signed like qty.
    value: { type: Number, default: 0 },
    reference: { type: String, default: "" },
    note: { type: String, default: "" },
    actor: { type: String, default: "system" },
  },
  { timestamps: true }
);

inventoryTransactionSchema.index({ materialId: 1, createdAt: -1 });
inventoryTransactionSchema.index({ type: 1, createdAt: -1 });
inventoryTransactionSchema.plugin(branchScopePlugin);

module.exports = mongoose.model("InventoryTransaction", inventoryTransactionSchema);
