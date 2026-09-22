const mongoose = require("mongoose");
const Product = require("../models/Product");
const RestaurantOrder = require("../models/RestaurantOrder");
const Rating = require("../models/Rating");
const Coupon = require("../models/Coupon");
const DeletionLog = require("../models/DeletionLog");
const Otp = require("../models/Otp");
const RewardTier = require("../models/RewardTier");
const Reward = require("../models/Reward");
const { verifyDeletePassword } = require("../utils/deleteAuth");
const { syncTableForOrder } = require("./tableController");
const { deductRawMaterialsForItems } = require("./recipeController");
const { earnLoyaltyPoints } = require("./customerController");
const { logAudit, getActor } = require("../utils/auditLog");
const { upsertCustomerFromOrder } = require("../utils/customerUpsert");
const { nextInvoiceNo } = require("../utils/invoiceNumber");

// Fires when a logged-in customer's delivery order is marked "served": count their
// completed delivery orders, find the best-matching active tier they now qualify
// for, and issue one reward (skipped if this exact order already granted one, or
// the customer already has an unexpired, unscratched reward waiting).
const grantRewardIfEarned = async (order) => {
  if (order.orderType !== "delivery" || !order.customerId) return;

  const alreadyGranted = await Reward.findOne({ orderId: order._id });
  if (alreadyGranted) return;

  const completedOrders = await RestaurantOrder.countDocuments({
    customerId: order.customerId,
    orderType: "delivery",
    status: "served",
  });

  const tier = await RewardTier.findOne({ isActive: true, minOrders: { $lte: completedOrders } }).sort({
    minOrders: -1,
  });
  if (!tier) return;

  await Reward.create({
    customerId: order.customerId,
    orderId: order._id,
    tierId: tier._id,
    title: tier.title,
    offerText: tier.offerText,
    expiresAt: new Date(Date.now() + tier.validityDays * 24 * 60 * 60 * 1000),
  });
};

