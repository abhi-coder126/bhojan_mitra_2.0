const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["master_admin", "admin", "staff", "owner", "manager", "cashier", "waiter", "kitchen", "inventory"],
      default: "admin",
    },
    // Every role except master_admin belongs to exactly one branch and can only ever
    // see that branch's data (enforced in authMiddleware.protect).
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
