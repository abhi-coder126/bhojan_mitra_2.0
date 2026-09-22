const mongoose = require("mongoose");

const salesReturnSchema = new mongoose.Schema(
  {
    returnNo: String,
    invoiceNo: String,
    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
    },
    customerName: String,
    customerPhone: String,
    products: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        name: String,
        barcode: String,
        qty: Number,
        rate: Number,
        gst: Number,
        total: Number,
      },
    ],
    returnAmount: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model("SalesReturn", salesReturnSchema);