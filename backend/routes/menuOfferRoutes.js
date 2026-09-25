const express = require("express");
const {
  listMenuOffers,
  createMenuOffer,
  updateMenuOffer,
  deleteMenuOffer,
} = require("../controllers/menuOfferController");
const { protect, requireRole, requireBranch } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, requireBranch);

const canManage = requireRole("admin", "owner", "manager");

router.get("/", listMenuOffers);
router.post("/", canManage, createMenuOffer);
router.put("/:id", canManage, updateMenuOffer);
router.delete("/:id", canManage, deleteMenuOffer);

module.exports = router;
