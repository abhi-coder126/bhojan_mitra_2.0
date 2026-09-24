import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "./components/Sidebar";
import OrderAlarm from "./components/OrderAlarm";
import { ToastViewport, useToast } from "./components/Toast";

import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import AllProducts from "./pages/AllProducts";
import Purchase from "./pages/Purchase";
import GRNManagement from "./pages/GRNManagement";
import Reports from "./pages/Reports";
import Customers from "./pages/Customers";
import Vendors from "./pages/Vendors";
import SalesReturn from "./pages/SalesReturn";
import Settings from "./pages/Settings";
import Coupons from "./pages/Coupons";
import Rewards from "./pages/Rewards";
import Accounts from "./pages/Accounts";
import SupplierBills from "./pages/SupplierBills";
import Login from "./pages/Login";
import RestaurantOrders from "./pages/RestaurantOrders";
import CustomerMenu from "./pages/CustomerMenu";
import TableBarcodes from "./pages/TableBarcodes";
import Tables from "./pages/Tables";
import KDS from "./pages/KDS";
import SmartInventory from "./pages/SmartInventory";
import AuditLogs from "./pages/AuditLogs";
import BranchManagement from "./pages/BranchManagement";
import RoyaltyManagement from "./pages/RoyaltyManagement";
import Support from "./pages/Support";
import API from "./api/axios";
import { loadPlatform } from "./api/platform";
import { BRANCH_CHANGED_EVENT, getActiveBranch, isMasterAdmin, setActiveBranch } from "./api/session";

const pageMeta = {
  "/": {
    title: "Dashboard | RestroSethu Billing Software",
    description: "Complete overview of sales, payments, returns, stock alerts and business performance.",
  },
  "/products": {
    title: "Menu Items | RestroSethu Restaurant POS",
    description: "Create and manage restaurant menu items with category, pricing, GST and availability.",
  },
  "/menu-items": {
    title: "Menu Items | RestroSethu Restaurant POS",
    description: "Create and manage restaurant menu items with category, pricing, GST and availability.",
  },
  "/all-products": {
    title: "Inventory | RestroSethu Billing Software",
    description: "Track live stock, low stock items, purchase cost, selling price, category and vendor details.",
  },
  "/purchase": {
    title: "Purchase / GRN | RestroSethu Billing Software",
    description: "Receive vendor stock, create purchase bills, update product cost and manage GRN payments.",
  },
  "/grn-management": {
    title: "GRN Management | RestroSethu Billing Software",
    description: "Review, search and update goods received notes, purchase quantities, pricing and payment records.",
  },
  "/supplier-bills": {
    title: "Supplier Bills | RestroSethu Billing Software",
    description: "View supplier invoices, GRN totals, paid amounts, pending balances and payment status.",
  },
  "/sales-return": {
    title: "Sales Return / Refund | RestroSethu Billing Software",
    description: "Manage invoice returns, returned products, refund amounts and stock reversal records.",
  },
  "/reports": {
    title: "Sales Reports | RestroSethu Billing Software",
    description: "Search and review invoices, customers, payment modes, sale totals and billing history.",
  },
  "/customers": {
    title: "Customers | RestroSethu Billing Software",
    description: "Manage customer profiles, CRN records, contact details, address and purchase history.",
  },
  "/vendors": {
    title: "Vendors | RestroSethu Billing Software",
    description: "Manage supplier profiles, GST details, opening balance, purchases and outstanding payments.",
  },
  "/accounts": {
    title: "Accounts | RestroSethu Billing Software",
    description: "Track vendor pending payments, payment history and supplier account balances.",
  },
  "/coupons": {
    title: "Coupons | RestroSethu Billing Software",
    description: "Create, control and manage billing discount coupons for customer invoices.",
  },
  "/rewards": {
    title: "Rewards | RestroSethu Billing Software",
    description: "Set delivery order milestones and the scratch-card offers customers win for reaching them.",
  },
  "/settings": {
    title: "Settings | RestroSethu Billing Software",
    description: "Configure store details, invoice printing, payment modes, policies and system preferences.",
  },
  "/restaurant-orders": {
    title: "Restaurant Orders | RestroSethu Billing Software",
    description: "Manage table QR orders, live restaurant order status and customer menu ordering.",
  },
  "/table-barcodes": {
    title: "Table QR Setup | RestroSethu Restaurant POS",
    description: "Generate and print table QR codes for customer self ordering.",
  },
  "/tables": {
    title: "Table Management | RestroSethu Restaurant POS",
    description: "Visual floor plan with live table status: available, occupied, reserved, cleaning and billing.",
  },
  "/audit-logs": {
    title: "Audit Log | RestroSethu Billing Software",
    description: "Track sensitive changes such as discounts, price overrides, refunds and stock adjustments.",
  },
  "/kds": {
    title: "Kitchen Display | RestroSethu Restaurant POS",
    description: "Live kitchen screen showing order items by status with prep timers.",
  },
  "/smart-inventory": {
    title: "Smart Inventory | RestroSethu Restaurant POS",
    description: "Raw materials, recipes, food cost % and low stock alerts.",
  },
  "/royalty": {
    title: "Royalty Management | RestroSethu",
    description: "Royalty payable to head office, the rate it is charged at and the sales it is calculated from.",
  },
  "/branches": {
    title: "Branch Management | RestroSethu Head Office",
    description: "Add, hold and remove branches, set royalty and review every branch's sales.",
  },
  "/support": {
    title: "Support | RestroSethu",
    description: "Contact RestroSethu support to resolve issues quickly.",
  },
  "/login": {
    title: "Login | RestroSethu Billing Software",
    description: "Secure login for RestroSethu billing, inventory, purchase and POS management.",
  },
};

