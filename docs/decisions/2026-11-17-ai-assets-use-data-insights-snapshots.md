# AI models, MCP servers and AI applications are Data Insights snapshot assets

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial)
- **Deciders:** Teddy Crepineau
- **Guard:** `DataAssetTypeCoverageTest`, `DataInsightsSearchInterfaceTest`, `DataInsightAiAssetCoverageIT`; AI Platform `EntityScopeFilterTest` and `DataInsightsQueryToolTest`
- **Related:** [Collate #8277](https://github.com/open-metadata/openmetadata-collate/issues/8277), ADR:ai-platform/2026-11-16-all-assets-counts-data-assets-only, ADR:ai-platform/2026-11-14-a-data-insights-scope-reads-the-snapshot

## Context

Search can find tiered LLM models and MCP servers, but Data Insights does not count them.
`DataInsightsApp` selects snapshot types from `DataAssetType`, and AI Platform derives its
analytics scopes from the same enum. The enum omitted `llmModel`, `mcpServer` and `aiApplication`.

## Decision

All three types are data assets in `DataAssetType`, with projection fields in
`dataInsights/config.json`. The normal Data Insights workflow captures their daily snapshots,
including the shared tier, ownership and description enrichment. They join data-asset totals
and remain individually selectable scopes.

These types do not use `dataInsightAliases` onto their live indexes: snapshot queries need the
flattened `tier.keyword` and other analytics fields, whereas live tier values are objects.
The field catalog, ingestion and AI scope continue to derive coverage from the shared enum.

## Consequences

Deploy the updated OpenMetadata schema and server together with AI Platform built against that
schema. App initialization creates missing snapshot streams and updates existing mappings;
run Data Insights with the new types selected (the default `entities: ["all"]` includes them).
Counts include these assets after a successful capture. A custom entity list must explicitly
include them. Recreating all snapshot indexes is unnecessary and would discard retained history.

Existing pinned AI charts retain their compiled entity-type filters. Re-run the query and re-pin
the chart to include the expanded `allAssets` scope. Historical dates without collected AI asset
snapshots are not evidence of zero AI assets.

AI Platform's existing count-breakdown rule still names only types with non-zero contributions
to a result, rather than listing every type its scope could count.
