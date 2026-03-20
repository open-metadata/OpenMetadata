package org.openmetadata.service.search.vector.client;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import javax.net.ssl.SSLSession;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.NaturalLanguageSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.Openai;

class OpenAIEmbeddingClientTest {

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
    public java.util.Optional<java.net.Authenticator> authenticator() {
      return java.util.Optional.empty();
    }

    @Override
    public java.util.Optional<java.time.Duration> connectTimeout() {
      return java.util.Optional.empty();
    }

    @Override
    public java.util.Optional<java.net.CookieHandler> cookieHandler() {
      return java.util.Optional.empty();
    }

    @Override
    public Redirect followRedirects() {
      return Redirect.NEVER;
    }

    @Override
    public java.util.Optional<java.net.ProxySelector> proxy() {
      return java.util.Optional.empty();
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
    public java.util.Optional<java.util.concurrent.Executor> executor() {
      return java.util.Optional.empty();
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
  void testClientCreationWithConfig() {
    ElasticSearchConfiguration config = buildConfig("test-key", "text-embedding-3-small", 1536);
    OpenAIEmbeddingClient client = new OpenAIEmbeddingClient(config);

    assertEquals(1536, client.getDimension());
    assertEquals("text-embedding-3-small", client.getModelId());
  }

  @Test
  void testClientCreationWithCustomModel() {
    ElasticSearchConfiguration config = buildConfig("test-key", "text-embedding-ada-002", 768);
    OpenAIEmbeddingClient client = new OpenAIEmbeddingClient(config);

    assertEquals(768, client.getDimension());
    assertEquals("text-embedding-ada-002", client.getModelId());
  }

  @Test
  void testAzureEndpointResolution() {
    Openai openaiCfg =
        new Openai()
            .withApiKey("test-key")
            .withEmbeddingModelId("text-embedding-3-small")
            .withEmbeddingDimension(1536)
            .withEndpoint("https://my-resource.openai.azure.com")
            .withDeploymentName("my-deployment")
            .withApiVersion("2024-02-01");

    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setOpenai(openaiCfg);

    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    OpenAIEmbeddingClient client = new OpenAIEmbeddingClient(config);
    assertNotNull(client);
  }

  @Test
  void testAzureWithoutApiVersionThrows() {
    Openai openaiCfg =
        new Openai()
            .withApiKey("test-key")
            .withEmbeddingModelId("text-embedding-3-small")
            .withEmbeddingDimension(1536)
            .withEndpoint("https://my-resource.openai.azure.com")
            .withDeploymentName("my-deployment")
            .withApiVersion(null);

    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setOpenai(openaiCfg);

    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    assertThrows(IllegalArgumentException.class, () -> new OpenAIEmbeddingClient(config));
  }

  @Test
  void testMissingApiKeyThrows() {
    Openai openaiCfg =
        new Openai().withEmbeddingModelId("text-embedding-3-small").withEmbeddingDimension(1536);

    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setOpenai(openaiCfg);

    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    assertThrows(IllegalArgumentException.class, () -> new OpenAIEmbeddingClient(config));
  }

  @Test
  void testMissingModelIdThrows() {
    Openai openaiCfg =
        new Openai().withApiKey("test-key").withEmbeddingModelId(null).withEmbeddingDimension(1536);

    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setOpenai(openaiCfg);

    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    assertThrows(IllegalArgumentException.class, () -> new OpenAIEmbeddingClient(config));
  }

  @Test
  void testInvalidDimensionThrows() {
    Openai openaiCfg =
        new Openai()
            .withApiKey("test-key")
            .withEmbeddingModelId("text-embedding-3-small")
            .withEmbeddingDimension(0);

    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setOpenai(openaiCfg);

    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    assertThrows(IllegalArgumentException.class, () -> new OpenAIEmbeddingClient(config));
  }

  @Test
  void testNullTextThrows() {
    ElasticSearchConfiguration config = buildConfig("test-key", "text-embedding-3-small", 1536);
    OpenAIEmbeddingClient client = new OpenAIEmbeddingClient(config);

    assertThrows(IllegalArgumentException.class, () -> client.embed(null));
  }

  @Test
  void testBlankTextThrows() {
    ElasticSearchConfiguration config = buildConfig("test-key", "text-embedding-3-small", 1536);
    OpenAIEmbeddingClient client = new OpenAIEmbeddingClient(config);

    assertThrows(IllegalArgumentException.class, () -> client.embed("   "));
  }

  @Test
  void testEmbeddingWithUnreachableEndpoint() {
    Openai openaiCfg =
        new Openai()
            .withApiKey("test-key")
            .withEmbeddingModelId("text-embedding-3-small")
            .withEmbeddingDimension(1536)
            .withEndpoint("http://localhost:1");

    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setOpenai(openaiCfg);

    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    OpenAIEmbeddingClient client = new OpenAIEmbeddingClient(config);
    assertThrows(RuntimeException.class, () -> client.embed("test text"));
  }

  @Test
  void testCustomEndpointWithoutDeployment() {
    Openai openaiCfg =
        new Openai()
            .withApiKey("test-key")
            .withEmbeddingModelId("text-embedding-3-small")
            .withEmbeddingDimension(1536)
            .withEndpoint("https://custom.api.example.com");

    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setOpenai(openaiCfg);

    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    OpenAIEmbeddingClient client = new OpenAIEmbeddingClient(config);
    assertNotNull(client);
    assertEquals(1536, client.getDimension());
  }

  @SuppressWarnings("unchecked")
  @Test
  void testConcurrencyLimiterEnforced() throws Exception {
    AtomicInteger concurrentCount = new AtomicInteger(0);
    AtomicInteger maxObservedConcurrent = new AtomicInteger(0);
    CountDownLatch allStarted = new CountDownLatch(1);

    String fakeResponse =
        "{\"data\":[{\"embedding\":[0.1,0.2,0.3]}],\"model\":\"test\",\"usage\":{}}";

    HttpClient mockHttpClient =
        new HttpClient() {
          @Override
          public java.util.Optional<java.net.Authenticator> authenticator() {
            return java.util.Optional.empty();
          }

          @Override
          public java.util.Optional<java.time.Duration> connectTimeout() {
            return java.util.Optional.empty();
          }

          @Override
          public java.util.Optional<java.net.CookieHandler> cookieHandler() {
            return java.util.Optional.empty();
          }

          @Override
          public java.net.http.HttpClient.Redirect followRedirects() {
            return Redirect.NEVER;
          }

          @Override
          public java.util.Optional<java.net.ProxySelector> proxy() {
            return java.util.Optional.empty();
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
          public java.util.Optional<java.util.concurrent.Executor> executor() {
            return java.util.Optional.empty();
          }

          @Override
          public java.net.http.HttpClient.Version version() {
            return Version.HTTP_2;
          }

          @Override
          public <T> HttpResponse<T> send(
              HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler)
              throws IOException, InterruptedException {
            int current = concurrentCount.incrementAndGet();
            maxObservedConcurrent.accumulateAndGet(current, Math::max);
            try {
              allStarted.await();
              Thread.sleep(50);
            } finally {
              concurrentCount.decrementAndGet();
            }
            return (HttpResponse<T>) new StubHttpResponse(fakeResponse, 200, request);
          }

          @Override
          public <T> CompletableFuture<HttpResponse<T>> sendAsync(
              HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler) {
            return CompletableFuture.supplyAsync(
                () -> {
                  try {
                    return send(request, responseBodyHandler);
                  } catch (Exception e) {
                    throw new RuntimeException(e);
                  }
                });
          }

          @Override
          public <T> CompletableFuture<HttpResponse<T>> sendAsync(
              HttpRequest request,
              HttpResponse.BodyHandler<T> responseBodyHandler,
              HttpResponse.PushPromiseHandler<T> pushPromiseHandler) {
            return sendAsync(request, responseBodyHandler);
          }
        };

    int customConcurrencyLimit = 3;
    OpenAIEmbeddingClient client =
        new OpenAIEmbeddingClient(
            mockHttpClient,
            "test-key",
            "test-model",
            3,
            "http://localhost:9999/v1/embeddings",
            false,
            customConcurrencyLimit);

    int totalRequests = 30;
    ExecutorService pool = Executors.newFixedThreadPool(totalRequests);
    try {
      List<CompletableFuture<float[]>> futures = new ArrayList<>();
      for (int i = 0; i < totalRequests; i++) {
        futures.add(CompletableFuture.supplyAsync(() -> client.embed("test text"), pool));
      }

      allStarted.countDown();

      for (CompletableFuture<float[]> f : futures) {
        float[] result = f.join();
        assertNotNull(result);
        assertEquals(3, result.length);
      }

      assertTrue(
          maxObservedConcurrent.get() <= customConcurrencyLimit,
          "Max concurrent requests ("
              + maxObservedConcurrent.get()
              + ") exceeded limit ("
              + customConcurrencyLimit
              + ")");
    } finally {
      pool.shutdown();
    }
  }

  @Test
  void testResolveMaxConcurrentFromConfig() {
    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setMaxConcurrentEmbeddingRequests(5);
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    assertEquals(5, EmbeddingClient.resolveMaxConcurrent(config));
  }

  @Test
  void testResolveMaxConcurrentDefaultWhenNullNls() {
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    assertEquals(
        EmbeddingClient.DEFAULT_MAX_CONCURRENT_REQUESTS,
        EmbeddingClient.resolveMaxConcurrent(config));
  }

  @Test
  void testResolveMaxConcurrentDefaultWhenNullValue() {
    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    assertEquals(
        EmbeddingClient.DEFAULT_MAX_CONCURRENT_REQUESTS,
        EmbeddingClient.resolveMaxConcurrent(config));
  }

  @Test
  void testResolveMaxConcurrentDefaultWhenZero() {
    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setMaxConcurrentEmbeddingRequests(0);
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    assertEquals(
        EmbeddingClient.DEFAULT_MAX_CONCURRENT_REQUESTS,
        EmbeddingClient.resolveMaxConcurrent(config));
  }

  @Test
  void testResolveMaxConcurrentDefaultWhenNegative() {
    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setMaxConcurrentEmbeddingRequests(-3);
    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    assertEquals(
        EmbeddingClient.DEFAULT_MAX_CONCURRENT_REQUESTS,
        EmbeddingClient.resolveMaxConcurrent(config));
  }

  @Test
  void testSuccessfulEmbeddingResponse() {
    String response = "{\"data\":[{\"embedding\":[0.1,0.2,0.3]}],\"model\":\"test\",\"usage\":{}}";
    StubHttpClient httpClient = new StubHttpClient(response, 200);

    OpenAIEmbeddingClient client =
        new OpenAIEmbeddingClient(
            httpClient, "test-key", "test-model", 3, "http://localhost/v1/embeddings", false);

    float[] embedding = client.embed("hello world");

    assertNotNull(embedding);
    assertEquals(3, embedding.length);
    assertEquals(0.1f, embedding[0], 0.001f);
    assertEquals(0.2f, embedding[1], 0.001f);
    assertEquals(0.3f, embedding[2], 0.001f);
  }

  @Test
  void testOpenAiAuthorizationHeader() {
    String response = "{\"data\":[{\"embedding\":[0.1]}],\"model\":\"test\",\"usage\":{}}";
    StubHttpClient httpClient = new StubHttpClient(response, 200);

    OpenAIEmbeddingClient client =
        new OpenAIEmbeddingClient(
            httpClient, "sk-test-key", "test-model", 1, "http://localhost/v1/embeddings", false);

    client.embed("test");

    assertEquals(1, httpClient.getCapturedRequests().size());
    HttpRequest request = httpClient.getCapturedRequests().get(0);
    assertEquals("Bearer sk-test-key", request.headers().firstValue("Authorization").orElse(null));
    assertTrue(request.headers().firstValue("api-key").isEmpty());
  }

  @Test
  void testAzureApiKeyHeader() {
    String response = "{\"data\":[{\"embedding\":[0.1]}],\"model\":\"test\",\"usage\":{}}";
    StubHttpClient httpClient = new StubHttpClient(response, 200);

    OpenAIEmbeddingClient client =
        new OpenAIEmbeddingClient(
            httpClient, "azure-key-123", "test-model", 1, "http://azure.endpoint/embeddings", true);

    client.embed("test");

    assertEquals(1, httpClient.getCapturedRequests().size());
    HttpRequest request = httpClient.getCapturedRequests().get(0);
    assertEquals("azure-key-123", request.headers().firstValue("api-key").orElse(null));
    assertTrue(request.headers().firstValue("Authorization").isEmpty());
  }

  @Test
  void testNon200StatusThrowsWithErrorMessage() {
    String errorResponse =
        "{\"error\":{\"message\":\"Rate limit exceeded\",\"type\":\"rate_limit_error\"}}";
    StubHttpClient httpClient = new StubHttpClient(errorResponse, 429);

    OpenAIEmbeddingClient client =
        new OpenAIEmbeddingClient(
            httpClient, "test-key", "test-model", 3, "http://localhost/v1/embeddings", false);

    RuntimeException ex = assertThrows(RuntimeException.class, () -> client.embed("test"));
    assertTrue(ex.getMessage().contains("429"));
    assertTrue(ex.getMessage().contains("Rate limit exceeded"));
  }

  @Test
  void testNon200StatusWithNonJsonBody() {
    StubHttpClient httpClient = new StubHttpClient("Service Unavailable", 503);

    OpenAIEmbeddingClient client =
        new OpenAIEmbeddingClient(
            httpClient, "test-key", "test-model", 3, "http://localhost/v1/embeddings", false);

    RuntimeException ex = assertThrows(RuntimeException.class, () -> client.embed("test"));
    assertTrue(ex.getMessage().contains("503"));
    assertTrue(ex.getMessage().contains("Service Unavailable"));
  }

  @Test
  void testMissingDataArrayThrows() {
    StubHttpClient httpClient = new StubHttpClient("{\"model\":\"test\"}", 200);

    OpenAIEmbeddingClient client =
        new OpenAIEmbeddingClient(
            httpClient, "test-key", "test-model", 3, "http://localhost/v1/embeddings", false);

    RuntimeException ex = assertThrows(RuntimeException.class, () -> client.embed("test"));
    assertTrue(ex.getMessage().contains("no data array"));
  }

  @Test
  void testEmptyDataArrayThrows() {
    StubHttpClient httpClient = new StubHttpClient("{\"data\":[]}", 200);

    OpenAIEmbeddingClient client =
        new OpenAIEmbeddingClient(
            httpClient, "test-key", "test-model", 3, "http://localhost/v1/embeddings", false);

    assertThrows(RuntimeException.class, () -> client.embed("test"));
  }

  @Test
  void testMissingEmbeddingNodeThrows() {
    StubHttpClient httpClient = new StubHttpClient("{\"data\":[{\"index\":0}]}", 200);

    OpenAIEmbeddingClient client =
        new OpenAIEmbeddingClient(
            httpClient, "test-key", "test-model", 3, "http://localhost/v1/embeddings", false);

    RuntimeException ex = assertThrows(RuntimeException.class, () -> client.embed("test"));
    assertTrue(ex.getMessage().contains("no embedding array"));
  }

  private ElasticSearchConfiguration buildConfig(String apiKey, String modelId, int dimension) {
    Openai openaiCfg =
        new Openai()
            .withApiKey(apiKey)
            .withEmbeddingModelId(modelId)
            .withEmbeddingDimension(dimension);

    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setOpenai(openaiCfg);

    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);
    return config;
  }
}
