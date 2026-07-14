# Phase 0 Research: Real-Time Chat & Video Community Platform

**Feature**: 001-realtime-chat-video | **Date**: 2026-07-14

**Revision note (post-validation)**: §3 and §6 were rewritten/added after a plan-validation audit found
the original WebRTC signaling design under-specified (no offerer/glare rule, no peer-discovery
wiring, no crashed-participant cleanup) and the original speaking-indicator design unnecessarily
routed through the backend. See `plan.md` Summary and `data-model.md` for the resulting schema
changes.

All items below resolve open implementation questions for the stack already selected in
`plan.md` (Vite + React Router + Convex + native WebRTC). No NEEDS CLARIFICATION markers
remained in the Technical Context, so this research focuses on concrete integration patterns
rather than open architectural unknowns.

## 1. Convex Auth setup (Vite + React Router SPA)

**Decision**: Use `@convex-dev/auth` with the Password provider — backend files are unchanged
regardless of frontend framework: `convex/auth.config.ts` (provider config, synced via
`npx convex dev`/`deploy`), `convex/auth.ts` (calls `convexAuth()` to export
`signIn`/`signOut`/`auth`/`store`), and `authTables` merged into `convex/schema.ts`. The
frontend-specific wiring (this project has no Next.js server/middleware layer to hook into) is:

- `src/main.tsx` mounts `ConvexAuthProvider` (from `@convex-dev/auth/react`) wrapping a
  `ConvexReactClient` built from `import.meta.env.VITE_CONVEX_URL`, around `<App />`.
- Protected routes are gated by a `RequireAuth` layout-route component using `useConvexAuth()`
  (from `convex/react`) — check `isLoading` first (avoid a flash-redirect before the auth token
  resolves), then `isAuthenticated`, redirecting via `<Navigate to="/signin" replace />` if false;
  otherwise render `<Outlet />`. Used in `App.tsx`'s route table as a wrapping `<Route
  element={<RequireAuth />}>` around all authenticated routes.

Inside every Convex function: `const identity = await ctx.auth.getUserIdentity(); if (!identity)
throw new Error("Unauthorized");`, then resolve the user row via
`identity.subject`/`getAuthUserId(ctx)` and enforce per-resource checks (e.g. server/channel
membership) before touching `ctx.db` — this part is identical to any Convex Auth project and
unaffected by the frontend framework choice.

**Rationale**: This is exactly what `npm create convex@latest`'s "React (Vite)" + "Convex Auth"
template scaffolds (`get-convex/template-react-vite-convexauth`), so it's a supported, documented
path (labs.convex.dev/auth/setup) — no new auth vendor, and the same uniform per-function
authorization hook satisfies Security Basics. The `RequireAuth`/`<Navigate>` route-guard pattern
is the standard React Router adaptation of `useConvexAuth()` (Convex's own `<Authenticated>` /
`<Unauthenticated>` / `<AuthLoading>` helper components are built on the same hook) — flagged
here as a project convention rather than an official Convex recipe, since Convex Auth's docs only
have a dedicated routing subsection for Next.js, not React Router.

**Alternatives considered**:
- Clerk/Auth0 — rejected: introduces an external auth dependency not justified at this scale
  (Simplicity First).
- Per-page `useEffect` + `useNavigate()` redirects instead of one shared `RequireAuth` wrapper —
  rejected: duplicates auth-gating logic across every protected route instead of once at the
  route-table level.

**Vite/SPA-specific notes**:
- Env var is `VITE_CONVEX_URL` (Vite's `import.meta.env` convention), not Next's
  `NEXT_PUBLIC_CONVEX_URL`.
- No server-rendering means an unavoidable brief loading flash on first paint while
  `useConvexAuth()` resolves — acceptable at this scale, no SSR workaround needed.
- `SITE_URL` (`npx convex env set SITE_URL http://localhost:5173`, matching Vite's default port)
  only matters for OAuth/email-based redirect flows; not required for password-only sign-in/up.

