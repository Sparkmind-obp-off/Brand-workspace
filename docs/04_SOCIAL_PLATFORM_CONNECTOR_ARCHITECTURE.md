# Social Platform Connector Architecture

## Purpose
Keep platform-specific authentication, API calls, payloads, limits, and error semantics outside the marketing engine.

## Connector Contract
Each connector should expose a stable internal interface conceptually equivalent to:
- `connectAccount()`
- `getAccountProfile()`
- `validateCapabilities()`
- `createMedia()` / provider-specific preparation
- `publish()`
- `getPublicationStatus()`
- `deleteOrUndo()` when supported
- `fetchMetrics()`
- `disconnectAccount()`

Exact operations may vary by provider; unsupported capabilities must return an explicit capability error, never a fake success.

## Adapter Responsibilities
- OAuth and token handling integration.
- Provider API versioning.
- Request/response mapping.
- Rate-limit handling.
- Retry classification.
- Provider-specific validation.
- Provider IDs and URLs.

## Core Engine Responsibilities
- Business intent.
- Content lifecycle.
- Approval policy.
- Scheduling.
- Cross-platform strategy.
- Unified publication state.
- Analytics normalization.

## Capability Registry
Each connected account should expose capabilities such as:
`text_publish`, `image_publish`, `video_publish`, `carousel_publish`, `scheduled_publish`, `insights`, `comment_read`, `comment_reply`.

Capabilities are discovered/configured at runtime and should be checked before execution.

## Error Taxonomy
- `AUTH_REQUIRED`
- `AUTH_EXPIRED`
- `PERMISSION_DENIED`
- `CAPABILITY_UNAVAILABLE`
- `VALIDATION_ERROR`
- `RATE_LIMITED`
- `PROVIDER_UNAVAILABLE`
- `MEDIA_ERROR`
- `DUPLICATE_REQUEST`
- `UNKNOWN_PROVIDER_ERROR`

## Extensibility
Adding a new platform must require a connector implementation and capability mapping, not changes to core marketing logic.
