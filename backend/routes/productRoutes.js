const express = require("express");
const {
  createProduct,
  getProducts,
  searchProducts,
  updateProduct,
  deleteProduct,
  clearProducts,
  bulkImportProducts,
  getProductImage,
} = require("../controllers/productController");
const { protect, requireRole, requireBranch } = require("../middleware/authMiddleware");

const router = express.Router();

// Public: the customer QR menu shows item pictures without a staff login.
router.get("/:id/image", getProductImage);

router.use(protect, requireBranch);

router.post("/", createProduct);
router.post("/bulk-import", bulkImportProducts);
router.get("/", getProducts);
router.get("/search", searchProducts);
// Wipes the entire product catalog -- restrict to the most trusted roles.
router.delete("/clear/all", requireRole("admin", "owner"), clearProducts);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

module.exports = router;
