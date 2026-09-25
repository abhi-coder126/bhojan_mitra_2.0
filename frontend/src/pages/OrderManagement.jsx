import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Hourglass, Search, Timer, Utensils } from "lucide-react";
import API from "../api/axios";
import { SkeletonTable } from "../components/Skeleton";
import StatusBadge from "../components/StatusBadge";
import { ToastViewport, useToast } from "../components/Toast";

const LIVE_STATUSES = ["new", "accepted", "preparing", "ready"];

// "1h 04m" / "12m 30s" / "45s" -- whichever is the shortest honest reading.
const formatDuration = (ms) => {
  if (!Number.isFinite(ms) || ms < 0) return "-";
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
};

const orderTitle = (order) =>
  order.orderType === "delivery" ? "Delivery"
    : order.orderType === "takeaway" ? "Takeaway"
    : `Table ${order.tableNo}`;

const money = (value) => `₹${Number(value || 0).toFixed(2)}`;

export default function OrderManagement() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("live");
  // Ticks once a second so the running clocks stay honest without refetching.
  const [now, setNow] = useState(() => Date.now());
  const { toast, showToast } = useToast();

  const load = useCallback(async () => {
    const res = await API.get("/restaurant-orders", { params: { limit: 300 } });
    setOrders(res.data.orders || []);
  }, []);

  useEffect(() => {
    load()
      .catch((error) => showToast(error.response?.data?.message || "Could not load orders", "error"))
      .finally(() => setLoading(false));
    const refresh = window.setInterval(() => load().catch(() => {}), 15000);
    return () => window.clearInterval(refresh);
  }, [load, showToast]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders
      .filter((order) => (tab === "live" ? LIVE_STATUSES.includes(order.status) : !LIVE_STATUSES.includes(order.status)))
      .filter((order) =>
        !q ||
        [order.orderNo, order.invoiceNo, order.customerName, order.customerPhone, orderTitle(order)]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(q))
      )
      .map((order) => {
        const placed = new Date(order.createdAt).getTime();
        const accepted = order.acceptedAt ? new Date(order.acceptedAt).getTime() : null;
        const served = order.servedAt ? new Date(order.servedAt).getTime() : null;
        return {
          ...order,
          placed,
          // How long the counter sat on it before taking it on.
          waitToAccept: accepted ? accepted - placed : null,
          // Live: running since it was accepted. Closed: nothing to run.
          runningFor: accepted && !served ? now - accepted : null,
          // The number the guest actually felt: order placed to food served.
          totalTime: served ? served - placed : null,
        };
      })
      .sort((a, b) => b.placed - a.placed);
  }, [orders, search, tab, now]);

  const liveCount = orders.filter((order) => LIVE_STATUSES.includes(order.status)).length;

  // Averages only mean something over finished orders.
  const averageTotal = useMemo(() => {
    const done = orders
      .filter((order) => order.servedAt && order.createdAt)
      .map((order) => new Date(order.servedAt).getTime() - new Date(order.createdAt).getTime());
    return done.length ? done.reduce((sum, value) => sum + value, 0) / done.length : null;
  }, [orders]);

  const slowest = useMemo(() => {
    const live = rows.filter((row) => row.runningFor !== null);
    return live.length ? Math.max(...live.map((row) => row.runningFor)) : null;
  }, [rows]);

  return (
    <div className="dashboard-page order-management-page">
      <div className="page-head">
        <div>
          <h1>Order Management</h1>
          <p>How long every order has been running, and how long finished ones actually took.</p>
        </div>
      </div>

      <div className="dashboard-stats-grid restaurant-kpi-grid four-col">
        <div className="order-metric">
          <span><Utensils size={15} /> Running now</span>
          <b>{liveCount}</b>
        </div>
        <div className={`order-metric${slowest !== null && slowest > 30 * 60000 ? " warn" : ""}`}>
          <span><Hourglass size={15} /> Longest running</span>
          <b>{slowest === null ? "-" : formatDuration(slowest)}</b>
        </div>
        <div className="order-metric">
          <span><Timer size={15} /> Average order to served</span>
          <b>{averageTotal === null ? "-" : formatDuration(averageTotal)}</b>
        </div>
        <div className="order-metric">
          <span><Clock size={15} /> Orders loaded</span>
          <b>{orders.length}</b>
        </div>
      </div>

      <div className="panel">
        <div className="order-management-toolbar">
          <div className="restaurant-section-tabs">
            <button type="button" className={tab === "live" ? "active" : ""} onClick={() => setTab("live")}>
              Running orders {liveCount > 0 && <b className="section-tab-count">{liveCount}</b>}
            </button>
            <button type="button" className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
              Order history
            </button>
          </div>
          <label className="order-management-search">
            <Search size={15} />
            <input
              placeholder="Order no, invoice, customer, phone or table..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>

        {loading ? (
          <SkeletonTable rows={6} columns={7} />
        ) : rows.length === 0 ? (
          <p className="bm-empty">
            {tab === "live" ? "No orders are running right now." : "No finished orders match this search."}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Where</th>
                <th>Placed</th>
                {tab === "live" ? <th>Running for</th> : <th>Order to served</th>}
                <th>Accept wait</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <tr key={order._id}>
                  <td>
                    <b>{order.orderNo}</b>
                    {order.takenByName && <small className="order-taken-by">by {order.takenByName}</small>}
                  </td>
                  <td>
                    {orderTitle(order)}
                    {order.customerName && <small className="order-taken-by">{order.customerName}</small>}
                  </td>
                  <td>{new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</td>
                  <td>
                    {tab === "live" ? (
                      order.runningFor === null ? (
                        <span className="order-age waiting">Not accepted yet</span>
                      ) : (
                        <span className={`order-age${order.runningFor > 30 * 60000 ? " late" : ""}`}>
                          {formatDuration(order.runningFor)}
                        </span>
                      )
                    ) : (
                      <span className="order-age">{order.totalTime === null ? "-" : formatDuration(order.totalTime)}</span>
                    )}
                  </td>
                  <td>{order.waitToAccept === null ? "-" : formatDuration(order.waitToAccept)}</td>
                  <td><StatusBadge status={order.status} orderType={order.orderType} /></td>
                  <td>{money(order.grandTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ToastViewport toast={toast} />
    </div>
  );
}
