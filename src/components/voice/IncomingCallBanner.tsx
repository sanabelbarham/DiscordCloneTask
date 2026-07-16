import { useQuery } from "convex/react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useRingtone } from "../../lib/useRingtone";
import Avatar from "../ui/Avatar";
import Button from "../ui/Button";

/** Mounted once for the whole authenticated app (App.tsx) so an incoming DM
 * call rings no matter which page the callee is currently viewing. */
export default function IncomingCallBanner() {
  const incomingCalls = useQuery(api.calls.listIncomingCalls);
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<Id<"calls">[]>([]);

  const call = incomingCalls?.find((c) => !dismissed.includes(c.callId));
  useRingtone(!!call);

  if (!call || !call.otherUser) return null;

  return (
    <div className="fixed left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-surface-sidebar p-3 shadow-xl ring-2 ring-status-online">
      <Avatar avatarUrl={call.otherUser.avatarUrl} displayName={call.otherUser.displayName} size={36} />
      <span className="text-sm text-text-primary">{call.otherUser.displayName} is calling you…</span>
      <Button onClick={() => navigate(`/dm/${call.threadId}/call`)}>Accept</Button>
      <Button variant="secondary" onClick={() => setDismissed((prev) => [...prev, call.callId])}>
        Decline
      </Button>
    </div>
  );
}
