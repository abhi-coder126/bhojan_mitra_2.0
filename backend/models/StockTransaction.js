const mongoose = require("mongoose");

const stockTransactionSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    productName: String,
    barcode: String,

    type: { type: String, enum: ["IN", "OUT"], required: true },
    source: { type: String, enum: ["PURCHASE", "SALE"], required: true },
    sourceNo: String,

    qty: Number,
    stockBefore: Number,
    stockAfter: Number,

    vendorName: String,
    customerName: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("StockTransaction", stockTransactionSchema);