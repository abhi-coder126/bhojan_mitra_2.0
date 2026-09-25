const { couponDiscount, couponPayload } = require("../utils/couponPolicy");
const Coupon = require("../models/Coupon");
const DeletionLog = require("../models/DeletionLog");
const { verifyDeletePassword } = require("../utils/deleteAuth");

exports.createCoupon = async (req, res) => {
  try {
    const payload = couponPayload(req.body);
    const exist = await Coupon.findOne({
      code: payload.code,
    });

    if (exist) {
      return res.status(400).json({
        success: false,
        message: "Coupon already exists",
      });
    }

    const coupon = await Coupon.create({
      ...payload,
    });

    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      coupon,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      error: error.message,
    });
  }
};

exports.getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json({ success: true, coupons });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Coupon fetch error",
      error: error.message,
    });
  }
};

exports.applyCoupon = async (req, res) => {
  try {
    const { code, billAmount } = req.body;

    const coupon = await Coupon.findOne({
      code: String(code || "").trim().toUpperCase(),
      status: "Active",
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found or inactive",
      });
    }

    const discountAmount = couponDiscount(coupon, Number(billAmount));

    res.json({
      success: true,
      coupon,
      discountAmount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      error: error.message,
    });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    const user = await verifyDeletePassword(req);
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found" });

    await Coupon.findByIdAndDelete(req.params.id);
    await DeletionLog.create({
      recordType: "Coupon",
      recordNo: coupon.code,
      title: coupon.discountType,
      deletedBy: user.name,
      details: String(coupon.discountValue || ""),
    });

    res.json({
      success: true,
      message: "Coupon deleted successfully",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: "Coupon delete error",
      error: error.message,
    });
  }
};

exports.updateCoupon = async (req, res) => {
  try {
    const payload = couponPayload(req.body);
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true, runValidators: true });
    if (!coupon) return res.status(404).json({ message: "Coupon not found" });
    res.json({ success: true, coupon });
  } catch (error) {
    res.status(error.code === 11000 ? 400 : error.statusCode || 500).json({ message: error.code === 11000 ? "Coupon code already exists" : error.message });
  }
};
