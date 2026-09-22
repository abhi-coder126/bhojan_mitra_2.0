const Customer = require("../models/Customer");
const RestaurantOrder = require("../models/RestaurantOrder");
const Reward = require("../models/Reward");

const publicCustomer = (customer) => ({
  id: customer._id,
  crn: customer.crn,
  name: customer.name,
  contact: customer.contact,
  email: customer.email,
  addresses: customer.addresses || [],
  loyaltyPoints: customer.loyaltyPoints,
  totalVisits: customer.totalVisits,
});

exports.getMyProfile = async (req, res) => {
  res.json({ success: true, customer: publicCustomer(req.customer) });
};

// Saved delivery addresses (Home/Work/Other) -- pass `index` to update an existing
// one in place, omit it to add a new one.
exports.upsertMyAddress = async (req, res) => {
  try {
    const { label, address, isDefault, index } = req.body;

    if (!address || !String(address).trim()) {
      return res.status(400).json({ message: "Address text is required" });
    }

    const customer = await Customer.findById(req.customer._id);
    const entry = { label: label || "Home", address: String(address).trim(), isDefault: Boolean(isDefault) };

    if (isDefault) {
      customer.addresses.forEach((a) => {
        a.isDefault = false;
      });
    }

    if (Number.isInteger(index) && customer.addresses[index]) {
      customer.addresses[index] = entry;
    } else {
      customer.addresses.push(entry);
    }

    await customer.save();
    res.json({ success: true, addresses: customer.addresses });
  } catch (error) {
    res.status(500).json({ message: error.message || "Could not save address" });
  }
};

exports.deleteMyAddress = async (req, res) => {
  try {
    const index = Number(req.params.index);
    const customer = await Customer.findById(req.customer._id);

    if (!Number.isInteger(index) || !customer.addresses[index]) {
      return res.status(404).json({ message: "Address not found" });
    }

    customer.addresses.splice(index, 1);
    await customer.save();
    res.json({ success: true, addresses: customer.addresses });
  } catch (error) {
    res.status(500).json({ message: error.message || "Could not remove address" });
  }
};

// Rewards stay hidden (title only, no offer text) until the customer "scratches"
// them via the endpoint below -- that's what makes it a genuine reveal, not just a
// styled label on data the client already has.
exports.getMyRewards = async (req, res) => {
  try {
    const rewards = await Reward.find({ customerId: req.customer._id }).sort({ createdAt: -1 }).limit(30);

    res.json({
      success: true,
      rewards: rewards.map((reward) => ({
        id: reward._id,
        title: reward.title,
        offerText: reward.scratched ? reward.offerText : null,
        scratched: reward.scratched,
        expired: reward.expiresAt < new Date(),
        expiresAt: reward.expiresAt,
        createdAt: reward.createdAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Could not load rewards" });
  }
};

exports.scratchReward = async (req, res) => {
  try {
    const reward = await Reward.findOne({ _id: req.params.id, customerId: req.customer._id });
    if (!reward) return res.status(404).json({ message: "Reward not found" });

    if (!reward.scratched) {
      reward.scratched = true;
      reward.scratchedAt = new Date();
      await reward.save();
    }

    res.json({
      success: true,
      reward: {
        id: reward._id,
        title: reward.title,
        offerText: reward.offerText,
        expired: reward.expiresAt < new Date(),
        expiresAt: reward.expiresAt,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Could not reveal reward" });
  }
};

// Delivery-only order history, newest first (per product requirement -- dine-in
// orders aren't tied to a customer history view).
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await RestaurantOrder.find({ customerId: req.customer._id, orderType: "delivery" })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("orderNo invoiceNo status paymentStatus grandTotal items createdAt deliveryAddress");

    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ message: error.message || "Could not load order history" });
  }
};