function PageMeta() {
  const location = useLocation();

  useEffect(() => {
    const meta = pageMeta[location.pathname] || pageMeta["/"];
    document.title = meta.title;

    let description = document.querySelector('meta[name="description"]');
    if (!description) {
      description = document.createElement("meta");
      description.setAttribute("name", "description");
      document.head.appendChild(description);
    }

    description.setAttribute("content", meta.description);
  }, [location.pathname]);

  return null;
}

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.querySelector(".main-content")?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  return null;
}

// Pages a master admin can use without having a branch open.
const HEAD_OFFICE_PATHS = ["/branches", "/support", "/settings"];

// Keeps the UI's open branch in sync with the session and, for a master admin with
// no branch open, either drops them into the only branch (single-outlet setups) or
// sends them to Branch Management to pick one.
function useBranchGate(token) {
  const location = useLocation();
  const [activeBranch, setActiveBranchState] = useState(getActiveBranch);
  const [resolving, setResolving] = useState(() => Boolean(token) && isMasterAdmin() && !getActiveBranch());

  useEffect(() => {
    const sync = () => setActiveBranchState(getActiveBranch());
    window.addEventListener(BRANCH_CHANGED_EVENT, sync);
    return () => window.removeEventListener(BRANCH_CHANGED_EVENT, sync);
  }, []);

  // Refresh the saved session once per load: sessions from before multi-branch have
  // no branch on them, and head office may have renamed the branch since login.
  useEffect(() => {
    if (!token) return;
    API.get("/auth/me")
      .then((res) => {
        localStorage.setItem("user", JSON.stringify(res.data.user));
        window.dispatchEvent(new Event(BRANCH_CHANGED_EVENT));
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token || !isMasterAdmin() || activeBranch) {
      setResolving(false);
      return undefined;
    }

    let alive = true;
    setResolving(true);
    Promise.all([loadPlatform(), API.get("/branches/options")])
      .then(([platform, res]) => {
        const branches = res.data.branches || [];
        if (!alive) return;
        // Only force a branch open for single-outlet installs (multi-branch switching
        // turned off), where there is no real "head office" choice to make. Once
        // multi-branch is on, the master admin must pick explicitly -- including
        // picking "Head office (all branches)", which must stick and not get
        // silently overridden back to a branch on the next render.
        if (!platform?.multiBranchEnabled && branches.length > 0) {
          setActiveBranch(branches.find((b) => b.isDefault) || branches[0]);
        }
      })
      .catch(() => {})
      .finally(() => alive && setResolving(false));

    return () => {
      alive = false;
    };
  }, [token, activeBranch]);

  const needsBranch = isMasterAdmin() && !activeBranch && !HEAD_OFFICE_PATHS.includes(location.pathname);
  return { activeBranch, resolving, needsBranch };
}

// Once the master admin has a branch open, they can only view that branch's
// Dashboard -- billing and every other operational page stays with branch staff.
const MASTER_BRANCH_ALLOWED_PATHS = ["/", "/branches", "/support"];

function ProtectedLayout() {
  const token = localStorage.getItem("token");
  const { activeBranch, resolving, needsBranch } = useBranchGate(token);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showWelcome, setShowWelcome] = useState(() => sessionStorage.getItem("showWelcome") === "1");
  const location = useLocation();

  useEffect(() => {
    if (!showWelcome) return undefined;

    const timer = window.setTimeout(() => {
      sessionStorage.removeItem("showWelcome");
      setShowWelcome(false);
    }, 8600);

    return () => window.clearTimeout(timer);
  }, [showWelcome]);

  if (!token) return <Navigate to="/login" replace />;
  if (showWelcome) return <WelcomeScreen />;
  if (resolving) return null;
  if (needsBranch) return <Navigate to="/branches" replace />;
  if (
    isMasterAdmin() &&
    activeBranch &&
    !MASTER_BRANCH_ALLOWED_PATHS.includes(location.pathname)
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={`app-layout ${!sidebarOpen ? "sidebar-closed" : ""}`}>
      <OrderAlarm key={activeBranch?.id || "head-office"} />

      {sidebarOpen && (
        <Sidebar onClose={() => setSidebarOpen(false)} />
      )}

      {!sidebarOpen && (
        <aside className="sidebar-mini">
          <button
            className="show-sidebar-btn"
            onClick={() => setSidebarOpen(true)}
            title="Show Menu"
          >
            <Menu size={24} />
          </button>
        </aside>
      )}

      <main className="main-content">
        {/* Keyed by branch: switching branches remounts every page so nothing from the
            previous branch stays on screen. */}
        <Routes key={activeBranch?.id || "head-office"}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/billing" element={<Navigate to="/restaurant-orders" replace />} />
          <Route path="/products" element={<Navigate to="/menu-items" replace />} />
          <Route path="/menu-items" element={<Products />} />
          <Route path="/all-products" element={<AllProducts />} />
          <Route path="/purchase" element={<Purchase />} />
          <Route path="/grn-management" element={<GRNManagement />} />
          <Route path="/supplier-bills" element={<SupplierBills />} />
          <Route path="/sales-return" element={<SalesReturn />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/coupons" element={<Coupons />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/restaurant-orders" element={<RestaurantOrders />} />
          <Route path="/table-barcodes" element={<TableBarcodes />} />
          <Route path="/tables" element={<Tables />} />
          <Route path="/kds" element={<KDS />} />
          <Route path="/smart-inventory" element={<SmartInventory />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
          <Route path="/royalty" element={<RoyaltyManagement />} />
          <Route path="/branches" element={isMasterAdmin() ? <BranchManagement /> : <Navigate to="/" replace />} />
          <Route path="/support" element={<Support />} />
        </Routes>
      </main>
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div className="welcome-screen">
      <img src="/Welcome.svg" alt="Welcome to RestroSethu" />
    </div>
  );
}

function GlobalPageLoader() {
  const location = useLocation();
  const [showLoader, setShowLoader] = useState(true);

  useEffect(() => {
    if (sessionStorage.getItem("showWelcome") === "1") {
      setShowLoader(false);
      return undefined;
    }

    setShowLoader(true);
    const timer = window.setTimeout(() => setShowLoader(false), 950);

    return () => window.clearTimeout(timer);
  }, [location.key, location.pathname, location.search]);

  if (!showLoader) return null;

  return (
    <div className="global-page-loader">
      <img src="/loading.svg" alt="Loading" className="global-page-loader-animation" />
    </div>
  );
}

export default function App() {
  const { toast, showToast } = useToast();

  useEffect(() => {
    const nativeAlert = window.alert;
    window.alert = (message) => showToast(String(message || ""), "info");
    return () => {
      window.alert = nativeAlert;
    };
  }, [showToast]);

  return (
    <>
      <PageMeta />
      <ScrollToTop />
      <GlobalPageLoader />
      <ToastViewport toast={toast} />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/menu/:branchCode/:tableNo" element={<CustomerMenu />} />
        <Route path="/menu/:tableNo" element={<CustomerMenu />} />
        <Route path="/*" element={<ProtectedLayout />} />
      </Routes>
    </>
  );
}
