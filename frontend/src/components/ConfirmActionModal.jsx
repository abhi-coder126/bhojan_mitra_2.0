import { AlertTriangle, X } from "lucide-react";

export default function ConfirmActionModal({
  open,
  title = "Are you sure?",
  message = "Please confirm this action.",
  confirmText = "Confirm",
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="confirm-action-overlay">
      <div className="confirm-action-modal">
        <button type="button" className="confirm-action-close" onClick={onCancel} title="Close">
          <X size={18} />
        </button>

        <div className="confirm-action-icon">
          <AlertTriangle size={26} />
        </div>

        <h2>{title}</h2>
        <p>{message}</p>

        <div className="confirm-action-buttons">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="confirm-action-primary" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
