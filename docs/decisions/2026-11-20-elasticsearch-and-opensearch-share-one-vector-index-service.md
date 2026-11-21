# Elasticsearch and OpenSearch share one vector index service

- **Status:** Accepted
- **Revisions:** v1 2026-11-20 (initial)
- **Deciders:** Search and AI context maintainers
- **Guard:** `VectorChunkIndexIT` (one scenario on a real cluster of each engine),
  `ElasticSearchVectorServiceTest` (the Elasticsearch dialect), `EmbeddingEnricherTest` (the
  reindex embedding step), `StoredEmbeddingReuseIT` (both engines); `reviewer` for a new caller
  that names an engine class
- **Related:** ADR:2026-11-11-reindex-reuses-an-embedding-only-when-its-fingerprint-matches,
  ADR:2026-11-11-chunk-llm-context-lists-child-fields-under-columns,
  ADR:2026-10-21-opensearch-vectors-stay-in-source

## Context

Semantic search had two implementations. `OpenSearchVectorService` held all of it: the chunk
index, its staged recreate during a full reindex, passage search within one entity, embedding
reuse and the `reembed` command. `ElasticSearchVectorService` copied part of it and embedded only
chunk 0 of each entity.

Callers that needed the rest asked for `OpenSearchVectorService.getInstance()`, which is null on
Elasticsearch. With semantic search enabled on Elasticsearch:

- `reembed` reported that embeddings were disabled and exited 1.
- AI context never excerpted a long knowledge item by relevance to the query. It always returned
  the structural preview. The MCP `get_entity` tool returned the full body instead of passages.
- Text beyond an entity's first chunk was never embedded, and a full reindex had no chunk index to
  rebuild.

## Decision

- **One implementation.** `AbstractVectorIndexService` holds every behaviour that does not depend
  on the engine. It talks to the cluster through REST JSON only.
- **An engine class supplies its dialect and nothing else**: how to send a request, the chunk index
  settings, the mapping of the embedding field and the kNN search body. OpenSearch maps
  `knn_vector`. Elasticsearch maps `dense_vector` with cosine similarity and searches with a
  top-level `knn` clause.
- **Callers get the service from `SearchRepository.getVectorIndexService()`.** Only
  `SearchRepository.initializeVectorSearchService` names an engine class.
  `OpenSearchVectorService.getInstance()` stays for downstream code compiled against it. Code in
  this repository does not call it.
- **Elasticsearch has the same index layout as OpenSearch.** Chunk documents live in
  `data_asset_embeddings_chunks`, are read through the `dataAssetEmbeddings` alias together with
  the entity indexes, and are rebuilt by a full reindex in a staged generation
  (`data_asset_embeddings_chunks_g<millis>`) that replaces the previous one in a single alias swap.
- **The reindex embedding step is shared** (`EmbeddingEnricher`) and behaves as it did on
  OpenSearch.
- **A stored vector is read by naming its field.** On Elasticsearch 9.3.0 a new index has
  `index.mapping.exclude_source_vectors=true`, so `_source` carries a `dense_vector` only when the
  request lists that field. Every read that reuses a stored vector goes through one multi-get that
  lists `embedding` in `_source_includes`. The chunk index keeps the Elasticsearch default, as the
  entity indexes do. OpenSearch keeps vectors in stored source
  (ADR:2026-10-21-opensearch-vectors-stay-in-source).
- **Hybrid search stays OpenSearch-only.** The RRF search pipeline lives in
  `OpenSearchVectorService`, and `SearchRepository` creates and checks it only on OpenSearch.

## Consequences

- **A capability added to `VectorIndexService` exists on both engines.** An engine difference is a
  new hook on the base class, not a second copy of the logic.
- **OpenSearch is unchanged.** It sends the same requests, creates the same mappings and retries
  the same way.
- **Upgrade cost on Elasticsearch.** No chunk documents exist before this change. The first
  Search Indexing run after the upgrade creates the chunk index and embeds every chunk of each
  vector-indexable entity it covers, one provider call per chunk. That includes entities whose
  entity-document embedding is reused. Later runs reuse the stored chunk vectors.
- **Before that run**, semantic search keeps reading the entity-document embeddings through the
  alias. Passage search returns nothing for an entity that has not been edited since the upgrade,
  so AI context and `get_entity` fall back as they did before.
- **A read that fetches whole documents gets no vector on Elasticsearch.** The reuse then embeds
  the text again. That costs provider calls and shows only as an info log, so `VectorChunkIndexIT`
  counts the provider calls of a recreate.
- **Elasticsearch stores more.** Every chunk is a document with its own vector. Not measured.
- **A provider outage during a reindex on Elasticsearch** indexes the entity without an embedding
  and counts it as indexed, as on OpenSearch. It used to count as a failed vector record. The next
  reindex adds the embedding.
- **Revisit** when hybrid search is wanted on Elasticsearch. It needs its own retrieval request,
  which belongs behind a hook like the kNN search body.
