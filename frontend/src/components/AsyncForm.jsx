import { useRef, useState } from "react";

// showStatus: opt out where the submit button already reports its own progress,
// so the form does not repeat it underneath (e.g. the login card).
export default function AsyncForm({ onSubmit, children, showStatus = true, ...props }) {
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    setError("");
    try {
      await onSubmit(event);
    } catch (cause) {
      setError(cause.response?.data?.message || cause.message || "Could not save. Please try again.");
    } finally {
      locked.current = false;
      setPending(false);
    }
  };

  return (
    <form {...props} onSubmit={submit} aria-busy={pending}>
      <fieldset className="async-form-fields" disabled={pending}>{children}</fieldset>
      {pending && showStatus && <p className="async-form-status" role="status">Saving, please wait…</p>}
      {error && <p className="async-form-error" role="alert">{error}</p>}
    </form>
  );
}
