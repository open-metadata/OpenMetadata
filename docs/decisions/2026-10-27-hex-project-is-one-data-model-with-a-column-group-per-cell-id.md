# A Hex project is one data model with a column group per SQL cell, named by the cell's id

- **Status:** Accepted
- **Revisions:** v1 2026-10-27 (initial) · v2 2026-10-29 (cells reading a broken cell keep their groups)
- **Deciders:** Hex connector maintainers (review of the Hex data models PR, #36357)
- **Guard:** `ingestion/tests/unit/topology/dashboard/test_hex_cell_lineage.py`
  (`test_one_data_model_per_project_with_a_struct_per_sql_cell`,
  `test_a_renamed_cell_keeps_its_column_group`, `test_a_bare_table_name_needs_a_schema`,
  `test_a_table_in_two_prefixes_gets_no_lineage`, `test_a_failed_read_keeps_the_existing_data_model`,
  `test_a_column_passed_through_keeps_its_tables_casing`, `test_quoted_identifiers_resolve_whatever_their_case`,
  `test_a_cell_too_large_to_inline_leaves_its_chained_cells_untraced`,
  `test_cells_past_the_projects_budget_leave_their_chained_cells_untraced`,
  `test_rate_limited_requests_are_retried`, `test_without_data_connections_an_existing_data_model_is_kept`,
  `test_a_cell_that_stops_parsing_keeps_its_group`, `test_cells_reading_a_broken_cell_keep_their_groups`)
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
- A child column is named by the cell's output name, lower-cased, since columns resolve
  case-insensitively: a quoted alias keeps its spelling, and a column passed straight through keeps
  its table's casing.
- A table a cell reads resolves only with a known schema (from the SQL, the connection's default
  schema, or a db service prefix) and only when exactly one table matches across all
  `dbServicePrefixes`. Otherwise it gets no lineage.
- When the project's cells, the data connections, or the table search can't be read, the existing
  data model is kept as it is (marked as seen, still linked to its dashboard) and not rebuilt. A
  project without a data model still gets one when only the data connections are missing.
- A cell whose SQL fails to parse (a draft being edited) keeps its column group from the existing
  data model, with what users curated on it.
- A chained cell is traced through the cells it reads only while they stay small: a cell over
  `MAX_INLINED_NODES` (10,000 sqlglot nodes), or past `MAX_STORED_NODES` (100,000) for the project,
  is not inlined, and the cells reading it list their columns without lineage. Each cell inlines
  all the ones it chains to, so a notebook where every cell joins the previous ones doubles in size
  per cell; real cells are a few hundred nodes.
- The Hex client retries 429 (with 503/504) on the REST client's default budget, 3 retries with a
  30s wait that grows each time, and never treats 429 as a hard limit: Hex allows about 30
  requests a minute per endpoint, and the export is called once per project.

## Consequences

- Renaming or reordering cells in Hex keeps the curated metadata and lineage; the label shown in
  OpenMetadata follows Hex.
- A cell's columns are reached as `<service>.model.<projectId>.<cellStaticId>.<column>`.
- A table referenced by a bare name gets no lineage unless the connection or a prefix supplies its
  schema, rather than a guess.
- Changing how child columns are cased renames them, which orphans what users curated on them.
- A large workspace is slow to ingest, about 30 projects a minute, rather than losing projects to
  rate limiting.
- Revisit if Hex exposes a semantic model or a stable per-cell name that users see, or if a missing
  edge for an ambiguous table is reported as worse than a wrong one.

## Amendment: cells reading a broken cell keep their groups (v2, 2026-10-29)

A cell whose SQL fails to parse used to keep only its own group. The cells reading its result lost
theirs: dataframe SQL over it was dropped, and a warehouse cell on its connection searched its name
as a table and came back with UNKNOWN columns and no lineage. Now a cell that reads a failed cell
(under the same chaining rules: same connection, or any for dataframe SQL) fails too, and so on down
the chain, so each keeps its group from the existing data model. A new project's cells chained on a
broken cell get no group until it parses, as for the broken cell itself.
