# Elasticsearch vector fields pin their index options when they are created

- **Status:** Accepted
- **Revisions:** v1 2026-11-23 (initial)
- **Deciders:** Platform team
- **Guard:** EsUtilsTest (`aNewEmbeddingField_getsThePinnedHnswOptions`,
  `anExistingEmbeddingField_keepsItsOwnOptions`, `aMappingUpdate_sendsNoIndexOptions`),
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

The options are added only when a field is created:

- creating an index (`enrichIndexMappingForElasticsearch`) adds them, unless the mapping already
  declares an `embedding` with its own `index_options`, which are kept;
- updating an existing index (`enrichIndexMappingForElasticsearchUpdate`, used by `PUT
  _mapping`) sends none, so the field keeps what it was created with. Elasticsearch refuses some
  `index_options` changes on an existing field, for example `int8_hnsw` to `hnsw`;
- the chunk index mapping upgrade already leaves the `embedding` field out.

## Consequences

An index created after this change has the same graph structure on both engines. An index created
before it keeps the engine default until it is recreated, so the first Search Indexing run with
recreate after the upgrade is what pins it. Float vectors use about four times the memory of
`int8_hnsw`; quantization can be revisited for both engines together.
