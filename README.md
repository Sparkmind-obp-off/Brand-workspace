# Brand Workspace

## Project Overview

Brand Workspace is a production-oriented, human-controlled marketing operating system. Its current vertical slice proves:

`raw idea → brand context → plan → channel-native drafts → QA → human approval → connector account → publication job → provider/simulation result → feedback → audit trail`

The application follows `UI → API → Orchestrator/domain logic → Connector → Provider` boundaries. It never reports a provider publication unless a connector returns a publication identifier. Simulation records are explicitly labeled.

## Completed Features

- Workspace and structured brand profile creation
- Raw idea and source-material intake
- Deterministic strategy, channel-native draft generation, and QA boundary
- Unsupported-claim blocking and human approval records bound to content hashes
- Multi-account-ready social account model
- One-time, expiring OAuth state validation for the mock connector
- Explicit unavailable state for unconfigured Meta and Threads connectors
- Publication state machine, capability validation, deterministic idempotency, bounded retry metadata, and re-auth handling
- Publication status/provider ID storage
- Normalized and raw metric snapshots plus bounded feedback recommendations
- Auditable state-changing actions with correlation IDs
- Operator API-key protection; secrets stay server-side
- Functional operator UI

## Entry URIs

- `GET /` — operator UI
- `GET /api/health` — public service health
- `GET|POST /api/workspaces` — list/create workspaces
- `GET /api/workspaces/:workspaceId/overview` — workspace operational state
- `POST /api/ideas` — idea → plan → draft → QA
- `POST /api/assets/:assetId/decision` — approve/reject an immutable content hash
- `POST /api/accounts/oauth/start` — create one-time OAuth state
- `POST /api/accounts/oauth/callback` — validate OAuth state and create account
- `POST /api/publications` — create idempotent publication intent
- `POST /api/publications/:publicationId/execute` — explicit execution/retry
- `POST /api/publications/:publicationId/feedback` — ingest metrics and create recommendation

All APIs except `/api/health` require `X-Operator-Key`.

## Data Architecture

Cloudflare D1 stores workspace-owned rows for brand profiles, ideas, plans, assets, approvals, OAuth states, social accounts, publications, metrics, feedback, and audit events. Provider tokens are **not** stored in ordinary rows; real connectors must use an encrypted secret reference.

Migration: `migrations/0001_initial_schema.sql`.

## Local Development

```bash
cp .env.example .dev.vars
# Set OPERATOR_API_KEY and ENABLE_MOCK_CONNECTOR=true in .dev.vars
npm install
npm run build
npm run db:migrate:local
pm2 start ecosystem.config.cjs
```

Open port 3000 and enter the configured operator key.

## Testing

```bash
npm test
npm run typecheck
npm run build
```

Tests cover transitions, validation, approval, capabilities, idempotency, mocked OAuth/publishing failures, and the internal E2E flow.

## Real Provider Smoke-Test Checklist

Meta/Threads is not production-ready until all items pass against current official provider documentation:

1. Configure HTTPS callback URI and least-privilege scopes in the provider console.
2. Store client secret/token-encryption material only as Cloudflare secrets.
3. Complete official app review where required.
4. Connect an eligible test identity; verify returned identity and runtime capabilities.
5. Publish one low-risk approved test asset.
6. Confirm provider publication ID/status and persist both.
7. Confirm duplicate execution does not create a second post.
8. Expire/revoke credentials; verify account/job move to `needs_reauth`.
9. Trigger permission denial, validation failure, rate limit, and provider outage; verify classification/retry behavior.
10. Fetch a basic metric and preserve both normalized and raw provider values.

## Not Yet Implemented / Honest Blockers

- Real Meta and Threads OAuth/publishing: requires owner credentials, approved provider access, and validation against current official docs.
- Media upload/storage: add Cloudflare R2 when image/video publishing is enabled.
- Production queue/cron: BYOK may add Cloudflare triggers; current scheduling uses explicit execution and persisted timestamps.
- Generative model integration: current content boundary is deterministic to avoid unsupported claims and external-secret dependency.
- Team RBAC and advanced autonomy are intentionally out of MVP scope.

## Environment Variables

See `.env.example`. Production requires `OPERATOR_API_KEY`. `ENABLE_MOCK_CONNECTOR=true` should only be used for a clearly labeled test environment. Provider secrets must use `wrangler pages secret put`; never commit them.

## Deployment

- Platform: Cloudflare Pages + Hono + D1
- Deployment path: Cloudflare BYOK
- Status: pending first deployment
- Production URL: pending
- Last updated: 2026-09-15

## Recommended Next Step

Provision provider-approved Meta/Threads credentials, implement the first real connector against current official documentation, and run the real-provider checklist before declaring Phase 3 complete.
