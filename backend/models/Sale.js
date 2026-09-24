const mongoose = require("mongoose");
const { branchScopePlugin } = require("../utils/tenant");

const saleSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, required: true, unique: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },

    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    customerName: String,
    customerPhone: String,
    customerAddress: String,
    customerEmail: String,
    customerGST: String,

    products: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        name: String,
        barcode: String,
        qty: Number,
        unit: String,
        mrp: Number,
        rate: Number,
        gst: Number,
        discount: Number,
        total: Number,
        purchasePrice: Number,
      },
    ],

    subTotal: Number,
    gstAmount: Number,
    discount: Number,
    grandTotal: Number,
    billDiscount: { type: Number, default: 0 },
    couponCode: { type: String, default: "" },
    couponDiscount: { type: Number, default: 0 },
    discountReason: { type: String, default: "" },
    totalDiscount: { type: Number, default: 0 },
    payment: {
      cash: { type: Number, default: 0 },
      card: { type: Number, default: 0 },
      upi: { type: Number, default: 0 },
      credit: { type: Number, default: 0 },
    },

    paidAmount: Number,
    pendingAmount: Number,
    paymentStatus: {
      type: String,
      enum: ["Paid", "Partial", "Credit"],
      default: "Paid",
    },

    saleDate: { type: Date, default: Date.now },
    createdBy: String,
    // See RestaurantOrder.inventoryDeducted.
    inventoryDeducted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

saleSchema.plugin(branchScopePlugin);

module.exports = mongoose.model("Sale", saleSchema);