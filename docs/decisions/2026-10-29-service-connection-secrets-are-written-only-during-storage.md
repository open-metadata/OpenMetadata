# Service connection secrets are written only during storage

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `ServiceEntitySecretsTest`, `SecretsManagerNullSecretIT#aDeniedServiceUpdateLeavesStoredCredentialsUntouched`
- **Related:** open-metadata/openmetadata-collate#7797

## Context

Create-or-update and bulk requests prepare an entity before authorizing its mutation.
Service preparation previously persisted connection secrets to an external vault, so a rejected
request could change credentials even though the service row was never written.

## Decision

Service preparation converts and validates the connection without persisting secrets. Encrypt
connection fields at the storage hooks after authorization: single writes, including version-checked
updates, and batch inserts and updates. All these paths must encrypt before serializing the row.

## Consequences

Rejected authorization does not create, replace or clear service connection secrets. Existing key
generation and references remain unchanged and require no migration. Database and vault writes
remain separate operations; this change does not make them atomic or resolve secret-key collisions.
