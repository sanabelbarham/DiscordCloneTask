# Quickstart Validation Guide: Real-Time Chat & Video Community Platform

**Feature**: 001-realtime-chat-video | **Date**: 2026-07-14

This guide validates the feature end-to-end using two browser sessions (e.g. one normal window,
one private/incognito window, or two different browsers) so presence, messaging, and calls can be
observed from both sides at once. It exercises the user stories in priority order (US1 → US5);
each section is runnable independently once its prerequisites exist.

## Prerequisites

- Node.js 20 LTS, a Convex project (`npx convex dev` running against a dev deployment)
- `.env.local` populated with the Convex deployment URL/keys from `npx convex dev`'s setup prompt
- Two browser sessions logged out initially

## Setup

```bash
npm install
npx convex dev        # keep running in one terminal — pushes convex/schema.ts + functions
npm run dev            # Vite dev server, second terminal (default http://localhost:5173)
```

Open the app URL (default `http://localhost:3000`) in both browser sessions.

## US1 — Account, Profile & Presence (P1)

**Goal**: prove signup/login and live presence work with no server/channel yet.

1. In Session A, sign up with a new email/password (FR-001). Confirm you land in the
   authenticated app.
2. In Session B, sign up with a second, different account.
3. In Session A, open the profile settings and change display name and avatar (FR-003).
4. Refresh Session B (or navigate anywhere presence is shown) — confirm the updated name/avatar
   is visible (Acceptance Scenario 3). *(Presence UI for a stranger with no shared server may not
   exist yet — this step can be validated fully once US2 gives both users a shared server; a
   partial check here is acceptable.)*
5. Log out of Session B. In Session A, confirm Session B's status flips to offline within ~5s
   with no page refresh (FR-004, SC-005). Log Session B back in and confirm it flips back online.
6. Log out of Session A (FR-002) and confirm re-authentication is required to re-enter.

**Expected outcome**: both accounts exist, profile edits persist and propagate, and presence
updates live without a refresh.

## US2 — Servers & Membership (P2)

**Goal**: a server exists with two members visible in the sidebar with correct presence.

1. In Session A (logged in), create a server with a name (and optionally an image) (FR-005).
   Confirm Session A is listed as owner.
2. Generate an invite link from the server settings (FR-006).
3. In Session B, open the invite link URL and confirm Session B is now a member.
4. In both sessions, open the member sidebar and confirm both users appear with correct
   online/offline status (FR-007, SC-003 — should complete well under 5 minutes total).
5. In Session A, rename the server; confirm Session B sees the new name without refreshing
   (FR-008).
6. In Session A, remove Session B as a member; confirm Session B immediately loses access to the
   server (FR-009, SC-007 — within 5s).
7. Re-invite Session B (repeat step 3) to continue to US3.

**Expected outcome**: server creation, invite join, live member/presence list, rename
propagation, and removal-revokes-access all work.

## US3 — Channels & Real-Time Text Messaging (P3)

**Goal**: real-time chat with edit/delete/typing/infinite-scroll in the default channel.

1. Confirm the server from US2 already has a "general" text channel (FR-010).
2. As owner (Session A), create an additional text channel and a voice channel; confirm both
   sessions see the updated channel list live (FR-012, Acceptance Scenario 2).
3. In Session A's "general" channel, start typing (don't send yet) — confirm Session B sees a
   typing indicator (FR-020).
4. Send the message from Session A — confirm it appears in Session B within ~1s with no refresh,
   showing author name, avatar, timestamp, content (FR-015, FR-016, SC-002).
5. Edit that message from Session A — confirm Session B sees updated content plus an "edited"
   marker (FR-018).
6. From Session B, attempt to edit/delete Session A's message — confirm the action is not
   available/permitted (FR-017, Acceptance Scenario 8).
7. Delete the message from Session A — confirm it disappears for Session B (FR-017).
8. Send >25 messages (exceeding one page) and scroll up in either session — confirm older
   messages load progressively, newest-first (FR-019, SC-006 conceptually validated at small
   scale here).
9. As owner, delete the extra text channel created in step 2 — confirm its messages are gone and
   the channel disappears from both sessions' lists (FR-013).

**Expected outcome**: default channel exists; channel CRUD is live; messaging is real-time with
correct authorship, editing, deletion, typing, and pagination behavior.

## US4 — Direct Messages (P4)

**Goal**: private 1-on-1 messaging between two users who share a server.

1. From Session A, open a DM with Session B (both share the server from US2) (FR-021).
2. Send a message from Session A; confirm it appears in Session B's DM view in real time
   (FR-023).
