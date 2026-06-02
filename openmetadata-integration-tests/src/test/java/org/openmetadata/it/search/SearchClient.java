package org.openmetadata.it.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Thin JSON-over-HTTP client for the search engine (works against ES and OpenSearch).
 *
 * <p>Only covers the inspection surface used by assertions: {@code _count}, {@code _alias},
 * {@code _cat/indices}, {@code _search}.
 *
 * <p><b>Embedded mode</b> talks directly to {@code searchHost:searchPort} via {@link
 * java.net.http.HttpClient}, so the harness has no dependency on a specific ES/OpenSearch client
 * version. <b>External mode</b> (a remote cluster where {@code :9200} isn't reachable) routes the
 * same requests through the server's authenticated {@code /v1/test-support/search} passthrough.
 */
public final class SearchClient {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Duration TIMEOUT = Duration.ofSeconds(30);
  private static final String PASSTHROUGH = "/v1/test-support/search/passthrough?path=";
  private static final String EXISTS = "/v1/test-support/search/exists?path=";

  private final ServerHandle server;
  private final HttpClient http;
  private final URI base;

  public SearchClient(final ServerHandle server) {
    this.server = server;
    if (server.isExternal()) {
      this.http = null;
      this.base = null;
    } else {
      this.http = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();
      this.base =
          URI.create(
              server.searchScheme() + "://" + server.searchHost() + ":" + server.searchPort());
    }
  }

  public JsonNode get(final String path) {
    final JsonNode result;
    if (server.isExternal()) {
      result = parse(proxy(HttpMethod.GET, PASSTHROUGH + encode(path), null));
    } else {
      result = execute(HttpRequest.newBuilder(base.resolve(path)).GET().build());
    }
    return result;
  }

  public JsonNode post(final String path, final String jsonBody) {
    final JsonNode result;
    if (server.isExternal()) {
      result = parse(proxy(HttpMethod.POST, PASSTHROUGH + encode(path), jsonBody));
    } else {
      result =
          execute(
              HttpRequest.newBuilder(base.resolve(path))
                  .header("Content-Type", "application/json")
                  .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                  .build());
    }
    return result;
  }

  public boolean exists(final String path) {
    final boolean result;
    if (server.isExternal()) {
      result = parse(proxy(HttpMethod.GET, EXISTS + encode(path), null)).path("exists").asBoolean();
    } else {
      result = headExists(path);
    }
    return result;
  }

  private String proxy(final HttpMethod method, final String path, final String body) {
    try {
      return server.sdk().getHttpClient().executeForString(method, path, body);
    } catch (final RuntimeException e) {
      throw new SearchClientException(method + " " + path + " via test-support proxy failed", e);
    }
  }

  private static String encode(final String path) {
    return URLEncoder.encode(path, StandardCharsets.UTF_8);
  }

  private static JsonNode parse(final String body) {
    try {
      return MAPPER.readTree(body);
    } catch (final IOException e) {
      throw new SearchClientException("Failed to parse search response: " + body, e);
    }
  }

  private boolean headExists(final String path) {
    try {
      final HttpResponse<Void> response =
          http.send(
              HttpRequest.newBuilder(base.resolve(path))
                  .method("HEAD", HttpRequest.BodyPublishers.noBody())
                  .build(),
              HttpResponse.BodyHandlers.discarding());
      return response.statusCode() >= 200 && response.statusCode() < 300;
    } catch (final InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new SearchClientException("HEAD " + path + " interrupted", e);
    } catch (final IOException e) {
      throw new SearchClientException("HEAD " + path + " failed", e);
    }
  }

  private JsonNode execute(final HttpRequest request) {
    try {
      final HttpResponse<String> response =
          http.send(request, HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() >= 400) {
        throw new SearchClientException(
            "HTTP " + response.statusCode() + " from " + request.uri() + ": " + response.body());
      }
      return MAPPER.readTree(response.body());
    } catch (final InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new SearchClientException(request.method() + " " + request.uri() + " interrupted", e);
    } catch (final IOException e) {
      throw new SearchClientException(request.method() + " " + request.uri() + " failed", e);
    }
  }

  public static final class SearchClientException extends RuntimeException {
    public SearchClientException(final String message) {
      super(message);
    }

    public SearchClientException(final String message, final Throwable cause) {
      super(message, cause);
    }
  }
}
