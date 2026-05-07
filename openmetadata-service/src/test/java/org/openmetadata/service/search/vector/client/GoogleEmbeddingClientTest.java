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
    // Schema defaults embeddingModelId to "text-embedding-004"; force-null to exercise the guard.
    googleCfg.setEmbeddingModelId(null);

    NaturalLanguageSearchConfiguration nlsCfg = new NaturalLanguageSearchConfiguration();
    nlsCfg.setGoogle(googleCfg);

    ElasticSearchConfiguration config = new ElasticSearchConfiguration();
    config.setNaturalLanguageSearch(nlsCfg);

    assertThrows(IllegalArgumentException.class, () -> new GoogleEmbeddingClient(config));
  }

  @Test
  void testBlankModelIdThrows() {
    Google googleCfg =
        new Google()
            .withApiKey("test-key")
            .withEmbeddingModelId("   ")
            .withEmbeddingDimension(768);

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
