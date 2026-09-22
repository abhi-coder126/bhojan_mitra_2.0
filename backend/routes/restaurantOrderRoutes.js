const express = require("express");
const {
  createRestaurantOrder,
  getRestaurantOrderById,
  getMenuProducts,
  getRestaurantOrders,
  markRestaurantOrderPaid,
  updateRestaurantOrderStatus,
  deleteRestaurantOrder,
  clearRestaurantOrders,
  sendKOT,
  updateOrderItemStatus,
  getKitchenOrders,
  holdRestaurantOrder,
  resumeRestaurantOrder,
  mergeRestaurantOrders,
  splitRestaurantOrder,
  applyRestaurantOrderDiscount,
} = require("../controllers/restaurantOrderController");
const { protect, requireRole } = require("../middleware/authMiddleware");
const { attachCustomerIfPresent } = require("../utils/customerAuth");

const router = express.Router();

// Public: used unauthenticated by the customer-facing QR menu (CustomerMenu.jsx) --
// browsing the menu, placing an order, and polling that order's own status.
// attachCustomerIfPresent links the order to a logged-in customer's account when
// they sent a customer token, but never blocks a guest checkout.
router.get("/menu", getMenuProducts);
router.post("/", attachCustomerIfPresent, createRestaurantOrder);
router.get("/:id", getRestaurantOrderById);

// Everything else is staff-only.
router.get("/", protect, getRestaurantOrders);
router.get("/kitchen/live", protect, getKitchenOrders);
router.post("/merge", protect, mergeRestaurantOrders);
// Wipes the entire order history -- restrict to the most trusted roles.
router.delete("/clear/all", protect, requireRole("admin", "owner"), clearRestaurantOrders);
router.patch("/:id/status", protect, updateRestaurantOrderStatus);
router.patch("/:id/payment", protect, markRestaurantOrderPaid);
router.patch("/:id/kot", protect, sendKOT);
router.patch("/:id/item-status", protect, updateOrderItemStatus);
router.patch("/:id/hold", protect, holdRestaurantOrder);
router.patch("/:id/resume", protect, resumeRestaurantOrder);
router.post("/:id/split", protect, splitRestaurantOrder);
router.patch("/:id/discount", protect, applyRestaurantOrderDiscount);
router.delete("/:id", protect, deleteRestaurantOrder);

module.exports = router;
