import { useMutation } from "convex/react";
import { useRef } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const REFRESH_INTERVAL_MS = 2_000;

interface Container {
  channelId?: Id<"channels">;
  threadId?: Id<"directMessageThreads">;
}

/** Debounced typing-indicator refresh (research.md §5) — call `notifyTyping()`
 * on every keystroke; the underlying mutation only actually fires every ~2s. */
export function useTyping(container: Container) {
  const setTyping = useMutation(api.messages.setTyping);
  const lastSentAt = useRef(0);

  function notifyTyping() {
    const now = Date.now();
    if (now - lastSentAt.current < REFRESH_INTERVAL_MS) return;
    lastSentAt.current = now;
    void setTyping(container);
  }

  return { notifyTyping };
}
