# A masked connection secret is restored only while the connection still points at the same endpoint

- **Status:** Accepted
- **Revisions:** v1 2026-10-24 (initial)
- **Deciders:** backend security
- **Guard:** `ConnectionSecretsGuardTest`
- **Related:** open-metadata/openmetadata-collate#7797, open-metadata/OpenMetadata#36016

## Context

A caller who may edit a service but not read its secrets sees the connection password as `*********`.
On write, the masker restores the stored secret in place of the mask. A caller could therefore edit
the connection's host or URL to a server they control, leave the password masked, and have the
runner send the real password to that server (collate#7797 YMVEJVF6).

## Decision

- `ConnectionSecretsGuard.requireSecretsReenteredOnRetarget` refuses a write that **both** keeps a
  stored secret (the value arrives as the mask, a Fernet token, a `secret:` reference, or exactly
  the stored value) **and** changes an endpoint field — a field whose name contains any of
  `host, url, uri, endpoint, account, server, address, port` (case-insensitive). The caller must
  re-enter the secret.
- A change to a non-endpoint field (a filter, a flag, a description) keeps the same target, so the
  masked secret is restored without re-entry.
- Admins and bots, which may read the secret, are exempt; the guard runs on service PATCH/PUT and on
  test-connection automation workflows.
- Rejecting a secret that belongs to another entity (a foreign `secret:`/`fernet:` value) regardless
  of endpoint change is the masker's job — ADR for OM#36016 — not this guard's.

## Consequences

- A connection type whose endpoint field is named outside the token set above would not trigger the
  guard; extend `ENDPOINT_FIELD_TOKENS` when adding such a type.
- The guard compares masked copies of the two configs, so it never needs the cleartext secret.
