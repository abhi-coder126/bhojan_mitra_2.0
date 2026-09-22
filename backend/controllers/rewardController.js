const RewardTier = require("../models/RewardTier");
const Reward = require("../models/Reward");

exports.getRewardTiers = async (req, res) => {
  try {
    const tiers = await RewardTier.find().sort({ minOrders: 1 });
    res.json({ success: true, tiers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createRewardTier = async (req, res) => {
  try {
    const { title, minOrders, offerType, offerValue, offerText, validityDays, isActive } = req.body;

    if (!title || !minOrders || !offerText) {
      return res.status(400).json({ message: "Title, minimum orders and offer text are required" });
    }

    const tier = await RewardTier.create({
      title,
      minOrders: Number(minOrders),
      offerType: offerType || "percent",
      offerValue: Number(offerValue || 0),
      offerText,
      validityDays: Number(validityDays || 7),
      isActive: isActive ?? true,
    });

    res.status(201).json({ success: true, tier });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateRewardTier = async (req, res) => {
  try {
    const tier = await RewardTier.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!tier) return res.status(404).json({ message: "Reward tier not found" });
    res.json({ success: true, tier });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteRewardTier = async (req, res) => {
  try {
    const tier = await RewardTier.findByIdAndDelete(req.params.id);
    if (!tier) return res.status(404).json({ message: "Reward tier not found" });
    res.json({ success: true, message: "Reward tier deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Staff visibility into rewards that have gone out to customers.
exports.getIssuedRewards = async (req, res) => {
  try {
    const rewards = await Reward.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("customerId", "name contact crn")
      .populate("orderId", "orderNo");

    res.json({ success: true, rewards });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
