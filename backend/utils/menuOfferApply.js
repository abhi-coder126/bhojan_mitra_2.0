const MenuOffer = require("../models/MenuOffer");
const Product = require("../models/Product");
const { offerRunsToday } = require("../controllers/menuOfferController");

// Turns the offers a customer was shown into actual free lines on the order, so
// the kitchen ticket and the bill agree with what the menu promised.
//
// Free lines are priced at zero and flagged, rather than discounting the paid
// line: the kitchen has to know it is making two pizzas, not one cheap one.
async function applyMenuOffers(orderItems) {
  if (!orderItems.length) return [];

  const offers = await MenuOffer.find({ status: "Active" }).lean();
  const running = offers.filter((offer) => offerRunsToday(offer));
  if (!running.length) return [];

  const freeLines = [];
  const freeProductIds = running
    .filter((offer) => offer.type === "combo" && offer.freeProductId)
    .map((offer) => offer.freeProductId);
  const freeProducts = freeProductIds.length
    ? await Product.find({ _id: { $in: freeProductIds } }).select("name category variants gst").lean()
    : [];
  const byId = new Map(freeProducts.map((product) => [String(product._id), product]));

  for (const item of orderItems) {
    // A paid line already added by another offer must not itself earn one.
    if (item.isOfferFree) continue;

    const offer = running.find(
      (candidate) =>
        String(candidate.productId) === String(item.productId) &&
        // No sizes listed means the offer covers every size of the item.
        (candidate.variantIds.length === 0 || candidate.variantIds.includes(item.variantId || ""))
    );
    if (!offer) continue;

    if (offer.type === "bogo") {
      freeLines.push({
        ...item,
        rate: 0,
        taxableAmount: 0,
        gstAmount: 0,
        total: 0,
        isOfferFree: true,
        offerTitle: offer.title,
      });
      continue;
    }

    const free = byId.get(String(offer.freeProductId));
    if (!free) continue;
    const variant = (free.variants || []).find((row) => row.id === offer.freeVariantId);

    freeLines.push({
      productId: free._id,
      name: variant ? `${free.name} (${variant.label})` : free.name,
      variantId: variant?.id || "",
      variantLabel: variant?.label || "",
      addons: [],
      category: free.category,
      qty: item.qty,
      rate: 0,
      gst: 0,
      taxableAmount: 0,
      gstAmount: 0,
      total: 0,
      isOfferFree: true,
      offerTitle: offer.title,
    });
  }

  return freeLines;
}

module.exports = { applyMenuOffers };
