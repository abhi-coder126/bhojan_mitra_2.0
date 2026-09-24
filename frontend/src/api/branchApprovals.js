import { useCallback, useEffect, useState } from "react";
import API from "./axios";

// Head office inbox: branches ask for profile changes here, and nothing reaches the
// branch record until the master admin approves it.
export function useBranchApprovals(enabled) {
  const [pendingCount, setPendingCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await API.get("/branches/change-requests", { params: { status: "pending" } });
      setPendingCount(res.data.pendingCount || 0);
    } catch {
      // A failed poll must not disturb the page; the next tick tries again.
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
    if (!enabled) return undefined;
    const timer = window.setInterval(refresh, 60000);
    return () => window.clearInterval(timer);
  }, [enabled, refresh]);

  return { pendingCount, refresh };
}
