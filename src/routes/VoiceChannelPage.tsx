import { useQuery } from "convex/react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import CallRoom from "../components/voice/CallRoom";

export default function VoiceChannelPage() {
  const { serverId, channelId } = useParams<{ serverId: Id<"servers">; channelId: Id<"channels"> }>();
  const navigate = useNavigate();
  const channels = useQuery(api.channels.list, serverId ? { serverId } : "skip");
  const channel = channels?.find((c) => c._id === channelId);

  if (!serverId || !channelId) return null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center border-b border-black/20 px-4">
        <span className="text-sm font-semibold text-text-primary">🔊 {channel?.name ?? ""}</span>
      </div>
      <CallRoom
        // Remounts the call (fresh join) whenever the target channel changes.
        key={channelId}
        channelId={channelId}
        serverId={serverId}
        onExit={() => navigate(`/servers/${serverId}`)}
      />
    </div>
  );
}
