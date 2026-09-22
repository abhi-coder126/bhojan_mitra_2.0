const Sale = require("../models/Sale");
const Product = require("../models/Product");
const SalesReturn = require("../models/SalesReturn");
const StockTransaction = require("../models/StockTransaction");
const DeletionLog = require("../models/DeletionLog");
const { verifyDeletePassword } = require("../utils/deleteAuth");
const { logAudit, getActor } = require("../utils/auditLog");

exports.getSalesReturns = async (req, res) => {
  try {
    const returns = await SalesReturn.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      returns,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Sales return fetch error",
      error: error.message,
    });
  }
};

exports.deleteSalesReturn = async (req, res) => {
  try {
    const user = await verifyDeletePassword(req);
    const salesReturn = await SalesReturn.findById(req.params.id);

    if (!salesReturn) {
      return res.status(404).json({
        success: false,
        message: "Sales return not found",
      });
    }

    for (const item of salesReturn.products || []) {
      if (!item.productId) continue;

      const product = await Product.findById(item.productId);

      if (product) {
        const before = Number(product.stock || 0);
        const qty = Number(item.qty || 0);
        const after = before - qty;

        if (after < 0) {
          return res.status(400).json({
            success: false,
            message: `${product.name} stock is not enough to reverse return`,
          });
        }

        product.stock = after;
        await product.save();

        await StockTransaction.create({
          productId: product._id,
          productName: product.name,
          barcode: product.barcode,
          type: "OUT",
          source: "SALE",
          sourceNo: salesReturn.returnNo || salesReturn.invoiceNo,
          qty,
          stockBefore: before,
          stockAfter: after,
          customerName: salesReturn.customerName,
        });
      }
    }

    await SalesReturn.findByIdAndDelete(req.params.id);
    await DeletionLog.create({
      recordType: "Sales Return",
      recordNo: salesReturn.returnNo || salesReturn.invoiceNo,
      title: salesReturn.customerName || "",
      deletedBy: user.name,
      details: `Invoice ${salesReturn.invoiceNo} | Rs ${Number(salesReturn.returnAmount || 0).toFixed(2)}`,
    });

    res.json({
      success: true,
      message: "Sales return deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Sales return delete error",
      error: error.message,
    });
  }
};

exports.getInvoiceForReturn = async (req, res) => {
  try {
    const sale = await Sale.findOne({ invoiceNo: req.params.invoiceNo });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    const previousReturns = await SalesReturn.find({ saleId: sale._id });
    const returnedByProduct = new Map();

    previousReturns.forEach((salesReturn) => {
      (salesReturn.products || []).forEach((item) => {
        const key = String(item.productId || item.barcode || item.name);
        returnedByProduct.set(key, (returnedByProduct.get(key) || 0) + Number(item.qty || 0));
      });
    });

    const products = (sale.products || []).map((item) => {
      const key = String(item.productId || item.barcode || item.name);
      const alreadyReturnedQty = returnedByProduct.get(key) || 0;
      const returnableQty = Math.max(Number(item.qty || 0) - alreadyReturnedQty, 0);

      return {
        ...item.toObject(),
        soldQty: Number(item.qty || 0),
        alreadyReturnedQty,
        returnableQty,
      };
    });

    res.json({
      success: true,
      sale: {
        ...sale.toObject(),
        products,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: "Invoice fetch for return failed",
      error: error.message,
    });
  }
};

exports.createSalesReturn = async (req, res) => {
  try {
    const { saleId, products } = req.body;

    if (!saleId || !products || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Return invoice and products are required",
      });
    }

    const sale = await Sale.findById(saleId);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    const previousReturns = await SalesReturn.find({ saleId: sale._id });
    const returnedByProduct = new Map();

    previousReturns.forEach((salesReturn) => {
      (salesReturn.products || []).forEach((item) => {
        const key = String(item.productId || item.barcode || item.name);
        returnedByProduct.set(key, (returnedByProduct.get(key) || 0) + Number(item.qty || 0));
      });
    });

    let returnAmount = 0;
    const finalProducts = [];

    for (const item of products) {
      const saleItem = (sale.products || []).find(
        (p) => String(p.productId) === String(item.productId)
      );

      if (!saleItem) {
        return res.status(400).json({
          success: false,
          message: `${item.name || "Product"} was not found in this invoice`,
        });
      }

      const key = String(saleItem.productId || saleItem.barcode || saleItem.name);
      const alreadyReturnedQty = returnedByProduct.get(key) || 0;
      const returnableQty = Math.max(Number(saleItem.qty || 0) - alreadyReturnedQty, 0);
      const qty = Number(item.qty || 0);

      if (qty <= 0 || qty > returnableQty) {
        return res.status(400).json({
          success: false,
          message: `${saleItem.name} return qty must be between 1 and ${returnableQty}`,
        });
      }

      const base = Number(saleItem.rate || 0) * qty;
      const originalDiscountPerQty =
        Number(saleItem.discount || 0) / Math.max(Number(saleItem.qty || 1), 1);
      const discount = originalDiscountPerQty * qty;
      const gst = ((base - discount) * Number(saleItem.gst || 0)) / 100;
      const total = base - discount + gst;

      returnAmount += total;

      finalProducts.push({
        productId: saleItem.productId,
        name: saleItem.name,
        barcode: saleItem.barcode,
        qty,
        rate: Number(saleItem.rate || 0),
        gst: Number(saleItem.gst || 0),
        total,
      });

      const product = await Product.findById(saleItem.productId);

      if (product) {
        const before = Number(product.stock || 0);
        const after = before + qty;
        product.stock = after;
        await product.save();

        await StockTransaction.create({
          productId: product._id,
          productName: product.name,
          barcode: product.barcode,
          type: "IN",
          source: "SALES_RETURN",
          sourceNo: sale.invoiceNo,
          qty,
          stockBefore: before,
          stockAfter: after,
          customerName: sale.customerName,
        });
      }
    }

    const salesReturn = await SalesReturn.create({
      returnNo: `SR-${Date.now()}`,
      invoiceNo: sale.invoiceNo,
      saleId: sale._id,
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      products: finalProducts,
      returnAmount,
    });

    await logAudit({
      actor: getActor(req),
      action: "sales_return",
      entity: "Sale",
      entityId: sale._id,
      field: "returnAmount",
      oldValue: null,
      newValue: returnAmount,
    });

    res.status(201).json({
      success: true,
      salesReturn,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Sales return create error",
      error: error.message,
    });
  }
};
