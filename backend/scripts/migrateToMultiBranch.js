// One-time move from single-outlet to multi-branch. Safe to re-run (idempotent).
//
//   node scripts/migrateToMultiBranch.js                 -> dry run, prints the plan
//   node scripts/migrateToMultiBranch.js --apply         -> performs it
//
// Options:
//   --master-email=you@x.com  only this login becomes master admin (default: every
//                             existing "admin" login with no branch)
//   --main-name="Name"        name of the branch that receives all existing data
//                             (default: the store name from Settings, else "Main Branch")
//   --main-code=MAIN          its short code used in QR URLs (default: MAIN)
//
// What it does:
//   1. Creates the default "main" branch (or reuses it) -- legacy /menu/<table> QR
//      codes keep resolving to it.
//   2. Promotes the existing admin login(s) to master_admin; every other login is
//      attached to the main branch.
//   3. Stamps branchId = main on every existing record of every branch-owned
//      collection, and links every existing customer to the main branch.
//   4. Replaces the old global unique indexes (table number, coupon code) with
//      per-branch ones.
require("dotenv").config();
require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose = require("mongoose");

const Branch = require("../models/Branch");
const User = require("../models/User");
const Customer = require("../models/Customer");
const Setting = require("../models/Setting");

const SCOPED_MODELS = [
  "Product",
  "RawMaterial",
  "Recipe",
  "StockTransaction",
  "RestaurantOrder",
  "Sale",
  "SalesReturn",
  "Purchase",
  "Vendor",
  "VendorPayment",
  "Table",
  "Coupon",
  "RewardTier",
  "Reward",
  "Rating",
  "Setting",
  "DeletionLog",
  "AuditLog",
].map((name) => require(`../models/${name}`));

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : true];
  })
);
const APPLY = Boolean(args.apply);
const noBranch = { $or: [{ branchId: null }, { branchId: { $exists: false } }] };

const log = (...parts) => console.log(APPLY ? "  [apply]" : "  [dry-run]", ...parts);

async function ensureMainBranch() {
  const existingDefault = await Branch.findOne({ isDefault: true });
  if (existingDefault) {
    console.log(`Main branch already exists: ${existingDefault.name} (${existingDefault.code})`);
    return existingDefault;
  }

  // The raw collection is used (not the model) so the settings read works before
  // any branch exists -- Setting is branch-scoped at the model level.
  const legacySettings = await Setting.collection.findOne({});
  const code = String(args["main-code"] || "MAIN").trim().toUpperCase();
  const name = String(args["main-name"] || legacySettings?.storeName || "Main Branch").trim();

  if (!/^[A-Z0-9]{2,10}$/.test(code)) throw new Error(`Invalid --main-code "${code}"`);
  if (await Branch.exists({ code })) throw new Error(`Branch code ${code} already used by another branch`);

  log(`create main branch "${name}" (${code})`);
  if (!APPLY) return { _id: new mongoose.Types.ObjectId(), name, code, dryRun: true };

  return Branch.create({
    name,
    code,
    isDefault: true,
    status: "active",
    statusChangedAt: new Date(),
    address: legacySettings?.storeAddress || "",
    phone: legacySettings?.storeContact || "",
    email: legacySettings?.storeEmail || "",
    gstNumber: legacySettings?.gstNumber || "",
    royaltyPercent: 0,
  });
}

// Branches created by the old, unused branch UI have no code/status yet.
async function upgradeLegacyBranches() {
  const legacy = await Branch.collection.find({ $or: [{ code: { $exists: false } }, { status: { $exists: false } }] }).toArray();
  for (const [index, branch] of legacy.entries()) {
    const code =
      branch.code ||
      `${String(branch.name || "BR").replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase() || "BR"}${index + 1}`;
    const status = branch.status || (branch.isActive === false ? "hold" : "active");
    log(`upgrade legacy branch "${branch.name}" -> code ${code}, status ${status}`);
    if (APPLY) await Branch.collection.updateOne({ _id: branch._id }, { $set: { code, status } });
  }
}

async function migrateUsers(mainBranch) {
  const masterEmail = args["master-email"] ? String(args["master-email"]).trim().toLowerCase() : null;
  const users = await User.find({ $or: [{ branchId: null }, { branchId: { $exists: false } }] }).lean();

  if (masterEmail && !users.some((user) => user.email === masterEmail) && !(await User.exists({ email: masterEmail, role: "master_admin" }))) {
    throw new Error(`--master-email ${masterEmail} does not match any unassigned login`);
  }

  for (const user of users) {
    if (user.role === "master_admin") continue;

    const becomesMaster = masterEmail ? user.email === masterEmail : user.role === "admin";
    if (becomesMaster) {
      log(`login ${user.email} (${user.role}) -> master_admin`);
      if (APPLY) await User.updateOne({ _id: user._id }, { $set: { role: "master_admin", branchId: null } });
    } else {
      log(`login ${user.email} (${user.role}) -> branch "${mainBranch.name}"`);
      if (APPLY) await User.updateOne({ _id: user._id }, { $set: { branchId: mainBranch._id } });
    }
  }

  const masters = await User.countDocuments({ role: "master_admin" });
  if (APPLY && masters === 0) {
    throw new Error("No master admin exists after migration -- rerun with --master-email=<login email>");
  }
}

async function backfillBranchIds(mainBranch) {
  for (const Model of SCOPED_MODELS) {
    const collection = Model.collection;
    const count = await collection.countDocuments(noBranch);
    if (!count) continue;
    log(`${collection.collectionName}: stamp ${count} record(s) with branch ${mainBranch.code}`);
    if (APPLY) await collection.updateMany(noBranch, { $set: { branchId: mainBranch._id } });
  }

  const customerFilter = { $or: [{ branchIds: { $exists: false } }, { branchIds: { $size: 0 } }] };
  const customers = await Customer.collection.countDocuments(customerFilter);
  if (customers) {
    log(`customers: link ${customers} customer(s) to branch ${mainBranch.code}`);
    if (APPLY) await Customer.collection.updateMany(customerFilter, { $set: { branchIds: [mainBranch._id] } });
  }
}

async function migrateIndexes() {
  const replaced = [
    { Model: require("../models/Table"), oldIndex: "number_1" },
    { Model: require("../models/Coupon"), oldIndex: "code_1" },
  ];

  for (const { Model, oldIndex } of replaced) {
    const indexes = await Model.collection.indexes().catch(() => []);
    if (indexes.some((index) => index.name === oldIndex)) {
      log(`${Model.collection.collectionName}: drop global unique index ${oldIndex} (becomes per-branch)`);
      if (APPLY) await Model.collection.dropIndex(oldIndex);
    }
  }

  if (APPLY) {
    for (const Model of [...SCOPED_MODELS, Branch, User, Customer]) {
      await Model.createIndexes();
    }
    log("created per-branch indexes");
  } else {
    log("create per-branch indexes");
  }
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  console.log(`Connected to ${mongoose.connection.name}. Mode: ${APPLY ? "APPLY" : "DRY RUN (nothing will change)"}\n`);

  await upgradeLegacyBranches();
  const mainBranch = await ensureMainBranch();
  await migrateUsers(mainBranch);
  await backfillBranchIds(mainBranch);
  await migrateIndexes();

  console.log(APPLY ? "\nMigration complete." : "\nDry run complete. Re-run with --apply to perform these changes.");
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("\nMigration failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
