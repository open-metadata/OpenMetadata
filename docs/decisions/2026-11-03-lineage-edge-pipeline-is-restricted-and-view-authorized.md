# A lineage edge's pipeline must be a pipeline or stored procedure, and linking one needs view access to it

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial); v2 2026-11-03 (type predicate extracted to
  `LineageEdgePipeline` so the cleanup migration shares it without initializing the search client;
  PATCH authorizes the pipeline it resolves from the row it is about to write)
- **Deciders:** harshsoni2024
- **Guard:** `LineageEdgePipelineAuthorizationIT`, `LineageRepositoryTest`
- **Related:** scanner finding ANT-2026-RL0ZDKB8 (open-metadata/openmetadata-collate#7797),
  [a service connection is returned only to bots and editors](2026-10-26-service-connection-visibility-follows-edit-permission.md)

## Context

A lineage edge names a third entity besides its two ends: `lineageDetails.pipeline`. The write routes
authorized only `EDIT_LINEAGE` on the two ends; the pipeline was accepted for any entity type and
never authorized. `LineageRepository` then copied that entity, as stored, into the downstream entity's
`upstreamLineage` search document, which every user can read. Naming a database service as the
"pipeline" copied the service's `connection` — password fields as replayable `fernet:` ciphertext —
into a document readable by users who get 403 on the service itself, bypassing both the masking
boundary of [the service-connection record](2026-10-26-service-connection-visibility-follows-edit-permission.md)
and deny/domain rules. All four lineage write routes and the OpenLineage ingest endpoint reached it.

## Decision

- **Type.** `lineageDetails.pipeline` may be only a `pipeline` or a `storedProcedure`
  (`LineageEdgePipeline.isSupportedType`, a pure predicate the repository, the resources and the
  cleanup migration share without pulling in the search client). Any other type is refused with 400 before anything is
  stored, on all four lineage write routes; the OpenLineage ingest path resolves a pipeline from the
  event and so never names another type. An edge already stored with another type is indexed without
  the entity, never with a copy of it.
- **Authorization.** Linking a pipeline the stored edge does not already carry requires `VIEW_BASIC`
  on that pipeline, on top of `EDIT_LINEAGE` on the two ends — because the edge copies it into a
  document every user can read. A pipeline already on the edge is not re-checked: ingestion re-sends
  it on every write and it may have been deleted since. `LineageRepository.newlyLinkedEdgePipeline`
  is the single decision both `LineageResource` and `OpenLineageResource` apply. A PATCH resolves and
  authorizes the pipeline from the same row it is about to persist, inside the repository, so a
  concurrent write cannot swap in a different, unviewable pipeline between the check and the insert.
  `VIEW_BASIC` is the
  minimum that closes the read; requiring `EDIT_LINEAGE` on the pipeline instead would also cover the
  service-level edges drawn through its service, and remains a one-line change if wanted.
- **Existing data.** A one-time 2.1.0 data migration (`LineageEdgePipelineCleanupMigration`) clears
  the `pipeline` reference from every stored edge that names a non-pipeline type, and logs each
  cleared reference.

## Consequences

- A caller with `EDIT_LINEAGE` on both ends but no view access to a pipeline now gets 403 when
  linking it — a deliberate behavior change.
- **Operators must act on upgrade.** The migration clears the database rows, but the copies already
  written to the search index are removed only by a reindex, so operators should reindex after
  upgrading. And because a leaked `fernet:` token is accepted back as a password
  (`SecretsManager.encryptPasswordFields`), operators should rotate the credentials of every service
  the migration logs as having been an edge pipeline.
- Not closed here: the server still accepts caller-supplied `fernet:` values as passwords, and the
  copy of a genuine pipeline is still the full stored object (adding
  `upstreamLineage.pipeline.connection` to the search excluded-fields list would harden a future
  schema change). These are tracked separately.
