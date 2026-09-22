const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
    vendorName: String,
    invoiceNo: { type: String, required: true },
    purchaseDate: { type: Date, default: Date.now },

    products: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        name: String,
        barcode: String,
        qty: Number,
        unit: String,
        purchasePrice: Number,
        sellingPrice: Number,
        mrp: Number,
        gst: Number,
        total: Number,
      },
    ],

    totalAmount: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    paidAmount: { type: Number, default: 0 },
    pendingAmount: { type: Number, default: 0 },
    paymentMode: {
      type: String,
      enum: ["Cash", "Card", "UPI", "Credit"],
      default: "Credit",
    },

    createdBy: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Purchase", purchaseSchema);