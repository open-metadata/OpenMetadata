# A parent metric read carries the expression of up to 25 visible variants

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `AIContextMcpIT#getEntityDetails_parentMetricCarriesEachVariantExpression`,
  `AIContextMcpIT#getEntityDetails_withholdsExpressionOfAVariantTheCallerCannotView`
- **Related:** #33460, #34423

## Context
A metric can have child metrics that are variants of it, each with its own expression. An agent
answering a question about the metric has to pick the variant that fits, but `get_entity_details`
on the parent returned the children as bare references, so picking cost one more read per child.
The child list itself is unbounded.

## Decision
- `get_entity_details` on a metric adds `metricExpression` to each of its first 25 children that
  the caller may `VIEW_ALL`. A child the caller cannot view, or whose policy inputs cannot be
  loaded, keeps its bare reference.
- With more than 25 children the response sets `childrenExpressionsTruncated: true`. The child
  references themselves are not cut.
- Each expression's code is capped by `McpResponseTrim.cappedMetricExpression` at 1000 characters,
  the same cap `semantic_search` applies.

## Consequences
- A parent read with children costs one bulk read plus one authorization check per shown child.
- 25 expressions of at most 1000 characters add about 25 KB, well inside the 100 KB response cap.
- If hierarchies routinely go past 25 variants, page the children rather than raising the cap.
