// Single source of truth for order-status color/label. Before this component, the
// same "served" status rendered purple in one place, green in another, and blue in
// a third -- each page had picked its own color independently. Every order-status
// badge in the app should render through this component instead of a bespoke <b>/<span>.
const STATUS_LABELS = {
  new: "New",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function StatusBadge({ status, orderType, className = "" }) {
  // "served" is the one shared status value for both dine-in and delivery orders
  // (same workflow step), but a delivery order reads better as "Delivered".
  const key = status === "served" && orderType === "delivery" ? "delivered" : status;
  const label = STATUS_LABELS[key] || key;

  return <span className={`status-badge ${key} ${className}`.trim()}>{label}</span>;
}
