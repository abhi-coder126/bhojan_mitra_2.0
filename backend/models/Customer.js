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
    loyaltyPoints: { type: Number, default: 0 },
    totalVisits: { type: Number, default: 0 },
    lastVisit: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Customer", customerSchema);
