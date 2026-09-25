const mongoose = require("mongoose");
const MenuOffer = require("../models/MenuOffer");
const Product = require("../models/Product");
const Setting = require("../models/Setting");

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const indiaDay = (now) => new Date(now.getTime() + 330 * 60000).getUTCDay();

const fail = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });

const sendError = (res, error) =>
  res.status(error.statusCode || 500).json({ message: error.message || "Something went wrong" });

// Shared by the menu payload and by order creation, so what the customer is
// promised and what the kitchen is told to give away can never drift apart.
const offerRunsToday = (offer, now = new Date()) =>
  offer.status === "Active" && (offer.activeDays || ALL_DAYS).includes(indiaDay(now));

const objectId = (value, label) => {
  if (!mongoose.isValidObjectId(value)) fail(`Choose a valid ${label}`);
  return value;
};

const readPayload = async (body) => {
  const title = String(body.title || "").trim();
  if (!title || title.length > 80) fail("Enter an offer title up to 80 characters");
  if (!["bogo", "combo"].includes(body.type)) fail("Choose Buy-one-get-one or Combo");

  const productId = objectId(body.productId, "menu item");
  const product = await Product.findById(productId).select("variants").lean();
  if (!product) fail("That menu item no longer exists", 404);

  // Sizes must belong to the item, or the offer could never match anything.
  const known = new Set((product.variants || []).map((variant) => variant.id));
  const variantIds = Array.isArray(body.variantIds) ? [...new Set(body.variantIds.map(String))] : [];
  if (variantIds.some((id) => !known.has(id))) fail("One of the chosen sizes is not on this item");

  const activeDays = Array.isArray(body.activeDays) && body.activeDays.length ? body.activeDays : ALL_DAYS;
  if (activeDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) fail("Choose valid offer days");

  const minOrderAmount = Number(body.minOrderAmount || 0);
  if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) fail("Enter a valid minimum order amount");

  const payload = {
    title,
    type: body.type,
    productId,
    variantIds,
    minOrderAmount,
    activeDays: [...new Set(activeDays)],
    status: body.status === "Inactive" ? "Inactive" : "Active",
    freeProductId: null,
    freeVariantId: "",
  };

  if (body.type === "combo") {
    payload.freeProductId = objectId(body.freeProductId, "free item");
    const free = await Product.findById(payload.freeProductId).select("variants").lean();
    if (!free) fail("The free item no longer exists", 404);
    const freeVariantId = String(body.freeVariantId || "");
    if (freeVariantId && !(free.variants || []).some((variant) => variant.id === freeVariantId)) {
      fail("That size is not on the free item");
    }
    payload.freeVariantId = freeVariantId;
  }

  return payload;
};

const decorate = async (offers) => {
  const ids = offers.flatMap((offer) => [offer.productId, offer.freeProductId].filter(Boolean));
  const products = await Product.find({ _id: { $in: ids } }).select("name variants").lean();
  const byId = new Map(products.map((product) => [String(product._id), product]));

  return offers.map((offer) => {
    const product = byId.get(String(offer.productId));
    const free = offer.freeProductId ? byId.get(String(offer.freeProductId)) : null;
    const labels = (item, wanted) =>
      (item?.variants || []).filter((variant) => wanted.includes(variant.id)).map((variant) => variant.label);

    return {
      ...offer,
      productName: product?.name || "Removed item",
      // Empty variantIds means the offer covers the whole item.
      sizeLabels: offer.variantIds.length ? labels(product, offer.variantIds) : [],
      freeProductName: free?.name || "",
      freeSizeLabel: free ? labels(free, [offer.freeVariantId])[0] || "" : "",
      runsToday: offerRunsToday(offer),
    };
  });
};

exports.listMenuOffers = async (req, res) => {
  try {
    const offers = await MenuOffer.find().sort({ createdAt: -1 }).lean();
    res.json({ offers: await decorate(offers) });
  } catch (error) {
    sendError(res, error);
  }
};

exports.createMenuOffer = async (req, res) => {
  try {
    const offer = await MenuOffer.create(await readPayload(req.body));
    res.status(201).json({ success: true, offer });
  } catch (error) {
    sendError(res, error);
  }
};

exports.updateMenuOffer = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) fail("Offer not found", 404);
    const offer = await MenuOffer.findByIdAndUpdate(req.params.id, await readPayload(req.body), {
      new: true,
      runValidators: true,
    });
    if (!offer) fail("Offer not found", 404);
    res.json({ success: true, offer });
  } catch (error) {
    sendError(res, error);
  }
};

exports.deleteMenuOffer = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) fail("Offer not found", 404);
    await MenuOffer.deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    sendError(res, error);
  }
};

// What the customer menu shows: only offers running today, described in words the
// guest can act on.
exports.menuOffersForGuests = async () => {
  // Never advertise what the branch has switched off.
  const settings = await Setting.findOne().select("menuOffersEnabled").lean();
  if (settings && settings.menuOffersEnabled === false) return [];

  const offers = await MenuOffer.find({ status: "Active" }).lean();
  const running = offers.filter((offer) => offerRunsToday(offer));
  if (!running.length) return [];
  const decorated = await decorate(running);

  return decorated.map((offer) => ({
    _id: offer._id,
    title: offer.title,
    type: offer.type,
    minOrderAmount: offer.minOrderAmount || 0,
    productId: offer.productId,
    productName: offer.productName,
    variantIds: offer.variantIds,
    sizeLabels: offer.sizeLabels,
    freeProductName: offer.freeProductName,
    freeSizeLabel: offer.freeSizeLabel,
  }));
};

exports.offerRunsToday = offerRunsToday;
