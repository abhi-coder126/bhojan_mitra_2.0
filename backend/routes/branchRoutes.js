const express = require("express");
const {
  getBranches,
  getBranchOptions,
  createBranch,
  updateBranch,
  setBranchStatus,
  archiveBranch,
  upsertBranchAdmin,
  getMyBranchProfile,
  createBranchChangeRequest,
  listBranchChangeRequests,
  reviewBranchChangeRequest,
} = require("../controllers/branchController");
const { protect, requireMaster, requireBranch, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect);

// A branch admin may view their own outlet's profile and ask head office to change
// it. Nothing here writes to the Branch record -- approval does that.
const branchManagers = requireRole("admin", "owner", "manager");
router.get("/profile", requireBranch, branchManagers, getMyBranchProfile);
router.post("/profile/request", requireBranch, branchManagers, createBranchChangeRequest);

// Everything below is head-office only.
router.use(requireMaster);

router.get("/change-requests", listBranchChangeRequests);
router.patch("/change-requests/:id", reviewBranchChangeRequest);

router.get("/", getBranches);
router.get("/options", getBranchOptions);
router.post("/", createBranch);
router.put("/:id", updateBranch);
router.patch("/:id/status", setBranchStatus);
router.put("/:id/admin", upsertBranchAdmin);
router.delete("/:id", archiveBranch);

module.exports = router;
