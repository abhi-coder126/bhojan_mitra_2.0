import { useRef, useState } from "react";
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
  const [error, setError] = useState("");
  const locked = useRef(false);

  if (!open) return null;

  const cancel = () => {
    setPassword("");
    setError("");
    onCancel();
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!password.trim() || locked.current) return;
    locked.current = true;

    try {
      setSubmitting(true);
      setError("");
      await onConfirm(password);
      setPassword("");
    } catch (cause) {
      setError(cause.response?.data?.message || cause.message || "Could not delete. Please try again.");
    } finally {
      locked.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="delete-confirm-overlay">
      <form className="delete-confirm-modal" onSubmit={submit}>
        <button type="button" className="delete-confirm-close" disabled={submitting} onClick={cancel} title="Close" aria-label="Close">
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
              disabled={submitting}
            />
          </div>
        </label>

        {error && <p className="async-form-error" role="alert">{error}</p>}
        <div className="delete-confirm-actions">
          <button type="button" onClick={cancel} disabled={submitting}>
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
