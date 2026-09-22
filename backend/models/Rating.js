const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "RestaurantOrder", required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    stars: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "" },
    customerName: { type: String, default: "" },
  },
  { timestamps: true }
);

// One rating per item per order -- resubmitting from the same order updates it in place
// instead of double-counting toward the product's average.
ratingSchema.index({ orderId: 1, productId: 1 }, { unique: true });

module.exports = mongoose.model("Rating", ratingSchema);
