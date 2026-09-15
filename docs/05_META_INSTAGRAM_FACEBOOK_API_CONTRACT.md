# Meta Instagram / Facebook API Contract

## Status
This document defines the application boundary. Exact permissions, endpoints, supported media types, and review requirements must be validated against the current official Meta documentation during implementation because provider capabilities can change.

## Architectural Rule
The application must never assume that having an Instagram/Facebook account automatically grants publishing API access. Account eligibility, app configuration, permissions, tokens, and review status are separate concerns.

## Internal Contract
The Meta connector should provide:
- account discovery/profile
- capability discovery
- media preparation
- publish request
- publication status
- insights retrieval where permitted
- disconnect/revocation handling

## Instagram
The implementation should support only officially documented publishing flows for eligible professional accounts and the exact API permissions available to the application. Media requirements, container lifecycle, publishing limits, and supported formats must be validated at runtime where possible.

## Facebook
The connector should treat Pages and user identities separately. Page access tokens and Page-level permissions must never be confused with a user's general access token. Publishing targets must be explicit.

## Configuration Contract
Provider configuration belongs outside source control:
- application/client identifier
- client secret
- OAuth redirect URI
- API base/version configuration
- secret/token storage reference

## Publication State
Map provider results into:
`queued → preparing → provider_submitted → published | failed | needs_reauth`.

## Implementation Gate
Before enabling real publishing, verify in a controlled account:
1. OAuth succeeds.
2. Required permissions are actually granted.
3. Target account is eligible.
4. A real media publication succeeds.
5. Returned provider IDs are persisted.
6. Failure and reauthorization paths work.

## No-Fake-API Rule
Mocks may be used for development and tests, but the UI must clearly distinguish mock/sandbox mode from real Meta publishing.
