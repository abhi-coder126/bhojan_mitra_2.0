const mongoose = require("mongoose");
const { branchScopePlugin } = require("../utils/tenant");

// An offer attached to a menu item, as opposed to a Coupon, which discounts the
// bill as a whole. Two shapes cover what restaurants actually run:
//
//   bogo   -- buy this item, get another of the same item free
//             ("Buy 1 Get 1 Free", usually only on Medium and Large)
//   combo  -- buy this item, get a different item free
//             ("Free cold drink with any pizza")
//
// variantIds narrows the offer to particular sizes. Empty means every size, which
// is also the right answer for an item that has no sizes at all.
const menuOfferSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    type: { type: String, enum: ["bogo", "combo"], required: true },

    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variantIds: { type: [String], default: [] },

    // Nothing is given away below this bill amount. 0 means no minimum.
    minOrderAmount: { type: Number, default: 0, min: 0 },

    // combo only
    freeProductId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    freeVariantId: { type: String, default: "" },

    // Same weekday convention as Coupon: 0 = Sunday, evaluated in India time.
    activeDays: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  { timestamps: true }
);

menuOfferSchema.plugin(branchScopePlugin);
menuOfferSchema.index({ branchId: 1, productId: 1 });

module.exports = mongoose.model("MenuOffer", menuOfferSchema);
