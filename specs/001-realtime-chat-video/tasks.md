---

description: "Task list for Real-Time Chat & Video Community Platform"
---

# Tasks: Real-Time Chat & Video Community Platform

**Input**: Design documents from `/specs/001-realtime-chat-video/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md
(all present)

**Revision note (post-validation)**: this task list was renumbered after a validation audit added
five gaps to close: removing server-side speaking-state tracking (client-side audio analysis
instead), merging `messages`/`directMessages` into one table + function set, handling a member
removed mid-call, handling a voice channel deleted mid-call, and reaping stale/crashed call
participants via heartbeat. Task IDs from T001–T048 are unchanged from the prior revision; T049
onward were renumbered/expanded (12 → 17 tasks in Phase 7) and Phase 8 shifted accordingly
(T061–T065 → T066–T070).

**Revision note (post-analyze)**: `/speckit-analyze` flagged that SC-009 (demo/classroom scale —
≥10 concurrent users across a handful of servers) had no task exercising it beyond the 2-session
quickstart walkthrough. T071 was added to Phase 8 to close that gap, with a matching "Scale Check
(SC-009)" section added to `quickstart.md`. It also flagged that `quickstart.md` didn't exercise
the mid-call edge cases T050/T062/T063/T064 implement; three new steps were added to quickstart's
US5 section for that.

**Tests**: The constitution (`Testable Seams`, Principle VI) mandates exactly two automated
smoke tests — "send a message end-to-end" and "join a voice/video call end-to-end" — no more, no
less. Those two tasks are included in US3 (T043) and US5 (T065) respectively. No other test tasks
are included since the spec does not request a full TDD/contract-test suite.

**Organization**: Tasks are grouped by user story (US1–US5, matching spec.md's priorities P1–P5)
to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Every task includes its exact file path

## Path Conventions

Per `plan.md`'s Project Structure: Convex backend functions under `convex/`, Vite/React SPA under
`src/`, tests under `tests/unit/` (Vitest) and `tests/e2e/` (Playwright). No separate
`backend/`/`frontend/` split — single repository, Vite app at the root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic tooling

- [X] T001 Create Vite + React 18 + TypeScript (strict) project structure at repo root
      (`index.html`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx`, `tsconfig.json` with
      `strict: true`) per `plan.md` Project Structure
- [X] T002 Install core dependencies: `react-router-dom`, `convex`, `@convex-dev/auth`,
      `tailwindcss`, `postcss`, `autoprefixer` (package.json + `npx tailwindcss init`)
- [X] T003 [P] Configure Tailwind dark theme tokens and base layout scaffolding in
      `src/styles/` (Discord-like dark theme: server rail, sidebar, main pane, member list
      color/spacing tokens)
- [X] T004 [P] Configure ESLint + TypeScript strict-mode enforcement across the repo (no `any`
      without inline justification, per Type Safety End-to-End) in `.eslintrc`/`tsconfig.json`
- [X] T005 [P] Configure Vitest with `convex-test` in `edge-runtime` environment in
      `vitest.config.ts` (research.md §7)
- [X] T006 [P] Configure Playwright with `--use-fake-device-for-media-stream` and
      `--use-fake-ui-for-media-stream` Chromium launch flags in `playwright.config.ts`
      (research.md §7)
- [X] T007 Initialize Convex project (`npx convex dev`) and populate `.env.local` with
      `VITE_CONVEX_URL` (never committed, per plan.md Constraints)

**Checkpoint**: Repo builds and runs (`npm run dev`), Convex dev deployment is connected, no
feature code yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Auth, base schema, and shared UI shell that every user story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T008 Configure Convex Auth password provider in `convex/auth.config.ts` and
      `convex/auth.ts` (`convexAuth()` exporting `signIn`/`signOut`/`auth`/`store`) per
      research.md §1
- [X] T009 Define base `convex/schema.ts`: merge Convex Auth's `authTables` and extend `users`
      with `displayName`/`avatarUrl`; define `presence` table with `by_userId` index (data-model.md
      §users, §presence)
