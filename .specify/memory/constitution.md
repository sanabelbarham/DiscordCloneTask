<!--
Sync Impact Report
- Version change: [TEMPLATE] → 1.0.0 (initial ratification)
- Modified principles: N/A (first concrete adoption; all six principles newly defined)
  - I. Simplicity First (new)
  - II. Real-Time Correctness (new)
  - III. Type Safety End-to-End (new)
  - IV. Security Basics (new)
  - V. Incremental Delivery (new)
  - VI. Testable Seams (new)
- Added sections: Technology Constraints, Development Workflow, Governance (content filled)
- Removed sections: none
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (Constitution Check gate reads this file dynamically; no edit needed)
  - ✅ .specify/templates/spec-template.md (generic, no constitution-specific references to update)
  - ✅ .specify/templates/tasks-template.md (generic, testing already marked optional/spec-driven, compatible with Principle VI)
  - ✅ .claude/skills/speckit-*/SKILL.md (generic references to constitution.md path only, no agent-specific naming to fix)
- Follow-up TODOs: none
-->

# Discord Clone Constitution

## Core Principles

### I. Simplicity First

Every implementation MUST use the smallest solution that satisfies the current spec.
Speculative abstractions, unused configuration options, and libraries not already
named in the approved plan are forbidden. Adding a new dependency mid-implementation
MUST NOT happen without first updating the plan and stating why the smallest existing
solution is insufficient.

**Rationale**: As a student project, complexity is the primary risk to completion and
comprehension. Every abstraction not driven by an actual requirement adds cost without
corresponding value.

### II. Real-Time Correctness

The UI MUST reflect server state via reactive subscriptions (e.g., WebSockets, live
queries). Manual polling and requiring a page refresh to observe a state change are
forbidden. Any feature that displays data which can change on the server MUST
subscribe to updates rather than fetch once and go stale.

**Rationale**: Chat and video are inherently real-time; a UI that goes stale or needs
a refresh defeats the purpose of the product and hides bugs that a subscription model
would otherwise surface immediately.

### III. Type Safety End-to-End

TypeScript strict mode MUST be enabled across the entire codebase (frontend, backend,
and any shared packages). All database access MUST go through typed schema
definitions — untyped queries and `any`-typed database results are forbidden.

**Rationale**: End-to-end types let the compiler catch integration errors (mismatched
fields, missing awaits, wrong shapes) before they reach runtime, which matters most
for a small team without dedicated QA.

### IV. Security Basics

Every backend function that touches a protected resource MUST verify both that the
caller is authenticated and that the caller is authorized for that specific resource
— authentication alone is not sufficient. Authorization checks MUST be enforced
server-side; client-side checks are UX affordances only and are never a security
boundary.

**Rationale**: A chat/video app carries other users' messages, media, and presence
data. Skipping per-resource authorization is the most common way student projects
leak private data between users.

### V. Incremental Delivery

The application MUST build and run successfully after each completed user story. The
main branch MUST NOT be left in a broken (non-building, non-running) state at any
commit boundary. Work that cannot be finished within a single story MUST be scoped
down rather than merged in a partially-working state.

**Rationale**: Keeping main always-runnable allows the app to be demoed or graded at
any point in development and prevents unfinished work from blocking teammates.

### VI. Testable Seams

Business logic MUST be separated from UI/presentation code so it can be tested
without rendering components. Critical flows — at minimum sending a message and
joining a call — MUST have at least a smoke test verifying the flow completes
end-to-end.

**Rationale**: Full test coverage is not expected of a student project, but the flows
that define the product's core value must be protected from silent regressions as the
app evolves.

## Technology Constraints

- All code MUST be written in TypeScript with `strict: true` in `tsconfig.json`;
  use of `any` is forbidden except with an inline comment justifying why a precise
  type is not possible.
- Database access MUST be mediated by a single typed schema/ORM layer; raw untyped
  queries are prohibited.
- Real-time features MUST be built on a subscription-capable transport (WebSocket,
  Server-Sent Events, or a reactive backend such as Convex, Firebase, or Supabase
  Realtime); polling on a timer is prohibited as a substitute for subscriptions.
- New third-party libraries MUST be recorded in the feature's `plan.md` before use;
  dependencies not named in the plan MUST NOT be added mid-implementation without
  first updating the plan.

## Development Workflow

- Each user story MUST be implemented, built, and smoke-tested (per Principle VI)
  before being merged to main.
- A merge to main MUST be rejected if the build fails or a critical-flow smoke test
  fails.
- Every review (self-review is acceptable for a solo or small team) MUST confirm: no
  `any` types were introduced, no polling was introduced where a subscription was
  expected, and every new backend function checks both authentication and
  per-resource authorization.
- The Constitution Check gate in `plan.md` MUST be re-verified after Phase 1 design,
  before implementation begins.

## Governance

This constitution supersedes ad hoc practice. When a pull request or design decision
conflicts with a principle here, the principle wins unless this document is amended
first.

**Amendment procedure**: Amendments require a written rationale, a version bump per
the policy below, and propagation of any resulting changes to dependent artifacts
(`plan-template.md`, `spec-template.md`, `tasks-template.md`, and any Spec Kit command
files) within the same change.

**Versioning policy**: MAJOR for backward-incompatible removal or redefinition of a
principle; MINOR for adding a new principle or materially expanding existing
guidance; PATCH for wording, typo, or clarification fixes that do not change
enforced behavior.

**Compliance review**: Every feature's `plan.md` MUST pass the Constitution Check
gate before Phase 0 research and again after Phase 1 design. Any violation that
cannot be resolved MUST be recorded and justified in that plan's Complexity Tracking
table rather than silently ignored.

**Version**: 1.0.0 | **Ratified**: 2026-07-14 | **Last Amended**: 2026-07-14
