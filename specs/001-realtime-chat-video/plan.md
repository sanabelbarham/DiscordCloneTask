# Implementation Plan: Real-Time Chat & Video Community Platform

**Branch**: `001-realtime-chat-video` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Revision note (post-validation)**: this plan was updated after a validation audit found five
gaps against the constitution and spec: server-side speaking-state tracking that duplicated data
already available client-side; duplicated CRUD logic between `messages`/`directMessages`; no
handling for removing a member mid-call; no handling for deleting a voice channel mid-call; and no
cleanup for crashed/disconnected call participants. All five are resolved below and in
`research.md`, `data-model.md`, `contracts/api.md`, and `tasks.md`.

## Summary

A Discord-style community platform: users sign up/log in and see each other's presence; any
user can create a server, invite others, and manage a member roster; every server ships with
real-time text channels (default "general" plus owner-managed extras) where members chat with
live edit/delete/typing/infinite-scroll; any two users sharing a server can DM each other with the
same behavior (served by the same `messages` table and function set as channels, distinguished by
`channelId` vs `threadId`); and members can join a voice channel (or a DM) for a live voice/video
call with up to 4 participants, with mic/camera toggles, client-computed speaking indicators, and
live presence in the channel list.

Technical approach: a single Vite-built React 18 SPA (TypeScript strict, client-side routing via
React Router) backed by **Convex** as the sole backend — its typed schema and reactive queries
satisfy the constitution's Type Safety and Real-Time Correctness principles simultaneously,
without hand-building a WebSocket layer or ORM. Authentication uses Convex Auth's built-in
email/password provider mounted client-side (`ConvexAuthProvider`), so no separate auth vendor is
introduced and no server runtime is required beyond Convex itself. Voice/video uses direct browser
WebRTC (mesh topology, no SFU/media server), with signaling messages exchanged as Convex
mutations/subscriptions via a `signals` table — reusing the already-required realtime layer
instead of adding a second one. Which side of a peer pair sends the first offer is deterministic
(lower `Id<"users">` string always offers, per `research.md` §3), removing the offer-glare race a
naive "caller sends offer" rule would leave unresolved; call-participant liveness is tracked via
the same heartbeat + staleness pattern already used for presence and typing (`research.md` §6),
so crashed participants are reaped without a cron job; and speaking-state is computed entirely
client-side from each peer's live audio rather than round-tripped through the backend. This keeps
the dependency set to the minimum needed to satisfy every functional requirement, per Simplicity
First.

## Technical Context

**Language/Version**: TypeScript 5.x, strict mode, Node.js 20 LTS

**Primary Dependencies**: Vite 5 + React 18 + React Router 6 (client-side SPA routing); Convex
(typed schema, queries, mutations, actions, built-in Convex Auth); Tailwind CSS for styling
(Discord-like dark theme, no component library); native browser WebRTC APIs for voice/video (no
external call SDK)

**Storage**: Convex's built-in document database, accessed exclusively through the typed schema
defined in `convex/schema.ts` (satisfies Type Safety End-to-End — no untyped queries)

**Testing**: Vitest for unit tests of business logic (Convex functions and client-side non-UI
logic, per Testable Seams); Playwright for the two constitution-mandated smoke tests (send a
message end-to-end, join a voice/video call end-to-end)

**Target Platform**: Modern desktop web browsers (Chrome/Edge/Firefox current versions), served as
a static Vite build (client-only SPA, no server-rendering); responsive layout is a stretch goal,
not a requirement — mobile apps are explicitly out of scope (spec Assumptions)

**Project Type**: Web application — single-page client (Vite/React/React Router) + realtime
backend-as-functions (Convex), single repository, no separately hosted API server

**Performance Goals**: Message delivery visible to other members within 1s (SC-002); presence
updates within 5s (SC-005); voice/video call join-to-audio under 5s (SC-008)

