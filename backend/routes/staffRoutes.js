const express = require("express");
const {
  listStaff,
  createStaff,
  updateStaff,
  setStaffActive,
  deleteStaff,
  staffPerformance,
  myPerformance,
} = require("../controllers/staffController");
const { protect, requireRole, requireBranch } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, requireBranch);

// A captain/waiter can always see their own numbers, whatever their role.
router.get("/me/performance", myPerformance);

// Everything else is for whoever runs the outlet.
const canManage = requireRole("admin", "owner", "manager");

router.get("/", canManage, listStaff);
router.get("/performance", canManage, staffPerformance);
router.post("/", canManage, createStaff);
router.put("/:id", canManage, updateStaff);
router.patch("/:id/active", canManage, setStaffActive);
router.delete("/:id", canManage, deleteStaff);

module.exports = router;
