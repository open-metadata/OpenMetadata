# Google embeddings can use Vertex AI with Application Default Credentials

- **Status:** Accepted
- **Revisions:** v1 2026-11-27 (initial)
- **Deciders:** OpenMetadata contributors
- **Guard:** GoogleEmbeddingClientTest and SearchRepositoryBehaviorTest.googleEmbeddingsUseVertexOnlyWhenEnabled
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
embeddings for queries. Rebuild an existing vector index when switching provider mode so stored
documents use the same retrieval setup. Vertex can report the actual input token count for metering.
