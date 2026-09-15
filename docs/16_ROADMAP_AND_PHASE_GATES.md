# Roadmap and Phase Gates

## Phase 0 — Foundation
Deliver architecture, domain model, connector contracts, security rules, and implementation prompt.

**Gate:** documents agree on one end-to-end lifecycle and no secret/API assumptions are unresolved.

## Phase 1 — Core Workspace
Build workspace, brand profile, idea intake, content objects, approvals, and audit primitives.

**Gate:** raw idea can become an approved content asset without social integration.

## Phase 2 — Connector and OAuth Foundation
Implement connector abstraction, account model, OAuth lifecycle, capability discovery, secure token handling, and mocks.

**Gate:** a supported provider account can be connected in the intended environment, or a clearly labeled mock path proves the same state machine.

## Phase 3 — Real Publishing
Implement scheduling, media preparation, provider publishing, idempotency, retries, and publication records.

**Gate:** at least one real publication succeeds end-to-end on an eligible account.

## Phase 4 — Analytics and Feedback
Collect basic metrics, normalize them, connect them to content, and produce learning recommendations.

**Gate:** the system can explain what was published, what happened, and what it recommends changing.

## Phase 5 — Higher Autonomy
Introduce policy-based autonomous scheduling, adaptive content prioritization, richer research, and multi-account/multi-brand operation.

**Gate:** autonomy operates inside explicit policies with measurable improvement and safe recovery.

## Phase Discipline
Do not advance because screens are finished. Advance only when the phase's behavioral gate passes.

## Current Strategic Order
`Architecture → real account connection → real publish → measurement → autonomy`.

The project should resist building a large autonomous agent layer before the basic publication loop is proven.
