# Threads API Contract

## Status
Threads integration is an official-provider connector and must be implemented against the current Meta Threads API documentation. Capabilities and scopes must be verified before enabling production behavior.

## Internal Contract
The Threads connector should expose, where currently supported and authorized:
- OAuth/account connection
- profile/account identity
- text/media publishing
- publication lookup/status
- insights/metrics retrieval
- supported reply/read operations
- disconnect/revocation

## Capability-First Design
Threads capabilities are runtime data. If a requested operation is not supported for the connected account/app, return `CAPABILITY_UNAVAILABLE` and stop the workflow.

## OAuth
The connector must store provider-issued tokens securely and associate them with a workspace-owned social account. Redirect URI, app credentials, scopes, and token lifecycle are configuration concerns, not content-engine concerns.

## Publishing Lifecycle
`draft → approved → queued → provider_submission → published | failed | needs_reauth`.

The system must persist the provider publication ID and the request idempotency key.

## Scope/Review Rule
Do not hard-code a permission list into business logic based on historical tutorials. During implementation, fetch the current official documentation and configure only scopes actually required by the selected features.

## Testing
Use mocked provider responses for deterministic tests, then run a real-account smoke test for OAuth, publishing, error handling, and metrics before calling the connector production-ready.
