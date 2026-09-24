const express = require("express");
const {
  getRawMaterials,
  createRawMaterial,
  updateRawMaterial,
  deleteRawMaterial,
  recordMovement,
  getLedger,
  getSummary,
  getLowStockAlerts,
} = require("../controllers/rawMaterialController");
const { protect, requireBranch } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect, requireBranch);

router.get("/", getRawMaterials);
router.post("/", createRawMaterial);
router.get("/alerts/low-stock", getLowStockAlerts);
router.get("/ledger", getLedger);
router.get("/summary", getSummary);
router.put("/:id", updateRawMaterial);
router.post("/:id/movements", recordMovement);
router.delete("/:id", deleteRawMaterial);

module.exports = router;
