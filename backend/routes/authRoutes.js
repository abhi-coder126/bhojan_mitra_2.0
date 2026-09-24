const express = require("express");
const { login, registerAdmin, changePassword, getMe } = require("../controllers/authController");
const { protect, requireMaster } = require("../middleware/authMiddleware");

const router = express.Router();

// Was public -- anyone could create an admin login. Head office only now.
router.post("/register", protect, requireMaster, registerAdmin);
router.post("/login", login);
router.put("/change-password", protect, changePassword);
router.get("/me", protect, getMe);

module.exports = router;