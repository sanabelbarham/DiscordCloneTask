import { usePaginatedQuery, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import Avatar from "../ui/Avatar";
import LinkifiedContent from "./LinkifiedContent";

interface MessageListProps {
  channelId?: Id<"channels">;
  threadId?: Id<"directMessageThreads">;
}

export default function MessageList({ channelId, threadId }: MessageListProps) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.list,
    channelId ? { channelId } : threadId ? { threadId } : "skip",
    { initialNumItems: 25 },
  );
  const profile = useQuery(api.users.getCurrentProfile);
  const editMessage = useMutation(api.messages.edit);
  const removeMessage = useMutation(api.messages.remove);
  const [editingId, setEditingId] = useState<Id<"messages"> | null>(null);
  const [editValue, setEditValue] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const newestId = results[0]?._id;
  const hasScrolledInitially = useRef(false);

  // Newest-first from the query; reversed here so the DOM reads oldest→newest,
  // top→bottom, like a normal chat thread (research.md §4).
  const ordered = [...results].reverse();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (!hasScrolledInitially.current || nearBottom) {
      el.scrollTop = el.scrollHeight;
      hasScrolledInitially.current = true;
    }
  }, [newestId]);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    if (el.scrollTop < 100 && status === "CanLoadMore") {
      const previousHeight = el.scrollHeight;
      loadMore(25);
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight - previousHeight;
        }
      });
    }
  }

  async function saveEdit(messageId: Id<"messages">) {
    if (editValue.trim()) await editMessage({ messageId, content: editValue.trim() });
    setEditingId(null);
  }

  return (
    <div ref={containerRef} onScroll={handleScroll} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
      {status === "LoadingFirstPage" && (
        <div className="text-center text-sm text-text-muted">Loading messages…</div>
      )}
      {ordered.map((message) => {
        const isAuthor = profile && message.authorId === profile._id;
        return (
          <MessageRow
            key={message._id}
            authorId={message.authorId}
            content={message.content}
            createdAt={message.createdAt}
            editedAt={message.editedAt}
            isAuthor={!!isAuthor}
            isEditing={editingId === message._id}
            editValue={editValue}
            onStartEdit={() => {
              setEditingId(message._id);
              setEditValue(message.content);
            }}
            onChangeEdit={setEditValue}
            onSaveEdit={() => void saveEdit(message._id)}
            onCancelEdit={() => setEditingId(null)}
            onDelete={() => void removeMessage({ messageId: message._id })}
          />
        );
      })}
    </div>
  );
}

interface MessageRowProps {
  authorId: Id<"users">;
  content: string;
  createdAt: number;
  editedAt: number | undefined;
  isAuthor: boolean;
  isEditing: boolean;
  editValue: string;
  onStartEdit: () => void;
  onChangeEdit: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
}

function MessageRow({
  authorId,
  content,
  createdAt,
  editedAt,
  isAuthor,
  isEditing,
  editValue,
  onStartEdit,
  onChangeEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}: MessageRowProps) {
  const author = useQuery(api.users.getProfile, { userId: authorId });

  return (
    <div className="group relative flex items-start gap-3 rounded px-2 py-1 hover:bg-surface-modifier/40">
      <Avatar avatarUrl={author?.avatarUrl ?? ""} displayName={author?.displayName ?? "?"} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-text-primary">{author?.displayName ?? "Unknown"}</span>
          <span className="text-xs text-text-muted">{new Date(createdAt).toLocaleTimeString()}</span>
          {editedAt && <span className="text-xs text-text-muted">(edited)</span>}
        </div>
        {isEditing ? (
          <div className="mt-1 flex gap-2">
            <input
              autoFocus
              value={editValue}
              onChange={(e) => onChangeEdit(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSaveEdit()}
              className="flex-1 rounded bg-surface-rail px-2 py-1 text-sm text-text-primary outline-none"
            />
            <button onClick={onSaveEdit} className="text-xs text-text-link">
              Save
            </button>
            <button onClick={onCancelEdit} className="text-xs text-text-muted">
              Cancel
            </button>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm text-text-primary">
            <LinkifiedContent content={content} />
          </p>
        )}
      </div>
      {isAuthor && !isEditing && (
        <div className="absolute -top-3 right-2 hidden items-center gap-0.5 rounded-md border border-black/10 bg-surface-sidebar p-0.5 shadow-md group-hover:flex">
          <button
            title="Edit"
            onClick={onStartEdit}
            className="rounded px-1.5 py-1 text-sm text-text-muted hover:bg-surface-modifier hover:text-text-primary"
          >
            ✎
          </button>
          <button
            title="Delete"
            onClick={onDelete}
            className="rounded px-1.5 py-1 text-sm text-text-muted hover:bg-status-danger/20 hover:text-status-danger"
          >
            🗑
          </button>
        </div>
      )}
    </div>
  );
}
