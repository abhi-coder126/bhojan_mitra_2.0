const express = require("express");
const { sendEmailOtp, verifyEmailOtp } = require("../controllers/otpController");

const router = express.Router();

// Public: used unauthenticated by the customer-facing QR menu to verify a
// delivery order's email before the order is allowed to be placed.
router.post("/email/send", sendEmailOtp);
router.post("/email/verify", verifyEmailOtp);

module.exports = router;
