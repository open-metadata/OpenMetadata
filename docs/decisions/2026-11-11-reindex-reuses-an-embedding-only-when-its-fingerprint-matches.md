# A reindex reuses a stored embedding only when its fingerprint matches

- **Status:** Accepted
- **Revisions:** v1 2026-11-11 (initial)
- **Deciders:** Search and AI context maintainers
- **Guard:** `StoredEmbeddingReuseTest`, `reindexReusesOnlyStoredEmbeddingsWhoseFingerprintIsCurrent`
  in `ElasticSearchVectorServiceTest` and `OpenSearchVectorServiceTest`, `StoredEmbeddingReuseIT`
  (both engines); live/reindex parity: `VectorDocBuilderTest` (custom properties) and
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

- **The fingerprint is the only reuse key.** A reindex copies a stored entity-doc embedding only
  when its stored fingerprint equals the current one. `updatedAt` plays no part.
  `StoredEmbeddingReuse` holds the rule for both engines.
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
  (chunk 0 only). OpenSearch makes none beyond what it already made, because the chunks were
  re-embedded anyway and chunk 0 now also reaches the entity doc. Entities with unchanged text keep
  their embedding. Upgrade notes for such a release must say which entity types will re-embed.
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
