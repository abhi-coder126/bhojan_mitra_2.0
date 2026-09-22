const Sale = require("../models/Sale");
const Purchase = require("../models/Purchase");
const Vendor = require("../models/Vendor");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const SalesReturn = require("../models/SalesReturn");
const DeletionLog = require("../models/DeletionLog");
const RawMaterial = require("../models/RawMaterial");
const Table = require("../models/Table");
const RestaurantOrder = require("../models/RestaurantOrder");

const getDateRange = (filter, startDate, endDate) => {
  const now = new Date();
  let start = new Date();
  let end = new Date();

  if (filter === "today") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  if (filter === "yesterday") {
    start.setDate(now.getDate() - 1);
    start.setHours(0, 0, 0, 0);

    end.setDate(now.getDate() - 1);
    end.setHours(23, 59, 59, 999);
  }

  if (filter === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  if (filter === "year") {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  }

  if (filter === "custom" && startDate && endDate) {
    start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
};

exports.getDashboard = async (req, res) => {
  try {
    const { filter = "today", startDate, endDate } = req.query;
    const { start, end } = getDateRange(filter, startDate, endDate);

    const dateQuery = {
      createdAt: {
        $gte: start,
        $lte: end,
      },
    };

    const sales = await Sale.find(dateQuery).sort({ createdAt: -1 });
    const purchases = await Purchase.find(dateQuery).sort({ createdAt: -1 });
    const salesReturns = await SalesReturn.find(dateQuery).sort({ createdAt: -1 });

    const allProducts = await Product.find();
    const customers = await Customer.find();
    const vendors = await Vendor.find();

    const grossSale = sales.reduce((sum, s) => sum + Number(s.grandTotal || 0), 0);

    const totalReturnRefund = salesReturns.reduce(
      (sum, r) => sum + Number(r.returnAmount || 0),
      0
    );

    const totalSale = Math.max(grossSale - totalReturnRefund, 0);

    const cashInHand = sales.reduce((sum, s) => sum + Number(s.payment?.cash || 0), 0);
    const totalUPI = sales.reduce((sum, s) => sum + Number(s.payment?.upi || 0), 0);
    const totalCard = sales.reduce((sum, s) => sum + Number(s.payment?.card || 0), 0);
    const partialPayment = sales
      .filter((s) => s.paymentStatus === "Partial")
      .reduce((sum, s) => sum + Number(s.pendingAmount || 0), 0);

    const totalPurchaseCost = sales.reduce((sum, sale) => {
      const cost = sale.products.reduce((pSum, item) => {
        return pSum + Number(item.purchasePrice || 0) * Number(item.qty || 0);
      }, 0);

      return sum + cost;
    }, 0);

    const grossProfit = grossSale - totalPurchaseCost;
    const netProfit = totalSale - totalPurchaseCost;

    const averageBillValue =
      sales.length > 0 ? Number((totalSale / sales.length).toFixed(2)) : 0;

    const availableStockValue = allProducts.reduce((sum, p) => {
      return sum + Number(p.stock || 0) * Number(p.purchasePrice || 0);
    }, 0);

    const today = new Date();

    const expiredItems = allProducts.filter((p) => {
      if (!p.expiryDate) return false;
      return new Date(p.expiryDate) < today;
    });

    const outOfStockItems = allProducts.filter((p) => Number(p.stock || 0) <= 0);

    const lowStockItems = allProducts.filter(
      (p) =>
        Number(p.stock || 0) > 0 &&
        Number(p.stock || 0) <= Number(p.lowStockLimit || 5)
    );

    const vendorPendingPayments = vendors.reduce(
      (sum, v) => sum + Number(v.pendingAmount || 0),
      0
    );

    const productMap = {};

    sales.forEach((sale) => {
      sale.products.forEach((item) => {
        const key = item.name;

        if (!productMap[key]) {
          productMap[key] = {
            name: item.name,
            qty: 0,
            amount: 0,
          };
        }

        productMap[key].qty += Number(item.qty || 0);
        productMap[key].amount += Number(item.total || 0);
      });
    });

    const topSellingItems = Object.values(productMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const topPaymentMethod = [
      { name: "Cash", amount: cashInHand },
      { name: "UPI", amount: totalUPI },
      { name: "Card", amount: totalCard },
      { name: "Partial", amount: partialPayment },
    ].sort((a, b) => b.amount - a.amount);

    const hourMap = {};

    sales.forEach((sale) => {
      const hour = new Date(sale.createdAt).getHours();
      const label = `${hour}:00 - ${hour + 1}:00`;

      if (!hourMap[label]) hourMap[label] = 0;
      hourMap[label] += Number(sale.grandTotal || 0);
    });

    const peakHour = Object.entries(hourMap)
      .map(([hour, amount]) => ({ hour, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const dayMap = {};

    sales.forEach((sale) => {
      const day = new Date(sale.createdAt).toLocaleDateString("en-IN", {
        weekday: "long",
      });

      if (!dayMap[day]) dayMap[day] = 0;
      dayMap[day] += Number(sale.grandTotal || 0);
    });

    const peakWeekend = Object.entries(dayMap)
      .map(([day, amount]) => ({ day, amount }))
      .sort((a, b) => b.amount - a.amount);

    res.json({
      success: true,
      filter,
      range: { start, end },

      stats: {
        totalSale,
        totalInvoices: sales.length,
        totalReturnRefund,
        cashInHand,
        totalUPI,
        totalCard,
        partialPayment,
        grossSale,
        netProfit,
        grossProfit,
        averageBillValue,
        availableStockValue,
        totalExpiredItems: expiredItems.length,
        totalCustomers: customers.length,
        totalVendors: vendors.length,
      },

      charts: {
        topSellingItems,
        topPaymentMethod,
        peakHour,
        peakWeekend,
        totalSale: sales.map((s) => ({
          invoiceNo: s.invoiceNo,
          amount: s.grandTotal,
          date: s.createdAt,
        })),
      },

      notices: {
        lastLogin: new Date(),
        expiredItems: expiredItems.slice(0, 5),
        outOfStockItems: outOfStockItems.slice(0, 5),
        lowStockItems: lowStockItems.slice(0, 5),
        vendorPendingPayments,
        todayReturnRefund: totalReturnRefund,
      },

      recentBills: sales.slice(0, 5),
      recentPurchases: purchases.slice(0, 5),
      recentReturns: salesReturns.slice(0, 5),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Dashboard error",
      error: error.message,
    });
  }
};

// Extra analytics: low stock raw materials, table performance, hourly/daily breakdown
exports.getAnalytics = async (req, res) => {
  try {
    const { filter = "today", startDate, endDate } = req.query;
    const { start, end } = getDateRange(filter, startDate, endDate);
    const dateQuery = { createdAt: { $gte: start, $lte: end } };

    const rawMaterials = await RawMaterial.find();
    const lowStockRawMaterials = rawMaterials.filter(
      (m) => Number(m.stock || 0) <= Number(m.lowStockThreshold || 0)
    );

    const orders = await RestaurantOrder.find(dateQuery);
    const tableStatsMap = {};
    orders.forEach((order) => {
      if (!order.tableNo || order.tableNo === "DELIVERY") return;
      if (!tableStatsMap[order.tableNo]) {
        tableStatsMap[order.tableNo] = { tableNo: order.tableNo, orders: 0, revenue: 0 };
      }
      tableStatsMap[order.tableNo].orders += 1;
      tableStatsMap[order.tableNo].revenue += Number(order.grandTotal || 0);
    });

    const tablePerformance = Object.values(tableStatsMap).sort((a, b) => b.revenue - a.revenue);

    const sales = await Sale.find(dateQuery);
    const productMap = {};
    sales.forEach((sale) => {
      sale.products.forEach((item) => {
        if (!productMap[item.name]) productMap[item.name] = { name: item.name, qty: 0, amount: 0 };
        productMap[item.name].qty += Number(item.qty || 0);
        productMap[item.name].amount += Number(item.total || 0);
      });
    });
    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (!productMap[item.name]) productMap[item.name] = { name: item.name, qty: 0, amount: 0 };
        productMap[item.name].qty += Number(item.qty || 0);
        productMap[item.name].amount += Number(item.total || 0);
      });
    });

    const allItems = Object.values(productMap).sort((a, b) => b.qty - a.qty);
    const topSelling = allItems.slice(0, 10);
    const leastSelling = allItems.slice(-10).reverse();

    const hourlyBreakdown = Array.from({ length: 24 }, (_, hour) => ({ hour, amount: 0 }));
    [...sales, ...orders].forEach((doc) => {
      const hour = new Date(doc.createdAt).getHours();
      hourlyBreakdown[hour].amount += Number(doc.grandTotal || 0);
    });

    res.json({
      success: true,
      lowStockRawMaterials,
      tablePerformance,
      topSelling,
      leastSelling,
      hourlyBreakdown,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDeletionLogs = async (req, res) => {
  try {
    const logs = await DeletionLog.find().sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
