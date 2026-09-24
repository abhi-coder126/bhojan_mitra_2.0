const Counter = require("../models/Counter");
const Setting = require("../models/Setting");
const Branch = require("../models/Branch");
const { currentBranchId } = require("./tenant");

// Indian financial year runs Apr-Mar, e.g. 1 Feb 2026 -> "2025-26".
const financialYearLabel = (date = new Date()) => {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
};

// Generates realistic, GST-style sequential invoice numbers like "INV/2025-26/00042".
// The sequence resets every financial year and is scoped per prefix so restaurant
// orders and POS sales can share or use distinct prefixes without colliding.
//
// Each branch has its own sequence. The default (original) branch keeps its
// pre-multi-branch counter and format so its numbering continues unbroken; every
// other branch embeds its unique code ("INV/DLH/2025-26/00001"), which keeps invoice
// numbers globally unique even when two branches use the same prefix.
const nextInvoiceNo = async () => {
  const settings = await Setting.findOne();
  const prefix = (settings?.invoicePrefix || "INV").trim().toUpperCase();
  const fy = financialYearLabel();

  const branchId = currentBranchId();
  const branch = branchId ? await Branch.findById(branchId).select("code isDefault").lean() : null;
  const branchCode = branch && !branch.isDefault ? branch.code : "";

  const counterId = branchCode ? `invoice-${branchCode}-${prefix}-${fy}` : `invoice-${prefix}-${fy}`;
  const counter = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const seq = String(counter.seq).padStart(5, "0");
  return branchCode ? `${prefix}/${branchCode}/${fy}/${seq}` : `${prefix}/${fy}/${seq}`;
};

module.exports = { nextInvoiceNo, financialYearLabel };
