# The hybrid RRF search pipeline leaves OpenMetadata

- **Status:** Accepted
- **Revisions:** v1 2026-11-23 (initial)
- **Deciders:** Platform team
- **Guard:** `SystemRepositoryEmbeddingsValidationTest` (the embeddings step reports no pipeline),
  `SearchRepositoryBehaviorTest.getHybridWeightsReadsTheAdminWeightsOfTheSearchSettings`;
  `reviewer` for new code that creates or reads a search pipeline
- **Related:** ADR:2026-11-20-elasticsearch-and-opensearch-share-one-vector-index-service

## Context

OpenMetadata created, refreshed and checked an OpenSearch search pipeline named `hybrid-rrf`: on
vector service start, before every Search Indexing run, on every search settings save, and in the
embeddings step of the deployment status. It also built the pipeline body for a caller to send
inline. Nothing in OpenMetadata itself runs a hybrid query or reads that pipeline. Its only caller
was a downstream hybrid search that fused its keyword and semantic legs on OpenSearch with it.

That caller now fuses the two legs itself, on both engines, from a keyword query and the kNN clause
`VectorIndexService.knnQueryClause` returns, with the weights of `SearchRepository.getHybridWeights()`.
The pipeline also needed OpenSearch 3.1 for weights, had no Elasticsearch counterpart, and its
creation is a cluster-scoped write that a search role confined to one index prefix cannot make.

## Decision

- OpenMetadata no longer creates, updates, checks or builds a hybrid search pipeline. Removed:
  `OpenSearchVectorService.HYBRID_PIPELINE_NAME`, `buildHybridRrfPipelineDefinition`,
  `ensureHybridSearchPipeline`, `checkHybridSearchPipeline`; `SearchRepository`'s
  `ensureHybridSearchPipeline`, `getHybridRrfPipelineDefinition`, `updateHybridSearchPipeline`,
  `checkHybridSearchPipeline`, `usesHybridSearchPipeline`; the pipeline step of Search Indexing's
  preflight; the pipeline refresh on search settings save.
- The embeddings step of the deployment status checks the embedding provider only.
- `SearchRepository.getHybridWeights()` stays: it is the one place the keyword and semantic weights
  are resolved (search settings, then configuration, then 0.6 and 0.4).
- The `searchPipeline` key of `naturalLanguageSearch.hybridSearch` stays in the configuration
  schema and is ignored. The block does not allow unknown keys, so deleting it would stop a server
  whose configuration file still sets it.

## Consequences

A cluster that already holds a stored `hybrid-rrf` pipeline keeps it; nothing reads or updates it,
and an operator may delete it. Search settings saves and Search Indexing runs no longer make a
cluster-scoped write. Removing the `searchPipeline` key itself needs a deprecation period in which
configuration files drop it first.
