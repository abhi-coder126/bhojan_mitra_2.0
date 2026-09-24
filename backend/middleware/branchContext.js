const jwt = require("jsonwebtoken");
const Branch = require("../models/Branch");
const { runWithBranch, runUnscoped } = require("../utils/tenant");
const { protect, requireBranch } = require("./authMiddleware");

// Customer-facing QR menu: the branch comes from the QR URL (/menu/<code>/<table>),
// sent as the `x-branch-code` header. A missing code means a QR printed before
// multi-branch existed, which belongs to the default (original) branch.
const publicBranch = async (req, res, next) => {
  try {
    const code = String(req.headers["x-branch-code"] || req.query.branch || "").trim().toUpperCase();
    const branch = code
      ? await Branch.findOne({ code }).lean()
      : await Branch.findOne({ isDefault: true }).lean();

    if (!branch || branch.status === "archived") {
      return res.status(404).json({ message: "This outlet could not be found", code: "BRANCH_NOT_FOUND" });
    }
    if (branch.status !== "active") {
      return res.status(423).json({
        message: "This outlet is temporarily not accepting orders. Please try again later.",
        code: "BRANCH_CLOSED",
      });
    }

    req.branch = branch;
    runWithBranch(branch._id, next);
  } catch (error) {
    res.status(500).json({ message: "Could not load this outlet" });
  }
};

// Endpoints shared by staff (POS) and customers (QR menu): a staff token pins the
// request to the staff member's own branch; anything else is a public QR request.
// Any non-customer token goes through `protect` -- an expired staff token must get a
// 401, never silently fall back to the default branch.
const staffOrPublicBranch = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const decoded = token ? jwt.decode(token) : null;

  if (token && decoded?.type !== "customer") {
    return protect(req, res, () => requireBranch(req, res, next));
  }
  return publicBranch(req, res, next);
};

// Routes that legitimately work across branches (a customer's own order history,
// looking up an order by its id) -- every query there must filter by its own key.
const unscopedContext = (req, res, next) => runUnscoped(next);

module.exports = { publicBranch, staffOrPublicBranch, unscopedContext };
