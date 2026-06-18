package org.openmetadata.it.tests.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * On-demand maintenance task that hard-deletes orphaned test entities left on a shared/external
 * cluster — primarily the bulk cohorts created by {@link StaticDatasetSeedIT}, which deliberately
 * does not clean up after itself, and any data left by integration tests that were cancelled before
 * their {@code TestNamespaceExtension} cleanup ran.
 *
 * <p>{@code TestNamespace.prefix()} stamps a {@code __<32-hex run id>__} signature into every
 * namespace-created root, e.g. {@code postgresService_ab12cd34__<32hex>__Scale100kEntities__...}. By
 * default this matches that signature ({@link #DEFAULT_NAME_REGEX}), so it deletes the bulk data of
 * <b>any</b> cancelled run without a brittle per-class list; deleting each root recursively takes its
 * databases/schemas/tables (or terms/tags/children) with it. Override the matcher with
 * {@code -Djpw.purge.regex=} and/or add substring class markers via {@code -Djpw.purge.markers=}.
 *
 * <p>{@code @Tag("purge")} keeps it out of every normal suite; run it explicitly:
 *
 * <pre>{@code
 * mvn verify -P purge-it -Dskip.embedded.bootstrap=true                                  # default: all test-namespace roots
 * mvn verify -P purge-it -Dskip.embedded.bootstrap=true -Djpw.purge.markers=StaticDatasetSeed  # targeted
 * }</pre>
 *
 * with {@code OM_URL} / {@code OM_ADMIN_TOKEN} for the external cluster.
 */
@Tag("purge")
class ClusterPurgeIT {

  private static final Logger LOG = LoggerFactory.getLogger(ClusterPurgeIT.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final int PAGE_SIZE = 1000;

  // Default matcher: the test-namespace signature TestNamespace.prefix() stamps into every
  // EntityLoader/factory-created root — base__<32-hex run id>__<ClassId>... So this deletes ALL
  // bulk test data left by any cancelled run, without a brittle per-class marker list. Override
  // with -Djpw.purge.regex=, and/or add substring markers via -Djpw.purge.markers.
  private static final String DEFAULT_NAME_REGEX = "__[0-9a-f]{32}__";

  /** Root entity type -> REST collection path. Deleting a root cascades its children. */
  private static final Map<String, String> ROOT_COLLECTIONS =
      Map.ofEntries(
          Map.entry("databaseService", "services/databaseServices"),
          Map.entry("messagingService", "services/messagingServices"),
          Map.entry("dashboardService", "services/dashboardServices"),
          Map.entry("pipelineService", "services/pipelineServices"),
          Map.entry("mlmodelService", "services/mlmodelServices"),
          Map.entry("storageService", "services/storageServices"),
          Map.entry("searchService", "services/searchServices"),
          Map.entry("apiService", "services/apiServices"),
          Map.entry("driveService", "services/driveServices"),
          Map.entry("glossary", "glossaries"),
          Map.entry("classification", "classifications"),
          Map.entry("domain", "domains"),
          Map.entry("team", "teams"));

  private static HttpClient http;
  private static List<String> markers;
  private static Pattern namePattern;

  @BeforeAll
  static void setup() {
    final ServerHandle server = OssTestServer.defaultHandle();
    http = server.sdk().getHttpClient();
    markers = resolveMarkers();
    namePattern = resolvePattern();
    LOG.info(
        "ClusterPurgeIT targeting regex={} markers={} on {}",
        namePattern,
        markers,
        server.baseUrl());
  }

  @Test
  void purgeOrphanedTestEntities() {
    Assumptions.assumeFalse(
        namePattern == null && markers.isEmpty(),
        "no purge matcher configured (jpw.purge.regex / jpw.purge.markers) — nothing to do");
    final Map<String, Integer> deletedByType = new LinkedHashMap<>();
    int total = 0;
    for (final Map.Entry<String, String> collection : ROOT_COLLECTIONS.entrySet()) {
      final int deleted = purgeCollection(collection.getValue());
      if (deleted > 0) {
        deletedByType.put(collection.getKey(), deleted);
      }
      total += deleted;
    }
    LOG.info("ClusterPurgeIT hard-deleted {} orphaned root entities: {}", total, deletedByType);
  }

  private static int purgeCollection(final String collection) {
    final List<MatchedRoot> matches = listMatchingRoots(collection);
    int deleted = 0;
    for (final MatchedRoot root : matches) {
      if (hardDelete(collection, root.id())) {
        deleted++;
      }
    }
    if (!matches.isEmpty()) {
      LOG.info("Purged {}/{} matching roots from {}", deleted, matches.size(), collection);
    }
    return deleted;
  }

  private static List<MatchedRoot> listMatchingRoots(final String collection) {
    final List<MatchedRoot> matched = new ArrayList<>();
    String after = null;
    boolean more = true;
    while (more) {
      final JsonNode page = MAPPER.valueToTree(fetchPage(collection, after));
      for (final JsonNode item : page.path("data")) {
        final String name = item.path("name").asText("");
        if (matches(name)) {
          matched.add(new MatchedRoot(item.path("id").asText(), name));
        }
      }
      after = page.path("paging").path("after").asText(null);
      more = after != null && !after.isBlank();
    }
    return matched;
  }

  private static Map<?, ?> fetchPage(final String collection, final String after) {
    final StringBuilder url =
        new StringBuilder("/v1/").append(collection).append("?limit=").append(PAGE_SIZE);
    if (after != null) {
      url.append("&after=").append(URLEncoder.encode(after, StandardCharsets.UTF_8));
    }
    return http.execute(HttpMethod.GET, url.toString(), null, Map.class);
  }

  private static boolean hardDelete(final String collection, final String id) {
    final String path = "/v1/" + collection + "/" + id + "?hardDelete=true&recursive=true";
    boolean ok = false;
    try {
      http.execute(HttpMethod.DELETE, path, null, Object.class);
      ok = true;
    } catch (final RuntimeException e) {
      LOG.warn("Purge delete failed for {}/{}: {}", collection, id, e.getMessage());
    }
    return ok;
  }

  private static boolean matches(final String name) {
    boolean matched = namePattern != null && namePattern.matcher(name).find();
    if (!matched) {
      final String lower = name.toLowerCase(Locale.ROOT);
      for (final String marker : markers) {
        if (lower.contains(marker)) {
          matched = true;
          break;
        }
      }
    }
    return matched;
  }

  private static List<String> resolveMarkers() {
    final String raw = System.getProperty("jpw.purge.markers", "");
    final List<String> result = new ArrayList<>();
    for (final String token : raw.split(",")) {
      final String trimmed = token.trim().toLowerCase(Locale.ROOT);
      if (!trimmed.isEmpty()) {
        result.add(trimmed);
      }
    }
    return result;
  }

  private static Pattern resolvePattern() {
    final String raw = System.getProperty("jpw.purge.regex", DEFAULT_NAME_REGEX);
    return (raw == null || raw.isBlank()) ? null : Pattern.compile(raw);
  }

  private record MatchedRoot(String id, String name) {}
}
