# dbt's catalogMapping maps a manifest database to the database it is ingested under

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial); v2 2026-10-16 (query lineage)
- **Deciders:** Ingestion maintainers
- **Guard:** `TestCatalogMapping` in `ingestion/tests/unit/test_dbt.py`
- **Related:** issue #34633; PR #35020 (earlier, inference-based approach)

## Context
A dbt manifest names a node's database the way the dbt adapter sees it, which need not be the name
the table was ingested under. dbt-trino writes the Trino catalog name, while the BigQuery connector
ingests the same table under the GCP project id. The two never match, so such tables got no dbt
model, lineage or tests, and the run still reported success. `searchAcrossDatabases` only relaxes the
service, not the database.

A Trino catalog points to exactly one database of the engine behind it: the Trino and Starburst
BigQuery connectors "can only access a single GCP project", and the Snowflake and PostgreSQL ones a
single database. A catalog name therefore identifies one OpenMetadata database without ambiguity.

## Decision
The dbt agent takes an optional `catalogMapping` (`dbtPipeline.json`): a map from a manifest
database name to an OpenMetadata database name, keys compared case-insensitively.
`DbtSource._get_table_entity` resolves a node whose manifest database is mapped by looking up
`<configured service>.<mapped db>.<schema>.<table>`, then `*.<mapped db>.<schema>.<table>`, whether
or not `searchAcrossDatabases` is on, since the mapped database normally belongs to another service
than the engine dbt ran on. If neither finds a table, the miss is logged and the existing lookup runs
with the manifest database.

Upstreams are recorded under the FQN of the table that was found, and the domain, data products and
custom properties read from `meta.openmetadata` are keyed by it, so lineage, dbt tests, exposures and
governance metadata follow the resolved table rather than the FQN built from the manifest.

Query lineage parses the model's compiled SQL, which names its sources by the catalog too, so the
mapped catalogs in its three-part table names are swapped for their databases before parsing;
otherwise column lineage would never find the source tables.

The `metadata ingest-dbt` CLI accepts the same map as `openmetadata_catalog_mapping` in the dbt
project's `vars`.

## Consequences
The mapping lives in the ingestion configuration, so it needs no change to the dbt project and one
entry covers every model, source, snapshot and semantic model of a catalog, across projects. Nothing
is inferred: an unmapped catalog behaves exactly as before.

The alternatives were a `meta.openmetadata` key on each dbt node, which needs a dbt code change and
release and is dropped by dbt on any node that declares its own `openmetadata` block, and matching
on schema and table name alone, which attaches dbt metadata to an unrelated table whenever the real
one is not ingested and a namesake exists in another database. Revisit if an engine is found whose
catalog spans several OpenMetadata databases; the mapping would then need a schema-level key.
