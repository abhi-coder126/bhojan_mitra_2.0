const express = require("express");
const { login, registerAdmin } = require("../controllers/authController");

const router = express.Router();

router.post("/register", registerAdmin);
router.post("/login", login);

module.exports = router;