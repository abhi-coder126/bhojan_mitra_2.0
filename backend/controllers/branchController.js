const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Branch = require("../models/Branch");
const User = require("../models/User");
const Setting = require("../models/Setting");
const PlatformSetting = require("../models/PlatformSetting");
const { ROYALTY_BASES } = require("../models/Branch");
const { runWithBranch } = require("../utils/tenant");
const { PERIODS, periodRange, revenueByBranch, royaltyFor } = require("../utils/royalty");
const { verifyDeletePassword } = require("../utils/deleteAuth");
const { logAudit, getActor, getClientIp } = require("../utils/auditLog");

const MIN_PASSWORD_LENGTH = 8;
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
const clean = (value) => String(value ?? "").trim();

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const sendError = (res, error) =>
  res.status(error.statusCode || 500).json({ success: false, message: error.message });

// Validates the fields the master admin may edit on a branch. `partial` skips
// required checks for fields absent from an update.
const readBranchFields = (body, { partial = false } = {}) => {
  const fields = {};
  const has = (key) => body[key] !== undefined;

  if (!partial || has("name")) {
    fields.name = clean(body.name);
    if (!fields.name) throw badRequest("Branch name is required");
  }
  ["address", "city", "phone", "gstNumber"].forEach((key) => {
    if (has(key)) fields[key] = clean(body[key]);
  });
  if (has("email")) {
    fields.email = clean(body.email).toLowerCase();
    if (fields.email && !isValidEmail(fields.email)) throw badRequest("Branch email is not valid");
  }
  if (!partial || has("royaltyPercent")) {
    const percent = Number(body.royaltyPercent ?? 0);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      throw badRequest("Royalty % must be between 0 and 100");
    }
    fields.royaltyPercent = Math.round(percent * 100) / 100;
  }
  if (!partial || has("royaltyBase")) {
    fields.royaltyBase = body.royaltyBase || "net_ex_gst";
    if (!ROYALTY_BASES[fields.royaltyBase]) throw badRequest("Choose a valid royalty base");
  }
  return fields;
};

