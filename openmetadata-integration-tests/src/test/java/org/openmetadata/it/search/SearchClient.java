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
 * Thin JSON client for the search engine's read-only introspection surface (works against ES and
 * OpenSearch). Exposes only the typed operations assertions need: {@code count}, {@code search},
 * {@code alias}, {@code mapping}, {@code indices}, {@code exists}.
 *
 * <p><b>Embedded mode</b> talks directly to {@code searchHost:searchPort} via {@link
 * java.net.http.HttpClient}, so the harness has no dependency on a specific ES/OpenSearch client
 * version. <b>External mode</b> (a remote cluster where {@code :9200} isn't reachable) routes the
 * same operations through the server's authenticated, typed {@code /v1/search/operations}
 * endpoints — there is no raw-path passthrough, so the server only ever runs these read-only ops.
 */
public final class SearchClient {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Duration TIMEOUT = Duration.ofSeconds(30);
  private static final String SEARCH_OPS = "/v1/search/operations";

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

  /** Doc count for an index/alias. */
  public JsonNode count(final String index) {
    final JsonNode result;
    if (server.isExternal()) {
      result = parse(proxyGet(SEARCH_OPS + "/count?index=" + encode(index)));
    } else {
      result = engineGet("/" + index + "/_count");
    }
    return result;
  }

  /** Doc count for an index/alias matching the given query body. */
  public JsonNode count(final String index, final String query) {
    final JsonNode result;
    if (server.isExternal()) {
      result = parse(proxyPost(SEARCH_OPS + "/count?index=" + encode(index), query));
    } else {
      result = enginePost("/" + index + "/_count", query);
    }
    return result;
  }

  /** Search an index/alias with the given query body. */
  public JsonNode search(final String index, final String query) {
    final JsonNode result;
    if (server.isExternal()) {
      result = parse(proxyPost(SEARCH_OPS + "/search?index=" + encode(index), query));
    } else {
      result = enginePost("/" + index + "/_search", query);
    }
    return result;
  }

  /** Backing-index map for an alias (each top-level key is a backing index). */
  public JsonNode alias(final String name) {
    final JsonNode result;
    if (server.isExternal()) {
      result = parse(proxyGet(SEARCH_OPS + "/alias?name=" + encode(name)));
    } else {
      result = engineGet("/_alias/" + name);
    }
    return result;
  }

  /** Mapping JSON for an index/alias. */
  public JsonNode mapping(final String index) {
    final JsonNode result;
    if (server.isExternal()) {
      result = parse(proxyGet(SEARCH_OPS + "/mapping?index=" + encode(index)));
    } else {
      result = engineGet("/" + index + "/_mapping");
    }
    return result;
  }

  /** Index names matching the pattern (a JSON array from {@code _cat/indices}). */
  public JsonNode indices(final String pattern) {
    final JsonNode result;
    if (server.isExternal()) {
      result = parse(proxyGet(SEARCH_OPS + "/indices?pattern=" + encode(pattern)));
    } else {
      result = engineGet("/_cat/indices/" + pattern + "?format=json&h=index");
    }
    return result;
  }

  /** Whether an index (or alias) with the given name exists. */
  public boolean indexExists(final String name) {
    return server.isExternal() ? existsViaServer("index", name) : headExists("/" + name);
  }

  /** Whether an alias with the given name exists. */
  public boolean aliasExists(final String name) {
    return server.isExternal() ? existsViaServer("alias", name) : headExists("/_alias/" + name);
  }

  private boolean existsViaServer(final String kind, final String name) {
    return parse(proxyGet(SEARCH_OPS + "/exists?" + kind + "=" + encode(name)))
        .path("exists")
        .asBoolean();
  }

  private String proxyGet(final String path) {
    return proxy(HttpMethod.GET, path, null);
  }

  private String proxyPost(final String path, final String body) {
    return proxy(HttpMethod.POST, path, body);
  }

  private String proxy(final HttpMethod method, final String path, final String body) {
    try {
      return server.sdk().getHttpClient().executeForString(method, path, body);
    } catch (final RuntimeException e) {
      throw new SearchClientException(
          method + " " + path + " via search-operations endpoint failed", e);
    }
  }

  private static String encode(final String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }

  private static JsonNode parse(final String body) {
    try {
      return MAPPER.readTree(body);
    } catch (final IOException e) {
      throw new SearchClientException("Failed to parse search response: " + body, e);
    }
  }

  private JsonNode engineGet(final String path) {
    return execute(HttpRequest.newBuilder(base.resolve(path)).GET().build());
  }

  private JsonNode enginePost(final String path, final String jsonBody) {
    return execute(
        HttpRequest.newBuilder(base.resolve(path))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
            .build());
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