- [X] T010 Mount `ConvexAuthProvider` + `ConvexReactClient` (built from
      `import.meta.env.VITE_CONVEX_URL`) around `<App />` in `src/main.tsx` (research.md §1)
- [X] T011 Implement `RequireAuth` route-guard layout component (`useConvexAuth()` →
      loading/redirect-to-`/signin`/`<Outlet>`) and wire the top-level route table in
      `src/App.tsx` (research.md §1)
- [X] T012 [P] Build shared Tailwind-only UI primitives (Button, Input, Modal, Avatar) in
      `src/components/ui/`
- [X] T013 [P] Implement presence heartbeat hook (`useHeartbeat`) calling a `presence.heartbeat`
      mutation on a ~5s interval plus `visibilitychange`/`beforeunload`/`pagehide` listeners in
      `src/lib/usePresence.ts` (research.md §2) — the `presence.heartbeat` mutation itself is
      implemented in T015 (US1); this hook is foundational because every authenticated route
      needs it mounted once at the app shell level

**Checkpoint**: Sign-up/sign-in scaffolding compiles, protected routes redirect correctly, schema
pushes to Convex with no errors. User story implementation can now begin.

---

## Phase 3: User Story 1 - Account, Profile & Presence (Priority: P1) 🎯 MVP

**Goal**: A visitor can sign up, log in, edit their display name/avatar, and see other users'
online/offline status update live, with no server or channel existing yet.

**Independent Test**: Two people each create an account, log in from separate sessions, and each
see the other's status flip between online and offline as they log in/out (quickstart.md §US1).

### Implementation for User Story 1

- [X] T014 [P] [US1] Implement `users.ts`: `getCurrentProfile`, `updateProfile`, `getProfile` in
      `convex/users.ts` (auth: caller-only for update; any authenticated caller may read any
      profile, per contracts/api.md)
- [X] T015 [P] [US1] Implement `presence.ts`: `heartbeat` mutation (caller updates own row only)
      and `getStatus` query (`isOnline` computed from `lastSeen` staleness) in
      `convex/presence.ts` (data-model.md §presence, research.md §2)
