import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface TypingIndicatorProps {
  channelId?: Id<"channels">;
  threadId?: Id<"directMessageThreads">;
}

export default function TypingIndicator({ channelId, threadId }: TypingIndicatorProps) {
  const typing = useQuery(
    api.messages.listTyping,
    channelId ? { channelId } : threadId ? { threadId } : "skip",
  );

  if (!typing || typing.length === 0) return <div className="h-5" />;

  const names = typing.map((t) => t.displayName);
  const text =
    names.length === 1
      ? `${names[0]} is typing…`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing…`
        : `${names.length} people are typing…`;

  return <div className="h-5 px-4 text-xs italic text-text-muted">{text}</div>;
}
