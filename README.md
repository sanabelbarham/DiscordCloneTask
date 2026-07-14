# Discord Clone

A real-time chat and voice/video community platform (Discord-style), built as a single Vite +
React 18 SPA backed entirely by [Convex](https://www.convex.dev/) (typed schema, reactive
queries/mutations, built-in auth). See `specs/001-realtime-chat-video/` for the full spec, plan,
data model, API contracts, and task breakdown this implementation follows.

## Setup

```bash
npm install
npx convex dev   # first run: log in / create a Convex project, then leave running
                  # (writes .env.local with VITE_CONVEX_URL — never commit this file)
npm run dev       # second terminal, Vite dev server on http://localhost:5173
```

Open the app in two different browser sessions (e.g. a normal window + a private window) to see
presence, messaging, and calls update live between two accounts — see
`specs/001-realtime-chat-video/quickstart.md` for a full walkthrough.

## Testing

```bash
npm run typecheck   # tsc -b --noEmit
npm run lint
npm run test:unit   # Vitest + convex-test — auth/authorization branch coverage
npm run test:e2e    # Playwright — send-message.spec.ts, join-call.spec.ts (requires `npm run dev`)
```

## Known limitation: no TURN server

Voice/video calls use direct peer-to-peer WebRTC (mesh topology, up to 4 participants) with
Google's public STUN server (`stun:stun.l.google.com:19302`) for NAT traversal. There is no TURN
relay configured. This is sufficient for most home/office networks at the demo scale this project
targets (see spec Clarifications), but two participants both behind a symmetric NAT or a
restrictive corporate firewall may fail to establish a direct connection. Provisioning a TURN
server (e.g. Twilio's Network Traversal Service, or a self-hosted `coturn`) would resolve this but
was deliberately deferred — see `specs/001-realtime-chat-video/research.md` §3.
