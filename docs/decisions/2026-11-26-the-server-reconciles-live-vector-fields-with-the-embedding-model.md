# The server reconciles each live vector field with the configured embedding model

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial)
- **Deciders:** Platform team
- **Guard:** ElasticsearchVectorMappingUpdateIT, OpenSearchVectorMappingUpdateIT (each create,
  update and server start case on a real engine), EmbeddingFieldUpdateTest, LiveEmbeddingFieldTest
- **Related:** ADR:2026-11-23-elasticsearch-vector-fields-pin-their-index-options,
  ADR:2026-11-20-elasticsearch-and-opensearch-share-one-vector-index-service

## Context

The `embedding` field of an entity index has to hold vectors of the configured embedding model.
Neither engine lets an existing vector field change its dimensions or its index options,
OpenSearch also refuses a `knn_vector` on an index created without `index.knn` (a setting fixed at
creation), and `PUT _mapping` is atomic: one refused field drops every field in the request. An
index built for another model, or created before embeddings were on, is fixed only by a rebuild,
and every Search Indexing run rebuilds (a staged recreate).

The embedding client exists only once the vector search service starts: at server start, after
the missing indexes are created, and in `reindex`. `migrate` never starts it. The check of the live
field on a mapping update therefore never ran outside tests: a model with other dimensions was
reported nowhere, and an index created at startup got no vector field until a rebuild.

## Decision

1. On start, right after its vector search service, the server reconciles the `embedding` field
   of every existing index whose mapping has `fingerprint` (`SearchRepository.updateEmbeddingFields`).
   `reindex` does not, since it rebuilds them. A mapping update follows the same rule
   (`EmbeddingFieldUpdate`), on both engines:
   - no index behind the name maps the field, and each can take one: it is declared, with the
     pinned options and the model in `_meta`;
   - every index maps it as a vector of the configured dimensions: it is left as it is;
   - an index maps it with other dimensions or as another type, or cannot take one: it is left as
     it is, and one error names the index, what it holds, the model and its dimensions, and the way
     out: Search Indexing for all entities, `openmetadata-ops reindex --force`, or the previous
     model;
   - it cannot be read: it is left as it is, and an error says so.

   A mapping update that leaves the field out still applies every other field, without the
   embedding entries of `_meta`.
2. The live field is read with `GET <name>/_mapping/field/embedding` as raw JSON, of which only
   `type` and `dims` or `dimension` are used, and on OpenSearch, when no index maps the field,
   with `GET <name>/_settings/index.knn`. A typed read of the whole mapping failed on any field the
   client does not model, such as an Elasticsearch 9.3 `bfloat16` vector.
3. A mismatch fails neither startup nor `migrate`. The rebuild that fixes it needs the server, or
   the CLI, running with the new model, and Docker Compose starts the server only after `migrate`
   succeeds while the Helm chart runs `migrate` as an init container of every server pod. Failing
   either would leave no supported way to switch models.

## Consequences

An index created without the vector field gets it before the server writes vectors to it, so they
are searchable instead of only stored. Until an index with other dimensions is rebuilt, the engine
refuses every vector the server writes to it and a vector search over it fails: the error at
startup names the cause and the way out, and nothing yet keeps vector writes and queries away from
such an index. The dedicated vector chunk index is not covered by this rule. Each start reads the
field of every vector index once.
