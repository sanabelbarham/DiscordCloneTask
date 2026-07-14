import { useQuery } from "convex/react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import MessageComposer from "../components/chat/MessageComposer";
import MessageList from "../components/chat/MessageList";
import TypingIndicator from "../components/chat/TypingIndicator";
import DirectMessageList from "../components/layout/DirectMessageList";
import Button from "../components/ui/Button";

export default function DirectMessagePage() {
  const { threadId } = useParams<{ threadId: Id<"directMessageThreads"> }>();
  const threads = useQuery(api.directMessages.listThreadsForUser);
  const thread = threads?.find((t) => t._id === threadId);

  if (!threadId) return null;

  return (
    <div className="flex flex-1 overflow-hidden">
      <DirectMessageList />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-black/20 px-4">
          <span className="text-sm font-semibold text-text-primary">
            {thread?.otherUser?.displayName ?? ""}
          </span>
          {/* Joins happen on mount inside the call route itself (FR-030), matching
              the voice-channel join-on-mount pattern. */}
          <Link to={`/dm/${threadId}/call`}>
            <Button variant="secondary">Start video call</Button>
          </Link>
        </div>
        <MessageList threadId={threadId} />
        <TypingIndicator threadId={threadId} />
        <MessageComposer threadId={threadId} placeholder={`Message ${thread?.otherUser?.displayName ?? ""}`} />
      </div>
    </div>
  );
}
