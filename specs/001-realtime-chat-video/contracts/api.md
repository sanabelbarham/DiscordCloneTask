# Phase 1 Contracts: Convex Function API

**Feature**: 001-realtime-chat-video | **Date**: 2026-07-14

**Revision note (post-validation)**: `messages.ts` now serves both channel and direct messages
(the old `directMessages.ts` message-CRUD functions were merged in); `directMessages.ts` now only
manages thread lifecycle. `calls.ts` gained `heartbeat` and lost `setSpeaking` (speaking state is
client-only — see `research.md` §3). `servers.removeMember` and `channels.remove` now document
their call-cascade behavior explicitly. See `data-model.md` for the underlying schema changes.

This project has no separately hosted REST/GraphQL API — the "interface" it exposes is the set of
typed Convex queries/mutations/actions called from the Vite/React client via generated `api.*`
references (`convex/_generated/api`). Each function below is the contract boundary. Every one
MUST perform the two checks required by Security Basics before touching data:

1. **Authenticate**: `const identity = await ctx.auth.getUserIdentity(); if (!identity) throw new Error("Unauthorized");`
2. **Authorize**: verify the caller has the specific relationship to the resource noted under
   "Auth" for that function (e.g. "caller is a member of `serverId`") — via the
   `by_server_and_user` / `by_call_and_user` indexes defined in `data-model.md`.

Argument/return shapes are given as TypeScript-like signatures; exact Convex `v.*` validators are
defined at implementation time in each file under `convex/`.

## users.ts

| Function | Kind | Args | Returns | Auth |
|---|---|---|---|---|
| `getCurrentProfile` | query | `{}` | `User` | caller only |
| `updateProfile` | mutation | `{ displayName?: string; avatarUrl?: string }` | `void` | caller updates own `users` row only |
| `getProfile` | query | `{ userId: Id<"users"> }` | `User` | any authenticated user (profile is visible to all, FR-004) |

## presence.ts

| Function | Kind | Args | Returns | Auth |
|---|---|---|---|---|
| `heartbeat` | mutation | `{}` | `void` | caller updates own `presence.lastSeen` only |
| `getStatus` | query | `{ userId: Id<"users"> }` | `{ isOnline: boolean }` | any authenticated user; computed from `lastSeen` staleness (FR-004) |

## servers.ts

| Function | Kind | Args | Returns | Auth |
|---|---|---|---|---|
| `create` | mutation | `{ name: string; imageUrl?: string }` | `Id<"servers">` | any authenticated user; caller becomes owner + first `serverMembers` row (FR-005) |
| `rename` | mutation | `{ serverId: Id<"servers">; name: string }` | `void` | caller is `servers.ownerId` (FR-008) |
| `regenerateInvite` | mutation | `{ serverId: Id<"servers"> }` | `{ inviteCode: string }` | caller is owner |
| `joinByInvite` | mutation | `{ inviteCode: string }` | `Id<"servers">` | any authenticated user; no-op if already a member (Edge Cases) (FR-006) |
| `listMembers` | query | `{ serverId: Id<"servers"> }` | `Array<{ userId, displayName, avatarUrl, isOnline, role }>` | caller is a member of `serverId` (FR-007) |
| `removeMember` | mutation | `{ serverId: Id<"servers">; userId: Id<"users"> }` | `void` | caller is owner; cannot remove self/owner. Cascades in the same mutation: deletes the `serverMembers` row (revoking channel/message access immediately), then uses `callParticipants.by_user` to find any active call the removed user is in whose `channelId` belongs to this server, deletes their `callParticipants` row there (ending the call for them and, if they were last, deleting the `calls` row), so remaining participants' `calls.listParticipants` subscription drops them and tears down the corresponding `RTCPeerConnection` (FR-009, Edge Cases; data-model.md §serverMembers) |
| `listForUser` | query | `{}` | `Array<Server>` | caller only, filtered to their `serverMembers` rows |

## channels.ts

| Function | Kind | Args | Returns | Auth |
|---|---|---|---|---|
| `list` | query | `{ serverId: Id<"servers"> }` | `Array<Channel & { connectedVoiceUserIds?: Id<"users">[] }>` | caller is a member (FR-011); voice channels include current (non-stale) `callParticipants` roster (FR-029). A channel's disappearance from this list is the client's signal that it was deleted, including mid-call (FR-031). |
| `create` | mutation | `{ serverId: Id<"servers">; name: string; type: "text" \| "voice" }` | `Id<"channels">` | caller is owner (FR-012) |
| `rename` | mutation | `{ channelId: Id<"channels">; name: string }` | `void` | caller is owner of the channel's server |
| `remove` | mutation | `{ channelId: Id<"channels"> }` | `void` | caller is owner. Cascades in the same mutation: deletes all `messages` for the channel (FR-013); if the channel is `type: "voice"` and has an active `calls` row (via `calls.by_channel`), deletes every `callParticipants` row for that call, then the `calls` row itself, force-ending the call (FR-031) — only then is the `channels` row deleted, so every subscriber's `channels.list` update and the call-teardown happen from the same write |

## messages.ts

Single function set serving both channel messages and direct messages — every function takes
*either* `channelId` *or* `threadId` (never both), matching the merged `messages` table in
`data-model.md`.

