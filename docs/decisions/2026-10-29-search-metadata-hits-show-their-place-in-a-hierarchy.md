# search_metadata hits show their place in a hierarchy, as FQN strings

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `SearchMetadataCleanTest#aMetricHitShowsWhereItSitsInTheHierarchy`,
  `SearchMetadataCleanTest#aRequestedMetricExpressionIsCappedLikeEveryMetricSummary`
- **Related:** #33460, ADR:2026-10-29-parent-metric-reads-carry-up-to-25-variant-expressions

## Context
An agent searching metrics could not tell a variant from its canonical metric, or which group a
metric belongs to, without one `get_entity_details` call per hit. The metric index already holds
`parent`, `childrenCount` and `metricGroup`, but `search_metadata` returned them only when the
caller named them in `fields`, and no tool description said they existed.

## Decision
- `search_metadata` returns `parent`, `childrenCount` and `metricGroup` by default on every hit
  that carries them: metrics, plus `parent` on containers, folders and pages and `childrenCount` on
  glossary terms.
- `parent` and `metricGroup` are rendered like the other reference fields (`service`, `database`,
  `owners`): as the referenced entity's FQN string, with single-segment quotes dropped.
- To list a metric's variants, the tool description points at `entityType='metric'` plus a `term`
  clause on `parent.name`. Metric FQNs are flat, so the name is the FQN, and `parent.name` is a
  keyword field. `parent.fullyQualifiedName` is a text field, so an exact `term` on it matches
  nothing.
- A `metricExpression` requested through `fields` is capped by
  `McpResponseTrim.cappedMetricExpression`, as every other metric summary is.

## Consequences
- A hit grows by up to three short fields. Hits without them are unchanged.
- A caller that already passed `fields=parent` now gets a string instead of a reference object.
  Tools that reuse `SearchMetadataTool.cleanSearchResult` return the same fields.
- A dotted metric name comes back unquoted, the same trade-off owners already make;
  `get_entity_details` on the child returns the parent's exact FQN.
- Filtering on the parent's FQN would need `parent.fullyQualifiedName` mapped as a keyword and a
  reindex; revisit if agents keep reaching for it.
