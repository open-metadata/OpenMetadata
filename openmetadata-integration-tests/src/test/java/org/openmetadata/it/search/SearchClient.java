package org.openmetadata.it.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Thin JSON client for read-only search-engine introspection, routed entirely through the OM
 * server's admin endpoints so it behaves identically in embedded and external mode (no direct
 * {@code :9200} connection):
 *
 * <ul>
 *   <li>raw count / search / aggregations → {@code POST /v1/system/search/{count,query}}
 *   <li>alias→index resolution, index listing and existence → {@code GET /v1/search/stats}
 * </ul>
 *
 * <p>Return shapes mirror the engine's native {@code _count} / {@code _search} / {@code _alias} /
 * {@code _cat/indices} responses so existing assertions keep parsing them unchanged.
 */
public final class SearchClient {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String SYSTEM_SEARCH = "/v1/system/search";

  private final ServerHandle server;

  public SearchClient(final ServerHandle server) {
    this.server = server;
  }

  /** Doc count for an index/alias. */
  public JsonNode count(final String index) {
    return parse(get(SYSTEM_SEARCH + "/count?index=" + encode(index)));
  }

  /** Doc count for an index/alias matching the given query body. */
  public JsonNode count(final String index, final String query) {
    return parse(post(SYSTEM_SEARCH + "/count?index=" + encode(index), query));
  }

  /** Search an index/alias with the given query body (supports queries and aggregations). */
  public JsonNode search(final String index, final String query) {
    return parse(post(SYSTEM_SEARCH + "/query?index=" + encode(index), query));
  }

  /** Backing-index map for an alias (each top-level key is a backing index, like {@code _alias}). */
  public JsonNode alias(final String name) {
    final ObjectNode result = MAPPER.createObjectNode();
    final List<String> indices =
        SearchStats.aliasToIndices(SearchStats.fetch(server)).getOrDefault(name, List.of());
    for (final String index : indices) {
      result.set(index, MAPPER.createObjectNode());
    }
    return result;
  }

  /** Index names matching the pattern, as an array of {@code {"index": name}} like {@code _cat}. */
  public JsonNode indices(final String pattern) {
    final boolean prefixMatch = pattern.endsWith("*");
    final String prefix = prefixMatch ? pattern.substring(0, pattern.length() - 1) : pattern;
    final ArrayNode result = MAPPER.createArrayNode();
    for (final String name : SearchStats.indexNames(SearchStats.fetch(server))) {
      if (prefixMatch ? name.startsWith(prefix) : name.equals(pattern)) {
        result.add(MAPPER.createObjectNode().put("index", name));
      }
    }
    return result;
  }

  /** Whether an index (or alias) with the given name exists. */
  public boolean indexExists(final String name) {
    final JsonNode stats = SearchStats.fetch(server);
    return SearchStats.indexNames(stats).contains(name)
        || SearchStats.aliasToIndices(stats).containsKey(name);
  }

  /** Whether an alias with the given name exists. */
  public boolean aliasExists(final String name) {
    return SearchStats.aliasToIndices(SearchStats.fetch(server)).containsKey(name);
  }

  private String get(final String path) {
    return execute(HttpMethod.GET, path, null);
  }

  private String post(final String path, final String body) {
    return execute(HttpMethod.POST, path, body);
  }

  private String execute(final HttpMethod method, final String path, final String body) {
    try {
      return server.sdk().getHttpClient().executeForString(method, path, body);
    } catch (final RuntimeException e) {
      throw new SearchClientException(method + " " + path + " failed", e);
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

  public static final class SearchClientException extends RuntimeException {
    public SearchClientException(final String message) {
      super(message);
    }

    public SearchClientException(final String message, final Throwable cause) {
      super(message, cause);
    }
  }
}
