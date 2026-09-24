import { AlertTriangle, X } from "lucide-react";
import { useId, useState } from "react";
import AsyncButton from "./AsyncButton";

export default function ConfirmActionModal({
  open,
  title = "Are you sure?",
  message = "Please confirm this action.",
  confirmText = "Confirm",
  onCancel,
  onConfirm,
}) {
  const [submitting, setSubmitting] = useState(false);
  const titleId = useId();
  if (!open) return null;

  const confirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="confirm-action-overlay">
      <div className="confirm-action-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={submitting}>
        <button type="button" className="confirm-action-close" disabled={submitting} onClick={onCancel} title="Close" aria-label="Close">
          <X size={18} />
        </button>

        <div className="confirm-action-icon">
          <AlertTriangle size={26} />
        </div>

        <h2 id={titleId}>{title}</h2>
        <p>{message}</p>

        <div className="confirm-action-buttons">
          <button type="button" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <AsyncButton type="button" className="confirm-action-primary" onClick={confirm}>
            {confirmText}
          </AsyncButton>
        </div>
      </div>
    </div>
  );
}
