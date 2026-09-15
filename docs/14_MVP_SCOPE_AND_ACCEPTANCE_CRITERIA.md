# MVP Scope and Acceptance Criteria

## MVP Objective
Prove the complete autonomous-marketing foundation with a real owner, real brand context, and at least one real social publication path.

## In Scope
- Workspace and brand profile.
- Idea intake.
- Content planning.
- Brand-aware content generation.
- Human approval.
- Social account connection.
- One real publishing flow per supported connector where access is available.
- Scheduling queue.
- Publication status/audit log.
- Basic analytics ingestion.
- Failure and reauthorization handling.

## Out of Scope
- Full SaaS billing.
- Advanced attribution.
- Autonomous DMs.
- Paid ads.
- Complex team permissions.
- Large-scale multi-tenant infrastructure.

## Acceptance Criteria
1. User can create a workspace and brand profile.
2. User can submit an idea without manually formatting it for social media.
3. System produces a structured content plan and channel variants.
4. User can approve/reject and the system records the decision.
5. User can connect a supported social account through the intended OAuth flow.
6. System detects missing permissions/capabilities before publishing.
7. Approved content can enter a schedule.
8. A real publication returns a provider ID and status.
9. Duplicate retries do not intentionally create duplicate publications.
10. Failed auth/provider jobs become recoverable states.
11. No secrets appear in source code or normal logs.
12. Publication and basic metric data can be traced back to the originating content.

## MVP Proof
The strongest proof is not a polished dashboard. It is a real content item going from raw idea to approved publication and returning measurable feedback through the system.
