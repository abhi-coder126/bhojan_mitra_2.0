const express = require("express");
const {
  createCoupon,
  getCoupons,
  applyCoupon,
  deleteCoupon,
} = require("../controllers/couponController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Public: the customer-facing QR menu applies a coupon code at checkout unauthenticated.
router.post("/apply", applyCoupon);

router.post("/", protect, createCoupon);
router.get("/", protect, getCoupons);
router.delete("/:id", protect, deleteCoupon);

module.exports = router;