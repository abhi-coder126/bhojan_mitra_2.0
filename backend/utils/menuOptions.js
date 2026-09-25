const invalid = (message) => { throw Object.assign(new Error(message), { statusCode: 400 }); };
const money = (value) => Math.round(value * 100) / 100;
const text = (value, label) => {
  if (typeof value !== "string" || !value.trim() || value.length > 120) invalid(`Enter a valid ${label}`);
  return value.trim();
};
const price = (value, allowZero) => {
  if (value === "" || value === null || !Number.isFinite(Number(value)) || Number(value) < (allowZero ? 0 : 0.01)) invalid("Enter a valid option price");
  return money(Number(value));
};
function normalizeMenuOptions(body) {
  const result = {};
  const ids = new Set();
  const id = (value) => {
    if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(value) || ids.has(value)) invalid("Invalid or duplicate menu option ID");
    ids.add(value); return value;
  };
  if (body.variants !== undefined) {
    if (!Array.isArray(body.variants) || body.variants.length > 30) invalid("Use up to 30 sizes per item");
    result.variants = body.variants.map((variant) => ({ id: id(variant.id), label: text(variant.label, "size / volume"), price: price(variant.price, false) }));
  }
  if (body.optionGroups !== undefined) {
    if (!Array.isArray(body.optionGroups) || body.optionGroups.length > 15) invalid("Use up to 15 add-on groups");
    result.optionGroups = body.optionGroups.map((group) => {
      if (!Array.isArray(group.options) || !group.options.length || group.options.length > 30) invalid("Add 1–30 options to each group");
      const maxSelections = Number(group.maxSelections);
      if (!Number.isInteger(maxSelections) || maxSelections < 1 || maxSelections > group.options.length) invalid("Group selection limit must be between 1 and its number of options");
      return { id: id(group.id), name: text(group.name, "add-on group name"), required: group.required === true, maxSelections,
        options: group.options.map((option) => ({ id: id(option.id), name: text(option.name, "add-on name"), price: price(option.price, true), foodType: option.foodType === "non-veg" ? "non-veg" : "veg" })) };
    });
  }
  return result;
}

function resolveMenuSelection(product, requested, allowDefault = false) {
  const variants = product.variants || [];
  const groups = product.optionGroups || [];
  const variant = variants.find((value) => value.id === requested.variantId) ||
    (allowDefault && !requested.variantId ? variants[0] : null);
  if ((variants.length && !variant) || (!variants.length && requested.variantId)) invalid(`Select a valid size for ${product.name}`);
  const addonIds = requested.addonIds || [];
  if (!Array.isArray(addonIds) || addonIds.some((value) => typeof value !== "string") || new Set(addonIds).size !== addonIds.length) invalid("Invalid add-on selection");
  const selected = new Set(addonIds);
  const addons = [];
  for (const group of groups) {
    const choices = group.options.filter((option) => selected.has(option.id));
    if (choices.length > group.maxSelections || (group.required && !choices.length)) invalid(`Choose ${group.required ? "at least one and " : ""}up to ${group.maxSelections} option(s) for ${group.name}`);
    choices.forEach((option) => addons.push({ id: option.id, name: option.name, groupName: group.name, price: option.price, foodType: option.foodType }));
  }
  if (addons.length !== selected.size) invalid("An add-on is no longer available. Please select the item again.");
  const basePrice = variant ? variant.price : Number(product.mrp || product.sellingPrice || 0);
  const offer = Math.min(100, Math.max(0, Number(product.offerPercent || 0)));
  const addonTotal = addons.reduce((sum, option) => sum + option.price, 0);
  const rate = money(money(basePrice * (1 - offer / 100)) + addonTotal);
  const labels = [variant?.label, ...addons.map((option) => option.name)].filter(Boolean);
  return { variantId: variant?.id || "", variantLabel: variant?.label || "", addons, rate,
    name: product.name + (labels.length ? ` — ${labels.join(", ")}` : "") };
}

module.exports = { normalizeMenuOptions, resolveMenuSelection };
