# A Hex project is one data model with a column group per SQL cell, named by the cell's id

- **Status:** Accepted
- **Revisions:** v1 2026-10-27 (initial)
- **Deciders:** Hex connector maintainers (review of the Hex data models PR, #36357)
- **Guard:** `ingestion/tests/unit/topology/dashboard/test_hex_cell_lineage.py`
  (`test_one_data_model_per_project_with_a_struct_per_sql_cell`,
  `test_a_renamed_cell_keeps_its_column_group`, `test_a_bare_table_name_needs_a_schema`,
  `test_a_table_in_two_prefixes_gets_no_lineage`, `test_a_failed_read_keeps_the_existing_data_model`)
- **Related:** #36357

## Context

Hex has no data model of its own: a project is a notebook of SQL cells, many of which query another
cell's result rather than a warehouse table. To give a Hex dashboard column lineage, the connector
builds a `DashboardDataModel` from the cells' SQL. Users then curate its columns (descriptions,
tags) and column lineage points at them, so their names are a contract: renaming them orphans that
work. Resolving the tables a cell reads is a guess when the SQL leaves the database or schema to
the Hex connection, and a run that can't read Hex or the table search would otherwise rebuild or
delete the data model from incomplete input.

## Decision

- A Hex project is one data model, `HexDataModel`, named by the project id.
- It has one `STRUCT` column per SQL cell, named by the cell's `staticId` (the export's `cellId`)
  and displayed with the cell's label; the cell's output columns are its children.
- A table a cell reads resolves only with a known schema (from the SQL, the connection's default
  schema, or a db service prefix) and only when exactly one table matches across all
  `dbServicePrefixes`. Otherwise it gets no lineage.
- When the project's cells, the data connections, or the table search can't be read, the existing
  data model is kept as it is (marked as seen, still linked to its dashboard) and not rebuilt.

## Consequences

- Renaming or reordering cells in Hex keeps the curated metadata and lineage; the label shown in
  OpenMetadata follows Hex.
- A cell's columns are reached as `<service>.model.<projectId>.<cellStaticId>.<column>`.
- A table referenced by a bare name gets no lineage unless the connection or a prefix supplies its
  schema, rather than a guess.
- Revisit if Hex exposes a semantic model or a stable per-cell name that users see, or if a missing
  edge for an ambiguous table is reported as worse than a wrong one.
