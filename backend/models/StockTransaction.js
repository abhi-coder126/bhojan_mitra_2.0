const mongoose = require("mongoose");
const { branchScopePlugin } = require("../utils/tenant");

const stockTransactionSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    productName: String,
    barcode: String,

    type: { type: String, enum: ["IN", "OUT"], required: true },
    source: { type: String, enum: ["PURCHASE", "SALE", "SALES_RETURN"], required: true },
    sourceNo: String,

    qty: Number,
    stockBefore: Number,
    stockAfter: Number,

    vendorName: String,
    customerName: String,
  },
  { timestamps: true }
);

stockTransactionSchema.plugin(branchScopePlugin);

module.exports = mongoose.model("StockTransaction", stockTransactionSchema);