# Elasticsearch and OpenSearch share one vector index service

- **Status:** Accepted
- **Revisions:** v1 2026-11-20 (initial); v2 2026-11-23 (an unwritable chunk index keeps the entity
  embedding; the chunk generation goes live with the entity indexes, and only a missed delete blocks
  it; the header's count bounds every stored chunk id); v3 2026-11-23 (the Revisit clause is
  resolved by a kNN query clause hook; fusing the two legs stays out of OpenMetadata); v4 2026-11-24
  (ontology terms keep the engine split of their own record); v5 2026-11-26 (the RRF search pipeline
  is gone); v6 2026-11-26 (a delete trusts the header's bound; chunk 0 is a conditional write, and a
  heal removes once the chunks no header counts, on one server at a time and retried until it is
  recorded; by-id chunk requests retry a busy cluster; a header that cannot be read fails the write
  or delete, and a live delete the cluster refuses goes to the search retry queue; an unrecorded
  staged delete is read from any failed partition, also at the end of the job; a run waits out the
  generation lookup's cache); v7 2026-11-26 (every entity a hard delete removes, the descendants of
  a recursive delete included, loses its chunks through the handler's prepare hook, in batches; a
  descendant a recursive soft delete marks deleted loses them through that update; a sweep removes
  once the chunks earlier recursive deletes left behind)
- **Deciders:** Search and AI context maintainers
- **Guard:** `VectorChunkIndexIT` (each scenario on a real cluster of each engine),
  `ChunkSetBoundTest` (trims and deletes after a write that stopped part way, the requests a
  delete sends, a header that cannot be read, the request retry, racing writers, the heal and its
  retries), `ChunkSetHealLeaseTest` (the heal's lease), `ChunkSetsDeleteTest` (the deletes of many
  chunk sets), `DeletedEntityChunkSweepTest` and `ChunkSetHealRunnerTest` (the sweep, after the
  heal), `VectorEmbeddingHandlerTest` (which deletes reach the chunks), `OrderedLaneExecutorTest`
  (one task per lane, after the tasks queued for its entities),
  `SearchIndexRetryWorkerTest` and `VectorEmbeddingHandlerTest` (a live delete the cluster
  refused is replayed), `RecreateWithEmbeddingsTest` (the wait before the first read),
  `DistributedIndexingStrategyTest` and
  `DistributedSearchIndexExecutorTest` (an unrecorded staged delete keeps the live chunks),
  `ElasticSearchVectorServiceTest` (the Elasticsearch dialect and the promotion rule),
  `EmbeddingEnricherTest` (the reindex embedding step and its retry), `DefaultRecreateHandlerTest`
  (what an entity index tells the chunk generation), `StoredEmbeddingReuseIT` (both engines);
  `reviewer` for a new caller that names an engine class
- **Related:** ADR:2026-11-11-reindex-reuses-an-embedding-only-when-its-fingerprint-matches,
  ADR:2026-11-09-lifecycle-handlers-prepare-a-hard-delete-before-its-rows-are-removed,
  ADR:2026-11-23-ontology-terms-have-dedicated-search-indexes,
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
  keeps the live index. A run whose embedding pre-flight call fails stages no generation, so the
  live chunks stay: an entity edited while the provider was out keeps its old chunks live, and its
  entity document has no embedding until a provider call works again, on the retry at the end of
  its partition or on a later run.
- **A missed chunk write never blocks promotion.** When the run cannot write an entity's chunks
  (the provider fails, its circuit is open, the cluster rejects the bulk, or a live edit's mirror
  fails), the entity keeps its document embedding and the miss is recorded on that node. An entity
  the run embeds afresh has no embedding yet, so the provider failing it records the same miss and
  the entity is indexed without one. When the partition that missed the entity finishes and its
  writes are flushed, the node retries it once, writing both the entity document's embedding and
  the chunks when both were missed, and skipping the retry while the provider's circuit is open.
  Another partition of the same type never retries it, because the entity's document may not be
  written yet. A write that ran without a partition, such as a live bulk update, is retried the
  same way once its sink has flushed, when the sink closes. The retry reads the entity as the
  reindex read it, soft-deleted entities included. The entity then counts as one vector success,
  or one vector failure if its chunks are still missing; a miss whose partition stopped before its
  end is not retried and the summary says how many. Each sink logs one summary warning, and the
  detail per entity at debug. An entity left without chunks gets them on its next edit or
  reindex, through the fingerprint-guarded backfill. A missed mirror is not retried; it heals the
  same way.
