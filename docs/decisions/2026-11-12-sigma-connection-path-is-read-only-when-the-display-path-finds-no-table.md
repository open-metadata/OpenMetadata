# A Sigma table's connection path is read only when its display path finds no table

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Sigma connector maintainers
- **Guard:** `ingestion/tests/unit/topology/dashboard/test_sigma.py`
  (`test_the_connection_path_is_read_only_when_the_display_path_finds_no_table`,
  `test_the_connection_path_of_a_dataset_is_not_read`)
- **Related:** —

## Context

Without SQL, the Sigma connector finds a source table from its `/files` entry: the table name plus a display `path`
such as `Connection Root/ANALYTICS/PUBLIC`, split as text. The split loses the database when the parts are separated by
`/`, misreads a name that contains a dot, and takes the wrong part of a longer path. The table then matches several
tables or none, and gets no lineage.

`GET /v2/connections/paths/{inodeId}` returns the table's path as a list. The spec types it only as an array, and no
Sigma page says what each part is. Sigma's data model representation example names a warehouse table by a `path` of
database, schema and table (`["EXAMPLES", "PLUGS_ELECTRONICS", "PLUGS_ELECTRONICS_HANDS_ON_LAB_DATA"]`). Nothing
documents a path with another number of parts, and the endpoint answers with an error for an inode that is not a
table. No live Sigma run confirms the endpoint for the ids the connector holds.

## Decision

- The display path is tried first, unchanged. The connection path is read only when it finds no single table, only for
  a `/files` entry of type `table`, and only with `dbServicePrefixes` set.
- Only a 3-part path whose last part equals the `/files` name is used, as `[database, schema, table]`, with the same
  rule as every other Sigma reference: linked only when exactly one table matches across `dbServicePrefixes`.
- A failed read, or a path of any other shape, leaves the table without lineage, as before. A path is read once per
  table per run.

## Consequences

- No table that gets lineage today changes, and no extra call is made for it.
- A table the display path cannot place may now be linked. It is linked wrongly only if the first part of a 3-part path
  is not the database and a table of that exact database, schema and name exists in the prefix services.
- Making the connection path the first try, or reading 2-part paths, needs a live Sigma run showing the path shapes per
  warehouse type for the ids the connector holds.
