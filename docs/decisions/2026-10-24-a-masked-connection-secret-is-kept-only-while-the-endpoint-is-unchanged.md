# A masked connection secret is restored only while the connection still points at the same endpoint

- **Status:** Accepted
- **Revisions:** v1 2026-10-24 (initial); v2 2026-10-24 (fail-closed: exempt known-safe fields rather than enumerate endpoint fields); v3 2026-10-30 (ingestion pipeline sources); v4 2026-10-30 (a storage manifest no schema matches)
- **Deciders:** backend security
- **Guard:** `ConnectionSecretsGuardTest`; `IngestionPipelineBuilderTest`; `IngestionPipelineResourceIT.test_dbtTokenMustBeReenteredWhenTheSourceMoves`, `IngestionPipelineResourceIT.test_storageManifestMatchingNoSourceSchemaIsRefused`
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

## Amendment (v3, 2026-10-30)

Ingestion pipelines keep secrets in the source they read from: a dbt project
(`sourceConfig.config.dbtConfigSource`) or a storage manifest
(`sourceConfig.config.storageMetadataConfigSource`). The same guard now runs on ingestion pipeline
PUT and PATCH for callers who are neither admins nor bots, comparing only those two sources, so a
change to the pipeline's other settings never asks for the secrets again. Storage manifest configs
are typed like dbt ones (`IngestionPipelineBuilder.addDefinedConfig`), which is what lets the masker
and the secrets manager reach their credentials at all.

## Amendment (v4, 2026-10-30)

Typing is what lets the masker and the secrets manager reach a storage manifest's credentials, so a
manifest source that matches none of the source schemas fails closed instead of staying a map:
- **Written:** the create or update is refused with 400.
- **Read back** (a config stored before this check): the manifest source is left out of what is
  returned and decrypted, and the rest of the pipeline stays readable so it can be repaired.
- **Re-stored by a secrets-manager migration**, which reads each pipeline back as above before
  encrypting it again: such a source is dropped and has to be entered again.
