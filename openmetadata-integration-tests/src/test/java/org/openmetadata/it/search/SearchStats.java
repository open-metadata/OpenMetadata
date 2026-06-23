package org.openmetadata.it.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Reads the server's {@code /v1/search/stats} endpoint and exposes the structural views
 * integration-test assertions need: the configured cluster alias, alias -> backing-index
 * resolution, and the full live index-name list. Routing through the server (rather than a direct
 * {@code :9200} connection) means it works identically in embedded and external mode.
 */
final class SearchStats {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String STATS_PATH = "/v1/search/stats";

  private SearchStats() {}

  static JsonNode fetch(final ServerHandle server) {
    final String body =
        server.sdk().getHttpClient().executeForString(HttpMethod.GET, STATS_PATH, null);
    try {
      return MAPPER.readTree(body);
    } catch (final IOException e) {
      throw new IllegalStateException("Failed to parse " + STATS_PATH + " response: " + body, e);
    }
  }

  static String clusterAlias(final JsonNode stats) {
    return stats.path("clusterAlias").asText("");
  }

  /** Inverts the stats {@code indexes[].aliases[]} (index -> aliases) into alias -> indices. */
  static Map<String, List<String>> aliasToIndices(final JsonNode stats) {
    final Map<String, List<String>> result = new LinkedHashMap<>();
    for (final JsonNode index : stats.path("indexes")) {
      final String indexName = index.path("name").asText();
      for (final JsonNode alias : index.path("aliases")) {
        result.computeIfAbsent(alias.asText(), key -> new ArrayList<>()).add(indexName);
      }
    }
    return result;
  }

  static List<String> indexNames(final JsonNode stats) {
    final List<String> result = new ArrayList<>();
    for (final JsonNode index : stats.path("indexes")) {
      result.add(index.path("name").asText());
    }
    return result;
  }
}
