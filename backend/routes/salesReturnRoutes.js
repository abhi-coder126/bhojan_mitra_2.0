const express = require("express");

const {
  getSalesReturns,
  getInvoiceForReturn,
  createSalesReturn,
  deleteSalesReturn,
} = require("../controllers/salesReturnController");
const { protect, requireBranch } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect, requireBranch);

router.get("/", getSalesReturns);
router.get("/invoice/:invoiceNo", getInvoiceForReturn);
router.post("/", createSalesReturn);
router.delete("/:id", deleteSalesReturn);

module.exports = router;
