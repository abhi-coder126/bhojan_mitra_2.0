const express = require("express");
const {
  getRawMaterials,
  createRawMaterial,
  updateRawMaterial,
  deleteRawMaterial,
  adjustStock,
  getLowStockAlerts,
} = require("../controllers/rawMaterialController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect);

router.get("/", getRawMaterials);
router.post("/", createRawMaterial);
router.get("/alerts/low-stock", getLowStockAlerts);
router.put("/:id", updateRawMaterial);
router.patch("/:id/adjust", adjustStock);
router.delete("/:id", deleteRawMaterial);

module.exports = router;
