import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  Landmark,
  LifeBuoy,
  Store,
  Bell,
} from "lucide-react";
import API from "../api/axios";
import BranchProfileModal from "./BranchProfileModal";
import BranchApprovals from "./BranchApprovals";
import { useBranchApprovals } from "../api/branchApprovals";
import { useToast, ToastViewport } from "./Toast";
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
  waiter: ["/smart-inventory", "/audit-logs", "/settings", "/royalty"],
  kitchen: ["/smart-inventory", "/audit-logs", "/settings", "/customers", "/coupons", "/rewards", "/royalty"],
  inventory: ["/restaurant-orders", "/tables", "/kds", "/table-barcodes", "/royalty"],
  cashier: ["/smart-inventory", "/audit-logs", "/royalty"],
};

const branchLinks = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/restaurant-orders", label: "Restaurant Orders", icon: Utensils },
  { to: "/tables", label: "Table Management", icon: LayoutGrid },
  { to: "/kds", label: "Kitchen Display", icon: ChefHat },
  { to: "/table-barcodes", label: "Table QR", icon: QrCode },
  { to: "/menu-items", label: "Menu Items", icon: Utensils },
  { to: "/smart-inventory", label: "Smart Inventory", icon: Package },
  { to: "/invoices", label: "Invoices", icon: ReceiptText },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/coupons", label: "Coupons", icon: BadgePercent },
  { to: "/rewards", label: "Rewards", icon: Gift },
  { to: "/audit-logs", label: "Audit Log", icon: ClipboardList },
  { to: "/royalty", label: "Royalty Management", icon: Landmark },
];

const linkClass = ({ isActive }) => (isActive ? "sidebar-link active" : "sidebar-link");

export default function Sidebar({ onClose }) {
  const navigate = useNavigate();
  const platform = usePlatform();
  const isMaster = isMasterAdmin();
  const [activeBranch, setActiveBranchState] = useState(getActiveBranch);
  const [branches, setBranches] = useState([]);
  const [showProfile, setShowProfile] = useState(false);
  const [showApprovals, setShowApprovals] = useState(false);
  const { toast, showToast } = useToast();
  // Head office watches for branch profile changes waiting on approval.
  const { pendingCount, refresh: refreshApprovals } = useBranchApprovals(isMaster);

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
  // The master admin's sidebar only ever has Branch Management, Support and Logout --
  // no Dashboard nav item and no operational/billing pages, even once a branch is
  // open. A branch's Dashboard is reached by clicking its card in Branch Management
  // (which opens "/" directly); it doesn't need its own persistent sidebar link.
  const links = isMaster ? [] : branchLinks.filter((link) => !hidden.includes(link.to));

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <img src="/Restrosethu_logo.png" alt="RestroSethu" className="sidebar-logo" />
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
          <button
            type="button"
            className="sidebar-branch-context sidebar-branch-badge"
            onClick={() => setShowProfile(true)}
            title="View and edit your branch details"
          >
            <Store size={15} />
            <span>{activeBranch.name}</span>
          </button>
        )
      )}

      <nav className="sidebar-nav">
        {isMaster && (
          <button type="button" className="sidebar-link sidebar-bell" onClick={() => setShowApprovals(true)}>
            <span className="sidebar-bell-icon">
              <Bell size={18} />
              {pendingCount > 0 && <i className="sidebar-bell-dot">{pendingCount > 9 ? "9+" : pendingCount}</i>}
            </span>
            <span>Approvals</span>
            {pendingCount > 0 && <b className="sidebar-bell-count">{pendingCount}</b>}
          </button>
        )}

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

        {/* Settings is a branch-config page -- the master admin's sidebar stays to
            just Branch Management, Support and Logout. */}
        {!isMaster && !hidden.includes("/settings") && (
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

      {/* Modals are portalled to <body> so the sidebar's stacking context can't
          trap them beneath sticky page content like the dashboard filter bar. */}
      {showProfile &&
        createPortal(
          <BranchProfileModal onClose={() => setShowProfile(false)} showToast={showToast} />,
          document.body
        )}

      {showApprovals &&
        createPortal(
          <BranchApprovals
            onClose={() => setShowApprovals(false)}
            onReviewed={refreshApprovals}
            showToast={showToast}
          />,
          document.body
        )}

      <ToastViewport toast={toast} />
    </aside>
  );
}
