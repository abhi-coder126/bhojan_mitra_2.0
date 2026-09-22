const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const vendorRoutes = require("./routes/vendorRoutes");
const productRoutes = require("./routes/productRoutes");
const purchaseRoutes = require("./routes/purchaseRoutes");
const saleRoutes = require("./routes/saleRoutes");
const salesReturnRoutes = require("./routes/salesReturnRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const customerRoutes = require("./routes/customerRoutes");
const settingRoutes = require("./routes/settingRoutes");
const couponRoutes = require("./routes/couponRoutes");
const accountRoutes = require("./routes/accountRoutes");
const restaurantOrderRoutes = require("./routes/restaurantOrderRoutes");
const tableRoutes = require("./routes/tableRoutes");
const rawMaterialRoutes = require("./routes/rawMaterialRoutes");
const recipeRoutes = require("./routes/recipeRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");
const branchRoutes = require("./routes/branchRoutes");
const otpRoutes = require("./routes/otpRoutes");
const customerAuthRoutes = require("./routes/customerAuthRoutes");
const rewardRoutes = require("./routes/rewardRoutes");

const app = express();

connectDB();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.send("BhojanMitra API Running");
});

app.use("/api/auth", authRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/products", productRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/sales-return", salesReturnRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/settings", settingRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/restaurant-orders", restaurantOrderRoutes);
app.use("/api/tables", tableRoutes);
app.use("/api/raw-materials", rawMaterialRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/customer-auth", customerAuthRoutes);
app.use("/api/rewards", rewardRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
