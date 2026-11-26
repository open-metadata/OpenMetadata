# The server reconciles each live vector field with the configured embedding model

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial)
- **Deciders:** Platform team
- **Guard:** ElasticsearchVectorMappingUpdateIT, OpenSearchVectorMappingUpdateIT (create, update
  and read cases on a real engine), SearchRepositoryBehaviorTest (`startVectorSearch`),
  VectorFieldHealthTest, EmbeddingFieldUpdateTest, LiveEmbeddingFieldTest, EmbeddingModelTest,
  OpenSearchVectorServiceTest, SystemRepositoryEmbeddingsValidationTest
- **Related:** ADR:2026-11-23-elasticsearch-vector-fields-pin-their-index-options,
  ADR:2026-11-20-elasticsearch-and-opensearch-share-one-vector-index-service

## Context

The `embedding` field of a vector index (an entity index whose mapping has `fingerprint`, or a
chunk index) has to hold vectors of the configured embedding model. Neither engine lets an existing
vector field change its dimensions or its index options, OpenSearch refuses a `knn_vector` on an
index created without `index.knn` (a setting fixed at creation), and `PUT _mapping` is atomic: one
refused field drops every field in the request. Only a rebuild fixes an index built for another
model: Search Indexing with Recreate Indexes, or `reindex --force`.

Indexes are created by `migrate` and by the missing-index step of server start, both before any
embedding client exists. When index creation took the model from the client, those indexes got no
vector field, and on OpenSearch no `index.knn`, so they could never get one.

## Decision

1. **The model is known before any index is created.** `SearchRepository.getEmbeddingModel()`
   gives the model id and dimension (`EmbeddingModel`) to every mapping it builds, and `_meta`
   records both. Bedrock, OpenAI and Google take them from the configuration, so `migrate` needs no
   provider credentials; a DJL model is loaded once to learn its dimension, and its client is kept
   for the vector search service. Once the client exists, the model is the client's.
2. **One rule, on both engines** (`EmbeddingFieldUpdate`), for the field of an existing index:
   - no index behind the name maps it, and each can take one: it is declared, and `_meta` records
     the model;
   - every index maps it as a vector of the model's dimension and records no other
     `_meta.embedding_model`: it is kept, and `_meta` is left as it is;
   - otherwise (other dimensions, another type, another recorded model, or no `index.knn`) it
     cannot hold the model's vectors, and is left as it is;
   - it cannot be read: it is left as it is.

   An index that records no model is judged by its dimension. A mapping update that leaves the
   field out still applies every other field. The chunk indexes record their model at creation, and
   their mapping upgrade keeps the live `_meta`.
3. **The live field is read as raw JSON**: `GET <name>/_mapping/field/embedding`, `GET
   <name>/_mapping?filter_path=*.mappings._meta.embedding_model`, and on OpenSearch, when no index
   maps the field, `GET <name>/_settings/index.knn`. A typed read of the whole mapping failed on
   fields the client does not model, such as an Elasticsearch 9.3 `bfloat16` vector.
4. **Server start applies the rule to every existing vector index** right after its vector search
   service starts (`SearchRepository.startVectorSearch`, also used when the status page starts a
   service that failed at boot). `migrate` applies it through its mapping updates. A failure on one
   index is recorded for that index and never stops the start. Each reports one error that lists
   every index that cannot hold the model's vectors, what it holds, and the way out: Search Indexing
   for all entities with Recreate Indexes, `reindex --force`, or the previous model.
5. **Vectors stay away from an index that cannot hold them** (`VectorFieldHealth`): entity and chunk
   writes skip it, an in-place reindex leaves vectors out of its documents, and vector search reads
   only the indexes behind its target that can hold them, or answers 503 with the report when none
   can. The status page's Semantic Search step fails with the same report. Such an index is read
   again on the node whose rebuild replaces it, whenever the status page is opened, and at most
   once a minute when a write or a search meets it, so a rebuild run from any node or the CLI clears
   it without a restart.
6. **A mismatch fails neither startup nor `migrate`.** The rebuild that fixes it needs the server,
   or the CLI, running with the new model, and Docker Compose starts the server only after `migrate`
   succeeds while the Helm chart runs `migrate` as an init container of every server pod.

## Consequences

A fresh install, and any vector index an upgrade adds, gets a working vector field on both engines
without a rebuild. After a model switch, semantic search keeps working on whatever already holds the
new model's vectors and gives one clear signal for the rest, instead of an error per document and an
HTTP 500 per search. Another reader of the vector indexes can ask
`SearchRepository.getVectorFieldHealth()` which ones to leave out. Each node judges with its own
configured model, so during a rolling switch nodes disagree until they all run the new one. Two
models of the same dimension are told apart only on indexes that record their model. Each start
makes two or three small reads per vector index.