| Function | Kind | Args | Returns | Auth |
|---|---|---|---|---|
| `list` | query | `{ channelId?: Id<"channels">; threadId?: Id<"directMessageThreads">; paginationOpts: PaginationOptions }` | `PaginationResult<Message>` | exactly one of `channelId`/`threadId` required; caller is a member of the channel's server, or a participant of the thread; newest-first (FR-019, FR-023) |
| `send` | mutation | `{ channelId?: Id<"channels">; threadId?: Id<"directMessageThreads">; content: string }` | `Id<"messages">` | same as `list` (FR-014, FR-023) |
| `edit` | mutation | `{ messageId: Id<"messages">; content: string }` | `void` | caller is `messages.authorId` (FR-017, FR-018, FR-023) |
| `remove` | mutation | `{ messageId: Id<"messages"> }` | `void` | caller is author (FR-017, FR-023) |
| `setTyping` | mutation | `{ channelId?: Id<"channels">; threadId?: Id<"directMessageThreads"> }` | `void` | exactly one required; caller is a member/participant; refreshes `typingIndicators.updatedAt` (FR-020) |
| `listTyping` | query | `{ channelId?: Id<"channels">; threadId?: Id<"directMessageThreads"> }` | `Array<{ userId, displayName }>` | exactly one required; caller is a member/participant; filters to `updatedAt` within threshold |

## directMessages.ts

Thread lifecycle only — sending/editing/removing/typing on messages *inside* a thread go through
`messages.ts` above with `threadId` set.

| Function | Kind | Args | Returns | Auth |
|---|---|---|---|---|
| `openOrCreateThread` | mutation | `{ otherUserId: Id<"users"> }` | `Id<"directMessageThreads">` | caller and `otherUserId` share ≥1 server (FR-021, FR-022); rejects self-DM |
| `listThreadsForUser` | query | `{}` | `Array<DirectMessageThread & { otherUser: User }>` | caller only |

## calls.ts

| Function | Kind | Args | Returns | Auth |
|---|---|---|---|---|
| `join` | mutation | `{ channelId?: Id<"channels">; threadId?: Id<"directMessageThreads"> }` | `{ callId: Id<"calls">; participants: Id<"users">[] }` | caller is a server member (voice channel) or thread participant (DM). Before checking capacity, deletes any stale (`lastHeartbeatAt` older than threshold) `callParticipants` rows for the target call so ghost participants can't occupy a slot; rejects with `"CALL_FULL"` if 4 live participants remain after that cleanup (FR-024, FR-025, Edge Cases). Returns the (post-cleanup) participant list so the joining client knows who to send offers to (research.md §3) |
| `leave` | mutation | `{ callId: Id<"calls"> }` | `void` | caller is a current participant; deletes `calls` row if last participant (FR-028, Edge Cases) |
| `heartbeat` | mutation | `{ callId: Id<"calls"> }` | `void` | caller updates own `callParticipants.lastHeartbeatAt` only; opportunistically deletes any *other* stale `callParticipants` rows in the same call (research.md §6) |
| `setMediaState` | mutation | `{ callId: Id<"calls">; micOn?: boolean; cameraOn?: boolean }` | `void` | caller updates own `callParticipants` row only (FR-026) |
| `listParticipants` | query | `{ callId: Id<"calls"> }` | `Array<{ userId, displayName, avatarUrl, micOn, cameraOn }>` | any authenticated user (not gated to current participants — `channels.list` already exposes this same roster to every server member, and the removed-user's own client relies on this query continuing to succeed, just without their own row, to detect a mid-call removal without React error-boundary plumbing around a thrown `FORBIDDEN`); excludes rows whose `lastHeartbeatAt` is stale (research.md §6). Speaking state is not returned here — it's computed and rendered entirely client-side from each peer's live audio (research.md §3) |

## signals.ts

| Function | Kind | Args | Returns | Auth |
|---|---|---|---|---|
| `send` | mutation | `{ callId: Id<"calls">; toUserId: Id<"users">; type: "offer" \| "answer" \| "ice-candidate"; payload: string }` | `void` | caller and `toUserId` are both current `callParticipants` of `callId`. Who sends the first `offer` for a given pair is not caller's choice — it's whichever side has the lower `Id<"users">` per the deterministic offerer rule (research.md §3); the other side only ever sends `answer`/`ice-candidate` first |
| `listForMe` | query | `{ callId: Id<"calls"> }` | `Array<Signal>` | caller only sees rows where `toUserId === caller`; drives the peer-discovery roster-diff loop (research.md §3) |
| `consume` | mutation | `{ signalId: Id<"signals"> }` | `void` | caller is the signal's `toUserId`; deletes the row after applying it locally |

## Cross-cutting error contract

All authorization failures throw a `ConvexError` with a stable `code` field
(`"UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CALL_FULL"`) so the client can render a
specific message (e.g. "This voice channel is full") rather than a generic failure, per FR-031 and
the Edge Cases requiring a full-channel join to be clearly communicated. A caller whose access was
revoked mid-session (removed from the server, or their voice channel was deleted) simply starts
receiving `FORBIDDEN`/empty results from the membership-checked queries/mutations above — no
separate "you were removed" push message is needed; the client infers it from those results (see
`channels.list` and `calls.listParticipants` notes above).
