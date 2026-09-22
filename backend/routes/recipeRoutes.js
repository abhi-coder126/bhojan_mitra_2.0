const express = require("express");
const {
  getRecipes,
  getRecipeByProduct,
  upsertRecipe,
  deleteRecipe,
  getFoodCost,
} = require("../controllers/recipeController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect);

router.get("/", getRecipes);
router.get("/food-cost", getFoodCost);
router.get("/product/:productId", getRecipeByProduct);
router.post("/", upsertRecipe);
router.delete("/:id", deleteRecipe);

module.exports = router;
