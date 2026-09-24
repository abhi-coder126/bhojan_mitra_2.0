const express = require("express");
const {
  getBranches,
  getBranchOptions,
  createBranch,
  updateBranch,
  setBranchStatus,
  archiveBranch,
  upsertBranchAdmin,
} = require("../controllers/branchController");
const { protect, requireMaster } = require("../middleware/authMiddleware");

const router = express.Router();

// Branch management is head-office only.
router.use(protect, requireMaster);

router.get("/", getBranches);
router.get("/options", getBranchOptions);
router.post("/", createBranch);
router.put("/:id", updateBranch);
router.patch("/:id/status", setBranchStatus);
router.put("/:id/admin", upsertBranchAdmin);
router.delete("/:id", archiveBranch);

module.exports = router;
