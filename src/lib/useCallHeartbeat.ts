import { useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const HEARTBEAT_INTERVAL_MS = 5_000;

/** Keeps `callParticipants.lastHeartbeatAt` fresh while mounted in a call
 * (research.md §6) — reuses the same interval/lifecycle pattern as presence's
 * useHeartbeat, scoped to this callId instead of globally. */
export function useCallHeartbeat(callId: Id<"calls"> | null) {
  const heartbeat = useMutation(api.calls.heartbeat);

  useEffect(() => {
    if (!callId) return;
    void heartbeat({ callId });
    const interval = setInterval(() => void heartbeat({ callId }), HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [callId, heartbeat]);
}
