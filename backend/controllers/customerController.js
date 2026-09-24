const Customer = require("../models/Customer");
const Sale = require("../models/Sale");
const RestaurantOrder = require("../models/RestaurantOrder");
const DeletionLog = require("../models/DeletionLog");
const { verifyDeletePassword } = require("../utils/deleteAuth");
const { nextCustomerCrn: generateCRN, customerBranchFilter } = require("../utils/customerUpsert");
const { currentBranchId } = require("../utils/tenant");

// A customer visible to the current branch (see utils/customerUpsert.js).
const findBranchCustomer = (id) => Customer.findOne({ _id: id, ...customerBranchFilter() });

exports.createCustomer = async (req, res) => {
  try {
    const { name, address } = req.body;
    const contact = String(req.body.contact || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!name || !contact) {
      return res.status(400).json({
        success: false,
        message: "Customer name and contact number required",
      });
    }

    const existing = await Customer.findOne({
      $or: [{ contact }, ...(email ? [{ email }] : [])],
    }).sort({ createdAt: 1 });

    if (existing) {
      existing.name = name || existing.name;
      existing.contact = existing.contact || contact;
      existing.email = email || existing.email || "";
      existing.address = address || existing.address || "";
      const branchId = currentBranchId();
      if (branchId) existing.branchIds.addToSet(branchId);
      await existing.save();
      return res.json({
        success: false,
        message: "Customer already exists. Existing CRN updated.",
        customer: existing,
      });
    }

    const crn = await generateCRN();

    const customer = await Customer.create({
      crn,
      name,
      contact,
      email,
      address,
      branchIds: currentBranchId() ? [currentBranchId()] : [],
      activeFrom: new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      customer,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: "Customer create error",
      error: error.message,
    });
  }
};

exports.getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find(customerBranchFilter()).sort({ createdAt: -1 });

    res.json({
      success: true,
      customers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Customers fetch error",
      error: error.message,
    });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const { name, address } = req.body;
    const contact = String(req.body.contact || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!contact) {
      return res.status(400).json({ success: false, message: "Contact number required" });
    }

    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, ...customerBranchFilter() },
      { name, contact, email, address },
      { new: true }
    );
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    res.json({
      success: true,
      message: "Customer updated successfully",
      customer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Customer update error",
      error: error.message,
    });
  }
};

exports.getCustomerHistory = async (req, res) => {
  try {
    const customer = await findBranchCustomer(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const sales = await Sale.find({
      $or: [
        { customerPhone: customer.contact },
        { customerName: customer.name },
      ],
    }).sort({ createdAt: -1 });

    const restaurantOrders = await RestaurantOrder.find({
      $or: [
        { customerPhone: customer.contact },
        { customerName: customer.name },
      ],
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      customer,
      sales,
      restaurantOrders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Customer history error",
      error: error.message,
    });
  }
};
exports.deleteCustomer = async (req, res) => {
  try {
    const user = await verifyDeletePassword(req);
    const customer = await findBranchCustomer(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });

    // The record is shared across branches -- a branch only removes itself from it.
    // The record itself is deleted once no branch references it any more.
    const branchId = currentBranchId();
    if (branchId) customer.branchIds.pull(branchId);
    if (!branchId || customer.branchIds.length === 0) {
      await Customer.findByIdAndDelete(req.params.id);
    } else {
      await customer.save();
    }
    await DeletionLog.create({
      recordType: "Customer",
      recordNo: customer.crn,
      title: customer.name,
      deletedBy: user.name,
      details: customer.contact,
    });

    res.json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// 1 loyalty point earned for every ₹100 spent; redeem 10 points = ₹10 off (1 point = Re 1)
const POINTS_PER_RUPEES = 100;

exports.earnLoyaltyPoints = async (customerId, grandTotal) => {
  if (!customerId) return;
  const points = Math.floor(Number(grandTotal || 0) / POINTS_PER_RUPEES);

  await Customer.findByIdAndUpdate(customerId, {
    $inc: { loyaltyPoints: points, totalVisits: 1 },
    $set: { lastVisit: new Date() },
  });
};

exports.redeemLoyaltyPoints = async (req, res) => {
  try {
    const { points } = req.body;
    const customer = await findBranchCustomer(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    const redeemPoints = Number(points || 0);
    if (redeemPoints <= 0 || redeemPoints > customer.loyaltyPoints) {
      return res.status(400).json({ message: "Invalid points to redeem" });
    }

    customer.loyaltyPoints -= redeemPoints;
    await customer.save();

    res.json({ success: true, customer, discountValue: redeemPoints });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getCustomerSegments = async (req, res) => {
  try {
    const customers = await Customer.find(customerBranchFilter());
    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

    const segmented = customers.map((c) => {
      let segment = "new";
      const lastVisitMs = c.lastVisit ? new Date(c.lastVisit).getTime() : null;
      const visits = Number(c.totalVisits || 0);

      if (visits === 0) {
        segment = "new";
      } else if (lastVisitMs && now - lastVisitMs > NINETY_DAYS) {
        segment = "inactive";
      } else if (visits >= 10 || Number(c.loyaltyPoints || 0) >= 500) {
        segment = "vip";
      } else if (visits >= 3 && lastVisitMs && now - lastVisitMs <= THIRTY_DAYS) {
        segment = "frequent";
      } else {
        segment = "regular";
      }

      return { _id: c._id, name: c.name, contact: c.contact, visits, loyaltyPoints: c.loyaltyPoints, lastVisit: c.lastVisit, segment };
    });

    const summary = segmented.reduce((acc, c) => {
      acc[c.segment] = (acc[c.segment] || 0) + 1;
      return acc;
    }, {});

    res.json({ success: true, customers: segmented, summary });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.searchCustomer = async (req, res) => {
  try {
    const { keyword } = req.query;

    if (!keyword) {
      return res.json({
        success: true,
        customers: [],
      });
    }

    const customers = await Customer.find({
      ...customerBranchFilter(),
      $or: [
        { name: { $regex: keyword, $options: "i" } },
        { crn: { $regex: keyword, $options: "i" } },
        { contact: { $regex: keyword, $options: "i" } },
      ],
    }).limit(10);

    res.json({
      success: true,
      customers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Customer search error",
      error: error.message,
    });
  }
};
