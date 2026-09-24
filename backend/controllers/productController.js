const Product = require("../models/Product");
const DeletionLog = require("../models/DeletionLog");
const { verifyDeletePassword } = require("../utils/deleteAuth");
const { logAudit, getActor } = require("../utils/auditLog");
const { runUnscoped } = require("../utils/tenant");
const ProductImage = require("../models/ProductImage");

// Pictures arrive as data URLs on the product payload but are stored separately.
// Returns the payload with `image` swapped for the cheap `hasImage` flag.
const splitImage = (body) => {
  const { image, ...rest } = body || {};
  const dataUrl = typeof image === "string" ? image.trim() : "";
  return { payload: rest, dataUrl, imageProvided: image !== undefined };
};

const saveImage = async (productId, dataUrl) => {
  if (dataUrl) {
    await ProductImage.findOneAndUpdate({ productId }, { productId, dataUrl }, { upsert: true, setDefaultsOnInsert: true });
  } else {
    await ProductImage.deleteOne({ productId });
  }
  await Product.updateOne({ _id: productId }, { hasImage: Boolean(dataUrl) });
};

exports.createProduct = async (req, res) => {
  try {
    const generatedCode = req.body.barcode || `MENU-${Date.now()}`;
    const mrp = Number(req.body.mrp || req.body.sellingPrice || 0);
    const exist = await Product.findOne({ barcode: generatedCode });

    if (exist) {
      return res.status(400).json({ message: "Menu item already exists" });
    }

    const { payload, dataUrl } = splitImage(req.body);
    const product = await Product.create({
      ...payload,
      barcode: generatedCode,
      purchasePrice: Number(req.body.purchasePrice || 0),
      sellingPrice: Number(req.body.sellingPrice || mrp),
      mrp,
      gst: Number(req.body.gst || 0),
      offerPercent: Math.min(100, Math.max(0, Number(req.body.offerPercent || 0))),
      unit: req.body.unit || "Plate",
      stock: Number(req.body.openingStock || req.body.stock || 9999),
      lowStockLimit: Number(req.body.lowStockLimit || 0),
      hasImage: Boolean(dataUrl),
    });

    if (dataUrl) await saveImage(product._id, dataUrl);

    res.status(201).json({ success: true, product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Menu images are stored as base64 data URLs, which would make this list several MB.
// The list carries only a `hasImage` flag; the bytes come from GET /products/:id/image,
// which the browser fetches in parallel and caches.
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("vendorId", "name gstNumber phone")
      .sort({ createdAt: -1 })
      .lean();

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
    })
      
      .limit(10)
      .lean();

    res.json({ success: true, products });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const mrp = Number(req.body.mrp || req.body.sellingPrice || 0);
    const { payload: body, dataUrl, imageProvided } = splitImage(req.body);
    const payload = {
      ...body,
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

    // A missing `image` field means "leave the saved picture alone".
    if (product && imageProvided) await saveImage(product._id, dataUrl);

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
    await ProductImage.deleteOne({ productId: req.params.id });
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

      const rowImage = String(row.image || "").trim();

      try {
        const product = await Product.create({
          name,
          barcode,
          category: String(row.category || "").trim(),
          itemType: ["food", "beverage", "dessert"].includes(row.itemType) ? row.itemType : "food",
          foodType: row.foodType === "non-veg" ? "non-veg" : "veg",
          description: String(row.description || "").trim(),
          spiceLevel: ["mild", "medium", "spicy"].includes(row.spiceLevel) ? row.spiceLevel : "medium",
          isRecommended: String(row.isRecommended).toLowerCase() === "true",
          hasImage: Boolean(rowImage),
          mrp,
          sellingPrice: mrp,
          gst: Number(row.gst || 0),
          offerPercent: Math.min(100, Math.max(0, Number(row.offerPercent || 0))),
          unit: "Plate",
          stock: 9999,
        });
        if (rowImage) await saveImage(product._id, rowImage);
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
    await ProductImage.deleteMany({});
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

// Serves one menu item's picture. Public on purpose: the customer QR menu loads it
// without a staff token. Cached by the browser and revalidated with an ETag, so the
// image is fetched once per change instead of on every menu load.
exports.getProductImage = async (req, res) => {
  try {
    const record = await runUnscoped(() =>
      ProductImage.findOne({ productId: req.params.id }).select("dataUrl updatedAt").lean()
    );

    const match = /^data:([^;]+);base64,(.*)$/s.exec(record?.dataUrl || "");
    if (!match) return res.status(404).end();

    const etag = `W/"${record.updatedAt?.getTime?.() || 0}"`;
    if (req.headers["if-none-match"] === etag) return res.status(304).end();

    res.set("Content-Type", match[1]);
    res.set("Cache-Control", "public, max-age=300, must-revalidate");
    res.set("ETag", etag);
    res.send(Buffer.from(match[2], "base64"));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
