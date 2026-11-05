# Vector search metric hits read their hierarchy at query time

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Vishnu Jain
- **Guard:** `SemanticSearchToolTest#testMetricHitsShowWhereTheySitInTheHierarchy`,
  `AIContextFinderTest#attachMetricHierarchy_showsAMetricsParentAndVariantCount`
- **Related:** #36919, ADR:2026-10-29-search-metadata-hits-show-their-place-in-a-hierarchy

## Context
`search_metadata` shows a metric's parent, variant count and group. `semantic_search` and
`find_context` read the vector chunk index instead, whose documents carry none of these, so a parent
metric and its variants came back as unrelated hits and an agent needed a second call to see how
they fit together.

## Decision
- Both tools load the hierarchy of their metric hits in one batched read from the entity store,
  after the visibility check: `parent`, `childrenCount` and, for `semantic_search`, `metricGroup`.
- `semantic_search` renders them as `search_metadata` does, references as FQN strings, and adds
  them before the response budget is applied.
- `find_context` adds `parent` (an entity reference) and `childrenCount` to `knowledgeItem`. Its
  markdown prints the parent and a non-zero count.
- Only the MCP `find_context` tool attaches them, not the shared finder. ai-platform parses the
  REST find response with the strict mapper and `knowledgeItem` is `additionalProperties: false`,
  so an ai-platform built on an older spec would drop every metric item that carried them.
- The fields are not stored on the chunk documents. A chunk is rewritten only when its embedded
  text changes, so adding a variant would leave a stored count stale, and new chunk fields would
  need a reindex on every instance.

## Consequences
- A response with metric hits costs one batched entity read plus the parent, count and group
  queries. A response with none costs nothing extra.
- As in `search_metadata`, the parent is named without checking that the caller can view it.
- The REST find endpoint in `AIContextResource` is unchanged. Collate AI can read the hierarchy
  there once ai-platform parses knowledge items leniently.
