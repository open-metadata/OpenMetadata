# Azure embeddings can select their own deployment

- **Status:** Accepted
- **Revisions:** v1 2026-11-27 (initial)
- **Deciders:** OpenMetadata contributors
- **Guard:** `OpenAIEmbeddingClientTest.routesChatAndEmbeddings` and `SystemRepositoryEmbeddingsValidationTest.reportsEmbeddingDeploymentWhenInitializationFails`
- **Related:** [#32196](https://github.com/open-metadata/OpenMetadata/issues/32196)

## Context

Azure puts the deployment name in the request URL. Chat and embedding models can have separate deployment names on the same endpoint. Sending an embedding request to a chat deployment prevents semantic search from indexing or retrieving vectors.

## Decision

For an Azure endpoint, embedding requests use `llmConfiguration.embeddings.openai.deploymentName` when set. A missing or blank value falls back to `llmConfiguration.openai.deploymentName`. Chat continues to use the latter. An explicit embedding deployment requires a nonblank `llmConfiguration.openai.endpoint` (`LLM_OPENAI_ENDPOINT`). The client rejects this incomplete configuration before opening a connection, and setup validation identifies the missing endpoint. For valid Azure configurations, validation reports the deployment used for embeddings.

## Consequences

Existing single-deployment configurations continue to work. Operators can route semantic search independently with `OPENAI_EMBEDDING_DEPLOYMENT` while sharing the endpoint, API version and credentials. OpenAI-compatible endpoints with both names unset keep their existing embeddings route and bearer authentication.
