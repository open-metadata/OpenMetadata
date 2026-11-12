# A nested-column DQ test case is addressed by a quoted-aware dotted path in the entityLink

- **Status:** Accepted
- **Revisions:** v1 2026-10-27 (initial); v2 2026-10-27 (conformance type check uses the same walk;
  paths that do not parse as an FQN match whole instead of erroring); v3 2026-10-27
  (dimensionColumns stay top-level: the runner groups only by top-level SQL columns)
- **Deciders:** TeddyCr
- **Guard:** `ColumnUtilTest` (`resolveColumnByPath*` / `validateColumnPath*`),
  `TestCaseDefinitionConformanceTest` (`aNestedColumnOfA*TypeIs*`),
  `TestCaseResourceIT#post_nestedColumnLevelTest_200_OK`,
  `TestCaseResourceIT#post_testWithInvalidNestedColumn_4xx`,
  `TestCaseResourceIT#post_testOnUnsupportedNestedColumnType_4xx`
- **Related:** #36278 (epic), #36381 (backend), #36382 (ingestion), #36383 (Snowflake), #36384 (UI)

## Context
The API rejected entityLinks such as `<#E::table::…::columns::address.city>` with `Invalid column
name` because every test-case column resolution site compared the link's array field against
top-level `Table.columns` names only, while the rest of the tree (Column `fullyQualifiedName`,
`FullyQualifiedName.getTableFQN`, the UI's `FqnPart.NestedColumn` link writer) was already
nested-aware. The storage format itself never needed changing — only resolution.

## Decision
A test case's column is resolved from the entityLink array field by walking `Column.children`
segment-wise. The path is FQN-split — quoted-aware, so a column literally named `a.b` arrives as
`"a.b"` and resolves as one segment — matched case-exactly first, then case-insensitively, and for
compatibility a dotted literal column name arriving unquoted matches as a whole name when the
segment walk fails. Raw names the Fqn grammar cannot split (an edge quote, an empty segment — all
accepted as column names by `FullyQualifiedName.validateFqnName`) are never parsed as paths; they
match as one whole name. `all` keeps its "every column" meaning. The same resolution governs the
definition's `supportedDataTypes` conformance check and the tag inheritance of
column-scoped test cases; `dimensionColumns` resolve against top-level `Table.columns` only
(case-insensitive) until the runner can group by nested paths — the ingestion runner resolves
dimensions against the top-level SQL columns (`SQAValidatorMixin.get_column_from_list`), so a
nested path accepted here would be silently dropped at run time as an Aborted dimension. The CSV
round-trip
serializes the full quoted remaining path (`FullyQualifiedName` column segments joined by `.`,
per-segment `quoteName`), never `getColumnName`, which truncates to the first segment.

Executing the test is a separate contract: a nested path is only executable where the dialect
supports structured types as SQL column paths (BigQuery, Databricks, Unity Catalog, Athena now;
Snowflake after structured-type ingestion + a dialect spike), via one per-dialect DQ interface
override each — no shared dialect-capability registry in `ometa_to_sqa_orm`.

## Consequences
Anything validating or resolving a test case's column (backing service, CSV import, future API
surfaces) must use the segment walk, not a top-level `Stream` over `Table.columns`.
`dimensionColumns` are the exception (see v3): they stay top-level until the runner can group by
nested paths. Dialects that
address nested data with functions (MySQL JSON, Doris/StarRocks structs) can attach test cases but
their runner fails the compatibility filter cleanly with "nested column tests not supported" until
they learn those dialects. A shared unquoted/dotted raw path that is both a real nested path and a
literal top-level column name resolves to the nested path.

## Amendment — 2026-10-27: dimensionColumns stay top-level

`validateDimensionColumns` resolves a dimension against top-level `Table.columns` only: the
ingestion runner resolves dimensions against the top-level SQL columns
(`SQAValidatorMixin.get_column_from_list`), so a nested path accepted here would be silently
dropped at run time as an Aborted dimension. The v2 wording that put `dimensionColumns` under the
segment walk is narrowed accordingly; test-case column links, the conformance check and tag
inheritance still use the walk.