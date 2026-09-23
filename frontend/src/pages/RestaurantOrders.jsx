import { useEffect, useMemo, useRef, useState } from "react";
import { Banknote, Bell, CheckCircle2, ClipboardList, CreditCard, Printer, QrCode, RefreshCcw, Search, Smartphone, Utensils, X } from "lucide-react";
import API from "../api/axios";
import { ToastViewport, useToast } from "../components/Toast";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import ConfirmActionModal from "../components/ConfirmActionModal";
import StatusBadge from "../components/StatusBadge";

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const threeDigitsToWords = (num) => {
  let words = "";
  if (num >= 100) {
    words += `${ONES[Math.floor(num / 100)]} Hundred `;
    num %= 100;
  }
  if (num >= 20) {
    words += `${TENS[Math.floor(num / 10)]} `;
    num %= 10;
  }
  if (num > 0) words += `${ONES[num]} `;
  return words.trim();
};

// Converts a rupee amount into Indian numbering (lakh/crore) words for the invoice footer,
// matching how real GST invoices print "Amount in Words".
const amountInWords = (value) => {
  const rupees = Math.floor(Number(value) || 0);
  if (rupees === 0) return "Zero Rupees Only";

  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;

  const parts = [];
  if (crore) parts.push(`${threeDigitsToWords(crore)} Crore`);
  if (lakh) parts.push(`${threeDigitsToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigitsToWords(thousand)} Thousand`);
  if (rest) parts.push(threeDigitsToWords(rest));

  return `${parts.join(" ")} Rupees Only`;
};

const statuses = ["new", "accepted", "preparing", "ready", "served", "cancelled"];
const workflowStatuses = ["new", "accepted", "preparing", "ready", "served"];

// "served" is the shared status value for both dine-in and delivery orders (same
// workflow step -- order is complete), but showing "Served" for a delivery order
// reads wrong to staff. Only the label changes here; the underlying status string
// stored in the DB and used for workflow logic stays "served" for both order types.
const statusLabel = (status, orderType) =>
  status === "served" && orderType === "delivery" ? "delivered" : status;

