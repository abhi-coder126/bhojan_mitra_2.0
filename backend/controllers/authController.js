const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { logAudit, getClientIp } = require("../utils/auditLog");

exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const exist = await User.findOne({ email });
    if (exist) return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashed,
      role: "admin",
    });

    res.status(201).json({ success: true, user });
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
      .select("name email password role")
      .lean();
    if (!user) {
      await logAudit({ actor: email || "unknown", action: "login_failed", entity: "Auth", field: "Invalid email", ip, userAgent });
      return res.status(400).json({ message: "Invalid email" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      await logAudit({ actor: `${user.name} (${user.role})`, action: "login_failed", entity: "Auth", field: "Wrong password", ip, userAgent });
      return res.status(400).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { id: user._id, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    await logAudit({ actor: `${user.name} (${user.role})`, action: "login_success", entity: "Auth", ip, userAgent });

    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
