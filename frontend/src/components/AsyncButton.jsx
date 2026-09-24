import { useRef, useState } from "react";

// Lock synchronously: two clicks can arrive before React renders disabled=true.
export default function AsyncButton({ onClick, disabled, children, type = "button", ...props }) {
  const locked = useRef(false);
  const [pending, setPending] = useState(false);

  const handleClick = async (event) => {
    if (locked.current || disabled) return;
    locked.current = true;
    setPending(true);
    try {
      await onClick?.(event);
    } catch (error) {
      window.alert(error.response?.data?.message || error.message || "Action failed. Please try again.");
    } finally {
      locked.current = false;
      setPending(false);
    }
  };

  return (
    <button {...props} type={type} disabled={disabled || pending} aria-busy={pending} onClick={handleClick}>
      {pending ? <><span className="action-spinner" aria-hidden="true" /> Working...</> : children}
    </button>
  );
}
