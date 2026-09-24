const express = require("express");
const { getPlatformSettings, updatePlatformSettings } = require("../controllers/platformController");
const { protect, requireMaster } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, getPlatformSettings);
router.put("/", protect, requireMaster, updatePlatformSettings);

module.exports = router;
