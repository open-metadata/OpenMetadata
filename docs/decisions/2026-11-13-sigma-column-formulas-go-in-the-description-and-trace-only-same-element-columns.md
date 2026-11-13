# Sigma column formulas go in the column description, and lineage traces only same-element columns

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial)
- **Deciders:** Sigma connector maintainers
- **Guard:** `ingestion/tests/unit/topology/dashboard/test_sigma.py` (`test_a_workbook_element_column_shows_its_sigma_formula`,
  `test_a_sigma_data_model_column_shows_its_sigma_formula`,
  `test_a_computed_column_without_sql_gets_the_sources_of_the_columns_it_reads`,
  `test_a_computed_column_reading_two_tables_is_linked_from_each`)
- **Related:** —

## Context

Sigma returns a workbook element's columns from `/elements` as display names only. `GET /v2/workbooks/{workbookId}/columns`
and `GET /v2/dataModels/{dataModelId}/columns` add, per column, its `elementId`, `name` and `formula` ("Column formula or
source column reference"). Without an element's SQL, a calculated column (`Total` from `[Cost] + [MRP]`) gets no column
lineage, because no warehouse column carries its name.

OpenMetadata's `Column` has no field for a formula. Sigma's docs write a column of the same element as a bare
`[Column 1] + [Column 2]`, a column of another table as `[table name/Column]`, and a control as `[Control-ID]`; they do
not say how a name containing `/` or `]` is escaped, how `table name` resolves when several sources share it, or whether
names are case-sensitive.

## Decision

- A column's Sigma formula is written to its description as ``**Formula:** `<formula>` ``, for workbook element columns
  and Sigma Data Model element columns. A formula that only names a source column (`[ORDERS/Amount]`, as every column
  read straight from a table has) is not written, as its lineage already shows it. A column whose name its element holds
  twice gets none, as the rows cannot be told apart; a failed `/columns` read writes none.
- For an element without SQL, a column whose formula names other columns of its element as bare `[Name]` references
  takes the sources of those columns, directly or through other computed columns (as the Looker connector follows
  `${field}` within a view), and not a warehouse column that shares its name. A name must match a column of the element
  exactly; a reference naming none, such as a control, adds nothing. Edges stay one per source table, each carrying
  that table's columns.
- A formula that also names another element or source (`[Name/Column]`) or holds an escape is not traced. Only the
  existing rule's tables count, and only when every source of the element was found.

## Consequences

- On a re-run the server keeps a stored column description against an ingestion bot update unless
  `overrideMetadata` is on, so a description written by a user is kept, and so is a formula that later changed in Sigma
  until `overrideMetadata` is turned on.
- Cross-element and cross-source references stay without column lineage until Sigma documents how their first segment
  resolves; tracing them would mean guessing which of several same-named sources is meant.
- One extra paged call per workbook (when data models are ingested) and per Sigma Data Model.
