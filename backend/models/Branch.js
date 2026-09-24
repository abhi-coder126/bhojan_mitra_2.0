const mongoose = require("mongoose");

// What the royalty % is charged on -- chosen per branch by the master admin.
const ROYALTY_BASES = {
  net_ex_gst: "Net sales (excl. GST)",
  gross_inc_gst: "Gross sales (incl. GST)",
  net_inc_gst: "Net sales (incl. GST)",
};

const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Short public identifier used in QR/menu URLs (/menu/<code>/<table>). Immutable
    // once created -- changing it would break every QR already printed for the branch.
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z0-9]{2,10}$/,
    },
    address: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    gstNumber: { type: String, default: "", trim: true },

    // active: normal. hold: staff login + customer ordering blocked, data kept.
    // archived: "removed" -- same as hold plus hidden from the default list; history kept.
    status: { type: String, enum: ["active", "hold", "archived"], default: "active" },
    statusReason: { type: String, default: "", trim: true },
    statusChangedAt: { type: Date, default: null },

    // The branch that owned all data before multi-branch existed. Legacy QR codes
    // without a branch code (/menu/<table>) resolve to it.
    isDefault: { type: Boolean, default: false },

    royaltyPercent: { type: Number, default: 0, min: 0, max: 100 },
    royaltyBase: { type: String, enum: Object.keys(ROYALTY_BASES), default: "net_ex_gst" },

    adminUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Branch", branchSchema);
module.exports.ROYALTY_BASES = ROYALTY_BASES;
