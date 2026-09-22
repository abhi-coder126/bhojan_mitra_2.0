import { useEffect, useRef, useState } from "react";
import API from "../api/axios";
import { ToastViewport, useToast } from "../components/Toast";

const itemStatusFlow = ["NEW", "ACCEPTED", "COOKING", "READY", "SERVED"];
const itemStatusColors = {
  NEW: "#ef4444",
  ACCEPTED: "#f59e0b",
  COOKING: "#38bdf8",
  READY: "#22c55e",
  SERVED: "#6b7280",
};

function elapsedMinutes(createdAt) {
  const diff = Date.now() - new Date(createdAt).getTime();
  return Math.max(Math.floor(diff / 60000), 0);
}

export default function KDS() {
  const [orders, setOrders] = useState([]);
  const [now, setNow] = useState(Date.now());
  const { toast, showToast } = useToast();
  const timerRef = useRef(null);

  const fetchOrders = async () => {
    try {
      const res = await API.get("/restaurant-orders/kitchen/live");
      setOrders(res.data.orders || []);
    } catch (error) {
      showToast(error.response?.data?.message || "Could not load kitchen orders", "warning");
    }
  };

  useEffect(() => {
    fetchOrders();
    const poll = setInterval(fetchOrders, 5000);
    timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(timerRef.current);
    };
  }, []);

  const sendKOT = async (order) => {
    try {
      await API.patch(`/restaurant-orders/${order._id}/kot`);
      fetchOrders();
    } catch (error) {
      showToast(error.response?.data?.message || "Could not send KOT", "error");
    }
  };

  const nextItemStatus = (status) => {
    const idx = itemStatusFlow.indexOf(status);
    return itemStatusFlow[Math.min(idx + 1, itemStatusFlow.length - 1)];
  };

  const advanceItem = async (order, itemIndex, currentStatus) => {
    try {
      await API.patch(`/restaurant-orders/${order._id}/item-status`, {
        itemIndex,
        itemStatus: nextItemStatus(currentStatus),
      });
      fetchOrders();
    } catch (error) {
      showToast(error.response?.data?.message || "Could not update item status", "error");
    }
  };

  const markAllItems = async (order, itemStatus) => {
    try {
      await API.patch(`/restaurant-orders/${order._id}/item-status`, {
        itemStatus,
        applyToAll: true,
      });
      fetchOrders();
    } catch (error) {
      showToast(error.response?.data?.message || "Could not update items", "error");
    }
  };

  return (
    <div>
      <ToastViewport toast={toast} />

      <div className="page-head">
        <div>
          <h1>Kitchen Display System</h1>
          <p>Live orders by status with prep timers. Refreshes automatically every 5 seconds.</p>
        </div>
      </div>

      {orders.length === 0 && (
        <div className="panel">
          <p>No live kitchen orders right now.</p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
        {orders.map((order) => {
          const minutes = elapsedMinutes(order.createdAt);
          const urgent = minutes >= 15;

          return (
            <div
              key={order._id}
              className="panel"
              style={{
                borderTop: `4px solid ${urgent ? "#ef4444" : "#22c55e"}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>
                    {order.orderType === "delivery" ? "Delivery" : `Table ${order.tableNo}`}
                  </strong>
                  <div style={{ fontSize: "12px", opacity: 0.7 }}>
                    {order.orderNo} · {order.orderSource || "pos"}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: urgent ? "#ef4444" : "#22c55e" }}>
                  {minutes}m
                </div>
              </div>

              {!order.kotSentAt && (
                <button style={{ margin: "10px 0", width: "100%" }} onClick={() => sendKOT(order)}>
                  Send KOT to Kitchen
                </button>
              )}

              {order.kotSentAt && (
                <div style={{ display: "flex", gap: "6px", margin: "10px 0" }}>
                  {["COOKING", "READY", "SERVED"].map((status) => (
                    <button
                      key={status}
                      style={{
                        flex: 1,
                        fontSize: "11px",
                        padding: "8px 4px",
                        background: itemStatusColors[status],
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: 700,
                      }}
                      onClick={() => markAllItems(order, status)}
                    >
                      Mark all {status}
                    </button>
                  ))}
                </div>
              )}

              <ul style={{ listStyle: "none", padding: 0, margin: "10px 0" }}>
                {order.items.map((item, idx) => (
                  <li
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 0",
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    <span>
                      {item.qty} x {item.name}
                    </span>
                    <button
                      style={{
                        fontSize: "11px",
                        padding: "3px 8px",
                        background: itemStatusColors[item.itemStatus],
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                      }}
                      disabled={item.itemStatus === "SERVED"}
                      onClick={() => advanceItem(order, idx, item.itemStatus)}
                    >
                      {item.itemStatus}
                    </button>
                  </li>
                ))}
              </ul>

              <div style={{ fontSize: "12px", opacity: 0.7 }}>
                Order status: <strong>{order.status}</strong>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
