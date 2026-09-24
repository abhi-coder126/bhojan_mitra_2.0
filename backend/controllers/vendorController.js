const Vendor = require("../models/Vendor");
const Purchase = require("../models/Purchase");
const VendorPayment = require("../models/VendorPayment");
const DeletionLog = require("../models/DeletionLog");
const { verifyDeletePassword } = require("../utils/deleteAuth");

exports.createVendor = async (req, res) => {
  try {
    const vendor = await Vendor.create(req.body);
    res.status(201).json({ success: true, vendor });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find().sort({ createdAt: -1 });
    res.json({ success: true, vendors });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json({ success: true, vendor });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteVendor = async (req, res) => {
  try {
    const user = await verifyDeletePassword(req);
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    await Vendor.findByIdAndDelete(req.params.id);
    await DeletionLog.create({
      recordType: "Vendor",
      recordNo: vendor.gstNumber || vendor.phone || "",
      title: vendor.name,
      deletedBy: user.name,
      details: `Pending ₹${Number(vendor.pendingAmount || 0).toFixed(2)}`,
    });
    res.json({ success: true, message: "Vendor deleted" });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

// --- Supplier ledger: all purchases (debits) + payments (credits) for a vendor, chronological ---
exports.getVendorLedger = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    const purchases = await Purchase.find({ vendorId: vendor._id }).sort({ purchaseDate: -1, createdAt: -1 });
    const payments = await VendorPayment.find({ vendorId: vendor._id }).sort({ paymentDate: -1, createdAt: -1 });

    const ledger = [
      ...purchases.map((p) => ({
        type: "purchase",
        date: p.purchaseDate || p.createdAt,
        refId: p._id,
        refNo: p.invoiceNo,
        debit: p.grandTotal,
        credit: p.paidAmount,
        balance: p.pendingAmount,
      })),
      ...payments.map((pay) => ({
        type: "payment",
        date: pay.paymentDate || pay.createdAt,
        refId: pay._id,
        refNo: pay.referenceNumber || pay.supplierBillNumber || "",
        debit: 0,
        credit: pay.paymentAmount,
        balance: null,
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      success: true,
      vendor,
      outstanding: Number(vendor.pendingAmount || 0),
      totalPurchase: Number(vendor.totalPurchase || 0),
      totalPaid: Number(vendor.paidAmount || 0),
      ledger,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
