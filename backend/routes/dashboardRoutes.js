const express = require("express");
const { getDashboard, getDeletionLogs, getAnalytics } = require("../controllers/dashboardController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect);

router.get("/", getDashboard);
router.get("/deletions", getDeletionLogs);
router.get("/analytics", getAnalytics);

module.exports = router;
