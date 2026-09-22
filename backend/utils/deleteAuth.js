const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const verifyDeletePassword = async (req) => {
  const password = req.body?.password || req.query?.password;
  if (!password) {
    const error = new Error("Password required before deleting this record");
    error.statusCode = 401;
    throw error;
  }

  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) {
    const error = new Error("Login session required");
    error.statusCode = 401;
    throw error;
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).select("name password").lean();
  if (!user) {
    const error = new Error("Login user not found");
    error.statusCode = 401;
    throw error;
  }

  const match = await bcrypt.compare(String(password), user.password);
  if (!match) {
    const error = new Error("Incorrect password. Delete cancelled.");
    error.statusCode = 403;
    throw error;
  }

  return user;
};

module.exports = { verifyDeletePassword };
