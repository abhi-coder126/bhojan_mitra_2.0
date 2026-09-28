const mongoose = require("mongoose");
const { branchScopePlugin } = require("../utils/tenant");

// A guest's review of one finished order, in three parts: the food/order itself,
// the restaurant (service, packing, hygiene) and -- for delivery orders -- the
// delivery. Item-level stars live in Rating; this is the order-level feedback
// the dashboard's "Customer Ratings" card is built from.
const stars = { type: Number, min: 1, max: 5 };

const orderReviewSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "RestaurantOrder", required: true },
    orderNo: { type: String, default: "" },
    orderType: { type: String, default: "dine-in" },
    customerName: { type: String, default: "" },
    foodStars: { ...stars, required: true },
    restaurantStars: { ...stars, required: true },
    // Only for delivery orders.
    deliveryStars: { ...stars, default: null },
    comment: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true }
);

// One review per order -- submitting again edits it instead of double-counting.
orderReviewSchema.index({ orderId: 1 }, { unique: true });

orderReviewSchema.plugin(branchScopePlugin);

module.exports = mongoose.model("OrderReview", orderReviewSchema);
