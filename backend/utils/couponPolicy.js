const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const indiaDay = (now) => new Date(now.getTime() + 330 * 60000).getUTCDay();

function couponUnavailable(coupon, now = new Date()) {
  if (!coupon || coupon.status !== "Active") return "Coupon not found or inactive";
  if (coupon.startDate && now < new Date(coupon.startDate)) return "Coupon not started yet";
  if (coupon.endDate && now > new Date(coupon.endDate)) return "Coupon expired";
  if (!(coupon.activeDays || ALL_DAYS).includes(indiaDay(now))) return "This offer is not available today";
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) return "Coupon usage limit reached";
  return "";
}

function couponDiscount(coupon, amount, now = new Date()) {
  const unavailable = couponUnavailable(coupon, now);
  if (unavailable) throw Object.assign(new Error(unavailable), { statusCode: 400 });
  if (!Number.isFinite(amount) || amount <= 0) throw Object.assign(new Error("Add items before applying a coupon"), { statusCode: 400 });
  if (amount < Number(coupon.minimumBillAmount || 0)) {
    throw Object.assign(new Error(`Minimum bill amount ₹${coupon.minimumBillAmount} required`), { statusCode: 400 });
  }
  const value = coupon.discountType === "Percent" ? amount * coupon.discountValue / 100 : coupon.discountValue;
  return Math.round(Math.min(amount, Math.max(0, value)) * 100) / 100;
}

function couponPayload(body) {
  const fail = (message) => { throw Object.assign(new Error(message), { statusCode: 400 }); };
  const code = String(body.code || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,40}$/.test(code)) fail("Use 2–40 letters, numbers, hyphens or underscores for the coupon code");
  const discountValue = Number(body.discountValue);
  if (!["Amount", "Percent"].includes(body.discountType) || !Number.isFinite(discountValue) || discountValue <= 0 ||
      (body.discountType === "Percent" && discountValue > 100)) fail("Enter a valid discount (percentage must be 1–100)");
  const minimumBillAmount = Number(body.minimumBillAmount || 0);
  const usageLimit = Number(body.usageLimit || 0);
  if (!Number.isFinite(minimumBillAmount) || minimumBillAmount < 0 || !Number.isInteger(usageLimit) || usageLimit < 0) fail("Enter a valid minimum bill and usage limit");
  const activeDays = body.activeDays ?? ALL_DAYS;
  if (!Array.isArray(activeDays) || !activeDays.length || activeDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) fail("Select at least one valid offer day");
  const date = (value, end) => {
    if (!value) return null;
    const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T${end ? "23:59:59.999" : "00:00:00.000"}+05:30` : value);
    if (!Number.isFinite(parsed.getTime())) fail("Enter valid offer dates");
    return parsed;
  };
  const startDate = date(body.startDate, false);
  const endDate = date(body.endDate, true);
  if (startDate && endDate && endDate < startDate) fail("End date must be on or after the start date");
  if (!["Active", "Inactive"].includes(body.status || "Active")) fail("Invalid offer status");
  return { code, discountType: body.discountType, discountValue, minimumBillAmount, usageLimit,
    activeDays: [...new Set(activeDays)], startDate, endDate, status: body.status || "Active",
    title: String(body.title || "").trim().slice(0, 100), description: String(body.description || "").trim().slice(0, 220),
    showOnMenu: body.showOnMenu === true };
}

module.exports = { couponUnavailable, couponDiscount, couponPayload };