**Constraints**: TypeScript strict everywhere, no `any` (Type Safety End-to-End); all real-time UI
driven by subscriptions, never polling (Real-Time Correctness); every Convex function that touches
a server/channel/message/call resource verifies the caller is authenticated AND authorized for
that specific resource (Security Basics); no dependency added beyond what's listed above without
updating this plan (Simplicity First)

**Scale/Scope**: Demo/classroom scale — at least 10 concurrent users, a handful of servers, a few
members each (per spec Clarifications, session 2026-07-14); voice/video calls support at least 2
and target/cap at 4 simultaneous participants per call (FR-025)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Initial Check | Post-Design Check (after Phase 1) |
|---|---|---|---|
| I. Simplicity First | No dependency beyond Vite, React, React Router, Convex, Tailwind, native WebRTC, Vitest, Playwright; no speculative abstractions; no component library | PASS — stack chosen specifically to avoid extra layers (Convex replaces a hand-rolled DB+WebSocket+ORM stack; mesh WebRTC avoids an SFU service; Vite SPA avoids a server-rendering runtime the app doesn't need; Tailwind-only components avoid a UI library dependency) | PASS — `data-model.md`/`research.md` introduce zero new dependencies; presence, typing, and WebRTC signaling are all hand-rolled Convex tables rather than the optional `@convex-dev/presence` package, TURN provisioning is explicitly deferred rather than added, and route guarding uses React Router's own primitives (no auth-routing library). Post-validation, two designs were simplified further rather than made more complex: speaking state was moved off the backend entirely (client-side audio analysis, no table/mutation/query for it), and `messages`/`directMessages` were merged into one table + function set instead of duplicating CRUD across two |
| II. Real-Time Correctness | All live UI (presence, messages, typing, channel list, call roster) MUST be Convex reactive queries, never polling | PASS — Convex `useQuery` is subscription-based by design; no polling anywhere in the design | PASS — every read contract in `contracts/api.md` (`listMembers`, `messages.list`, `messages.listTyping`, `channels.list` roster, `calls.listParticipants`, `signals.listForMe`) is a Convex query consumed reactively; presence/typing/call-liveness staleness is computed at query-read time from stored timestamps, not via a poll loop; the same reactive `channels.list`/`calls.listParticipants` subscriptions double as the mechanism clients use to detect a deleted channel or a removed/dropped call participant, so no separate notification channel was added |
| III. Type Safety End-to-End | TypeScript strict everywhere; DB access only via typed Convex schema | PASS — Convex schema + generated types enforce this; no raw/untyped queries are possible in Convex | PASS — `data-model.md` fully enumerates typed tables/indexes for `convex/schema.ts`; no field is left untyped or `any` |
| IV. Security Basics | Every Convex function checks caller identity + per-resource authorization | PASS (gate carried into Phase 1) — every mutation/query in `data-model.md`/contracts must load the caller's identity and verify membership/ownership before acting | PASS — every function in `contracts/api.md` has an explicit "Auth" column (membership, ownership, authorship, or call-participant check), including the newer cascade behaviors (`servers.removeMember`'s call teardown, `channels.remove`'s call teardown, `calls.heartbeat` only ever touching the caller's own row); cross-cutting error contract (`UNAUTHENTICATED`/`FORBIDDEN`/`CALL_FULL`) documented once rather than per-function |
| V. Incremental Delivery | App builds/runs after each user story | PASS — user stories are additive (US1 → US5); no story requires ripping out a prior one | PASS — `data-model.md` entities map onto US1–US5 with no entity requiring rework by a later story. The `messages` table is literally one shared table used by both US3 (channel messages) and US4 (DM messages, added via an additive `threadId` field/index) rather than being retrofitted; similarly, US5 *extends* `servers.removeMember` (from US2) and `channels.remove` (from US3) with call-cascade behavior once the `calls` schema exists, following the same additive-extension pattern already used for `servers.create` gaining a default-channel step in US3 |
| VI. Testable Seams | Business logic separated from UI; smoke tests for send-message and join-call | PASS — Convex functions are pure server-side logic already separated from React components; Playwright smoke tests planned for both critical flows | PASS — `research.md` §7 confirms `convex-test` can simulate identities for auth-branch unit tests, and `quickstart.md`'s automated section maps directly to the two mandated Playwright smoke tests |

