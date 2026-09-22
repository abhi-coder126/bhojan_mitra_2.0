const express = require("express");
const { login, registerAdmin, changePassword } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerAdmin);
router.post("/login", login);
router.put("/change-password", protect, changePassword);

module.exports = router;