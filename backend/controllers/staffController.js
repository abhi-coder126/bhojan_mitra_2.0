const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const RestaurantOrder = require("../models/RestaurantOrder");

// Branch staff a manager can create from Settings. Deliberately excludes admin,
// owner and master_admin: those are handed out by head office, not by a branch.
const MANAGEABLE_ROLES = ["captain", "waiter", "cashier", "kitchen", "inventory", "staff"];

// User is NOT branch-scoped by the mongoose plugin (it has to be readable before a
// branch context exists, at login), so every query here filters on branchId by hand.
const branchFilter = (req) => ({ branchId: req.user.branchId, role: { $in: MANAGEABLE_ROLES } });

const fail = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });

const sendError = (res, error) =>
  res.status(error.statusCode || 500).json({ message: error.message || "Something went wrong" });

const summary = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive !== false,
  createdAt: user.createdAt,
});

const readFields = (body, { requirePassword }) => {
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const role = String(body.role || "").trim();
  const password = String(body.password || "");

  if (name.length < 2) fail("Enter the staff member's name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Enter a valid email address");
  if (!MANAGEABLE_ROLES.includes(role)) fail("Choose a valid role for this staff member");
  if (requirePassword || password) {
    if (password.length < 6) fail("Password must be at least 6 characters");
  }

  return { name, email, role, password };
};

// Email is unique across the whole system, not just this branch.
const assertEmailFree = async (email, ignoreId) => {
  const clash = await User.findOne({ email, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) })
    .select("_id")
    .lean();
  if (clash) fail("That email is already in use");
};

// The staff member must belong to the caller's branch -- never another one's.
const findOwnStaff = async (req) => {
  if (!mongoose.isValidObjectId(req.params.id)) fail("Staff member not found", 404);
  const user = await User.findOne({ _id: req.params.id, ...branchFilter(req) });
  if (!user) fail("Staff member not found", 404);
  return user;
};

exports.listStaff = async (req, res) => {
  try {
    const staff = await User.find(branchFilter(req)).sort({ name: 1 }).lean();
    res.json({ staff: staff.map(summary), roles: MANAGEABLE_ROLES });
  } catch (error) {
    sendError(res, error);
  }
};

exports.createStaff = async (req, res) => {
  try {
    const fields = readFields(req.body, { requirePassword: true });
    await assertEmailFree(fields.email);

    const user = await User.create({
      name: fields.name,
      email: fields.email,
      password: await bcrypt.hash(fields.password, 10),
      role: fields.role,
      branchId: req.user.branchId,
    });

    res.status(201).json({ success: true, staff: summary(user) });
  } catch (error) {
    sendError(res, error);
  }
};

exports.updateStaff = async (req, res) => {
  try {
    const user = await findOwnStaff(req);
    const fields = readFields(req.body, { requirePassword: false });
    await assertEmailFree(fields.email, user._id);

    user.name = fields.name;
    user.email = fields.email;
    user.role = fields.role;
    // Blank means "leave the existing password alone".
    if (fields.password) user.password = await bcrypt.hash(fields.password, 10);
    await user.save();

    res.json({ success: true, staff: summary(user) });
  } catch (error) {
    sendError(res, error);
  }
};

// Deactivating is preferred over deleting: the orders they took keep their name,
// and protect() refuses the login immediately.
exports.setStaffActive = async (req, res) => {
  try {
    const user = await findOwnStaff(req);
    user.isActive = req.body.isActive !== false;
    await user.save();
    res.json({ success: true, staff: summary(user) });
  } catch (error) {
    sendError(res, error);
  }
};

exports.deleteStaff = async (req, res) => {
  try {
    const user = await findOwnStaff(req);
    await user.deleteOne();
    res.json({ success: true });
  } catch (error) {
    sendError(res, error);
  }
};

// ---------------------------------------------------------------------------
// Performance: how much business each captain/waiter actually brought in.
//
// Orders store takenById, so this is a straight group-by. Cancelled orders are
// counted separately rather than silently dropped -- a captain with many
// cancellations is exactly what a manager wants to see.
// ---------------------------------------------------------------------------
const dayRange = (query) => {
  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;
  if (to) to.setHours(23, 59, 59, 999);
  if ((from && !Number.isFinite(from.getTime())) || (to && !Number.isFinite(to.getTime()))) {
    fail("Enter valid dates");
  }
  if (!from && !to) return null;
  return { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
};

exports.staffPerformance = async (req, res) => {
  try {
    const createdAt = dayRange(req.query);
    const match = { takenById: { $ne: null }, ...(createdAt ? { createdAt } : {}) };

    const rows = await RestaurantOrder.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$takenById",
          name: { $last: "$takenByName" },
          orders: { $sum: 1 },
          cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
          // Only paid, non-cancelled orders count as business brought in.
          revenue: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$paymentStatus", "paid"] }, { $ne: ["$status", "cancelled"] }] },
                "$grandTotal",
                0,
              ],
            },
          },
          customers: { $addToSet: "$customerPhone" },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    const staff = await User.find(branchFilter(req)).select("name role isActive").lean();
    const byId = new Map(staff.map((s) => [String(s._id), s]));

    res.json({
      performance: rows.map((row) => {
        const person = byId.get(String(row._id));
        const completed = row.orders - row.cancelled;
        return {
          staffId: row._id,
          name: person?.name || row.name || "Removed staff",
          role: person?.role || "",
          isActive: person?.isActive !== false,
          orders: row.orders,
          cancelled: row.cancelled,
          revenue: Math.round(row.revenue * 100) / 100,
          averageBill: completed ? Math.round((row.revenue / completed) * 100) / 100 : 0,
          customers: row.customers.filter(Boolean).length,
        };
      }),
    });
  } catch (error) {
    sendError(res, error);
  }
};

// The signed-in captain/waiter's own numbers, for their personal screen.
exports.myPerformance = async (req, res) => {
  try {
    const createdAt = dayRange(req.query);
    const match = { takenById: req.user._id, ...(createdAt ? { createdAt } : {}) };

    const orders = await RestaurantOrder.find(match)
      .select("orderNo invoiceNo orderType tableNo status paymentStatus grandTotal customerName customerPhone createdAt")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const live = orders.filter((order) => order.status !== "cancelled");
    const paid = live.filter((order) => order.paymentStatus === "paid");
    const revenue = paid.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0);

    res.json({
      totals: {
        orders: orders.length,
        cancelled: orders.length - live.length,
        revenue: Math.round(revenue * 100) / 100,
        averageBill: paid.length ? Math.round((revenue / paid.length) * 100) / 100 : 0,
        customers: new Set(live.map((order) => order.customerPhone).filter(Boolean)).size,
      },
      orders,
    });
  } catch (error) {
    sendError(res, error);
  }
};

exports.MANAGEABLE_ROLES = MANAGEABLE_ROLES;
