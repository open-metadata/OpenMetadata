# Elasticsearch vector fields pin their index options when they are created

- **Status:** Accepted
- **Revisions:** v1 2026-11-23 (initial)
- **Deciders:** Platform team
- **Guard:** EsUtilsTest (`aNewEmbeddingField_getsThePinnedHnswOptions`,
  `anExistingEmbeddingField_keepsItsOwnOptions`,
  `aMappingUpdate_leavesOutAnEmbeddingTheLiveIndexAlreadyMaps`,
  `aMappingUpdate_addsThePinnedEmbeddingWhenTheLiveIndexHasNone`),
  ElasticsearchVectorMappingUpdateIT (create then update on a real Elasticsearch),
  ElasticSearchVectorServiceTest (`theChunkIndexMapsTheEmbeddingAsADenseVector`)
- **Related:** ADR:2026-11-20-elasticsearch-and-opensearch-share-one-vector-index-service

## Context

The `embedding` field was mapped as a `dense_vector` without `index_options` on Elasticsearch, so
the engine default applied. That default changes with the version and the licence: `int8_hnsw`
from 8.14, `bbq_hnsw` for 384 dimensions or more from 9.1, `bbq_disk` from 9.4 where the licence
allows, with `m` 16 and `ef_construction` 100. OpenSearch maps the same field as a float lucene
HNSW graph with `m` 48 and `ef_construction` 256. The two engines therefore built different
indexes from the same vectors, and semantic results could differ between them for that reason
alone. The mapping was also written in two places: `EsUtils` for entity indexes and
`ElasticSearchVectorService.embeddingFieldMapping` for the chunk index.

## Decision

`EsUtils.denseVectorMapping(dimension)` is the one source of the Elasticsearch `embedding`
mapping. It adds `"index_options": {"type": "hnsw", "m": 48, "ef_construction": 256}`, the
OpenSearch values, and both the entity indexes and the chunk index use it.

The options are sent only when the field is created, and an existing field is never re-declared:

- creating an index (`enrichIndexMappingForElasticsearch`) declares `embedding` with the pinned
  options. If the mapping content itself declares `embedding` with `index_options`, those are
  used instead;
- updating an existing index (`enrichIndexMappingForElasticsearchUpdate`, used by `PUT
  _mapping`) first reads the live mapping. When any index behind the name already maps
  `embedding`, the field is left out of the body, and the field keeps whatever it was created
  with. When none does (for example embeddings were just turned on), the field is added with the
  pinned options;
- the chunk index mapping upgrade already leaves the `embedding` field out.

Re-declaring the field on an update is not safe either way. Elasticsearch reads a `dense_vector`
sent without `index_options` as the engine default and refuses to change the options of an
existing field (`m` cannot go down, `hnsw` cannot become `bbq_hnsw`); sending the pinned options
is refused on an index created before this change, which has the engine default. `PUT _mapping`
is atomic, so one refused field drops every other field in the body, and `migrate` would leave
each upgrade's new fields unmapped. The dimension check stays: an update fails with
`IllegalStateException` when the live `embedding` has a different `dims` than the embedding
client, since `dims` cannot change on an existing index.

## Consequences

An index created after this change has the same graph structure on both engines. An index created
before it keeps the engine default until it is recreated, so the first Search Indexing run with
recreate after the upgrade is what pins it. Float vectors use about four times the memory of
`int8_hnsw`; quantization can be revisited for both engines together.
