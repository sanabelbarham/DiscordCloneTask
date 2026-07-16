import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import Avatar from "../components/ui/Avatar";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import PresenceDot from "../components/ui/PresenceDot";

type Tab = "friends" | "requests" | "add";

export default function FriendsPage() {
  const [tab, setTab] = useState<Tab>("friends");
  const incoming = useQuery(api.friends.listIncomingRequests);
  const pendingCount = incoming?.length ?? 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-4 border-b border-black/20 px-4">
        <h1 className="text-sm font-semibold text-text-primary">Friends</h1>
        <nav className="flex gap-1">
          {(["friends", "requests", "add"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1 text-sm capitalize ${
                tab === t ? "bg-surface-modifier text-text-primary" : "text-text-muted hover:text-text-primary"
              }`}
            >
              {t === "add" ? "Add Friend" : t}
              {t === "requests" && pendingCount > 0 && (
                <span className="ml-1 rounded-full bg-status-danger px-1.5 text-xs text-white">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {tab === "friends" && <FriendsTab />}
        {tab === "requests" && <RequestsTab />}
        {tab === "add" && <AddFriendTab />}
      </div>
    </div>
  );
}

function FriendsTab() {
  const friends = useQuery(api.friends.listFriends);
  const removeFriend = useMutation(api.friends.removeFriend);
  const openOrCreateThread = useMutation(api.directMessages.openOrCreateThread);
  const navigate = useNavigate();

  async function openDm(otherUserId: Id<"users">) {
    const threadId = await openOrCreateThread({ otherUserId });
    navigate(`/dm/${threadId}`);
  }

  if (friends && friends.length === 0) {
    return <p className="text-sm text-text-muted">No friends yet — try "Add Friend".</p>;
  }

  return (
    <ul className="space-y-1">
      {friends?.map((f) => (
        <li
          key={f.requestId}
          className="group flex items-center gap-3 rounded px-2 py-2 hover:bg-surface-modifier"
        >
          <div className="relative">
            <Avatar avatarUrl={f.otherUser!.avatarUrl} displayName={f.otherUser!.displayName} size={32} />
            <PresenceDot userId={f.otherUser!._id} className="absolute -bottom-0.5 -right-0.5" />
          </div>
          <span className="flex-1 text-sm text-text-primary">{f.otherUser!.displayName}</span>
          <Button variant="secondary" onClick={() => void openDm(f.otherUser!._id)}>
            Message
          </Button>
          <button
            title="Remove friend"
            onClick={() => void removeFriend({ friendUserId: f.otherUser!._id })}
            className="hidden text-xs text-status-danger group-hover:block"
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}

function RequestsTab() {
  const incoming = useQuery(api.friends.listIncomingRequests);
  const outgoing = useQuery(api.friends.listOutgoingRequests);
  const respond = useMutation(api.friends.respondToFriendRequest);
  const cancel = useMutation(api.friends.cancelFriendRequest);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase text-text-muted">
          Incoming — {incoming?.length ?? 0}
        </h2>
        <ul className="space-y-1">
          {incoming?.map((r) => (
            <li key={r.requestId} className="flex items-center gap-3 rounded px-2 py-2 hover:bg-surface-modifier">
              <Avatar avatarUrl={r.otherUser!.avatarUrl} displayName={r.otherUser!.displayName} size={32} />
              <span className="flex-1 text-sm text-text-primary">{r.otherUser!.displayName}</span>
              <Button onClick={() => void respond({ requestId: r.requestId, accept: true })}>Accept</Button>
              <Button variant="secondary" onClick={() => void respond({ requestId: r.requestId, accept: false })}>
                Decline
              </Button>
            </li>
          ))}
          {incoming?.length === 0 && <p className="px-2 text-sm text-text-muted">No incoming requests.</p>}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase text-text-muted">
          Sent — {outgoing?.length ?? 0}
        </h2>
        <ul className="space-y-1">
          {outgoing?.map((r) => (
            <li key={r.requestId} className="flex items-center gap-3 rounded px-2 py-2 hover:bg-surface-modifier">
              <Avatar avatarUrl={r.otherUser!.avatarUrl} displayName={r.otherUser!.displayName} size={32} />
              <span className="flex-1 text-sm text-text-primary">{r.otherUser!.displayName}</span>
              <Button variant="secondary" onClick={() => void cancel({ requestId: r.requestId })}>
                Cancel
              </Button>
            </li>
          ))}
          {outgoing?.length === 0 && <p className="px-2 text-sm text-text-muted">No pending sent requests.</p>}
        </ul>
      </section>
    </div>
  );
}

const RELATIONSHIP_LABEL: Record<string, string> = {
  friends: "Friends",
  incoming: "Respond in Requests",
  outgoing: "Request Sent",
};

function AddFriendTab() {
  const [search, setSearch] = useState("");
  const results = useQuery(api.friends.searchUsers, { search });
  const sendFriendRequest = useMutation(api.friends.sendFriendRequest);

  return (
    <div>
      <label className="block text-sm text-text-muted">
        Search by display name
        <Input
          className="mt-1"
          placeholder="Search by display name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <ul className="mt-4 space-y-1">
        {results?.map((u) => (
          <li key={u.userId} className="flex items-center gap-3 rounded px-2 py-2 hover:bg-surface-modifier">
            <Avatar avatarUrl={u.avatarUrl} displayName={u.displayName} size={32} />
            <span className="flex-1 text-sm text-text-primary">{u.displayName}</span>
            {u.relationship === "none" ? (
              <Button onClick={() => void sendFriendRequest({ toUserId: u.userId })}>Add Friend</Button>
            ) : (
              <span className="text-xs text-text-muted">{RELATIONSHIP_LABEL[u.relationship]}</span>
            )}
          </li>
        ))}
        {search.trim() && results?.length === 0 && (
          <p className="px-2 text-sm text-text-muted">No users match "{search}".</p>
        )}
      </ul>
    </div>
  );
}
