const Customer = require("../models/Customer");
const Counter = require("../models/Counter");
const { currentBranchId } = require("./tenant");

const normalizeContact = (value) => String(value || "").trim();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

// Customers are one chain-wide record (the phone number is globally unique), so
// Customer is deliberately NOT branch-scoped by the tenant plugin -- lookups by
// phone/email must see every branch or a returning customer would collide with
// their own record. Branch visibility is tracked in `branchIds` instead.
const customerBranchFilter = () => {
  const branchId = currentBranchId();
  return branchId ? { branchIds: branchId } : {};
};

// Records that the customer has dealt with the current branch, so they show up in
// that branch's customer list.
const tagCustomerWithCurrentBranch = async (customerId) => {
  const branchId = currentBranchId();
  if (!branchId || !customerId) return;
  await Customer.updateOne({ _id: customerId }, { $addToSet: { branchIds: branchId } });
};

// Atomic sequence via Counter, not Customer.countDocuments() -- a count-based id
// collides the moment any customer is ever deleted (count drops below the highest
// CRN already issued) or two signups race each other.
const nextCustomerCrn = async () => {
  const existingCounter = await Counter.findById("customer");

  if (!existingCounter) {
    // First time this sequence is used -- bootstrap it from the highest CRN already
    // issued (rather than 0) so it can't hand out a number that collides with data
    // from before this Counter existed.
    const [highest] = await Customer.aggregate([
      { $match: { crn: /^CRN_\d+$/ } },
      { $project: { seq: { $toInt: { $arrayElemAt: [{ $split: ["$crn", "_"] }, 1] } } } },
      { $sort: { seq: -1 } },
      { $limit: 1 },
    ]);
    await Counter.updateOne({ _id: "customer" }, { $max: { seq: Number(highest?.seq || 0) } }, { upsert: true });
  }

  const counter = await Counter.findByIdAndUpdate("customer", { $inc: { seq: 1 } }, { new: true, upsert: true });
  return `CRN_${String(counter.seq).padStart(3, "0")}`;
};

// Shared by the restaurant-order flow and the customer email-OTP login flow so a
// customer looked up/created here is the same record either way (matched by phone,
// falling back to email).
const upsertCustomerFromOrder = async ({ customerName, customerPhone, customerEmail, deliveryAddress }) => {
  const contact = normalizeContact(customerPhone);
  if (!contact) return null;

  const email = normalizeEmail(customerEmail);
  const existing = await Customer.findOne({
    $or: [{ contact }, ...(email ? [{ email }] : [])],
  }).sort({ createdAt: 1 });

  if (existing) {
    existing.name = customerName || existing.name;
    existing.contact = existing.contact || contact;
    existing.email = email || existing.email || "";
    existing.address = deliveryAddress || existing.address || "";
    const branchId = currentBranchId();
    if (branchId) existing.branchIds.addToSet(branchId);
    await existing.save();
    return existing;
  }

  const branchId = currentBranchId();
  return Customer.create({
    crn: await nextCustomerCrn(),
    name: customerName,
    contact,
    email,
    address: deliveryAddress || "",
    branchIds: branchId ? [branchId] : [],
    activeFrom: new Date(),
  });
};

module.exports = {
  upsertCustomerFromOrder,
  normalizeContact,
  normalizeEmail,
  nextCustomerCrn,
  customerBranchFilter,
  tagCustomerWithCurrentBranch,
};
