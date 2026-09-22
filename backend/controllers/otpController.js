const Otp = require("../models/Otp");
const { sendOtpEmail } = require("../utils/mailer");
const { upsertCustomerFromOrder } = require("../utils/customerUpsert");
const { signCustomerToken } = require("../utils/customerAuth");

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 45 * 1000; // 45 seconds
const MAX_ATTEMPTS = 5;

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());

const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));

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

// A verified email OTP doubles as a passwordless login when the customer also gave
// their name + phone (always true from the delivery checkout form) -- upserts their
// account and issues a customer session token the frontend can reuse next visit.
const loginCustomer = async ({ name, phone, email }) => {
  if (!phone) return null;

  const customer = await upsertCustomerFromOrder({
    customerName: name,
    customerPhone: phone,
    customerEmail: email,
  });
  if (!customer) return null;

  return { token: signCustomerToken(customer._id), customer: publicCustomer(customer) };
};

exports.sendEmailOtp = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "A valid email is required" });
    }

    const recent = await Otp.findOne({ identifier: email, purpose: "delivery-order" }).sort({ createdAt: -1 });
    if (recent && Date.now() - new Date(recent.createdAt).getTime() < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - new Date(recent.createdAt).getTime())) / 1000);
      return res.status(429).json({ message: `Please wait ${waitSeconds}s before requesting another OTP` });
    }

    const code = generateCode();

    // Only one active OTP per email+purpose at a time.
    await Otp.deleteMany({ identifier: email, purpose: "delivery-order" });
    await Otp.create({
      identifier: email,
      code,
      purpose: "delivery-order",
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    await sendOtpEmail(email, code);

    res.json({ success: true, message: "OTP sent to your email" });
  } catch (error) {
    res.status(500).json({ message: error.message || "Could not send OTP" });
  }
};

exports.verifyEmailOtp = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const code = String(req.body.code || "").trim();
    const name = String(req.body.name || "").trim();
    const phone = String(req.body.phone || "").trim();

    if (!isValidEmail(email) || !code) {
      return res.status(400).json({ message: "Email and OTP code are required" });
    }

    const record = await Otp.findOne({ identifier: email, purpose: "delivery-order" }).sort({ createdAt: -1 });

    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ message: "OTP expired or not requested. Please request a new one." });
    }

    if (record.verified) {
      const login = await loginCustomer({ name, phone, email });
      return res.json({ success: true, message: "Email already verified", ...login });
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      return res.status(429).json({ message: "Too many incorrect attempts. Please request a new OTP." });
    }

    if (record.code !== code) {
      record.attempts += 1;
      await record.save();
      return res.status(400).json({ message: "Incorrect OTP" });
    }

    record.verified = true;
    await record.save();

    const login = await loginCustomer({ name, phone, email });

    res.json({ success: true, message: "Email verified", ...login });
  } catch (error) {
    res.status(500).json({ message: error.message || "Could not verify OTP" });
  }
};
