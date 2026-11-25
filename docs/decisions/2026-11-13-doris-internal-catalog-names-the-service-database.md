# A Doris `internal` catalog qualifier names the database the service ingests

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial)
- **Deciders:** Ingestion maintainers
- **Guard:** `test_internal_catalog_is_the_database_the_service_ingests`, `test_other_catalogs_keep_their_name` and `test_unscoped_references_keep_the_internal_catalog` in `ingestion/tests/unit/source/database/doris/test_doris_view_lineage.py`
- **Related:** issue #37544, issue #37537

## Context

Doris qualifies a table name with its catalog. The definitions it stores for views and materialized
views name their tables `internal`.`db`.`t`, `internal` being the catalog of Doris's own tables, and
the tables of an external catalog `<catalog>`.`db`.`t`. The connector ingests the internal catalog as
a single database, named by the connection's `databaseName`, `default` when it is not set. Lineage
read the catalog as the database and looked up `<service>.internal.<db>.<t>`, which never exists, so
no Doris view or materialized view had lineage.

## Decision

`doris/resolution.py` resolves a reference whose database part is exactly `internal` (catalog names
are case sensitive in Doris) under the database of the service: the `databaseName` of its connection,
or `default`. The name is read from the service entity once per service. Any other catalog name is
kept, so it names the database of the same name. A reference resolved without a service keeps
`internal`, since no database is known for it, and so does a reference whose service cannot be read,
with a warning.

## Consequences

Views and materialized views connect to their tables whatever `databaseName` is set to, and never to
a same-named table in another database, which mapping `internal` to a wildcard would allow. Reading
external catalogs (issue #37549) has to ingest each catalog as a database named after it, and a
producer of Doris lineage outside the connector, such as an OpenLineage emitter in Doris, has to name
the internal catalog's tables the same way. Revisit if the connector ever ingests the internal catalog
under more than one database.
