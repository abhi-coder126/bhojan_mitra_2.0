const { AsyncLocalStorage } = require("node:async_hooks");

// Who is making the current request (IP + device), available anywhere during the
// request without passing `req` around -- used to stamp every audit log entry.
const storage = new AsyncLocalStorage();

// Real client IP behind Render's proxy (or Cloudflare), falling back to the socket.
// IPv4 clients reached over an IPv6 socket appear as "::ffff:1.2.3.4" -- unwrap it.
const getClientIp = (req) => {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip =
    req.headers["cf-connecting-ip"] ||
    forwarded ||
    req.headers["x-real-ip"] ||
    req.ip ||
    req.socket?.remoteAddress ||
    "";
  return String(ip).replace(/^::ffff:/, "");
};

const requestContext = (req, res, next) => {
  storage.run({ ip: getClientIp(req), userAgent: String(req.headers["user-agent"] || "") }, next);
};

const currentRequest = () => storage.getStore() || {};

module.exports = { requestContext, currentRequest, getClientIp };
