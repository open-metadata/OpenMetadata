package org.openmetadata.service.search.vector.client;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import javax.net.ssl.SSLSession;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.configuration.LLMEmbeddingsConfig;
import org.openmetadata.schema.configuration.LLMOpenAIConfig;
import org.openmetadata.schema.configuration.LLMOpenAIEmbeddingConfig;

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
    LLMConfiguration config = buildConfig("test-key", "text-embedding-3-small", 1536);
    OpenAIEmbeddingClient client = new OpenAIEmbeddingClient(config);

    assertEquals(1536, client.getDimension());
    assertEquals("text-embedding-3-small", client.getModelId());
  }

  @Test
  void testClientCreationWithCustomModel() {
    LLMConfiguration config = buildConfig("test-key", "text-embedding-ada-002", 768);
    OpenAIEmbeddingClient client = new OpenAIEmbeddingClient(config);

    assertEquals(768, client.getDimension());
    assertEquals("text-embedding-ada-002", client.getModelId());
  }

  @Test
  void testAzureEndpointResolution() {
    LLMConfiguration config =
        new LLMConfiguration()
            .withOpenai(
                new LLMOpenAIConfig()
                    .withApiKey("test-key")
                    .withEndpoint("https://my-resource.openai.azure.com")
                    .withDeploymentName("my-deployment")
                    .withApiVersion("2024-02-01"))
            .withEmbeddings(
                new LLMEmbeddingsConfig()
                    .withProvider(LLMEmbeddingsConfig.Provider.OPENAI)
                    .withOpenai(
                        new LLMOpenAIEmbeddingConfig()
                            .withEmbeddingModelId("text-embedding-3-small")
                            .withEmbeddingDimension(1536)));

    OpenAIEmbeddingClient client = new OpenAIEmbeddingClient(config);
    assertNotNull(client);
  }

  @Test
  void testAzureWithoutApiVersionThrows() {
    LLMConfiguration config =
        new LLMConfiguration()
            .withOpenai(
                new LLMOpenAIConfig()
                    .withApiKey("test-key")
                    .withEndpoint("https://my-resource.openai.azure.com")
                    .withDeploymentName("my-deployment")
                    .withApiVersion(null))
            .withEmbeddings(
                new LLMEmbeddingsConfig()
                    .withProvider(LLMEmbeddingsConfig.Provider.OPENAI)
                    .withOpenai(
                        new LLMOpenAIEmbeddingConfig()
                            .withEmbeddingModelId("text-embedding-3-small")
                            .withEmbeddingDimension(1536)));

    assertThrows(IllegalArgumentException.class, () -> new OpenAIEmbeddingClient(config));
  }

  @Test
  void testMissingApiKeyThrows() {
    LLMConfiguration config =
        new LLMConfiguration()
            .withOpenai(new LLMOpenAIConfig())
            .withEmbeddings(
                new LLMEmbeddingsConfig()
                    .withProvider(LLMEmbeddingsConfig.Provider.OPENAI)
                    .withOpenai(
                        new LLMOpenAIEmbeddingConfig()
                            .withEmbeddingModelId("text-embedding-3-small")
                            .withEmbeddingDimension(1536)));

    assertThrows(IllegalArgumentException.class, () -> new OpenAIEmbeddingClient(config));
  }

  @Test
  void testMissingModelIdThrows() {
    LLMConfiguration config =
        new LLMConfiguration()
            .withOpenai(new LLMOpenAIConfig().withApiKey("test-key"))
            .withEmbeddings(
                new LLMEmbeddingsConfig()
                    .withProvider(LLMEmbeddingsConfig.Provider.OPENAI)
                    .withOpenai(
                        new LLMOpenAIEmbeddingConfig()
                            .withEmbeddingModelId(null)
                            .withEmbeddingDimension(1536)));

    assertThrows(IllegalArgumentException.class, () -> new OpenAIEmbeddingClient(config));
  }

  @Test
  void testInvalidDimensionThrows() {
    LLMConfiguration config =
        new LLMConfiguration()
            .withOpenai(new LLMOpenAIConfig().withApiKey("test-key"))
            .withEmbeddings(
                new LLMEmbeddingsConfig()
                    .withProvider(LLMEmbeddingsConfig.Provider.OPENAI)
                    .withOpenai(
                        new LLMOpenAIEmbeddingConfig()
                            .withEmbeddingModelId("text-embedding-3-small")
                            .withEmbeddingDimension(0)));

    assertThrows(IllegalArgumentException.class, () -> new OpenAIEmbeddingClient(config));
  }

  @Test
  void testNullTextThrows() {
    LLMConfiguration config = buildConfig("test-key", "text-embedding-3-small", 1536);
    OpenAIEmbeddingClient client = new OpenAIEmbeddingClient(config);

    assertThrows(IllegalArgumentException.class, () -> client.embed(null));
  }

  @Test
  void testBlankTextThrows() {
    LLMConfiguration config = buildConfig("test-key", "text-embedding-3-small", 1536);
    OpenAIEmbeddingClient client = new OpenAIEmbeddingClient(config);

    assertThrows(IllegalArgumentException.class, () -> client.embed("   "));
  }

  @Test
  void testEmbeddingWithUnreachableEndpoint() {
    LLMConfiguration config =
        new LLMConfiguration()
            .withOpenai(
                new LLMOpenAIConfig().withApiKey("test-key").withEndpoint("http://localhost:1"))
            .withEmbeddings(
                new LLMEmbeddingsConfig()
                    .withProvider(LLMEmbeddingsConfig.Provider.OPENAI)
                    .withOpenai(
                        new LLMOpenAIEmbeddingConfig()
                            .withEmbeddingModelId("text-embedding-3-small")
                            .withEmbeddingDimension(1536)));

    OpenAIEmbeddingClient client = new OpenAIEmbeddingClient(config);
    assertThrows(RuntimeException.class, () -> client.embed("test text"));
  }

  @Test
  void testCustomEndpointWithoutDeployment() {
    LLMConfiguration config =
        new LLMConfiguration()
            .withOpenai(
                new LLMOpenAIConfig()
                    .withApiKey("test-key")
                    .withEndpoint("https://custom.api.example.com"))
            .withEmbeddings(
                new LLMEmbeddingsConfig()
                    .withProvider(LLMEmbeddingsConfig.Provider.OPENAI)
                    .withOpenai(
                        new LLMOpenAIEmbeddingConfig()
                            .withEmbeddingModelId("text-embedding-3-small")
                            .withEmbeddingDimension(1536)));

    OpenAIEmbeddingClient client = new OpenAIEmbeddingClient(config);
    assertNotNull(client);
    assertEquals(1536, client.getDimension());
  }

  @SuppressWarnings("unchecked")
  @Test
  void testConcurrencyLimiterEnforced() {
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
              throws InterruptedException {
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
    LLMConfiguration config =
        new LLMConfiguration()
            .withEmbeddings(new LLMEmbeddingsConfig().withMaxConcurrentRequests(5));

    assertEquals(5, EmbeddingClient.resolveMaxConcurrent(config));
  }

  @Test
  void testResolveMaxConcurrentDefaultWhenNullEmbeddings() {
    LLMConfiguration config = new LLMConfiguration();
    assertEquals(
        EmbeddingClient.DEFAULT_MAX_CONCURRENT_REQUESTS,
        EmbeddingClient.resolveMaxConcurrent(config));
  }

  @Test
  void testResolveMaxConcurrentDefaultWhenNullConfig() {
    assertEquals(
        EmbeddingClient.DEFAULT_MAX_CONCURRENT_REQUESTS,
        EmbeddingClient.resolveMaxConcurrent(null));
  }

  @Test
  void testResolveMaxConcurrentDefaultWhenNullValue() {
    LLMConfiguration config = new LLMConfiguration().withEmbeddings(new LLMEmbeddingsConfig());

    assertEquals(
        EmbeddingClient.DEFAULT_MAX_CONCURRENT_REQUESTS,
        EmbeddingClient.resolveMaxConcurrent(config));
  }

  @Test
  void testResolveMaxConcurrentDefaultWhenZero() {
    LLMConfiguration config =
        new LLMConfiguration()
            .withEmbeddings(new LLMEmbeddingsConfig().withMaxConcurrentRequests(0));

    assertEquals(
        EmbeddingClient.DEFAULT_MAX_CONCURRENT_REQUESTS,
        EmbeddingClient.resolveMaxConcurrent(config));
  }

  @Test
  void testResolveMaxConcurrentDefaultWhenNegative() {
    LLMConfiguration config =
        new LLMConfiguration()
            .withEmbeddings(new LLMEmbeddingsConfig().withMaxConcurrentRequests(-3));

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
  void testV3ModelPinsDimensionsInRequest() throws Exception {
    String response = "{\"data\":[{\"embedding\":[0.1]}],\"model\":\"test\",\"usage\":{}}";
    StubHttpClient httpClient = new StubHttpClient(response, 200);

    OpenAIEmbeddingClient client =
        new OpenAIEmbeddingClient(
            httpClient,
            "test-key",
            "text-embedding-3-small",
            512,
            "http://localhost/v1/embeddings",
            false);

    client.embed("databases related to customers");

    String body = readRequestBody(httpClient.getCapturedRequests().get(0));
    assertTrue(
        body.contains("\"dimensions\":512"),
        "text-embedding-3 request must pin output size via a 'dimensions' parameter so the "
            + "returned vector matches the index dimension. Body was: "
            + body);
  }

  @Test
  void testAda002ModelOmitsDimensionsInRequest() throws Exception {
    String response = "{\"data\":[{\"embedding\":[0.1]}],\"model\":\"test\",\"usage\":{}}";
    StubHttpClient httpClient = new StubHttpClient(response, 200);

    OpenAIEmbeddingClient client =
        new OpenAIEmbeddingClient(
            httpClient,
            "test-key",
            "text-embedding-ada-002",
            1536,
            "http://localhost/v1/embeddings",
            false);

    client.embed("test");

    String body = readRequestBody(httpClient.getCapturedRequests().get(0));
    assertFalse(
        body.contains("dimensions"),
        "text-embedding-ada-002 does not accept a 'dimensions' parameter; it must be omitted. "
            + "Body was: "
            + body);
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

  private static String readRequestBody(HttpRequest request) throws InterruptedException {
    HttpRequest.BodyPublisher publisher = request.bodyPublisher().orElseThrow();
    StringBuilder body = new StringBuilder();
    CountDownLatch done = new CountDownLatch(1);
    publisher.subscribe(
        new Flow.Subscriber<ByteBuffer>() {
          @Override
          public void onSubscribe(Flow.Subscription subscription) {
            subscription.request(Long.MAX_VALUE);
          }

          @Override
          public void onNext(ByteBuffer item) {
            body.append(StandardCharsets.UTF_8.decode(item));
          }

          @Override
          public void onError(Throwable throwable) {
            done.countDown();
          }

          @Override
          public void onComplete() {
            done.countDown();
          }
        });
    done.await(5, TimeUnit.SECONDS);
    return body.toString();
  }

  private LLMConfiguration buildConfig(String apiKey, String modelId, int dimension) {
    return new LLMConfiguration()
        .withOpenai(new LLMOpenAIConfig().withApiKey(apiKey))
        .withEmbeddings(
            new LLMEmbeddingsConfig()
                .withProvider(LLMEmbeddingsConfig.Provider.OPENAI)
                .withOpenai(
                    new LLMOpenAIEmbeddingConfig()
                        .withEmbeddingModelId(modelId)
                        .withEmbeddingDimension(dimension)));
  }
}