const readAdminFields = (admin = {}, { requirePassword }) => {
  const fields = { name: clean(admin.name), email: clean(admin.email).toLowerCase() };
  if (!fields.name) throw badRequest("Branch admin name is required");
  if (!isValidEmail(fields.email)) throw badRequest("Branch admin email is not valid");

  const password = String(admin.password || "");
  if (requirePassword || password) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw badRequest(`Branch admin password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    fields.password = password;
  }
  return fields;
};

const assertEmailFree = async (email, exceptUserId) => {
  const existing = await User.findOne({ email }).select("_id").lean();
  if (existing && String(existing._id) !== String(exceptUserId || "")) {
    throw badRequest("A login with this email already exists");
  }
};

const findBranch = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw badRequest("Invalid branch id");
  const branch = await Branch.findById(id);
  if (!branch) {
    const error = new Error("Branch not found");
    error.statusCode = 404;
    throw error;
  }
  return branch;
};

const audit = (req, action, branch, extra = {}) =>
  logAudit({
    actor: getActor(req),
    action,
    entity: "Branch",
    entityId: branch._id,
    field: extra.field || "",
    oldValue: extra.oldValue,
    newValue: extra.newValue ?? branch.name,
    ip: getClientIp(req),
    userAgent: req.headers["user-agent"] || "",
  });

const adminSummary = (user) => (user ? { id: user._id, name: user.name, email: user.email } : null);

// GET /branches -- every branch with its sales and royalty for the chosen period.
exports.getBranches = async (req, res) => {
  try {
    const period = PERIODS.includes(req.query.period) ? req.query.period : "month";
    const range = periodRange(period, req.query.startDate, req.query.endDate);
    const includeArchived = req.query.includeArchived === "true";

    const branches = await Branch.find(includeArchived ? {} : { status: { $ne: "archived" } })
      .sort({ isDefault: -1, createdAt: 1 })
      .lean();

    const admins = await User.find({ _id: { $in: branches.map((b) => b.adminUserId).filter(Boolean) } })
      .select("name email")
      .lean();
    const adminMap = new Map(admins.map((user) => [String(user._id), user]));

    const revenue = await revenueByBranch(branches.map((b) => b._id), range);

    const rows = branches.map((branch) => {
      const sales = revenue.get(String(branch._id));
      return {
        ...branch,
        admin: adminSummary(adminMap.get(String(branch.adminUserId))),
        sales,
        royalty: royaltyFor(branch, sales),
      };
    });

    const live = rows.filter((row) => row.status !== "archived");
    const sum = (pick) => Math.round(live.reduce((total, row) => total + Number(pick(row) || 0), 0) * 100) / 100;

    res.json({
      success: true,
      period: { key: period, start: range.start, end: range.end },
      royaltyBases: ROYALTY_BASES,
      totals: {
        branches: live.length,
        active: rows.filter((row) => row.status === "active").length,
        hold: rows.filter((row) => row.status === "hold").length,
        archived: rows.filter((row) => row.status === "archived").length,
        bills: sum((row) => row.sales.bills),
        grossIncGst: sum((row) => row.sales.grossIncGst),
        netExGst: sum((row) => row.sales.netExGst),
        royalty: sum((row) => row.royalty.amount),
      },
      branches: rows,
    });
  } catch (error) {
    sendError(res, error);
  }
};

// GET /branches/options -- lightweight list for the master admin's branch switcher.
exports.getBranchOptions = async (req, res) => {
  try {
    const branches = await Branch.find({ status: { $ne: "archived" } })
      .select("name code status isDefault")
      .sort({ isDefault: -1, name: 1 })
      .lean();
    res.json({ success: true, branches });
  } catch (error) {
    sendError(res, error);
  }
};

// POST /branches -- creates the branch, its admin login and its own settings.
exports.createBranch = async (req, res) => {
  let branch = null;
  let adminUser = null;

  try {
    const platform = await PlatformSetting.get();
    if (!platform.multiBranchEnabled) {
      throw badRequest("Turn on Manage Branches in Settings before adding a branch");
    }

    const fields = readBranchFields(req.body);
    const code = clean(req.body.code).toUpperCase();
    if (!/^[A-Z0-9]{2,10}$/.test(code)) {
      throw badRequest("Branch code must be 2-10 letters/numbers, e.g. DLH01");
    }
    if (await Branch.exists({ code })) throw badRequest(`Branch code ${code} is already in use`);

    const admin = readAdminFields(req.body.admin, { requirePassword: true });
    await assertEmailFree(admin.email);

    branch = await Branch.create({ ...fields, code, status: "active", statusChangedAt: new Date() });

    adminUser = await User.create({
      name: admin.name,
      email: admin.email,
      password: await bcrypt.hash(admin.password, 10),
      role: "admin",
      branchId: branch._id,
    });

    branch.adminUserId = adminUser._id;
    await branch.save();

    // Each branch prints its own name/address/GST on its invoices.
    await runWithBranch(branch._id, () =>
      Setting.create({
        storeName: branch.name,
        storeShortName: branch.code,
        storeAddress: [branch.address, branch.city].filter(Boolean).join(", "),
        storeContact: branch.phone,
        storeEmail: branch.email,
        gstNumber: branch.gstNumber,
      })
    );

    await audit(req, "branch_created", branch);

    res.status(201).json({ success: true, branch: { ...branch.toObject(), admin: adminSummary(adminUser) } });
  } catch (error) {
    // Undo a half-created branch so a retry with the same code/email works.
    if (branch) {
      await runWithBranch(branch._id, () => Setting.deleteMany({})).catch(() => {});
      await Branch.deleteOne({ _id: branch._id }).catch(() => {});
    }
    if (adminUser) await User.deleteOne({ _id: adminUser._id }).catch(() => {});
    sendError(res, error);
  }
};

// PUT /branches/:id -- details and royalty terms. The code is fixed once created
// (printed QRs depend on it) and status has its own endpoint.
exports.updateBranch = async (req, res) => {
  try {
    const branch = await findBranch(req.params.id);
    const fields = readBranchFields(req.body, { partial: true });
    const before = { royaltyPercent: branch.royaltyPercent, royaltyBase: branch.royaltyBase };

    Object.assign(branch, fields);
    await branch.save();

    if (before.royaltyPercent !== branch.royaltyPercent || before.royaltyBase !== branch.royaltyBase) {
      await audit(req, "royalty_changed", branch, {
        field: "royalty",
        oldValue: `${before.royaltyPercent}% of ${ROYALTY_BASES[before.royaltyBase]}`,
        newValue: `${branch.royaltyPercent}% of ${ROYALTY_BASES[branch.royaltyBase]}`,
      });
    } else {
      await audit(req, "branch_updated", branch);
    }

    res.json({ success: true, branch });
  } catch (error) {
    sendError(res, error);
  }
};

// PATCH /branches/:id/status -- hold, resume, or restore an archived branch.
exports.setBranchStatus = async (req, res) => {
  try {
    const branch = await findBranch(req.params.id);
    const status = req.body.status;
    if (!["active", "hold"].includes(status)) throw badRequest("Status must be active or hold");

    const oldStatus = branch.status;
    branch.status = status;
    branch.statusReason = status === "hold" ? clean(req.body.reason) : "";
    branch.statusChangedAt = new Date();
    await branch.save();

    await audit(req, status === "hold" ? "branch_hold" : "branch_activated", branch, {
      field: "status",
      oldValue: oldStatus,
      newValue: status,
    });

    res.json({ success: true, branch });
  } catch (error) {
    sendError(res, error);
  }
};

// DELETE /branches/:id -- "remove" archives the branch: logins and ordering stop,
// but its sales/royalty history is kept. Requires the master admin's password.
exports.archiveBranch = async (req, res) => {
  try {
    await verifyDeletePassword(req);
    const branch = await findBranch(req.params.id);
    if (branch.isDefault) throw badRequest("The main branch cannot be removed");

    const oldStatus = branch.status;
    branch.status = "archived";
    branch.statusReason = clean(req.body?.reason);
    branch.statusChangedAt = new Date();
    await branch.save();

    await audit(req, "branch_archived", branch, { field: "status", oldValue: oldStatus, newValue: "archived" });

    res.json({ success: true, message: "Branch removed. Its history is kept for reports.", branch });
  } catch (error) {
    sendError(res, error);
  }
};

// PUT /branches/:id/admin -- create the branch admin login, or update its
// name/email and optionally reset its password.
exports.upsertBranchAdmin = async (req, res) => {
  try {
    const branch = await findBranch(req.params.id);
    const existing = branch.adminUserId ? await User.findById(branch.adminUserId) : null;
    const admin = readAdminFields(req.body, { requirePassword: !existing });
    await assertEmailFree(admin.email, existing?._id);

    let user = existing;
    if (user) {
      user.name = admin.name;
      user.email = admin.email;
      if (admin.password) user.password = await bcrypt.hash(admin.password, 10);
      await user.save();
    } else {
      user = await User.create({
        name: admin.name,
        email: admin.email,
        password: await bcrypt.hash(admin.password, 10),
        role: "admin",
        branchId: branch._id,
      });
      branch.adminUserId = user._id;
      await branch.save();
    }

    await audit(req, admin.password ? "branch_admin_password_set" : "branch_admin_updated", branch, {
      field: "admin",
      newValue: user.email,
    });

    res.json({ success: true, admin: adminSummary(user) });
  } catch (error) {
    sendError(res, error);
  }
};
