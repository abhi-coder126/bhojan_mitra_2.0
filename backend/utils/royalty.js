const mongoose = require("mongoose");
const Sale = require("../models/Sale");
const SalesReturn = require("../models/SalesReturn");
const RestaurantOrder = require("../models/RestaurantOrder");
const { ROYALTY_BASES } = require("../models/Branch");
const { runUnscoped } = require("./tenant");

// Royalty periods are business days in India, not the server's clock (Render runs in
// UTC, which would shift every day/month boundary by 5h30m).
const IST_OFFSET_MS = 330 * 60 * 1000;
const istMidnight = (year, month, day) => new Date(Date.UTC(year, month, day) - IST_OFFSET_MS);
const istToday = () => {
  const shifted = new Date(Date.now() + IST_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate() };
};
const parseDay = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  return match ? { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) } : null;
};
const endBefore = (date) => new Date(date.getTime() - 1);

const PERIODS = ["today", "month", "last_month", "year", "custom"];

// [start, end] (inclusive) for a named period. "year" is the Indian financial year.
const periodRange = (period = "month", startDate, endDate) => {
  const { y, m, d } = istToday();

  switch (period) {
    case "today":
      return { start: istMidnight(y, m, d), end: endBefore(istMidnight(y, m, d + 1)) };
    case "last_month":
      return { start: istMidnight(y, m - 1, 1), end: endBefore(istMidnight(y, m, 1)) };
    case "year": {
      const fyStart = m >= 3 ? y : y - 1;
      return { start: istMidnight(fyStart, 3, 1), end: endBefore(istMidnight(fyStart + 1, 3, 1)) };
    }
    case "custom": {
      const from = parseDay(startDate);
      const to = parseDay(endDate);
      if (from && to) {
        return { start: istMidnight(from.y, from.m, from.d), end: endBefore(istMidnight(to.y, to.m, to.d + 1)) };
      }
      return periodRange("month");
    }
    case "month":
    default:
      return { start: istMidnight(y, m, 1), end: endBefore(istMidnight(y, m + 1, 1)) };
  }
};

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;
const num = (field) => ({ $ifNull: [field, 0] });

// GST share of an invoice after bill-level discounts: the stored gstAmount is computed
// before bill/coupon discounts, so scale it by grandTotal / pre-discount total.
const discountedGst = (preDiscountTotal) => ({
  $cond: [
    { $gt: [preDiscountTotal, 0] },
    { $multiply: [num("$gstAmount"), { $divide: [num("$grandTotal"), preDiscountTotal] }] },
    num("$gstAmount"),
  ],
});

const groupRevenue = { _id: "$branchId", gross: { $sum: "$gross" }, gst: { $sum: "$gst" }, count: { $sum: 1 } };

// Revenue per branch for [start, end]: POS sales + paid restaurant orders (dine-in,
// delivery, QR), minus sales returns. Runs unscoped with an explicit branch filter
// so the master admin can report across branches in one pass.
const revenueByBranch = (branchIds, { start, end }) =>
  runUnscoped(async () => {
    const ids = branchIds.map((id) => new mongoose.Types.ObjectId(String(id)));
    const createdAt = { $gte: start, $lte: end };

    const [sales, orders, returns] = await Promise.all([
      Sale.aggregate([
        { $match: { branchId: { $in: ids }, createdAt } },
        {
          $project: {
            branchId: 1,
            gross: num("$grandTotal"),
            gst: discountedGst({ $add: [{ $subtract: [num("$subTotal"), num("$discount")] }, num("$gstAmount")] }),
          },
        },
        { $group: groupRevenue },
      ]),
      RestaurantOrder.aggregate([
        { $match: { branchId: { $in: ids }, createdAt, paymentStatus: "paid", status: { $ne: "cancelled" } } },
        {
          $project: {
            branchId: 1,
            gross: num("$grandTotal"),
            gst: discountedGst({ $add: [num("$subTotal"), num("$gstAmount")] }),
          },
        },
        { $group: groupRevenue },
      ]),
      SalesReturn.aggregate([
        { $match: { branchId: { $in: ids }, createdAt } },
        {
          $project: {
            branchId: 1,
            gross: num("$returnAmount"),
            // Return line totals are GST-inclusive: back the GST out per line.
            gst: {
              $sum: {
                $map: {
                  input: { $ifNull: ["$products", []] },
                  as: "p",
                  in: {
                    $subtract: [
                      num("$$p.total"),
                      { $divide: [num("$$p.total"), { $add: [1, { $divide: [num("$$p.gst"), 100] }] }] },
                    ],
                  },
                },
              },
            },
          },
        },
        { $group: groupRevenue },
      ]),
    ]);

    const byId = (rows) => new Map(rows.map((row) => [String(row._id), row]));
    const salesMap = byId(sales);
    const ordersMap = byId(orders);
    const returnsMap = byId(returns);
    const empty = { gross: 0, gst: 0, count: 0 };

    const result = new Map();
    ids.forEach((id) => {
      const key = String(id);
      const s = salesMap.get(key) || empty;
      const o = ordersMap.get(key) || empty;
      const r = returnsMap.get(key) || empty;

      const gross = s.gross + o.gross;
      const gst = s.gst + o.gst;

      result.set(key, {
        bills: s.count + o.count,
        grossIncGst: round2(gross),
        gst: round2(gst),
        returnsIncGst: round2(r.gross),
        returnsGst: round2(r.gst),
        netIncGst: round2(gross - r.gross),
        netExGst: round2(gross - gst - (r.gross - r.gst)),
      });
    });

    return result;
  });

const royaltyFor = (branch, figures) => {
  const baseKey = ROYALTY_BASES[branch.royaltyBase] ? branch.royaltyBase : "net_ex_gst";
  const baseAmount = { net_ex_gst: figures.netExGst, gross_inc_gst: figures.grossIncGst, net_inc_gst: figures.netIncGst }[
    baseKey
  ];
  const percent = Number(branch.royaltyPercent || 0);

  return {
    percent,
    base: baseKey,
    baseLabel: ROYALTY_BASES[baseKey],
    baseAmount: round2(baseAmount),
    amount: round2((Math.max(baseAmount, 0) * percent) / 100),
  };
};

// Sales + royalty for one branch across the periods its dashboard shows.
const royaltyPeriods = async (branch) => {
  const periods = {};
  for (const period of ["today", "month", "last_month"]) {
    const range = periodRange(period);
    const figures = (await revenueByBranch([branch._id], range)).get(String(branch._id));
    periods[period] = { range, sales: figures, royalty: royaltyFor(branch, figures) };
  }
  return periods;
};

module.exports = { PERIODS, ROYALTY_BASES, periodRange, revenueByBranch, royaltyFor, royaltyPeriods };
