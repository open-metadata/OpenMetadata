# A removed connector is retired by the first data-migration step, which retypes its services and deletes its pipelines through the repository

- **Status:** Accepted
- **Revisions:** v1 2026-10-13 (initial)
- **Deciders:** Akash Verma
- **Guard:** `DeltaLakeRetirementMigrationTest`; reviewer for the next connector removal
- **Related:** open-metadata/OpenMetadata#35299; ADR:2026-10-09-data-migration-backfills-walk-ids-in-batches; the 1.13.0 Iceberg removal (`postDataMigrationSQLScript.sql`)

## Context

Removing a connector takes its value out of a service-type enum, a contract that the server, the
UI, ingestion, the SDKs and Collate all read. Rows that still carry the value no longer
deserialize: listing the services fails, and in 2.1.0 the data migration itself aborts in
`DataContractEntityReferenceMigration`, which loads tables.

The Iceberg removal used SQL in the post-data script, which runs after the data migration and so
too late for such a step. Its pipeline delete joined on the pipeline's `$.service`, which is never
stored (it is stripped before every write since #3804), so it deleted nothing. And SQL cannot reach
the pipeline service, so even a working delete would have left each pipeline's DAG deployed.

## Decision

A removed connector is retired by a Java step that runs first in that release's
`runDataMigration`, on both engines:

1. It reads the connector's ingestion pipeline ids through each service's CONTAINS relationship,
   while the services still carry the old type, the only point they can be told apart.
2. It retypes the services, their child entities and all their version snapshots to the
   `Custom<Category>` type, walking each table in `IdBatches`. A service's connection config becomes
   `{"type": "Custom<Category>"}` alone, so stored secrets do not survive as unmasked extra
   properties.
3. It deletes the connector's test-connection definition and test-connection workflows.
4. It force-deletes each pipeline through `IngestionPipelineRepository` with the migration's
   pipeline service client, which removes the DAG. An unreachable pipeline service is logged and
   the DAG left, as a service's cascade delete does, so the upgrade is never blocked.

Every retype and delete statement is keyed on the old type value, so a second run changes nothing.
The pipeline delete is the exception: its ids are read before the retype and the retype commits
first, so they are gone from the database by the time the deletes run. A failing delete is
therefore logged and skipped rather than propagated, so one unreachable pipeline cannot strand the
ones behind it; a process killed inside the delete loop still leaves those DAGs for an operator.

## Consequences

Catalog metadata on the retyped entities (descriptions, tags, owners, lineage, data quality,
contracts) survives. Search shows the old type until the next reindex. A DAG is left behind when the
pipeline service is unreachable during the upgrade, or when the upgrade is killed inside the delete
loop; both are logged with the pipeline id. An upgrade that starts from an older
release still runs that release's data migrations first; one of them that loads the removed type
would need its own guard.
