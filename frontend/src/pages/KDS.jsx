import AsyncButton from "../components/AsyncButton";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChefHat, CheckCircle2, Flame, Timer } from "lucide-react";
import API from "../api/axios";
import { ToastViewport, useToast } from "../components/Toast";

// The kitchen's side of the flow. The counter accepts an order and sends its KOT;
// only then does it appear here. The kitchen accepts the KOT, cooks, and marks it
// ready; the counter then serves it.
const ITEM_NEXT = { NEW: "ACCEPTED", ACCEPTED: "COOKING", COOKING: "READY" };
const ITEM_LABEL = { NEW: "New", ACCEPTED: "Accepted", COOKING: "Cooking", READY: "Ready", SERVED: "Served" };

const LANES = [
  { key: "new", title: "New KOTs", icon: ChefHat },
  { key: "cooking", title: "Cooking", icon: Flame },
  { key: "ready", title: "Ready - waiting for counter", icon: CheckCircle2 },
];

const laneOf = (order) => {
  const statuses = order.items.map((item) => item.itemStatus);
  if (statuses.every((s) => s === "READY" || s === "SERVED")) return "ready";
  if (statuses.some((s) => s === "COOKING" || s === "READY")) return "cooking";
  if (statuses.some((s) => s === "NEW")) return "new";
  return "cooking";
};

const minutesSince = (value, now) => Math.max(Math.floor((now - new Date(value).getTime()) / 60000), 0);

const playChime = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    [880, 1320].forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = frequency;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = ctx.currentTime + index * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.start(start);
      osc.stop(start + 0.2);
    });
    window.setTimeout(() => ctx.close?.(), 600);
  } catch {
    // Audio is a nice-to-have; the KOT is on screen either way.
  }
};

export default function KDS() {
  const [orders, setOrders] = useState([]);
  const [now, setNow] = useState(() => Date.now());
  const { toast, showToast } = useToast();
  const knownIds = useRef(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await API.get("/restaurant-orders/kitchen/live");
      const latest = res.data.orders || [];
      if (knownIds.current) {
        const incoming = latest.filter((order) => !knownIds.current.has(order._id));
        if (incoming.length > 0) {
          playChime();
          showToast(`New KOT: ${incoming[0].orderType === "delivery" ? "Delivery" : `Table ${incoming[0].tableNo}`}`, "success");
        }
      }
      knownIds.current = new Set(latest.map((order) => order._id));
      setOrders(latest);
    } catch (error) {
      showToast(error.response?.data?.message || "Could not load kitchen orders", "warning");
    }
  }, [showToast]);

  useEffect(() => {
    fetchOrders();
    const poll = setInterval(fetchOrders, 5000);
    const clock = setInterval(() => setNow(Date.now()), 15000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [fetchOrders]);

  const setItems = async (order, itemStatus, itemIndex) => {
    try {
      await API.patch(`/restaurant-orders/${order._id}/item-status`, {
        itemStatus,
        ...(itemIndex === undefined ? { applyToAll: true } : { itemIndex }),
      });
      fetchOrders();
    } catch (error) {
      showToast(error.response?.data?.message || "Could not update the KOT", "error");
    }
  };

  const grouped = LANES.map((lane) => ({ ...lane, orders: orders.filter((order) => laneOf(order) === lane.key) }));

  return (
    <div className="kds-page">
      <ToastViewport toast={toast} />

      <div className="page-head">
        <div>
          <h1>Kitchen Display</h1>
          <p>KOTs sent by the counter. Accept, cook and mark ready - the counter serves. Refreshes every 5 seconds.</p>
        </div>
      </div>

      <div className="kds-lanes">
        {grouped.map(({ key, title, icon: Icon, orders: laneOrders }) => (
          <section key={key} className={`kds-lane kds-lane-${key}`}>
            <header>
              <Icon size={18} />
              <h2>{title}</h2>
              <span>{laneOrders.length}</span>
            </header>

            {laneOrders.length === 0 && <p className="kds-empty">Nothing here</p>}

            {laneOrders.map((order) => {
              const minutes = minutesSince(order.kotSentAt || order.createdAt, now);
              const late = key !== "ready" && minutes >= 15;

              return (
                <article key={order._id} className={`kds-ticket${late ? " is-late" : ""}`}>
                  <div className="kds-ticket-head">
                    <div>
                      <strong>{order.orderType === "delivery" ? "Delivery" : `Table ${order.tableNo}`}</strong>
                      <small>
                        {order.orderNo}
                        {order.kotSentBy ? ` · KOT by ${order.kotSentBy}` : ""}
                      </small>
                    </div>
                    <span className="kds-timer" title="Minutes since the KOT was sent">
                      <Timer size={14} /> {minutes}m
                    </span>
                  </div>

                  <ul className="kds-items">
                    {order.items.map((item, index) => {
                      const next = ITEM_NEXT[item.itemStatus];
                      return (
                        <li key={`${item.productId}-${index}`}>
                          <span>
                            <b>{item.qty} ×</b> {item.name}
                          </span>
                          <AsyncButton
                            className={`kds-item-status is-${String(item.itemStatus).toLowerCase()}`}
                            disabled={!next}
                            title={next ? `Tap to mark ${ITEM_LABEL[next].toLowerCase()}` : ""}
                            onClick={() => setItems(order, next, index)}
                          >
                            {ITEM_LABEL[item.itemStatus]}
                          </AsyncButton>
                        </li>
                      );
                    })}
                  </ul>

                  {order.note && <p className="kds-note">Note: {order.note}</p>}

                  <div className="kds-actions">
                    {key === "new" && (
                      <>
                        <AsyncButton className="kds-btn" onClick={() => setItems(order, "ACCEPTED")}>
                          Accept KOT
                        </AsyncButton>
                        <AsyncButton className="kds-btn kds-btn-primary" onClick={() => setItems(order, "COOKING")}>
                          Start cooking
                        </AsyncButton>
                      </>
                    )}
                    {key === "cooking" && (
                      <AsyncButton className="kds-btn kds-btn-primary" onClick={() => setItems(order, "READY")}>
                        Mark all ready
                      </AsyncButton>
                    )}
                    {key === "ready" && <span className="kds-waiting">Counter will serve this order</span>}
                  </div>
                </article>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
