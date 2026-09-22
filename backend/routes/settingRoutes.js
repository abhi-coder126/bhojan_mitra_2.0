const express = require("express");
const {
  getSettings,
  updateSettings,
} = require("../controllers/settingController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect);

router.get("/", getSettings);
router.put("/", updateSettings);

module.exports = router;