const defaultOrderSettings = {
  restaurantOrderSoundEnabled: true,
  restaurantOrderRepeatSound: true,
  restaurantOrderPopupEnabled: true,
  restaurantOrderRefreshSeconds: 5,
  restaurantTableCount: 28,
  storeName: "BhojanMitra",
  storeShortName: "BhojanMitra",
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
  const [activeSection, setActiveSection] = useState("tables");
  const [selectedTable, setSelectedTable] = useState(null);
  const [orderSettings, setOrderSettings] = useState(defaultOrderSettings);
  const [activePopupOrderId, setActivePopupOrderId] = useState(null);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [paidInvoice, setPaidInvoice] = useState(null);
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
  const [newOrderIsDelivery, setNewOrderIsDelivery] = useState(false);
  const [newOrderCustomerName, setNewOrderCustomerName] = useState("");
  const [newOrderSearch, setNewOrderSearch] = useState("");
  const [newOrderCart, setNewOrderCart] = useState([]);
  const [placingNewOrder, setPlacingNewOrder] = useState(false);
  const knownOrderIds = useRef(new Set());
  const initialLoadDone = useRef(false);
  const ringTimer = useRef(null);
  const { toast, showToast } = useToast();

  const playOrderTune = (force = false) => {
    if (!force && !orderSettings.restaurantOrderSoundEnabled) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

      const context = new AudioContext();
    const notes = [
      { frequency: 880, start: 0, duration: 0.14 },
      { frequency: 1174, start: 0.16, duration: 0.14 },
      { frequency: 1568, start: 0.32, duration: 0.22 },
    ];

    notes.forEach((note) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = note.frequency;
      oscillator.connect(gain);
      gain.connect(context.destination);
      gain.gain.setValueAtTime(0.0001, context.currentTime + note.start);
      gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + note.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + note.start + note.duration);
      oscillator.start(context.currentTime + note.start);
      oscillator.stop(context.currentTime + note.start + note.duration + 0.03);
    });

    window.setTimeout(() => {
      context.close?.();
    }, 700);
  };

  const fetchOrderSettings = async () => {
    try {
      const res = await API.get("/settings");
      const nextSettings = { ...defaultOrderSettings, ...(res.data.settings || {}) };
      setOrderSettings(nextSettings);
      setTableCount(Number(nextSettings.restaurantTableCount || 28));
    } catch (error) {
      showToast(error.response?.data?.message || "Order settings could not be loaded", "warning");
    }
  };

  useEffect(() => {
    fetchOrderSettings();
    API.get("/products")
      .then((res) => setProducts(res.data.products || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const unlockAudio = () => {
      if (orderSettings.restaurantOrderSoundEnabled) {
        playOrderTune(true);
      }
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };

    window.addEventListener("click", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    window.addEventListener("touchstart", unlockAudio);

    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
  }, [orderSettings.restaurantOrderSoundEnabled]);

  const fetchOrders = async () => {
    try {
      const res = await API.get("/restaurant-orders");
      const latestOrders = res.data.orders || [];
      const incomingNewOrders = latestOrders.filter(
        (order) => order.status === "new" && !knownOrderIds.current.has(order._id)
      );

      setOrders(latestOrders);

      latestOrders.forEach((order) => knownOrderIds.current.add(order._id));

      if (initialLoadDone.current && incomingNewOrders.length > 0) {
        if (orderSettings.restaurantOrderPopupEnabled) {
          setActivePopupOrderId(incomingNewOrders[0]._id);
        }
        if (orderSettings.restaurantOrderSoundEnabled) {
          playOrderTune();
        }
        showToast(`New order: Table ${incomingNewOrders[0].tableNo}`, "success");
      }

      initialLoadDone.current = true;
    } catch (error) {
      showToast(error.response?.data?.message || "Orders could not be loaded");
    }
  };

  useEffect(() => {
    fetchOrders();

    const refreshMs = Math.max(3, Number(orderSettings.restaurantOrderRefreshSeconds || 5)) * 1000;
    const timer = setInterval(fetchOrders, refreshMs);
    return () => clearInterval(timer);
  }, [orderSettings.restaurantOrderRefreshSeconds, orderSettings.restaurantOrderPopupEnabled]);

  useEffect(() => {
    const hasNewOrders = orders.some((order) => order.status === "new");

    if (!orderSettings.restaurantOrderSoundEnabled || !orderSettings.restaurantOrderRepeatSound || !hasNewOrders) {
      if (ringTimer.current) {
        clearInterval(ringTimer.current);
        ringTimer.current = null;
      }
      return;
    }

    if (!ringTimer.current) {
      playOrderTune();
      ringTimer.current = setInterval(playOrderTune, 1400);
    }

    return () => {
      if (ringTimer.current) {
        clearInterval(ringTimer.current);
        ringTimer.current = null;
      }
    };
  }, [orders, orderSettings.restaurantOrderSoundEnabled, orderSettings.restaurantOrderRepeatSound]);

  const activeOrders = useMemo(
    () => orders.filter((order) => order.status !== "cancelled" && order.paymentStatus !== "paid"),
    [orders]
  );

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
      setStatusTarget(null);
      fetchOrders();
      showToast("Order status updated", "success");
    } catch (error) {
      showToast(error.response?.data?.message || "Status update failed");
    }
  };

  // Waiter/captain flow: staff picks a table and items directly from this screen
  // instead of the customer having to scan the QR menu themselves.
  const newOrderFilteredProducts = useMemo(() => {
    const q = newOrderSearch.toLowerCase().trim();
    if (!q) return products;
    return products.filter(
      (p) => p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)
    );
  }, [products, newOrderSearch]);

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
    setNewOrderIsDelivery(false);
    setNewOrderCustomerName("");
    setNewOrderSearch("");
    setNewOrderCart([]);
  };

  const submitNewOrder = async () => {
    if (newOrderCart.length === 0) return showToast("Add at least one item", "warning");
    if (newOrderIsDelivery && !newOrderCustomerName.trim()) {
      return showToast("Customer name required for delivery orders", "warning");
    }

    setPlacingNewOrder(true);
    try {
      await API.post("/restaurant-orders", {
        orderType: newOrderIsDelivery ? "delivery" : "dine-in",
        tableNo: newOrderIsDelivery ? "" : newOrderTable,
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

  const tables = Array.from({ length: Number(tableCount || 0) }, (_, index) => index + 1);
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
    const tableOrders = ordersByTable.get(String(table)) || [];
    if (tableOrders.some((order) => order.status === "new")) return "new";
    if (tableOrders.some((order) => order.status === "preparing")) return "preparing";
    if (tableOrders.some((order) => order.status === "ready")) return "ready";
    if (tableOrders.some((order) => order.status === "served")) return "served";
    if (tableOrders.some((order) => order.status === "accepted")) return "accepted";
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
          Table View
        </button>
        <button
          type="button"
          className={activeSection === "orders" ? "active" : ""}
          onClick={() => setActiveSection("orders")}
        >
          Running Orders
        </button>
        <button
          type="button"
          className={activeSection === "invoices" ? "active" : ""}
          onClick={() => setActiveSection("invoices")}
        >
          Invoices
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
          </div>
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
        </div>

        <div className="table-grid">
          {tables.map((table) => {
            const status = getTableStatus(table);
            const tableOrders = ordersByTable.get(String(table)) || [];
            const tableTotal = tableOrders.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0);
            const hasCoupon = tableOrders.some((order) => order.couponCode);

            return (
              <button
                type="button"
                className={`restaurant-table-card ${status}`}
                key={table}
                onClick={() => setSelectedTable(table)}
              >
                <strong>Table {table}</strong>
                <span>{tableOrders.length ? `${tableOrders.length} order` : "Blank"}</span>
                {tableOrders.length > 0 && (
                  <small>
                    Rs {tableTotal.toFixed(2)}
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
                    <b>{order.orderType === "delivery" ? "Delivery" : "Dine-in"}</b>
                  </div>
                  <div>
                    <span>Bill</span>
                    <b>Rs {Number(order.grandTotal || 0).toFixed(2)}</b>
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
                      <b>Rs {Number(item.total || 0).toFixed(2)}</b>
                    </p>
                  ))}
                </div>

                {order.note && <p className="restaurant-note">Note: {order.note}</p>}

                <div className="restaurant-order-total">
                  <span>{order.couponCode ? `Total after ${order.couponCode}` : "Total"}</span>
                  <strong>Rs {Number(order.grandTotal || 0).toFixed(2)}</strong>
                </div>
                {Number(order.discountAmount || 0) > 0 && (
                  <p className="restaurant-note">Coupon discount: Rs {Number(order.discountAmount || 0).toFixed(2)}</p>
                )}

                <div className="current-order-actions">
                  {order.status === "new" && (
                    <button className="accept-order-btn" onClick={() => updateStatus(order._id, "accepted")}>
                      <CheckCircle2 size={17} />
                      Accept
                    </button>
                  )}
                  {order.status === "accepted" && (
                    <button onClick={() => updateStatus(order._id, "preparing")}>Start Preparing</button>
                  )}
                  {order.status === "preparing" && (
                    <button onClick={() => updateStatus(order._id, "ready")}>Mark Ready</button>
                  )}
                  {order.status === "ready" && (
                    <button className="serve-order-btn" onClick={() => updateStatus(order._id, "served")}>
                      <Utensils size={16} />
                      {order.orderType === "delivery" ? "Mark Delivered" : "Mark Served"}
                    </button>
                  )}
                  {order.status === "served" && (
                    <button className="payment-action-btn" onClick={() => openPayment(order)}>
                      <CreditCard size={16} />
                      Payment
                    </button>
                  )}
                  {order.status !== "served" && (
                    <button className="reject-order-btn" onClick={() => updateStatus(order._id, "cancelled")}>
                      Cancel
                    </button>
                  )}
                  {!order.isHeld ? (
                    <button onClick={() => holdOrder(order)}>Hold</button>
                  ) : (
                    <button onClick={() => resumeOrder(order)}>Resume</button>
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
                    <td>Rs {Number(order.grandTotal || 0).toFixed(2)}</td>
                    <td><button className="icon-view" onClick={() => setPaidInvoice(order)}>View</button></td>
                    <td><button type="button" className="invoice-delete-btn" onClick={() => deleteRestaurantInvoice(order)}>Delete</button></td>
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
              <button onClick={() => setSelectedTable(null)}>x</button>
            </div>

            {selectedTableOrders.length === 0 ? (
              <div className="restaurant-empty compact">
                <ClipboardList size={30} />
                <p>There is no active order on this table.</p>
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
                          <b>Rs {Number(item.total || 0).toFixed(2)}</b>
                        </p>
                      ))}
                    </div>

                    {order.note && <p className="restaurant-note">Note: {order.note}</p>}

                    <div className="restaurant-order-total">
                      <span>{order.couponCode ? `Total after ${order.couponCode}` : "Total"}</span>
                      <strong>Rs {Number(order.grandTotal || 0).toFixed(2)}</strong>
                    </div>
                    {Number(order.discountAmount || 0) > 0 && (
                      <p className="restaurant-note">Coupon discount: Rs {Number(order.discountAmount || 0).toFixed(2)}</p>
                    )}

                    <div className="restaurant-order-actions">
                      <select
                        value={order.status}
                        onChange={(e) => updateStatus(order._id, e.target.value)}
                      >
                        {statuses.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                      {order.status === "served" && (
                        <button onClick={() => openPayment(order)}>
                          <CreditCard size={16} />
                          Payment
                        </button>
                      )}
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
                  <strong>Rs {Number(item.total || 0).toFixed(2)}</strong>
                </div>
              ))}
            </div>

            {popupOrder.note && <em>Note: {popupOrder.note}</em>}

            <div className="order-alert-total">
              <span>Total Bill</span>
              <strong>Rs {Number(popupOrder.grandTotal || 0).toFixed(2)}</strong>
            </div>

            <div className="order-alert-actions">
              <button onClick={() => updateStatus(popupOrder._id, "accepted")}>
                <CheckCircle2 size={18} />
                Accept Order
              </button>
              <button className="reject-order-btn" onClick={() => updateStatus(popupOrder._id, "cancelled")}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentOrder && (
        <div className="modal-overlay">
          <div className="modal-card payment-modal">
            <div className="modal-head">
              <h2>Payment - {paymentOrder.orderNo}</h2>
              <button onClick={() => setPaymentOrder(null)}>x</button>
            </div>

            <div className="payment-summary-box">
              <span>{paymentOrder.orderType === "delivery" ? "Delivery" : `Table ${paymentOrder.tableNo}`}</span>
              <strong>Rs {Number(paymentOrder.grandTotal || 0).toFixed(2)}</strong>
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

            <button className="save-grn-btn" onClick={submitPayment}>
              Save Payment & Generate Invoice
            </button>
          </div>
        </div>
      )}

      {paidInvoice && (
        <div className="modal-overlay">
          <div className="modal-card large invoice-modal restaurant-invoice-modal">
            <div className="modal-head no-print">
              <h2>Invoice - {getInvoiceNo(paidInvoice)}</h2>
              <button onClick={() => setPaidInvoice(null)}>x</button>
            </div>

            <div className={`restaurant-invoice-print invoice-print-area restaurant-print-${String(orderSettings.invoicePrintSize || "80MM").toLowerCase()}`}>
              <div className="restaurant-invoice-brand">
                <div>
                  {orderSettings.logo ? (
                    <img src={orderSettings.logo} alt={orderSettings.storeName || "BhojanMitra"} />
                  ) : (
                    <strong>{orderSettings.storeShortName || "BM"}</strong>
                  )}
                </div>
                <section>
                  <h1>{orderSettings.storeName || "BhojanMitra"}</h1>
                  {(orderSettings.showStoreDetails ?? true) && (
                    <>
                      <p>{orderSettings.storeAddress || "Restaurant & Billing Management"}</p>
                      {orderSettings.storeContact && <p>Phone: {orderSettings.storeContact}</p>}
                      {orderSettings.storeEmail && <p>Email: {orderSettings.storeEmail}</p>}
                    </>
                  )}
                  {(orderSettings.showGSTDetails ?? true) && orderSettings.gstNumber && <p>GSTIN: {orderSettings.gstNumber}</p>}
                </section>
              </div>

              <div className="restaurant-invoice-title">
                <div>
                  <span>Tax Invoice</span>
                  <h2>{getInvoiceNo(paidInvoice)}</h2>
                </div>
                <b>{String(orderSettings.invoicePrintSize || "80MM").toUpperCase()}</b>
              </div>

              <div className="invoice-meta-grid">
                <div><span>Order No</span><b>{paidInvoice.orderNo}</b></div>
                <div><span>Order Type</span><b>{paidInvoice.orderType === "delivery" ? "Delivery" : `Dine-in Table ${paidInvoice.tableNo}`}</b></div>
                <div><span>Invoice Date</span><b>{formatDateTime(paidInvoice.payment?.paidAt || paidInvoice.updatedAt || paidInvoice.createdAt)}</b></div>
                <div><span>Payment Mode</span><b>{paidInvoice.payment?.mode || "Paid"}</b></div>
                {(orderSettings.showCustomerDetails ?? true) && (
                  <>
                    <div><span>Customer</span><b>{paidInvoice.customerName || "Walk-in Customer"}</b></div>
                    <div><span>Contact</span><b>{paidInvoice.customerPhone || "N/A"}</b></div>
                    {paidInvoice.customerEmail && <div><span>Email</span><b>{paidInvoice.customerEmail}</b></div>}
                    {paidInvoice.deliveryAddress && <div><span>Address</span><b>{paidInvoice.deliveryAddress}</b></div>}
                  </>
                )}
              </div>

              <table className="invoice-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>MRP</th>
                    <th>GST</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {paidInvoice.items?.map((item, index) => (
                    <tr key={`${item.productId}-${index}`}>
                      <td>{item.name}</td>
                      <td>{item.qty}</td>
                      <td>Rs {Number(item.rate || 0).toFixed(2)}</td>
                      <td>{Number(item.gst || 0) > 0 ? `${item.gst}%` : "N/A"}</td>
                      <td>Rs {Number(item.total || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="invoice-total">
                <p><span>{Number(paidInvoice.gstAmount || 0) > 0 ? "Base Price" : "Price"}</span><b>Rs {Number(paidInvoice.subTotal || 0).toFixed(2)}</b></p>
                {Number(paidInvoice.gstAmount || 0) > 0 && <p><span>GST Included</span><b>Rs {Number(paidInvoice.gstAmount || 0).toFixed(2)}</b></p>}
                {Number(paidInvoice.discountAmount || 0) > 0 && <p><span>Coupon {paidInvoice.couponCode}</span><b>- Rs {Number(paidInvoice.discountAmount || 0).toFixed(2)}</b></p>}
                <h2><span>Total Paid</span><b>Rs {Number(paidInvoice.grandTotal || 0).toFixed(2)}</b></h2>
              </div>

              <p className="invoice-amount-words">
                <span>Amount in Words:</span> {amountInWords(paidInvoice.grandTotal)}
              </p>

              <div className="restaurant-invoice-policies">
                {(orderSettings.showTerms ?? true) && (
                  <section>
                    <h3>Terms</h3>
                    <p>{orderSettings.termsAndConditions || "Goods once served cannot be cancelled after billing."}</p>
                  </section>
                )}
                {(orderSettings.showReturnPolicy ?? true) && (
                  <section>
                    <h3>Return Policy</h3>
                    <p>{orderSettings.returnPolicy || "Please contact the counter for any billing correction."}</p>
                  </section>
                )}
              </div>

              <div className="invoice-signature-row">
                <div>
                  <span>Customer Signature</span>
                </div>
                <div>
                  <b>For {orderSettings.storeName || "BhojanMitra"}</b>
                  <span>Authorized Signatory</span>
                </div>
              </div>

              {(orderSettings.showThankYou ?? true) && (
                <div className="restaurant-invoice-footer">
                  <p>{orderSettings.thankYouMessage || "Thank you for dining with us!"}</p>
                  <b>{orderSettings.storeName || "BhojanMitra"}</b>
                </div>
              )}

              <p className="invoice-authenticity-note">
                This is a computer-generated invoice and does not require a physical stamp.
              </p>
            </div>

            <button className="no-print" onClick={() => window.print()}>
              <Printer size={17} />
              Print Bill / Invoice
            </button>
            <button className="no-print invoice-delete-btn wide" onClick={() => deleteRestaurantInvoice(paidInvoice)}>
              Delete Invoice
            </button>
          </div>
        </div>
      )}

      {discountOrder && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-head">
              <h2>Apply Discount - {discountOrder.orderNo}</h2>
              <button onClick={() => setDiscountOrder(null)}>x</button>
            </div>
            <label>
              Discount Amount (Rs)
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
            <button className="save-grn-btn" onClick={submitDiscount}>Apply Discount</button>
          </div>
        </div>
      )}

      {splitOrder && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-head">
              <h2>Split Bill - {splitOrder.orderNo}</h2>
              <button onClick={() => setSplitOrder(null)}>x</button>
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
                  <b>Rs {Number(item.total || 0).toFixed(2)}</b>
                </label>
              ))}
            </div>
            <button className="save-grn-btn" onClick={submitSplit}>Split Selected Items</button>
          </div>
        </div>
      )}

      {mergeOrder && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-head">
              <h2>Merge Bill - {mergeOrder.orderNo}</h2>
              <button onClick={() => setMergeOrder(null)}>x</button>
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
            <button className="save-grn-btn" onClick={submitMerge}>Merge Into Selected Order</button>
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
        message={`${statusTarget?.orderNo || "Order"} ko "${statusTarget?.status || ""}" mark karna hai?`}
        confirmText="Update Status"
        onCancel={() => setStatusTarget(null)}
        onConfirm={confirmStatusUpdate}
      />

      {newOrderOpen && (
        <div className="product-modal-overlay">
          <div className="modal-card large captain-order-modal">
            <div className="product-modal-head">
              <div>
                <h2>New Order</h2>
                <p className="captain-order-subhead">Take an order table-side, waiter/captain style</p>
              </div>
              <button type="button" onClick={() => setNewOrderOpen(false)} aria-label="Close"><X size={18} /></button>
            </div>

            <div className="captain-order-body">
              <div className="captain-order-left">
                <div className="captain-order-toggle">
                  <button
                    type="button"
                    className={!newOrderIsDelivery ? "active" : ""}
                    onClick={() => setNewOrderIsDelivery(false)}
                  >
                    <Utensils size={15} /> Dine-in
                  </button>
                  <button
                    type="button"
                    className={newOrderIsDelivery ? "active" : ""}
                    onClick={() => setNewOrderIsDelivery(true)}
                  >
                    <ClipboardList size={15} /> Delivery
                  </button>
                </div>

                <div className="captain-order-details-row">
                  {!newOrderIsDelivery && (
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
                    <span>Customer name {newOrderIsDelivery ? "*" : "(optional)"}</span>
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
                          {product.image ? <img src={product.image} alt={product.name} /> : <span>{product.name?.slice(0, 1) || "M"}</span>}
                        </div>
                        <div className="captain-order-item-name">
                          <b>{product.name}</b>
                          <span>Rs {Number(product.mrp || product.sellingPrice || 0).toFixed(2)}</span>
                        </div>
                        <div className="menu-add-control">
                          {inCart ? (
                            <>
                              <button type="button" onClick={() => changeNewOrderQty(product, -1)}>-</button>
                              <b>{inCart.qty}</b>
                              <button type="button" onClick={() => changeNewOrderQty(product, 1)}>+</button>
                            </>
                          ) : (
                            <button type="button" onClick={() => changeNewOrderQty(product, 1)}>Add</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="captain-order-right">
                <h3>Order Summary</h3>
                {newOrderCart.length === 0 ? (
                  <p className="empty-cart-copy">No items added yet.</p>
                ) : (
                  <div className="menu-cart-items">
                    {newOrderCart.map((item) => (
                      <div key={item.productId}>
                        <span>{item.name}</span>
                        <b>{item.qty} x Rs {item.rate.toFixed(2)}</b>
                      </div>
                    ))}
                  </div>
                )}

                <div className="captain-order-total">
                  <span>{newOrderCartQty} items</span>
                  <b>Rs {newOrderCartTotal.toFixed(2)}</b>
                </div>

                <button
                  type="button"
                  className="captain-order-submit-btn"
                  disabled={placingNewOrder || newOrderCart.length === 0}
                  onClick={submitNewOrder}
                >
                  {placingNewOrder ? "Placing..." : "Place Order"}
                </button>
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
