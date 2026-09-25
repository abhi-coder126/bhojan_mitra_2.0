import AsyncButton from "../components/AsyncButton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Banknote, Bell, Bike, ChefHat, CheckCircle2, ClipboardList, CreditCard, Gift, LayoutGrid, Minus, Plus, Printer, QrCode, ReceiptText, RefreshCcw, Search, ShoppingBag, Smartphone, Utensils, X } from "lucide-react";
import API from "../api/axios";
import { hasProductImage, productImageSrc } from "../api/productImage";
import { notifyOrdersUpdated } from "../api/orderAlarm";
import { ToastViewport, useToast } from "../components/Toast";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import ConfirmActionModal from "../components/ConfirmActionModal";
import StatusBadge from "../components/StatusBadge";
import { KotReceipt, TaxInvoiceReceipt } from "../components/ThermalReceipt";
import { toInvoiceData } from "../components/receiptData";

const workflowStatuses = ["new", "accepted", "preparing", "ready", "served"];

// "1h 04m" / "12m 30s" / "45s" -- the shortest honest reading.
const formatDuration = (ms) => {
  if (!Number.isFinite(ms) || ms < 0) return "";
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return hours + "h " + String(minutes).padStart(2, "0") + "m";
  if (minutes > 0) return minutes + "m " + String(seconds).padStart(2, "0") + "s";
  return seconds + "s";
};

// "served" is the shared status value for both dine-in and delivery orders (same
// workflow step -- order is complete), but showing "Served" for a delivery order
// reads wrong to staff. Only the label changes here; the underlying status string
// stored in the DB and used for workflow logic stays "served" for both order types.
const statusLabel = (status, orderType) =>
  status !== "served" ? status
    : orderType === "delivery" ? "delivered"
    : orderType === "takeaway" ? "picked up"
    : status;

// One place that decides how an order is titled, now that there are three types.
export const orderTypeLabel = (order) =>
  order.orderType === "delivery" ? "Delivery"
    : order.orderType === "takeaway" ? "Takeaway"
    : `Table ${order.tableNo}`;

const defaultOrderSettings = {
  restaurantOrderSoundEnabled: true,
  restaurantOrderRepeatSound: true,
  restaurantOrderPopupEnabled: true,
  restaurantOrderRefreshSeconds: 5,
  restaurantTableCount: 28,
  storeName: "RestroSethu",
  storeShortName: "RestroSethu",
  storeAddress: "Restaurant & Billing Management",
  gstNumber: "",
  storeContact: "",
  storeEmail: "",
  logo: "",
  invoicePrefix: "INV",
  invoicePrintSize: "80MM",
  thankYouMessage: "Thank you for dining with us!",
  termsAndConditions: "",
  returnPolicy: "",
  showStoreDetails: true,
  showGSTDetails: true,
  showCustomerDetails: true,
  showTerms: true,
  showReturnPolicy: true,
  showThankYou: true,
  cashEnabled: true,
  upiEnabled: true,
  cardEnabled: true,
  partialPaymentEnabled: true,
};

