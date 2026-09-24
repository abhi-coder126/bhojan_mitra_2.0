const AuditLog = require("../models/AuditLog");
const Branch = require("../models/Branch");
const { runUnscoped } = require("../utils/tenant");

// Branch users see their own branch's log. The master admin can pass scope=all to
// see every branch plus head-office activity (e.g. their own logins).
exports.getAuditLogs = async (req, res) => {
  try {
    const { entity, actor, action, limit = 200 } = req.query;
    const query = {};
    if (entity) query.entity = entity;
    if (actor) query.actor = actor;
    if (action) query.action = action;

    const find = () =>
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .limit(Math.min(Number(limit) || 200, 500))
        .lean();

    const allBranches = req.user.isMaster && req.query.scope === "all";
    const logs = allBranches ? await runUnscoped(find) : await find();

    const branchIds = [...new Set(logs.map((log) => String(log.branchId || "")).filter(Boolean))];
    const branches = await Branch.find({ _id: { $in: branchIds } }).select("name code").lean();
    const branchMap = new Map(branches.map((b) => [String(b._id), `${b.name} (${b.code})`]));

    res.json({
      success: true,
      logs: logs.map((log) => ({
        ...log,
        branchName: log.branchId ? branchMap.get(String(log.branchId)) || "" : "Head office",
      })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
