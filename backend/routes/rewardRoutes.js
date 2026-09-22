const express = require("express");
const {
  getRewardTiers,
  createRewardTier,
  updateRewardTier,
  deleteRewardTier,
  getIssuedRewards,
} = require("../controllers/rewardController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect);

router.get("/tiers", getRewardTiers);
router.post("/tiers", createRewardTier);
router.put("/tiers/:id", updateRewardTier);
router.delete("/tiers/:id", deleteRewardTier);
router.get("/issued", getIssuedRewards);

module.exports = router;
