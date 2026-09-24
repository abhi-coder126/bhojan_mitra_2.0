const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const Branch = require("../models/Branch");
const { runWithBranch } = require("../utils/tenant");

const inactiveBranchMessage = (branch) =>
  branch?.status === "hold"
    ? "This branch is on hold. Please contact the head office."
    : "This branch is no longer active. Please contact the head office.";

// Verifies the JWT sent as `Authorization: Bearer <token>`, attaches req.user and
// req.branch, and runs the rest of the request inside that branch's data scope (see
// utils/tenant.js). Branch staff are always pinned to their own branch; only the
// master admin may pick a branch, via the `x-branch-id` header.
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
    const user = await User.findById(decoded.id).select("name email role branchId isActive").lean();
    if (!user || user.isActive === false) {
      return res.status(401).json({ message: "Not authorized, user no longer exists" });
    }

    const isMaster = user.role === "master_admin";
    let branch = null;

    if (isMaster) {
      const requested = String(req.headers["x-branch-id"] || "").trim();
      if (requested) {
        if (!mongoose.isValidObjectId(requested)) {
          return res.status(400).json({ message: "Invalid branch selected" });
        }
        branch = await Branch.findById(requested).lean();
        if (!branch) {
          return res.status(404).json({ message: "Selected branch not found", code: "BRANCH_NOT_FOUND" });
        }
      }
    } else {
      if (!user.branchId) {
        return res.status(403).json({
          message: "Your account is not linked to any branch. Please contact the head office.",
          code: "BRANCH_INACTIVE",
        });
      }
      branch = await Branch.findById(user.branchId).lean();
      if (!branch || branch.status !== "active") {
        return res.status(403).json({ message: inactiveBranchMessage(branch), code: "BRANCH_INACTIVE" });
      }
    }

    req.user = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      isMaster,
      branchId: branch ? String(branch._id) : null,
    };
    req.branch = branch;

    runWithBranch(branch?._id, next);
  } catch (error) {
    res.status(401).json({ message: "Not authorized" });
  }
};

// Role-gate helper: requireRole("owner", "manager") only allows those roles through.
// The master admin always passes. Must be used after `protect`.
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }
  if (!req.user.isMaster && !roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden: insufficient role" });
  }
  next();
};

const requireMaster = (req, res, next) => {
  if (!req.user?.isMaster) {
    return res.status(403).json({ message: "Only the master admin can do this" });
  }
  next();
};

// For branch-scoped routes: a master admin must have a branch selected first.
const requireBranch = (req, res, next) => {
  if (!req.user?.branchId) {
    return res.status(400).json({ message: "Select a branch first", code: "BRANCH_REQUIRED" });
  }
  next();
};

// The master admin can open a branch to view its data (dashboard, reports, etc.)
// but must never punch a bill or take a payment there -- billing stays with branch
// staff. Only blocks the master admin; branch staff and public QR orders pass through.
const denyMasterBilling = (req, res, next) => {
  if (req.user?.isMaster) {
    return res.status(403).json({ message: "Master admin cannot perform billing. Please use branch staff login." });
  }
  next();
};

module.exports = { protect, requireRole, requireMaster, requireBranch, denyMasterBilling, inactiveBranchMessage };
