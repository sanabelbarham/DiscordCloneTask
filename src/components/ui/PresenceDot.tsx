import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface PresenceDotProps {
  userId: Id<"users">;
  className?: string;
}

/** Reactive online/offline indicator (FR-004) — re-renders automatically as
 * `presence.getStatus` staleness crosses the threshold, no polling. */
export default function PresenceDot({ userId, className = "" }: PresenceDotProps) {
  const status = useQuery(api.presence.getStatus, { userId });
  const isOnline = status?.isOnline ?? false;

  return (
    <span
      title={isOnline ? "Online" : "Offline"}
      className={`inline-block h-2.5 w-2.5 rounded-full border-2 border-surface-sidebar ${
        isOnline ? "bg-status-online" : "bg-status-offline"
      } ${className}`}
    />
  );
}
