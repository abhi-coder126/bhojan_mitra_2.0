const mongoose = require("mongoose");
const { branchScopePlugin } = require("../utils/tenant");

// A specific reward instance handed to one customer for completing one order.
const rewardSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "RestaurantOrder", required: true },
    tierId: { type: mongoose.Schema.Types.ObjectId, ref: "RewardTier", default: null },
    title: { type: String, required: true },
    offerText: { type: String, required: true },
    scratched: { type: Boolean, default: false },
    scratchedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

rewardSchema.plugin(branchScopePlugin);

module.exports = mongoose.model("Reward", rewardSchema);
