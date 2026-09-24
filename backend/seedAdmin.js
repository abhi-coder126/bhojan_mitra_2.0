require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

const EMAIL = "admin@bhojanmitra.com";
const PASSWORD = "admin@admin";
const NAME = "Admin";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const hashed = await bcrypt.hash(PASSWORD, 10);
  const existing = await User.findOne({ email: EMAIL });

  if (existing) {
    existing.password = hashed;
    existing.role = "master_admin";
    existing.branchId = null;
    await existing.save();
    console.log("Existing user updated to master admin:", EMAIL);
  } else {
    await User.create({ name: NAME, email: EMAIL, password: hashed, role: "master_admin" });
    console.log("Master admin created:", EMAIL);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
