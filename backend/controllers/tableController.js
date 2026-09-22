const Table = require("../models/Table");
const RestaurantOrder = require("../models/RestaurantOrder");

exports.getTables = async (req, res) => {
  try {
    const filter = {};
    if (req.query.branchId) filter.branchId = req.query.branchId;
    const tables = await Table.find(filter).sort({ floor: 1, number: 1 });
    res.json({ success: true, tables });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createTable = async (req, res) => {
  try {
    const { number, floor, section, capacity, notes } = req.body;
    if (!number) {
      return res.status(400).json({ message: "Table number required" });
    }

    const exists = await Table.findOne({ number: String(number).trim() });
    if (exists) {
      return res.status(400).json({ message: "Table number already exists" });
    }

    const table = await Table.create({
      number: String(number).trim(),
      branchId: req.body.branchId || req.query.branchId || undefined,
      floor: floor || "Ground Floor",
      section: section || "Main",
      capacity: Number(capacity || 4),
      notes: notes || "",
    });

    res.status(201).json({ success: true, table });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateTable = async (req, res) => {
  try {
    const { number, floor, section, capacity, notes } = req.body;
    const table = await Table.findByIdAndUpdate(
      req.params.id,
      {
        ...(number ? { number: String(number).trim() } : {}),
        ...(floor ? { floor } : {}),
        ...(section ? { section } : {}),
        ...(capacity ? { capacity: Number(capacity) } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
      { new: true }
    );

    if (!table) return res.status(404).json({ message: "Table not found" });
    res.json({ success: true, table });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateTableStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["available", "occupied", "reserved", "cleaning", "billing"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid table status" });
    }

    const update = { status };
    if (status === "available") update.currentOrderId = null;

    const table = await Table.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!table) return res.status(404).json({ message: "Table not found" });

    res.json({ success: true, table });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteTable = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ message: "Table not found" });
    if (table.status === "occupied" || table.status === "billing") {
      return res.status(400).json({ message: "Cannot delete a table that is currently in use" });
    }

    await Table.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Table deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Sync table status/currentOrderId whenever restaurant orders change status.
exports.syncTableForOrder = async (order) => {
  if (!order || !order.tableNo || order.tableNo === "DELIVERY") return;

  const table = await Table.findOne({ number: order.tableNo });
  if (!table) return;

  if (["cancelled", "served"].includes(order.status) && order.paymentStatus === "paid") {
    table.status = "cleaning";
    table.currentOrderId = null;
  } else if (order.status === "cancelled") {
    table.status = "available";
    table.currentOrderId = null;
  } else {
    table.status = order.paymentStatus === "paid" ? "billing" : "occupied";
    table.currentOrderId = order._id;
  }

  await table.save();
};

exports.seedTables = async (req, res) => {
  try {
    const { count = 28 } = req.body;
    const existing = await Table.countDocuments();
    if (existing > 0) {
      return res.status(400).json({ message: "Tables already exist. Delete them first to reseed." });
    }

    const docs = Array.from({ length: Number(count) }, (_, i) => ({
      number: String(i + 1),
      floor: "Ground Floor",
      section: "Main",
      capacity: 4,
    }));

    const tables = await Table.insertMany(docs);
    res.status(201).json({ success: true, tables });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
