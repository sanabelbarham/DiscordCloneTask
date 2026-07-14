import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import Avatar from "../ui/Avatar";

interface ChannelSidebarProps {
  serverId: Id<"servers">;
  isOwner: boolean;
}

export default function ChannelSidebar({ serverId, isOwner }: ChannelSidebarProps) {
  const channels = useQuery(api.channels.list, { serverId });
  const createChannel = useMutation(api.channels.create);
  const renameChannel = useMutation(api.channels.rename);
  const removeChannel = useMutation(api.channels.remove);
  const [creatingType, setCreatingType] = useState<"text" | "voice" | null>(null);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<Id<"channels"> | null>(null);

  const textChannels = channels?.filter((c) => c.type === "text") ?? [];
  const voiceChannels = channels?.filter((c) => c.type === "voice") ?? [];

  async function handleCreate(type: "text" | "voice") {
    if (!newName.trim()) {
      setCreatingType(null);
      return;
    }
    await createChannel({ serverId, name: newName.trim(), type });
    setNewName("");
    setCreatingType(null);
  }

  function renderSection(title: string, list: NonNullable<typeof channels>, type: "text" | "voice") {
    return (
      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between px-2">
          <h3 className="text-xs font-semibold uppercase text-text-muted">{title}</h3>
          {isOwner && (
            <button
              title={`Add ${type} channel`}
              onClick={() => setCreatingType(type)}
              className="text-text-muted hover:text-text-primary"
            >
              +
            </button>
          )}
        </div>
        {creatingType === type && (
          <input
            autoFocus
            placeholder="new-channel-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={() => void handleCreate(type)}
            onKeyDown={(e) => e.key === "Enter" && void handleCreate(type)}
            className="mb-1 w-full rounded bg-surface-rail px-2 py-1 text-sm text-text-primary outline-none"
          />
        )}
        <ul className="space-y-0.5">
          {list.map((channel) => (
            <li key={channel._id} className="group">
              <div className="flex items-center gap-1 rounded px-2 py-1 hover:bg-surface-modifier">
                {renamingId === channel._id ? (
                  <input
                    autoFocus
                    defaultValue={channel.name}
                    onBlur={async (e) => {
                      if (e.target.value.trim()) {
                        await renameChannel({ channelId: channel._id, name: e.target.value.trim() });
                      }
                      setRenamingId(null);
                    }}
                    className="flex-1 bg-transparent text-sm text-text-primary outline-none"
                  />
                ) : (
                  <NavLink
                    to={type === "text" ? `channels/${channel._id}` : `voice/${channel._id}`}
                    className={({ isActive }) =>
                      `flex-1 truncate text-sm ${isActive ? "text-text-primary" : "text-text-muted"} hover:text-text-primary`
                    }
                  >
                    {type === "text" ? "# " : "🔊 "}
                    {channel.name}
                  </NavLink>
                )}
                {isOwner && renamingId !== channel._id && (
                  <span className="hidden gap-1 group-hover:flex">
                    <button onClick={() => setRenamingId(channel._id)} className="text-xs text-text-muted hover:text-text-primary">
                      ✎
                    </button>
                    <button
                      onClick={() => void removeChannel({ channelId: channel._id })}
                      className="text-xs text-text-muted hover:text-status-danger"
                    >
                      🗑
                    </button>
                  </span>
                )}
              </div>
              {type === "voice" && channel.connectedVoiceUserIds && channel.connectedVoiceUserIds.length > 0 && (
                <VoiceRoster userIds={channel.connectedVoiceUserIds} />
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-2">
      {renderSection("Text Channels", textChannels, "text")}
      {renderSection("Voice Channels", voiceChannels, "voice")}
    </div>
  );
}

function VoiceRoster({ userIds }: { userIds: Id<"users">[] }) {
  return (
    <ul className="ml-6 space-y-0.5 pb-1">
      {userIds.map((userId) => (
        <VoiceRosterMember key={userId} userId={userId} />
      ))}
    </ul>
  );
}

function VoiceRosterMember({ userId }: { userId: Id<"users"> }) {
  const profile = useQuery(api.users.getProfile, { userId });
  if (!profile) return null;
  return (
    <li className="flex items-center gap-2 px-2 text-xs text-text-muted">
      <Avatar avatarUrl={profile.avatarUrl} displayName={profile.displayName} size={16} />
      {profile.displayName}
    </li>
  );
}
