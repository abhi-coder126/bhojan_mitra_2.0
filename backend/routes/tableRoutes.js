const express = require("express");
const {
  getTables,
  createTable,
  updateTable,
  updateTableStatus,
  deleteTable,
  seedTables,
} = require("../controllers/tableController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect);

router.get("/", getTables);
router.post("/", createTable);
router.post("/seed", seedTables);
router.put("/:id", updateTable);
router.patch("/:id/status", updateTableStatus);
router.delete("/:id", deleteTable);

module.exports = router;
