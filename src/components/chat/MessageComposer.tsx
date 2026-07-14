import { useMutation } from "convex/react";
import { useState, type KeyboardEvent } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useTyping } from "../../lib/useTyping";

interface MessageComposerProps {
  channelId?: Id<"channels">;
  threadId?: Id<"directMessageThreads">;
  placeholder: string;
}

export default function MessageComposer({ channelId, threadId, placeholder }: MessageComposerProps) {
  const send = useMutation(api.messages.send);
  const { notifyTyping } = useTyping({ channelId, threadId });
  const [content, setContent] = useState("");

  async function handleSend() {
    const trimmed = content.trim();
    if (!trimmed) return;
    setContent("");
    await send({ channelId, threadId, content: trimmed });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="px-4 pb-4">
      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          notifyTyping();
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        className="w-full resize-none rounded-lg bg-surface-modifier px-4 py-3 text-sm text-text-primary outline-none"
      />
    </div>
  );
}
