const RawMaterial = require("../models/RawMaterial");
const Recipe = require("../models/Recipe");
const InventoryTransaction = require("../models/InventoryTransaction");
const { applyMovement } = require("../utils/inventory");
const { logAudit, getActor } = require("../utils/auditLog");

const UNITS = ["kg", "g", "litre", "ml", "pcs", "dozen", "pack"];
const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

exports.getRawMaterials = async (req, res) => {
  try {
    const materials = await RawMaterial.find().sort({ name: 1 });
    res.json({ success: true, materials });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createRawMaterial = async (req, res) => {
  try {
    const { unit, vendorId, vendorName } = req.body;
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Raw material name required" });
    if (unit && !UNITS.includes(unit)) return res.status(400).json({ message: "Invalid unit" });

    const exists = await RawMaterial.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
    if (exists) return res.status(400).json({ message: `${exists.name} already exists` });

    const openingStock = Math.max(Number(req.body.stock || 0), 0);
    const costPerUnit = Math.max(Number(req.body.costPerUnit || 0), 0);

    const material = await RawMaterial.create({
      name,
      unit: unit || "kg",
      stock: 0,
      costPerUnit,
      lowStockThreshold: Math.max(Number(req.body.lowStockThreshold ?? 5), 0),
      vendorId: vendorId || undefined,
      vendorName: vendorName || "",
    });

    // Opening stock goes through the ledger like any other stock change.
    const withStock = openingStock
      ? await applyMovement(material._id, openingStock, {
          type: "opening",
          unitCost: costPerUnit,
          note: "Opening stock",
          actor: getActor(req),
        })
      : material;

    res.status(201).json({ success: true, material: withStock || material });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Edits details only. Stock changes must go through a movement so they're recorded.
exports.updateRawMaterial = async (req, res) => {
  try {
    const update = {};
    if (req.body.name !== undefined) {
      update.name = String(req.body.name).trim();
      if (!update.name) return res.status(400).json({ message: "Name can't be empty" });
    }
    if (req.body.unit !== undefined) {
      if (!UNITS.includes(req.body.unit)) return res.status(400).json({ message: "Invalid unit" });
      update.unit = req.body.unit;
    }
    if (req.body.costPerUnit !== undefined) update.costPerUnit = Math.max(Number(req.body.costPerUnit || 0), 0);
    if (req.body.lowStockThreshold !== undefined) {
      update.lowStockThreshold = Math.max(Number(req.body.lowStockThreshold || 0), 0);
    }
    if (req.body.vendorName !== undefined) update.vendorName = String(req.body.vendorName || "");

    const material = await RawMaterial.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!material) return res.status(404).json({ message: "Raw material not found" });

    // Keep recipe snapshots (name/unit) in step with the material.
    if (update.name || update.unit) {
      await Recipe.updateMany(
        { "items.rawMaterialId": material._id },
        { $set: { "items.$[i].rawMaterialName": material.name, "items.$[i].unit": material.unit } },
        { arrayFilters: [{ "i.rawMaterialId": material._id }] }
      );
    }

    res.json({ success: true, material });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteRawMaterial = async (req, res) => {
  try {
    const material = await RawMaterial.findById(req.params.id);
    if (!material) return res.status(404).json({ message: "Raw material not found" });

    const usedIn = await Recipe.find({ "items.rawMaterialId": material._id }).select("productName").lean();
    if (usedIn.length > 0) {
      return res.status(400).json({
        message: `${material.name} is used in: ${usedIn.map((r) => r.productName).join(", ")}. Remove it from those recipes first.`,
      });
    }

    await RawMaterial.findByIdAndDelete(material._id);
    await logAudit({
      actor: getActor(req),
      action: "raw_material_deleted",
      entity: "RawMaterial",
      entityId: material._id,
      oldValue: `${material.name} (${material.stock} ${material.unit})`,
    });
    res.json({ success: true, message: "Raw material deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /raw-materials/:id/movements
//   purchase: { qty, unitCost }  stock received; re-prices at weighted average cost
//   wastage:  { qty, note }      spoiled / expired / spilled
//   count:    { qty, note }      physical count -- sets stock to qty, records the difference
exports.recordMovement = async (req, res) => {
  try {
    const { type } = req.body;
    const qty = Number(req.body.qty);
    const note = String(req.body.note || "").trim().slice(0, 200);

    const material = await RawMaterial.findById(req.params.id);
    if (!material) return res.status(404).json({ message: "Raw material not found" });

    let change;
    let movementType;
    let unitCost;

    if (type === "purchase") {
      if (!(qty > 0)) return res.status(400).json({ message: "Enter the quantity received" });
      unitCost = Number(req.body.unitCost);
      if (!(unitCost >= 0)) return res.status(400).json({ message: "Enter the purchase price per unit" });
      change = qty;
      movementType = "purchase";
    } else if (type === "wastage") {
      if (!(qty > 0)) return res.status(400).json({ message: "Enter the quantity wasted" });
      if (!note) return res.status(400).json({ message: "Add a reason for the wastage" });
      change = -qty;
      movementType = "wastage";
    } else if (type === "count") {
      if (!(qty >= 0)) return res.status(400).json({ message: "Enter the counted stock" });
      change = qty - Number(material.stock || 0);
      movementType = "adjustment";
      if (Math.abs(change) < 0.0005) {
        return res.json({ success: true, material, message: "Stock already matches the count" });
      }
    } else {
      return res.status(400).json({ message: "Invalid stock movement" });
    }

    const updated = await applyMovement(material._id, change, {
      type: movementType,
      unitCost,
      reference: String(req.body.reference || "").trim().slice(0, 60),
      note: note || (movementType === "adjustment" ? "Physical count" : ""),
      actor: getActor(req),
    });

    if (movementType !== "purchase") {
      await logAudit({
        actor: getActor(req),
        action: movementType === "wastage" ? "stock_wastage" : "stock_adjustment",
        entity: "RawMaterial",
        entityId: material._id,
        field: "stock",
        oldValue: material.stock,
        newValue: updated?.stock,
      });
    }

    res.json({ success: true, material: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /raw-materials/ledger?materialId=&type=&from=YYYY-MM-DD&to=YYYY-MM-DD
exports.getLedger = async (req, res) => {
  try {
    const filter = {};
    if (req.query.materialId) filter.materialId = req.query.materialId;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(`${req.query.from}T00:00:00+05:30`);
      if (req.query.to) filter.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999+05:30`);
    }

    const entries = await InventoryTransaction.find(filter).sort({ createdAt: -1 }).limit(500);
    res.json({ success: true, entries });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /raw-materials/summary -- headline numbers for the inventory overview.
exports.getSummary = async (req, res) => {
  try {
    const materials = await RawMaterial.find();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const totals = await InventoryTransaction.aggregate([
      { $match: { createdAt: { $gte: since }, type: { $in: ["purchase", "consumption", "reversal", "wastage"] } } },
      { $group: { _id: "$type", value: { $sum: "$value" } } },
    ]);
    const byType = Object.fromEntries(totals.map((row) => [row._id, row.value]));

    res.json({
      success: true,
      summary: {
        materials: materials.length,
        stockValue: round2(materials.reduce((sum, m) => sum + Math.max(m.stock, 0) * Number(m.costPerUnit || 0), 0)),
        lowStock: materials.filter((m) => m.stock > 0 && m.stock <= m.lowStockThreshold).length,
        outOfStock: materials.filter((m) => m.stock <= 0).length,
        last30Days: {
          purchased: round2(byType.purchase || 0),
          // consumption is stored negative; reversals give some of it back
          consumed: round2(-(byType.consumption || 0) - (byType.reversal || 0)),
          wasted: round2(-(byType.wastage || 0)),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getLowStockAlerts = async (req, res) => {
  try {
    const materials = await RawMaterial.find().sort({ stock: 1 });
    const lowStock = materials.filter((m) => Number(m.stock || 0) <= Number(m.lowStockThreshold || 0));
    res.json({ success: true, count: lowStock.length, lowStock });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