- **Only a missed delete blocks promotion.** A delete that fails in the staged generation would
  bring a removed entity's chunks back, so it sets `_meta.incompleteChunkWrites` on that
  generation's index. A node saves the flag once per generation. The coordinator reads it before
  the alias swap and keeps the old chunks live when it is set; the next staged recreate sweeps the
  unpromoted generation. The flag lives on the cluster, so a participant's failure reaches the
  coordinator. A node that cannot save the flag retries it when its next partition ends, whatever
  that partition's type, and, if it still cannot, fails the partition for good, without a retry,
  with an error that starts with `VectorIndexService.UNRECORDED_STAGED_DELETE`. A retry on another
  node could not repair the missed delete, and nothing rewrites a FAILED row, so the error stays
  for the rest of the job. The miss belongs to the generation, not to a type, so whenever a type
  finishes, through its own promotion or at the end of a job that stopped first, the coordinator
  reads that error from any of the job's failed partitions and counts the type as keeping its
  live chunks. Keeping live chunks wins over a later promotion of the same type, so no callback
  can undo it. The type's entity index still promotes its partial data, and the run ends with
  errors. A node that has not joined the run finds the generation through a lookup it keeps for
  15 seconds, so the run waits that long after creating the generation before it reads its first
  entity: an entity changed on a node that still misses the generation is read by the run after
  the change, from the database. A lookup that fails keeps the last answer for 2 seconds and is
  then tried again, so an outage adds no lookup to every chunk write or delete. Narrow windows
  remain, in which the deleted entity's chunks stay in the generation until the next full
  recreate: a delete that fails after the coordinator reads the flag; a node that misses a delete
  after its last partition and still cannot save the flag when it leaves the run, which it logs
  as an error; and a node whose lookup keeps failing past the wait while its deletes succeed.
- **A live edit refreshes the entity document even when its chunk write fails.** Chunk 0
  carries the header the next update compares against, so it is written in its own request
  after every other chunk and delete succeeded. A failed write leaves the old header, and the
  entity's next update writes the chunks again.
- **The header's `chunkCount` bounds every chunk id stored for the entity.** Trims and deletes
  go by id up to that count, so they reach writes no refresh has made searchable yet. A write
  that adds ids past the count first writes chunk 0 with the new count and no fingerprint. A
  write that then stops part way leaves a header that covers every id it wrote and that no
  update reads as current. Only a write that grows the set pays that extra request.
- **Chunk 0 is written and deleted only over the version that was read**: `if_seq_no` and
  `if_primary_term` from the multi-get, or `create` when there was no chunk 0. A writer or delete
  that finds chunk 0 changed reads it again and applies its set over the new header, up to three
  times. Nothing serializes writes to one entity across nodes, or between the reindex sink and a
  live edit, so without this a writer that shrank the set after another grew it would lower the
  count below ids the other wrote, and the delete would never reach them. A writer that gives up
  has already sent its other chunks over the winner's set, so it writes chunk 0 once more over
  the version it read last, without a fingerprint and with a count that covers both sets: a trim
  or delete still reaches every id, and the next update writes the set again.
- **A delete removes every chunk of the entity**, in the live index and in a staged generation,
  by id up to the header's count: the chunks past chunk 0, then chunk 0, so a delete that stops
  part way keeps the count for its retry. Ids are deleted in real time, so writes no refresh has
  made searchable go too. The header is the whole truth, so a delete sends no delete-by-query:
  every write keeps every chunk id below the count. One realtime multi-get reads the header. A
  delete costs that one read for an entity with no chunks, plus one bulk for an entity with one
  chunk and two for more, and a batch of up to 250 entities costs the same three requests at most:
  one multi-get of every header, one bulk of the chunks past them, one of the chunk 0s. A chunk 0
  that changed since it was read is read again and deleted over its new version, up to three times.
  It sends nothing to a chunk index that does not exist yet. A write that began before a delete and
  ends after it still brings the entity's chunks back.
