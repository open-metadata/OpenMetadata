# Google Gemini Embedding Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fourth embedding provider — Google Gemini via the Generative Language API — alongside the existing `openai`, `bedrock`, and `djl` providers, using a single API key for auth.

**Architecture:** New `GoogleEmbeddingClient` extends `EmbeddingClient` and is wired through the existing `SearchRepository.createEmbeddingClient()` switch. Configuration lives under a new `google` sub-block in `naturalLanguageSearch` in `elasticSearchConfiguration.json` — generated `Google.java` flows through the schema-first pipeline like the existing `Openai` class.

**Tech Stack:** Java 21, JUnit 5, JSON Schema (jsonschema2pojo via Maven), Java built-in `HttpClient`, Jackson `ObjectMapper`.

**Spec:** [`docs/superpowers/specs/2026-05-07-google-gemini-embedding-client-design.md`](../specs/2026-05-07-google-gemini-embedding-client-design.md)

---

## Task 1: Add `google` block to JSON schema and regenerate Java models

**Files:**
- Modify: `openmetadata-spec/src/main/resources/json/schema/configuration/elasticSearchConfiguration.json`

The generated class `org.openmetadata.schema.service.configuration.elasticsearch.Google` will appear under `openmetadata-spec/target/generated-sources/jsonschema2pojo/...` after the build. It is not committed — it's regenerated on every build of `openmetadata-spec`.

- [ ] **Step 1: Edit the schema — add `google` block**

In `openmetadata-spec/src/main/resources/json/schema/configuration/elasticSearchConfiguration.json`, locate the `naturalLanguageSearch.properties.openai` block. Insert a new `google` block immediately after the `openai` block (before the closing `}` of `naturalLanguageSearch.properties`). The new block:

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

