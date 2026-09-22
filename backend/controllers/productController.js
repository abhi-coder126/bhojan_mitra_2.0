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
      branchId: req.body.branchId || req.query.branchId || undefined,
      barcode: generatedCode,
      purchasePrice: Number(req.body.purchasePrice || 0),
      sellingPrice: Number(req.body.sellingPrice || mrp),
      mrp,
      gst: Number(req.body.gst || 0),
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
    const filter = {};
    if (req.query.branchId) filter.branchId = req.query.branchId;

    const products = await Product.find(filter)
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
