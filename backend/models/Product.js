const mongoose = require("mongoose");
const { branchScopePlugin } = require("../utils/tenant");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
    vendorName: String,

    barcode: { type: String, required: true },
    sku: String,
    category: String,
    // Drives which fields make sense on this item -- e.g. spice level and veg/non-veg
    // are meaningless for a beverage, so the admin form hides them based on this.
    itemType: {
      type: String,
      enum: ["food", "beverage", "dessert"],
      default: "food",
    },
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

    // % off the MRP shown to customers as a running offer (0 = no offer).
    offerPercent: { type: Number, default: 0, min: 0, max: 100 },

    // Running average maintained incrementally as customer ratings come in (see Rating model).
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },

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

productSchema.plugin(branchScopePlugin);

module.exports = mongoose.model("Product", productSchema);
