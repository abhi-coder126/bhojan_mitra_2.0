const express = require("express");
const {
  createPurchase,
  getPurchases,
  getPurchaseById,
  updatePurchasePayment,
  fullUpdatePurchase,
} = require("../controllers/purchaseController");
const { protect } = require("../middleware/authMiddleware");
const router = express.Router();
router.use(protect);

router.post("/", createPurchase);
router.get("/", getPurchases);
router.get("/:id", getPurchaseById);
router.put("/:id/payment", updatePurchasePayment);
router.put("/:id/full-update", fullUpdatePurchase);
module.exports = router;