exports.getMenuProducts = async (req, res) => {
  try {
    const products = await Product.find({ stock: { $gt: 0 } })
      .select("name barcode category itemType foodType description spiceLevel isRecommended image unit sellingPrice mrp gst stock offerPercent ratingAvg ratingCount")
      .sort({ category: 1, name: 1 });

    res.json({ success: true, products });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

// Public: a customer rates items from their own served order (CustomerMenu.jsx post-order
// prompt). Only allowed once the order is served, and only for items actually on that order,
// so ratings can't be spammed for arbitrary products. Recomputes each product's average
// from the Rating collection rather than incrementing in place, since a resubmitted rating
// for the same order+item upserts instead of double-counting.
exports.rateOrderItems = async (req, res) => {
  try {
    const order = await RestaurantOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status !== "served") {
      return res.status(400).json({ message: "You can rate items once the order is served" });
    }

    const ratings = Array.isArray(req.body.ratings) ? req.body.ratings : [];
    const orderProductIds = new Set((order.items || []).map((item) => String(item.productId)));

    for (const entry of ratings) {
      const productId = String(entry.productId || "");
      const stars = Number(entry.stars);
      if (!orderProductIds.has(productId) || !(stars >= 1 && stars <= 5)) continue;

      await Rating.findOneAndUpdate(
        { orderId: order._id, productId },
        {
          stars,
          comment: String(entry.comment || "").slice(0, 300),
          customerName: order.customerName || "",
        },
        { upsert: true, new: true }
      );

      const agg = await Rating.aggregate([
        { $match: { productId: new mongoose.Types.ObjectId(productId) } },
        { $group: { _id: null, avg: { $avg: "$stars" }, count: { $sum: 1 } } },
      ]);

      const { avg = 0, count = 0 } = agg[0] || {};
      await Product.findByIdAndUpdate(productId, { ratingAvg: avg, ratingCount: count });
    }

    res.json({ success: true, message: "Thanks for rating your order!" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createRestaurantOrder = async (req, res) => {
  try {
    const {
      orderType = "dine-in",
      tableNo,
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      note,
      couponCode,
      items = [],
      orderSource = "pos",
    } = req.body;

    if (orderType !== "delivery" && !tableNo) {
      return res.status(400).json({ message: "Table number required" });
    }

    if (!customerName || !customerPhone) {
      return res.status(400).json({ message: "Customer name and contact number required" });
    }

    if (orderType === "delivery" && !deliveryAddress) {
      return res.status(400).json({ message: "Delivery address required" });
    }

    // Customer self-service delivery orders (via QR) must have a verified email OTP
    // on file first -- staff placing a delivery order from the POS (orderSource
    // "pos"/"waiter") are trusted and skip this.
    if (orderType === "delivery" && orderSource === "qr") {
      const normalizedEmail = String(customerEmail || "").trim().toLowerCase();
      if (!normalizedEmail) {
        return res.status(400).json({ message: "Verified email required for delivery orders" });
      }

      const verifiedOtp = await Otp.findOne({
        identifier: normalizedEmail,
        purpose: "delivery-order",
        verified: true,
      }).sort({ createdAt: -1 });

      if (!verifiedOtp) {
        return res.status(400).json({ message: "Please verify your email OTP before placing a delivery order" });
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one menu item required" });
    }

    const productIds = items.map((item) => item.productId).filter(Boolean);
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(products.map((product) => [String(product._id), product]));

    const orderItems = [];
    let subTotal = 0;
    let gstAmount = 0;

    for (const item of items) {
      const product = productMap.get(String(item.productId));
      const qty = Math.max(Number(item.qty || 0), 0);

      if (!product || qty <= 0) continue;

      if (Number(product.stock) < qty) {
        return res.status(400).json({
          message: `${product.name} has only ${product.stock} in stock`,
        });
      }

      // `product.mrp` here is the tax-INCLUSIVE price printed on the customer-facing
      // menu, so GST is backed out of it rather than added on top -- intentionally
      // different from the POS sale flow (see saleController.createSale), where `rate`
      // is tax-exclusive and GST is added. Don't "unify" these without also changing
      // whichever channel's price display customers actually see.
      const rate = Number(product.mrp || product.sellingPrice || 0);
      const gst = Number(product.gst || 0);
      const lineTotal = rate * qty;
      const line = gst > 0 ? lineTotal / (1 + gst / 100) : lineTotal;
      const lineGst = lineTotal - line;

      subTotal += line;
      gstAmount += lineGst;

      orderItems.push({
        productId: product._id,
        name: product.name,
        category: product.category,
        qty,
        rate,
        gst,
        taxableAmount: line,
        gstAmount: lineGst,
        total: lineTotal,
      });
    }

    if (orderItems.length === 0) {
      return res.status(400).json({ message: "Valid menu item required" });
    }

    const billAmount = subTotal + gstAmount;
    let appliedCouponCode = "";
    let discountAmount = 0;

    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: String(couponCode).trim().toUpperCase(),
        status: "Active",
      });

      if (!coupon) {
        return res.status(404).json({ message: "Coupon not found or inactive" });
      }

      const now = new Date();
      if (coupon.startDate && now < coupon.startDate) {
        return res.status(400).json({ message: "Coupon not started yet" });
      }

      if (coupon.endDate && now > coupon.endDate) {
        return res.status(400).json({ message: "Coupon expired" });
      }

      if (billAmount < Number(coupon.minimumBillAmount || 0)) {
        return res.status(400).json({
          message: `Minimum bill amount Rs ${coupon.minimumBillAmount} required`,
        });
      }

      if (
        Number(coupon.usageLimit || 0) > 0 &&
        Number(coupon.usedCount || 0) >= Number(coupon.usageLimit)
      ) {
        return res.status(400).json({ message: "Coupon usage limit reached" });
      }

      discountAmount =
        coupon.discountType === "Percent"
          ? (billAmount * Number(coupon.discountValue || 0)) / 100
          : Number(coupon.discountValue || 0);
      discountAmount = Math.min(discountAmount, billAmount);
      appliedCouponCode = coupon.code;
      await Coupon.findByIdAndUpdate(coupon._id, { $inc: { usedCount: 1 } });
    }

    // Atomically reserve stock before creating the order: each update only applies
    // if enough stock is still available, closing the race window between the
    // availability check above and the actual decrement (two concurrent orders
    // for the last unit could otherwise both pass the check and oversell).
    const reserved = [];
    let stockConflict = null;

    for (const item of orderItems) {
      const qty = Number(item.qty || 0);
      const updated = await Product.findOneAndUpdate(
        { _id: item.productId, stock: { $gte: qty } },
        { $inc: { stock: -qty } },
        { new: true }
      );

      if (!updated) {
        stockConflict = item.name;
        break;
      }

      reserved.push({ productId: item.productId, qty });
    }

    if (stockConflict) {
      if (reserved.length > 0) {
        await Product.bulkWrite(
          reserved.map((entry) => ({
            updateOne: {
              filter: { _id: entry.productId },
              update: { $inc: { stock: entry.qty } },
            },
          }))
        );
      }
      return res.status(409).json({ message: `${stockConflict} just went out of stock. Please review your order.` });
    }

    // Keeps the matching Customer profile in sync either way; if logged in, the
    // order below is linked to that exact account (req.customer._id) rather than
    // whatever upsertCustomerFromOrder happens to match by phone/email text.
    const orderCustomer = await upsertCustomerFromOrder({ customerName, customerPhone, customerEmail, deliveryAddress });

    const order = await RestaurantOrder.create({
      invoiceNo: await nextInvoiceNo(),
      branchId: req.body.branchId || req.query.branchId || undefined,
      orderType,
      tableNo: orderType === "delivery" ? "DELIVERY" : tableNo,
      customerId: req.customer?._id || orderCustomer?._id || null,
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      note,
      items: orderItems,
      subTotal,
      gstAmount,
      couponCode: appliedCouponCode,
      discountAmount,
      grandTotal: Math.max(billAmount - discountAmount, 0),
      orderSource: ["pos", "waiter", "qr"].includes(orderSource) ? orderSource : "pos",
    });

    await syncTableForOrder(order).catch(() => {});
    await deductRawMaterialsForItems(orderItems).catch(() => {});
    if (orderCustomer) await earnLoyaltyPoints(orderCustomer._id, order.grandTotal).catch(() => {});

    // One verified OTP is good for exactly one delivery order.
    if (orderType === "delivery" && orderSource === "qr") {
      await Otp.deleteMany({ identifier: String(customerEmail).trim().toLowerCase(), purpose: "delivery-order" });
    }

    res.status(201).json({ success: true, order });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

exports.markRestaurantOrderPaid = async (req, res) => {
  try {
    const { mode, cash = 0, upi = 0, card = 0, partial = false } = req.body;

    if (!["Cash", "UPI", "Card", "Partial"].includes(mode)) {
      return res.status(400).json({ message: "Payment mode required" });
    }

    const existing = await RestaurantOrder.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Order not found" });

    const paidAmount = Number(cash || 0) + Number(upi || 0) + Number(card || 0);
    const isFullyPaid = !partial && paidAmount >= Number(existing.grandTotal || 0);
    const dueAmount = Math.max(Number(existing.grandTotal || 0) - paidAmount, 0);

    const order = await RestaurantOrder.findByIdAndUpdate(
      req.params.id,
      {
        paymentStatus: isFullyPaid ? "paid" : "pending",
        payment: {
          mode,
          cash: Number(cash || 0),
          upi: Number(upi || 0),
          card: Number(card || 0),
          paidAt: new Date(),
        },
        paidAmount,
        dueAmount,
        status: isFullyPaid ? "served" : existing.status,
      },
      { new: true }
    );

    await syncTableForOrder(order).catch(() => {});

    if (isFullyPaid && existing.status !== "served") {
      await grantRewardIfEarned(order).catch(() => {});
    }

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const restoreRestaurantOrderStock = async (orders) => {
  const stockByProduct = new Map();

  orders.forEach((order) => {
    if (order.status === "cancelled") return;
    (order.items || []).forEach((item) => {
      if (!item.productId) return;
      const key = String(item.productId);
      stockByProduct.set(key, (stockByProduct.get(key) || 0) + Number(item.qty || 0));
    });
  });

  if (stockByProduct.size === 0) return;

  await Product.bulkWrite(
    Array.from(stockByProduct.entries()).map(([productId, qty]) => ({
      updateOne: {
        filter: { _id: productId },
        update: { $inc: { stock: qty } },
      },
    }))
  );
};

exports.deleteRestaurantOrder = async (req, res) => {
  try {
    const user = await verifyDeletePassword(req);
    const order = await RestaurantOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Restaurant order not found" });
    }

    await restoreRestaurantOrderStock([order]);
    await RestaurantOrder.findByIdAndDelete(req.params.id);
    await DeletionLog.create({
      recordType: "Restaurant Invoice",
      recordNo: order.invoiceNo || order.orderNo,
      title: order.customerName || "Restaurant order",
      deletedBy: user.name,
      details: `${order.orderType === "delivery" ? "Delivery" : `Table ${order.tableNo}`} | Rs ${Number(order.grandTotal || 0).toFixed(2)}`,
    });

    res.json({
      success: true,
      message: "Restaurant invoice/order deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.clearRestaurantOrders = async (req, res) => {
  try {
    const user = await verifyDeletePassword(req);
    const orders = await RestaurantOrder.find();
    await restoreRestaurantOrderStock(orders);
    const result = await RestaurantOrder.deleteMany({});
    await DeletionLog.create({
      recordType: "Restaurant Invoices",
      recordNo: "Bulk delete",
      title: "All restaurant orders and invoices",
      deletedBy: user.name,
      details: `${result.deletedCount || 0} records deleted`,
    });

    res.json({
      success: true,
      deletedCount: result.deletedCount || 0,
      message: "All restaurant orders and invoices deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getRestaurantOrders = async (req, res) => {
  try {
    const filter = {};
    if (req.query.branchId) filter.branchId = req.query.branchId;
    const orders = await RestaurantOrder.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getRestaurantOrderById = async (req, res) => {
  try {
    // Public endpoint (used unauthenticated by the customer-facing QR menu to poll
    // its own order status) -- strip PII the tracking UI doesn't need so anyone who
    // guesses/enumerates an order id can't read another customer's contact details.
    const order = await RestaurantOrder.findById(req.params.id).select(
      "-customerPhone -customerEmail -deliveryAddress -note"
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateRestaurantOrderStatus = async (req, res) => {
  try {
    const before = await RestaurantOrder.findById(req.params.id);
    const order = await RestaurantOrder.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (req.body.status === "cancelled" && before?.status !== "cancelled") {
      await logAudit({
        actor: getActor(req),
        action: "cancellation",
        entity: "RestaurantOrder",
        entityId: order._id,
        field: "status",
        oldValue: before?.status,
        newValue: "cancelled",
      });
    }

    await syncTableForOrder(order).catch(() => {});

    if (req.body.status === "served" && before?.status !== "served") {
      await grantRewardIfEarned(order).catch(() => {});
    }

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- KDS: send KOT (kitchen order ticket) ---
exports.sendKOT = async (req, res) => {
  try {
    const order = await RestaurantOrder.findById(req.params.id);

    if (!order) return res.status(404).json({ message: "Order not found" });

    order.kotSentAt = new Date();
    order.status = "accepted";
    order.items.forEach((item) => {
      if (item.itemStatus === "NEW") item.itemStatus = "ACCEPTED";
    });
    await order.save();

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- KDS: update a single item's kitchen status ---
exports.updateOrderItemStatus = async (req, res) => {
  try {
    const { itemIndex, itemStatus } = req.body;
    const allowed = ["NEW", "ACCEPTED", "COOKING", "READY", "SERVED"];
    if (!allowed.includes(itemStatus)) {
      return res.status(400).json({ message: "Invalid item status" });
    }

    const order = await RestaurantOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (!order.items[itemIndex]) {
      return res.status(400).json({ message: "Invalid item index" });
    }

    order.items[itemIndex].itemStatus = itemStatus;

    const allStatuses = order.items.map((item) => item.itemStatus);
    if (allStatuses.every((s) => s === "SERVED")) order.status = "served";
    else if (allStatuses.every((s) => s === "READY" || s === "SERVED")) order.status = "ready";
    else if (allStatuses.some((s) => s === "COOKING")) order.status = "preparing";
    else if (allStatuses.every((s) => s === "ACCEPTED")) order.status = "accepted";

    await order.save();
    await syncTableForOrder(order).catch(() => {});

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- KDS: list of live (kitchen-relevant) orders ---
exports.getKitchenOrders = async (req, res) => {
  try {
    const orders = await RestaurantOrder.find({
      status: { $nin: ["served", "cancelled"] },
    }).sort({ createdAt: 1 });

    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- Hold / resume order ---
exports.holdRestaurantOrder = async (req, res) => {
  try {
    const order = await RestaurantOrder.findByIdAndUpdate(
      req.params.id,
      { isHeld: true, holdAt: new Date() },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.resumeRestaurantOrder = async (req, res) => {
  try {
    const order = await RestaurantOrder.findByIdAndUpdate(
      req.params.id,
      { isHeld: false, holdAt: null },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- Merge bill: merge source order items into target order, cancel source ---
exports.mergeRestaurantOrders = async (req, res) => {
  try {
    const { targetOrderId, sourceOrderId } = req.body;
    const target = await RestaurantOrder.findById(targetOrderId);
    const source = await RestaurantOrder.findById(sourceOrderId);

    if (!target || !source) {
      return res.status(404).json({ message: "Order(s) not found" });
    }

    target.items.push(...source.items);
    target.subTotal += source.subTotal;
    target.gstAmount += source.gstAmount;
    // Each grandTotal already has its own discount subtracted, so summing them keeps
    // the combined total correct -- but the discount/coupon fields themselves also
    // need to carry over, or the merged invoice would display the wrong discount.
    target.grandTotal += source.grandTotal;
    target.discountAmount = Number(target.discountAmount || 0) + Number(source.discountAmount || 0);
    if (source.couponCode && source.couponCode !== target.couponCode) {
      target.couponCode = [target.couponCode, source.couponCode].filter(Boolean).join(" + ");
    }
    await target.save();

    source.status = "cancelled";
    source.mergedInto = target._id;
    await source.save();

    await syncTableForOrder(target).catch(() => {});
    await syncTableForOrder(source).catch(() => {});

    res.json({ success: true, order: target });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- Split bill: move selected item indexes from an order into a new order ---
exports.splitRestaurantOrder = async (req, res) => {
  try {
    const { itemIndexes = [] } = req.body;
    const order = await RestaurantOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const indexSet = new Set(itemIndexes.map(Number));
    const splitItems = order.items.filter((_, idx) => indexSet.has(idx));
    const remainingItems = order.items.filter((_, idx) => !indexSet.has(idx));

    if (splitItems.length === 0 || remainingItems.length === 0) {
      return res.status(400).json({ message: "Select at least one item to split, leaving the rest behind" });
    }

    const sumField = (items, field) => items.reduce((s, i) => s + Number(i[field] || 0), 0);

    // Item `total` fields are pre-discount (discount only lives at order level), so a
    // naive split would drop any order-level discount entirely -- the two resulting
    // invoices would add up to more than the customer actually owed. Distribute the
    // original discount proportionally by each half's share of the gross bill instead.
    const splitGross = sumField(splitItems, "total");
    const remainingGross = sumField(remainingItems, "total");
    const totalGross = splitGross + remainingGross || 1;
    const originalDiscount = Number(order.discountAmount || 0);
    const splitDiscount = Math.round((originalDiscount * (splitGross / totalGross)) * 100) / 100;
    const remainingDiscount = Math.max(originalDiscount - splitDiscount, 0);

    const newOrder = await RestaurantOrder.create({
      invoiceNo: await nextInvoiceNo(),
      orderType: order.orderType,
      tableNo: order.tableNo,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
      deliveryAddress: order.deliveryAddress,
      items: splitItems,
      subTotal: sumField(splitItems, "taxableAmount"),
      gstAmount: sumField(splitItems, "gstAmount"),
      couponCode: order.couponCode,
      discountAmount: splitDiscount,
      grandTotal: Math.max(splitGross - splitDiscount, 0),
      splitFrom: order._id,
      status: order.status,
    });

    order.items = remainingItems;
    order.subTotal = sumField(remainingItems, "taxableAmount");
    order.gstAmount = sumField(remainingItems, "gstAmount");
    order.discountAmount = remainingDiscount;
    order.grandTotal = Math.max(remainingGross - remainingDiscount, 0);
    await order.save();

    res.json({ success: true, order, newOrder });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- Discount reason logging ---
exports.applyRestaurantOrderDiscount = async (req, res) => {
  try {
    const { discountAmount, discountReason } = req.body;
    const order = await RestaurantOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (!discountReason) {
      return res.status(400).json({ message: "Discount reason required" });
    }

    const billAmount = order.subTotal + order.gstAmount;
    const oldDiscount = order.discountAmount;
    order.discountAmount = Math.min(Number(discountAmount || 0), billAmount);
    order.discountReason = discountReason;
    order.grandTotal = Math.max(billAmount - order.discountAmount, 0);
    await order.save();

    await logAudit({
      actor: getActor(req),
      action: "discount",
      entity: "RestaurantOrder",
      entityId: order._id,
      field: "discountAmount",
      oldValue: oldDiscount,
      newValue: order.discountAmount,
    });

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
