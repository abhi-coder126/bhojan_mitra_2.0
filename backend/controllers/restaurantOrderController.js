const { resolveMenuSelection } = require("../utils/menuOptions");
const { couponUnavailable, couponDiscount } = require("../utils/couponPolicy");
const CategoryImage = require("../models/CategoryImage");
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
const { consumeIngredients, returnIngredients } = require("../utils/inventory");
const { earnLoyaltyPoints } = require("./customerController");
const { logAudit, getActor } = require("../utils/auditLog");
const { upsertCustomerFromOrder } = require("../utils/customerUpsert");
const { nextInvoiceNo } = require("../utils/invoiceNumber");
const { runWithBranch } = require("../utils/tenant");

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

// Raw-material stock follows the order: ingredients leave stock when the order is
// placed and come back if it is cancelled or deleted before being served. The
// inventoryDeducted flag is claimed atomically, so a double cancel/delete can't
// return them twice.
// Dine-in shows its table; takeaway and delivery have no table to show.
const orderTypeLabel = (order) =>
  order.orderType === "delivery" ? "Delivery"
    : order.orderType === "takeaway" ? "Takeaway"
    : `Table ${order.tableNo}`;

const deductOrderInventory = async (order, actor) => {
  const deducted = await consumeIngredients(order.items, { reference: order.orderNo, actor });
  if (deducted) await RestaurantOrder.updateOne({ _id: order._id }, { inventoryDeducted: true });
};

const restoreOrderInventory = async (order, note = "Order cancelled") => {
  const claimed = await RestaurantOrder.findOneAndUpdate(
    { _id: order._id, inventoryDeducted: true },
    { inventoryDeducted: false }
  );
  if (!claimed) return;
  await returnIngredients(claimed.items, { reference: claimed.orderNo, note });
};

