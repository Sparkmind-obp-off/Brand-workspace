# Credentials and Secrets Contract

## Principle
Credentials are infrastructure secrets, never content, configuration committed to Git, or data visible in ordinary UI responses.

## Secret Classes
- OAuth client IDs: configuration.
- OAuth client secrets: secret.
- Access/refresh tokens: secret.
- Encryption keys: secret.
- Database credentials: secret.
- Webhook signing secrets: secret.

## Storage
Production secrets should use a managed secret store or encrypted environment configuration. Local development may use an ignored `.env.local` file. `.env*` files containing real secrets must never be committed.

## Application Boundary
The browser may receive public configuration required for OAuth initiation, but never client secrets, provider tokens, encryption keys, or server credentials.

## Logging
Never log raw authorization headers, access tokens, refresh tokens, cookies, client secrets, or full provider responses if they contain credentials. Use redacted identifiers for diagnostics.

## Rotation
Support credential rotation without code changes. A rotation event should be auditable and should not require content data migration.

## GitHub Rule
The repository is safe to publish only when source files contain placeholders and documentation references variable names rather than actual secret values.
