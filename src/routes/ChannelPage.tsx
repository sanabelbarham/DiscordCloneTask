import { useQuery } from "convex/react";
import { useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import MessageComposer from "../components/chat/MessageComposer";
import MessageList from "../components/chat/MessageList";
import TypingIndicator from "../components/chat/TypingIndicator";

export default function ChannelPage() {
  const { serverId, channelId } = useParams<{ serverId: Id<"servers">; channelId: Id<"channels"> }>();
  const channels = useQuery(api.channels.list, serverId ? { serverId } : "skip");
  const channel = channels?.find((c) => c._id === channelId);

  if (!channelId) return null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center border-b border-black/20 px-4">
        <span className="text-sm font-semibold text-text-primary"># {channel?.name ?? ""}</span>
      </div>
      <MessageList channelId={channelId} />
      <TypingIndicator channelId={channelId} />
      <MessageComposer channelId={channelId} placeholder={`Message #${channel?.name ?? ""}`} />
    </div>
  );
}
