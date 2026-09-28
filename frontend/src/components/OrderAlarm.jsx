import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BellRing, Clock3, X } from "lucide-react";
import API from "../api/axios";
import {
  ORDER_SETTINGS_CHANGED_EVENT,
  ORDERS_UPDATED_EVENT,
  playOrderTuneOnce,
  startOrderAlarm,
  stopOrderAlarm,
} from "../api/orderAlarm";
import { ORDER_LATE_MINUTES, formatOrderAge, isOrderLate, orderAgeMs } from "../api/orderTimer";

const orderPlace = (order) =>
  order.orderType === "delivery" ? "Delivery" : order.orderType === "takeaway" ? "Takeaway" : `Table ${order.tableNo}`;

const countNewOrders = (orders = []) => orders.filter((order) => order.status === "new").length;

// Mounted once in the staff layout, so the ringtone keeps looping on every admin
// page until each new order has been accepted (or cancelled).
export default function OrderAlarm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [repeatSound, setRepeatSound] = useState(true);
  const [refreshSeconds, setRefreshSeconds] = useState(5);
  const [newCount, setNewCount] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [orders, setOrders] = useState([]);
  const [now, setNow] = useState(() => Date.now());
  // Late alerts the counter has dismissed; they stay dismissed until reload.
  const [dismissedLate, setDismissedLate] = useState(() => new Set());
  const alertedLate = useRef(new Set());

  const fetchSettings = useCallback(async () => {
    try {
      const res = await API.get("/settings");
      const settings = res.data.settings || {};
      setSoundEnabled(settings.restaurantOrderSoundEnabled !== false);
      setRepeatSound(settings.restaurantOrderRepeatSound !== false);
      setRefreshSeconds(Math.max(3, Number(settings.restaurantOrderRefreshSeconds || 5)));
    } catch {
      // Keep the defaults: ringing for a real order matters more than the setting.
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await API.get("/restaurant-orders");
      setNewCount(countNewOrders(res.data.orders));
      setOrders(res.data.orders || []);
    } catch {
      // Head office without a branch, offline, etc. Try again on the next tick.
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    window.addEventListener(ORDER_SETTINGS_CHANGED_EVENT, fetchSettings);
    return () => window.removeEventListener(ORDER_SETTINGS_CHANGED_EVENT, fetchSettings);
  }, [fetchSettings]);

  useEffect(() => {
    fetchOrders();
    const timer = window.setInterval(fetchOrders, refreshSeconds * 1000);

    // The Restaurant Orders page already polls; reuse its list so accepting an
    // order there stops the ringtone immediately.
    const onOrdersUpdated = (event) => {
      setNewCount(countNewOrders(event.detail));
      setOrders(event.detail || []);
    };
    const onVisible = () => document.visibilityState === "visible" && fetchOrders();

    window.addEventListener(ORDERS_UPDATED_EVENT, onOrdersUpdated);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(ORDERS_UPDATED_EVENT, onOrdersUpdated);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchOrders, refreshSeconds]);

  const shouldRing = soundEnabled && newCount > 0;

  useEffect(() => {
    if (!shouldRing) {
      stopOrderAlarm();
      setBlocked(false);
      return;
    }
    let alive = true;
    startOrderAlarm(repeatSound).then((ok) => alive && setBlocked(!ok));
    return () => {
      alive = false;
    };
  }, [shouldRing, repeatSound]);

  // Browsers refuse to play audio before the user has interacted with the page.
  // Retry on the first tap/keypress so the alarm starts as soon as possible.
  useEffect(() => {
    if (!blocked) return undefined;
    const retry = () => startOrderAlarm(repeatSound).then((ok) => ok && setBlocked(false));
    const events = ["pointerdown", "keydown", "touchstart"];
    events.forEach((name) => window.addEventListener(name, retry));
    return () => events.forEach((name) => window.removeEventListener(name, retry));
  }, [blocked, repeatSound]);

  useEffect(() => () => stopOrderAlarm(), []);

  // Re-evaluates "late" between polls so an order turns late on time.
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(tick);
  }, []);

  const lateOrders = useMemo(
    () => orders
      .filter((order) => isOrderLate(order, now) && !dismissedLate.has(order._id))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [orders, now, dismissedLate]
  );

  // One chime per order the moment it turns late (the new-order ringtone, if
  // looping, already has the counter's attention).
  useEffect(() => {
    const fresh = lateOrders.filter((order) => !alertedLate.current.has(order._id));
    if (fresh.length === 0) return;
    fresh.forEach((order) => alertedLate.current.add(order._id));
    if (soundEnabled && newCount === 0) playOrderTuneOnce();
  }, [lateOrders, soundEnabled, newCount]);

  const dismissLate = (ids) =>
    setDismissedLate((current) => new Set([...current, ...ids]));

  const lateBanner = lateOrders.length > 0 && (
    <div className={`order-late-banner${newCount > 0 ? " stacked" : ""}`} role="alert">
      <span className="order-alarm-icon"><Clock3 size={20} /></span>
      <div>
        <b>
          {lateOrders.length === 1
            ? `${lateOrders[0].orderNo} is getting late`
            : `${lateOrders.length} orders are getting late`}
        </b>
        <small>
          {lateOrders.length === 1
            ? `${orderPlace(lateOrders[0])} · waiting ${formatOrderAge(orderAgeMs(lateOrders[0], now))} and not ready yet`
            : lateOrders.slice(0, 3).map((order) => `${orderPlace(order)} (${formatOrderAge(orderAgeMs(order, now))})`).join(", ") +
              ` · over ${ORDER_LATE_MINUTES} min, not ready`}
        </small>
      </div>
      {location.pathname !== "/restaurant-orders" && (
        <button type="button" onClick={() => navigate("/restaurant-orders")}>View</button>
      )}
      <button
        type="button"
        className="order-late-dismiss"
        aria-label="Dismiss late order alert"
        onClick={() => dismissLate(lateOrders.map((order) => order._id))}
      >
        <X size={18} />
      </button>
    </div>
  );

  const onOrdersPage = location.pathname === "/restaurant-orders";
  if (newCount === 0 || (onOrdersPage && !blocked)) return lateBanner || null;

  return (
    <>
    {lateBanner}
    <div className={`order-alarm-banner ${blocked ? "blocked" : ""}`} role="alert">
      <span className="order-alarm-icon"><BellRing size={20} /></span>
      <div>
        <b>{newCount} new order{newCount > 1 ? "s" : ""} waiting</b>
        <small>{blocked ? "Tap anywhere to turn on the order sound" : "Accept the order to stop the ringtone"}</small>
      </div>
      {!onOrdersPage && (
        <button type="button" onClick={() => navigate("/restaurant-orders")}>View Orders</button>
      )}
    </div>
    </>
  );
}
