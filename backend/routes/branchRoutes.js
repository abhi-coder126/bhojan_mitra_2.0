const express = require("express");
const { createBranch, getBranches, updateBranch, deleteBranch } = require("../controllers/branchController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect);

router.post("/", createBranch);
router.get("/", getBranches);
router.put("/:id", updateBranch);
router.delete("/:id", deleteBranch);

module.exports = router;
