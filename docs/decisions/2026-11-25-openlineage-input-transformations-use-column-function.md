# OpenLineage records each input column's transformations in the lineage function

- **Status:** Accepted
- **Revisions:** v1 2026-11-25 (initial)
- **Deciders:** iamkiayun
- **Guard:** `OpenLineageMapperTest`, `OpenLineageLineageResolutionIT`, `test_column_transformations_are_kept_with_their_input_columns`
- **Related:** #38485, #35862

## Context

A source column can supply a value or determine which rows contribute to it. Producers can report both roles for a single output column. OpenMetadata stores one function string per column mapping. [OpenLineage column lineage facet 1-2-0](https://openlineage.io/spec/facets/1-2-0/ColumnLineageDatasetFacet.json)

## Decision

The REST mapper and ingestion connector group source columns on the same table edge by destination column and function. For example, an amount used in a sum carries `DIRECT/AGGREGATION`, while a predicate contributing to that same sum can carry `INDIRECT/FILTER`.

For each input, render transformations in producer order. Each label starts with the type, followed by an optional slash and subtype, an optional description in parentheses, and ` [masked]` when masking is true. Join labels with a comma and a space. If the input has no usable transformation, use the legacy field-level description, then the legacy type. Leave the function unset when all are absent.

## Consequences

Producers using either event shape can write the same lineage API. Consumers may see multiple mappings for one destination column. The function is display text. A consumer that needs structured transformation attributes would need a typed lineage field.
