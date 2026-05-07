# Google Gemini Embedding Client — Design

**Date:** 2026-05-07
**Status:** Proposed
**Scope:** Add a fourth embedding provider — Google's Generative Language API (Gemini) — alongside the existing `openai`, `bedrock`, and `djl` providers used by OpenMetadata's vector search.

## Goal

Allow OpenMetadata operators to point natural-language / semantic search at Google's Gemini embedding models using a single API key from Google AI Studio, with no GCP project, service account, or OAuth setup required.

## Non-goals

- Vertex AI on GCP (project + service-account auth) — separate provider, future work.
- Gemini chat/completions for NLQ query transformation — only the embedding side is covered here.
- Dynamic dimension reduction via `outputDimensionality` — operators set `embeddingDimension` to match the model's native output, same contract as the existing providers.

## Context

The codebase already has a clean extension point for embedding providers:

- **Base class:** `EmbeddingClient` (`openmetadata-service/src/main/java/org/openmetadata/service/search/vector/client/EmbeddingClient.java`) — template-method pattern with semaphore-based concurrency limiting.
- **Three siblings:** `OpenAIEmbeddingClient`, `BedrockEmbeddingClient`, `DjlEmbeddingClient` in the same package.
- **Schema:** `naturalLanguageSearch` block in `openmetadata-spec/src/main/resources/json/schema/configuration/elasticSearchConfiguration.json` defines a per-provider sub-block (`openai`, `bedrock`, `djl`).
- **Wiring:** `SearchRepository.createEmbeddingClient(ElasticSearchConfiguration)` is a single switch on `embeddingProvider`.

The Google provider slots into all four touch points without changing the contract.

## Design

### Provider name

`google` — used as both the JSON schema field name (`naturalLanguageSearch.google`) and the `embeddingProvider` value. Matches the flatness of `openai` / `bedrock`. A future Vertex AI provider would land as a separate `googleVertexAi` block; auth model is different enough that fusing them would muddy the config.

### Schema (JSON)

Added under `naturalLanguageSearch.properties` in `elasticSearchConfiguration.json`, alongside `openai`/`bedrock`/`djl`:

```json
"google": {
  "description": "Google Gemini configuration for embedding generation via the Generative Language API.",
  "type": "object",
  "javaType": "org.openmetadata.schema.service.configuration.elasticsearch.Google",
  "properties": {
    "apiKey": {
      "description": "API key from Google AI Studio for authenticating with the Generative Language API.",
      "type": "string"
    },
    "embeddingModelId": {
      "description": "Gemini embedding model identifier (e.g., text-embedding-004, gemini-embedding-001).",
      "type": "string",
      "default": "text-embedding-004"
    },
    "embeddingDimension": {
      "description": "Dimension of the embedding vector. Must match the model's native output dimension (e.g., 768 for text-embedding-004).",
      "type": "integer",
      "default": 768
    },
    "endpoint": {
      "description": "Custom endpoint URL. Leave empty for the default Generative Language API.",
      "type": "string"
    }
  },
  "additionalProperties": false
}
```

The `embeddingProvider` description is updated to mention `google` as a valid value.

### Client implementation

New class `GoogleEmbeddingClient` in `openmetadata-service/src/main/java/org/openmetadata/service/search/vector/client/GoogleEmbeddingClient.java`. Mirrors `OpenAIEmbeddingClient` structure:

- `final` class extending `EmbeddingClient`.
- Public constructor `GoogleEmbeddingClient(ElasticSearchConfiguration config)` — pulls the `Google` sub-config, validates required fields, builds an `HttpClient`.
- Package-private constructor `GoogleEmbeddingClient(HttpClient, String apiKey, String modelId, int dimension, String endpoint)` for unit-test injection (also mirrors OpenAI).
- `protected float[] doEmbed(String text)` — issues the HTTP call.
- `getDimension()` / `getModelId()` return the configured values.

#### Validation

In the public constructor — same shape as `OpenAIEmbeddingClient`:

- `googleCfg == null` → `IllegalArgumentException("Google configuration is required")`
- `apiKey` null/blank → `IllegalArgumentException("Google API key is required")`
- `embeddingModelId` null/blank → `IllegalArgumentException("Google embedding model ID is required")`
- `embeddingDimension == null || <= 0` → `IllegalArgumentException("Google embedding dimension must be positive")`

#### HTTP call