export default function RestaurantOrders() {
  const [orders, setOrders] = useState([]);
  const [tableCount, setTableCount] = useState(28);
  // Tables set up in Table Management, with their live status (reserved, cleaning...).
  const [tableDocs, setTableDocs] = useState([]);
  const [activeSection, setActiveSection] = useState("tables");
  // Which of the two non-table channels the pickup board is showing.
  const [pickupType, setPickupType] = useState("takeaway");
  // Ticks every second so the running clocks move without refetching orders.
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [selectedTable, setSelectedTable] = useState(null);
  const [orderSettings, setOrderSettings] = useState(defaultOrderSettings);
  const [activePopupOrderId, setActivePopupOrderId] = useState(null);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [paidInvoice, setPaidInvoice] = useState(null);
  const [kotOrder, setKotOrder] = useState(null);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [paymentForm, setPaymentForm] = useState({ mode: "", cash: "", upi: "", card: "" });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [discountOrder, setDiscountOrder] = useState(null);
  const [discountForm, setDiscountForm] = useState({ amount: "", reason: "" });
  const [splitOrder, setSplitOrder] = useState(null);
  const [splitSelected, setSplitSelected] = useState([]);
  const [mergeOrder, setMergeOrder] = useState(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [products, setProducts] = useState([]);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [newOrderTable, setNewOrderTable] = useState("1");
  // "dine-in" | "takeaway" | "delivery"
  const [newOrderType, setNewOrderType] = useState("dine-in");
  const [newOrderCustomerName, setNewOrderCustomerName] = useState("");
  const [newOrderSearch, setNewOrderSearch] = useState("");
  const [newOrderCart, setNewOrderCart] = useState([]);
  // Item offers, so the counter can tell the guest what comes free with what.
  const [menuOffers, setMenuOffers] = useState([]);
  const [placingNewOrder, setPlacingNewOrder] = useState(false);
  const knownOrderIds = useRef(new Set());
  const initialLoadDone = useRef(false);
  const { toast, showToast } = useToast();

  const fetchOrderSettings = useCallback(async () => {
    try {
      const res = await API.get("/settings");
      const nextSettings = { ...defaultOrderSettings, ...(res.data.settings || {}) };
      setOrderSettings(nextSettings);
      setTableCount(Number(nextSettings.restaurantTableCount || 28));
    } catch (error) {
      showToast(error.response?.data?.message || "Order settings could not be loaded", "warning");
    }
  }, [showToast]);

  useEffect(() => {
    fetchOrderSettings();
    API.get("/products")
      .then((res) => setProducts(res.data.products || []))
      .catch(() => {});
  }, [fetchOrderSettings]);

  const fetchOrders = useCallback(async () => {
    try {
      const [res, tablesRes] = await Promise.all([
        API.get("/restaurant-orders"),
        API.get("/tables").catch(() => null),
      ]);
      if (tablesRes) setTableDocs(tablesRes.data.tables || []);
      const latestOrders = res.data.orders || [];
      const incomingNewOrders = latestOrders.filter(
        (order) => order.status === "new" && !knownOrderIds.current.has(order._id)
      );

      setOrders(latestOrders);
      notifyOrdersUpdated(latestOrders);

      latestOrders.forEach((order) => knownOrderIds.current.add(order._id));

      if (initialLoadDone.current && incomingNewOrders.length > 0) {
        if (orderSettings.restaurantOrderPopupEnabled) {
          setActivePopupOrderId(incomingNewOrders[0]._id);
        }
        // The looping ringtone itself is handled globally by <OrderAlarm />.
        showToast(`New order: Table ${incomingNewOrders[0].tableNo}`, "success");
      }

      initialLoadDone.current = true;
    } catch (error) {
      showToast(error.response?.data?.message || "Orders could not be loaded");
    }
  }, [orderSettings.restaurantOrderPopupEnabled, showToast]);

  useEffect(() => {
    fetchOrders();

    const refreshMs = Math.max(3, Number(orderSettings.restaurantOrderRefreshSeconds || 5)) * 1000;
    const timer = setInterval(fetchOrders, refreshMs);
    return () => clearInterval(timer);
  }, [orderSettings.restaurantOrderRefreshSeconds, fetchOrders]);

  const activeOrders = useMemo(
    () => orders.filter((order) => order.status !== "cancelled" && order.paymentStatus !== "paid"),
    [orders]
  );

  // Takeaway and delivery never occupy a table, so they are invisible on the
  // table board. This is where the counter watches them.
  const pickupCounts = useMemo(() => {
    const live = activeOrders.filter((order) => order.orderType !== "dine-in");
    return {
      takeaway: live.filter((order) => order.orderType === "takeaway").length,
      delivery: live.filter((order) => order.orderType === "delivery").length,
      total: live.length,
    };
  }, [activeOrders]);

  const pickupOrders = useMemo(
    () => activeOrders
      .filter((order) => order.orderType === pickupType)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [activeOrders, pickupType]
  );

  useEffect(() => {
    API.get("/menu-offers")
      .then((res) => setMenuOffers((res.data.offers || []).filter((offer) => offer.runsToday)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  // Counts from acceptance, which is when the kitchen clock really starts.
  const runningFor = (order) =>
    order.acceptedAt && order.status !== "served" && order.status !== "cancelled"
      ? formatDuration(clockNow - new Date(order.acceptedAt).getTime())
      : "";

  const updateStatus = async (orderId, status) => {
    const order = orders.find((item) => item._id === orderId);
    setStatusTarget({ orderId, status, orderNo: order?.orderNo || "Order" });
  };

  const confirmStatusUpdate = async () => {
    if (!statusTarget) return;
    try {
      await API.patch(`/restaurant-orders/${statusTarget.orderId}/status`, { status: statusTarget.status });
      if (statusTarget.status !== "new" && activePopupOrderId === statusTarget.orderId) {
        setActivePopupOrderId(null);
      }
      const accepted = statusTarget.status === "accepted";
      setStatusTarget(null);
      fetchOrders();
      showToast(accepted ? "Order accepted. Send the KOT to the kitchen next." : "Order status updated", "success");
    } catch (error) {
      showToast(error.response?.data?.message || "Status update failed");
    }
  };

  // Counter sends the KOT for an accepted order; only then does the kitchen see it.
  const sendKot = async (order) => {
    try {
      const res = await API.patch(`/restaurant-orders/${order._id}/kot`);
      showToast("KOT sent to the kitchen", "success");
      setKotOrder(res.data.order);
      fetchOrders();
    } catch (error) {
      showToast(error.response?.data?.message || "Could not send the KOT");
    }
  };

  const setTableStatus = async (table, status) => {
    try {
      await API.patch(`/tables/${table.id}/status`, { status });
      showToast(`Table ${table.number} marked ${status}`, "success");
      fetchOrders();
    } catch (error) {
      showToast(error.response?.data?.message || "Could not update the table");
    }
  };

  const kitchenProgress = (order) => {
    if (order.status === "preparing") return "Kitchen: preparing";
    if ((order.items || []).some((item) => item.itemStatus === "NEW")) return "KOT sent - waiting for kitchen";
    return "Kitchen accepted the KOT";
  };

  // The counter's steps, in order: Accept -> Send KOT -> (kitchen cooks) -> Serve -> Payment.
  const renderFlowActions = (order) => (
    <>
      {order.status === "new" && (
        <AsyncButton className="accept-order-btn" onClick={() => updateStatus(order._id, "accepted")}>
          <CheckCircle2 size={17} />
          Accept
        </AsyncButton>
      )}
      {order.status === "accepted" && !order.kotSentAt && (
        <AsyncButton className="accept-order-btn" onClick={() => sendKot(order)}>
          <Printer size={16} />
          Send KOT to Kitchen
        </AsyncButton>
      )}
      {order.kotSentAt && ["accepted", "preparing"].includes(order.status) && (
        <span className="kitchen-progress-chip">
          <ChefHat size={15} />
          {kitchenProgress(order)}
        </span>
      )}
      {order.status === "ready" && (
        <AsyncButton className="serve-order-btn" onClick={() => updateStatus(order._id, "served")}>
          <Utensils size={16} />
          {order.orderType === "delivery" ? "Mark Delivered" : "Mark Served"}
        </AsyncButton>
      )}
      {order.status === "served" && order.paymentStatus !== "paid" && (
        <button className="payment-action-btn" onClick={() => openPayment(order)}>
          <CreditCard size={16} />
          Payment
        </button>
      )}
      {!["served", "cancelled"].includes(order.status) && (
        <AsyncButton className="reject-order-btn" onClick={() => updateStatus(order._id, "cancelled")}>
          Cancel
        </AsyncButton>
      )}
    </>
  );

  // Waiter/captain flow: staff picks a table and items directly from this screen
  // instead of the customer having to scan the QR menu themselves.
  const newOrderFilteredProducts = useMemo(() => {
    const q = newOrderSearch.toLowerCase().trim();
    if (!q) return products;
    return products.filter(
      (p) => p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)
    );
  }, [products, newOrderSearch]);

  const offerHints = useMemo(() => {
    if (!menuOffers.length || !newOrderCart.length) return [];
    const total = newOrderCart.reduce((sum, item) => sum + item.rate * item.qty, 0);
    const ids = new Set(newOrderCart.map((item) => String(item.productId)));
    return menuOffers
      .filter((offer) => ids.has(String(offer.productId)))
      .map((offer) => ({
        _id: offer._id,
        title: offer.title,
        detail: offer.type === "bogo"
          ? "Second " + offer.productName + " free"
          : "Free " + (offer.freeSizeLabel ? offer.freeProductName + " (" + offer.freeSizeLabel + ")" : offer.freeProductName),
        sizes: offer.sizeLabels || [],
        // Below the minimum the give-away will not fire, so say how much short.
        shortBy: Math.max(0, Number(offer.minOrderAmount || 0) - total),
      }));
  }, [menuOffers, newOrderCart]);

  const newOrderCartQty = newOrderCart.reduce((sum, item) => sum + item.qty, 0);
  const newOrderCartTotal = newOrderCart.reduce((sum, item) => sum + item.rate * item.qty, 0);

  const changeNewOrderQty = (product, delta) => {
    setNewOrderCart((current) => {
      const existing = current.find((item) => item.productId === product._id);
      if (!existing && delta > 0) {
        return [
          ...current,
          {
            productId: product._id,
            name: product.name,
            rate: Number(product.mrp || product.sellingPrice || 0),
            gst: Number(product.gst || 0),
            qty: 1,
          },
        ];
      }
      return current
        .map((item) => (item.productId === product._id ? { ...item, qty: item.qty + delta } : item))
        .filter((item) => item.qty > 0);
    });
  };

  const resetNewOrderForm = () => {
    setNewOrderTable("1");
    setNewOrderType("dine-in");
    setNewOrderCustomerName("");
    setNewOrderSearch("");
    setNewOrderCart([]);
  };

  const submitNewOrder = async () => {
    if (placingNewOrder) return;
    if (newOrderCart.length === 0) return showToast("Add at least one item", "warning");
    if (newOrderType === "delivery" && !newOrderCustomerName.trim()) {
      return showToast("Customer name required for delivery orders", "warning");
    }

    setPlacingNewOrder(true);
    try {
      await API.post("/restaurant-orders", {
        orderType: newOrderType,
        tableNo: newOrderType === "dine-in" ? newOrderTable : "",
        orderSource: "captain",
        customerName: newOrderCustomerName.trim() || "Walk-in Customer",
        customerPhone: "",
        items: newOrderCart.map((item) => ({ productId: item.productId, qty: item.qty })),
      });
      showToast("Order placed", "success");
      setNewOrderOpen(false);
      resetNewOrderForm();
      fetchOrders();
    } catch (error) {
      showToast(error.response?.data?.message || "Could not place order");
    } finally {
      setPlacingNewOrder(false);
    }
  };

  const openPayment = (order) => {
    setPaymentOrder(order);
    setPaymentForm({ mode: "", cash: "", upi: "", card: "" });
  };

  const submitPayment = async () => {
    if (!paymentForm.mode) return showToast("Payment mode required", "warning");

    const payload = {
      mode: paymentForm.mode,
      cash: paymentForm.mode === "Cash" ? paymentOrder.grandTotal : paymentForm.cash,
      upi: paymentForm.mode === "UPI" ? paymentOrder.grandTotal : paymentForm.upi,
      card: paymentForm.mode === "Card" ? paymentOrder.grandTotal : paymentForm.card,
    };

    if (paymentForm.mode === "Partial") {
      const paid = Number(payload.cash || 0) + Number(payload.upi || 0) + Number(payload.card || 0);
      if (paid <= 0) return showToast("Partial payment amount required", "warning");
    }

    try {
      const res = await API.patch(`/restaurant-orders/${paymentOrder._id}/payment`, payload);
      setPaidInvoice(res.data.order);
      setPaymentOrder(null);
      fetchOrders();
      showToast("Payment done. Table cleared.", "success");
    } catch (error) {
      showToast(error.response?.data?.message || "Payment failed");
    }
  };

  const deleteRestaurantInvoice = async (order) => {
    setDeleteTarget(order);
  };

  const confirmDeleteRestaurantInvoice = async (password) => {
    const order = deleteTarget;
    try {
      await API.delete(`/restaurant-orders/${order._id}`, { data: { password } });
      if (paidInvoice?._id === order._id) {
        setPaidInvoice(null);
      }
      setDeleteTarget(null);
      fetchOrders();
      showToast("Restaurant invoice deleted", "success");
    } catch (error) {
      showToast(error.response?.data?.message || "Restaurant invoice delete failed");
    }
  };

  const holdOrder = async (order) => {
    try {
      await API.patch(`/restaurant-orders/${order._id}/hold`);
      fetchOrders();
      showToast("Order held", "success");
    } catch (error) {
      showToast(error.response?.data?.message || "Hold failed");
    }
  };

  const resumeOrder = async (order) => {
    try {
      await API.patch(`/restaurant-orders/${order._id}/resume`);
      fetchOrders();
      showToast("Order resumed", "success");
    } catch (error) {
      showToast(error.response?.data?.message || "Resume failed");
    }
  };

  const openDiscount = (order) => {
    setDiscountOrder(order);
    setDiscountForm({ amount: order.discountAmount || "", reason: order.discountReason || "" });
  };

  const submitDiscount = async () => {
    if (!discountForm.reason.trim()) return showToast("Discount reason required", "warning");
    try {
      await API.patch(`/restaurant-orders/${discountOrder._id}/discount`, {
        discountAmount: Number(discountForm.amount || 0),
        discountReason: discountForm.reason.trim(),
      });
      setDiscountOrder(null);
      fetchOrders();
      showToast("Discount applied", "success");
    } catch (error) {
      showToast(error.response?.data?.message || "Discount failed");
    }
  };

  const openSplit = (order) => {
    setSplitOrder(order);
    setSplitSelected([]);
  };

  const toggleSplitItem = (index) => {
    setSplitSelected((current) =>
      current.includes(index) ? current.filter((i) => i !== index) : [...current, index]
    );
  };

  const submitSplit = async () => {
    if (splitSelected.length === 0) return showToast("Select at least one item to split", "warning");
    try {
      await API.post(`/restaurant-orders/${splitOrder._id}/split`, { itemIndexes: splitSelected });
      setSplitOrder(null);
      fetchOrders();
      showToast("Bill split successfully", "success");
    } catch (error) {
      showToast(error.response?.data?.message || "Split failed");
    }
  };

  const openMerge = (order) => {
    setMergeOrder(order);
    setMergeTargetId("");
  };

  const submitMerge = async () => {
    if (!mergeTargetId) return showToast("Select a target order to merge into", "warning");
    try {
      await API.post(`/restaurant-orders/merge`, { targetOrderId: mergeTargetId, sourceOrderId: mergeOrder._id });
      setMergeOrder(null);
      fetchOrders();
      showToast("Orders merged", "success");
    } catch (error) {
      showToast(error.response?.data?.message || "Merge failed");
    }
  };

  // Tables from Table Management when they're set up there; otherwise the count from Settings.
  const tables = tableDocs.length > 0
    ? tableDocs.map((table) => ({ id: table._id, number: String(table.number), status: table.status }))
    : Array.from({ length: Number(tableCount || 0) }, (_, index) => ({ id: null, number: String(index + 1), status: "available" }));
  const ordersByTable = useMemo(() => {
    const map = new Map();

    activeOrders.forEach((order) => {
      const key = String(order.tableNo);
      const existing = map.get(key) || [];
      map.set(key, [...existing, order]);
    });

    return map;
  }, [activeOrders]);

  const selectedTableOrders = selectedTable
    ? ordersByTable.get(String(selectedTable)) || []
    : [];

  const getTableStatus = (table) => {
    const tableOrders = ordersByTable.get(table.number) || [];
    if (tableOrders.some((order) => order.status === "new")) return "new";
    if (tableOrders.some((order) => order.status === "preparing")) return "preparing";
    if (tableOrders.some((order) => order.status === "ready")) return "ready";
    if (tableOrders.some((order) => order.status === "served")) return "served";
    if (tableOrders.some((order) => order.status === "accepted")) return "accepted";
    // No running order: show what Table Management says (reserved, cleaning...).
    if (["reserved", "cleaning", "occupied", "billing"].includes(table.status)) return table.status;
    return "blank";
  };

  const popupOrder =
    orders.find((order) => order._id === activePopupOrderId && order.status === "new") ||
    orders.find((order) => order.status === "new");
  const paidInvoices = orders.filter((order) => order.paymentStatus === "paid");
  const getInvoiceNo = (order) => order.invoiceNo || order.orderNo || `INV-${order._id?.slice(-6) || "ORDER"}`;
  const formatDateTime = (value) =>
    value
      ? new Date(value).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "N/A";
  const filteredPaidInvoices = paidInvoices.filter((order) => {
    const query = invoiceSearch.trim().toLowerCase();
    if (!query) return true;
    return [
      getInvoiceNo(order),
      order.orderNo,
      order.customerName,
      order.customerPhone,
      order.orderType,
      order.tableNo ? `table ${order.tableNo}` : "",
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
  const getWorkflowProgress = (status) => {
    const index = workflowStatuses.indexOf(status);
    return index === -1 ? 0 : index;
  };

  return (
    <div className="restaurant-admin-page">
      <ToastViewport toast={toast} />

      <div className="page-head restaurant-head">
        <div>
          <h1>Table View</h1>
          <p>When a QR order arrives, the table will highlight and the counter alert will play.</p>
        </div>
        <div className="restaurant-head-actions">
          <button
            type="button"
            className="captain-new-order-btn"
            onClick={() => {
              resetNewOrderForm();
              setNewOrderOpen(true);
            }}
          >
            <Utensils size={17} />
            New Order
          </button>
          <button onClick={() => window.location.reload()}>
            <RefreshCcw size={17} />
            Refresh
          </button>
        </div>
      </div>

      <section className="restaurant-stats-grid">
        <div>
          <span>Active orders</span>
          <b>{activeOrders.length}</b>
        </div>
        <div>
          <span>New</span>
          <b>{orders.filter((order) => order.status === "new").length}</b>
        </div>
        <div>
          <span>Ready</span>
          <b>{orders.filter((order) => order.status === "ready").length}</b>
        </div>
      </section>

      <div className="restaurant-section-tabs">
        <button
          type="button"
          className={activeSection === "tables" ? "active" : ""}
          onClick={() => setActiveSection("tables")}
        >
          <LayoutGrid size={15} /> Table View
        </button>
        <button
          type="button"
          className={activeSection === "orders" ? "active" : ""}
          onClick={() => setActiveSection("orders")}
        >
          <ClipboardList size={15} /> Running Orders
        </button>
        <button
          type="button"
          className={activeSection === "pickup" ? "active" : ""}
          onClick={() => setActiveSection("pickup")}
        >
          <ShoppingBag size={15} /> Takeaway &amp; Delivery
          {pickupCounts.total > 0 && <b className="section-tab-count">{pickupCounts.total}</b>}
        </button>
        <button
          type="button"
          className={activeSection === "invoices" ? "active" : ""}
          onClick={() => setActiveSection("invoices")}
        >
          <ReceiptText size={15} /> Invoices
        </button>
      </div>

      {activeSection === "tables" && <section className="table-view-panel">
        <div className="table-view-toolbar">
          <div className="table-legend">
            <span><i className="legend-dot blank" /> Blank Table</span>
            <span><i className="legend-dot new" /> New Order</span>
            <span><i className="legend-dot preparing" /> Preparing</span>
            <span><i className="legend-dot ready" /> Ready</span>
            <span><i className="legend-dot served" /> Served</span>
            <span><i className="legend-dot reserved" /> Reserved</span>
            <span><i className="legend-dot cleaning" /> Cleaning</span>
          </div>
          {tableDocs.length === 0 ? (
            <label>
              Tables
              <input
                type="number"
                min="1"
                max="80"
                value={tableCount}
                onChange={(e) => setTableCount(e.target.value)}
              />
            </label>
          ) : (
            <span className="table-source-note">Tables from Table Management</span>
          )}
        </div>

        <div className="table-grid">
          {tables.map((table) => {
            const status = getTableStatus(table);
            const tableOrders = ordersByTable.get(table.number) || [];
            const idleLabel = { reserved: "Reserved", cleaning: "Cleaning", occupied: "Occupied", billing: "Billing" }[status] || "Blank";
            const tableTotal = tableOrders.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0);
            const hasCoupon = tableOrders.some((order) => order.couponCode);

            return (
              <button
                type="button"
                className={`restaurant-table-card ${status}`}
                key={table.id || table.number}
                onClick={() => setSelectedTable(table.number)}
              >
                <strong>Table {table.number}</strong>
                <span>{tableOrders.length ? `${tableOrders.length} order` : idleLabel}</span>
                {tableOrders.length > 0 && (
                  <small>
                    ₹{tableTotal.toFixed(2)}
                    {hasCoupon ? " after coupon" : ""}
                  </small>
                )}
                {tableOrders.length > 0 && <Utensils size={17} />}
              </button>
            );
          })}
        </div>
      </section>}

      {activeSection === "orders" && <section className="current-orders-panel">
        <div className="menu-category-section-head">
          <h2>Current Orders</h2>
          <span>{activeOrders.length} running</span>
        </div>

        {activeOrders.length === 0 ? (
          <div className="restaurant-empty compact">
            <ClipboardList size={34} />
            <p>No current orders right now.</p>
          </div>
        ) : (
          <div className="current-orders-grid">
            {activeOrders.map((order) => (
              <article className={`current-order-card ${order.status}`} key={order._id}>
                <div className="current-order-top">
                  <div>
                    <span>{order.orderNo}</span>
                    <h3>{order.orderType === "delivery" ? "Delivery Order" : `Table ${order.tableNo}`}</h3>
                    <p>{order.customerName || "Customer"} | {order.customerPhone || "No phone"}</p>
                  </div>
                  <StatusBadge status={order.status} orderType={order.orderType} />
                </div>

                <div className="order-workflow-rail">
                  {workflowStatuses.map((status, index) => (
                    <span
                      key={status}
                      className={index <= getWorkflowProgress(order.status) ? "done" : ""}
                    >
                      {statusLabel(status, order.orderType)}
                    </span>
                  ))}
                </div>

                <div className="order-card-meta">
                  <div>
                    <span>Items</span>
                    <b>{order.items?.length || 0}</b>
                  </div>
                  <div>
                    <span>Order Type</span>
                    <b>{orderTypeLabel(order)}</b>
                  </div>
                  {runningFor(order) && (
                    <div>
                      <span>Running for</span>
                      <b className="order-running-clock">{runningFor(order)}</b>
                    </div>
                  )}
                  <div>
                    <span>Bill</span>
                    <b>₹{Number(order.grandTotal || 0).toFixed(2)}</b>
                  </div>
                </div>

                {order.orderType === "delivery" && (
                  <div className="delivery-address-box">
                    <strong>Delivery Address</strong>
                    <span>{order.deliveryAddress || "N/A"}</span>
                  </div>
                )}

                <div className="restaurant-order-items">
                  {order.items.map((item, index) => (
                    <p key={`${item.productId}-${index}`}>
                      <span>{item.qty} x {item.name}</span>
                      <b>₹{Number(item.total || 0).toFixed(2)}</b>
                    </p>
                  ))}
                </div>

                {order.note && <p className="restaurant-note">Note: {order.note}</p>}

                <div className="restaurant-order-total">
                  <span>{order.couponCode ? `Total after ${order.couponCode}` : "Total"}</span>
                  <strong>₹{Number(order.grandTotal || 0).toFixed(2)}</strong>
                </div>
                {Number(order.discountAmount || 0) > 0 && (
                  <p className="restaurant-note">Coupon discount: ₹{Number(order.discountAmount || 0).toFixed(2)}</p>
                )}

                <div className="current-order-actions">
                  {renderFlowActions(order)}
                  {!order.isHeld ? (
                    <AsyncButton onClick={() => holdOrder(order)}>Hold</AsyncButton>
                  ) : (
                    <AsyncButton onClick={() => resumeOrder(order)}>Resume</AsyncButton>
                  )}
                  {order.kotSentAt && (
                    <button className="print-kot-btn" onClick={() => setKotOrder(order)}>
                      <Printer size={16} />
                      Reprint KOT
                    </button>
                  )}
                  <button onClick={() => openDiscount(order)}>Discount</button>
                  <button onClick={() => openSplit(order)}>Split Bill</button>
                  <button onClick={() => openMerge(order)}>Merge Bill</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>}

      {activeSection === "pickup" && <section className="pickup-panel">
        <div className="pickup-channel-tabs" role="tablist" aria-label="Order channel">
          <button type="button" role="tab" aria-selected={pickupType === "takeaway"}
            className={pickupType === "takeaway" ? "active" : ""}
            onClick={() => setPickupType("takeaway")}>
            <ShoppingBag size={18} />
            <span>Takeaway</span>
            <b>{pickupCounts.takeaway}</b>
          </button>
          <button type="button" role="tab" aria-selected={pickupType === "delivery"}
            className={pickupType === "delivery" ? "active" : ""}
            onClick={() => setPickupType("delivery")}>
            <Bike size={18} />
            <span>Delivery</span>
            <b>{pickupCounts.delivery}</b>
          </button>
        </div>

        {pickupOrders.length === 0 ? (
          <div className="bm-empty">
            No running {pickupType === "takeaway" ? "takeaway" : "delivery"} orders right now.
          </div>
        ) : (
          <div className="pickup-grid">
            {pickupOrders.map((order) => (
              <article key={order._id} className="pickup-card">
                <header>
                  <div className="pickup-card-title">
                    {order.orderType === "takeaway" ? <ShoppingBag size={16} /> : <Bike size={16} />}
                    <h3>{order.orderNo}</h3>
                  </div>
                  <StatusBadge status={order.status} orderType={order.orderType} />
                </header>

                <p className="pickup-customer">
                  <b>{order.customerName || "Guest"}</b>
                  {order.customerPhone && <span>{order.customerPhone}</span>}
                </p>

                {order.orderType === "delivery" && order.deliveryAddress && (
                  <p className="pickup-address">{order.deliveryAddress}</p>
                )}

                <ul className="pickup-items">
                  {order.items?.map((item, index) => (
                    <li key={`${item.productId || item.name}-${index}`}>
                      <span>{item.qty} x {item.name}</span>
                    </li>
                  ))}
                </ul>

                {order.takenByName && <p className="pickup-taken-by">Taken by {order.takenByName}</p>}

                <footer>
                  <b>₹{Number(order.grandTotal || 0).toFixed(2)}</b>
                  <div className="row-actions">
                    {workflowStatuses
                      .slice(workflowStatuses.indexOf(order.status) + 1,
                        workflowStatuses.indexOf(order.status) + 2)
                      .map((next) => (
                        <AsyncButton key={next} className="bm-btn bm-btn-sm bm-btn-primary"
                          onClick={() => updateStatus(order._id, next)}>
                          Mark {statusLabel(next, order.orderType)}
                        </AsyncButton>
                      ))}
                    <AsyncButton className="bm-btn bm-btn-sm" onClick={() => setPaymentOrder(order)}>
                      Bill
                    </AsyncButton>
                  </div>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>}

      {activeSection === "invoices" && <section className="invoice-history-panel">
        <div className="menu-category-section-head">
          <div>
            <h2>Invoices</h2>
            <p>Paid restaurant bills generated with current invoice settings.</p>
          </div>
          <span>{paidInvoices.length} paid</span>
        </div>

        <div className="invoice-search-box">
          <Search size={18} />
          <input
            value={invoiceSearch}
            onChange={(e) => setInvoiceSearch(e.target.value)}
            placeholder="Search invoice, customer, phone, table..."
          />
        </div>

        {filteredPaidInvoices.length === 0 ? (
          <p>No paid invoice yet.</p>
        ) : (
          <div className="restaurant-invoice-table-card">
            <table>
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Total</th>
                  <th>View</th>
                  <th>Delete</th>
                </tr>
              </thead>
              <tbody>
                {filteredPaidInvoices.map((order) => (
                  <tr key={order._id}>
                    <td>{getInvoiceNo(order)}</td>
                    <td>{formatDateTime(order.payment?.paidAt || order.updatedAt || order.createdAt)}</td>
                    <td>{order.customerName || "Walk-in Customer"}</td>
                    <td>{order.orderType === "delivery" ? "Delivery" : `Table ${order.tableNo}`}</td>
                    <td>₹{Number(order.grandTotal || 0).toFixed(2)}</td>
                    <td><button className="icon-view" onClick={() => setPaidInvoice(order)}>View</button></td>
                    <td><AsyncButton type="button" className="invoice-delete-btn" onClick={() => deleteRestaurantInvoice(order)}>Delete</AsyncButton></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>}

      {selectedTable && (
        <div className="modal-overlay">
          <div className="modal-card large table-order-modal">
            <div className="modal-head">
              <h2>Table {selectedTable} Orders</h2>
              <button type="button" className="modal-close-btn" aria-label="Close" title="Close" onClick={() => setSelectedTable(null)}><X size={20} strokeWidth={2.5} /></button>
            </div>

            {selectedTableOrders.length === 0 ? (
              <div className="restaurant-empty compact">
                <ClipboardList size={30} />
                <p>There is no active order on this table.</p>
                {(() => {
                  const table = tables.find((t) => t.number === String(selectedTable));
                  if (!table?.id) return null;
                  return (
                    <div className="table-status-actions">
                      <span>Table status: <b>{table.status}</b></span>
                      {["available", "reserved", "cleaning"]
                        .filter((status) => status !== table.status)
                        .map((status) => (
                          <AsyncButton key={status} onClick={() => setTableStatus(table, status)}>
                            Mark {status}
                          </AsyncButton>
                        ))}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="table-modal-orders">
                {selectedTableOrders.map((order) => (
                  <article className={`restaurant-order-card ${order.status}`} key={order._id}>
                    <div className="restaurant-order-top">
                      <div>
                        <span>{order.orderNo}</span>
                        <h2>{order.orderType === "delivery" ? "Delivery" : `Table ${order.tableNo}`}</h2>
                      </div>
                      <b>{order.status}</b>
                    </div>

                    <div className="restaurant-order-items">
                      {order.items.map((item, index) => (
                        <p key={`${item.productId}-${index}`}>
                          <span>{item.qty} x {item.name}</span>
                          <b>₹{Number(item.total || 0).toFixed(2)}</b>
                        </p>
                      ))}
                    </div>

                    {order.note && <p className="restaurant-note">Note: {order.note}</p>}

                    <div className="restaurant-order-total">
                      <span>{order.couponCode ? `Total after ${order.couponCode}` : "Total"}</span>
                      <strong>₹{Number(order.grandTotal || 0).toFixed(2)}</strong>
                    </div>
                    {Number(order.discountAmount || 0) > 0 && (
                      <p className="restaurant-note">Coupon discount: ₹{Number(order.discountAmount || 0).toFixed(2)}</p>
                    )}

                    <div className="restaurant-order-actions">
                      {renderFlowActions(order)}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {popupOrder && (
        <div className="order-alert-overlay">
          <div className="order-alert-card">
            <button
              className="order-alert-close"
              onClick={() => setActivePopupOrderId(null)}
              title="Hide popup"
              aria-label="Hide popup"
            >
              <X size={18} />
            </button>

            <div className="order-alert-pulse">
              <Bell size={28} />
            </div>

            <div className="order-alert-heading">
              <span>{popupOrder.orderNo}</span>
              <h2>
                New {popupOrder.orderType === "delivery" ? "Delivery" : `Table ${popupOrder.tableNo}`} Order
              </h2>
              <p>Accepting the order will stop the alert and notify the customer.</p>
            </div>

            <div className="popup-customer-box">
              <b>{popupOrder.customerName}</b>
              <span>{popupOrder.customerPhone}</span>
              {popupOrder.orderType === "delivery" && <small>{popupOrder.deliveryAddress}</small>}
            </div>

            <div className="order-alert-items">
              {popupOrder.items.map((item, index) => (
                <div key={`${item.productId}-${index}`}>
                  <b>{item.qty} x {item.name}</b>
                  <strong>₹{Number(item.total || 0).toFixed(2)}</strong>
                </div>
              ))}
            </div>

            {popupOrder.note && <em>Note: {popupOrder.note}</em>}

            <div className="order-alert-total">
              <span>Total Bill</span>
              <strong>₹{Number(popupOrder.grandTotal || 0).toFixed(2)}</strong>
            </div>

            <div className="order-alert-actions">
              <AsyncButton onClick={() => updateStatus(popupOrder._id, "accepted")}>
                <CheckCircle2 size={18} />
                Accept Order
              </AsyncButton>
              <AsyncButton className="reject-order-btn" onClick={() => updateStatus(popupOrder._id, "cancelled")}>
                Cancel
              </AsyncButton>
            </div>
          </div>
        </div>
      )}

      {paymentOrder && (
        <div className="modal-overlay">
          <div className="modal-card payment-modal">
            <div className="modal-head">
              <h2>Payment - {paymentOrder.orderNo}</h2>
              <button type="button" className="modal-close-btn" aria-label="Close" title="Close" onClick={() => setPaymentOrder(null)}><X size={20} strokeWidth={2.5} /></button>
            </div>

            <div className="payment-summary-box">
              <span>{paymentOrder.orderType === "delivery" ? "Delivery" : `Table ${paymentOrder.tableNo}`}</span>
              <strong>₹{Number(paymentOrder.grandTotal || 0).toFixed(2)}</strong>
            </div>

            <div className="payment-mode-grid">
              {(orderSettings.cashEnabled ?? true) && <PaymentModeButton mode="Cash" active={paymentForm.mode === "Cash"} setPaymentForm={setPaymentForm} icon={<Banknote size={18} />} />}
              {(orderSettings.upiEnabled ?? true) && <PaymentModeButton mode="UPI" active={paymentForm.mode === "UPI"} setPaymentForm={setPaymentForm} icon={<QrCode size={18} />} />}
              {(orderSettings.cardEnabled ?? true) && <PaymentModeButton mode="Card" active={paymentForm.mode === "Card"} setPaymentForm={setPaymentForm} icon={<CreditCard size={18} />} />}
              {(orderSettings.partialPaymentEnabled ?? true) && <PaymentModeButton mode="Partial" active={paymentForm.mode === "Partial"} setPaymentForm={setPaymentForm} icon={<Smartphone size={18} />} />}
            </div>

            {paymentForm.mode === "Partial" && (
              <div className="partial-payment-grid">
                <input type="number" placeholder="Cash amount" value={paymentForm.cash} onChange={(e) => setPaymentForm({ ...paymentForm, cash: e.target.value })} />
                <input type="number" placeholder="UPI amount" value={paymentForm.upi} onChange={(e) => setPaymentForm({ ...paymentForm, upi: e.target.value })} />
                <input type="number" placeholder="Card amount" value={paymentForm.card} onChange={(e) => setPaymentForm({ ...paymentForm, card: e.target.value })} />
              </div>
            )}

            <AsyncButton className="save-grn-btn" onClick={submitPayment}>
              Save Payment & Generate Invoice
            </AsyncButton>
          </div>
        </div>
      )}

      {kotOrder && (
        <div className="modal-overlay">
          <div className="modal-card invoice-modal">
            <div className="modal-head no-print">
              <h2>KOT - {kotOrder.orderNo}</h2>
              <button type="button" className="modal-close-btn" aria-label="Close" title="Close" onClick={() => setKotOrder(null)}><X size={20} strokeWidth={2.5} /></button>
            </div>

            <div className="receipt-modal-body">
              <KotReceipt order={kotOrder} settings={orderSettings} />
            </div>

            <button className="no-print" onClick={() => window.print()}>
              <Printer size={17} />
              Print KOT
            </button>
          </div>
        </div>
      )}

      {paidInvoice && (
        <div className="modal-overlay">
          <div className="modal-card large invoice-modal restaurant-invoice-modal">
            <div className="modal-head no-print">
              <h2>Invoice - {getInvoiceNo(paidInvoice)}</h2>
              <button type="button" className="modal-close-btn" aria-label="Close" title="Close" onClick={() => setPaidInvoice(null)}><X size={20} strokeWidth={2.5} /></button>
            </div>

            <div className="receipt-modal-body">
              <TaxInvoiceReceipt data={toInvoiceData(paidInvoice, "order")} settings={orderSettings} />
            </div>

            <button className="no-print" onClick={() => window.print()}>
              <Printer size={17} />
              Print Bill / Invoice
            </button>
            <AsyncButton className="no-print invoice-delete-btn wide" onClick={() => deleteRestaurantInvoice(paidInvoice)}>
              Delete Invoice
            </AsyncButton>
          </div>
        </div>
      )}

      {discountOrder && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-head">
              <h2>Apply Discount - {discountOrder.orderNo}</h2>
              <button type="button" className="modal-close-btn" aria-label="Close" title="Close" onClick={() => setDiscountOrder(null)}><X size={20} strokeWidth={2.5} /></button>
            </div>
            <label>
              Discount Amount (₹)
              <input
                type="number"
                value={discountForm.amount}
                onChange={(e) => setDiscountForm({ ...discountForm, amount: e.target.value })}
              />
            </label>
            <label>
              Reason (required)
              <input
                type="text"
                placeholder="e.g. Manager approval, complaint, loyalty"
                value={discountForm.reason}
                onChange={(e) => setDiscountForm({ ...discountForm, reason: e.target.value })}
              />
            </label>
            <AsyncButton className="save-grn-btn" onClick={submitDiscount}>Apply Discount</AsyncButton>
          </div>
        </div>
      )}

      {splitOrder && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-head">
              <h2>Split Bill - {splitOrder.orderNo}</h2>
              <button type="button" className="modal-close-btn" aria-label="Close" title="Close" onClick={() => setSplitOrder(null)}><X size={20} strokeWidth={2.5} /></button>
            </div>
            <p>Select items to move into a new bill:</p>
            <div className="restaurant-order-items">
              {splitOrder.items.map((item, index) => (
                <label key={`${item.productId}-${index}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={splitSelected.includes(index)}
                    onChange={() => toggleSplitItem(index)}
                  />
                  <span>{item.qty} x {item.name}</span>
                  <b>₹{Number(item.total || 0).toFixed(2)}</b>
                </label>
              ))}
            </div>
            <AsyncButton className="save-grn-btn" onClick={submitSplit}>Split Selected Items</AsyncButton>
          </div>
        </div>
      )}

      {mergeOrder && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-head">
              <h2>Merge Bill - {mergeOrder.orderNo}</h2>
              <button type="button" className="modal-close-btn" aria-label="Close" title="Close" onClick={() => setMergeOrder(null)}><X size={20} strokeWidth={2.5} /></button>
            </div>
            <p>Merge this order's items into another active order (same table/customer):</p>
            <select value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)}>
              <option value="">Select target order</option>
              {activeOrders
                .filter((order) => order._id !== mergeOrder._id)
                .map((order) => (
                  <option key={order._id} value={order._id}>
                    {order.orderNo} - {order.orderType === "delivery" ? "Delivery" : `Table ${order.tableNo}`}
                  </option>
                ))}
            </select>
            <AsyncButton className="save-grn-btn" onClick={submitMerge}>Merge Into Selected Order</AsyncButton>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        title={`Delete ${deleteTarget ? getInvoiceNo(deleteTarget) : "invoice"}?`}
        message="Stock will be restored for its items. Enter login password to continue."
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteRestaurantInvoice}
      />

      <ConfirmActionModal
        open={!!statusTarget}
        title="Update Order Status?"
        message={`${statusTarget?.orderNo || "Order"} will be marked as "${statusTarget?.status || ""}". Do you want to continue?`}
        confirmText="Update Status"
        onCancel={() => setStatusTarget(null)}
        onConfirm={confirmStatusUpdate}
      />

      {newOrderOpen && (
        <div className="product-modal-overlay">
          <div className="modal-card large captain-order-modal" role="dialog" aria-modal="true" aria-labelledby="new-order-title" aria-busy={placingNewOrder}>
            <div className="product-modal-head">
              <div>
                <h2 id="new-order-title">New Order</h2>
                <p className="captain-order-subhead">Take an order table-side, waiter/captain style</p>
              </div>
              <button type="button" disabled={placingNewOrder} onClick={() => setNewOrderOpen(false)} aria-label="Close" className="modal-close-btn"><X size={20} strokeWidth={2.5} /></button>
            </div>

            <div className="captain-order-body">
              <fieldset className="captain-order-left" disabled={placingNewOrder}>
                <div className="captain-order-toggle">
                  {[
                    ["dine-in", "Dine-in", Utensils],
                    ["takeaway", "Takeaway", ShoppingBag],
                    ["delivery", "Delivery", Bike],
                  ].map(([value, label, Icon]) => (
                    <button
                      key={value}
                      type="button"
                      className={newOrderType === value ? "active" : ""}
                      aria-pressed={newOrderType === value}
                      onClick={() => setNewOrderType(value)}
                    >
                      <Icon size={15} /> {label}
                    </button>
                  ))}
                </div>

                <div className="captain-order-details-row">
                  {newOrderType === "dine-in" && (
                    <label className="captain-order-table-select">
                      <span>Table</span>
                      <select value={newOrderTable} onChange={(e) => setNewOrderTable(e.target.value)}>
                        {Array.from({ length: tableCount }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="captain-order-table-select">
                    <span>Customer name {newOrderType === "delivery" ? "*" : "(optional)"}</span>
                    <input
                      placeholder="Customer name"
                      value={newOrderCustomerName}
                      onChange={(e) => setNewOrderCustomerName(e.target.value)}
                    />
                  </label>
                </div>

                <div className="captain-order-search">
                  <Search size={16} />
                  <input
                    placeholder="Search menu item..."
                    value={newOrderSearch}
                    onChange={(e) => setNewOrderSearch(e.target.value)}
                  />
                </div>

                <div className="captain-order-item-list">
                  {newOrderFilteredProducts.length === 0 && (
                    <p className="empty-cart-copy">No menu item found.</p>
                  )}
                  {newOrderFilteredProducts.map((product) => {
                    const inCart = newOrderCart.find((item) => item.productId === product._id);
                    return (
                      <div className={`captain-order-item-row ${inCart ? "in-cart" : ""}`} key={product._id}>
                        <div className="captain-order-item-media">
                          {hasProductImage(product) ? (
                            <img src={productImageSrc(product)} alt={product.name} loading="lazy" />
                          ) : (
                            <span>{product.name?.slice(0, 1) || "M"}</span>
                          )}
                        </div>
                        <div className="captain-order-item-name">
                          <b>{product.name}</b>
                          <span>₹{Number(product.mrp || product.sellingPrice || 0).toFixed(2)}</span>
                        </div>
                        <div className={`menu-add-control ${inCart ? "is-stepper" : ""}`}>
                          {inCart ? (
                            <>
                              <button type="button" aria-label={`Remove one ${product.name}`} onClick={() => changeNewOrderQty(product, -1)}><Minus size={16} strokeWidth={3} /></button>
                              <b>{inCart.qty}</b>
                              <button type="button" aria-label={`Add one ${product.name}`} onClick={() => changeNewOrderQty(product, 1)}><Plus size={16} strokeWidth={3} /></button>
                            </>
                          ) : (
                            <button type="button" className="captain-add-btn" aria-label={`Add ${product.name}`} onClick={() => changeNewOrderQty(product, 1)}><Plus size={16} strokeWidth={3} /> Add</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </fieldset>

              <div className="captain-order-right">
                <h3>Order Summary</h3>

                {offerHints.length > 0 && (
                  <div className="order-offer-hints">
                    {offerHints.map((hint) => (
                      <p key={hint._id} className={hint.shortBy > 0 ? "pending" : ""}>
                        <Gift size={14} />
                        <span>
                          <b>{hint.title}</b>
                          {hint.detail}
                          {hint.sizes.length > 0 && " · " + hint.sizes.join(", ") + " only"}
                          {hint.shortBy > 0 && " · add ₹" + hint.shortBy.toFixed(0) + " more to unlock"}
                        </span>
                      </p>
                    ))}
                  </div>
                )}
                {newOrderCart.length === 0 ? (
                  <p className="empty-cart-copy">No items added yet.</p>
                ) : (
                  <div className="menu-cart-items">
                    {newOrderCart.map((item) => (
                      <div key={item.productId}>
                        <span>{item.name}</span>
                        <b>{item.qty} x ₹{item.rate.toFixed(2)}</b>
                      </div>
                    ))}
                  </div>
                )}

                <div className="captain-order-total">
                  <span>{newOrderCartQty} items</span>
                  <b>₹{newOrderCartTotal.toFixed(2)}</b>
                </div>

                <AsyncButton
                  type="button"
                  className="captain-order-submit-btn"
                  disabled={placingNewOrder || newOrderCart.length === 0}
                  onClick={submitNewOrder}
                >
                  {placingNewOrder ? "Placing..." : newOrderCart.length === 0 ? "Add items to place order" : "Place Order"}
                </AsyncButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentModeButton({ mode, active, setPaymentForm, icon }) {
  return (
    <button
      type="button"
      className={`payment-mode-btn ${active ? "active" : ""}`}
      onClick={() => setPaymentForm((current) => ({ ...current, mode }))}
    >
      {icon}
      <span>{mode}</span>
    </button>
  );
}
