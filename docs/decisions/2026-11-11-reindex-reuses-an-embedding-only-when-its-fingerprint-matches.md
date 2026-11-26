# A reindex reuses a stored embedding only when its fingerprint matches

- **Status:** Accepted
- **Revisions:** v1 2026-11-11 (initial) · v2 2026-11-20 (both engines share the reuse lookup;
  Elasticsearch embeds every chunk) · v3 2026-11-26 (a stored vector is reused only for the model
  that made it; `reembed` ignores stored vectors and records the model)
- **Deciders:** Search and AI context maintainers
- **Guard:** `StoredEmbeddingReuseTest`, `reindexReusesOnlyStoredEmbeddingsWhoseFingerprintIsCurrent`
  in `OpenSearchVectorServiceTest`, `EmbeddingModelSwitchTest`, `StoredEmbeddingReuseIT` (both
  engines); the `reembed` record: `OpenMetadataOperationsReembedRunTest`, the `reembed` cases of
  `SearchRepositoryBehaviorTest`, `recordingTheModelOnALiveIndexKeepsItsOtherMetaAndClearsTheOtherModel`
  in `ElasticsearchVectorMappingUpdateIT` and `OpenSearchVectorMappingUpdateIT`; live/reindex parity:
  `VectorDocBuilderTest` (custom properties) and
  `MetricRepositoryTest.aReindexReadKeepsEveryInputOfTheMetricEmbeddingFingerprint`
- **Related:** open-metadata/OpenMetadata#37524, open-metadata/OpenMetadata#37522,
  open-metadata/OpenMetadata#28313

## Context

A Search Indexing run rebuilds every entity doc. To avoid a paid embedding call per entity, it
copies the embedding already stored on the entity doc when that embedding is still valid
(`getExistingEmbeddingsBatch` in both vector services, spliced by the bulk sinks).

The validity check had two keys, tried in order:

1. The stored `updatedAt` equals the entity's `updatedAt`.
2. The stored `fingerprint` equals the fingerprint of the entity's current text
   (`VectorDocBuilder.computeFingerprintForEntity`).

Key 1 was added in #28313 to skip building the fingerprint text and hashing it. But `updatedAt` only
moves when someone edits the entity. A release that changes what goes into the embedding text,
like #37522 adding topic schema fields, leaves every `updatedAt` as it was. Key 1 then keeps the
old embedding forever:

- **Elasticsearch:** the entity doc holds the only embedding, so nothing refreshes it until the
  entity is edited, even after a recreate reindex. `reembed` is OpenSearch-only.
- **OpenSearch:** the chunk index refreshes, because its check (`chunkRefresh`) compares
  fingerprints. The copy on the entity doc, which hybrid search reads, stays stale.

## Decision

- **The fingerprint is the only key for the text.** A reindex copies a stored entity-doc embedding
  only when its stored fingerprint equals the current one. `updatedAt` plays no part.
  `StoredEmbeddingReuse` holds the rule for both engines. The model that made the vector is the
  other key, a separate fact (v3).
- **The current fingerprint is computed lazily**, only for entities that have a stored doc, so a
  first-time index does not pay for it.
- **The live write path and the reindex must build the same fingerprint for the same entity.**
  Otherwise every entity edited since the last reindex is re-embedded again on the next one. A
  reindex loads every field the fingerprint reads (`relatedMetrics` for metrics), and custom
  properties are rendered as JSON with sorted top-level keys, because the live path holds them as a
  `Map` and the reindex as an `ObjectNode` in database order.
- **One entity that cannot be fingerprinted is re-embedded on its own**; it does not cost the rest
  of its batch their reuse.
- **No embedding-text version stamp.** The fingerprint already changes exactly when the text it
  covers changes. A separate version would need a bump that someone can forget, which is the
  mistake this record fixes.

## Consequences

- **Upgrade cost.** The first reindex after a release that changes the fingerprinted text
  re-embeds exactly the entities whose text changed. Elasticsearch makes one paid call per entity
  (chunk 0 only). No longer true; see the v2 amendment. OpenSearch makes none beyond what it
  already made, because the chunks were re-embedded anyway and chunk 0 now also reaches the entity
  doc. Entities with unchanged text keep their embedding. Upgrade notes for such a release must
  say which entity types will re-embed.
  #37522 is such a change: the first reindex that has both re-embeds every topic with schema
  fields, on both engines, and no other entity type because of it.
- **The first reindex with this rule also refreshes embeddings left stale by earlier releases**:
  any entity whose stored fingerprint no longer matches its text. Their number is unknown. On
  OpenSearch an entity whose chunks an earlier reindex already refreshed re-embeds every chunk
  again, because the miss path rebuilds all chunks. This happens once per entity.
- **Text that changes without an edit now refreshes on Elasticsearch.** Inherited owners or domains,
  a renamed tag, or a test case's latest result change the fingerprint without changing the
  entity's `updatedAt`. Each affected entity costs one call at the next reindex; OpenSearch chunks
  already paid it.
