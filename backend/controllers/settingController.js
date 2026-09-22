const Setting = require("../models/Setting");

exports.getSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne();

    if (!settings) {
      settings = await Setting.create({});
    }

    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Settings fetch error",
      error: error.message,
    });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne();

    if (!settings) {
      settings = await Setting.create(req.body);
    } else {
      settings = await Setting.findByIdAndUpdate(settings._id, req.body, {
        new: true,
      });
    }

    res.json({
      success: true,
      message: "Settings updated successfully",
      settings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Settings update error",
      error: error.message,
    });
  }
};