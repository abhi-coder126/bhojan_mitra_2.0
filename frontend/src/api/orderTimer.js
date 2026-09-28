// Order age = time since the guest placed the order, until the food is ready.
// Drives the green -> orange -> red clock on the order boards and the
// "order is getting late" alert.
export const ORDER_WARN_MINUTES = 15;
export const ORDER_LATE_MINUTES = 25;

const PENDING_STATUSES = ["new", "accepted", "preparing"];

// Still waiting on the kitchen (not ready, served, cancelled or on hold).
export const isOrderPending = (order) => PENDING_STATUSES.includes(order?.status) && !order?.isHeld;

// Milliseconds since placement; frozen at readyAt/servedAt once the food is out.
export const orderAgeMs = (order, now = Date.now()) => {
  const placed = new Date(order?.createdAt).getTime();
  if (!Number.isFinite(placed)) return null;
  const stoppedAt = order.readyAt || order.servedAt;
  const end = !isOrderPending(order) && stoppedAt ? new Date(stoppedAt).getTime() : now;
  return Math.max(end - placed, 0);
};

// "ok" (< 15 min), "warn" (15-25 min), "late" (25+ min).
export const orderAgeTone = (ms) => {
  if (ms === null || ms === undefined) return "ok";
  const minutes = ms / 60000;
  if (minutes >= ORDER_LATE_MINUTES) return "late";
  if (minutes >= ORDER_WARN_MINUTES) return "warn";
  return "ok";
};

export const isOrderLate = (order, now = Date.now()) =>
  isOrderPending(order) && orderAgeMs(order, now) >= ORDER_LATE_MINUTES * 60000;

// "1h 04m" / "12m 30s" / "45s".
export const formatOrderAge = (ms) => {
  if (!Number.isFinite(ms) || ms < 0) return "";
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
};
