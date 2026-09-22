const AuditLog = require("../models/AuditLog");

// Lightweight audit helper. Never throws — a failed audit write should not break the mutation it logs.
const logAudit = async ({ actor, action, entity, entityId, field, oldValue, newValue, ip, userAgent }) => {
  try {
    await AuditLog.create({
      actor: actor || "system",
      action,
      entity,
      entityId: entityId ? String(entityId) : "",
      field: field || "",
      oldValue: oldValue === undefined ? null : oldValue,
      newValue: newValue === undefined ? null : newValue,
      ip: ip || "",
      userAgent: userAgent || "",
    });
  } catch (error) {
    console.error("Audit log failed:", error.message);
  }
};

// Best-effort client IP, preferring the left-most X-Forwarded-For hop (the original client)
// over req.ip, since Render/most PaaS front the app with a reverse proxy. Requires
// app.set("trust proxy", ...) in server.js for req.ip itself to reflect that too.
const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "";
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
