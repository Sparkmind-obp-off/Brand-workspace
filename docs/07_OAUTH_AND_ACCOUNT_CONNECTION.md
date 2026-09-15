# OAuth and Account Connection

## Goal
Allow a workspace owner to connect one or more social identities without coupling the workspace to a single hard-coded account.

## Connection Model
`Workspace → SocialAccount → Connector → ProviderToken`

A `SocialAccount` stores provider, provider account ID, display metadata, status, and capability snapshot. Secrets/tokens are referenced through secure storage rather than stored as ordinary application data.

## Lifecycle
1. User selects a platform.
2. System creates a state/nonce and starts OAuth.
3. Provider redirects back.
4. System validates state and exchanges the authorization code.
5. Token is securely stored.
6. Account identity and capabilities are discovered.
7. Connection becomes `active` only after validation.
8. User can disconnect or reauthorize.

## Security Requirements
- Validate OAuth state.
- Use HTTPS redirect URIs in production.
- Never expose client secrets to the browser.
- Encrypt sensitive tokens at rest.
- Redact tokens from logs.
- Use least-privilege scopes.
- Support revocation/disconnect.

## Multi-Account
The engine must resolve a target by `social_account_id`, not by a platform-wide environment variable. A workspace may eventually have multiple Instagram, Facebook, or Threads connections.

## Reauthorization
When a provider returns an authentication/permission error, mark the account `needs_reauth`, pause dependent jobs, and provide a clear reconnect action.
