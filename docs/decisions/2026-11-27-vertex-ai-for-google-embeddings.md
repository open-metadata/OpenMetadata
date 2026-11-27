# Google embeddings can use Vertex AI with Application Default Credentials

- **Status:** Accepted
- **Revisions:** v1 2026-11-27 (initial) · v2 2026-11-27 (switching a populated index)
- **Deciders:** OpenMetadata contributors
- **Guard:** GoogleEmbeddingClientTest, SearchRepositoryBehaviorTest.googleEmbeddingsUseVertexOnlyWhenEnabled and VectorChunkIndexIT
- **Related:** [#38915](https://github.com/open-metadata/OpenMetadata/issues/38915), [Google text embeddings API](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/text-embeddings-api)

## Context

A deployment on Google Kubernetes Engine can grant its workload permission to call Vertex AI.
The Gemini Developer API integration requires an API key and uses a different request format.

## Decision

Set `EMBEDDING_PROVIDER=google`, `LLM_GOOGLE_USE_VERTEX_AI=true` and
`LLM_GOOGLE_VERTEX_PROJECT` to use Vertex AI. Select the model's location with
`LLM_GOOGLE_VERTEX_LOCATION` (default `us-central1`). The Google auth library obtains and
refreshes the workload's Application Default Credentials. The client constructs Google's
prediction URL from the project, location and configured model. The API key and custom Gemini
endpoint continue to apply to the existing API-key path. Chat configuration remains independent.

## Consequences

The workload needs access to the Vertex AI prediction API for the selected project, location and
model. Semantic search requests retrieval-document embeddings for indexing and retrieval-query
embeddings for queries. Vertex can report the actual input token count for metering.

## Amendment

v2: Vertex fingerprints include the backend, embedding model ID, dimension and the document/query
task types. A full search rebuild compares these fingerprints for both entity vectors and chunk
vectors, including chunks copied into a staged index. Other providers retain their existing
text-only fingerprints. Switching either way therefore refreshes the affected vectors even if the
catalog text, model ID and dimension stay the same. Repeating the rebuild under the same
configuration can reuse those vectors.

To switch a populated catalog:

1. Schedule the full embedding cost and pause semantic-search traffic for the cutover. Finish any
   active indexing run, then restart all servers and indexing workers with the same new provider
   settings. Use those settings and the same catalog and search configuration for the ops command.
2. From the OpenMetadata distribution run `./bootstrap/openmetadata-ops.sh reindex --force`
   with no entity filter. The flag starts the full reindex even when the mappings are unchanged.
   The new fingerprint makes the rebuild regenerate both kinds of stored vector. The standalone
   `reembed` command skips release-managed ontology terms.
3. Check the Search Indexing run's final status and embedding or chunk failures before restoring
   semantic-search traffic. Correct any provider or quota errors and rerun the full command. It can
   reuse vectors already rebuilt under the new configuration. Follow the same steps if switching back.
