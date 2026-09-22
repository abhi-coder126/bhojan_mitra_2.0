const Coupon = require("../models/Coupon");
const DeletionLog = require("../models/DeletionLog");
const { verifyDeletePassword } = require("../utils/deleteAuth");

exports.createCoupon = async (req, res) => {
  try {
    const exist = await Coupon.findOne({
      code: req.body.code?.toUpperCase(),
    });

    if (exist) {
      return res.status(400).json({
        success: false,
        message: "Coupon already exists",
      });
    }

    const coupon = await Coupon.create({
      ...req.body,
      code: req.body.code.toUpperCase(),
    });

    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      coupon,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Coupon create error",
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
      code: code?.toUpperCase(),
      status: "Active",
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found or inactive",
      });
    }

    const now = new Date();

    if (coupon.startDate && now < coupon.startDate) {
      return res.status(400).json({
        success: false,
        message: "Coupon not started yet",
      });
    }

    if (coupon.endDate && now > coupon.endDate) {
      return res.status(400).json({
        success: false,
        message: "Coupon expired",
      });
    }

    if (Number(billAmount) < Number(coupon.minimumBillAmount || 0)) {
      return res.status(400).json({
        success: false,
        message: `Minimum bill amount ₹${coupon.minimumBillAmount} required`,
      });
    }

    if (
      Number(coupon.usageLimit || 0) > 0 &&
      Number(coupon.usedCount || 0) >= Number(coupon.usageLimit)
    ) {
      return res.status(400).json({
        success: false,
        message: "Coupon usage limit reached",
      });
    }

    let discountAmount = 0;

    if (coupon.discountType === "Amount") {
      discountAmount = Number(coupon.discountValue || 0);
    }

    if (coupon.discountType === "Percent") {
      discountAmount =
        (Number(billAmount || 0) * Number(coupon.discountValue || 0)) / 100;
    }

    res.json({
      success: true,
      coupon,
      discountAmount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Coupon apply error",
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
