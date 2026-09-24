import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BellRing } from "lucide-react";
import API from "../api/axios";
import {
  ORDER_SETTINGS_CHANGED_EVENT,
  ORDERS_UPDATED_EVENT,
  startOrderAlarm,
  stopOrderAlarm,
} from "../api/orderAlarm";

const countNewOrders = (orders = []) => orders.filter((order) => order.status === "new").length;

// Mounted once in the staff layout, so the ringtone keeps looping on every admin
// page until each new order has been accepted (or cancelled).
export default function OrderAlarm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [refreshSeconds, setRefreshSeconds] = useState(5);
  const [newCount, setNewCount] = useState(0);
  const [blocked, setBlocked] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await API.get("/settings");
      const settings = res.data.settings || {};
      setSoundEnabled(settings.restaurantOrderSoundEnabled !== false);
      setRefreshSeconds(Math.max(3, Number(settings.restaurantOrderRefreshSeconds || 5)));
    } catch {
      // Keep the defaults: ringing for a real order matters more than the setting.
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await API.get("/restaurant-orders");
      setNewCount(countNewOrders(res.data.orders));
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
    const onOrdersUpdated = (event) => setNewCount(countNewOrders(event.detail));
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
    startOrderAlarm().then((ok) => alive && setBlocked(!ok));
    return () => {
      alive = false;
    };
  }, [shouldRing]);

  // Browsers refuse to play audio before the user has interacted with the page.
  // Retry on the first tap/keypress so the alarm starts as soon as possible.
  useEffect(() => {
    if (!blocked) return undefined;
    const retry = () => startOrderAlarm().then((ok) => ok && setBlocked(false));
    const events = ["pointerdown", "keydown", "touchstart"];
    events.forEach((name) => window.addEventListener(name, retry));
    return () => events.forEach((name) => window.removeEventListener(name, retry));
  }, [blocked]);

  useEffect(() => () => stopOrderAlarm(), []);

  const onOrdersPage = location.pathname === "/restaurant-orders";
  if (newCount === 0 || (onOrdersPage && !blocked)) return null;

  return (
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
  );
}
