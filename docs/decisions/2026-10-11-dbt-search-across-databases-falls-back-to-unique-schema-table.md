# dbt's searchAcrossDatabases falls back to a unique schema.table match when the database differs

- **Status:** Accepted
- **Revisions:** v1 2026-10-11 (initial)
- **Deciders:** Ingestion maintainers (PR #35020)
- **Guard:** `TestTableLookupAcrossDatabaseNames` in `ingestion/tests/unit/test_dbt.py`
- **Related:** issue #34633; PR #35020

## Context
A dbt manifest names a node's database the way the dbt adapter sees it, which need not be the name
the table was ingested under. With dbt-trino writing through a Trino BigQuery catalog, the manifest
database is the catalog name, while the BigQuery connector ingests the same table under the GCP
project id. `searchAcrossDatabases` only relaxed the service, so such a table was never found: it
got no dbt model, lineage or tests, and the run still reported success.

## Decision
`DbtSource._get_table_entity` resolves a node in this order, stopping at the first hit:

1. `<configured service>.<db>.<schema>.<table>`
2. with `searchAcrossDatabases`: `*.<db>.<schema>.<table>`
3. with `searchAcrossDatabases`: `*.*.<schema>.<table>`, compared case-insensitively on schema and
   table, accepted **only when exactly one table matches**. With two or more matches nothing is
   attached and the candidates are logged.

Upstreams are recorded under the FQN of the table that was found, not the FQN built from the
manifest, so lineage, dbt tests and exposures follow the resolved table.

## Consequences
Engine aliases (Trino catalogs and the like) resolve with no configuration. The cost is that a
model whose database is not in OpenMetadata at all, such as a dev target when only prod is
ingested, attaches to a uniquely named `schema.table` in another database, and with
`dbtUpdateDescriptions` or `dbtUpdateOwners` on it writes to that table. Step 3 refuses ambiguous
matches but cannot tell such a table from an aliased one.

The alternative was an explicit dbt-database to OpenMetadata-database mapping in `dbtPipeline.json`.
It is exact, but it is a new contract in the schema, the UI and the docs, and it does nothing until
a user knows to fill it in. Revisit with that mapping if the unique match proves to attach
unrelated tables in practice; the mapping would then be consulted before step 3.
