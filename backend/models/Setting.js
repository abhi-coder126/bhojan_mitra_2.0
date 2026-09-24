const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    storeName: { type: String, default: "" },
    storeShortName: { type: String, default: "POS" },
    storeAddress: { type: String, default: "" },
    gstNumber: { type: String, default: "" },
    storeContact: { type: String, default: "" },
    storeEmail: { type: String, default: "" },
    logo: { type: String, default: "" },

    invoicePrefix: { type: String, default: "INV" },
    invoicePrintSize: {
      type: String,
      enum: ["58MM", "80MM", "A4"],
      default: "80MM",
    },

    thankYouMessage: { type: String, default: "Thank you for shopping!" },
    termsAndConditions: { type: String, default: "" },
    returnPolicy: { type: String, default: "" },

    showStoreDetails: { type: Boolean, default: true },
    showGSTDetails: { type: Boolean, default: true },
    showCustomerDetails: { type: Boolean, default: true },
    showTerms: { type: Boolean, default: true },
    showReturnPolicy: { type: Boolean, default: true },
    showThankYou: { type: Boolean, default: true },
    qrCodeEnabled: { type: Boolean, default: true },

    cashEnabled: { type: Boolean, default: true },
    upiEnabled: { type: Boolean, default: true },
    cardEnabled: { type: Boolean, default: true },
    partialPaymentEnabled: { type: Boolean, default: true },
    bankTransferEnabled: { type: Boolean, default: false },

    restaurantOrderSoundEnabled: { type: Boolean, default: true },
    restaurantOrderRepeatSound: { type: Boolean, default: true },
    restaurantOrderPopupEnabled: { type: Boolean, default: true },
    restaurantOrderRefreshSeconds: { type: Number, default: 5 },
    restaurantTableCount: { type: Number, default: 28 },

    lowStockAlertQty: { type: Number, default: 5 },
    expiryAlertDays: { type: Number, default: 30 },

    // Multi-rate GST/tax configuration, e.g. [{ name: "GST 5%", percentage: 5 }, { name: "GST 18%", percentage: 18 }].
    // Existing per-product `gst` fields keep working unchanged; this is an additional configurable rate list
    // for stores that want to name/manage a fixed set of tax slabs from Settings.
    taxRates: {
      type: [
        {
          name: { type: String, required: true },
          percentage: { type: Number, required: true, default: 0 },
        },
      ],
      default: [
        { name: "GST 5%", percentage: 5 },
        { name: "GST 12%", percentage: 12 },
        { name: "GST 18%", percentage: 18 },
      ],
    },

    themeMode: {
      type: String,
      enum: ["light", "dark"],
      default: "light",
    },

    currencySymbol: { type: String, default: "₹" },
    dateFormat: {
      type: String,
      enum: ["DD-MM-YYYY", "MM-DD-YYYY", "YYYY-MM-DD"],
      default: "DD-MM-YYYY",
    },
    timezone: { type: String, default: "Asia/Kolkata" },

    whatsappNumber: { type: String, default: "" },
    businessOpenTime: { type: String, default: "09:00" },
    businessCloseTime: { type: String, default: "23:00" },

    // Session auto-logout, in minutes -- staff-side idle logout, separate from the
    // JWT's own 7-day expiry (see authController.login).
    sessionTimeoutMinutes: { type: Number, default: 60 },
    autoAcceptOrders: { type: Boolean, default: false },
    maintenanceMode: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Setting", settingSchema);