- **Every entity a delete removes loses its chunks, its descendants included.** A recursive delete
  sends its descendants no delete event: the root's delete removes their entity documents by query
  (`descendantsCoveredByAncestorCascade`), and a chunk document carries no ancestor id to match.
  So the vector handler deletes chunks where every hard delete passes, root and descendants alike:
  its `prepareHardDelete` hook
  (ADR:2026-11-09-lifecycle-handlers-prepare-a-hard-delete-before-its-rows-are-removed), which
  takes the entities of one type together. Once the delete commits, their chunks are deleted on
  the ordered lanes, one task per lane holding the entities that lane serializes, so each runs after
  every task already queued for its entities and an update in flight cannot write the chunks back.
  The delete event does no chunk work. A chunk set the live index still holds after the delete
  puts its entity on the search retry queue, as does a lane task that fails or is shed. A recursive
  soft delete marks each descendant deleted with a bulk update and sends it no soft-delete event;
  kNN reads only chunks marked not deleted, and a chunk keeps the flag it was written with, so the
  handler deletes the chunks of any entity updated to deleted, as it does on a soft-delete event. A
  restore, of one entity or of a subtree, updates each entity back, and the update writes its
  chunks again.
- **Chunks no header counts are removed once per chunk index.** Writes from before chunk 0 was
  conditional could leave chunks past their header or with no chunk 0 at all: a bulk that stopped
  part way, a header read taken for a missing one, two writers racing. On OpenSearch, data written
  by 2.1 can hold them; Elasticsearch had no chunk index then. The server starts a heal in the
  background (`removeChunksNoHeaderCounts`). It pages the parents of the live data-asset chunk
  index through a composite aggregation that compares each parent's highest chunk and chunk count
  with its header. For a parent with chunks its header does not count, it lists them, reads the
  header after, in real time, and deletes only those past it, each at the version listed, so a
  chunk a writer rewrote meanwhile stays. It then sets `_meta.chunkSetsBounded` on the index. An
  index created empty, a staged generation among them, starts with it, and a mapping update keeps
  it. A search a shard failed or that timed out answers 200 with what the rest found, so the heal
  retries such an answer like a busy cluster and never records a pass that missed chunks. A pass
  that fails throws and leaves the record unset. `ChunkSetHealRunner` runs the pass at startup and
  tries again after 30 seconds, doubling up to 15 minutes, until the record is there. Only the
  server holding the `VECTOR_CHUNK_HEAL` row of `search_reindex_lock` runs it: the expiring,
  renewed lease the search reindex and Data Insights runs take under their own keys. A server
  that finds the row held waits and tries again, so if the holder stops, the next one takes over
  once the row expires, five minutes after its last renewal. One line reports what the pass
  removed.
- **Chunks of deleted entities are removed once per chunk index.** Recursive deletes made before
  the handler cleaned up descendants left those descendants' chunks behind: on OpenSearch since
  2.0, on Elasticsearch since its chunk index. After the heal, under the same lease and retries,
  the runner sweeps them (`removeChunksOfDeletedEntities`). It pages the parents of the live
  data-asset chunk index through a composite aggregation on `parentId` and `entityType`, refusing a
  partial answer as the heal does, looks the entities of each page up a type at a time in their
  repository, soft deleted ones excluded, and deletes the chunk sets of the rest as a batch
  delete does. A parent with no entity type, of a type the server has no repository for, or whose
  id is not an entity id, keeps its chunks. The sweep deletes by the header's bound, so it runs
  only after the heal. It then sets `_meta.chunksOfDeletedEntitiesRemoved` on the index; an index
  created empty starts with it. An entity restored in the moment the sweep reads it can lose its
  chunks until its next update or reindex.
- **By-id chunk requests retry a busy or briefly unavailable cluster.** The header read, the
  chunk bulks and the heal's requests go through their own retry policy, `vector-chunk-request`:
  a 429, 502, 503 or 504, a request that got no response, an error for the document in a
  multi-get, or a bulk item the cluster turned away for capacity
  (ADR:2026-11-24-bulk-items-rejected-for-capacity-are-re-sent) is sent again, up to four
  attempts, after about 0.2, 0.4 and 0.8 seconds with jitter, as the live bulk policy does. Every
  one of these requests is by id, so sending it again is safe. Elasticsearch's HTTP client also
  re-sends a 429 or 503 response once, a second later; the OpenSearch transport turns that off,
  so there a lone 429 reaches this policy. Neither re-sends a 502 or 504, a rejected bulk item or
  a POST that got no response. Other vector requests keep `vector-index-request`, which retries
  only a closed segment.
