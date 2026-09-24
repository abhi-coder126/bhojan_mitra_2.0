const mongoose = require("mongoose");
const { branchScopePlugin } = require("../utils/tenant");

// Menu pictures live in their own collection, not on the Product document. A base64
// picture is a few hundred KB, and keeping it inline meant every product read -- the
// menu list, billing, the dashboard, food cost -- dragged those bytes along with it.
// Product only carries a `hasImage` flag; the bytes are fetched from here on demand.
const productImageSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, unique: true, index: true },
    // The original data URL, e.g. "data:image/webp;base64,...."
    dataUrl: { type: String, required: true },
  },
  { timestamps: true }
);

productImageSchema.plugin(branchScopePlugin);

module.exports = mongoose.model("ProductImage", productImageSchema);
