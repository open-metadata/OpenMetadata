# A masked connection secret is restored only while the connection still points at the same endpoint

- **Status:** Accepted
- **Revisions:** v1 2026-10-24 (initial); v2 2026-10-24 (fail-closed: exempt known-safe fields rather than enumerate endpoint fields)
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
  the stored value) **and** changes any field that is not known-safe. The caller must re-enter the
  secret.
- Known-safe fields — the only ones that cannot change where the connection points — are ingestion
  filter patterns (names ending `filterPattern`), capability flags (names starting `supports`) and
  free-text descriptions. Changing one of these keeps the same target, so the masked secret is
  restored without re-entry.
- The guard **fails closed**: it exempts the known-safe fields rather than trying to enumerate every
  endpoint field. A connector-specific target the code does not recognise — an Oracle TNS descriptor,
  a host buried in `connectionArguments`, Domo's `instanceDomain` — is therefore treated as a
  redirect and forces re-entry, instead of being silently restored. (The earlier allowlist of
  endpoint-name tokens failed open for exactly these fields.)
- Admins and bots, which may read the secret, are exempt; the guard runs on service PATCH/PUT and on
  test-connection automation workflows.
- Rejecting a secret that belongs to another entity (a foreign `secret:`/`fernet:` value) regardless
  of endpoint change is the masker's job — ADR for OM#36016 — not this guard's.

## Consequences

- Changing a field that does not redirect the connection but is not on the safe list (for example
  `databaseName` or `scheme`) while leaving the secret masked will ask for the secret again. This is a
  deliberate, safe default; widen `EXEMPT_FIELD_SUFFIXES`/the `supports` prefix only for fields that
  provably cannot change where a secret is sent.
- The guard compares masked copies of the two configs, so it never needs the cleartext secret.