- [X] T016 [US1] Build `SignUpPage` (email/password form calling Convex Auth's `signIn` action
      with the password provider's sign-up flow) in `src/routes/SignUpPage.tsx`
- [X] T017 [US1] Build `SignInPage` (email/password form + sign-out action) in
      `src/routes/SignInPage.tsx`
- [X] T018 [US1] Build profile-settings UI (edit `displayName`/`avatarUrl`, wired to
      `users.updateProfile`) as a modal/panel in `src/components/ui/ProfileSettingsModal.tsx`
- [X] T019 [US1] Wire `useHeartbeat` (T013) into the authenticated app shell in `src/App.tsx` so
      every logged-in session heartbeats automatically
- [X] T020 [US1] Build an online/offline status-dot component consuming `presence.getStatus`
      reactively in `src/components/ui/PresenceDot.tsx`
- [X] T021 [US1] Wire sign-out button (Convex Auth `signOut`) with redirect to `/signin` in the
      app shell in `src/App.tsx`

**Checkpoint**: User Story 1 is fully functional and independently testable per quickstart.md
§US1 — signup, login, profile edit, live presence, logout all work with no servers/channels.

---

## Phase 4: User Story 2 - Servers & Membership (Priority: P2)

**Goal**: A logged-in user creates a server, owns it, invites others via a link, and the server
sidebar lists all members with live presence; the owner can rename the server and remove members.

**Independent Test**: A user creates a server, shares the invite link, a second user joins via
that link, and both appear in the member sidebar with correct online status (quickstart.md §US2).

### Implementation for User Story 2

- [X] T022 [US2] Extend `convex/schema.ts` with `servers` (`by_inviteCode`, `by_ownerId`) and
      `serverMembers` (`by_server`, `by_user`, `by_server_and_user`) tables (data-model.md
      §servers, §serverMembers)
- [X] T023 [P] [US2] Implement `servers.ts`: `create`, `rename`, `regenerateInvite`,
      `joinByInvite`, `listMembers`, `removeMember` (basic version: deletes the `serverMembers`
      row, owner-only, cannot remove self/owner — the call-cascade extension lands in US5 once
      calls exist, T062), `listForUser` in `convex/servers.ts` (auth per contracts/api.md —
      owner-only for rename/invite-regen/remove-member)
- [X] T024 [US2] Build `ServerRail` component (vertical list of the caller's servers +
      create-server button) in `src/components/layout/ServerRail.tsx`
- [X] T025 [US2] Build "Create Server" form/modal (name + optional image, wired to
      `servers.create`) in `src/components/ui/CreateServerModal.tsx`
- [X] T026 [US2] Build `ServerLayout` route (mounts `ServerRail` + `MemberList`, route
      `/servers/:serverId`) in `src/routes/ServerLayout.tsx`
- [X] T027 [US2] Build `MemberList` component (roster + `PresenceDot` from T020 per member,
      wired to `servers.listMembers`) in `src/components/layout/MemberList.tsx`
- [X] T028 [US2] Build invite-link UI (generate/copy/regenerate, wired to
      `servers.regenerateInvite`) in `src/components/ui/InviteLinkPanel.tsx`
- [X] T029 [US2] Build invite-landing route that calls `servers.joinByInvite` from the invite URL
      and redirects into the joined server in `src/routes/JoinInvitePage.tsx`
- [X] T030 [US2] Add owner-only "remove member" action to `MemberList` (T027), wired to
      `servers.removeMember`
- [X] T031 [US2] Add owner-only server-rename control to `ServerLayout` (T026), wired to
      `servers.rename`

**Checkpoint**: User Stories 1 AND 2 both work independently per quickstart.md §US1–§US2.

---

## Phase 5: User Story 3 - Channels & Real-Time Text Messaging (Priority: P3)

**Goal**: Every server ships a default "general" text channel; the owner manages additional text
and voice channels; members send messages that appear instantly, can be edited/deleted by their
author, and load via newest-first infinite scroll, with live typing indicators.

**Independent Test**: In an existing server, a member sends a message in "general" and a second
member sees it appear immediately; the author then edits and deletes it, both reflected live
(quickstart.md §US3).

### Implementation for User Story 3

- [X] T032 [US3] Extend `convex/schema.ts` with `channels` (`by_server`, `by_server_and_type`),
      `messages` (`channelId` required for now, `by_channel` index — widened with an optional
      `threadId`/`by_thread` index in US4, T044), and `typingIndicators` (`by_channel`,
      `by_thread`) tables (data-model.md §channels, §messages, §typingIndicators)
- [X] T033 [US3] Modify `servers.create` (`convex/servers.ts`, from T023) to auto-create a default
      `isDefault: true` "general" text channel in the same mutation (FR-010)
- [X] T034 [P] [US3] Implement `channels.ts`: `list` (with voice-channel connected-roster),
      `create`, `rename`, `remove` (cascades message deletion only — voice channels can't yet have
      an active call in this story, since `calls` doesn't exist until US5; the force-end-call
      cascade is added in US5, T063) in `convex/channels.ts`
- [X] T035 [P] [US3] Implement `messages.ts`: `list` (paginated, newest-first via
      `paginationOptsValidator`, `channelId`-scoped for now), `send`, `edit`, `remove`,
      `setTyping`, `listTyping` in `convex/messages.ts` (research.md §4, §5) — extended to also
      accept `threadId` in US4, T045
- [X] T036 [US3] Build `ChannelSidebar` component (text/voice channel list + owner
      create/rename/delete controls) in `src/components/layout/ChannelSidebar.tsx`
- [X] T037 [US3] Mount `ChannelSidebar` (T036) inside `ServerLayout` (`src/routes/ServerLayout.tsx`,
      from T026)
- [X] T038 [US3] Build `ChannelPage` route (mounts `MessageList` + `MessageComposer`, route
      `/servers/:serverId/channels/:channelId`) in `src/routes/ChannelPage.tsx`
- [X] T039 [P] [US3] Build `MessageList` component using `usePaginatedQuery` for infinite-scroll,
      newest-first history, showing author name/avatar/timestamp/content and an "edited" marker
      in `src/components/chat/MessageList.tsx` (research.md §4)
- [X] T040 [P] [US3] Build `MessageComposer` component (send + author-only inline edit) in
      `src/components/chat/MessageComposer.tsx`
- [X] T041 [US3] Add author-only edit/delete controls to `MessageList` items (T039), calling
      `messages.edit`/`messages.remove`
- [X] T042 [P] [US3] Build `TypingIndicator` component + debounced `useTyping` hook (refreshes
      `messages.setTyping` while composing) in `src/components/chat/TypingIndicator.tsx` and
      `src/lib/useTyping.ts` (research.md §5)
- [X] T043 [US3] Playwright smoke test: send a message end-to-end (two browser contexts, one
      sends, the other sees it appear without refresh) in `tests/e2e/send-message.spec.ts`
      (constitution Testable Seams — mandatory)

**Checkpoint**: User Stories 1, 2, AND 3 all work independently per quickstart.md §US1–§US3.

---

## Phase 6: User Story 4 - Direct Messages (Priority: P4)

**Goal**: Any user can open a 1-on-1 DM with another user they share a server with; DMs behave
like channels (real-time, edit, delete), reusing the same `messages` table and function set as
channel messages (data-model.md §messages) instead of a duplicate table.

**Independent Test**: Two users who share a server open a DM, exchange messages in real time, and
edit/delete their own messages, matching channel-message behavior (quickstart.md §US4).

### Implementation for User Story 4

- [X] T044 [US4] Extend `convex/schema.ts` with `directMessageThreads` (`by_pair`,
      `by_participantA`, `by_participantB`) table; widen the existing `messages` table (T032) by
      making `channelId` optional and adding an optional `threadId: Id<"directMessageThreads">`
      field with a `by_thread` index, so channel and DM messages share one table instead of
      introducing a second `directMessages` table (data-model.md §messages,
      §directMessageThreads)
- [X] T045 [US4] Extend `messages.ts` (T035, same file) so `list`/`send`/`setTyping`/`listTyping`
      accept either `channelId` or `threadId` (auth branches to channel-membership or
      thread-participant check); implement `directMessages.ts`: `openOrCreateThread` (rejects
      self-DM and no-shared-server pairs), `listThreadsForUser` in `convex/directMessages.ts`
      (contracts/api.md `messages.ts`, `directMessages.ts`) — not `[P]` against T035 since both
      touch `convex/messages.ts`
- [X] T046 [US4] Build a DM thread-list section (wired to `directMessages.listThreadsForUser`) in
      `src/components/layout/DirectMessageList.tsx`
- [X] T047 [US4] Build `DirectMessagePage` route (reuses `MessageList`/`MessageComposer`/
      `TypingIndicator` from T039/T040/T042 against thread data via `threadId`, route `/dm/:threadId`) in
      `src/routes/DirectMessagePage.tsx`
- [X] T048 [US4] Add "open DM" entry point to `MemberList` (T027), wired to
      `directMessages.openOrCreateThread`, navigating to the resulting thread route

**Checkpoint**: User Stories 1–4 all work independently per quickstart.md §US1–§US4.

---

## Phase 7: User Story 5 - Voice & Video Calls (Priority: P5)

**Goal**: A member joins a voice channel to start/join a live call (2–4 participants) with
mic/camera toggles, video tiles, client-computed speaking/muted indicators, and live channel-list
presence; a 1-on-1 video call can also be started from a DM. Crashed/disconnected participants are
reaped via heartbeat; removing a member or deleting a voice channel mid-call cleanly ends their
call participation.

**Independent Test**: Two members join the same voice channel, each sees the other's video tile
and mute/speaking state, toggles their own mic/camera, and one leaves without disrupting the
other's call; separately, a DM-initiated 1-on-1 call is established (quickstart.md §US5).

### Implementation for User Story 5

- [X] T049 [US5] Extend `convex/schema.ts` with `calls` (`by_channel`, `by_thread`),
      `callParticipants` (`micOn`, `cameraOn`, `lastHeartbeatAt` — no `isSpeaking` field, per
      research.md §3; `by_call`, `by_call_and_user`, `by_user` indexes), and `signals`
      (`by_recipient`) tables (data-model.md §calls, §callParticipants, §signals)
- [X] T050 [P] [US5] Implement `calls.ts`: `join` (deletes stale `callParticipants` rows for the
      target call before checking capacity, rejects with `"CALL_FULL"` at 4 live participants),
      `leave` (deletes the call row if last participant), `heartbeat` (bumps caller's own
      `lastHeartbeatAt`; opportunistically deletes other stale rows in the same call),
      `setMediaState` (mic/camera only), `listParticipants` (excludes stale rows) in
      `convex/calls.ts` (research.md §6 — no `setSpeaking`, per research.md §3)
- [X] T051 [P] [US5] Implement `signals.ts`: `send`, `listForMe`, `consume` (both parties must be
      current `callParticipants`) in `convex/signals.ts` (research.md §3)
- [X] T052 [US5] Implement `useWebRTCCall` hook: diffs `calls.listParticipants` against a local
      `Map<Id<"users">, RTCPeerConnection>` to discover new/departed peers; for each new peer,
      applies the deterministic offerer rule (lower `Id<"users">` string always creates the
      offer, per research.md §3) and either sends an `offer` via `signals.ts` or waits for one;
      exchanges `answer`/`ice-candidate` signals (buffering ICE candidates that arrive before the
      remote description is set); tears down the `RTCPeerConnection` for any peer that drops out
      of the roster (leave, removal, or staleness); Google STUN config
      (`stun:stun.l.google.com:19302`); local mic/camera `MediaStream` handling in
      `src/lib/useWebRTCCall.ts` (research.md §3)
- [X] T053 [US5] Implement `useCallHeartbeat` hook: calls `calls.heartbeat({ callId })` on a ~5s
      interval while mounted in an active call (same interval/lifecycle pattern as `useHeartbeat`,
      T013, scoped per-call instead of globally) in `src/lib/useCallHeartbeat.ts` (research.md §6)
- [X] T054 [P] [US5] Implement `useSpeakingDetection` hook: a Web Audio `AnalyserNode` per
      connected peer's remote `MediaStream` audio track, producing a local-only
      `Record<Id<"users">, boolean>` of who is currently speaking — no Convex table, mutation, or
      query involved (FR-027, research.md §3, replacing the removed server-side `isSpeaking`
      field) in `src/lib/useSpeakingDetection.ts`
- [X] T055 [US5] Build `VideoTile` component (video element + mute icon from
      `callParticipants.micOn`/`cameraOn` + speaking-indicator overlay sourced from
      `useSpeakingDetection`, T054, not backend state) in `src/components/voice/VideoTile.tsx`
- [X] T056 [US5] Build `CallGrid` component (renders a `VideoTile` per connected participant) in
      `src/components/voice/CallGrid.tsx`
- [X] T057 [US5] Build `CallControls` component (mic toggle, camera toggle, leave button, wired to
      `calls.setMediaState`/`calls.leave`) in `src/components/voice/CallControls.tsx`
- [X] T058 [US5] Build `VoiceChannelPage` route (join-on-mount via `calls.join`, mounts
      `useCallHeartbeat` (T053), `CallGrid` + `CallControls`, route
      `/servers/:serverId/voice/:channelId`) in `src/routes/VoiceChannelPage.tsx`
- [X] T059 [US5] Add connected-voice-members roster display to `ChannelSidebar` (T036), sourced
      from `channels.list`'s roster field (FR-029)
- [X] T060 [US5] Add "Start video call" action to `DirectMessagePage` (T047), wired to
      `calls.join` with `threadId`
- [X] T061 [US5] Handle the `"CALL_FULL"` error contract in `VoiceChannelPage` (T058) — show a
      "channel is full" message instead of connecting (FR-025, Edge Cases)
- [X] T062 [US5] Extend `servers.removeMember` (T023) to cascade out of an active call: using the
      new `callParticipants.by_user` index (T049), find any call the removed user participates in
      whose channel belongs to this server, delete their `callParticipants` row (and the `calls`
      row too if they were the last participant) in `convex/servers.ts` (FR-009, Edge Cases,
      data-model.md §serverMembers)
- [X] T063 [US5] Extend `channels.remove` (T034) to force-end an active call when deleting a
      voice channel: delete all `callParticipants` rows for the channel's `calls` row (via
      `calls.by_channel`), then the `calls` row itself, then the `channels` row, in
      `convex/channels.ts` (FR-031, data-model.md §channels)
