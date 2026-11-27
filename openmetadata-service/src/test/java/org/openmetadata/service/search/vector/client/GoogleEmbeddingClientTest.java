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

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.auth.oauth2.AccessToken;
import com.google.auth.oauth2.GoogleCredentials;
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
import java.util.function.Supplier;
import javax.net.ssl.SSLSession;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.configuration.LLMEmbeddingsConfig;
import org.openmetadata.schema.configuration.LLMGoogleConfig;
import org.openmetadata.schema.configuration.LLMGoogleEmbeddingConfig;

class GoogleEmbeddingClientTest {

  private static final String EMBED_ENDPOINT =
      "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent";

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
        new GoogleEmbeddingClient(httpClient, "test-key", "text-embedding-004", 3, EMBED_ENDPOINT);

    float[] embedding = client.embed("hello world");

    assertNotNull(embedding);
    assertEquals(3, embedding.length);
    assertEquals(0.1f, embedding[0], 0.001f);
    assertEquals(0.2f, embedding[1], 0.001f);
    assertEquals(0.3f, embedding[2], 0.001f);
  }

  @Test
  void testClientCreationWithConfig() {
    LLMConfiguration config = buildConfig("test-key", "text-embedding-004", 768);
    GoogleEmbeddingClient client = new GoogleEmbeddingClient(config);

    assertEquals(768, client.getDimension());
    assertEquals("text-embedding-004", client.getModelId());
  }

  @Test
  void testClientCreationWithCustomModel() {
    LLMConfiguration config = buildConfig("test-key", "gemini-embedding-001", 3072);
    GoogleEmbeddingClient client = new GoogleEmbeddingClient(config);

    assertEquals(3072, client.getDimension());
    assertEquals("gemini-embedding-001", client.getModelId());
  }

  @Test
  void testMissingGoogleConfigThrows() {
    LLMConfiguration config = new LLMConfiguration();

    assertThrows(IllegalArgumentException.class, () -> new GoogleEmbeddingClient(config));
  }

  @Test
  void testMissingApiKeyThrows() {
    LLMConfiguration config =
        new LLMConfiguration()
            .withGoogle(new LLMGoogleConfig())
            .withEmbeddings(
                new LLMEmbeddingsConfig()
                    .withProvider(LLMEmbeddingsConfig.Provider.GOOGLE)
                    .withGoogle(
                        new LLMGoogleEmbeddingConfig()
                            .withEmbeddingModelId("text-embedding-004")
                            .withEmbeddingDimension(768)));

    assertThrows(IllegalArgumentException.class, () -> new GoogleEmbeddingClient(config));
  }

  @Test
  void testBlankApiKeyThrows() {
    LLMConfiguration config =
        new LLMConfiguration()
            .withGoogle(new LLMGoogleConfig().withApiKey("   "))
            .withEmbeddings(
                new LLMEmbeddingsConfig()
                    .withProvider(LLMEmbeddingsConfig.Provider.GOOGLE)
                    .withGoogle(
                        new LLMGoogleEmbeddingConfig()
                            .withEmbeddingModelId("text-embedding-004")
                            .withEmbeddingDimension(768)));

    assertThrows(IllegalArgumentException.class, () -> new GoogleEmbeddingClient(config));
  }

  @Test
  void testMissingModelIdThrows() {
    LLMGoogleEmbeddingConfig embeddingCfg =
        new LLMGoogleEmbeddingConfig().withEmbeddingDimension(768);
    // Schema defaults embeddingModelId to "text-embedding-004"; force-null to exercise the guard.
    embeddingCfg.setEmbeddingModelId(null);
    LLMConfiguration config =
        new LLMConfiguration()
            .withGoogle(new LLMGoogleConfig().withApiKey("test-key"))
            .withEmbeddings(
                new LLMEmbeddingsConfig()
                    .withProvider(LLMEmbeddingsConfig.Provider.GOOGLE)
                    .withGoogle(embeddingCfg));

    assertThrows(IllegalArgumentException.class, () -> new GoogleEmbeddingClient(config));
  }

  @Test
  void testBlankModelIdThrows() {
    LLMConfiguration config =
        new LLMConfiguration()
            .withGoogle(new LLMGoogleConfig().withApiKey("test-key"))
            .withEmbeddings(
                new LLMEmbeddingsConfig()
                    .withProvider(LLMEmbeddingsConfig.Provider.GOOGLE)
                    .withGoogle(
                        new LLMGoogleEmbeddingConfig()
                            .withEmbeddingModelId("   ")
                            .withEmbeddingDimension(768)));

    assertThrows(IllegalArgumentException.class, () -> new GoogleEmbeddingClient(config));
  }

  @Test
  void testZeroDimensionThrows() {
    LLMConfiguration config =
        new LLMConfiguration()
            .withGoogle(new LLMGoogleConfig().withApiKey("test-key"))
            .withEmbeddings(
                new LLMEmbeddingsConfig()
                    .withProvider(LLMEmbeddingsConfig.Provider.GOOGLE)
                    .withGoogle(
                        new LLMGoogleEmbeddingConfig()
                            .withEmbeddingModelId("text-embedding-004")
                            .withEmbeddingDimension(0)));

    assertThrows(IllegalArgumentException.class, () -> new GoogleEmbeddingClient(config));
  }

  @Test
  void testNegativeDimensionThrows() {
    LLMConfiguration config =
        new LLMConfiguration()
            .withGoogle(new LLMGoogleConfig().withApiKey("test-key"))
            .withEmbeddings(
                new LLMEmbeddingsConfig()
                    .withProvider(LLMEmbeddingsConfig.Provider.GOOGLE)
                    .withGoogle(
                        new LLMGoogleEmbeddingConfig()
                            .withEmbeddingModelId("text-embedding-004")
                            .withEmbeddingDimension(-100)));

    assertThrows(IllegalArgumentException.class, () -> new GoogleEmbeddingClient(config));
  }

  @Test
  void testNullDimensionThrows() {
    LLMGoogleEmbeddingConfig embeddingCfg =
        new LLMGoogleEmbeddingConfig().withEmbeddingModelId("text-embedding-004");
    embeddingCfg.setEmbeddingDimension(null);
    LLMConfiguration config =
        new LLMConfiguration()
            .withGoogle(new LLMGoogleConfig().withApiKey("test-key"))
            .withEmbeddings(
                new LLMEmbeddingsConfig()
                    .withProvider(LLMEmbeddingsConfig.Provider.GOOGLE)
                    .withGoogle(embeddingCfg));

    assertThrows(IllegalArgumentException.class, () -> new GoogleEmbeddingClient(config));
  }

  @Test
  void testCustomEndpointConstruction() {
    LLMConfiguration config =
        new LLMConfiguration()
            .withGoogle(
                new LLMGoogleConfig()
                    .withApiKey("test-key")
                    .withEndpoint(
                        "https://proxy.example.com/v1beta/models/text-embedding-004:embedContent/"))
            .withEmbeddings(
                new LLMEmbeddingsConfig()
                    .withProvider(LLMEmbeddingsConfig.Provider.GOOGLE)
                    .withGoogle(
                        new LLMGoogleEmbeddingConfig()
                            .withEmbeddingModelId("text-embedding-004")
                            .withEmbeddingDimension(768)));

    GoogleEmbeddingClient client = new GoogleEmbeddingClient(config);
    assertNotNull(client);
    assertEquals("text-embedding-004", client.getModelId());
    assertEquals(768, client.getDimension());
  }

  @Test
  void testCustomEndpointWithoutEmbedContentThrows() {
    LLMConfiguration config =
        new LLMConfiguration()
            .withGoogle(
                new LLMGoogleConfig()
                    .withApiKey("test-key")
                    .withEndpoint("https://proxy.example.com/v1beta/models/"))
            .withEmbeddings(
                new LLMEmbeddingsConfig()
                    .withProvider(LLMEmbeddingsConfig.Provider.GOOGLE)
                    .withGoogle(
                        new LLMGoogleEmbeddingConfig()
                            .withEmbeddingModelId("text-embedding-004")
                            .withEmbeddingDimension(768)));

    IllegalArgumentException ex =
        assertThrows(IllegalArgumentException.class, () -> new GoogleEmbeddingClient(config));
    assertTrue(ex.getMessage().contains(":embedContent"));
  }

  @Test
  void testNullTextThrows() {
    LLMConfiguration config = buildConfig("test-key", "text-embedding-004", 768);
    GoogleEmbeddingClient client = new GoogleEmbeddingClient(config);

    assertThrows(IllegalArgumentException.class, () -> client.embed(null));
  }

  @Test
  void testBlankTextThrows() {
    LLMConfiguration config = buildConfig("test-key", "text-embedding-004", 768);
    GoogleEmbeddingClient client = new GoogleEmbeddingClient(config);

    assertThrows(IllegalArgumentException.class, () -> client.embed("   "));
  }

  @Test
  void testNon200StatusThrowsWithExtractedErrorMessage() {
    String errorBody =
        "{\"error\":{\"code\":429,\"message\":\"Quota exceeded\",\"status\":\"RESOURCE_EXHAUSTED\"}}";
    StubHttpClient httpClient = new StubHttpClient(errorBody, 429);

    GoogleEmbeddingClient client =
        new GoogleEmbeddingClient(
            httpClient, "test-key", "text-embedding-004", 768, EMBED_ENDPOINT);

    RuntimeException ex = assertThrows(RuntimeException.class, () -> client.embed("hello"));
    assertTrue(ex.getMessage().contains("429"));
    assertTrue(ex.getMessage().contains("Quota exceeded"));
  }

  @Test
  void testNon200StatusWithNonJsonBodyEchoesBody() {
    StubHttpClient httpClient = new StubHttpClient("Service Unavailable", 503);

    GoogleEmbeddingClient client =
        new GoogleEmbeddingClient(
            httpClient, "test-key", "text-embedding-004", 768, EMBED_ENDPOINT);

    RuntimeException ex = assertThrows(RuntimeException.class, () -> client.embed("hello"));
    assertTrue(ex.getMessage().contains("503"));
    assertTrue(ex.getMessage().contains("Service Unavailable"));
  }

  @Test
  void testMissingEmbeddingObjectThrows() {
    StubHttpClient httpClient = new StubHttpClient("{\"foo\":\"bar\"}", 200);

    GoogleEmbeddingClient client =
        new GoogleEmbeddingClient(
            httpClient, "test-key", "text-embedding-004", 768, EMBED_ENDPOINT);

    RuntimeException ex = assertThrows(RuntimeException.class, () -> client.embed("hello"));
    assertTrue(ex.getMessage().contains("no embedding object"));
  }

  @Test
  void testMissingValuesArrayThrows() {
    StubHttpClient httpClient = new StubHttpClient("{\"embedding\":{}}", 200);

    GoogleEmbeddingClient client =
        new GoogleEmbeddingClient(
            httpClient, "test-key", "text-embedding-004", 768, EMBED_ENDPOINT);

    RuntimeException ex = assertThrows(RuntimeException.class, () -> client.embed("hello"));
    assertTrue(ex.getMessage().contains("no values array"));
  }

  @Test
  void testEmptyValuesArrayThrows() {
    StubHttpClient httpClient = new StubHttpClient("{\"embedding\":{\"values\":[]}}", 200);

    GoogleEmbeddingClient client =
        new GoogleEmbeddingClient(
            httpClient, "test-key", "text-embedding-004", 768, EMBED_ENDPOINT);

    RuntimeException ex = assertThrows(RuntimeException.class, () -> client.embed("hello"));
    assertTrue(ex.getMessage().contains("no values array"));
  }

  @Test
  void testRequestUrlContainsApiKeyAsQueryParam() {
    String response = "{\"embedding\":{\"values\":[0.1]}}";
    StubHttpClient httpClient = new StubHttpClient(response, 200);

    GoogleEmbeddingClient client =
        new GoogleEmbeddingClient(
            httpClient, "my-secret-key", "text-embedding-004", 1, EMBED_ENDPOINT);

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
            httpClient, "my-secret-key", "text-embedding-004", 1, EMBED_ENDPOINT);

    client.embed("hi");

    HttpRequest request = httpClient.getCapturedRequests().get(0);
    assertTrue(request.headers().firstValue("Authorization").isEmpty());
    assertTrue(request.headers().firstValue("api-key").isEmpty());
    assertEquals("application/json", request.headers().firstValue("Content-Type").orElse(null));
  }

  @Test
  void testRequestBodyShape() throws Exception {
    String response = "{\"embedding\":{\"values\":[0.1]}}";
    StubHttpClient httpClient = new StubHttpClient(response, 200);

    GoogleEmbeddingClient client =
        new GoogleEmbeddingClient(
            httpClient, "my-secret-key", "gemini-embedding-001", 768, EMBED_ENDPOINT);

    client.embed("the quick brown fox");

    HttpRequest request = httpClient.getCapturedRequests().get(0);
    String body = extractBody(request);
    com.fasterxml.jackson.databind.JsonNode parsed =
        new com.fasterxml.jackson.databind.ObjectMapper().readTree(body);
    assertEquals("models/gemini-embedding-001", parsed.get("model").asText());
    assertEquals(
        "the quick brown fox", parsed.get("content").get("parts").get(0).get("text").asText());
    assertEquals(768, parsed.get("outputDimensionality").asInt());
  }

  @Test
  void testApiKeyIsUrlEncoded() {
    String response = "{\"embedding\":{\"values\":[0.1]}}";
    StubHttpClient httpClient = new StubHttpClient(response, 200);

    GoogleEmbeddingClient client =
        new GoogleEmbeddingClient(
            httpClient, "key with spaces&chars", "text-embedding-004", 1, EMBED_ENDPOINT);

    client.embed("hi");

    HttpRequest request = httpClient.getCapturedRequests().get(0);
    String url = request.uri().toString();
    assertTrue(url.contains("key=key+with+spaces%26chars"), url);
  }

  @Test
  void testEndpointWithExistingQueryStringUsesAmpersand() {
    String response = "{\"embedding\":{\"values\":[0.1]}}";
    StubHttpClient httpClient = new StubHttpClient(response, 200);

    GoogleEmbeddingClient client =
        new GoogleEmbeddingClient(
            httpClient,
            "my-key",
            "text-embedding-004",
            1,
            "https://proxy.example.com/embed?alt=json");

    client.embed("hi");

    HttpRequest request = httpClient.getCapturedRequests().get(0);
    String url = request.uri().toString();
    assertEquals("https://proxy.example.com/embed?alt=json&key=my-key", url);
  }

  @Test
  void vertexSendsTheRightTaskAndFreshCredentialsForEachRequest() throws Exception {
    LLMConfiguration config = buildConfig(null, "gemini-embedding-001", 2);
    config.getGoogle().withVertexProject("test-project").withEndpoint(EMBED_ENDPOINT);
    StubHttpClient http =
        new StubHttpClient(
            """
        {"predictions":[{"embeddings":{"values":[0.2,0.4],"statistics":{"token_count":7.0}}}]}
        """,
            200);
    GoogleCredentials adc = mock(GoogleCredentials.class);
    GoogleCredentials scoped = mock(GoogleCredentials.class);
    when(adc.createScoped(List.of("https://www.googleapis.com/auth/cloud-platform")))
        .thenReturn(scoped);
    URI endpoint =
        URI.create(
            "https://us-central1-aiplatform.googleapis.com/v1/projects/test-project/locations/us-central1/publishers/google/models/gemini-embedding-001:predict");
    when(scoped.getRequestMetadata(endpoint))
        .thenReturn(
            Map.of(
                "Authorization",
                List.of("Bearer fixture-one"),
                "x-goog-user-project",
                List.of("billing-project")))
        .thenReturn(Map.of("Authorization", List.of("Bearer fixture-two")));
    VertexAIEmbeddingClient client = new VertexAIEmbeddingClient(config, http, () -> adc);
    List<Long> tokenCounts = new ArrayList<>();
    client.setUsageListener((model, input, usage, query) -> tokenCounts.add(usage.inputTokens()));

    assertArrayEquals(new float[] {0.2f, 0.4f}, client.embed("source text"));
    assertArrayEquals(new float[] {0.2f, 0.4f}, client.embedQuery("search text"));
    assertEquals(List.of(7L, 7L), tokenCounts);
    assertEquals("gemini-embedding-001", client.getModelId());
    assertEquals(2, client.getDimension());
    HttpRequest document = http.getCapturedRequests().getFirst();
    HttpRequest query = http.getCapturedRequests().getLast();
    assertEquals(endpoint, document.uri());
    assertEquals(endpoint, query.uri());
    assertEquals("POST", document.method());
    assertEquals("application/json", document.headers().firstValue("Content-Type").orElseThrow());
    assertEquals(
        "Bearer fixture-one", document.headers().firstValue("Authorization").orElseThrow());
    assertEquals(
        "billing-project", document.headers().firstValue("x-goog-user-project").orElseThrow());
    assertEquals("Bearer fixture-two", query.headers().firstValue("Authorization").orElseThrow());
    ObjectMapper mapper = new ObjectMapper();
    assertEquals(
        mapper.readTree(
            """
        {"instances":[{"content":"source text","task_type":"RETRIEVAL_DOCUMENT"}],"parameters":{"outputDimensionality":2}}
        """),
        mapper.readTree(extractBody(document)));
    JsonNode queryBody = mapper.readTree(extractBody(query));
    assertEquals("RETRIEVAL_QUERY", queryBody.at("/instances/0/task_type").asText());
    assertEquals("search text", queryBody.at("/instances/0/content").asText());
  }

  @Test
  void vertexGlobalUsesTheGlobalHostAndAllowsMissingTokenStatistics() throws Exception {
    LLMConfiguration config = buildConfig(null, "gemini-embedding-001", 1);
    config.getGoogle().withVertexProject("test-project").withVertexLocation("global");
    StubHttpClient http =
        new StubHttpClient("{\"predictions\":[{\"embeddings\":{\"values\":[1]}}]}", 200);
    VertexAIEmbeddingClient client =
        new VertexAIEmbeddingClient(config, http, GoogleEmbeddingClientTest::fixtureCredentials);
    EmbeddingClient.EmbeddingResult result = client.doEmbedWithUsage("catalog", false);
    assertArrayEquals(new float[] {1}, result.vector());
    assertNull(result.usage());
    assertEquals(
        "https://aiplatform.googleapis.com/v1/projects/test-project/locations/global/publishers/google/models/gemini-embedding-001:predict",
        http.getCapturedRequests().getFirst().uri().toString());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "{}",
        "{\"predictions\":[]}",
        "{\"predictions\":[{\"embeddings\":{\"values\":[1]}}]}",
        "{\"predictions\":[{\"embeddings\":{\"values\":[1,\"nan\"]}}]}"
      })
  void vertexRejectsMissingOrMalformedVectors(String body) {
    LLMConfiguration config = buildConfig(null, "gemini-embedding-001", 2);
    config.getGoogle().withVertexProject("test-project");
    VertexAIEmbeddingClient client =
        new VertexAIEmbeddingClient(
            config, new StubHttpClient(body, 200), GoogleEmbeddingClientTest::fixtureCredentials);
    assertThrows(IllegalStateException.class, () -> client.embed("source"));
  }

  @Test
  void vertexValidatesConfigurationBeforeLoadingCredentials() {
    LLMConfiguration config = buildConfig(null, "gemini-embedding-001", 2);
    StubHttpClient http = new StubHttpClient("", 200);
    Supplier<GoogleCredentials> unexpectedLookup =
        () -> {
          throw new AssertionError("ADC lookup");
        };
    assertTrue(
        assertThrows(
                IllegalArgumentException.class,
                () -> new VertexAIEmbeddingClient(config, http, unexpectedLookup))
            .getMessage()
            .contains("LLM_GOOGLE_VERTEX_PROJECT"));
    config.getGoogle().withVertexProject("test-project").withVertexLocation("bad/location");
    assertTrue(
        assertThrows(
                IllegalArgumentException.class,
                () -> new VertexAIEmbeddingClient(config, http, unexpectedLookup))
            .getMessage()
            .contains("LLM_GOOGLE_VERTEX_LOCATION"));
    config.getGoogle().withVertexLocation("us-central1");
    config.getEmbeddings().getGoogle().withEmbeddingModelId("../model");
    assertTrue(
        assertThrows(
                IllegalArgumentException.class,
                () -> new VertexAIEmbeddingClient(config, http, unexpectedLookup))
            .getMessage()
            .contains("GOOGLE_EMBEDDING_MODEL_ID"));
    config
        .getEmbeddings()
        .getGoogle()
        .withEmbeddingModelId("gemini-embedding-001")
        .withEmbeddingDimension(0);
    assertTrue(
        assertThrows(
                IllegalArgumentException.class,
                () -> new VertexAIEmbeddingClient(config, http, unexpectedLookup))
            .getMessage()
            .contains("dimension"));
  }

  @Test
  void vertexReportsProviderFailure() {
    LLMConfiguration config = buildConfig(null, "gemini-embedding-001", 2);
    config.getGoogle().withVertexProject("test-project");
    VertexAIEmbeddingClient client =
        new VertexAIEmbeddingClient(
            config,
            new StubHttpClient("unavailable", 503),
            GoogleEmbeddingClientTest::fixtureCredentials);
    assertTrue(
        assertThrows(IllegalStateException.class, () -> client.embed("source"))
            .getMessage()
            .contains("503"));
  }

  private static GoogleCredentials fixtureCredentials() {
    return GoogleCredentials.create(new AccessToken("fixture", null));
  }

  private static String extractBody(HttpRequest request) {
    java.net.http.HttpRequest.BodyPublisher publisher =
        request
            .bodyPublisher()
            .orElseThrow(() -> new IllegalStateException("Request had no body publisher"));
    java.util.concurrent.CompletableFuture<String> future =
        new java.util.concurrent.CompletableFuture<>();
    publisher.subscribe(
        new java.util.concurrent.Flow.Subscriber<>() {
          private final java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();

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
          public void onError(Throwable throwable) {
            future.completeExceptionally(throwable);
          }

          @Override
          public void onComplete() {
            future.complete(out.toString(java.nio.charset.StandardCharsets.UTF_8));
          }
        });
    try {
      return future.get(5, java.util.concurrent.TimeUnit.SECONDS);
    } catch (java.util.concurrent.ExecutionException e) {
      throw new RuntimeException("Body publisher failed", e.getCause());
    } catch (java.util.concurrent.TimeoutException e) {
      throw new RuntimeException("Body publisher timed out after 5s", e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new RuntimeException("Body publisher interrupted", e);
    }
  }

  private LLMConfiguration buildConfig(String apiKey, String modelId, int dimension) {
    return new LLMConfiguration()
        .withGoogle(new LLMGoogleConfig().withApiKey(apiKey))
        .withEmbeddings(
            new LLMEmbeddingsConfig()
                .withProvider(LLMEmbeddingsConfig.Provider.GOOGLE)
                .withGoogle(
                    new LLMGoogleEmbeddingConfig()
                        .withEmbeddingModelId(modelId)
                        .withEmbeddingDimension(dimension)));
  }
}
