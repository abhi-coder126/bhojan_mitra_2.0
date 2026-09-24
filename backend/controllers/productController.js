const Product = require("../models/Product");
const DeletionLog = require("../models/DeletionLog");
const { verifyDeletePassword } = require("../utils/deleteAuth");
const { logAudit, getActor } = require("../utils/auditLog");

exports.createProduct = async (req, res) => {
  try {
    const generatedCode = req.body.barcode || `MENU-${Date.now()}`;
    const mrp = Number(req.body.mrp || req.body.sellingPrice || 0);
    const exist = await Product.findOne({ barcode: generatedCode });

    if (exist) {
      return res.status(400).json({ message: "Menu item already exists" });
    }

    const product = await Product.create({
      ...req.body,
      barcode: generatedCode,
      purchasePrice: Number(req.body.purchasePrice || 0),
      sellingPrice: Number(req.body.sellingPrice || mrp),
      mrp,
      gst: Number(req.body.gst || 0),
      offerPercent: Math.min(100, Math.max(0, Number(req.body.offerPercent || 0))),
      unit: req.body.unit || "Plate",
      stock: Number(req.body.openingStock || req.body.stock || 9999),
      lowStockLimit: Number(req.body.lowStockLimit || 0),
    });

    res.status(201).json({ success: true, product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("vendorId", "name gstNumber phone")
      .sort({ createdAt: -1 });

    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.searchProducts = async (req, res) => {
  try {
    const keyword = req.query.keyword || "";

    const products = await Product.find({
      $or: [
        { name: { $regex: keyword, $options: "i" } },
        { barcode: { $regex: keyword, $options: "i" } },
        { sku: { $regex: keyword, $options: "i" } },
        { category: { $regex: keyword, $options: "i" } },
      ],
    }).limit(10);

    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const mrp = Number(req.body.mrp || req.body.sellingPrice || 0);
    const payload = {
      ...req.body,
      purchasePrice: Number(req.body.purchasePrice || 0),
      sellingPrice: Number(req.body.sellingPrice || mrp),
      mrp,
      gst: Number(req.body.gst || 0),
      offerPercent: Math.min(100, Math.max(0, Number(req.body.offerPercent || 0))),
      unit: req.body.unit || "Plate",
    };

    const existing = await Product.findById(req.params.id);
    const product = await Product.findByIdAndUpdate(req.params.id, payload, {
      new: true,
    });

    if (existing && (Number(existing.sellingPrice) !== payload.sellingPrice || Number(existing.mrp) !== payload.mrp)) {
      await logAudit({
        actor: getActor(req),
        action: "price_override",
        entity: "Product",
        entityId: product._id,
        field: "sellingPrice/mrp",
        oldValue: { sellingPrice: existing.sellingPrice, mrp: existing.mrp },
        newValue: { sellingPrice: payload.sellingPrice, mrp: payload.mrp },
      });
    }

    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const user = await verifyDeletePassword(req);
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Menu item not found" });

    await Product.findByIdAndDelete(req.params.id);
    await DeletionLog.create({
      recordType: "Menu Item",
      recordNo: product.barcode,
      title: product.name,
      deletedBy: user.name,
      details: product.category || "",
    });
    res.json({ success: true, message: "Product deleted" });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

// Bulk-imports menu items from a parsed CSV/sheet upload. Each row is created with the
// same defaults as a single add; rows missing a name or valid price are skipped rather
// than failing the whole batch, since a large sheet will usually have a few bad rows.
exports.bulkImportProducts = async (req, res) => {
  try {
    const rows = Array.isArray(req.body.items) ? req.body.items : [];
    let created = 0;
    const skipped = [];

    for (const row of rows) {
      const name = String(row.name || "").trim();
      const mrp = Number(row.mrp || row.sellingPrice || 0);

      if (!name || !(mrp > 0)) {
        skipped.push(row.name || "(unnamed row)");
        continue;
      }

      const barcode = `MENU-${Date.now()}-${created}-${Math.floor(Math.random() * 1000)}`;

      try {
        await Product.create({
          name,
          barcode,
          category: String(row.category || "").trim(),
          itemType: ["food", "beverage", "dessert"].includes(row.itemType) ? row.itemType : "food",
          foodType: row.foodType === "non-veg" ? "non-veg" : "veg",
          description: String(row.description || "").trim(),
          spiceLevel: ["mild", "medium", "spicy"].includes(row.spiceLevel) ? row.spiceLevel : "medium",
          isRecommended: String(row.isRecommended).toLowerCase() === "true",
          image: String(row.image || "").trim(),
          mrp,
          sellingPrice: mrp,
          gst: Number(row.gst || 0),
          offerPercent: Math.min(100, Math.max(0, Number(row.offerPercent || 0))),
          unit: "Plate",
          stock: 9999,
        });
        created += 1;
      } catch {
        skipped.push(name);
      }
    }

    res.json({ success: true, created, skipped });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.clearProducts = async (req, res) => {
  try {
    const user = await verifyDeletePassword(req);
    const result = await Product.deleteMany({});
    await DeletionLog.create({
      recordType: "Menu Items",
      recordNo: "Bulk delete",
      title: "All menu items",
      deletedBy: user.name,
      details: `${result.deletedCount || 0} records deleted`,
    });
    res.json({
      success: true,
      deletedCount: result.deletedCount || 0,
      message: "All menu items deleted",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};
