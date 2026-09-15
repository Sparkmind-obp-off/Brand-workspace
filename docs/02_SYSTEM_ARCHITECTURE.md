# System Architecture

## Architectural Shape
`Web/App → API → Orchestrator → Domain Engines → Connector Layer → Social APIs`

Supporting services surround the loop:
- persistent database
- object/media storage
- scheduler/queue
- secrets manager
- audit log
- analytics pipeline
- observability

## Core Modules
### Workspace Layer
Owns workspace, brand, users, roles, preferences, and connected accounts.

### Brand Context Layer
Stores positioning, audience, offers, content pillars, tone, vocabulary, examples, exclusions, and source material.

### Marketing Orchestrator
Turns goals and inputs into executable jobs. It coordinates specialized agents but owns workflow state and retries.

### Content Engine
Produces strategy, hooks, drafts, variants, media instructions, metadata, and channel-specific adaptations.

### Publishing Engine
Validates assets, resolves accounts, schedules jobs, calls connectors, handles idempotency and retries, and records results.

### Analytics Engine
Normalizes platform metrics into common concepts and feeds observations back into planning.

### Connector Layer
Provides a stable internal interface over Instagram, Facebook, Threads, and future platforms.

## Data Flow
1. User submits idea/project/experience.
2. Context service enriches it with brand knowledge.
3. Strategy engine chooses objective, audience, pillar, and channel plan.
4. Content engine generates candidate assets.
5. QA validates brand, safety, completeness, and platform constraints.
6. Approval policy decides whether human approval is required.
7. Scheduler creates publication jobs.
8. Connector publishes and returns provider IDs/status.
9. Analytics collects performance.
10. Feedback engine creates learning signals.

## Isolation
Every persistent object must be attributable to a `workspace_id`; social accounts belong to a workspace. No connector may infer ownership from a global environment variable.

## Deployment Principle
Production infrastructure must be provider-neutral. Development can use mocks/sandboxes, but production configuration must point explicitly to real services and official APIs.
