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
  rateOrderItems,
} = require("../controllers/restaurantOrderController");
const { protect, requireRole, requireBranch, denyMasterBilling } = require("../middleware/authMiddleware");
const { attachCustomerIfPresent } = require("../utils/customerAuth");
const { publicBranch, staffOrPublicBranch, unscopedContext } = require("../middleware/branchContext");

const router = express.Router();

// Public: used unauthenticated by the customer-facing QR menu (CustomerMenu.jsx) --
// browsing the menu, placing an order, and polling that order's own status.
// publicBranch resolves the outlet from the QR code (x-branch-code header) so an
// order can only ever be placed against that branch's own menu, stock and tables.
// attachCustomerIfPresent links the order to a logged-in customer's account when
// they sent a customer token, but never blocks a guest checkout.
router.get("/menu", publicBranch, getMenuProducts);
// Shared with the staff POS: a staff token places the order in the staff member's branch.
router.post("/", staffOrPublicBranch, denyMasterBilling, attachCustomerIfPresent, createRestaurantOrder);
router.get("/:id", unscopedContext, getRestaurantOrderById);
router.post("/:id/rate", unscopedContext, rateOrderItems);

// Everything else is staff-only. Counter staff run the order (accept, KOT, serve,
// bill); the kitchen only moves sent KOTs through cooking -> ready.
const counterRoles = requireRole("admin", "owner", "manager", "staff", "cashier", "waiter");
const kitchenRoles = requireRole("admin", "owner", "manager", "staff", "kitchen");

router.get("/", protect, requireBranch, getRestaurantOrders);
router.get("/kitchen/live", protect, requireBranch, getKitchenOrders);
router.post("/merge", protect, requireBranch, mergeRestaurantOrders);
// Wipes the entire order history -- restrict to the most trusted roles.
router.delete("/clear/all", protect, requireBranch, requireRole("admin", "owner"), clearRestaurantOrders);
router.patch("/:id/status", protect, requireBranch, counterRoles, updateRestaurantOrderStatus);
router.patch("/:id/payment", protect, requireBranch, denyMasterBilling, counterRoles, markRestaurantOrderPaid);
router.patch("/:id/kot", protect, requireBranch, counterRoles, sendKOT);
router.patch("/:id/item-status", protect, requireBranch, kitchenRoles, updateOrderItemStatus);
router.patch("/:id/hold", protect, requireBranch, holdRestaurantOrder);
router.patch("/:id/resume", protect, requireBranch, resumeRestaurantOrder);
router.post("/:id/split", protect, requireBranch, splitRestaurantOrder);
router.patch("/:id/discount", protect, requireBranch, applyRestaurantOrderDiscount);
router.delete("/:id", protect, requireBranch, deleteRestaurantOrder);

module.exports = router;
