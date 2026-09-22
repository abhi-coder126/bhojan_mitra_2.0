const Purchase = require("../models/Purchase");
const Product = require("../models/Product");
const Vendor = require("../models/Vendor");
const StockTransaction = require("../models/StockTransaction");
exports.createPurchase = async (req, res) => {
  try {
    const { vendorId, vendorName, invoiceNo, products, paidAmount, paymentMode } =
      req.body;

    let totalAmount = 0;
    let gstAmount = 0;
    const priceChanges = [];

    for (const item of products) {
      const product = await Product.findById(item.productId);
      if (!product) return res.status(404).json({ message: "Product not found" });

      // Price-change detection: compare against the last recorded purchase price for this product (any vendor)
      const lastPurchase = await Purchase.findOne({ "products.productId": product._id }).sort({ createdAt: -1 });
      if (lastPurchase) {
        const lastLine = [...(lastPurchase.products || [])]
          .reverse()
          .find((p) => String(p.productId) === String(product._id));
        const lastPrice = Number(lastLine?.purchasePrice || 0);
        const newPrice = Number(item.purchasePrice || 0);
        if (lastPrice > 0 && newPrice > 0 && lastPrice !== newPrice) {
          priceChanges.push({
            productId: product._id,
            name: product.name,
            previousPrice: lastPrice,
            newPrice,
            changePercent: Number((((newPrice - lastPrice) / lastPrice) * 100).toFixed(2)),
            previousVendor: lastPurchase.vendorName,
          });
        }
      }

      const qty = Number(item.qty);
      const before = Number(product.stock);
      const after = before + qty;

      product.stock = after;
      product.purchasePrice = Number(item.purchasePrice);
      product.sellingPrice = Number(item.sellingPrice);
      product.mrp = Number(item.mrp);
      product.gst = Number(item.gst);

      await product.save();

      const itemTotal = Number(item.purchasePrice) * qty;
      const itemGST = (itemTotal * Number(item.gst || 0)) / 100;

      totalAmount += itemTotal;
      gstAmount += itemGST;

      await StockTransaction.create({
        productId: product._id,
        productName: product.name,
        barcode: product.barcode,
        type: "IN",
        source: "PURCHASE",
        sourceNo: invoiceNo,
        qty,
        stockBefore: before,
        stockAfter: after,
        vendorName,
      });
    }

    const grandTotal = totalAmount + gstAmount;
    const pendingAmount = grandTotal - Number(paidAmount || 0);

    const purchase = await Purchase.create({
      vendorId,
      vendorName,
      invoiceNo,
      products,
      totalAmount,
      gstAmount,
      grandTotal,
      paidAmount: Number(paidAmount || 0),
      pendingAmount,
      paymentMode,
    });

    await Vendor.findByIdAndUpdate(vendorId, {
      $inc: {
        totalPurchase: grandTotal,
        paidAmount: Number(paidAmount || 0),
        pendingAmount,
      },
    });

    res.status(201).json({ success: true, purchase, priceChanges });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find().sort({ createdAt: -1 });
    res.json({ success: true, purchases });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.getPurchaseById = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);

    if (!purchase) {
      return res.status(404).json({ message: "GRN not found" });
    }

    res.json({ success: true, purchase });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updatePurchasePayment = async (req, res) => {
  try {
    const { paidAmount, paymentMode } = req.body;

    const purchase = await Purchase.findById(req.params.id);

    if (!purchase) {
      return res.status(404).json({ message: "GRN not found" });
    }

    const oldPaid = Number(purchase.paidAmount || 0);
    const newPaid = Number(paidAmount || 0);
    const diffPaid = newPaid - oldPaid;

    purchase.paidAmount = newPaid;
    purchase.pendingAmount = Math.max(Number(purchase.grandTotal) - newPaid, 0);
    purchase.paymentMode = paymentMode || purchase.paymentMode;

    await purchase.save();

    await Vendor.findByIdAndUpdate(purchase.vendorId, {
      $inc: {
        paidAmount: diffPaid,
        pendingAmount: -diffPaid,
      },
    });

    res.json({
      success: true,
      message: "GRN payment updated",
      purchase,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};exports.fullUpdatePurchase = async (req, res) => {
  try {
    const { products, paidAmount, paymentMode } = req.body;

    const purchase = await Purchase.findById(req.params.id);

    if (!purchase) {
      return res.status(404).json({ message: "GRN not found" });
    }

    for (const oldItem of purchase.products) {
      const product = await Product.findById(oldItem.productId);
      if (product) {
        product.stock = Number(product.stock || 0) - Number(oldItem.qty || 0);
        await product.save();
      }
    }

    let totalAmount = 0;
    let gstAmount = 0;

    for (const item of products) {
      const product = await Product.findById(item.productId);

      if (product) {
        product.stock = Number(product.stock || 0) + Number(item.qty || 0);
        product.purchasePrice = Number(item.purchasePrice || 0);
        product.sellingPrice = Number(item.sellingPrice || 0);
        product.mrp = Number(item.mrp || 0);
        product.gst = Number(item.gst || 0);
        product.unit = item.unit || product.unit;
        await product.save();
      }

      const base = Number(item.purchasePrice || 0) * Number(item.qty || 0);
      const gst = (base * Number(item.gst || 0)) / 100;

      item.total = base;
      totalAmount += base;
      gstAmount += gst;
    }

    const grandTotal = totalAmount + gstAmount;
    const newPaid = Number(paidAmount || 0);
    const oldPaid = Number(purchase.paidAmount || 0);
    const paidDiff = newPaid - oldPaid;
    const oldGrandTotal = Number(purchase.grandTotal || 0);
    const oldPendingAmount = Number(purchase.pendingAmount || 0);
    const newPendingAmount = Math.max(grandTotal - newPaid, 0);

    purchase.products = products;
    purchase.totalAmount = totalAmount;
    purchase.gstAmount = gstAmount;
    purchase.grandTotal = grandTotal;
    purchase.paidAmount = newPaid;
    purchase.pendingAmount = newPendingAmount;
    purchase.paymentMode = paymentMode || purchase.paymentMode;

    await purchase.save();

    // Apply this GRN's change as a delta, not an overwrite -- the vendor's
    // totalPurchase/pendingAmount are cumulative across all their purchases.
    await Vendor.findByIdAndUpdate(purchase.vendorId, {
      $inc: {
        paidAmount: paidDiff,
        totalPurchase: grandTotal - oldGrandTotal,
        pendingAmount: newPendingAmount - oldPendingAmount,
      },
    });

    res.json({
      success: true,
      message: "GRN fully updated",
      purchase,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};