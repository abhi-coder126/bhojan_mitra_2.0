const mongoose = require("mongoose");
const { branchScopePlugin } = require("../utils/tenant");

const deletionLogSchema = new mongoose.Schema(
  {
    recordType: { type: String, required: true },
    recordNo: { type: String, default: "" },
    title: { type: String, default: "" },
    deletedBy: { type: String, default: "User" },
    details: { type: String, default: "" },
  },
  { timestamps: true }
);

deletionLogSchema.plugin(branchScopePlugin);

module.exports = mongoose.model("DeletionLog", deletionLogSchema);
