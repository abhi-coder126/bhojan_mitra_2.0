const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Verifies the JWT sent as `Authorization: Bearer <token>` and attaches
// req.user = { id, name, role } on success. Responds 401 on missing/invalid token.
const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token provided" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Not authorized, invalid or expired token" });
    }

    // Confirm the user still exists (covers deleted/deactivated accounts).
    const user = await User.findById(decoded.id).select("name email role").lean();
    if (!user) {
      return res.status(401).json({ message: "Not authorized, user no longer exists" });
    }

    req.user = { id: String(user._id), name: user.name, email: user.email, role: user.role };
    next();
  } catch (error) {
    res.status(401).json({ message: "Not authorized" });
  }
};

// Role-gate helper: requireRole("owner", "manager") only allows those roles through.
// Must be used after `protect` so req.user is populated.
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden: insufficient role" });
  }
  next();
};

module.exports = { protect, requireRole };
