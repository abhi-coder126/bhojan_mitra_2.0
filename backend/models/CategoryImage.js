const mongoose = require("mongoose");
const { branchScopePlugin } = require("../utils/tenant");

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // Empty when the category has been created but no picture chosen yet: this
  // record doubles as the registry of categories, not just of images.
  dataUrl: { type: String, default: "", select: false },
}, { timestamps: true });
schema.plugin(branchScopePlugin);
schema.index({ branchId: 1, name: 1 }, { unique: true });
module.exports = mongoose.model("CategoryImage", schema);
