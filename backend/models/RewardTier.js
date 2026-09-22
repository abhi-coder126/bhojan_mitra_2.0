const mongoose = require("mongoose");

// Admin-configured rule: "after N completed delivery orders, give this offer."
const rewardTierSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    minOrders: { type: Number, required: true, min: 1 },
    offerType: { type: String, enum: ["percent", "flat", "freebie"], default: "percent" },
    offerValue: { type: Number, default: 0 },
    offerText: { type: String, required: true, trim: true },
    validityDays: { type: Number, default: 7, min: 1 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RewardTier", rewardTierSchema);
