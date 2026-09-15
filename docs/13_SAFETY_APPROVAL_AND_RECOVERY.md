# Safety, Approval and Recovery

## Safety Model
Autonomy is bounded by policy. The system should prefer stopping over guessing when an action could damage the brand, account, customer relationship, or platform compliance.

## Risk Levels
- **Low:** routine, previously approved content patterns.
- **Medium:** new topics, claims, formats, or audience-sensitive content.
- **High:** legal/financial/medical claims, sensitive personal matters, controversial subjects, account/security changes, or anything outside established policy.

Medium/high-risk content requires human review unless an explicit policy later authorizes autonomous handling.

## Approval Record
An approval contains the approving actor, content/version hash, timestamp, scope, and optional note. Editing an approved asset creates a new version and invalidates the previous approval where material.

## Recovery
- pause jobs for broken credentials
- retry transient provider errors with bounded backoff
- preserve failed payload metadata without exposing secrets
- allow cancellation of queued jobs
- allow manual re-run after correction
- maintain audit history

## Provider Safety
Never bypass platform restrictions, rate limits, permission checks, or review requirements. No unofficial endpoint should be silently substituted for an official API in production.

## Incident Handling
A connector incident can place the connector into `degraded` mode. The core engine may continue drafting/planning while publication jobs remain blocked until the dependency is healthy.

## Auditability
Important decisions and state transitions must be traceable to a user, agent, scheduler, or connector with a correlation ID.