exports.getMenuProducts = async (req, res) => {
  try {
    const products = await Product.find({ stock: { $gt: 0 } })
      .select("name barcode category itemType foodType description spiceLevel isRecommended hasImage unit sellingPrice mrp gst stock offerPercent ratingAvg ratingCount variants optionGroups")
      .sort({ category: 1, name: 1 })
      .lean();

    res.json({
      success: true,
      branch: req.branch ? { name: req.branch.name, code: req.branch.code } : null,
      products,
      categoryImages: await CategoryImage.find().select("name updatedAt").lean(),
      offers: (await Coupon.find({ showOnMenu: true, status: "Active" }).lean())
        .filter((coupon) => !couponUnavailable(coupon))
        .map(({ code, title, description, discountType, discountValue, minimumBillAmount }) =>
          ({ code, title, description, discountType, discountValue, minimumBillAmount })),
    });
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

    // The lookup above is by order id across branches; the rating writes below must
    // land in the branch that actually served the order.
    await runWithBranch(order.branchId, async () => {
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
    });

    res.json({ success: true, message: "Thanks for rating your order!" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createRestaurantOrder = async (req, res) => {
  let claimedCouponId = null;
  let orderCreated = false;
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
    } = req.body;

    // Only an authenticated staff request (see branchContext.staffOrPublicBranch) may
    // claim a POS/waiter source -- those skip the customer email-OTP check below.
    const orderSource = req.user ? req.body.orderSource || "pos" : "qr";

    if (orderType === "dine-in" && !tableNo) {
      return res.status(400).json({ message: "Table number required" });
    }

    // A waiter placing a dine-in order from the POS screen (orderSource "captain")
    // usually won't have the customer's phone handy -- only require it for delivery
    // (needed for dispatch) and customer self-service QR orders.
    const phoneRequired = orderType === "delivery" || orderSource === "qr";
    if (!customerName || (phoneRequired && !customerPhone)) {
      return res.status(400).json({
        message: phoneRequired ? "Customer name and contact number required" : "Customer name required",
      });
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
      const qty = Number(item.qty);
      if (!Number.isInteger(qty) || qty < 1) return res.status(400).json({ message: "Choose a valid item quantity" });

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
      const selection = resolveMenuSelection(product, item, Boolean(req.user));
      const rate = selection.rate;
      const gst = Number(product.gst || 0);
      const lineTotal = rate * qty;
      const line = gst > 0 ? lineTotal / (1 + gst / 100) : lineTotal;
      const lineGst = lineTotal - line;

      subTotal += line;
      gstAmount += lineGst;

      orderItems.push({
        productId: product._id,
        name: selection.name,
        variantId: selection.variantId,
        variantLabel: selection.variantLabel,
        addons: selection.addons,
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

      discountAmount = couponDiscount(coupon, billAmount);
      // Claim usage atomically, so two simultaneous orders cannot take the last use.
      const claimed = await Coupon.findOneAndUpdate(
        { _id: coupon._id, status: "Active", updatedAt: coupon.updatedAt,
          ...(coupon.usageLimit > 0 ? { usedCount: { $lt: coupon.usageLimit } } : {}) },
        { $inc: { usedCount: 1 } }, { new: true }
      );
      if (!claimed) return res.status(409).json({ message: "Offer changed or its usage limit was reached. Please apply it again." });
      claimedCouponId = coupon._id;
      appliedCouponCode = coupon.code;
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
      if (claimedCouponId) {
        await Coupon.findByIdAndUpdate(claimedCouponId, { $inc: { usedCount: -1 } });
        claimedCouponId = null;
      }
      return res.status(409).json({ message: `${stockConflict} just went out of stock. Please review your order.` });
    }

    // Keeps the matching Customer profile in sync either way; if logged in, the
    // order below is linked to that exact account (req.customer._id) rather than
    // whatever upsertCustomerFromOrder happens to match by phone/email text.
    const orderCustomer = await upsertCustomerFromOrder({ customerName, customerPhone, customerEmail, deliveryAddress });

    const order = await RestaurantOrder.create({
      invoiceNo: await nextInvoiceNo(),
      orderType,
      tableNo: orderType === "delivery" ? "DELIVERY" : orderType === "takeaway" ? "TAKEAWAY" : tableNo,
      // Staff-punched orders are credited to whoever is signed in. A QR order
      // placed by the guest has no staff behind it, so this stays empty.
      takenById: req.user?._id || null,
      takenByName: req.user?.name || "",
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

    orderCreated = true;
    await syncTableForOrder(order).catch(() => {});
    await deductOrderInventory(order, req.user?.name || "QR order").catch((error) =>
      console.error("Ingredient deduction failed:", error.message)
    );
    if (orderCustomer) await earnLoyaltyPoints(orderCustomer._id, order.grandTotal).catch(() => {});

    // One verified OTP is good for exactly one delivery order.
    if (orderType === "delivery" && orderSource === "qr") {
      await Otp.deleteMany({ identifier: String(customerEmail).trim().toLowerCase(), purpose: "delivery-order" });
    }

    res.status(201).json({ success: true, order });
  } catch (error) {
    if (claimedCouponId && !orderCreated) {
      await Coupon.findByIdAndUpdate(claimedCouponId, { $inc: { usedCount: -1 } }).catch(() => {});
    }
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

    if (existing.status === "cancelled") {
      return res.status(400).json({ message: "This order is cancelled" });
    }

    const paidAmount = Number(cash || 0) + Number(upi || 0) + Number(card || 0);
    const isFullyPaid = !partial && paidAmount >= Number(existing.grandTotal || 0);
    const dueAmount = Math.max(Number(existing.grandTotal || 0) - paidAmount, 0);
    // Paying up front (e.g. a prepaid delivery) must not skip the kitchen: only an
    // order whose food is ready is closed as served by the payment.
    const nextStatus = isFullyPaid && existing.status === "ready" ? "served" : existing.status;

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
        status: nextStatus,
        ...(nextStatus === "served" ? { "items.$[].itemStatus": "SERVED" } : {}),
      },
      { new: true }
    );

    await syncTableForOrder(order).catch(() => {});

    if (nextStatus === "served" && existing.status !== "served") {
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
    await restoreOrderInventory(order, "Order deleted");
    await RestaurantOrder.findByIdAndDelete(req.params.id);
    await DeletionLog.create({
      recordType: "Restaurant Invoice",
      recordNo: order.invoiceNo || order.orderNo,
      title: order.customerName || "Restaurant order",
      deletedBy: user.name,
      details: `${orderTypeLabel(order)} | ₹${Number(order.grandTotal || 0).toFixed(2)}`,
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
    for (const order of orders) {
      await restoreOrderInventory(order, "All orders cleared");
    }
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
    // Optional filters so each screen can ask for just what it shows, and .lean()
    // because hydrating hundreds of Mongoose documents is the slow part here.
    const { status, paymentStatus, from, to, limit } = req.query;
    const filter = {};
    if (status) filter.status = { $in: String(status).split(",") };
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const query = RestaurantOrder.find(filter).sort({ createdAt: -1 }).lean();
    const cap = Number(limit);
    if (Number.isFinite(cap) && cap > 0) query.limit(cap);

    const orders = await query;
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

// Counter-side order flow: new -> accepted (counter) -> KOT sent (counter) ->
// preparing/ready (kitchen, via item-status on the KDS) -> served (counter).
// Returns an error message when the counter may not move `order` to `next`.
const counterTransitionError = (order, next) => {
  if (order.status === "cancelled") return "This order is already cancelled";
  if (order.status === "served" && next !== "served") return "This order is already served";

  switch (next) {
    case "accepted":
      return order.status === "new" ? null : "Only new orders can be accepted";
    case "served":
      return order.kotSentAt ? null : "Send the KOT to the kitchen before serving";
    case "cancelled":
      return null;
    case "preparing":
    case "ready":
      return "The kitchen updates this from the Kitchen Display after receiving the KOT";
    default:
      return "Invalid order status";
  }
};

exports.updateRestaurantOrderStatus = async (req, res) => {
  try {
    const next = req.body.status;
    const before = await RestaurantOrder.findById(req.params.id);
    if (!before) {
      return res.status(404).json({ message: "Order not found" });
    }

    const transitionError = counterTransitionError(before, next);
    if (transitionError) {
      return res.status(400).json({ message: transitionError });
    }

    const update = { status: next };
    if (next === "served") update["items.$[].itemStatus"] = "SERVED";
    const order = await RestaurantOrder.findByIdAndUpdate(req.params.id, update, { new: true });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Cancelled before being cooked/served: the ingredients were never used.
    if (next === "cancelled" && before.status !== "cancelled") {
      await restoreOrderInventory(order).catch(() => {});
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

// --- Counter: send the KOT (kitchen order ticket) for an accepted order ---
// The order only appears on the Kitchen Display once this is done.
exports.sendKOT = async (req, res) => {
  try {
    const order = await RestaurantOrder.findById(req.params.id);

    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status === "new") {
      return res.status(400).json({ message: "Accept the order before sending the KOT" });
    }
    if (["served", "cancelled"].includes(order.status)) {
      return res.status(400).json({ message: `This order is already ${order.status}` });
    }

    // Re-sending (e.g. a reprint) keeps the original time so kitchen timers stay right.
    if (!order.kotSentAt) {
      order.kotSentAt = new Date();
      order.kotSentBy = req.user?.name || "";
      await order.save();
    }

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- KDS: kitchen updates item status (accept KOT -> cooking -> ready) ---
// Serving is the counter's step (updateRestaurantOrderStatus -> "served").
exports.updateOrderItemStatus = async (req, res) => {
  try {
    const { itemIndex, itemStatus, applyToAll } = req.body;
    const allowed = ["ACCEPTED", "COOKING", "READY"];
    if (!allowed.includes(itemStatus)) {
      return res.status(400).json({ message: "Invalid item status" });
    }

    const order = await RestaurantOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!order.kotSentAt) {
      return res.status(400).json({ message: "The counter hasn't sent the KOT for this order yet" });
    }
    if (["served", "cancelled"].includes(order.status)) {
      return res.status(400).json({ message: `This order is already ${order.status}` });
    }

    // KDS "mark all" action -- bumps every item on the KOT to the same status in one
    // tap instead of clicking through each item individually.
    if (applyToAll) {
      order.items.forEach((item) => {
        item.itemStatus = itemStatus;
      });
    } else {
      if (!order.items[itemIndex]) {
        return res.status(400).json({ message: "Invalid item index" });
      }
      order.items[itemIndex].itemStatus = itemStatus;
    }

    const allStatuses = order.items.map((item) => item.itemStatus);
    if (allStatuses.every((s) => s === "READY" || s === "SERVED")) order.status = "ready";
    else if (allStatuses.some((s) => s === "COOKING" || s === "READY")) order.status = "preparing";
    else order.status = "accepted";

    await order.save();
    await syncTableForOrder(order).catch(() => {});

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- KDS: orders the counter has sent to the kitchen and not yet served ---
exports.getKitchenOrders = async (req, res) => {
  try {
    const orders = await RestaurantOrder.find({
      kotSentAt: { $ne: null },
      status: { $nin: ["served", "cancelled"] },
    }).sort({ kotSentAt: 1 });

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
    // The source's items (and their deducted ingredients) now live on the target.
    if (source.inventoryDeducted) target.inventoryDeducted = true;
    await target.save();

    source.status = "cancelled";
    source.mergedInto = target._id;
    source.inventoryDeducted = false;
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
      kotSentAt: order.kotSentAt,
      kotSentBy: order.kotSentBy,
      inventoryDeducted: order.inventoryDeducted,
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
