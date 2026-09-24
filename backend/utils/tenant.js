const { AsyncLocalStorage } = require("node:async_hooks");
const mongoose = require("mongoose");

// Multi-branch isolation. Every request runs inside a branch context (set by
// authMiddleware.protect for staff, or middleware/branchContext.publicBranch for the
// customer QR menu), and branchScopePlugin forces every query/insert/aggregate on a
// branch-owned model to that branch. Isolation lives here, in one place, instead of
// relying on every controller remembering to filter -- a forgotten filter fails
// closed (throws) rather than leaking another branch's data.
const storage = new AsyncLocalStorage();

class BranchContextError extends Error {
  constructor(message = "Select a branch before accessing branch data") {
    super(message);
    this.name = "BranchContextError";
    this.statusCode = 400;
  }
}

const getBranchContext = () => storage.getStore() || null;
const currentBranchId = () => getBranchContext()?.branchId || null;

// Mongoose queries are lazy: `runWithBranch(id, () => Model.deleteMany({}))` would
// otherwise hand back an unexecuted query that runs later, wherever it is awaited --
// outside this context. Execute it here so it runs under the intended branch.
const runIn = (store, fn) =>
  storage.run(store, (...args) => {
    const result = fn(...args);
    return result && typeof result.exec === "function" ? result.exec() : result;
  });

const runWithBranch = (branchId, fn) =>
  runIn({ branchId: branchId ? String(branchId) : null, unscoped: false }, fn);

// Explicit, deliberate bypass -- only for master-admin cross-branch reports, the
// customer's own cross-branch history, and maintenance scripts.
const runUnscoped = (fn) => runIn({ branchId: null, unscoped: true }, fn);

// Returns the branch id to scope to, null when the caller explicitly opted out, or
// throws when a strict model is touched with no branch context at all.
const resolveScope = (strict) => {
  const ctx = storage.getStore();
  if (ctx?.unscoped) return null;
  if (ctx?.branchId) return ctx.branchId;
  if (!strict) return null;
  throw new BranchContextError();
};

const QUERY_OPS = [
  "countDocuments",
  "distinct",
  "find",
  "findOne",
  "findOneAndReplace",
  "findOneAndUpdate",
  "replaceOne",
  "updateMany",
  "updateOne",
  "deleteMany",
  "deleteOne",
  "findOneAndDelete",
];

// Never let a request body move a record into another branch.
const stripBranchFromUpdate = (update) => {
  if (!update || typeof update !== "object") return;
  delete update.branchId;
  ["$set", "$setOnInsert", "$unset", "$rename"].forEach((op) => {
    if (update[op]) delete update[op].branchId;
  });
};

const scopeFilter = (filter, branchId) => ({ ...(filter || {}), branchId });

// strict (default): touching the model with no branch context throws.
// strict: false: used for logs written before a branch is known (e.g. failed logins).
function branchScopePlugin(schema, { strict = true } = {}) {
  if (!schema.path("branchId")) {
    schema.add({ branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null } });
  }
  schema.index({ branchId: 1 });

  schema.pre(QUERY_OPS, function scopeQuery() {
    const branchId = resolveScope(strict);
    if (!branchId) return;
    this.where({ branchId });
    stripBranchFromUpdate(this.getUpdate?.());
  });

  schema.pre("save", function scopeSave() {
    const branchId = resolveScope(strict);
    if (!branchId) return;
    if (this.isNew) {
      this.branchId = branchId;
    } else if (this.branchId && String(this.branchId) !== String(branchId)) {
      throw new Error("Cross-branch write blocked");
    }
  });

  schema.pre("insertMany", function scopeInsertMany(docs) {
    const branchId = resolveScope(strict);
    if (!branchId) return;
    (Array.isArray(docs) ? docs : [docs]).forEach((doc) => {
      if (doc) doc.branchId = branchId;
    });
  });

  schema.pre("bulkWrite", function scopeBulkWrite(ops) {
    const branchId = resolveScope(strict);
    if (!branchId || !Array.isArray(ops)) return;
    ops.forEach((op) => {
      const [type] = Object.keys(op || {});
      const body = op[type];
      if (!body) return;
      if (type === "insertOne") {
        body.document = { ...body.document, branchId };
        return;
      }
      body.filter = scopeFilter(body.filter, branchId);
      stripBranchFromUpdate(body.update);
    });
  });

  schema.pre("aggregate", function scopeAggregate() {
    const branchId = resolveScope(strict);
    if (!branchId) return;
    this.pipeline().unshift({ $match: { branchId: new mongoose.Types.ObjectId(branchId) } });
  });
}

module.exports = {
  BranchContextError,
  branchScopePlugin,
  currentBranchId,
  getBranchContext,
  runUnscoped,
  runWithBranch,
};
