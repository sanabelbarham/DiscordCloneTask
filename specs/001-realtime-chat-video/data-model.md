# Phase 1 Data Model: Real-Time Chat & Video Community Platform

**Feature**: 001-realtime-chat-video | **Date**: 2026-07-14

**Revision note (post-validation)**: this document was updated after a plan-validation audit. Three
changes from the original design: (1) `callParticipants.isSpeaking` was removed — speaking state is
now computed entirely client-side from live WebRTC audio and never touches the backend; (2)
`messages` and `directMessages` were merged into a single `messages` table (matching the
nullable-dual-FK pattern already used by `calls`/`typingIndicators`) instead of two near-duplicate
tables; (3) `callParticipants` gained a `lastHeartbeatAt` field and a `by_user` index to support
stale-participant cleanup and the removed-member call cascade. See `research.md` §3 and §6 for the
reasoning.

All tables are defined in `convex/schema.ts` via Convex's typed schema builder
(`defineSchema`/`defineTable`), satisfying Type Safety End-to-End. Every table that is queried by
a foreign key has a matching `.index(...)` to avoid full scans, per the small-scale but still
indexed-by-default Convex convention. Table names below match the project's chosen naming:
`users`, `servers`, `serverMembers`, `channels`, `messages`, `directMessageThreads`,
`typingIndicators`, `presence`, `calls`, `callParticipants`, `signals`.

## users

Convex Auth's `authTables` already defines a `users` table (credentials/identity plumbing for the
password provider); this project's `convex/schema.ts` extends that table's fields with the
app-specific display data required by the spec, rather than introducing a separate `profiles`
table — one row per account, no join needed to render a name/avatar.

| Field | Type | Notes |
|---|---|---|
| `email` | `string` | provided by Convex Auth's password provider |
| `displayName` | `string` | required, editable (FR-003) |
| `avatarUrl` | `string` | required, editable (FR-003) |

**Indexes**: Convex Auth manages its own lookup index for the password provider; no additional
index needed for this table's app-specific fields (looked up only by `Id<"users">`, never
scanned).

## presence

Separate from `users` so the high-frequency heartbeat write never touches (or invalidates
reactive subscriptions on) profile data — editing a display name and heartbeating are
independent, unrelated write paths.

| Field | Type | Notes |
|---|---|---|
| `userId` | `Id<"users">` | required, unique |
| `lastSeen` | `number` (ms epoch) | updated by a client heartbeat mutation (research.md §2) |

**Indexes**: `by_userId` on `userId`.

**Derived state**: `isOnline = Date.now() - lastSeen < ONLINE_THRESHOLD_MS` — never stored, always
computed at read time so it can't go stale independent of `lastSeen` (FR-004).

## servers

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | required, renameable by owner (FR-008) |
| `imageUrl` | `string?` | optional (FR-005) |
| `ownerId` | `Id<"users">` | set at creation, immutable in v1 (no ownership transfer — Assumptions) |
| `inviteCode` | `string` | unique, regenerable by owner (Assumptions); used to build the invite link |

**Indexes**: `by_inviteCode` on `inviteCode` (invite-link lookup); `by_ownerId` on `ownerId`.

**Validation rules**: `name` non-empty. Only `ownerId` may rename, regenerate invite, delete
channels, or remove members (FR-008, FR-009, FR-012).

## serverMembers

Join entity between `users` and `servers`. A user's role is derived, not a free-form field:
`role = server.ownerId === userId ? "owner" : "member"` — computed to avoid a second source of
truth that could drift from `servers.ownerId`.

| Field | Type | Notes |
|---|---|---|
| `serverId` | `Id<"servers">` | required |
| `userId` | `Id<"users">` | required |
| `joinedAt` | `number` (ms epoch) | set on join |

