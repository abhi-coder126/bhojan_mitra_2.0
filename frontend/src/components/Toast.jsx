/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useRef, useState } from "react";

export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const showToast = useCallback((message, type = "error") => {
    if (timer.current) clearTimeout(timer.current);
    // id restarts the entrance animation even when the same message repeats.
    setToast({ message, type, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { toast, showToast };
}

export function ToastViewport({ toast }) {
  if (!toast) return null;

  return <div className={`pos-toast ${toast.type}`}>{toast.message}</div>;
}
