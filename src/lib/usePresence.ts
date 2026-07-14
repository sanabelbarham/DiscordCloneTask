import { useConvexAuth, useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "../../convex/_generated/api";

const HEARTBEAT_INTERVAL_MS = 5_000;

/** Mounted once at the app shell (research.md §2): keeps the caller's presence
 * row fresh while the tab is open, so other users see them as online. */
export function useHeartbeat() {
  const { isAuthenticated } = useConvexAuth();
  const heartbeat = useMutation(api.presence.heartbeat);

  useEffect(() => {
    if (!isAuthenticated) return;

    void heartbeat({});
    const interval = setInterval(() => void heartbeat({}), HEARTBEAT_INTERVAL_MS);

    const onVisibilityOrUnload = () => {
      void heartbeat({});
    };
    document.addEventListener("visibilitychange", onVisibilityOrUnload);
    window.addEventListener("beforeunload", onVisibilityOrUnload);
    window.addEventListener("pagehide", onVisibilityOrUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityOrUnload);
      window.removeEventListener("beforeunload", onVisibilityOrUnload);
      window.removeEventListener("pagehide", onVisibilityOrUnload);
    };
  }, [isAuthenticated, heartbeat]);
}
