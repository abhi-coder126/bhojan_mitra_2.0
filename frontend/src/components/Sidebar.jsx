import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Menu,
  LayoutDashboard,
  Users,
  ReceiptText,
  Settings,
  BadgePercent,
  LogOut,
  Utensils,
  QrCode,
  LayoutGrid,
  ChefHat,
  Package,
  ClipboardList,
  Gift,
} from "lucide-react";
import API from "../api/axios";

// Simple frontend-only nav gating by role. Not a security boundary (the app has no real auth
// enforcement on the backend yet) -- this is purely to keep the sidebar tidy per role.
const roleHiddenLinks = {
  waiter: ["/smart-inventory", "/audit-logs", "/settings"],
  kitchen: ["/smart-inventory", "/audit-logs", "/settings", "/customers", "/coupons", "/rewards"],
  inventory: ["/restaurant-orders", "/tables", "/kds", "/table-barcodes"],
  cashier: ["/smart-inventory", "/audit-logs"],
};

export default function Sidebar({ onClose }) {
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(localStorage.getItem("branchId") || "");

  useEffect(() => {
    API.get("/branches")
      .then((res) => setBranches(res.data.branches || []))
      .catch(() => {});
  }, []);

  const changeBranch = (value) => {
    setBranchId(value);
    if (value) localStorage.setItem("branchId", value);
    else localStorage.removeItem("branchId");
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  let role = "";
  try {
    role = JSON.parse(localStorage.getItem("user") || "{}")?.role || "";
  } catch {
    // Malformed/missing localStorage value -- fall back to no role.
  }
  const hidden = roleHiddenLinks[role] || [];

  const links = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/restaurant-orders", label: "Restaurant Orders", icon: Utensils },
    { to: "/tables", label: "Table Management", icon: LayoutGrid },
    { to: "/kds", label: "Kitchen Display", icon: ChefHat },
    { to: "/table-barcodes", label: "Table QR", icon: QrCode },
    { to: "/menu-items", label: "Menu Items", icon: Utensils },
    { to: "/smart-inventory", label: "Smart Inventory", icon: Package },
    { to: "/reports", label: "Reports", icon: ReceiptText },
    { to: "/customers", label: "Customers", icon: Users },
    { to: "/coupons", label: "Coupons", icon: BadgePercent },
    { to: "/rewards", label: "Rewards", icon: Gift },
    { to: "/audit-logs", label: "Audit Log", icon: ClipboardList },
    { to: "/settings", label: "Settings", icon: Settings },
  ].filter((link) => !hidden.includes(link.to));

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
  <img
    src="/BhojanMitra_Logo.png"
    alt="BhojanMitra"
    className="sidebar-logo"
  />
</div>

        <button className="sidebar-toggle-btn" onClick={onClose} title="Hide Menu">
          <Menu size={22} />
        </button>
      </div>

      {branches.length > 0 && (
        <div className="sidebar-branch-switcher" style={{ padding: "0 12px 8px" }}>
          <select
            value={branchId}
            onChange={(e) => changeBranch(e.target.value)}
            style={{ width: "100%" }}
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b._id} value={b._id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      <nav className="sidebar-nav">
        {links.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? "sidebar-link active" : "sidebar-link"
              }
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}

        <button className="sidebar-logout" onClick={logout}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </nav>
    </aside>
  );
}
