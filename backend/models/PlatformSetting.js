const mongoose = require("mongoose");

// Head-office settings that apply to the whole chain (not branch-scoped -- the
// per-branch store settings live in Setting). A single document.
const platformSettingSchema = new mongoose.Schema(
  {
    // Off: the chain runs as a single outlet and no new branches can be added.
    multiBranchEnabled: { type: Boolean, default: false },

    // Shown on every user's Support page.
    supportName: { type: String, default: "RestroSethu Support", trim: true },
    supportPhone: { type: String, default: "", trim: true },
    supportWhatsapp: { type: String, default: "", trim: true },
    supportEmail: { type: String, default: "", lowercase: true, trim: true },
    supportHours: { type: String, default: "Mon-Sat, 10:00 AM - 7:00 PM", trim: true },
  },
  { timestamps: true }
);

platformSettingSchema.statics.get = async function getPlatformSettings() {
  return (await this.findOne()) || this.create({});
};

module.exports = mongoose.model("PlatformSetting", platformSettingSchema);