- [X] T064 [US5] Handle call-ended/self-removed states in `VoiceChannelPage` (T058): when the
      current `channelId` disappears from `channels.list` (channel deleted mid-call, T063) or the
      caller's own `userId` disappears from `calls.listParticipants` (removed from the server
      mid-call, T062), close every open `RTCPeerConnection` via `useWebRTCCall` (T052), stop local
      media tracks, show a notice, and redirect out of the voice channel (FR-031, FR-009 Edge
      Cases)
- [X] T065 [US5] Playwright smoke test: two browser contexts join the same voice channel and both
      reach a connected call state in `tests/e2e/join-call.spec.ts` (constitution Testable Seams
      — mandatory)

**Checkpoint**: All five user stories are independently functional per quickstart.md in full.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that span multiple user stories

- [X] T066 [P] Run the full `quickstart.md` manual validation walkthrough across US1–US5
- [X] T067 [P] Add Vitest unit tests (using `convex-test` + `t.withIdentity(...)`) covering
      authenticated/unauthenticated/wrong-user branches for the highest-risk mutations
      (`servers.removeMember` including its call cascade, `messages.edit`/`remove`, `calls.join`
      including its capacity/stale-reap behavior) in `tests/unit/` (constitution Security Basics +
      Testable Seams)
- [X] T068 Self-review every Convex function against the Security Basics checklist (authenticates
      + authorizes for the specific resource) per Development Workflow
