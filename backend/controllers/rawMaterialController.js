const RawMaterial = require("../models/RawMaterial");
const { logAudit, getActor } = require("../utils/auditLog");

exports.getRawMaterials = async (req, res) => {
  try {
    const filter = {};
    if (req.query.branchId) filter.branchId = req.query.branchId;
    const materials = await RawMaterial.find(filter).sort({ name: 1 });
    res.json({ success: true, materials });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createRawMaterial = async (req, res) => {
  try {
    const { name, unit, stock, costPerUnit, lowStockThreshold, vendorId, vendorName } = req.body;
    if (!name) return res.status(400).json({ message: "Raw material name required" });

    const material = await RawMaterial.create({
      name,
      branchId: req.body.branchId || req.query.branchId || undefined,
      unit: unit || "kg",
      stock: Number(stock || 0),
      costPerUnit: Number(costPerUnit || 0),
      lowStockThreshold: Number(lowStockThreshold || 5),
      vendorId: vendorId || undefined,
      vendorName: vendorName || "",
    });

    res.status(201).json({ success: true, material });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateRawMaterial = async (req, res) => {
  try {
    const material = await RawMaterial.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!material) return res.status(404).json({ message: "Raw material not found" });
    res.json({ success: true, material });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteRawMaterial = async (req, res) => {
  try {
    await RawMaterial.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Raw material deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.adjustStock = async (req, res) => {
  try {
    const { qty, mode = "add" } = req.body; // mode: add | reduce | set
    const material = await RawMaterial.findById(req.params.id);
    if (!material) return res.status(404).json({ message: "Raw material not found" });

    const before = material.stock;
    if (mode === "add") material.stock += Number(qty || 0);
    else if (mode === "reduce") material.stock = Math.max(material.stock - Number(qty || 0), 0);
    else material.stock = Number(qty || 0);

    await material.save();

    await logAudit({
      actor: getActor(req),
      action: "stock_adjustment",
      entity: "RawMaterial",
      entityId: material._id,
      field: "stock",
      oldValue: before,
      newValue: material.stock,
    });

    res.json({ success: true, material });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getLowStockAlerts = async (req, res) => {
  try {
    const materials = await RawMaterial.find();
    const lowStock = materials.filter(
      (m) => Number(m.stock || 0) <= Number(m.lowStockThreshold || 0)
    );
    res.json({ success: true, count: lowStock.length, lowStock });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
