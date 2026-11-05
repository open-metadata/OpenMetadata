# search_metadata searches data assets and AI governance assets by default

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial)
- **Deciders:** Vishnu Jain; pmbrull (which types join the default scope)
- **Guard:** `SearchMetadataToolTest#testDefaultScopeAddsAiGovernanceTypesToDataAssetTypes`
- **Related:** #37173, openmetadata-collate#8303

## Context
Without an `entityType`, `search_metadata` searched the `dataAsset` alias. LLM models, MCP servers
and AI applications are not under that alias, so "all assets" searches and counts left them out
with no warning. They only appeared when the caller named the type.

The alias itself cannot gain them: Explore reads `dataAsset`, so its results and counts would
change. An index list such as `dataAsset,llmModel,...` does not work either. The search source
builder picks its ranking by index name (`SearchSourceBuilderFactory#getSearchSourceBuilder`):
only `all` and `dataAsset` get the data asset ranking and aggregations, and any other name falls
back to the generic aggregate builder.

## Decision
- With no registered `entityType`, `search_metadata` searches the `all` alias and ANDs a `terms`
  filter on `entityType`: the types under `dataAsset` (`SearchRepository#getEntityTypesForIndex`)
  plus `llmModel`, `mcpServer` and `aiApplication`.
- `all` and `dataAsset` share the same composite asset configuration, so ranking and aggregations
  stay as they were. The filter keeps the other types under `all` (test cases, agents and the
  like) out.
- The `dataAsset` alias is unchanged.

## Consequences
- Default results, totals and aggregations now include the three AI governance types.
  `excludeEntityTypes` still removes them.
- A type added under `dataAsset` joins the default scope on its own. A type outside it has to be
  added to the list in `SearchMetadataTool`.
- The search reaches every index under `all`; the `terms` filter keeps that cheap.
- If `dataAsset` itself gains these types, the default can go back to `dataAsset` with no filter.
