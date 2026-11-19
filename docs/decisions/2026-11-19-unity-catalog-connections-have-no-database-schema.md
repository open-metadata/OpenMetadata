# Unity Catalog connections have no databaseSchema

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** akashverma0786
- **Guard:** `ingestion/tests/unit/source/database/unitycatalog/test_connection.py` (`test_get_schemas_uses_the_first_schema_the_catalog_lists`), `bootstrap/sql/migrations/native/2.1.0/{mysql,postgres}/postDataMigrationSQLScript.sql`
- **Related:** [#37112](https://github.com/open-metadata/OpenMetadata/pull/37112)

## Context
`databaseSchema` came into `unityCatalogConnection.json` when Unity Catalog was split from the
Databricks connection (#14138), with the Databricks description: it "restricts the metadata reading
to a single schema". The Unity Catalog source has always listed every schema with `schemas.list`
and never read it. Only Test Connection did, from #28647 on, to choose the schema its probes use.
A service with `databaseSchema` set therefore ingested every schema its filters allowed, while the
form promised one.

## Decision
- `unityCatalogConnection.json` has no `databaseSchema`. A schema is selected with
  `schemaFilterPattern`, which ingestion applies.
- Test Connection probes the first schema the resolved catalog lists.
- The 2.1.0 SQL migration removes `connection.config.databaseSchema` from Unity Catalog services,
  their `databaseService.version.*` snapshots and saved Test Connection requests, on MySQL and
  Postgres. The schema sets `additionalProperties: false`, so a row still carrying the key no
  longer loads in the server (`Unrecognized field`) or in ingestion (`extra_forbidden`). Databricks
  connections keep their own `databaseSchema`, so each statement is scoped to Unity Catalog.

## Consequences
What ingestion reads does not change. A workflow YAML that still sets `databaseSchema` fails
validation after the upgrade and must drop the key; a release note says so. Test Connection can no
longer be pointed at a chosen schema: when the principal cannot read the first listed schema, the
mandatory GetTables step fails even if other schemas are readable. Revisit if that turns out to
matter, for example by probing the first schema that passes `schemaFilterPattern`.
