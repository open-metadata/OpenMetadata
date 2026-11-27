# Connectors adapt view lineage parsing before generic graph construction

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial)
- **Deciders:** OpenMetadata ingestion maintainers
- **Guard:** test_materialized_view_processor_does_not_reverse_collapsed_dotted_target, test_materialized_view_processor_preserves_distinct_same_name_target, test_ordinary_dotted_view_keeps_distinct_input_with_same_parsed_name, TestViewLineageProcessorArgs
- **Related:** Issue #35753, PR #36157

## Context

ClickHouse materialized views separate SELECT inputs from an explicit `TO` output.
The lineage parser can collapse a quoted dotted view name and a qualified output
name into the same table. Rebinding that name to the fetched view then manufactures
a reverse dependency. Filtering equal parsed source and target names would also
remove legitimate dependencies of ordinary dotted views.

## Decision

`LineageSource` may supply a module-level, picklable parser factory through the
view processor to `get_view_lineage`. Its default is `None`, preserving native
`LineageParser` behavior for existing connectors and callers. Dialect-specific
normalization stays in the connector.

ClickHouse removes only the explicit `TO` property from supported materialized
CREATE VIEW ASTs before constructing the input graph. It retains the SELECT body
and quoted identifiers. The existing extension derives the output edge from the
original view definition. AST normalization uses the configured parsing timeout;
unsupported definitions or failed normalization retain native parsing.

The returned parser carries the original native masked SQL, query and query hash,
while graph and parsing success metadata come from the normalized parser. This
requires at most two native parser constructions for supported definitions.

## Consequences

Generic lineage has no ClickHouse syntax rules and does not infer input/output
roles from a lossy graph. The original definition and safely masked SQL remain
available to the output extension and emitted requests. Supported materialized
views incur one AST normalization and a second native parse; ordinary and
unsupported definitions retain the original native graph.
