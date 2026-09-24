const mongoose = require("mongoose");
const { branchScopePlugin } = require("../utils/tenant");
const Counter = require("./Counter");

const restaurantOrderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: { type: String, required: true },
    category: String,
    qty: { type: Number, required: true, min: 1 },
    rate: { type: Number, required: true, min: 0 },
    gst: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    total: { type: Number, required: true, min: 0 },
    itemStatus: {
      type: String,
      enum: ["NEW", "ACCEPTED", "COOKING", "READY", "SERVED"],
      default: "NEW",
    },
  },
  { _id: false }
);

const restaurantOrderSchema = new mongoose.Schema(
  {
    orderNo: { type: String, unique: true },
    invoiceNo: { type: String, unique: true, sparse: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    orderType: {
      type: String,
      enum: ["dine-in", "delivery"],
      default: "dine-in",
    },
    tableNo: { type: String, default: "", trim: true },
    // Set only when the customer was logged in (via email OTP) while placing the
    // order -- lets us show their order history without matching on phone/email text.
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    customerName: { type: String, trim: true },
    customerPhone: { type: String, trim: true },
    customerEmail: { type: String, trim: true },
    deliveryAddress: { type: String, trim: true },
    note: { type: String, trim: true },
    items: [restaurantOrderItemSchema],
    subTotal: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    couponCode: { type: String, default: "", trim: true },
    discountAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
    },
    payment: {
      mode: {
        type: String,
        enum: ["", "Cash", "UPI", "Card", "Partial"],
        default: "",
      },
      cash: { type: Number, default: 0 },
      upi: { type: Number, default: 0 },
      card: { type: Number, default: 0 },
      paidAt: Date,
    },
    status: {
      type: String,
      enum: ["new", "accepted", "preparing", "ready", "served", "cancelled"],
      default: "new",
    },
    orderSource: {
      type: String,
      enum: ["pos", "waiter", "qr"],
      default: "pos",
    },
    kotSentAt: Date,
    holdAt: Date,
    isHeld: { type: Boolean, default: false },
    kotSentBy: { type: String, default: "" },
    // True while this order's recipe ingredients are deducted from raw-material stock;
    // flipped back atomically when they are returned so they can never be returned twice.
    inventoryDeducted: { type: Boolean, default: false },
    splitFrom: { type: mongoose.Schema.Types.ObjectId, ref: "RestaurantOrder", default: null },
    mergedInto: { type: mongoose.Schema.Types.ObjectId, ref: "RestaurantOrder", default: null },
    discountReason: { type: String, default: "" },
    paidAmount: { type: Number, default: 0 },
    dueAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

restaurantOrderSchema.pre("save", async function setOrderNo() {
  if (this.orderNo) return;

  const [latestOrder] = await mongoose.model("RestaurantOrder").aggregate([
    { $match: { orderNo: /^DINE-\d+$/ } },
    {
      $project: {
        sequence: {
          $toInt: {
            $arrayElemAt: [{ $split: ["$orderNo", "-"] }, 1],
          },
        },
      },
    },
    { $sort: { sequence: -1 } },
    { $limit: 1 },
  ]);

  const highestSequence = Number(latestOrder?.sequence || 0);
  await Counter.updateOne(
    { _id: "restaurantOrder" },
    { $max: { seq: highestSequence } },
    { upsert: true }
  );

  const counter = await Counter.findByIdAndUpdate(
    "restaurantOrder",
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  this.orderNo = `DINE-${String(counter.seq).padStart(5, "0")}`;
});

restaurantOrderSchema.plugin(branchScopePlugin);

module.exports = mongoose.model("RestaurantOrder", restaurantOrderSchema);
