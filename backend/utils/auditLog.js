const AuditLog = require("../models/AuditLog");

// Lightweight audit helper. Never throws — a failed audit write should not break the mutation it logs.
const logAudit = async ({ actor, action, entity, entityId, field, oldValue, newValue }) => {
  try {
    await AuditLog.create({
      actor: actor || "system",
      action,
      entity,
      entityId: entityId ? String(entityId) : "",
      field: field || "",
      oldValue: oldValue === undefined ? null : oldValue,
      newValue: newValue === undefined ? null : newValue,
    });
  } catch (error) {
    console.error("Audit log failed:", error.message);
  }
};

// Actor resolution: prefer the authenticated user attached by authMiddleware (req.user),
// falling back to req.body/query hints or "system" for any route that is still legitimately public.
const getActor = (req) => {
  if (req?.user?.name) {
    return req.user.role ? `${req.user.name} (${req.user.role})` : String(req.user.name);
  }
  const user = req.body?.userId || req.body?.actor || req.query?.userId;
  if (user) return String(user);
  try {
    const stored = req.headers["x-user-name"];
    if (stored) return String(stored);
  } catch {
    // ignore
  }
  return "system";
};

module.exports = { logAudit, getActor };