**Indexes**: `by_server` on `serverId` (member-list sidebar, FR-007); `by_user` on `userId`
(list of servers a user belongs to); `by_server_and_user` on `[serverId, userId]` (uniqueness
check + fast membership/authorization lookup — used by nearly every server-scoped function per
Security Basics).

**Validation rules**: unique `(serverId, userId)` pair. Deleting a membership (owner removes a
member, FR-009) cascades in the same mutation, not via a separate cleanup job:
1. The `serverMembers` row is deleted, immediately revoking every subsequent membership-checked
   read/mutation for that user in this server (channels, messages, invite re-use, etc.).
2. Using `callParticipants.by_user` (see **callParticipants** below), the mutation finds every
   active call the removed user currently participates in, filters to calls whose `channelId`
   belongs to *this* server (join through **channels** `serverId`), and deletes those
   `callParticipants` rows — ending the call for that user immediately rather than on next page
   load (Edge Cases). If that leaves a call with zero participants, the `calls` row is deleted too,
   per the same "last participant leaves ends the call" rule used by `calls.leave`.
3. Deleting those `callParticipants` rows is what the reactive call-teardown mechanism (below,
   and research.md §3) hooks into: every remaining participant's `calls.listParticipants`
   subscription updates, their client's roster-diff logic sees the removed user vanish, and closes
   the corresponding `RTCPeerConnection`. The removed user's own still-open client observes the
   same disappearance (it is no longer in the roster it is/was subscribed to) and tears down its
   own peer connections and redirects out (data-model cross-reference: `contracts/api.md`
   `servers.removeMember`).

## channels

| Field | Type | Notes |
|---|---|---|
| `serverId` | `Id<"servers">` | required |
| `name` | `string` | required, renameable by owner (FR-012) |
| `type` | `"text" \| "voice"` | required, immutable after creation |
| `isDefault` | `boolean` | true only for the auto-created "general" channel (FR-010) |
| `createdAt` | `number` (ms epoch) | |

**Indexes**: `by_server` on `serverId` (channel list, FR-011); `by_server_and_type` on
`[serverId, type]` (voice-channel-only queries for the call roster, FR-029).

**Validation rules**: `name` non-empty. Deleting a channel cascades within the same mutation:
1. All `messages` with that `channelId` are deleted (FR-013).
2. If `type === "voice"` and an active `calls` row exists for it (looked up via
   `calls.by_channel`): every `callParticipants` row for that call is deleted, then the `calls`
   row itself is deleted (force-ending the call), and only then is the `channels` row deleted
   (FR-031).
3. Because the `channels` row is gone, every client's `channels.list` subscription for this server
   updates and no longer contains this channel. A client currently on that voice channel's page
   detects the channel's disappearance from `channels.list` as its "this channel was deleted"
   signal (rather than a separate notification table) — it closes every open `RTCPeerConnection`,
   stops local media tracks, shows a notice, and navigates away (Edge Cases, FR-031; see
   `contracts/api.md` `channels.remove`).

**State transitions**: none beyond create/rename/delete — voice channels' "busy/idle" state is
derived from whether a `calls` row currently references them (see **calls** below), not stored on
the channel.

## messages

Single table for both channel text messages and direct-message content — exactly one of
`channelId`/`threadId` is set per row, mirroring the nullable-dual-FK pattern already used by
`calls` and `typingIndicators` below, rather than duplicating the full CRUD surface (send/edit/
remove/list/typing) across two nearly-identical tables and function files. `directMessageThreads`
(below) still exists as its own table because it holds thread-level metadata (which two users,
when the thread was created) that has no channel equivalent — only the *messages* themselves are
unified.

| Field | Type | Notes |
|---|---|---|
| `channelId` | `Id<"channels">?` | set for a channel message |
| `threadId` | `Id<"directMessageThreads">?` | set for a direct message |
| `authorId` | `Id<"users">` | required |
| `content` | `string` | required, non-empty |
| `createdAt` | `number` (ms epoch) | |
| `editedAt` | `number?` (ms epoch) | present iff the message has been edited (FR-018) |

