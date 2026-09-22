const AuditLog = require("../models/AuditLog");

exports.getAuditLogs = async (req, res) => {
  try {
    const { entity, actor, action, limit = 200 } = req.query;
    const query = {};
    if (entity) query.entity = entity;
    if (actor) query.actor = actor;
    if (action) query.action = action;

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 200, 500));

    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
