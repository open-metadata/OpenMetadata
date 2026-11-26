# Search clients render their typed builders as query DSL JSON

- **Status:** Accepted
- **Revisions:** v1 2026-11-23 (initial)
- **Deciders:** Platform team
- **Guard:** OpenSearchQueryDslTest, ElasticQueryDslTest, SearchQueryDslParityTest
- **Related:** ADR:2026-11-20-elasticsearch-and-opensearch-share-one-vector-index-service

## Context

Some callers compose a search request themselves and send it with
`SearchClient.rawSearchRequest`, because the request has a shape no typed endpoint offers. They
still need pieces OpenMetadata owns and builds with typed, engine-specific builders: the ranking
`function_score` shell that `/v1/search` puts around a data asset query, and clauses built with an
`OMQueryBuilder` such as the context memory visibility rule. Turning those builders into JSON needs
the engine client's own JSON mapper, so each caller ended up naming one engine's builder and mapper
classes, and could only work on that engine.

## Decision

`SearchClient.getQueryDsl()` returns a `SearchQueryDsl` for the configured engine. It offers:

- `queryBuilderFactory()`: the factory whose clauses it can render;
- `toJson(OMQueryBuilder)`: one query clause as JSON;
- `dataAssetQueryJson(searchSettings, indexName, queryText)`: the query `/v1/search` runs for that
  text, with the ranking shell of those settings.

`OpenSearchClient` and `ElasticSearchClient` implement it with their own client's mapper
(`OpenSearchQueryDsl`, `ElasticQueryDsl`). Other clients keep the default, which throws
`UnsupportedOperationException`, like `rawSearchRequest`.

## Consequences

A caller of `rawSearchRequest` can build engine-neutral requests without importing any engine
package: the engine difference stays next to the engine clients.

The two engines render the same ranking shell and the same visibility rule. One difference is
expected and harmless: the OpenSearch client writes boost weights as 32-bit floats (for example
`0.30000001192092896`) where the Elasticsearch client writes `0.3`. Both engines read the weight
as a float, so the value is the same. `SearchQueryDslParityTest` compares at float precision.