## 2. Presence (online/offline)

**Decision**: A `presence` table keyed by `(serverId, userId)` (or a global row per user) storing
an `updated` heartbeat timestamp. Client sends a heartbeat mutation every ~5s and a best-effort
"leave" mutation on `visibilitychange`/`beforeunload`/`pagehide`. Online/offline is computed at
query time as staleness: `isOnline = Date.now() - presence.updated < 10_000` (2x heartbeat
interval) — no explicit disconnect signal is needed because Convex exposes no raw socket-close
hook to app code.

**Rationale**: Matches Convex's own documented approach (`@convex-dev/presence` component and
community write-ups use the same heartbeat + staleness-threshold pattern). At ~10 concurrent
users, a hand-rolled table avoids an extra dependency while remaining reactive (query re-runs
automatically as time passes relative to `updated`). This same heartbeat + staleness pattern is
reused for call-participant liveness in §6 rather than inventing a second mechanism.

**Alternatives considered**:
- `@convex-dev/presence` component — reasonable but an extra package; hand-rolled table is
  simpler at this scale and easier to test (Simplicity First).
- True server-side disconnect detection — rejected: not exposed by Convex's function model.

## 3. WebRTC mesh signaling via Convex

**Decision**: A `signals` table shaped `{ callId, fromUserId, toUserId, type: "offer" |
"answer" | "ice-candidate", payload: string, createdAt }` relays SDP/ICE between peers, replacing a
dedicated signaling server (Convex's reactive queries already push row changes to subscribers).
Three things left implicit in the original design are now defined explicitly, since they are what
actually determines whether two clients reach a connected `RTCPeerConnection`:

**Deterministic offerer selection**: For any pair of participants `(u1, u2)` in a call, compare
their `Id<"users">` values as strings. The participant whose id sorts lower is always the
*offerer* for that pair; the other is always the *answerer*. Both sides compute this
independently from data they both already have (the call roster), so they always agree — join
order, network timing, and who calls `calls.join` first never affect the outcome. This removes
offer glare entirely: at most one `offer` row is ever created per pair, because only one side of
the comparison is ever true.

**Peer discovery (new participants finding existing ones, and vice versa)**: Every participant's
client reactively subscribes to `calls.listParticipants({ callId })` (already required for the
roster UI) and keeps a local `Map<Id<"users">, RTCPeerConnection>` of who it currently holds a
connection to. On every roster update, the client diffs the roster against that map:
- A participant present in the roster but missing from the map is a peer to (re)connect to.
  Apply the offerer-selection rule: if I am the offerer for this pair, create an
  `RTCPeerConnection`, `createOffer()`, `setLocalDescription`, and insert a `signals` row
  addressed to them. If I am the answerer, create an `RTCPeerConnection` and wait — their offer
  will arrive via my own `signals.listForMe` subscription.
- A peer present in the map but missing from the roster (they left, were removed, or went stale —
  §6) is torn down: close that `RTCPeerConnection`, drop its media tile, delete the map entry.

One diff loop handles the initial 2-participant join, a 3rd/4th participant joining later, a
graceful leave, a forced removal (`servers.removeMember`'s call cascade), and a stale/crashed
participant being reaped (§6) — there is no separately-coded "first join" path.

**Mesh construction for 2-4 participants**: Every pair of participants independently runs the
exchange above via the same roster-diff logic; at N participants each client ends up holding N-1
`RTCPeerConnection`s (up to 3 at the 4-participant cap, 6 pairwise connections total across the
call). No SFU or central media coordinator — consistent with Simplicity First at this scale.

**ICE candidate exchange**: once a pair's offer/answer exchange has started, each side's
`RTCPeerConnection.onicecandidate` handler inserts a `signals` row (`type: "ice-candidate"`,
`toUserId: <peer>`) per candidate. The peer's `signals.listForMe` reactive query surfaces each
row; the client calls `addIceCandidate(payload)`, then `signals.consume(signalId)` to delete it.
Candidates that arrive before `setRemoteDescription` has resolved for that peer are buffered in a
small client-side array and flushed immediately after the remote description is set (standard
trickle-ICE handling) — no extra table or Convex-side ordering guarantee is needed for this.

NAT traversal uses Google's public STUN server (`stun:stun.l.google.com:19302`) as the demo
default. A TURN server is explicitly deferred/out of scope — documented as a known limitation
(calls between peers behind symmetric NAT may fail to connect).

**Rationale**: Convex's reactive queries substitute directly for a WebSocket signaling server. The
deterministic offerer rule is the standard fix for two-sided-offer races in peer-to-peer
signaling designs and costs nothing beyond a string comparison already available on both sides.
STUN alone covers most home/office NATs for a small demo; TURN requires a paid relay or
self-hosted coturn, unjustified at ~10 users (Simplicity First, scale per spec Clarifications).

**Alternatives considered**:
- Dedicated signaling server (e.g. Socket.IO) — rejected: new backend component, disallowed by
  Simplicity First when Convex already provides a reactive channel.
- Randomized or first-come-first-served offerer role — rejected: without a deterministic
  tie-break, two participants joining within the same reactive-update window can each decide
  they're the offerer, producing a simultaneous-offer race with no defined resolution.
- A designated "room host" who mediates all connections — rejected: adds a single point of
  failure and coordinator-election logic that plain pairwise ID comparison avoids entirely.
- Provisioning TURN now (Twilio, coturn) — deferred, not rejected: revisit only if STUN-only
  connectivity testing shows frequent failures among target users.

## 4. Convex pagination for infinite scroll

**Decision**: Backend query takes `{ paginationOpts: paginationOptsValidator }` and runs
`ctx.db.query("messages").withIndex("by_channel", q => q.eq("channelId", channelId)).order("desc").paginate(args.paginationOpts)`
— `order("desc")` yields newest-first directly from the index. Frontend uses
`usePaginatedQuery(api.messages.list, { channelId }, { initialNumItems: 25 })` from
`convex/react`, calling `loadMore(25)` as the user scrolls toward older history, branching UI on
`status` (`LoadingFirstPage | CanLoadMore | LoadingMore | Exhausted`). The same query and hook
usage applies with `threadId` in place of `channelId` for direct messages, since both are served
by the single shared `messages` table (see `data-model.md` §messages).

**Rationale**: First-class Convex primitive purpose-built for this exact case; fully reactive
(new/edited/deleted messages reflow automatically, satisfying Real-Time Correctness) with no
extra library.

**Alternatives considered**:
- Manual cursor pagination with `.take(n)` — rejected: reimplements what
  `paginationOptsValidator`/`usePaginatedQuery` already handle correctly, including reactivity
  edge cases.

## 5. Typing indicators

**Decision**: Reuse the presence heartbeat pattern (§2) scoped to a `typing` table keyed by
`(channelId, userId)` with an `updated` timestamp. Client sends a debounced mutation
(~every 2-3s while actively typing) updating the timestamp; the reactive query filters rows where
`Date.now() - updated < 3000`, so the indicator disappears automatically after typing stops or
the tab disconnects. An explicit clear-mutation on blur/send is an optional snappiness
improvement, not the source of truth.

**Rationale**: Avoids polling and a second infrastructure mechanism beyond presence; resilient to
abrupt disconnects, unlike a pure start/stop event scheme which can get stuck showing "typing…"
indefinitely.

**Alternatives considered**:
- Explicit start/stop events only — rejected: leaves a stuck indicator if the stop event is never
  sent (disconnect, crash).
- `@convex-dev/presence` component for typing metadata — viable but an extra dependency; a small
  dedicated table achieves the same result (Simplicity First).

## 6. Call participant staleness & cleanup

**Decision**: `callParticipants` gets a `lastHeartbeatAt` timestamp, following the exact
heartbeat + staleness pattern already used for `presence` (§2) and `typingIndicators` (§5). While
connected to a call, the client calls a `calls.heartbeat({ callId })` mutation every ~5s (same
interval/lifecycle as the presence heartbeat, scoped to the call instead of globally). Staleness
is enforced at read/write time in three places, deliberately avoiding a background cron job:

- **Read time**: `calls.listParticipants` filters out any row where
  `Date.now() - lastHeartbeatAt > STALE_THRESHOLD_MS` (~15s, 3x the heartbeat interval). A
  crashed/disconnected participant disappears from every other client's roster — and therefore
  triggers the peer-teardown branch of §3's roster-diff logic — within one stale window, with no
  explicit "leave" signal required.
- **Join time**: before checking the 4-participant capacity, `calls.join` deletes any stale
  `callParticipants` rows for that `callId`. This prevents a crashed participant's ghost row from
  permanently occupying a capacity slot and wrongly blocking a real join (the "channel is full"
  edge case must reflect live participants, not ghosts).
- **Heartbeat time**: `calls.heartbeat` opportunistically deletes any *other* stale rows in the
  same call while it updates the caller's own row. This is what actually reaps a call down to zero
  participants (letting it be deleted, per the existing "last participant leaves ends the call"
  rule) once everyone else has crashed, instead of waiting for a future join that may never come.

A call abandoned by every participant at once (no one left to heartbeat) is not reaped instantly —
its rows are simply filtered out of every read until the next `calls.join` on that channel
opportunistically cleans them up. This mirrors the tradeoff already accepted for
`typingIndicators` ("cleaned up when stale... rather than requiring a dedicated cleanup job") and
avoids introducing Convex's cron/scheduled-function machinery for a v1 at this scale.

**Rationale**: Reuses a pattern already validated for presence and typing instead of inventing a
new cleanup mechanism, satisfying Simplicity First while closing the "network drop leaves a ghost
participant forever" edge case identified in the spec.

**Alternatives considered**:
- A Convex cron job sweeping stale `callParticipants` rows on a timer — rejected: adds a
  scheduled-function dependency and a second cleanup mechanism alongside the read/write-time
  reaping presence and typing already use; unjustified at this scale.
- Relying solely on `calls.leave`/`beforeunload` — rejected: doesn't cover crashes or abrupt
  network loss, which is exactly the gap this decision closes.

## 7. Testing approach

**Decision (Vitest/Convex)**: Use `convex-test` with Vitest (`edge-runtime` environment). Call
`convexTest(schema)` to get a test handle `t`; use `t.withIdentity({ subject: "user123", ... })`
to simulate authenticated/unauthenticated/wrong-user callers, directly exercising the
authorization branches Security Basics requires. Known limitations: it's a JS mock of the backend
(not the real runtime), and scheduled/cron functions must be triggered manually in tests.

**Decision (Playwright/WebRTC)**: Launch Chromium with `--use-fake-device-for-media-stream`
(synthetic camera/mic) and `--use-fake-ui-for-media-stream` (auto-grants `getUserMedia` prompts)
via `launchOptions.args` in `playwright.config.ts`. Scope the two mandated smoke tests narrowly —
"send a message end-to-end" and "two browser contexts join a call and reach connected state" —
rather than asserting on decoded audio/video content.

**Rationale**: `convex-test` is the officially documented unit-testing path for Convex functions
and directly supports simulating identities. The two Chromium flags are the standard mechanism
for CI-safe WebRTC testing without real devices or blocking permission dialogs.

**Alternatives considered**:
- Testing against a real local `convex dev` backend instead of `convex-test` — rejected as
  primary strategy: slower, requires a running backend process in CI; useful only as an optional
  manual check.
- Asserting on actual audio/video frame content in Playwright — rejected as overkill for a
  10-user demo; connection-state assertions are sufficient signal.

## Documented risk

Google's public STUN server (`stun.l.google.com:19302`) has no official deprecation notice but is
an unsupported, no-SLA free service. Acceptable for a demo; flagged here as a known limitation
rather than a guarantee, per §3.
