const express = require("express");
const {
  getMyProfile,
  upsertMyAddress,
  deleteMyAddress,
  getMyOrders,
  getMyRewards,
  scratchReward,
} = require("../controllers/customerProfileController");
const { protectCustomer } = require("../utils/customerAuth");

const router = express.Router();

// Customer-session-authenticated (email-OTP login token), not the staff `protect`.
router.use(protectCustomer);

router.get("/me", getMyProfile);
router.get("/me/orders", getMyOrders);
router.post("/me/addresses", upsertMyAddress);
router.delete("/me/addresses/:index", deleteMyAddress);
router.get("/me/rewards", getMyRewards);
router.patch("/me/rewards/:id/scratch", scratchReward);

module.exports = router;
