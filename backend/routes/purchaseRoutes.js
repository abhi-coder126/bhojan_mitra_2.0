const express = require("express");
const {
  createPurchase,
  getPurchases,
  getPurchaseById,
  updatePurchasePayment,
  fullUpdatePurchase,
} = require("../controllers/purchaseController");
const { protect, requireBranch } = require("../middleware/authMiddleware");
const router = express.Router();
router.use(protect, requireBranch);

router.post("/", createPurchase);
router.get("/", getPurchases);
router.get("/:id", getPurchaseById);
router.put("/:id/payment", updatePurchasePayment);
router.put("/:id/full-update", fullUpdatePurchase);
module.exports = router;