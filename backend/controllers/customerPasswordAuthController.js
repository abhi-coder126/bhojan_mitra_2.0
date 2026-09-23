const bcrypt = require("bcryptjs");
const Customer = require("../models/Customer");
const { signCustomerToken } = require("../utils/customerAuth");
const { normalizeContact, normalizeEmail, nextCustomerCrn } = require("../utils/customerUpsert");

const publicCustomer = (customer) => ({
  id: customer._id,
  crn: customer.crn,
  name: customer.name,
  contact: customer.contact,
  email: customer.email,
  addresses: customer.addresses || [],
  loyaltyPoints: customer.loyaltyPoints,
  totalVisits: customer.totalVisits,
});

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());

// Sets/creates a password for a customer identified by email + phone. If a
// Customer already exists (e.g. from a prior guest/OTP order) this attaches a
// password to that same record instead of creating a duplicate -- same
// matching rule as upsertCustomerFromOrder (phone first, then email).
exports.customerSignup = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const contact = normalizeContact(req.body.phone);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!name) return res.status(400).json({ message: "Name is required" });
    if (!contact || contact.length !== 10) return res.status(400).json({ message: "A valid 10-digit phone is required" });
    if (!isValidEmail(email)) return res.status(400).json({ message: "A valid email is required" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

    let customer = await Customer.findOne({ $or: [{ contact }, { email }] }).select("+password");

    if (customer && customer.password) {
      return res.status(400).json({ message: "An account already exists for this phone/email. Please log in instead." });
    }

    const hashed = await bcrypt.hash(password, 10);

    if (customer) {
      customer.name = name || customer.name;
      customer.email = email || customer.email;
      customer.password = hashed;
      await customer.save();
    } else {
      customer = await Customer.create({
        crn: await nextCustomerCrn(),
        name,
        contact,
        email,
        password: hashed,
        activeFrom: new Date(),
      });
    }

    const token = signCustomerToken(customer._id);
    res.status(201).json({ success: true, token, customer: publicCustomer(customer) });
  } catch (error) {
    res.status(500).json({ message: error.message || "Could not create account" });
  }
};

exports.customerLogin = async (req, res) => {
  try {
    const identifier = String(req.body.identifier || req.body.email || req.body.phone || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!identifier || !password) {
      return res.status(400).json({ message: "Email/phone and password are required" });
    }

    const customer = await Customer.findOne({
      $or: [{ email: identifier }, { contact: identifier }],
    }).select("+password");

    if (!customer || !customer.password) {
      return res.status(400).json({ message: "No password account found. Try logging in with email OTP instead." });
    }

    const match = await bcrypt.compare(password, customer.password);
    if (!match) return res.status(400).json({ message: "Incorrect password" });

    const token = signCustomerToken(customer._id);
    res.json({ success: true, token, customer: publicCustomer(customer) });
  } catch (error) {
    res.status(500).json({ message: error.message || "Could not log in" });
  }
};
