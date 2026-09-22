const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
    vendorName: String,

    barcode: { type: String, required: true },
    sku: String,
    category: String,
    foodType: {
      type: String,
      enum: ["veg", "non-veg"],
      default: "veg",
    },
    description: String,
    spiceLevel: {
      type: String,
      enum: ["mild", "medium", "spicy"],
      default: "medium",
    },
    isRecommended: { type: Boolean, default: false },
    image: String,

    unit: {
      type: String,
      enum: ["PCS", "Box", "KG", "Litre", "Plate", "Bowl", "Cup", "Glass", "Portion"],
      default: "PCS",
    },

    purchasePrice: { type: Number, default: 0 },
    sellingPrice: { type: Number, required: true },
    mrp: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },

    openingStock: { type: Number, default: 0 },
    stock: { type: Number, default: 0 },
    lowStockLimit: { type: Number, default: 5 },

    expiryDate: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
