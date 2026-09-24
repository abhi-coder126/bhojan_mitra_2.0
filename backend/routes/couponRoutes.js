const express = require("express");
const {
  createCoupon,
  getCoupons,
  applyCoupon,
  deleteCoupon,
} = require("../controllers/couponController");
const { protect, requireBranch } = require("../middleware/authMiddleware");
const { staffOrPublicBranch } = require("../middleware/branchContext");

const router = express.Router();

// Public: the customer-facing QR menu applies a coupon code at checkout unauthenticated;
// the staff POS uses it too, scoped to the staff member's own branch.
router.post("/apply", staffOrPublicBranch, applyCoupon);

router.post("/", protect, requireBranch, createCoupon);
router.get("/", protect, requireBranch, getCoupons);
router.delete("/:id", protect, requireBranch, deleteCoupon);

module.exports = router;