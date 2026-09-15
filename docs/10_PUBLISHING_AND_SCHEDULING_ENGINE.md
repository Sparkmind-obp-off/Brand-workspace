# Publishing and Scheduling Engine

## Purpose
Turn approved content into reliable, observable publication jobs.

## Job Model
Each publication job contains:
- `publication_id`
- `workspace_id`
- `content_asset_id`
- `social_account_id`
- `scheduled_at`
- `status`
- `attempt_count`
- `idempotency_key`
- provider publication ID
- error classification

## State Machine
`draft → approved → scheduled → preparing → submitting → published`

Failure branches:
`needs_approval`, `needs_reauth`, `blocked`, `failed`, `cancelled`.

## Scheduling
- Store timestamps in UTC.
- Store workspace timezone separately for human-facing scheduling.
- Validate future dates and provider constraints.
- Avoid duplicate scheduling for the same logical publication.

## Idempotency
A retry must not accidentally publish the same asset twice. The system should generate a deterministic idempotency key from publication intent and persist provider request state.

## Retry Policy
Retry only transient failures. Do not automatically retry permission errors, invalid media, or policy failures. Exponential backoff should be bounded.

## Approval Gate
A publication cannot transition to `submitting` unless its approval policy allows autonomous execution or a required human approval has been recorded.

## Observability
Every transition produces an audit event with actor (`user`, `agent`, `scheduler`, `connector`), timestamp, reason, and correlation ID.
