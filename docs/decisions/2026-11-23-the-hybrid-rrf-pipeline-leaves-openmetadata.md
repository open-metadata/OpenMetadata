# The hybrid RRF search pipeline leaves OpenMetadata

- **Status:** Accepted
- **Revisions:** v1 2026-11-23 (initial); v2 2026-11-26 (the deletion has landed)
- **Deciders:** Platform team
- **Guard:** `SearchRepositoryBehaviorTest.getHybridWeightsReadsTheAdminWeightsOfTheSearchSettings`
  (the weights a caller fuses with); `reviewer` for new code that creates or reads a search
  pipeline, and for the removal ordering below
- **Related:** ADR:2026-11-20-elasticsearch-and-opensearch-share-one-vector-index-service;
  PR #38517 (the building blocks), PR #38565 (the deletion)

## Context

OpenMetadata creates, refreshes and checks an OpenSearch search pipeline named `hybrid-rrf`: on
vector service start, before every Search Indexing run, on every search settings save, and in the
embeddings step of the deployment status. It also builds the pipeline body for a caller to send
inline. Nothing in OpenMetadata itself runs a hybrid query or reads that pipeline. Its only caller
is a downstream hybrid search that fuses its keyword and semantic legs on OpenSearch with it.

That caller can now fuse the two legs itself, on both engines, from a keyword query and the kNN
clause `VectorIndexService.knnQueryClause` returns, with the weights of
`SearchRepository.getHybridWeights()`. The pipeline also needs OpenSearch 3.1 for weights, has no
Elasticsearch counterpart, and its creation is a cluster-scoped write that a search role confined
to one index prefix cannot make.

## Decision

- OpenMetadata stops creating, updating, checking and building a hybrid search pipeline. The
  members that go: `OpenSearchVectorService.HYBRID_PIPELINE_NAME`,
  `buildHybridRrfPipelineDefinition`, `ensureHybridSearchPipeline`, `checkHybridSearchPipeline`;
  `SearchRepository`'s `ensureHybridSearchPipeline`, `getHybridRrfPipelineDefinition`,
  `updateHybridSearchPipeline`, `checkHybridSearchPipeline`, `usesHybridSearchPipeline`; the
  pipeline step of Search Indexing's preflight; the pipeline refresh on search settings save; the
  pipeline check in the embeddings step of the deployment status.
- **The removal is staged.** The downstream caller compiles against these members and needs the
  pipeline at runtime until its own change ships. So the engine-neutral building blocks
  (`knnQueryClause`, `getHybridWeights`, the typed query DSL) land first, with the pipeline API
  unchanged, and the members above are deleted only after the caller has moved to the building
  blocks. Deleting them first would break the caller's build and its OpenSearch hybrid search.
  The deletion ships in PR #38565, which merges after the caller's change.
- `SearchRepository.getHybridWeights()` stays: it is the one place the keyword and semantic weights
  are resolved (search settings, then configuration, then 0.6 and 0.4).
- The `searchPipeline` key of `naturalLanguageSearch.hybridSearch` stays in the configuration
  schema. The block does not allow unknown keys, so deleting it would stop a server whose
  configuration file still sets it. Once the pipeline is gone, the key is ignored.

## Consequences

Until the deletion lands, OpenSearch deployments keep the pipeline exactly as before, and its
cluster-scoped write still happens on start, on Search Indexing runs and on search settings saves.
After it lands, a cluster that already holds a stored `hybrid-rrf` pipeline keeps it; nothing reads
or updates it, and an operator may delete it. Removing the `searchPipeline` key itself needs a
deprecation period in which configuration files drop it first.

## Amendment (v2, 2026-11-26)

The deletion landed in PR #38565, after the downstream caller moved to the building blocks. Every
member listed under Decision is gone, with its tests, the pipeline scenarios of
`VectorEmbeddingIntegrationIT`, the Search Indexing preflight step, the refresh on search settings
save and the pipeline check of the deployment status. The embeddings step of the deployment status
now only reports whether embeddings work, the same way on both engines. The configuration schema
documents `searchPipeline` as ignored, and the descriptions of `paginationDepth` and of the keyword
and semantic weights no longer mention a pipeline. The first paragraph of Consequences describes
the state before this amendment.
