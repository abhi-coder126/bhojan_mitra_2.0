const express = require("express");
const { getDashboard, getDeletionLogs, getAnalytics, getRoyalty, getReviewSummary } = require("../controllers/dashboardController");
const { protect, requireBranch } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect, requireBranch);

router.get("/", getDashboard);
router.get("/deletions", getDeletionLogs);
router.get("/analytics", getAnalytics);
router.get("/royalty", getRoyalty);
router.get("/reviews", getReviewSummary);

module.exports = router;
