const jwt = require("jsonwebtoken");
const Customer = require("../models/Customer");

const CUSTOMER_TOKEN_TTL = "60d";

// Separate from the staff JWT (authMiddleware.js) -- a lighter-weight,
// passwordless session for QR-menu customers, established via email OTP.
const signCustomerToken = (customerId) =>
  jwt.sign({ id: String(customerId), type: "customer" }, process.env.JWT_SECRET, { expiresIn: CUSTOMER_TOKEN_TTL });

// Required customer auth: rejects the request if there's no valid customer token.
const protectCustomer = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
    if (!token) return res.status(401).json({ message: "Please log in first" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== "customer") return res.status(401).json({ message: "Invalid session" });

    const customer = await Customer.findById(decoded.id);
    if (!customer) return res.status(401).json({ message: "Account not found" });

    req.customer = customer;
    next();
  } catch {
    res.status(401).json({ message: "Session expired, please log in again" });
  }
};

// Optional customer auth: used on the public order-creation endpoint so a logged-in
// customer's order gets linked to their account, but a guest can still check out.
const attachCustomerIfPresent = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== "customer") return next();

    const customer = await Customer.findById(decoded.id);
    if (customer) req.customer = customer;
  } catch {
    // Invalid/expired token on this optional path -- just proceed as a guest.
  }
  next();
};

module.exports = { signCustomerToken, protectCustomer, attachCustomerIfPresent };
