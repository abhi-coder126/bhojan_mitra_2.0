const AuditLog = require("../models/AuditLog");
const { currentRequest, getClientIp } = require("./requestContext");

// Lightweight audit helper. Never throws — a failed audit write should not break the mutation it logs.
// `ip`/`userAgent` default to the current request's (see utils/requestContext.js), so
// every entry records which system it came from, not only logins.
// `branchId` tags entries written outside a branch request (e.g. a login attempt);
// inside a branch request the tenant plugin tags the entry with that branch.
const logAudit = async ({ actor, action, entity, entityId, field, oldValue, newValue, ip, userAgent, branchId }) => {
  try {
    const request = currentRequest();
    await AuditLog.create({
      branchId: branchId || null,
      actor: actor || "system",
      action,
      entity,
      entityId: entityId ? String(entityId) : "",
      field: field || "",
      oldValue: oldValue === undefined ? null : oldValue,
      newValue: newValue === undefined ? null : newValue,
      ip: ip || request.ip || "",
      userAgent: userAgent || request.userAgent || "",
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

module.exports = { logAudit, getActor, getClientIp };