A comma must separate it from the preceding `openai` block. Make sure no trailing comma exists on the new `google` block (it's the last property under `naturalLanguageSearch.properties`).

- [ ] **Step 2: Update the `embeddingProvider` description**

In the same file, find the `embeddingProvider` property under `naturalLanguageSearch.properties`:

```json
        "embeddingProvider": {
          "description": "The provider to use for generating vector embeddings (e.g., bedrock, openai).",
          "type": "string",
          "default": "bedrock"
        },
```

Replace its description with:

```json
          "description": "The provider to use for generating vector embeddings (e.g., bedrock, openai, google, djl).",
```

- [ ] **Step 3: Regenerate Java models**

Run:

```bash
mvn clean install -pl openmetadata-spec -DskipTests
```

Expected: `BUILD SUCCESS`. The `Google.class` is now in the generated sources/classes for `openmetadata-spec`.

- [ ] **Step 4: Verify `Google.java` was generated**

Run:

```bash
find openmetadata-spec/target -path '*elasticsearch/Google.java' 2>/dev/null
```

Expected output: a single path like
`openmetadata-spec/target/generated-sources/jsonschema2pojo/org/openmetadata/schema/service/configuration/elasticsearch/Google.java`

If empty, the schema edit did not register — re-check the JSON for syntax errors and rebuild.

- [ ] **Step 5: Verify the generated class shape**

Run:

```bash
grep -E 'apiKey|embeddingModelId|embeddingDimension|endpoint|class Google' openmetadata-spec/target/generated-sources/jsonschema2pojo/org/openmetadata/schema/service/configuration/elasticsearch/Google.java | head -20
```

Expected: lines mentioning `class Google`, the four properties, and `withApiKey` / `withEmbeddingModelId` / `withEmbeddingDimension` / `withEndpoint` builder methods.

- [ ] **Step 6: Commit**

```bash
git add openmetadata-spec/src/main/resources/json/schema/configuration/elasticSearchConfiguration.json
git commit -m "feat(spec): add google embedding provider config block"
```

---

## Task 2: Skeleton `GoogleEmbeddingClient` + happy-path test (RED → GREEN)

**Files:**
- Create: `openmetadata-service/src/main/java/org/openmetadata/service/search/vector/client/GoogleEmbeddingClient.java`
- Create: `openmetadata-service/src/test/java/org/openmetadata/service/search/vector/client/GoogleEmbeddingClientTest.java`

The test file uses the same hand-rolled `StubHttpResponse` + `StubHttpClient` pattern as `OpenAIEmbeddingClientTest`. We do not introduce Mockito.

- [ ] **Step 1: Create the test scaffolding with the first failing test**

Create `openmetadata-service/src/test/java/org/openmetadata/service/search/vector/client/GoogleEmbeddingClientTest.java`:

```java
/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 *  or implied. See the License for the specific language governing permissions and limitations under
 *  the License.
 */
package org.openmetadata.service.search.vector.client;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import javax.net.ssl.SSLSession;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.Google;
import org.openmetadata.schema.service.configuration.elasticsearch.NaturalLanguageSearchConfiguration;

class GoogleEmbeddingClientTest {

  private static class StubHttpResponse implements HttpResponse<String> {
    private final String body;
    private final int statusCode;
    private final HttpRequest request;

    StubHttpResponse(String body, int statusCode, HttpRequest request) {
      this.body = body;
      this.statusCode = statusCode;
      this.request = request;
    }

    @Override
    public int statusCode() {
      return statusCode;
    }

    @Override
    public HttpRequest request() {
      return request;
    }

    @Override
    public Optional<HttpResponse<String>> previousResponse() {
      return Optional.empty();
    }

    @Override
    public HttpHeaders headers() {
      return HttpHeaders.of(Map.of(), (a, b) -> true);
    }

    @Override
    public String body() {
      return body;
    }

    @Override
    public Optional<SSLSession> sslSession() {
      return Optional.empty();
    }

    @Override
    public URI uri() {
      return request.uri();
    }

    @Override
    public HttpClient.Version version() {
      return HttpClient.Version.HTTP_2;
    }
  }

  private static class StubHttpClient extends HttpClient {
    private final String responseBody;
    private final int statusCode;
    private final List<HttpRequest> capturedRequests = new ArrayList<>();

    StubHttpClient(String responseBody, int statusCode) {
      this.responseBody = responseBody;
      this.statusCode = statusCode;
    }

    List<HttpRequest> getCapturedRequests() {
      return capturedRequests;
    }

    @Override
    public Optional<java.net.Authenticator> authenticator() {
      return Optional.empty();
    }

    @Override
    public Optional<java.time.Duration> connectTimeout() {
      return Optional.empty();
    }

    @Override
    public Optional<java.net.CookieHandler> cookieHandler() {
      return Optional.empty();
    }

    @Override
    public Redirect followRedirects() {
      return Redirect.NEVER;
    }

    @Override
    public Optional<java.net.ProxySelector> proxy() {
      return Optional.empty();
    }

    @Override
    public javax.net.ssl.SSLContext sslContext() {
      return null;
    }

    @Override
    public javax.net.ssl.SSLParameters sslParameters() {
      return null;
    }

    @Override
    public Optional<java.util.concurrent.Executor> executor() {
      return Optional.empty();
    }

    @Override
    public Version version() {
      return Version.HTTP_2;
    }

    @Override
    @SuppressWarnings("unchecked")
    public <T> HttpResponse<T> send(
        HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler) {
      capturedRequests.add(request);
      return (HttpResponse<T>) new StubHttpResponse(responseBody, statusCode, request);
    }

    @Override
    public <T> CompletableFuture<HttpResponse<T>> sendAsync(
        HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler) {
      return CompletableFuture.supplyAsync(() -> send(request, responseBodyHandler));
    }

    @Override
    public <T> CompletableFuture<HttpResponse<T>> sendAsync(
        HttpRequest request,
        HttpResponse.BodyHandler<T> responseBodyHandler,
        HttpResponse.PushPromiseHandler<T> pushPromiseHandler) {
      return sendAsync(request, responseBodyHandler);
    }
  }

  @Test
  void testSuccessfulEmbeddingResponse() {
    String response = "{\"embedding\":{\"values\":[0.1,0.2,0.3]}}";
    StubHttpClient httpClient = new StubHttpClient(response, 200);

    GoogleEmbeddingClient client =
        new GoogleEmbeddingClient(
            httpClient,
            "test-key",
            "text-embedding-004",
            3,
            "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent");

    float[] embedding = client.embed("hello world");

    assertNotNull(embedding);
    assertEquals(3, embedding.length);
    assertEquals(0.1f, embedding[0], 0.001f);
    assertEquals(0.2f, embedding[1], 0.001f);
    assertEquals(0.3f, embedding[2], 0.001f);
  }

  private ElasticSearchConfiguration buildConfig(String apiKey, String modelId, int dimension) {
    Google googleCfg =
        new Google()
            .withApiKey(apiKey)
            .withEmbeddingModelId(modelId)
            .withEmbeddingDimension(dimension);

    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setGoogle(googleCfg);

    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);
    return config;
  }
}
```

- [ ] **Step 2: Run the test to verify it fails (compilation error)**

```bash
mvn test -pl openmetadata-service -Dtest=GoogleEmbeddingClientTest -DfailIfNoTests=false
```

Expected: `BUILD FAILURE` — compilation error citing `cannot find symbol class GoogleEmbeddingClient` (the production class doesn't exist yet) and possibly `setGoogle` if the schema regeneration didn't propagate. If `setGoogle` is the failure, ensure Task 1's `mvn clean install -pl openmetadata-spec -DskipTests` was run.

- [ ] **Step 3: Create the production class with full implementation**

Create `openmetadata-service/src/main/java/org/openmetadata/service/search/vector/client/GoogleEmbeddingClient.java`:

```java
/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 *  or implied. See the License for the specific language governing permissions and limitations under
 *  the License.
 */
package org.openmetadata.service.search.vector.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.Google;
import org.openmetadata.schema.service.configuration.elasticsearch.NaturalLanguageSearchConfiguration;

@Slf4j
public final class GoogleEmbeddingClient extends EmbeddingClient {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String DEFAULT_BASE_URL =
      "https://generativelanguage.googleapis.com/v1beta/models/";

  private final HttpClient httpClient;
  private final String apiKey;
  private final String modelId;
  private final int dimension;
  private final String endpoint;

  public GoogleEmbeddingClient(ElasticSearchConfiguration config) {
    super(resolveMaxConcurrent(config));
    NaturalLanguageSearchConfiguration nlsCfg = config.getNaturalLanguageSearch();
    Google googleCfg = nlsCfg.getGoogle();
    if (googleCfg == null) {
      throw new IllegalArgumentException("Google configuration is required");
    }
    if (googleCfg.getApiKey() == null || googleCfg.getApiKey().isBlank()) {
      throw new IllegalArgumentException("Google API key is required");
    }
    if (googleCfg.getEmbeddingModelId() == null || googleCfg.getEmbeddingModelId().isBlank()) {
      throw new IllegalArgumentException("Google embedding model ID is required");
    }
    if (googleCfg.getEmbeddingDimension() == null || googleCfg.getEmbeddingDimension() <= 0) {
      throw new IllegalArgumentException("Google embedding dimension must be positive");
    }

    this.apiKey = googleCfg.getApiKey();
    this.modelId = googleCfg.getEmbeddingModelId();
    this.dimension = googleCfg.getEmbeddingDimension();
    this.endpoint = resolveEndpoint(googleCfg);
    this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();

    LOG.info(
        "Initialized GoogleEmbeddingClient with model={}, dimension={}, endpoint={}",
        modelId,
        dimension,
        endpoint);
  }

  GoogleEmbeddingClient(
      HttpClient httpClient, String apiKey, String modelId, int dimension, String endpoint) {
    this(httpClient, apiKey, modelId, dimension, endpoint, DEFAULT_MAX_CONCURRENT_REQUESTS);
  }

  GoogleEmbeddingClient(
      HttpClient httpClient,
      String apiKey,
      String modelId,
      int dimension,
      String endpoint,
      int maxConcurrentRequests) {
    super(maxConcurrentRequests);
    this.httpClient = httpClient;
    this.apiKey = apiKey;
    this.modelId = modelId;
    this.dimension = dimension;
    this.endpoint = endpoint;
  }

  private String resolveEndpoint(Google config) {
    String configured = config.getEndpoint();
    if (configured != null && !configured.isBlank()) {
      return configured.replaceAll("/+$", "");
    }
    return DEFAULT_BASE_URL + config.getEmbeddingModelId() + ":embedContent";
  }

  @Override
  protected float[] doEmbed(String text) {
    if (text == null || text.isBlank()) {
      throw new IllegalArgumentException("Input text must not be null or blank");
    }

    try {
      String body = buildRequestBody(text);
      HttpRequest request = buildRequest(body);
      HttpResponse<String> response =
          httpClient.send(request, HttpResponse.BodyHandlers.ofString());

      if (response.statusCode() != 200) {
        String errorMsg = extractErrorMessage(response.body());
        throw new RuntimeException(
            "Google API returned status " + response.statusCode() + ": " + errorMsg);
      }

      return parseEmbeddingResponse(response.body());
    } catch (IOException e) {
      LOG.error("IO error calling Google API: {}", e.getMessage(), e);
      throw new RuntimeException("Google embedding generation failed due to IO error", e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new RuntimeException("Google embedding generation was interrupted", e);
    }
  }

  private String buildRequestBody(String text) throws IOException {
    ObjectNode payload = MAPPER.createObjectNode();
    payload.put("model", "models/" + modelId);
    ObjectNode content = payload.putObject("content");
    ArrayNode parts = content.putArray("parts");
    ObjectNode part = parts.addObject();
    part.put("text", text);
    return MAPPER.writeValueAsString(payload);
  }

  private HttpRequest buildRequest(String body) {
    String encodedKey = URLEncoder.encode(apiKey, StandardCharsets.UTF_8);
    String url = endpoint + "?key=" + encodedKey;
    return HttpRequest.newBuilder()
        .uri(URI.create(url))
        .header("Content-Type", "application/json")
        .timeout(Duration.ofSeconds(30))
        .POST(HttpRequest.BodyPublishers.ofString(body))
        .build();
  }

  @Override
  public int getDimension() {
    return dimension;
  }

  @Override
  public String getModelId() {
    return modelId;
  }

  private float[] parseEmbeddingResponse(String responseBody) {
    try {
      JsonNode root = MAPPER.readTree(responseBody);
      JsonNode embedding = root.get("embedding");
      if (embedding == null || !embedding.isObject()) {
        throw new RuntimeException("Invalid Google response: no embedding object found");
      }
      JsonNode values = embedding.get("values");
      if (values == null || !values.isArray() || values.isEmpty()) {
        throw new RuntimeException("Invalid Google response: no values array found");
      }
      float[] result = new float[values.size()];
      for (int i = 0; i < values.size(); i++) {
        result[i] = (float) values.get(i).asDouble();
      }
      return result;
    } catch (IOException e) {
      throw new RuntimeException("Failed to parse Google embedding response", e);
    }
  }

  private String extractErrorMessage(String responseBody) {
    try {
      JsonNode root = MAPPER.readTree(responseBody);
      JsonNode error = root.get("error");
      if (error != null && error.has("message")) {
        return error.get("message").asText();
      }
    } catch (Exception ignored) {
      // fall through to raw body
    }
    return responseBody;
  }
}
```

- [ ] **Step 4: Run the test to verify GREEN**

```bash
mvn test -pl openmetadata-service -Dtest=GoogleEmbeddingClientTest
```

Expected: 1 test run, 0 failures. The single happy-path test passes.

- [ ] **Step 5: Commit**

```bash
git add openmetadata-service/src/main/java/org/openmetadata/service/search/vector/client/GoogleEmbeddingClient.java \
        openmetadata-service/src/test/java/org/openmetadata/service/search/vector/client/GoogleEmbeddingClientTest.java
git commit -m "feat(search): add GoogleEmbeddingClient with happy-path test"
```

---

## Task 3: Constructor validation tests (RED → GREEN)

**Files:**
- Modify: `openmetadata-service/src/test/java/org/openmetadata/service/search/vector/client/GoogleEmbeddingClientTest.java`

These behaviors are already implemented in Task 2 (the constructor validates everything). The tests confirm the contract is correct.

- [ ] **Step 1: Add validation tests**

Append the following tests inside `class GoogleEmbeddingClientTest { ... }`, after the existing `testSuccessfulEmbeddingResponse`:

```java
  @Test
  void testClientCreationWithConfig() {
    ElasticSearchConfiguration config = buildConfig("test-key", "text-embedding-004", 768);
    GoogleEmbeddingClient client = new GoogleEmbeddingClient(config);

    assertEquals(768, client.getDimension());
    assertEquals("text-embedding-004", client.getModelId());
  }

  @Test
  void testClientCreationWithCustomModel() {
    ElasticSearchConfiguration config = buildConfig("test-key", "gemini-embedding-001", 3072);
    GoogleEmbeddingClient client = new GoogleEmbeddingClient(config);

    assertEquals(3072, client.getDimension());
    assertEquals("gemini-embedding-001", client.getModelId());
  }

  @Test
  void testMissingGoogleConfigThrows() {
    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    assertThrows(IllegalArgumentException.class, () -> new GoogleEmbeddingClient(config));
  }

  @Test
  void testMissingApiKeyThrows() {
    Google googleCfg =
        new Google().withEmbeddingModelId("text-embedding-004").withEmbeddingDimension(768);

    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setGoogle(googleCfg);

    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    assertThrows(IllegalArgumentException.class, () -> new GoogleEmbeddingClient(config));
  }

  @Test
  void testBlankApiKeyThrows() {
    Google googleCfg =
        new Google()
            .withApiKey("   ")
            .withEmbeddingModelId("text-embedding-004")
            .withEmbeddingDimension(768);

    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setGoogle(googleCfg);

    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    assertThrows(IllegalArgumentException.class, () -> new GoogleEmbeddingClient(config));
  }

  @Test
  void testMissingModelIdThrows() {
    Google googleCfg = new Google().withApiKey("test-key").withEmbeddingDimension(768);

    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setGoogle(googleCfg);

    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    assertThrows(IllegalArgumentException.class, () -> new GoogleEmbeddingClient(config));
  }

  @Test
  void testZeroDimensionThrows() {
    Google googleCfg =
        new Google()
            .withApiKey("test-key")
            .withEmbeddingModelId("text-embedding-004")
            .withEmbeddingDimension(0);

    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setGoogle(googleCfg);

    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    assertThrows(IllegalArgumentException.class, () -> new GoogleEmbeddingClient(config));
  }

  @Test
  void testNegativeDimensionThrows() {
    Google googleCfg =
        new Google()
            .withApiKey("test-key")
            .withEmbeddingModelId("text-embedding-004")
            .withEmbeddingDimension(-100);

    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setGoogle(googleCfg);

    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    assertThrows(IllegalArgumentException.class, () -> new GoogleEmbeddingClient(config));
  }

  @Test
  void testNullTextThrows() {
    ElasticSearchConfiguration config = buildConfig("test-key", "text-embedding-004", 768);
    GoogleEmbeddingClient client = new GoogleEmbeddingClient(config);

    assertThrows(IllegalArgumentException.class, () -> client.embed(null));
  }

  @Test
  void testBlankTextThrows() {
    ElasticSearchConfiguration config = buildConfig("test-key", "text-embedding-004", 768);
    GoogleEmbeddingClient client = new GoogleEmbeddingClient(config);

    assertThrows(IllegalArgumentException.class, () -> client.embed("   "));
  }
```

- [ ] **Step 2: Run the tests to verify GREEN**

```bash
mvn test -pl openmetadata-service -Dtest=GoogleEmbeddingClientTest
```

Expected: 11 tests run (1 from Task 2 + 10 added here), 0 failures.

- [ ] **Step 3: Commit**

```bash
git add openmetadata-service/src/test/java/org/openmetadata/service/search/vector/client/GoogleEmbeddingClientTest.java
git commit -m "test(search): add constructor validation tests for GoogleEmbeddingClient"
```

---

## Task 4: HTTP error path tests (RED → GREEN)

**Files:**
- Modify: `openmetadata-service/src/test/java/org/openmetadata/service/search/vector/client/GoogleEmbeddingClientTest.java`

These tests verify the non-200 path and malformed-response path. Implementation already exists from Task 2 — these confirm error messages and exception type.

- [ ] **Step 1: Add error path tests**

Append to `class GoogleEmbeddingClientTest`:

```java
  @Test
  void testNon200StatusThrowsWithExtractedErrorMessage() {
    String errorBody =
        "{\"error\":{\"code\":429,\"message\":\"Quota exceeded\",\"status\":\"RESOURCE_EXHAUSTED\"}}";
    StubHttpClient httpClient = new StubHttpClient(errorBody, 429);

    GoogleEmbeddingClient client =
        new GoogleEmbeddingClient(
            httpClient,
            "test-key",
            "text-embedding-004",
            768,
            "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent");

    RuntimeException ex = assertThrows(RuntimeException.class, () -> client.embed("hello"));
    assertTrue(ex.getMessage().contains("429"));
    assertTrue(ex.getMessage().contains("Quota exceeded"));
  }

  @Test
  void testNon200StatusWithNonJsonBodyEchoesBody() {
    StubHttpClient httpClient = new StubHttpClient("Service Unavailable", 503);

    GoogleEmbeddingClient client =
        new GoogleEmbeddingClient(
            httpClient,
            "test-key",
            "text-embedding-004",
            768,
            "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent");

    RuntimeException ex = assertThrows(RuntimeException.class, () -> client.embed("hello"));
    assertTrue(ex.getMessage().contains("503"));
    assertTrue(ex.getMessage().contains("Service Unavailable"));
  }

  @Test
  void testMissingEmbeddingObjectThrows() {
    StubHttpClient httpClient = new StubHttpClient("{\"foo\":\"bar\"}", 200);

    GoogleEmbeddingClient client =
        new GoogleEmbeddingClient(
            httpClient,
            "test-key",
            "text-embedding-004",
            768,
            "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent");

    RuntimeException ex = assertThrows(RuntimeException.class, () -> client.embed("hello"));
    assertTrue(ex.getMessage().contains("no embedding object"));
  }

  @Test
  void testMissingValuesArrayThrows() {
    StubHttpClient httpClient = new StubHttpClient("{\"embedding\":{}}", 200);

    GoogleEmbeddingClient client =
        new GoogleEmbeddingClient(
            httpClient,
            "test-key",
            "text-embedding-004",
            768,
            "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent");

    RuntimeException ex = assertThrows(RuntimeException.class, () -> client.embed("hello"));
    assertTrue(ex.getMessage().contains("no values array"));
  }

  @Test
  void testEmptyValuesArrayThrows() {
    StubHttpClient httpClient = new StubHttpClient("{\"embedding\":{\"values\":[]}}", 200);

    GoogleEmbeddingClient client =
        new GoogleEmbeddingClient(
            httpClient,
            "test-key",
            "text-embedding-004",
            768,
            "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent");

    assertThrows(RuntimeException.class, () -> client.embed("hello"));
  }
```

- [ ] **Step 2: Run the tests**

```bash
mvn test -pl openmetadata-service -Dtest=GoogleEmbeddingClientTest
```

Expected: 16 tests run (11 from prior tasks + 5 added here), 0 failures.

- [ ] **Step 3: Commit**

```bash
git add openmetadata-service/src/test/java/org/openmetadata/service/search/vector/client/GoogleEmbeddingClientTest.java
git commit -m "test(search): add HTTP error and malformed response tests for GoogleEmbeddingClient"
```

---

## Task 5: Request shape verification tests (RED → GREEN)

**Files:**
- Modify: `openmetadata-service/src/test/java/org/openmetadata/service/search/vector/client/GoogleEmbeddingClientTest.java`

Verify that the API key travels in the URL query string (not the `Authorization` header), and that the body has the expected Gemini `content.parts[].text` structure.

- [ ] **Step 1: Add request-shape tests**

Append to `class GoogleEmbeddingClientTest`:

```java
  @Test
  void testRequestUrlContainsApiKeyAsQueryParam() {
    String response = "{\"embedding\":{\"values\":[0.1]}}";
    StubHttpClient httpClient = new StubHttpClient(response, 200);

    GoogleEmbeddingClient client =
        new GoogleEmbeddingClient(
            httpClient,
            "my-secret-key",
            "text-embedding-004",
            1,
            "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent");

    client.embed("hi");

    assertEquals(1, httpClient.getCapturedRequests().size());
    HttpRequest request = httpClient.getCapturedRequests().get(0);
    String url = request.uri().toString();
    assertTrue(url.endsWith("text-embedding-004:embedContent?key=my-secret-key"), url);
  }

  @Test
  void testRequestHasNoAuthorizationHeader() {
    String response = "{\"embedding\":{\"values\":[0.1]}}";
    StubHttpClient httpClient = new StubHttpClient(response, 200);

    GoogleEmbeddingClient client =
        new GoogleEmbeddingClient(
            httpClient,
            "my-secret-key",
            "text-embedding-004",
            1,
            "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent");

    client.embed("hi");

    HttpRequest request = httpClient.getCapturedRequests().get(0);
    assertTrue(request.headers().firstValue("Authorization").isEmpty());
    assertTrue(request.headers().firstValue("api-key").isEmpty());
    assertEquals(
        "application/json", request.headers().firstValue("Content-Type").orElse(null));
  }

  @Test
  void testRequestBodyShape() throws Exception {
    String response = "{\"embedding\":{\"values\":[0.1]}}";
    StubHttpClient httpClient = new StubHttpClient(response, 200);

    GoogleEmbeddingClient client =
        new GoogleEmbeddingClient(
            httpClient,
            "my-secret-key",
            "text-embedding-004",
            1,
            "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent");

    client.embed("the quick brown fox");

    HttpRequest request = httpClient.getCapturedRequests().get(0);
    String body = extractBody(request);
    com.fasterxml.jackson.databind.JsonNode parsed =
        new com.fasterxml.jackson.databind.ObjectMapper().readTree(body);
    assertEquals("models/text-embedding-004", parsed.get("model").asText());
    assertEquals(
        "the quick brown fox",
        parsed.get("content").get("parts").get(0).get("text").asText());
  }

  @Test
  void testApiKeyIsUrlEncoded() {
    String response = "{\"embedding\":{\"values\":[0.1]}}";
    StubHttpClient httpClient = new StubHttpClient(response, 200);

    GoogleEmbeddingClient client =
        new GoogleEmbeddingClient(
            httpClient,
            "key with spaces&chars",
            "text-embedding-004",
            1,
            "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent");

    client.embed("hi");

    HttpRequest request = httpClient.getCapturedRequests().get(0);
    String url = request.uri().toString();
    assertTrue(url.contains("key=key+with+spaces%26chars"), url);
  }

  private static String extractBody(HttpRequest request) {
    java.util.concurrent.atomic.AtomicReference<String> captured =
        new java.util.concurrent.atomic.AtomicReference<>();
    request
        .bodyPublisher()
        .ifPresent(
            publisher -> {
              java.util.concurrent.Flow.Subscriber<java.nio.ByteBuffer> subscriber =
                  new java.util.concurrent.Flow.Subscriber<>() {
                    private final java.io.ByteArrayOutputStream out =
                        new java.io.ByteArrayOutputStream();

                    @Override
                    public void onSubscribe(java.util.concurrent.Flow.Subscription subscription) {
                      subscription.request(Long.MAX_VALUE);
                    }

                    @Override
                    public void onNext(java.nio.ByteBuffer item) {
                      byte[] arr = new byte[item.remaining()];
                      item.get(arr);
                      out.write(arr, 0, arr.length);
                    }

                    @Override
                    public void onError(Throwable throwable) {}

                    @Override
                    public void onComplete() {
                      captured.set(out.toString(java.nio.charset.StandardCharsets.UTF_8));
                    }
                  };
              publisher.subscribe(subscriber);
            });
    return captured.get();
  }
```

- [ ] **Step 2: Run the tests**

```bash
mvn test -pl openmetadata-service -Dtest=GoogleEmbeddingClientTest
```

Expected: 20 tests run (16 from prior tasks + 4 added here), 0 failures.

- [ ] **Step 3: Commit**

```bash
git add openmetadata-service/src/test/java/org/openmetadata/service/search/vector/client/GoogleEmbeddingClientTest.java
git commit -m "test(search): verify Google embedding request URL, headers, and body shape"
```

---

## Task 6: Wire `google` provider into `SearchRepository.createEmbeddingClient`

**Files:**
- Modify: `openmetadata-service/src/main/java/org/openmetadata/service/search/SearchRepository.java` (lines 3210–3238)

- [ ] **Step 1: Add the new switch case**

Find the `createEmbeddingClient` method around line 3210. The current switch has cases for `bedrock`, `openai`, `djl`. Add a `google` case after `openai` and before `djl` (alphabetical-ish; the position doesn't matter functionally).

Replace:

```java
      case "openai" -> {
        if (config.getOpenai() == null) {
          throw new IllegalStateException(
              "OpenAI configuration is required when using openai provider");
        }
        yield new OpenAIEmbeddingClient(esConfig);
      }
      case "djl" -> {
```

with:

```java
      case "openai" -> {
        if (config.getOpenai() == null) {
          throw new IllegalStateException(
              "OpenAI configuration is required when using openai provider");
        }
        yield new OpenAIEmbeddingClient(esConfig);
      }
      case "google" -> {
        if (config.getGoogle() == null) {
          throw new IllegalStateException(
              "Google configuration is required when using google provider");
        }
        yield new GoogleEmbeddingClient(esConfig);
      }
      case "djl" -> {
```

- [ ] **Step 2: Run the openmetadata-service compile to verify**

```bash
mvn compile -pl openmetadata-service -am -DskipTests
```

Expected: `BUILD SUCCESS`. The `config.getGoogle()` accessor exists because `Google.java` was generated in Task 1.

- [ ] **Step 3: Run the full GoogleEmbeddingClient test suite as a smoke check**

```bash
mvn test -pl openmetadata-service -Dtest=GoogleEmbeddingClientTest
```

Expected: 20 tests run, 0 failures.

- [ ] **Step 4: Commit**

```bash
git add openmetadata-service/src/main/java/org/openmetadata/service/search/SearchRepository.java
git commit -m "feat(search): wire google embedding provider into SearchRepository switch"
```

---

## Task 7: Final verification — formatting, compile, and broader test pass

**Files:**
- All files touched in Tasks 1–6.

- [ ] **Step 1: Apply Spotless formatting**

```bash
mvn spotless:apply -pl openmetadata-service
```

Expected: `BUILD SUCCESS`. If any files were reformatted, review the diff with `git diff`.

- [ ] **Step 2: Re-run the test suite to confirm formatting didn't break anything**

```bash
mvn test -pl openmetadata-service -Dtest=GoogleEmbeddingClientTest
```

Expected: 20 tests run, 0 failures.

- [ ] **Step 3: Run the full vector/client test package**

This catches any regression in the existing `OpenAIEmbeddingClientTest` / `BedrockEmbeddingClientTest` / `DjlEmbeddingClientTest`:

```bash
mvn test -pl openmetadata-service -Dtest='*EmbeddingClientTest'
```

Expected: all four test classes pass, 0 failures.

- [ ] **Step 4: If Spotless modified files, commit**

```bash
git status
```

If files are modified:

```bash
git add -u
git commit -m "chore: apply spotless formatting"
```

If clean, skip this commit.

- [ ] **Step 5: Final review of the branch diff**

```bash
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
```

Expected commits (in order):
1. `feat(spec): add google embedding provider config block`
2. `feat(search): add GoogleEmbeddingClient with happy-path test`
3. `test(search): add constructor validation tests for GoogleEmbeddingClient`
4. `test(search): add HTTP error and malformed response tests for GoogleEmbeddingClient`
5. `test(search): verify Google embedding request URL, headers, and body shape`
6. `feat(search): wire google embedding provider into SearchRepository switch`
7. (optional) `chore: apply spotless formatting`

Expected diff stat: changes to four files —
- `openmetadata-spec/src/main/resources/json/schema/configuration/elasticSearchConfiguration.json` (~30 lines added)
- `openmetadata-service/src/main/java/org/openmetadata/service/search/vector/client/GoogleEmbeddingClient.java` (new, ~180 lines)
- `openmetadata-service/src/test/java/org/openmetadata/service/search/vector/client/GoogleEmbeddingClientTest.java` (new, ~500 lines)
- `openmetadata-service/src/main/java/org/openmetadata/service/search/SearchRepository.java` (~7 lines added)

---

## Spec coverage check

Cross-referencing each spec section against the plan:

- **Provider name `google`** → Task 1 (schema), Task 6 (switch case)
- **Schema (JSON)** with apiKey/embeddingModelId/embeddingDimension/endpoint → Task 1
- **`embeddingProvider` description updated** → Task 1, Step 2
- **`final` class extending `EmbeddingClient`** → Task 2, Step 3
- **Public constructor + package-private test constructor** → Task 2, Step 3
- **Validation: missing config / blank apiKey / blank modelId / non-positive dim** → Task 2 (impl), Task 3 (tests)
- **HTTP call: POST, query-string auth, no `Authorization` header, JSON body** → Task 2 (impl), Task 5 (tests)
- **Response parsing `embedding.values`** → Task 2 (impl), Task 4 (negative tests)
- **Non-200 with `error.message` extraction** → Task 2 (impl), Task 4 (tests)
- **Non-200 with non-JSON body falls back to raw body** → Task 2 (impl), Task 4 (tests)
- **`IOException` / `InterruptedException` re-thrown as `RuntimeException`, interrupt flag preserved** → Task 2 (impl). No test-only path triggers this; covered by code review.
- **30-second timeout** → Task 2 (impl). No assertion test; this is a reasonable defaults review.
- **`getDimension()` / `getModelId()` return configured values** → Task 2 (impl), Task 3 (`testClientCreationWithConfig`, `testClientCreationWithCustomModel`)
- **`SearchRepository.createEmbeddingClient` switch case** → Task 6
- **Hand-rolled `StubHttpResponse` + `StubHttpClient` (no Mockito)** → Task 2, Step 1

All spec points are mapped to tasks.
