const Sale = require("../models/Sale");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const StockTransaction = require("../models/StockTransaction");
const DeletionLog = require("../models/DeletionLog");
const SalesReturn = require("../models/SalesReturn");
const { verifyDeletePassword } = require("../utils/deleteAuth");
const { nextCustomerCrn, tagCustomerWithCurrentBranch } = require("../utils/customerUpsert");
const { consumeIngredients, returnIngredients } = require("../utils/inventory");

// Gives a POS bill's ingredients back to raw-material stock (bill deleted). The flag
// is claimed atomically so the same bill can never be returned twice.
const restoreSaleInventory = async (sale, note) => {
  const claimed = await Sale.findOneAndUpdate({ _id: sale._id, inventoryDeducted: true }, { inventoryDeducted: false });
  if (claimed) await returnIngredients(claimed.products, { reference: claimed.invoiceNo, note });
};
const { earnLoyaltyPoints } = require("./customerController");
const { nextInvoiceNo: invoiceNo } = require("../utils/invoiceNumber");

const normalizeContact = (value) => String(value || "").trim();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

exports.createSale = async (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      customerAddress,
      customerEmail,
      customerGST,
      products,
      payment,
      billDiscount,
      couponCode,
      couponDiscount,
      discountReason,
      totalDiscount,
    } = req.body;

    if (!customerName || !customerPhone || !customerAddress) {
      return res.status(400).json({ message: "Customer details required" });
    }

    if (!products || products.length === 0) {
      return res.status(400).json({ message: "Products required" });
    }

    let subTotal = 0;
    let gstAmount = 0;
    let discount = 0;
    let finalProducts = [];

    for (const item of products) {
      const product = await Product.findById(item.productId);

      if (!product) return res.status(404).json({ message: "Product not found" });

      const qty = Number(item.qty);
      const rate = Number(item.rate);

      if (!Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ message: `Invalid quantity for ${product.name}` });
      }

      if (!Number.isFinite(rate) || rate < 0) {
        return res.status(400).json({ message: `Invalid rate for ${product.name}` });
      }

      if (qty > Number(product.stock)) {
        return res.status(400).json({
          message: `${product.name} stock not available`,
        });
      }

      // POS `rate` is entered as the tax-EXCLUSIVE price (standard retail tax-invoice
      // convention: GST is computed and shown as a separate line added on top). This is
      // intentionally different from the restaurant QR menu, where `product.mrp` is the
      // tax-INCLUSIVE price printed on the menu and GST is backed out of it instead --
      // see restaurantOrderController.createRestaurantOrder. Don't "unify" these without
      // updating whichever channel's product pricing/display depends on the convention.
      const lineAmount = rate * qty;
      const itemDiscount = Math.min(Math.max(Number(item.discount || 0), 0), lineAmount);
      const lineGST = ((lineAmount - itemDiscount) * Number(product.gst || 0)) / 100;
      const lineTotal = lineAmount - itemDiscount + lineGST;

      subTotal += lineAmount;
      gstAmount += lineGST;
      discount += itemDiscount;

      finalProducts.push({
        productId: product._id, // Required: productId must be present
        name: product.name,
        barcode: product.barcode,
        qty,
        unit: item.unit,
        mrp: product.mrp,
        rate,
        gst: product.gst,
        discount: itemDiscount,
        total: lineTotal,
        purchasePrice: product.purchasePrice,
      });

      const before = Number(product.stock);
      const after = before - qty;

      product.stock = after;
      await product.save();

      await StockTransaction.create({
        productId: product._id,
        productName: product.name,
        barcode: product.barcode,
        type: "OUT",
        source: "SALE",
        sourceNo: "PENDING",
        qty,
        stockBefore: before,
        stockAfter: after,
        customerName,
      });
    }

    const billDiscountAmount = Number(billDiscount || 0);
    const couponDiscountAmount = Number(couponDiscount || 0);
    const totalDiscountAmount =
      discount + billDiscountAmount + couponDiscountAmount;
    const grandTotal = Math.max(subTotal + gstAmount - totalDiscountAmount, 0);

    const cash = Number(payment?.cash || 0);
    const card = Number(payment?.card || 0);
    const upi = Number(payment?.upi || 0);
    const credit = Number(payment?.credit || 0);

    const paidAmount = cash + card + upi;
    const pendingAmount = Math.max(grandTotal - paidAmount, credit);
    const contact = normalizeContact(customerPhone);
    const email = normalizeEmail(customerEmail);
    let customer = await Customer.findOne({
      $or: [{ contact }, ...(email ? [{ email }] : [])],
    }).sort({ createdAt: 1 });

    if (!customer) {
      customer = await Customer.create({
        crn: await nextCustomerCrn(),
        name: customerName,
        contact,
        address: customerAddress || "",
        email,
        activeFrom: new Date(),
      });
    } else {
      customer.name = customerName || customer.name;
      customer.contact = customer.contact || contact;
      customer.address = customerAddress || customer.address || "";
      customer.email = email || customer.email || "";
      await customer.save();
    }
    await tagCustomerWithCurrentBranch(customer._id);

    const sale = await Sale.create({
      invoiceNo: await invoiceNo(),
      customerId: customer._id,
      customerName,
      customerPhone,
      customerAddress,
      customerEmail,
      customerGST,
      products: finalProducts,
      subTotal,
      gstAmount,
      discount,
      grandTotal,
      billDiscount: billDiscountAmount,
      couponCode: couponCode || "",
      couponDiscount: couponDiscountAmount,
      discountReason: discountReason || "",
      totalDiscount: Number(totalDiscount || totalDiscountAmount || 0),
      payment: { cash, card, upi, credit: pendingAmount },
      paidAmount,
      pendingAmount,
      paymentStatus: pendingAmount > 0 ? "Partial" : "Paid",
    });

    await StockTransaction.updateMany(
      { sourceNo: "PENDING", customerName },
      { sourceNo: sale.invoiceNo }
    );

    try {
      if (await consumeIngredients(finalProducts, { reference: sale.invoiceNo, actor: req.user?.name })) {
        await Sale.updateOne({ _id: sale._id }, { inventoryDeducted: true });
      }
    } catch (error) {
      console.error("Ingredient deduction failed:", error.message);
    }
    await earnLoyaltyPoints(customer._id, grandTotal).catch(() => {});

    res.status(201).json({ success: true, sale });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSales = async (req, res) => {
  try {
    const sales = await Sale.find().sort({ createdAt: -1 });
    res.json({ success: true, sales });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getLatestSale = async (req, res) => {
  try {
    const sale = await Sale.findOne().sort({ createdAt: -1 });

    res.json({
      success: true,
      sale,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteSale = async (req, res) => {
  try {
    const user = await verifyDeletePassword(req);
    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    // Items already sent back via a sales return already had their stock restored
    // at return time -- only restore the portion that was never returned, or a
    // deleted invoice with a prior return would double-credit stock.
    const previousReturns = await SalesReturn.find({ saleId: sale._id });
    const returnedByProduct = new Map();
    previousReturns.forEach((salesReturn) => {
      (salesReturn.products || []).forEach((item) => {
        const key = String(item.productId);
        returnedByProduct.set(key, (returnedByProduct.get(key) || 0) + Number(item.qty || 0));
      });
    });

    for (const item of sale.products || []) {
      if (!item.productId) continue;

      const key = String(item.productId);
      const alreadyReturnedQty = returnedByProduct.get(key) || 0;
      const restoreQty = Math.max(Number(item.qty || 0) - alreadyReturnedQty, 0);

      if (restoreQty <= 0) continue;

      const product = await Product.findById(item.productId);

      if (product) {
        const before = Number(product.stock || 0);
        const after = before + restoreQty;

        product.stock = after;

        await product.save();
      }
    }

    await restoreSaleInventory(sale, "Bill deleted");
    await Sale.findByIdAndDelete(req.params.id);
    await DeletionLog.create({
      recordType: "POS Invoice",
      recordNo: sale.invoiceNo,
      title: sale.customerName || "Counter sale",
      deletedBy: user.name,
      details: `₹${Number(sale.grandTotal || 0).toFixed(2)}`,
    });

    res.json({
      success: true,
      message: "Invoice deleted successfully",
    });
  } catch (error) {
    console.log("Invoice delete error:", error);

    res.status(error.statusCode || 500).json({
      success: false,
      message: "Invoice delete error",
      error: error.message,
    });
  }
};

exports.clearSales = async (req, res) => {
  try {
    const user = await verifyDeletePassword(req);
    const sales = await Sale.find();

    const stockByProduct = new Map();
    sales.forEach((sale) => {
      (sale.products || []).forEach((item) => {
        if (!item.productId) return;
        const key = String(item.productId);
        stockByProduct.set(key, (stockByProduct.get(key) || 0) + Number(item.qty || 0));
      });
    });

    if (stockByProduct.size > 0) {
      await Product.bulkWrite(
        Array.from(stockByProduct.entries()).map(([productId, qty]) => ({
          updateOne: {
            filter: { _id: productId },
            update: { $inc: { stock: qty } },
          },
        }))
      );
    }

    for (const sale of sales) {
      await restoreSaleInventory(sale, "All bills cleared");
    }
    const result = await Sale.deleteMany({});
    await DeletionLog.create({
      recordType: "POS Invoices",
      recordNo: "Bulk delete",
      title: "All POS invoices",
      deletedBy: user.name,
      details: `${result.deletedCount || 0} records deleted`,
    });

    res.json({
      success: true,
      deletedCount: result.deletedCount || 0,
      message: "All POS invoices deleted successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: "POS invoices clear error",
      error: error.message,
    });
  }
};
