# Metric semantic fields extend bounded generic JSON without changing concept context

- **Status:** Proposed
- **Revisions:** v1 2026-11-16 (initial)
- **Guard:** `AIContextBuilderTest`, `AIContextMarkdownTest`, `MetricContextBudgetTest`, `ConceptContextIT`, `McpMetricRelationVisibilityIT`, `MetricExpressionMappingIT`
- **Related:** #33455, ADR:2026-11-10-a-metric-concept-context-carries-what-changes-its-number

## Context

The generic metric block carries expression code and source assets but omits semantic dimensions,
measure aggregations, conditions and related FQNs. Structured-context callers need these to inspect
the metric. Concept context has a separate accepted contract that deliberately excludes dimensions,
measures and the variant hierarchy from its computation prompt.

## Decision

Add optional `dimensions`, `measures`, `filters` and related metric FQNs to
`assetContext.generic` in structured JSON. Reuse the metric schemas and the concept builder's
non-blank filter conditions. Related FQNs are distinct references already admitted to the existing
visible, Approved-or-unset, bounded concept metric knowledge list. After checking the first 50
knowledge candidates, structured metric JSON checks omitted related references in batches of 50.
It stops at the first visible, Approved-or-unset omission and sets the truncation marker.
A relation the caller cannot view does not set the marker.

Keep `conceptContext` JSON and default concept Markdown unchanged, including its granularity,
units and parenthesized AND conjunction of all filters. The earlier accepted decision remains
in force. The existing JSON format explicitly opts into the new generic fields; legacy builder
callers and Markdown requests retain their full previous knowledge budget. The new generic JSON
fields do not opt dimensions or measures into that prompt.

Charge the serialized new semantic fields, including their JSON envelope and truncation marker,
to the existing knowledge-character budget before attached knowledge. Reuse the existing
50-item knowledge limit for each projected array. The stable knowledge-item TypeScript `Type` export is pinned by a schema title, so adding the
dimension enum does not rename an existing export. Spend space on complete filters first, then
related FQNs, dimensions and measures. Retain complete entries in source order; never clip SQL,
names or FQNs. A filter group is kept entirely or omitted entirely, because a partial conjunction
would change the definition. Set `semanticFieldsTruncated=true` when the projection drops entries
or a filter group. Clients must fetch the metric entity for the complete declarations in that case.
The original expression and source assets retain their existing shape and budget behavior.

The localized index templates add the emitted `metricExpression` field while retaining
`expression` with its old mapping. The new explicit text fields preserve the previous dynamic
`keyword` subfields (including `ignore_above: 256`), so exact-match searches remain available
on fresh indexes and existing indexes where the dynamic field is already text.

If the first expression looked like a date, the search engine may have mapped
`metricExpression.code` as `date`. An in-place mapping update then returns HTTP 400 because
the field type cannot change. After upgrading, run the Search Indexing application for the
`metric` entity with **Recreate Index** enabled. The equivalent admin request is
`POST /api/v1/apps/trigger/SearchIndexingApplication` with
`{"entities":["metric"],"recreateIndex":true}`. This rebuilds the metric documents from the
catalog into a fresh backing index with the explicit text mapping, then promotes that index.
Verify that the job succeeds and that an exact search on `metricExpression.code.keyword`
finds the original expression.

## Consequences

Structured clients can inspect semantic declarations while consumers of concept JSON and default
Markdown retain their accepted prompt contract. Consumers reading only concept context do not
automatically gain dimensions or measures. Large declarations consume the shared budget and
produce explicit partial-projection metadata; attached knowledge may become shorter or reference
only. Existing concept conditions remain complete even when their generic duplicate cannot fit.