- **A header that cannot be read is not a missing one.** When the read still fails after those
  retries, the write or delete fails instead: a write would lower the bound, and a delete would
  leave behind the chunks no refresh has made searchable and report success. A failed write is a
  miss as above, and a live edit of a data asset or an ontology term still refreshes its entity
  document. A staged delete flags its generation. A delete that misses the live index reports the
  entity to its handler once it has tried the staged generation, and the handler puts the entity
  on the search retry queue: the search retry worker removes the chunks of an entity that is gone,
  soft-deleted or no longer embeddable, with the queue's own retries and backoff.
- **Ontology terms keep the layout their own record gives them.**
  ADR:2026-11-23-ontology-terms-have-dedicated-search-indexes keeps their chunks in
  `ontology_embeddings_chunks` on OpenSearch and their vectors on the term documents on
  Elasticsearch, and only OpenSearch sweeps stale ontology chunks. The base class keeps that split
  behind one hook, `chunksOntologyTerms`. Ontology terms are never part of the data-asset chunk
  generation: its expected types are `EmbeddedEntityTypes.DATA_ASSETS`.
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
- **The heal reads the whole chunk index once.** The first start after the upgrade sends one
  aggregation request per 500 parents, in the background, and three requests for each parent it
  heals, on one server; the others try the lease again until the record is there. The deletes are
  conditional, so a pass repeated after a lost lease only repeats work.
- **A recursive delete's chunk cleanup grows with the lanes, not with the descendants.** Each
  hard-delete batch of the cascade (up to 500 entities of one type) costs at most three requests
  per lane, and there are 8 to 32 lanes: a 200-table cascade sends 42 on a 14-lane server, where a
  delete per table would send about 500. A recursive soft delete deletes per descendant, on the
  lane task its update already has. Restoring a subtree embeds its entities again, one provider
  call per chunk.
- **The sweep reads the whole chunk index once.** The first start after the upgrade sends one
  aggregation request per 500 parents and one database query per entity type in each page, and
  three requests per 250 entities it removes.
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

## Amendment (v3, 2026-11-23)

The "Revisit when hybrid search is wanted on Elasticsearch" clause is resolved by a hook, not by a
retrieval request in OpenMetadata. `VectorIndexService.knnQueryClause(vector, parameters)` returns
the engine's kNN clause, usable inside `bool` and `function_score`, built by the new
`AbstractVectorIndexService.buildKnnQueryClause` hook: OpenSearch's `knn` clause with
`ignore_unmapped`, and Elasticsearch's `knn` query with `k` per shard and `similarity = 2 *
threshold - 1`. A caller composes its own hybrid request around it. Fusing the keyword and the
semantic leg is the caller's concern and stays out of OpenMetadata
(ADR:2026-11-23-elasticsearch-vector-fields-pin-their-index-options records the index options
that make the two engines' kNN legs comparable). The OpenSearch RRF search pipeline remains until
its callers stop using it, and then leaves OpenMetadata
(ADR:2026-11-23-the-hybrid-rrf-pipeline-leaves-openmetadata).

## Amendment (v5, 2026-11-26)

The "Hybrid search stays OpenSearch-only" bullet no longer holds. The RRF search pipeline has left
OpenMetadata (ADR:2026-11-23-the-hybrid-rrf-pipeline-leaves-openmetadata), so
`OpenSearchVectorService` and `SearchRepository` neither create nor check one, on either engine.
OpenMetadata runs no hybrid query itself: a caller fuses its keyword leg with the clause
`knnQueryClause` returns, as the v3 amendment says. The list of embedded entity types is
`EmbeddedEntityTypes` (formerly `AvailableEntityTypes`), and the data-asset chunk generation expects
`EmbeddedEntityTypes.DATA_ASSETS`.
