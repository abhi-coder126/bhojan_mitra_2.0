const express = require("express");
const router = express.Router();

const {
  createSale,
  getSales,
  getLatestSale,
  deleteSale,
  clearSales,
} = require("../controllers/saleController");
const { protect, requireRole } = require("../middleware/authMiddleware");
router.use(protect);

router.post("/", createSale);
router.get("/", getSales);
router.get("/latest", getLatestSale);
// Wipes the entire sales history -- restrict to the most trusted roles.
router.delete("/clear/all", requireRole("admin", "owner"), clearSales);
router.delete("/:id", deleteSale);

module.exports = router;
