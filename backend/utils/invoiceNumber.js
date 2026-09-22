const Counter = require("../models/Counter");
const Setting = require("../models/Setting");

// Indian financial year runs Apr-Mar, e.g. 1 Feb 2026 -> "2025-26".
const financialYearLabel = (date = new Date()) => {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
};

// Generates realistic, GST-style sequential invoice numbers like "INV/2025-26/00042".
// The sequence resets every financial year and is scoped per prefix so restaurant
// orders and POS sales can share or use distinct prefixes without colliding.
const nextInvoiceNo = async () => {
  const settings = await Setting.findOne();
  const prefix = (settings?.invoicePrefix || "INV").trim().toUpperCase();
  const fy = financialYearLabel();
  const counterId = `invoice-${prefix}-${fy}`;

  const counter = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  return `${prefix}/${fy}/${String(counter.seq).padStart(5, "0")}`;
};

module.exports = { nextInvoiceNo, financialYearLabel };
