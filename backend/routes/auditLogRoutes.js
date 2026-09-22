const express = require("express");
const { getAuditLogs } = require("../controllers/auditLogController");
const { protect, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, requireRole("admin", "owner", "manager"), getAuditLogs);

module.exports = router;
