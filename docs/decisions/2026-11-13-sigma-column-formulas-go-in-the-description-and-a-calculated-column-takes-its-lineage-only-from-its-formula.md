# Sigma column formulas go in the column description, and a calculated column takes its lineage only from its formula

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial)
- **Deciders:** Sigma connector maintainers
- **Guard:** `ingestion/tests/unit/topology/dashboard/test_sigma.py` (`test_a_workbook_element_column_shows_its_sigma_formula`,
  `test_a_sigma_data_model_column_shows_its_sigma_formula`,
  `test_a_computed_column_without_sql_gets_the_sources_of_the_columns_it_reads`,
  `test_a_calculated_column_never_takes_a_same_named_warehouse_column`,
  `test_a_calculated_column_follows_the_element_it_reads`,
  `test_a_computed_column_reading_two_tables_is_linked_from_each`)
- **Related:** ADR:2026-11-12-sigma-data-model-lineage-links-only-what-its-elements-read

## Context

Sigma returns a workbook element's columns from `/elements` as display names only. `GET /v2/workbooks/{workbookId}/columns`
and `GET /v2/dataModels/{dataModelId}/columns` add, per column, its `elementId`, `name` and `formula` ("Column formula or
source column reference"). Without an element's SQL, column lineage matched each column's name against the warehouse
columns of the element's tables. A calculated column (`Total` from `[Cost] + [MRP]`) got no lineage, or the lineage of
an unrelated warehouse column that happens to share its name (`TOTAL` for `Total = [ORDERS/Amount] * 2`, or for
`Total = 1`).

OpenMetadata's `Column` has no field for a formula. Sigma's docs give the reference forms:
- a column of the same element: `[Column 1] + [Column 2]`;
- a column read straight from a warehouse table: `[table name/column name]`. The data model representation example has
  the formula `[PLUGS_ELECTRONICS_HANDS_ON_LAB_DATA/Order Number]` for a source whose path is
  `["EXAMPLES", "PLUGS_ELECTRONICS", "PLUGS_ELECTRONICS_HANDS_ON_LAB_DATA"]`, so the prefix is the table's own name;
- a column of another element: `[Customers/Cust Name]` (Lookup). Sigma "recommends giving unique names to data
  elements", so names can repeat;
- a column reached through a data model relationship: `[TRIP/Start Station Details/Dock Count]`, which names the
  relationship but not the table that owns `Dock Count`;
- a control: `[Control-ID]`.

The element lineage response (`GET /v2/workbooks/{workbookId}/lineage/elements/{elementId}`) names each node and
connects them with edges: the element's own `sheet` node, the elements it reads (`sheet`, with their `elementId`) and
the tables (`table`). Sigma does not document how a name containing `/` or `]` is escaped, nor its case rules.

## Decision

- A column's Sigma formula is written to its description as ``**Formula:** `<formula>` ``, for workbook element columns
  and Sigma Data Model element columns. A formula that only names a source column (`[ORDERS/Amount]`, as every column
  read straight from a table has) is not written, as its lineage already shows it; a three-part reference names a
  relationship and is written. A column whose name its element holds
  twice gets none, as the rows cannot be told apart; a failed `/columns` read writes none.
- For an element without SQL, a column takes the sources its formula names:
  - `[Column]` gives the sources of that column of the same element, directly or through other columns (as the Looker
    connector follows `${field}` within a view). A name matching no column of the element, such as a control, adds
    nothing.
  - `[Source/Column]` is looked up by exact name among the nodes with an edge into the element's own sheet node. With
    exactly one such node, a table (or a Sigma dataset on one) gives its one column of that name (compared normalized, as labels are), and another
    element gives that element's column, traced the same way (each element once). Restricting the lookup to the element's direct sources
    tells an element apart from the table it is named after, and ignores elements of the same name elsewhere in the
    workbook.
  - A name matching no source or several, a reference with more than one `/` (a relationship, or a column name
    holding `/`), a formula holding an escape, and a source of any other type add nothing.
- A calculated column (a formula that is more than one two-part `[Source/Column]` reference) takes its sources only
  from its formula, and is never matched by name: an untraced one gets no column lineage. A column that only copies a
  source column is matched by name only when its reference names no node the element reads directly, as every column
  was before formulas were read; one whose source is ambiguous, or found without such a column, gets none.
- Column lineage is drawn only when every source of the element was found. Edges stay one per source table, each
  carrying that table's columns.

## Consequences

- On a re-run the server keeps a stored column description against an ingestion bot update unless
  `overrideMetadata` is on, so a description written by a user is kept, and so is a formula that later changed in Sigma
  until `overrideMetadata` is turned on.
- A calculated column whose formula reads a relationship, a data model, a join, or a source spelled with a different
  case or padding has no column lineage. It is left out rather than linked to a same-named column it may not read.
- A failed `/columns` read leaves the workbook's columns matched by name, as before formulas were read. In an element
  read by another, a copy whose reference names no source adds nothing.
- One extra paged call per workbook (when data models are ingested) and per Sigma Data Model. Tracing reads only the
  lineage response and formulas already fetched.
