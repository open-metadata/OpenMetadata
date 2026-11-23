# Elasticsearch and OpenSearch share one vector index service

- **Status:** Accepted
- **Revisions:** v1 2026-11-20 (initial); v2 2026-11-23 (an unwritable chunk index keeps the entity
  embedding; the chunk generation goes live with the entity indexes, and only a missed delete
  blocks it)
- **Deciders:** Search and AI context maintainers
- **Guard:** `VectorChunkIndexIT` (each scenario on a real cluster of each engine),
  `ElasticSearchVectorServiceTest` (the Elasticsearch dialect and the promotion rule),
  `EmbeddingEnricherTest` (the reindex embedding step and its retry), `DefaultRecreateHandlerTest`
  (what an entity index tells the chunk generation), `StoredEmbeddingReuseIT` (both engines);
  `reviewer` for a new caller that names an engine class
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
- **A chunk index that cannot be written never costs an entity its document embedding.** A live
  edit refreshes only a stale entity-doc embedding and skips the chunk write. A reindex keeps the
  spliced embedding and logs the chunk failure. No raw chunk write goes to a missing index.
- **The chunk generation goes live with the entity indexes.** The entity indexes follow the
  platform rule of `DefaultRecreateHandler`: a staged index with data is promoted, because partial
  data is better than none. Once every vector-indexable type has finalized, the staged chunk
  generation is promoted when all their staged entity indexes were. A type whose entity index kept
  its live index (it received no documents, or its swap failed) keeps the live chunks for the
  whole catalog, so a type never loses its chunks while its old entities are still served. An
  empty generation never replaces a live index that holds chunks, and a count that cannot be read
  keeps the live index.
- **A missed chunk write never blocks promotion.** When the run cannot write an entity's chunks
  (the provider fails, its circuit is open, the cluster rejects the bulk, or a live edit's mirror
  fails), the entity keeps its document embedding and the miss is recorded on that node. When a
  partition of the entity's type finishes, the node retries it once, skipping the retry while the
  provider's circuit is open. The entity then counts as one vector success, or one vector
  failure if its chunks are still missing. Each node logs one summary warning per run, and the
  detail per entity at debug. An entity left without chunks gets them on its next edit or
  reindex, through the fingerprint-guarded backfill. A missed mirror is not retried; it heals the
  same way.
- **Only a missed delete blocks promotion.** A delete that fails in the staged generation would
  bring a removed entity's chunks back, so it sets `_meta.incompleteChunkWrites` on that
  generation's index. A node saves the flag once per generation. The coordinator reads it before
  the alias swap and keeps the old chunks live when it is set; the next staged recreate sweeps the
  unpromoted generation. The flag lives on the cluster, so a participant's failure reaches the
  coordinator. A node that cannot save the flag retries it when its partition ends and, if it
  still cannot, fails the partition with an error that starts with
  `VectorIndexService.UNRECORDED_STAGED_DELETE`. The coordinator reads that error from the job's
  failed partitions and counts the partition's type as keeping its live chunks. Keeping live
  chunks wins over a later promotion of the same type, so no callback can undo it. A delete that
  fails after the coordinator reads the flag misses the generation, and the deleted entity's
  chunks stay in it until the next full recreate.
- **A live edit refreshes the entity document even when its chunk write fails.** Chunk 0
  carries the header the next update compares against, so it is written in its own request
  after every other chunk and delete succeeded. A failed write leaves the old header, and the
  entity's next update writes the chunks again.
- **Hybrid search stays OpenSearch-only.** The RRF search pipeline lives in
  `OpenSearchVectorService`, and `SearchRepository` creates and checks it only on OpenSearch.

## Consequences

- **A capability added to `VectorIndexService` exists on both engines.** An engine difference is a
  new hook on the base class, not a second copy of the logic.
- **OpenSearch sends the same requests, creates the same mappings and retries the same way**,
  with one exception. An unwritable chunk index now keeps the entity embedding instead of
  dropping it.
- **A rebuild costs an entity its chunks only until that entity is written again.** A
  generation promoted with misses lacks those entities' passages; the run's vector failures and
  each node's summary warning name how many. A rebuild is kept from going live only by a missed
  delete or by an entity index that kept its live index.
- **Upgrade cost on Elasticsearch.** No chunk documents exist before this change. The first
  Search Indexing run after the upgrade creates the chunk index and embeds every chunk of each
  vector-indexable entity it covers, one provider call per chunk. That includes entities whose
  entity-document embedding is reused. Later runs reuse the stored chunk vectors of every entity
  an earlier run embedded.
- **Before that run**, semantic search keeps reading the entity-document embeddings through the
  alias. Passage search returns nothing for an entity that has not been edited since the upgrade,
  so AI context and `get_entity` fall back as they did before.
- **A read that fetches whole documents gets no vector on Elasticsearch.** The reuse then embeds
  the text again. That costs provider calls and shows only as an info log, so `VectorChunkIndexIT`
  counts the provider calls of a recreate.
- **Elasticsearch stores more.** Every chunk is a document with its own vector. Not measured.
- **A provider outage during a reindex** indexes the entity without an embedding and counts a
  vector failure, on both engines. The next reindex adds the embedding.
- **Revisit** when hybrid search is wanted on Elasticsearch. It needs its own retrieval request,
  which belongs behind a hook like the kNN search body.
