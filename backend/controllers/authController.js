const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Branch = require("../models/Branch");
const { inactiveBranchMessage } = require("../middleware/authMiddleware");
const { logAudit, getClientIp } = require("../utils/auditLog");

const BRANCH_ROLES = ["admin", "staff", "owner", "manager", "cashier", "waiter", "kitchen", "inventory"];

// Master-admin only (see authRoutes): creates a staff login inside a branch. Branch
// admins themselves are normally created from Branch Management.
exports.registerAdmin = async (req, res) => {
  try {
    const { name, password } = req.body;
    const email = String(req.body.email || "").trim().toLowerCase();
    const role = req.body.role || "admin";

    if (!name || !email || String(password || "").length < 8) {
      return res.status(400).json({ message: "Name, email and a password of at least 8 characters are required" });
    }
    if (!BRANCH_ROLES.includes(role)) return res.status(400).json({ message: "Invalid role" });

    const branch = await Branch.findById(req.body.branchId).select("_id").lean().catch(() => null);
    if (!branch) return res.status(400).json({ message: "A valid branch is required" });

    const exist = await User.findOne({ email });
    if (exist) return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({ name, email, password: hashed, role, branchId: branch._id });

    res.status(201).json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, branchId: user.branchId },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required" });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.user.id).select("password name role");
    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ message: "Current password is incorrect" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    await logAudit({
      actor: `${user.name} (${user.role})`,
      action: "password_changed",
      entity: "Auth",
      ip: getClientIp(req),
      userAgent: req.headers["user-agent"] || "",
    });

    res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  const ip = getClientIp(req);
  const userAgent = req.headers["user-agent"] || "";

  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const { password } = req.body;

    const user = await User.findOne({ email })
      .select("name email password role branchId isActive")
      .lean();
    if (!user || user.isActive === false) {
      await logAudit({ actor: email || "unknown", action: "login_failed", entity: "Auth", field: "Invalid email", ip, userAgent });
      return res.status(400).json({ message: "Invalid email" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      await logAudit({ actor: `${user.name} (${user.role})`, action: "login_failed", entity: "Auth", field: "Wrong password", ip, userAgent, branchId: user.branchId });
      return res.status(400).json({ message: "Invalid password" });
    }

    const isMaster = user.role === "master_admin";
    let branch = null;
    if (!isMaster) {
      branch = user.branchId ? await Branch.findById(user.branchId).lean() : null;
      if (!branch || branch.status !== "active") {
        await logAudit({ actor: `${user.name} (${user.role})`, action: "login_failed", entity: "Auth", field: "Branch not active", ip, userAgent, branchId: user.branchId });
        return res.status(403).json({
          message: user.branchId
            ? inactiveBranchMessage(branch)
            : "Your account is not linked to any branch. Please contact the head office.",
          code: "BRANCH_INACTIVE",
        });
      }
    }

    const token = jwt.sign(
      { id: user._id, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    await logAudit({ actor: `${user.name} (${user.role})`, action: "login_success", entity: "Auth", ip, userAgent, branchId: user.branchId });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isMaster,
        branch: branch ? { id: branch._id, name: branch.name, code: branch.code } : null,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /auth/me -- refreshes the saved session (role, branch name/code) so the UI
// reflects changes made by head office since login.
exports.getMe = async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      isMaster: req.user.isMaster,
      branch:
        !req.user.isMaster && req.branch
          ? { id: req.branch._id, name: req.branch.name, code: req.branch.code }
          : null,
    },
  });
};
