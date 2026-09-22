const express = require("express");
const {
  createProduct,
  getProducts,
  searchProducts,
  updateProduct,
  deleteProduct,
  clearProducts,
  bulkImportProducts,
} = require("../controllers/productController");
const { protect, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect);

router.post("/", createProduct);
router.post("/bulk-import", bulkImportProducts);
router.get("/", getProducts);
router.get("/search", searchProducts);
// Wipes the entire product catalog -- restrict to the most trusted roles.
router.delete("/clear/all", requireRole("admin", "owner"), clearProducts);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

module.exports = router;
