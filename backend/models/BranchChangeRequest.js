const mongoose = require("mongoose");

// A branch asking head office to change its own profile. Branch staff never edit the
// branch record directly: they raise a request here, and it only reaches the Branch
// document once the master admin approves it.
//
// Deliberately NOT branch-scoped by the tenant plugin: the master admin works at head
// office with no branch open and has to see requests from every branch. Every query
// below filters by branchId explicitly instead.
const EDITABLE_FIELDS = ["name", "address", "city", "phone", "email", "gstNumber"];

const branchChangeRequestSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    // Snapshot so a reviewed request still reads correctly if the branch is renamed.
    branchName: { type: String, default: "" },
    branchCode: { type: String, default: "" },

    requestedBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      name: { type: String, default: "" },
      email: { type: String, default: "" },
    },

    // Only the fields the branch actually changed, plus what they were before.
    changes: { type: Map, of: String, default: {} },
    previous: { type: Map, of: String, default: {} },
    note: { type: String, default: "", trim: true },

    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    reviewedBy: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BranchChangeRequest", branchChangeRequestSchema);
module.exports.EDITABLE_FIELDS = EDITABLE_FIELDS;