**Indexes**: `by_channel` on `[channelId, createdAt]` (paginated newest-first fetch for channels,
FR-019, research.md §4); `by_thread` on `[threadId, createdAt]` (same pattern for DMs, FR-023).

**Validation rules**: exactly one of `channelId`/`threadId` set per row (enforced in the
`send` mutation, not declaratively — Convex schema validators don't express "exactly one of");
`content` non-empty; only `authorId === caller` may update/delete a given row (FR-017, FR-023);
on update, `editedAt` is set to now (FR-018); the UI treats presence of `editedAt` as the "edited"
indicator, so no separate boolean is needed. Authorization otherwise branches on which FK is set:
a channel message requires the caller to be a member of the channel's server; a direct message
requires the caller to be a participant of `threadId`.

## directMessageThreads

A DM thread between exactly two users who share at least one server at creation time (FR-021,
FR-022). Membership is not re-validated after creation (spec does not require revoking an
existing DM if the users later stop sharing a server — only creation is gated). Holds thread
metadata only; the messages inside a thread live in the shared **messages** table above via
`threadId`.

| Field | Type | Notes |
|---|---|---|
| `participantA` | `Id<"users">` | required; stored as the lower of the two IDs for a stable pair key |
| `participantB` | `Id<"users">` | required; the higher of the two IDs |
| `createdAt` | `number` (ms epoch) | |

**Indexes**: `by_pair` on `[participantA, participantB]` (idempotent "open or create" lookup,
FR-021 — "existing one is opened"); `by_participantA` and `by_participantB` (list a user's DM
threads).

**Validation rules**: `participantA !== participantB` (no self-DM, Edge Cases); at creation time,
the two users must share at least one active `serverMembers` row on the same `serverId`, checked
via `by_server` + `by_user` index lookups (FR-022).

## typingIndicators

Shared table for both channel and DM typing state — exactly one of `channelId`/`threadId` is set
per row (the same pattern `messages` above now also follows).

| Field | Type | Notes |
|---|---|---|
| `channelId` | `Id<"channels">?` | set for channel typing |
| `threadId` | `Id<"directMessageThreads">?` | set for DM typing |
| `userId` | `Id<"users">` | required |
| `updatedAt` | `number` (ms epoch) | refreshed by debounced client mutation while composing |

**Indexes**: `by_channel` on `channelId`; `by_thread` on `threadId`.

**Validation rules**: exactly one of `channelId`/`threadId` set; unique `(channelId or threadId,
userId)`; a row is considered "typing" by the reader only while `Date.now() - updatedAt < 3000`
(research.md §5) — stale rows are simply ignored at read time (and may be opportunistically
deleted on the next heartbeat/write) rather than requiring a dedicated cleanup job, per the
"cleaned up when stale" requirement.

## calls

An active voice/video session. At most one active `calls` row may exist per voice `channelId`, or
per `threadId` for DM calls — enforced by checking-then-inserting inside a single mutation
(Convex mutations are transactional), not by a uniqueness index (Convex indexes don't enforce
uniqueness).

| Field | Type | Notes |
|---|---|---|
| `channelId` | `Id<"channels">?` | set for voice-channel calls |
| `threadId` | `Id<"directMessageThreads">?` | set for DM calls |
| `startedAt` | `number` (ms epoch) | |

**Indexes**: `by_channel` on `channelId`; `by_thread` on `threadId`.

**Validation rules**: exactly one of `channelId`/`threadId` set. A call row is deleted when its
last `callParticipants` row is removed (Edge Cases: "only participant leaves ends the call"),
when its channel is deleted (FR-031, cascades from **channels**), or when the last non-stale
participant is reaped by the heartbeat/join-time cleanup below.

## callParticipants

| Field | Type | Notes |
|---|---|---|
| `callId` | `Id<"calls">` | required |
| `userId` | `Id<"users">` | required |
| `micOn` | `boolean` | toggle, default `true` on join (FR-026) |
| `cameraOn` | `boolean` | toggle, default `true` on join (FR-026) |
| `lastHeartbeatAt` | `number` (ms epoch) | refreshed by a client heartbeat mutation every ~5s while connected; drives stale-participant cleanup (research.md §6) |
| `joinedAt` | `number` (ms epoch) | |

Speaking state (FR-027's "who is currently speaking") is **not** stored here. It is computed
entirely client-side from the live remote `MediaStream` of each connected peer (Web Audio
`AnalyserNode` on the already-flowing WebRTC audio track) and rendered locally — piping it through
a Convex table and reactive query would relay data that already arrives directly over the
peer-to-peer media connection, an unnecessary hop per Simplicity First (see research.md §3 and the
validation report that flagged the original `isSpeaking` field).

**Indexes**: `by_call` on `callId` (roster + capacity check, FR-024, FR-025); `by_call_and_user`
on `[callId, userId]` (uniqueness + fast toggle-mutation authorization); `by_user` on `userId`
(finds every call a given user currently participates in, regardless of call — used by the
`servers.removeMember` cascade above and by client-side "am I still in a call" checks).

**Validation rules**: unique `(callId, userId)`; only the row's own `userId === caller` may update
its `micOn`/`cameraOn`/`lastHeartbeatAt` (Security Basics — no participant can toggle or heartbeat
on another's behalf). Stale-participant handling (research.md §6):
- `calls.join` deletes any `callParticipants` row under the target `callId` whose
  `lastHeartbeatAt` is older than the stale threshold (~15s) *before* checking the 4-participant
  capacity, so a crashed participant's ghost row can never block a real join (FR-025, Edge Cases).
- `calls.listParticipants` excludes rows whose `lastHeartbeatAt` is stale, so a crashed
  participant disappears from every other client's roster (and triggers peer-connection teardown)
  without needing an explicit "leave".
- `calls.heartbeat` (bumping the caller's own row) also opportunistically deletes any *other*
  stale rows in the same call, which is what actually drives a fully-abandoned call's row count to
  zero so the `calls` row itself gets deleted.

## signals

WebRTC mesh signaling relay (research.md §3) — ephemeral, consumed-then-deleted rows, not a
durable record of call history. Replaces a Socket.io signaling server. Which side of a pair sends
the initial `offer` is not random: it is the participant whose `Id<"users">` sorts lower (research.md
§3's deterministic offerer rule), so at most one `offer` row is ever created per pair regardless of
join timing.

| Field | Type | Notes |
|---|---|---|
| `callId` | `Id<"calls">` | required |
| `fromUserId` | `Id<"users">` | required |
| `toUserId` | `Id<"users">` | required |
| `type` | `"offer" \| "answer" \| "ice-candidate"` | required |
| `payload` | `string` | JSON-encoded SDP or `RTCIceCandidateInit` |
| `createdAt` | `number` (ms epoch) | |

**Indexes**: `by_recipient` on `[callId, toUserId]` (each peer subscribes only to signals
addressed to it).

**Validation rules**: only `fromUserId === caller` may insert a row; only `toUserId === caller`
may delete (consume) a row; both `fromUserId` and `toUserId` must be current `callParticipants`
of `callId` (Security Basics — no signaling with a non-participant).

## Entity relationship summary

```text
users (Convex Auth, extended) 1───1 presence
users 1───* serverMembers *───1 servers
servers 1───* channels
channels 1───* messages (channelId)
users 1───* directMessageThreads (as participantA or participantB)
directMessageThreads 1───* messages (threadId)
channels (type=voice) 0───1 calls          directMessageThreads 0───1 calls
calls 1───* callParticipants *───1 users
calls 1───* signals
channels 1───* typingIndicators           directMessageThreads 1───* typingIndicators
```