- [X] T069 [P] Responsive/dark-theme visual polish pass across `src/components/` (stretch goal,
      not a requirement, per plan.md Target Platform)
- [X] T070 Document the STUN-only/no-TURN limitation (calls may fail on strict/symmetric NAT) in
      the app UI or README, per research.md's documented risk
- [X] T071 [P] Validate SC-009 at demo scale: with at least 10 concurrent sessions spread across 2-3
      servers (real browser sessions and/or scripted Convex clients driving `users`/`messages`/
      `presence`), confirm real-time messaging (SC-002), presence (SC-005), and a 4-participant
      voice call (SC-004) all stay correct and responsive with no visible slowdown; record the
      result in `quickstart.md`'s "Scale Check (SC-009)" section — a manual/scripted check, not
      one of the two constitution-mandated automated smoke tests (T043, T065)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational; uses `PresenceDot` (T020) from US1 in
  `MemberList` — start after US1
- **User Story 3 (Phase 5)**: Depends on Foundational; extends `ServerLayout`/`servers.create`
  from US2 — start after US2
- **User Story 4 (Phase 6)**: Depends on Foundational; requires shared-server membership (US2)
  and extends `messages.ts` (US3) with `threadId` support instead of duplicating it — start after
  US3
- **User Story 5 (Phase 7)**: Depends on Foundational; requires voice channels to exist (US3),
  reuses the DM thread page (US4) for its "start call from DM" entry point, and extends
  `servers.removeMember` (US2, T062) and `channels.remove` (US3, T063) with call-cascade behavior
  now that the `calls` schema exists — start after US4

