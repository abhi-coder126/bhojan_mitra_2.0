const express = require("express");
const {
  createVendor,
  getVendors,
  updateVendor,
  deleteVendor,
  getVendorLedger,
} = require("../controllers/vendorController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect);

router.post("/", createVendor);
router.get("/", getVendors);
router.get("/:id/ledger", getVendorLedger);
router.put("/:id", updateVendor);
router.delete("/:id", deleteVendor);

module.exports = router;