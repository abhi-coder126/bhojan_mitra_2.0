const PlatformSetting = require("../models/PlatformSetting");
const { logAudit, getActor, getClientIp } = require("../utils/auditLog");

const EDITABLE = ["supportName", "supportPhone", "supportWhatsapp", "supportEmail", "supportHours"];

const publicView = (settings) => ({
  multiBranchEnabled: settings.multiBranchEnabled,
  support: {
    name: settings.supportName,
    phone: settings.supportPhone,
    whatsapp: settings.supportWhatsapp,
    email: settings.supportEmail,
    hours: settings.supportHours,
  },
});

// GET /platform -- any logged-in user (drives the Support page and whether the
// branch features are shown).
exports.getPlatformSettings = async (req, res) => {
  try {
    res.json({ success: true, platform: publicView(await PlatformSetting.get()) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /platform -- master admin only.
exports.updatePlatformSettings = async (req, res) => {
  try {
    const settings = await PlatformSetting.get();
    const before = settings.multiBranchEnabled;

    if (req.body.multiBranchEnabled !== undefined) {
      settings.multiBranchEnabled = Boolean(req.body.multiBranchEnabled);
    }
    EDITABLE.forEach((key) => {
      if (req.body[key] !== undefined) settings[key] = String(req.body[key] ?? "").trim();
    });

    if (settings.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.supportEmail)) {
      return res.status(400).json({ success: false, message: "Support email is not valid" });
    }

    await settings.save();

    if (before !== settings.multiBranchEnabled) {
      await logAudit({
        actor: getActor(req),
        action: settings.multiBranchEnabled ? "multi_branch_enabled" : "multi_branch_disabled",
        entity: "Platform",
        field: "multiBranchEnabled",
        oldValue: before,
        newValue: settings.multiBranchEnabled,
        ip: getClientIp(req),
        userAgent: req.headers["user-agent"] || "",
      });
    }

    res.json({ success: true, platform: publicView(settings) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
