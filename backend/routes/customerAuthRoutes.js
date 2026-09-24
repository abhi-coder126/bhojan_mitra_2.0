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
const { unscopedContext } = require("../middleware/branchContext");

const router = express.Router();

// Public -- password-based signup/login alternative to the email-OTP flow.
router.post("/signup", customerSignup);
router.post("/login", customerLogin);

// Customer-session-authenticated (email-OTP or password login token), not the staff `protect`.
// A customer account spans branches: their order history and rewards are filtered by
// their own customerId, not by branch.
router.use(protectCustomer, unscopedContext);

router.get("/me", getMyProfile);
router.get("/me/orders", getMyOrders);
router.post("/me/addresses", upsertMyAddress);
router.delete("/me/addresses/:index", deleteMyAddress);
router.get("/me/rewards", getMyRewards);
router.patch("/me/rewards/:id/scratch", scratchReward);

module.exports = router;
