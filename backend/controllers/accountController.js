const Purchase = require("../models/Purchase");
const Vendor = require("../models/Vendor");
const VendorPayment = require("../models/VendorPayment");

exports.getPendingSupplierBills = async (req, res) => {
  try {
    const bills = await Purchase.find({
      pendingAmount: { $gt: 0 },
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      bills,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Pending bills fetch error",
      error: error.message,
    });
  }
};

exports.addVendorPayment = async (req, res) => {
  try {
    const {
      purchaseId,
      paymentAmount,
      paymentMode,
      paymentNote,
      referenceNumber,
    } = req.body;

    const purchase = await Purchase.findById(purchaseId);

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Supplier bill not found",
      });
    }

    const amount = Number(paymentAmount || 0);

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payment amount required",
      });
    }

    if (amount > Number(purchase.pendingAmount || 0)) {
      return res.status(400).json({
        success: false,
        message: "Payment amount cannot be greater than pending amount",
      });
    }

    const alreadyPaid = Number(purchase.paidAmount || 0);
    const pendingBefore = Number(purchase.pendingAmount || 0);

    purchase.paidAmount = alreadyPaid + amount;
    purchase.pendingAmount = Math.max(
      Number(purchase.grandTotal || 0) - Number(purchase.paidAmount || 0),
      0
    );

    await purchase.save();

    await Vendor.findByIdAndUpdate(purchase.vendorId, {
      $inc: {
        paidAmount: amount,
        pendingAmount: -amount,
      },
    });

    const payment = await VendorPayment.create({
      vendorId: purchase.vendorId,
      vendorName: purchase.vendorName,
      purchaseId: purchase._id,
      supplierBillNumber: purchase.invoiceNo,
      totalBillAmount: purchase.grandTotal,
      alreadyPaidAmount: alreadyPaid,
      pendingAmount: pendingBefore,
      paymentAmount: amount,
      paymentMode,
      paymentNote,
      referenceNumber,
    });

    res.status(201).json({
      success: true,
      message: "Vendor payment added successfully",
      payment,
      purchase,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Vendor payment error",
      error: error.message,
    });
  }
};

exports.getVendorPayments = async (req, res) => {
  try {
    const payments = await VendorPayment.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      payments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Vendor payment history error",
      error: error.message,
    });
  }
};