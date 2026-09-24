const mongoose = require("mongoose");
const { branchScopePlugin } = require("../utils/tenant");

const rawMaterialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    unit: {
      type: String,
      enum: ["kg", "g", "litre", "ml", "pcs", "dozen", "pack"],
      default: "kg",
    },
    stock: { type: Number, default: 0 },
    costPerUnit: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
    vendorName: String,
  },
  { timestamps: true }
);

rawMaterialSchema.plugin(branchScopePlugin);

module.exports = mongoose.model("RawMaterial", rawMaterialSchema);
