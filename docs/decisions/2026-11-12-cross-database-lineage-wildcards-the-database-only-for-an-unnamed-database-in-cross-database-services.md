# Cross-database lineage wildcards the database only when the query names none, only in the cross-database services, and only for a unique match

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** joaopamaral
- **Guard:** `ingestion/tests/unit/lineage/test_cross_database_lineage_sql.py` (`test_cross_database_fallback_*`)
- **Related:** #37498, #37501

## Context
`get_table_entities_from_query` resolves a table reference with the database the query names or,
when it names none, the database of the query's context (for a view, the view's own catalog). When
the same storage is exposed through two catalogs, a view in one catalog reads `schema.table` that
another service ingested under a different database name. Every lookup then uses the view's
database, nothing matches, and no lineage edge is created even with `processCrossDatabaseLineage`
and `crossDatabaseServiceNames` configured. A database-wildcard lookup (`<service>.*.<schema>.<table>`)
resolves it, but the function serves every lineage source, including plain query lineage with
cross-database lineage off, so an unscoped wildcard can link a table the query never referenced, or
several same-named tables at once.

## Decision
After the database-scoped lookups miss, the function retries with the database wildcarded only when
all of these hold:
- the query did not name a database: a database written in the query is never overridden;
- the lookup runs only in the cross-database services. `service_names` is the current service
  followed by `crossDatabaseServiceNames`, so the retry searches `service_names[1:]`, never the
  current service, where the context database stays authoritative, and does nothing when
  cross-database lineage is off;
- exactly one table matches in the first service that has any. Two or more are ambiguous and the
  reference stays unresolved.

There is no schema wildcard: the schema always comes from the query or its context.

## Consequences
Views over storage shared by two catalogs get their lineage, and no other lineage source changes
behaviour unless cross-database lineage is configured. A reference that matches several tables across
databases is left unresolved instead of guessed; resolving it needs the query to name the database,
or a mapping between catalogs, which would be the next step if such duplicates are common.
