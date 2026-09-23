const express = require("express");
const {
  getMyProfile,
  upsertMyAddress,
  deleteMyAddress,
  getMyOrders,
  getMyRewards,
  scratchReward,
} = require("../controllers/customerProfileController");
const { customerSignup, customerLogin } = require("../controllers/customerPasswordAuthController");
const { protectCustomer } = require("../utils/customerAuth");

const router = express.Router();

// Public -- password-based signup/login alternative to the email-OTP flow.
router.post("/signup", customerSignup);
router.post("/login", customerLogin);

// Customer-session-authenticated (email-OTP or password login token), not the staff `protect`.
router.use(protectCustomer);

router.get("/me", getMyProfile);
router.get("/me/orders", getMyOrders);
router.post("/me/addresses", upsertMyAddress);
router.delete("/me/addresses/:index", deleteMyAddress);
router.get("/me/rewards", getMyRewards);
router.patch("/me/rewards/:id/scratch", scratchReward);

module.exports = router;