- **Method:** `POST`
- **URL:** `{endpoint || "https://generativelanguage.googleapis.com/v1beta/models/" + modelId + ":embedContent"}?key={apiKey}` — endpoint resolution mirrors the OpenAI pattern (custom override wins, otherwise default). When the user supplies `endpoint`, we treat it as the full URL up to (but not including) the query string and append `?key={apiKey}`.
- **Headers:** `Content-Type: application/json` only. Auth travels in the query string per Google's standard for the Generative Language API. (We deliberately do not use `Authorization: Bearer` — that's the OAuth/Vertex pattern.)
- **Body:**
  ```json
  {
    "model": "models/{modelId}",
    "content": { "parts": [{ "text": "<input>" }] }
  }
  ```
  No `outputDimensionality` field — keeps the contract aligned with `OpenAIEmbeddingClient`, which also does not pass `dimensions` despite OpenAI supporting it. Operators must set `embeddingDimension` to match the model's native output.
- **Timeout:** `Duration.ofSeconds(30)` — matches OpenAI client.

#### Response handling

Success body shape:
```json
{ "embedding": { "values": [0.013, -0.008, ...] } }
```

Parser walks `embedding.values`, builds `float[]`. Same defensive checks as the OpenAI parser:

- `embedding` node missing or non-object → `RuntimeException("Invalid Google response: no embedding object found")`
- `values` array missing or empty → `RuntimeException("Invalid Google response: no values array found")`

Non-200: extract `error.message` from the body if present (Google's standard error envelope is `{ "error": { "code": ..., "message": ..., "status": ... } }`), otherwise echo the raw body. Throw `RuntimeException("Google API returned status " + status + ": " + msg)`.

`IOException` and `InterruptedException` are caught and re-thrown as `RuntimeException`, exactly like the OpenAI client. `InterruptedException` re-sets the interrupt flag.

### Registration

In `SearchRepository.createEmbeddingClient(ElasticSearchConfiguration)` — one new case:

```java
case "google" -> new GoogleEmbeddingClient(esConfig);
```

No other call sites change. `VectorDocBuilder`, `OpenSearchVectorService`, `VectorEmbeddingHandler` work against the `EmbeddingClient` base class and need no edits.

### Tests

New file `openmetadata-service/src/test/java/org/openmetadata/service/search/vector/client/GoogleEmbeddingClientTest.java`, mirroring `OpenAIEmbeddingClientTest`. Cases:

- **Construction**
  - Valid config → succeeds, `getDimension()` and `getModelId()` return configured values.
  - Missing `Google` sub-config → `IllegalArgumentException`.
  - Missing/blank `apiKey` → `IllegalArgumentException`.
  - Missing/blank `embeddingModelId` → `IllegalArgumentException`.
  - Null or non-positive `embeddingDimension` → `IllegalArgumentException`.
- **Embedding generation** (test-only constructor with a mocked `HttpClient`)
  - 200 with valid body → returns the parsed `float[]` with the expected length and values.
  - 200 with malformed body (missing `embedding` / `values`) → `RuntimeException`.
  - Non-200 with Google error envelope → `RuntimeException` whose message contains the extracted `error.message`.
  - Non-200 with unparseable body → `RuntimeException` whose message contains the raw body.
- **Request shape**
  - The captured request URL ends with `:embedContent?key={apiKey}`.
  - The captured request body contains `"model":"models/<modelId>"` and the input text under `content.parts[0].text`.
  - The `Authorization` header is **not** set; only `Content-Type` and the API key in the URL.
- **Blank input**
  - Calling `embed("")` → `IllegalArgumentException` (mirrors OpenAI client's null/blank guard).

Tests use the hand-rolled `StubHttpResponse` + custom `HttpClient` subclass pattern from `OpenAIEmbeddingClientTest` (no Mockito for the HTTP layer). Captured `HttpRequest` is inspected directly for URL, headers, and body content.

## Out of scope (explicit)

- **Batch endpoint.** Google offers `:batchEmbedContents` but the base class's default `embedBatch` (loop + serial calls) is what the other providers use today. Adding a true batch path is a separate optimization.
- **Streaming, retries, backoff.** Not present in the existing providers; this client matches them.
- **NLQ chat-completion provider.** This design covers only the `EmbeddingClient` slot. The `NLQService` (`org.openmetadata.service.search.nlq.NLQService`) remains untouched.
- **Vertex AI / service-account auth.** A separate `googleVertexAi` provider can be added later without disturbing this one.

## Touched files

```
openmetadata-spec/src/main/resources/json/schema/configuration/elasticSearchConfiguration.json   [MODIFY]
openmetadata-service/src/main/java/org/openmetadata/service/search/vector/client/GoogleEmbeddingClient.java   [CREATE]
openmetadata-service/src/main/java/org/openmetadata/service/search/SearchRepository.java   [MODIFY — one case in switch]
openmetadata-service/src/test/java/org/openmetadata/service/search/vector/client/GoogleEmbeddingClientTest.java   [CREATE]
```

The generated `Google.java` schema class lands under `openmetadata-spec` automatically when `mvn clean install` runs against `openmetadata-spec` after the schema change — same flow as `Openai.java`.
