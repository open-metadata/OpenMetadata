# The server reconciles each live vector field with the configured embedding model

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial)
- **Deciders:** Platform team
- **Guard:** ElasticsearchVectorMappingUpdateIT, OpenSearchVectorMappingUpdateIT (create, update
  and read cases on a real engine), SearchRepositoryBehaviorTest (`startVectorSearch`, the smart
  reindex set), IndexMappingVersionTrackerTest, SystemRepositoryReindexStatusTest,
  VectorFieldHealthTest, EmbeddingFieldUpdateTest, LiveEmbeddingFieldTest, EmbeddingModelTest,
  OpenSearchVectorServiceTest, OpenSearchVectorServiceOntologyChunkStagingTest,
  RecreateWithEmbeddingsTest, SystemRepositoryEmbeddingsValidationTest
- **Related:** ADR:2026-11-23-elasticsearch-vector-fields-pin-their-index-options,
  ADR:2026-11-20-elasticsearch-and-opensearch-share-one-vector-index-service,
  ADR:2026-11-23-ontology-terms-have-dedicated-search-indexes

## Context

The `embedding` field of a vector index (an entity index whose mapping has `fingerprint`, or a
chunk index) has to hold vectors of the configured embedding model. Neither engine lets an existing
vector field change its dimensions or its index options, OpenSearch refuses a `knn_vector` on an
index created without `index.knn` (a setting fixed at creation), and `PUT _mapping` is atomic: one
refused field drops every field in the request. Only a rebuild fixes an index built for another
dimension, or created without vector support. One whose vectors another model of the same dimension
made is also fixed by a complete `reembed`, which replaces them in place and records the model
(ADR:2026-11-11-reindex-reuses-an-embedding-only-when-its-fingerprint-matches).

Indexes are created by `migrate` and by the missing-index step of server start, both before any
embedding client exists. When index creation took the model from the client, those indexes got no
vector field, and on OpenSearch no `index.knn`, so they could never get one.

## Decision

1. **The model is known before any index is created.** `SearchRepository.getEmbeddingModel()` gives
   the model id and dimension (`EmbeddingModel`) to every mapping it builds, and `_meta` records
   both, always through `EmbeddingFieldUpdate.recordModel`, which keeps the other `_meta` entries.
   Bedrock, OpenAI and Google take them from the configuration, so `migrate` needs no provider
   credentials. A DJL model knows its dimension only once it is loaded, which `migrate` never does:
   its vector indexes are created without the field, on OpenSearch with `index.knn`
   (`SearchRepository.buildsVectorIndexes()`), and server start declares the field (decision 4).
   Once the client exists, the model is the client's. A model is its exact configured id. A Bedrock
   inference profile prefix (`us.`) or an ARN for the same model counts as another model: the code
   has no canonical model identity, and the Bedrock family groups models whose vectors differ
   (Cohere English and multilingual), so it cannot serve as one. Renaming the id needs a rebuild, or
   the previous id.
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
   service that failed at boot). `migrate` applies it through its mapping updates, except for a DJL
   model, whose dimension it does not know. A failure on one index is recorded for that index and
   never stops the start. Each reports one error that lists every index that cannot hold the model's
   vectors, what it holds, and the way out: the smart `reindex` (decision 7), Search Indexing for
   all entities, or the previous model.
5. **Vectors stay away from an index that cannot hold them** (`VectorFieldHealth`): entity and chunk
   writes skip it, a reindex that writes the live index leaves vectors out of its documents, and
   vector search reads only the indexes behind its target that can hold them. It decides that before
   it embeds the query: no index behind the target, as for ontology terms before their chunk index
   exists, is an empty answer, and only indexes of which none can hold the vectors are a 503 with
   the report. The status page's Semantic Search step fails with the same report. Such an index is
   read again on the node whose rebuild replaces it, whenever the status page is opened, and at most
   once a minute when a write or a search meets it, so a rebuild run from any node or the CLI, or a
   complete `reembed` that leaves it holding only the model's vectors, clears it without a restart.
6. **A mismatch fails neither startup nor `migrate`.** The rebuild that fixes it needs the server,
   or the CLI, running with the new model, and Docker Compose starts the server only after `migrate`
   succeeds while the Helm chart runs `migrate` as an init container of every server pod.
7. **The smart `reindex` rebuilds them.** "Needs a rebuild" has one source: a mapping hash that
   changed, or a live index `VectorFieldHealth` records as unable to hold the model's vectors.
   `IndexMappingVersionTracker` reports the second as `CANNOT_HOLD_VECTORS`, because a mapping hash
   cannot see it. The `reindex` command without `--force`, the step operators run after an upgrade
   (the Helm chart ships it as the `cron-reindex` job), first reads every vector field and applies
   decision 2 as server start does, so it also declares a missing field on an index that can take
   one: an additive change, logged with the model, that a second run finds done. On any upgrade,
   patch releases included, it then rebuilds those indexes besides the changed ones: an entity
   index's own type, every data-asset type for the data-asset chunk index, and both ontology term
   types for the ontology chunk index, since only a recreate of every type that writes to a chunk
   index replaces it. The status page's reindex step lists the same indexes. There is no migration
   and no rebuild started by the server. A finished rebuild leaves an index that holds the model's
   vectors, so both read current again.
8. **A recreate of both ontology term types rebuilds an ontology chunk index that cannot hold the
   model's vectors.** Every ontology reindex writes `ontology_embeddings_chunks` in place
   (ADR:2026-11-23-ontology-terms-have-dedicated-search-indexes), and in place every term chunk
   would be refused for good. So such a run, when job-driven, stages a bare generation for the
   model, `ontology_embeddings_chunks_g<N>`, as the data-asset chunk generation is staged, and while
   the run lasts every term chunk write and delete on its coordinator and its participants goes
   there. Once both term types are promoted, one atomic `_aliases` call points
   `ontology_embeddings_chunks` at the generation and removes the previous index; until then
   ontology searches read the previous index. A term type that kept its live index, or a generation
   without chunks while the previous index has some, keeps the previous index, and the next staged
   recreate sweeps the generation. An index that can hold the model's vectors is still written in
   place, so a normal reindex embeds no term again. Elasticsearch keeps no ontology chunks: a term's
   vector lives on its term document, so rebuilding its type is the whole fix.

## Consequences

A fresh install, and any vector index an upgrade adds, gets a working vector field on both engines
without a rebuild. An OpenSearch index created without `index.knn`, as a 2.1 `migrate` created every
vector index that no rebuild has replaced since, is rebuilt by the first smart `reindex` after the
upgrade, and the status page says so until then. After a model switch, semantic search keeps working
on whatever already holds the new model's vectors and gives one clear signal for the rest, instead
of an error per document and an HTTP 500 per search. Ontology terms take the same path: the same
smart `reindex` rebuilds their chunk index, and a term written during that rebuild on a node that
takes no part in it gets its chunks at its next write, as its term document does on any staged
rebuild. Another reader of the vector indexes can ask `SearchRepository.getVectorFieldHealth()`
which ones to leave out. Each node judges with its own configured model, so during a rolling switch
nodes disagree until they all run the new one. Two models of the same dimension are told apart only
on indexes that record their model. Each start and each smart `reindex` makes two or three small
reads per vector index.
