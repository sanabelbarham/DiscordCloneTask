import { useQuery } from "convex/react";
import { NavLink } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import Avatar from "../ui/Avatar";

export default function DirectMessageList() {
  const threads = useQuery(api.directMessages.listThreadsForUser);

  return (
    <aside className="w-60 shrink-0 overflow-y-auto bg-surface-sidebar p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase text-text-muted">Direct Messages</h3>
      <ul className="space-y-0.5">
        {threads?.map((thread) => (
          <li key={thread._id}>
            <NavLink
              to={`/dm/${thread._id}`}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
                  isActive ? "bg-surface-modifier text-text-primary" : "text-text-muted hover:bg-surface-modifier/60"
                }`
              }
            >
              <Avatar
                avatarUrl={thread.otherUser?.avatarUrl ?? ""}
                displayName={thread.otherUser?.displayName ?? "?"}
                size={24}
              />
              <span className="truncate">{thread.otherUser?.displayName ?? "Unknown"}</span>
            </NavLink>
          </li>
        ))}
        {threads?.length === 0 && (
          <li className="px-2 text-xs text-text-muted">No conversations yet.</li>
        )}
      </ul>
    </aside>
  );
}