No violations. Complexity Tracking table below is intentionally empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-realtime-chat-video/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   └── api.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
convex/                       # Backend: typed schema + reactive functions (Convex Auth included)
├── schema.ts                 # All tables: users, servers, serverMembers, channels, messages,
│                              #   directMessageThreads, typingIndicators,
│                              #   presence, calls, callParticipants, signals
├── auth.config.ts            # Convex Auth provider config (password provider)
├── auth.ts                   # convexAuth() — exports signIn/signOut/auth/store
├── users.ts                  # profile queries/mutations (extends Convex Auth's users row)
├── presence.ts                # heartbeat mutation, presence query (online/offline staleness)
├── servers.ts                  # create/rename server, invite link, member list, remove member
│                              #   (removeMember cascades out of any active call, extended in US5)
├── channels.ts                  # create/rename/delete text+voice channels, voice roster
│                              #   (remove force-ends an active call, extended in US5)
├── messages.ts                  # send/edit/delete/paginate/typing for BOTH channel messages
│                              #   (channelId) and direct messages (threadId) — one shared
│                              #   table and function set, extended for threadId in US4
├── directMessages.ts            # thread lifecycle only: openOrCreateThread, listThreadsForUser
├── calls.ts                    # join/leave voice call, mic/camera toggle, heartbeat (stale
│                              #   participant cleanup) — no server-side speaking state
├── signals.ts                  # WebRTC signaling relay (offer/answer/ICE via the signals table);
│                              #   offerer role is deterministic (lower Id<"users"> string)
└── _generated/                  # Convex-generated types (not hand-written)

src/                           # Vite + React 18 SPA (frontend)
├── main.tsx                   # entry point: mounts <ConvexAuthProvider> + <App>
├── App.tsx                    # React Router route table (RequireAuth-gated routes)
├── routes/
│   ├── SignInPage.tsx
│   ├── SignUpPage.tsx
│   ├── ServerLayout.tsx        # server rail + channel sidebar + member list (route layout)
│   ├── ChannelPage.tsx         # text channel view (route: /servers/:serverId/channels/:channelId)
│   ├── VoiceChannelPage.tsx    # voice/video call view (route: /servers/:serverId/voice/:channelId)
│   └── DirectMessagePage.tsx   # route: /dm/:threadId
├── components/
│   ├── chat/                   # MessageList, MessageComposer, TypingIndicator
│   ├── voice/                  # CallGrid, VideoTile, CallControls
│   ├── layout/                 # ServerRail, ChannelSidebar, MemberList
│   └── ui/                     # shared presentational components (Tailwind only, no UI library)
├── lib/                        # client-side business logic seams (hooks wrapping Convex calls,
│                                #   WebRTC peer-connection management), kept separate from
│                                #   components per Testable Seams — includes useWebRTCCall
│                                #   (mesh connection + deterministic offerer/roster-diff logic),
│                                #   useCallHeartbeat, and useSpeakingDetection (client-only audio
│                                #   analysis, replaces any backend speaking state)
└── styles/                     # Tailwind entry + dark theme tokens

index.html                     # Vite SPA entry (root document, no server-rendered HTML)
vite.config.ts
.env.local                     # VITE_CONVEX_URL etc. — never committed

tests/
├── unit/                       # Vitest: convex/ function logic, src/lib/ hooks
└── e2e/                         # Playwright: send-message.spec.ts, join-call.spec.ts
```

**Structure Decision**: Single repository, Vite app at the root. "Backend" is the `convex/`
functions directory (Convex's standard layout — typed schema + server functions, no separately
hosted API server to build or deploy) and "frontend" is the `src/` directory, routed entirely
client-side with React Router (no server-rendering runtime). This satisfies the Web application
shape without introducing a second deployable service, keeping the architecture as simple as the
requirements allow.

## Complexity Tracking

> No Constitution Check violations were found. This table is intentionally left empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
