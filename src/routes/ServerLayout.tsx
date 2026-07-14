import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import ChannelSidebar from "../components/layout/ChannelSidebar";
import MemberList from "../components/layout/MemberList";
import InviteLinkPanel from "../components/ui/InviteLinkPanel";

export default function ServerLayout() {
  const { serverId } = useParams<{ serverId: Id<"servers"> }>();
  const servers = useQuery(api.servers.listForUser);
  const profile = useQuery(api.users.getCurrentProfile);
  const renameServer = useMutation(api.servers.rename);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");

  if (!serverId) return null;
  const server = servers?.find((s) => s._id === serverId);
  const isOwner = !!server && !!profile && server.ownerId === profile._id;

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex w-60 shrink-0 flex-col bg-surface-sidebar">
        <div className="flex h-12 items-center justify-between border-b border-black/20 px-3">
          {renaming ? (
            <input
              autoFocus
              defaultValue={server?.name}
              onChange={(e) => setName(e.target.value)}
              onBlur={async () => {
                if (name.trim()) await renameServer({ serverId, name: name.trim() });
                setRenaming(false);
              }}
              className="w-full bg-transparent text-sm font-semibold text-text-primary outline-none"
            />
          ) : (
            <h1 className="truncate text-sm font-semibold text-text-primary">{server?.name}</h1>
          )}
          {isOwner && !renaming && (
            <button
              title="Rename server"
              onClick={() => setRenaming(true)}
              className="text-xs text-text-muted hover:text-text-primary"
            >
              ✎
            </button>
          )}
        </div>
        {isOwner && server && (
          <div className="p-2">
            <InviteLinkPanel serverId={server._id} inviteCode={server.inviteCode} />
          </div>
        )}
        {server && <ChannelSidebar serverId={server._id} isOwner={isOwner} />}
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
      {server && <MemberList serverId={server._id} currentUserId={profile?._id} isOwner={isOwner} />}
    </div>
  );
}
