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
  Building2,
  LifeBuoy,
  Store,
} from "lucide-react";
import API from "../api/axios";
import { usePlatform } from "../api/platform";
import {
  BRANCH_CHANGED_EVENT,
  clearSession,
  getActiveBranch,
  getUser,
  isMasterAdmin,
  setActiveBranch,
} from "../api/session";

// Frontend-only nav gating by role, to keep the sidebar tidy per role. The backend
// enforces branch isolation and head-office-only actions on its own.
const roleHiddenLinks = {
  waiter: ["/smart-inventory", "/audit-logs", "/settings"],
  kitchen: ["/smart-inventory", "/audit-logs", "/settings", "/customers", "/coupons", "/rewards"],
  inventory: ["/restaurant-orders", "/tables", "/kds", "/table-barcodes"],
  cashier: ["/smart-inventory", "/audit-logs"],
};

const branchLinks = [
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
];

const linkClass = ({ isActive }) => (isActive ? "sidebar-link active" : "sidebar-link");

export default function Sidebar({ onClose }) {
  const navigate = useNavigate();
  const platform = usePlatform();
  const isMaster = isMasterAdmin();
  const [activeBranch, setActiveBranchState] = useState(getActiveBranch);
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    const sync = () => setActiveBranchState(getActiveBranch());
    window.addEventListener(BRANCH_CHANGED_EVENT, sync);
    return () => window.removeEventListener(BRANCH_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!isMaster) return;
    API.get("/branches/options")
      .then((res) => setBranches(res.data.branches || []))
      .catch(() => {});
  }, [isMaster, activeBranch?.id]);

  // Branch tools stay visible while any extra branch still exists, even if the
  // switch was turned off later -- those branches still need managing.
  const showBranchTools = isMaster && (platform?.multiBranchEnabled || branches.length > 1);

  const switchBranch = (id) => {
    if (!id) {
      setActiveBranch(null);
      navigate("/branches");
      return;
    }
    const branch = branches.find((b) => b._id === id);
    if (branch) {
      setActiveBranch(branch);
      navigate("/");
    }
  };

  const logout = () => {
    clearSession();
    navigate("/login");
  };

  const hidden = roleHiddenLinks[getUser().role] || [];
  // A master admin with no branch open has no branch pages to show.
  const links = activeBranch || !isMaster ? branchLinks.filter((link) => !hidden.includes(link.to)) : [];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <img src="/BhojanMitra_Logo.png" alt="BhojanMitra" className="sidebar-logo" />
        </div>

        <button className="sidebar-toggle-btn" onClick={onClose} title="Hide Menu">
          <Menu size={22} />
        </button>
      </div>

      {showBranchTools ? (
        <div className="sidebar-branch-context">
          <label htmlFor="sidebar-branch-select">Working in</label>
          <select
            id="sidebar-branch-select"
            value={activeBranch?.id || ""}
            onChange={(e) => switchBranch(e.target.value)}
          >
            <option value="">Head office (all branches)</option>
            {branches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name} ({b.code}){b.status === "hold" ? " - on hold" : ""}
              </option>
            ))}
          </select>
        </div>
      ) : (
        activeBranch &&
        !isMaster && (
          <div className="sidebar-branch-context sidebar-branch-badge">
            <Store size={15} />
            <span>{activeBranch.name}</span>
          </div>
        )
      )}

      <nav className="sidebar-nav">
        {showBranchTools && (
          <NavLink to="/branches" end className={linkClass}>
            <Building2 size={18} />
            <span>Branch Management</span>
          </NavLink>
        )}

        {links.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} end={item.to === "/"} className={linkClass}>
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}

        {!hidden.includes("/settings") && (
          <NavLink to="/settings" className={linkClass}>
            <Settings size={18} />
            <span>Settings</span>
          </NavLink>
        )}

        <NavLink to="/support" className={linkClass}>
          <LifeBuoy size={18} />
          <span>Support</span>
        </NavLink>

        <button className="sidebar-logout" onClick={logout}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </nav>
    </aside>
  );
}
