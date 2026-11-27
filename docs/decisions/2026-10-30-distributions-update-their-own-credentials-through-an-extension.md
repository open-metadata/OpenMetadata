# Distributions update their own stored credentials through a secrets update extension

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `SecretsManagerUpdateExtensionTest`
- **Related:** `SecretsManagerUpdateExtension`, `SecretsManagerUpdateService`,
  ADR:2026-10-30-owned-secret-keys-are-derived-from-owner-ids

## Context

`SecretsManagerUpdateService` brings OpenMetadata's own stored credentials up to date on every
`migrate` and `migrate-secrets`. A distribution can store credentials in tables OpenMetadata does not
know, and deployments start these commands through OpenMetadata's own ops script, so an override in a
distribution's command class is not reached.

## Decision

- A distribution registers a `SecretsManagerUpdateExtension` in
  `META-INF/services/org.openmetadata.service.secrets.SecretsManagerUpdateExtension`.
- `SecretsManagerUpdateService.updateEntities` runs every registered extension after OpenMetadata's
  own entities, on every `migrate` and `migrate-secrets`, so an extension must leave credentials
  that are already up to date as they are.
- An extension that throws, or a registration that cannot be loaded, does not stop the others; once
  all have run, the update fails and names them. Discovery stops after ten unreadable
  registrations.

## Consequences

Every ops script that runs these commands updates every stored credential, whichever distribution
it belongs to. OpenMetadata keeps no knowledge of where a distribution's credentials live.
