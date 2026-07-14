import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import Avatar from "../ui/Avatar";
import PresenceDot from "../ui/PresenceDot";

interface MemberListProps {
  serverId: Id<"servers">;
  currentUserId: Id<"users"> | undefined;
  isOwner: boolean;
}

export default function MemberList({ serverId, currentUserId, isOwner }: MemberListProps) {
  const members = useQuery(api.servers.listMembers, { serverId });
  const removeMember = useMutation(api.servers.removeMember);
  const openOrCreateThread = useMutation(api.directMessages.openOrCreateThread);
  const navigate = useNavigate();

  async function openDm(otherUserId: Id<"users">) {
    const threadId = await openOrCreateThread({ otherUserId });
    navigate(`/dm/${threadId}`);
  }

  return (
    <aside className="w-sidebar shrink-0 overflow-y-auto bg-surface-sidebar p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase text-text-muted">
        Members — {members?.length ?? 0}
      </h3>
      <ul className="space-y-1">
        {members?.map((member) => (
          <li
            key={member.userId}
            className="group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-surface-modifier"
          >
            <div className="relative">
              <Avatar avatarUrl={member.avatarUrl} displayName={member.displayName} size={28} />
              <PresenceDot
                userId={member.userId}
                className="absolute -bottom-0.5 -right-0.5"
              />
            </div>
            <span className="flex-1 truncate text-sm text-text-primary">
              {member.displayName}
              {member.role === "owner" && (
                <span className="ml-1 text-xs text-text-muted">(owner)</span>
              )}
            </span>
            {member.userId !== currentUserId && (
              <button
                title="Message"
                onClick={() => void openDm(member.userId)}
                className="hidden text-xs text-text-link group-hover:block"
              >
                DM
              </button>
            )}
            {isOwner && member.userId !== currentUserId && member.role !== "owner" && (
              <button
                title="Remove member"
                onClick={() => void removeMember({ serverId, userId: member.userId })}
                className="hidden text-xs text-status-danger group-hover:block"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
