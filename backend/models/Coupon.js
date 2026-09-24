const mongoose = require("mongoose");
const { branchScopePlugin } = require("../utils/tenant");

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    discountType: {
      type: String,
      enum: ["Amount", "Percent"],
      required: true,
    },
    discountValue: { type: Number, required: true },
    minimumBillAmount: { type: Number, default: 0 },
    usageLimit: { type: Number, default: 0 },
    usedCount: { type: Number, default: 0 },
    startDate: Date,
    endDate: Date,
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
  },
  { timestamps: true }
);

couponSchema.index({ branchId: 1, code: 1 }, { unique: true });
couponSchema.plugin(branchScopePlugin);

module.exports = mongoose.model("Coupon", couponSchema);