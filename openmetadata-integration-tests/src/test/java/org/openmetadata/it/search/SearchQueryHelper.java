package org.openmetadata.it.search;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Hits OM's {@code /v1/search/query} endpoint — the same path the Explore page uses —
 * and returns the entity IDs in the result set. Designed for tests that need to probe
 * search availability mid-reindex (zero-downtime, no-duplicates) without going through a
 * browser for each query.
 *
 * <p>Response parsing reads {@code hits.hits[]._id} via {@link Map} navigation rather than
 * binding to a typed schema — search responses are loosely typed and we only need ID
 * counts and uniqueness for these probes.
 */
public final class SearchQueryHelper {

  private SearchQueryHelper() {}

  /**
   * Queries the given index alias and returns every {@code _id} in the response. Uses a
   * page size large enough to fetch the full result set in one call — callers should
   * ensure {@code size} exceeds the expected entity count.
   */
  public static SearchProbe probeIndex(
      final ServerHandle server, final String indexAlias, final int size) {
    return probeIndex(server, indexAlias, "*", size);
  }

  @SuppressWarnings("unchecked")
  public static SearchProbe probeIndex(
      final ServerHandle server, final String indexAlias, final String query, final int size) {
    final HttpClient http = server.sdk().getHttpClient();
    final String path =
        String.format(
            "/v1/search/query?q=%s&index=%s&from=0&size=%d&deleted=false&track_total_hits=true",
            urlEncode(query), urlEncode(indexAlias), size);
    final Map<String, Object> response = http.execute(HttpMethod.GET, path, null, Map.class);
    return parse(response);
  }

  private static String urlEncode(final String value) {
    return java.net.URLEncoder.encode(value, java.nio.charset.StandardCharsets.UTF_8);
  }

  @SuppressWarnings("unchecked")
  private static SearchProbe parse(final Map<String, Object> response) {
    final List<String> ids = new ArrayList<>();
    final Set<String> seen = new HashSet<>();
    long totalHits = 0;
    final Map<String, Object> outerHits = (Map<String, Object>) response.get("hits");
    if (outerHits == null) {
      return new SearchProbe(ids, seen, 0);
    }
    final Object total = outerHits.get("total");
    if (total instanceof Map) {
      final Object value = ((Map<String, Object>) total).get("value");
      if (value instanceof Number) {
        totalHits = ((Number) value).longValue();
      }
    } else if (total instanceof Number) {
      totalHits = ((Number) total).longValue();
    }
    final List<Map<String, Object>> innerHits = (List<Map<String, Object>>) outerHits.get("hits");
    if (innerHits != null) {
      for (Map<String, Object> hit : innerHits) {
        final Object idObj = hit.get("_id");
        if (idObj != null) {
          final String id = idObj.toString();
          ids.add(id);
          seen.add(id);
        }
      }
    }
    return new SearchProbe(ids, seen, totalHits);
  }

  /**
   * Result of a single search probe: every hit ID, the deduplicated set, and the true
   * total from the response's {@code hits.total.value} (which can exceed {@code ids.size}
   * when the response is paginated by the {@code size} param).
   */
  public record SearchProbe(List<String> ids, Set<String> uniqueIds, long totalHits) {

    public int total() {
      return ids.size();
    }

    public int unique() {
      return uniqueIds.size();
    }

    public boolean hasDuplicates() {
      return total() != unique();
    }
  }
}
