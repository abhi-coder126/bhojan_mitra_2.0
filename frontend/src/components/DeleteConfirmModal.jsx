import { useState } from "react";
import { LockKeyhole, Trash2, X } from "lucide-react";

export default function DeleteConfirmModal({
  open,
  title = "Delete Record",
  message = "This action cannot be undone.",
  confirmText = "Delete",
  onCancel,
  onConfirm,
}) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (!password.trim() || submitting) return;

    try {
      setSubmitting(true);
      await onConfirm(password);
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="delete-confirm-overlay">
      <form className="delete-confirm-modal" onSubmit={submit}>
        <button type="button" className="delete-confirm-close" onClick={onCancel} title="Close">
          <X size={18} />
        </button>

        <div className="delete-confirm-icon">
          <Trash2 size={26} />
        </div>

        <h2>{title}</h2>
        <p>{message}</p>

        <label className="delete-password-field">
          <span>Login Password</span>
          <div>
            <LockKeyhole size={17} />
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
            />
          </div>
        </label>

        <div className="delete-confirm-actions">
          <button type="button" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="danger-btn" disabled={!password.trim() || submitting}>
            {submitting ? "Deleting..." : confirmText}
          </button>
        </div>
      </form>
    </div>
  );
}
