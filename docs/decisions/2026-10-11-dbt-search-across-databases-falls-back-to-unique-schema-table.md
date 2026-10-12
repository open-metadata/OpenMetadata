# dbt's searchAcrossDatabases falls back to a unique schema.table match when the database differs

- **Status:** Accepted
- **Revisions:** v1 2026-10-11 (initial); v2 2026-10-12 (explicit `meta.openmetadata.database` mapping ahead of the fallback)
- **Deciders:** Ingestion maintainers (PR #35020)
- **Guard:** `TestTableLookupAcrossDatabaseNames` and `TestTableLookupWithDatabaseMapping` in `ingestion/tests/unit/test_dbt.py`
- **Related:** issue #34633; PR #35020

## Context
A dbt manifest names a node's database the way the dbt adapter sees it, which need not be the name
the table was ingested under. With dbt-trino writing through a Trino BigQuery catalog, the manifest
database is the catalog name, while the BigQuery connector ingests the same table under the GCP
project id. `searchAcrossDatabases` only relaxed the service, so such a table was never found: it
got no dbt model, lineage or tests, and the run still reported success.

## Decision
`DbtSource._get_table_entity` resolves a node in this order, stopping at the first hit:

0. when the node sets `meta.openmetadata.database`: `<configured service>.<mapped db>.<schema>.<table>`,
   then `*.<mapped db>.<schema>.<table>`, whether or not `searchAcrossDatabases` is on. A mapping
   that finds nothing is logged and the lookup continues with step 1.
1. `<configured service>.<db>.<schema>.<table>`
2. with `searchAcrossDatabases`: `*.<db>.<schema>.<table>`
3. with `searchAcrossDatabases`: `*.*.<schema>.<table>`, compared case-insensitively on schema and
   table, accepted **only when exactly one table matches**. With two or more matches nothing is
   attached and the candidates are logged.

The mapping sits in `meta.openmetadata` next to `glossary`, `tags` and `domain`, so it is set in the
dbt project, per folder through `+meta` in `dbt_project.yml`, and each node (model, source,
snapshot, semantic model) carries its own. dbt replaces rather than merges a nested `openmetadata`
block, so a node that declares its own block has to repeat `database`.

Upstreams are recorded under the FQN of the table that was found, not the FQN built from the
manifest, so lineage, dbt tests and exposures follow the resolved table. The domain, data products
and custom properties read from `meta.openmetadata` are keyed by that FQN too.

## Consequences
Engine aliases (Trino catalogs and the like) resolve exactly when mapped, and with no
configuration when the schema and table name are unique. The cost is that a
model whose database is not in OpenMetadata at all, such as a dev target when only prod is
ingested, attaches to a uniquely named `schema.table` in another database, and with
`dbtUpdateDescriptions` or `dbtUpdateOwners` on it writes to that table. Step 3 refuses ambiguous
matches but cannot tell such a table from an aliased one.

The mapping does not bypass the fallback: a stale or misspelt mapping still resolves through steps
1-3 and says so in the log, rather than silently dropping the node.

The alternative to the meta key was a dbt-database to OpenMetadata-database map in
`dbtPipeline.json`. It keeps the dbt project untouched, but it is a new contract in the schema, the
UI and the docs, and it splits the node's OpenMetadata settings between the dbt project and the
ingestion pipeline. The meta key follows how glossary terms, tags and domains are already set.
