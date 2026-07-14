import { useNavigate, useParams } from "react-router-dom";
import type { Id } from "../../convex/_generated/dataModel";
import CallRoom from "../components/voice/CallRoom";

/** 1-on-1 video call started from a DM (FR-030) — reuses the same CallRoom
 * (join/heartbeat/mesh WebRTC/grid/controls) as a voice-channel call. */
export default function DmCallPage() {
  const { threadId } = useParams<{ threadId: Id<"directMessageThreads"> }>();
  const navigate = useNavigate();

  if (!threadId) return null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <CallRoom key={threadId} threadId={threadId} onExit={() => navigate(`/dm/${threadId}`)} />
    </div>
  );
}