- **Polish (Phase 8)**: Depends on all desired user stories being complete

This is a linear P1→P5 build order (each story's spec.md "Why this priority" explicitly describes
this cumulative dependency — it is not an artificial constraint). Within that order, tasks marked
`[P]` in the same phase can run in parallel.

### Within Each User Story

- Schema extension task first (single-file, sequential)
- Convex function files ([P] where they don't share a file) before UI components that call them
- Shared/reused components (e.g. `MessageList`) before the route that composes them
- Story's constitution-mandated smoke test (US3, US5 only) last

### Parallel Opportunities

- Setup: T003, T004, T005, T006 in parallel after T001–T002
- Foundational: T012, T013 in parallel after T008–T011
- Within US1: T014, T015 in parallel; then T016–T021 (mostly sequential, same-ish UI shell files)
- Within US2: T023 parallel with nothing else (T022 must precede it); T024–T031 are mostly
  sequential (build on shared `ServerLayout`/`MemberList` files)
- Within US3: T034, T035 in parallel after T032–T033; T039, T040, T042 in parallel (different
  component files) after T034–T035
- Within US4: T045 is sequential after T035 (same file, `convex/messages.ts`), not `[P]`;
  T046–T048 mostly sequential
- Within US5: T050, T051 in parallel after T049; T053, T054 in parallel after T052 (independent
  hook files); T055–T057 can start once T052/T054 exist, then converge in T058; T062 (touches
  `convex/servers.ts`) and T063 (touches `convex/channels.ts`) can run in parallel with each
  other once T049 (calls schema) lands, since they touch different files; T064 depends on both

---

## Parallel Example: User Story 3

```bash
# After T032 (schema) and T033 (default-channel wiring) land:
Task: "Implement channels.ts in convex/channels.ts"
Task: "Implement messages.ts in convex/messages.ts"

# After both function files land, build the independent chat components together:
Task: "Build MessageList component in src/components/chat/MessageList.tsx"
Task: "Build MessageComposer component in src/components/chat/MessageComposer.tsx"
Task: "Build TypingIndicator component + useTyping hook"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run quickstart.md §US1 with two sessions
5. Demo if ready — this alone proves auth + live presence, the identity foundation for everything
   else

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 (Account, Profile & Presence) → validate → demo (MVP)
3. Add US2 (Servers & Membership) → validate → demo
4. Add US3 (Channels & Real-Time Text Messaging) → validate → demo (core value proposition)
5. Add US4 (Direct Messages) → validate → demo
6. Add US5 (Voice & Video Calls) → validate → demo (full feature set)

Unlike a typical Spec Kit project, these five stories are **not** independently parallelizable by
separate developers — each one explicitly builds on the previous per spec.md's own priority
rationale (US2 needs US1's identity model to show presence in the member list; US3 needs US2's
servers to hold channels; US4 needs US3's messaging function file and US2's membership check; US5
needs US3's voice channels, US4's DM thread page, and extends US2/US3's `removeMember`/`remove`
functions once its own schema exists). Build and validate in strict P1→P5 order.

---

## Notes

- `[P]` tasks touch different files with no unfinished-task dependency between them
- `[Story]` label maps every user-story-phase task to US1–US5 for traceability
- Only two automated tests are included (T043, T065) — the constitution's exact minimum for
  Testable Seams; everything else is validated via the quickstart.md manual walkthrough (T066)
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before moving to the next
- `convex/schema.ts` is edited across multiple phases (T009, T022, T032, T044, T049) — each edit
  is additive/append-only and sequential relative to other schema edits, never marked `[P]`
  against another schema task
- Three Convex function files are extended by a later user story rather than duplicated:
  `convex/servers.ts` (T023 in US2, extended by T062 in US5), `convex/channels.ts` (T034 in US3,
  extended by T063 in US5), and `convex/messages.ts` (T035 in US3, extended by T045 in US4) — each
  extension is additive and sequential relative to the task that first created the file, never
  marked `[P]` against it
