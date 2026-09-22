const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true, trim: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    floor: { type: String, default: "Ground Floor", trim: true },
    section: { type: String, default: "Main", trim: true },
    capacity: { type: Number, default: 4, min: 1 },
    status: {
      type: String,
      enum: ["available", "occupied", "reserved", "cleaning", "billing"],
      default: "available",
    },
    currentOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "RestaurantOrder", default: null },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Table", tableSchema);