3. Edit and then delete a message from its author's session; confirm the same edit-marker and
   deletion behavior as channel messages applies in both sessions.
4. Attempt to open a DM with a user who shares no server (e.g. a third throwaway account with no
   shared server) — confirm the app does not allow starting that conversation (FR-022, Edge
   Cases).

**Expected outcome**: DM creation is gated by shared membership, and DM messaging behaves
identically to channel messaging for real-time delivery, edit, and delete.

## US5 — Voice & Video Calls (P5)

**Goal**: a 2-participant call in a voice channel works, plus a DM-initiated 1-on-1 call.

1. Grant camera/microphone permissions in both browser sessions when prompted.
2. From Session A, join the voice channel created in US3; confirm a call starts and Session A is
   connected (FR-024, Acceptance Scenario 1).
3. From Session B, join the same voice channel; confirm Session B joins the same call and both
   sessions now show a video tile for the other participant (FR-024, FR-027, SC-008 — connection
   under 5s).
4. In Session A, toggle mic off then camera off; confirm Session B sees the muted/camera-off
   state reflected live (FR-026).
5. Speak into one session's microphone; confirm the other session shows a "speaking" indicator
   for that participant (FR-027).
6. Check the server's channel list in either session; confirm the voice channel shows both
   connected members (FR-029).
7. Leave the call from Session B; confirm Session A's call continues uninterrupted (FR-028, Edge
   Cases).
8. Leave the call from Session A too; confirm the channel returns to an empty/no-call state (Edge
   Cases).
9. From the DM opened in US4, start a video call directly from the conversation; confirm a
   1-on-1 call is established between Session A and Session B (FR-030, Acceptance Scenario 7).
10. *(Manual capacity check, optional)*: with 2 more accounts/sessions, join the same voice
    channel until 4 participants are connected and confirm audio/video/controls remain functional
    for all four (FR-025, SC-004); a 5th join attempt should be told the channel is full rather
    than connected (Acceptance Scenario 8).
11. *(Removed-member-mid-call check, FR-009 Edge Cases)*: with Session A and Session B both
    rejoined to the voice channel, have Session A (owner) remove Session B from the server via the
    member list. Confirm Session B's client immediately closes its call connection and is
    redirected out, and Session A no longer shows a tile for Session B — within ~5s, no refresh.
12. *(Deleted-channel-mid-call check, FR-031)*: with a call active in a voice channel (rejoin both
    sessions if needed), have the owner (Session A) delete that voice channel from the channel
    sidebar. Confirm both sessions see a "this voice channel was deleted" notice, their call
    connections close, and they're navigated away from the voice channel view.
13. *(Dropped-participant check, Edge Cases — "network drop mid-call")*: with a call active,
    abruptly close one session's browser tab/window instead of clicking Leave. Confirm the
    remaining session's tile for that participant disappears within roughly 15-20s (the heartbeat
    staleness window, research.md §6) rather than freezing indefinitely, and that a later join to
    the same channel is not blocked by the departed participant's stale slot.

**Expected outcome**: voice/video calls start, join, reflect mic/camera/speaking state live, show
correct channel-list presence, support graceful leave, work up to 4 participants, enforce the
capacity cap, can be initiated from a DM, and cleanly recover when a participant is removed,
their channel is deleted, or their connection drops.

## Scale Check (SC-009)

**Goal**: confirm the system performs correctly at the demo/classroom scale the spec targets —
at least 10 concurrent users across a handful of servers — beyond the 2-session walkthrough above
(tasks.md T071).

1. Create (or reuse) 2-3 servers, each with a few members, until at least 10 distinct user
   accounts are logged in concurrently (real browser sessions, or a mix of real sessions and
   scripted Convex clients driving `users`/`messages`/`presence` functions).
2. Spread activity across servers: send messages in multiple channels, keep presence heartbeats
   running, and join at least one voice channel up to 4 participants.
3. Confirm messaging stays real-time (SC-002), presence stays accurate (SC-005), and the voice
   call stays usable (SC-004) throughout, with no visible slowdown as the session count grows
   toward 10 (SC-009).

**Expected outcome**: real-time messaging, presence, and call quality all hold up at the targeted
demo scale. This is a manual/scripted check, not one of the two constitution-mandated automated
smoke tests below.

## Automated smoke tests (constitution-mandated, Testable Seams)

Run after the manual pass above to guard against regressions:

```bash
npm run test:unit   # Vitest — convex/ function logic incl. auth/authorization branches
npm run test:e2e    # Playwright — send-message.spec.ts, join-call.spec.ts
```

Refer to `research.md` §6 for the fake-media-device Playwright configuration and `contracts/api.md`
for the exact function signatures these tests call against.
