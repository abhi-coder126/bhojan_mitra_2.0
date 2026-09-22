const mongoose = require("mongoose");

const vendorPaymentSchema = new mongoose.Schema(
  {
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
    vendorName: String,

    purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase" },
    supplierBillNumber: String,

    totalBillAmount: { type: Number, default: 0 },
    alreadyPaidAmount: { type: Number, default: 0 },
    pendingAmount: { type: Number, default: 0 },
    paymentAmount: { type: Number, default: 0 },

    paymentMode: {
      type: String,
      enum: ["Cash", "UPI", "Card", "Bank Transfer", "Other"],
      default: "Cash",
    },

    paymentDate: { type: Date, default: Date.now },
    paymentNote: { type: String, default: "" },
    referenceNumber: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("VendorPayment", vendorPaymentSchema);