- **The new custom-property rendering re-embeds every entity with custom properties once**, on
  the first reindex after this change (the entity doc, and on OpenSearch its chunks). The only
  exception is an entity whose last write was a reindex with its keys already in sorted order. A
  live-path write stored a fingerprint built from `Map.toString` (`{k=v}`), which is now JSON. A
  reindex that stored keys out of sorted order changes too: entity-reference properties come
  first, and database collation may order case differently. Metrics with related metrics also
  re-embed once. After that first reindex the fingerprint is stable.
- **`textToLLMContext` shows custom properties as JSON** (`{"k":"v"}`) for live-path writes too;
  they used to show as `{k=v}`.
- **CPU.** Every entity with a stored doc has its fingerprint text built and hashed whenever the
  bulk sink writes it: on reindex, on live bulk writes and in the retry worker. On OpenSearch the
  chunk backfill already did this for every reused entity. Not measured.
- **Only fingerprinted text triggers a refresh.** The fingerprint covers the context text
  (`buildMetaLightText`, `buildBodyText`), not the separately built embedding input
  (`buildSemanticMetaLightText`, `buildSemanticBodyText`). A change that touches only the embedding
  input does not change the fingerprint, so it must also change a fingerprint input, or the
  fingerprint itself, to be picked up.
- **Revisit** if fingerprint computation shows up as a measurable share of reindex time. A cheaper
  key must still change when the embedding text changes.

## Amendment

v2 (2026-11-20): both engines run one vector index service
(ADR:2026-11-20-elasticsearch-and-opensearch-share-one-vector-index-service).

- **One reuse lookup.** `getExistingEmbeddingsBatch` has a single implementation, so its unit
  guard is the OpenSearch test alone. `StoredEmbeddingReuseIT` still runs it on both engines.
- **Elasticsearch embeds every chunk.** Where this record says Elasticsearch makes one call per
  entity, or embeds chunk 0 only, it now makes one call per chunk, as OpenSearch does. The entity
  doc takes chunk 0's embedding from that same call.
- **`reembed` runs on Elasticsearch.**

v3 (2026-11-26): a stored vector is reused only for the model that made it.

- **Every vector records its model.** Each entity doc and chunk doc with an `embedding` carries
  `embeddingModel`, the provider's model id, and `embeddingDimension` beside it, written from the
  client that made the vector (`EmbeddingModel`). They are mapped as `keyword` and `integer` in
  the entity index mappings and in the chunk index, which `chunkDocVersion` 9 adds to existing
  chunk indexes. The model is not folded into the fingerprint: the fingerprint says which text was
  embedded and the model says what embedded it, and each is checked on its own.
- **A stored vector is current when its fingerprint is the current text's and its recorded model
  equals the configured model.** Two models of one dimension place the same text at unrelated
  points, and one model id can be configured for several dimensions, so the id and the dimension
  both count. A doc that records no model is stale. The rule applies wherever a stored vector is
  kept instead of embedding: the reindex lookup and the splice (`StoredEmbeddingReuse`), the
  chunk backfill, the recreate's copy of live chunks into the staged generation
  (`ChunkHeader.holdsVectorsOf`), and the live writes. The ontology term bulk write keeps a
  term's own vector, with its model fields, across a rewrite of unchanged text; the embedding
  refresh that follows every term write applies the rule.
- **`reembed` ignores stored vectors.** It embeds every entity again (`reembedEntity`) and exits
  with 1 when any entity could not be read or re-embedded; a batch that cannot be read counts all
  its entities, and an entity whose re-embedding throws counts as well. It rewrites the live
  indexes in place, so it first reads their fields, declares the field on an index that maps none
  as server start and the smart `reindex` do, and leaves out, before any provider call and counted
  as not re-embedded, every type whose entity index or the chunk index still does not map a vector
  of the model's dimension; only a reindex rebuilds those.
  An index that records another model of the same dimension is what it replaces, so the server's
  record of indexes that cannot hold the model's vectors plays no part in it
  (ADR:2026-11-26-the-server-reconciles-live-vector-fields-with-the-embedding-model). It embeds no
  ontology term: a reindex rebuilds those, decision 8 of that record.
- **A complete `reembed` records the model.** After a run that left no entity out, every vector
  index of the model's dimension in which no stored vector records another model, or none, records
  the model in its `_meta` through `EmbeddingFieldUpdate.recordModel`, starting from that index's
  live `_meta`, since `PUT _mapping` replaces all of it and a chunk index keeps `chunkDocVersion`
  there. The vectors themselves are the evidence, so this also clears a vector index no embedded
  type writes, which holds none, and keeps reporting one that still holds another model's vectors,
  such as ontology terms. The server no longer counts a recorded index as holding another model's
  vectors once it reads the field again. A run that left any entity out records nothing.

Consequences of v3:

- **Upgrade cost.** No doc written before v3 records its model, so every embedded entity is
  embedded once more by the first write or reindex that touches it after the upgrade: one paid
  provider call per chunk, on both engines, the cost of embedding the whole catalog once. After
  that, a reindex embeds only entities whose text or model changed.
- **A switch of model costs one full embedding of the catalog**, at the next reindex or
  `reembed` (ontology terms at the next reindex). Until then, entities not edited since the switch keep the old model's vectors and
  are compared with the new model's queries.
