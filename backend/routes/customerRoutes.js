const express = require("express");
const {
    createCustomer,
    getCustomers,
    updateCustomer,
    getCustomerHistory,
    deleteCustomer,
    searchCustomer,
    redeemLoyaltyPoints,
    getCustomerSegments,
} = require("../controllers/customerController");
const { protect, requireBranch } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect, requireBranch);

router.post("/", createCustomer);
router.get("/search/customer", searchCustomer);
router.get("/segments", getCustomerSegments);
router.get("/", getCustomers);
router.get("/:id/history", getCustomerHistory);
router.put("/:id", updateCustomer);
router.patch("/:id/redeem-points", redeemLoyaltyPoints);

router.delete("/:id", deleteCustomer);
module.exports = router;