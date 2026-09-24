const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    crn: {
      type: String,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    contact: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      default: "",
      lowercase: true,
      trim: true,
    },
    // Optional -- most customers log in passwordless via email OTP. Set only when
    // a customer chooses to create a password for direct email+password login.
    // `select: false` so it never comes back on normal Customer reads (matches
    // how the staff `User` model treats `password`).
    password: {
      type: String,
      select: false,
      default: null,
    },
    address: {
      type: String,
      default: "",
    },
    // Saved delivery addresses (Home/Work/Other, Zomato/Swiggy-style) so a logged-in
    // customer doesn't have to retype their address on every delivery order.
    addresses: [
      {
        label: { type: String, default: "Home", trim: true },
        address: { type: String, required: true, trim: true },
        isDefault: { type: Boolean, default: false },
      },
    ],
    activeFrom: {
      type: Date,
      default: Date.now,
    },
    // A customer is one chain-wide identity (unique phone, shared login/loyalty), but
    // each branch only sees the customers who have ordered from it.
    branchIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Branch" }], default: [], index: true },
    loyaltyPoints: { type: Number, default: 0 },
    totalVisits: { type: Number, default: 0 },
    lastVisit: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Customer", customerSchema);
