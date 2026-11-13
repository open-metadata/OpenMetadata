package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.DataInsightsApp;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.search.SearchClient;

/** Reads coverage only from successfully captured days, including empty catalogs. */
public final class TestCaseSnapshotStore {
  public static final String COUNT_FIELD = "testCaseCount";
  public static final String HAS_TESTS_FIELD = "hasTestCases";
  private static final String ALL_SERVICES = "*";
  private static final int LOOKUP_BATCH_SIZE = 128;
  private final SearchClient client;
  private final String stream;
  private final String checkpoints;

  public TestCaseSnapshotStore(SearchClient client, String clusterAlias) {
    this.client = client;
    this.stream = DataInsightsApp.getDataStreamName(clusterAlias, Entity.TEST_CASE);
    this.checkpoints =
        DataInsightsSearchInterface.getStringWithClusterAlias(
            clusterAlias, "di-test-case-snapshot-checkpoints");
  }

  /** Remove only the legacy alias; deleting its target would destroy the live test index. */
  public void detachLiveAlias() throws IOException {
    final SearchClient.RawSearchResponse response =
        client.rawSearchRequest("GET", "/_alias/" + stream, null);
    if (response.statusCode() != 404) {
      final JsonNode aliases = checked(response);
      final List<Map<String, Object>> actions = new ArrayList<>();
      aliases
          .fieldNames()
          .forEachRemaining(
              index -> actions.add(Map.of("remove", Map.of("index", index, "alias", stream))));
      if (!actions.isEmpty()) {
        request("POST", "/_aliases", Map.of("actions", actions));
      }
    }
  }

  public void beginCapture(long timestamp, String service, int retention) throws IOException {
    ensureCheckpointIndex();
    final long day = TimestampUtils.getStartOfDayTimestamp(timestamp);
    final List<String> ids =
        List.of(checkpointId(day, scope(service)), checkpointId(day, ALL_SERVICES));
    delete(
        checkpoints,
        service == null
            ? Map.of("term", Map.of("@timestamp", day))
            : Map.of("ids", Map.of("values", ids)));
    delete(stream, dayFilter(day, service));
    final Map<String, Object> expired =
        Map.of(
            "range",
            Map.of("@timestamp", Map.of("lt", TimestampUtils.subtractDays(day, retention))));
    delete(stream, expired);
    delete(checkpoints, expired);
  }

  public void clearCheckpoints() throws IOException {
    final SearchClient.RawSearchResponse exists =
        client.rawSearchRequest("HEAD", "/" + checkpoints, null);
    if (exists.statusCode() != 404) {
      checked(exists);
      delete(checkpoints, Map.of("match_all", Map.of()));
    }
  }

  public void completeCapture(long timestamp, String service) throws IOException {
    request("POST", "/" + stream + "/_refresh", null);
    final long day = TimestampUtils.getStartOfDayTimestamp(timestamp);
    request(
        "PUT",
        "/" + checkpoints + "/_doc/" + checkpointId(day, scope(service)) + "?refresh=true",
        Map.of("@timestamp", day, "scope", scope(service)));
  }

  /** Called before a batch's concurrent enrichment; the returned data is bounded by that batch. */
  public Coverage loadCoverage(List<Table> tables, long start, long end) throws IOException {
    final Map<TableDay, Long> counts = new HashMap<>();
    for (int offset = 0; offset < tables.size(); offset += LOOKUP_BATCH_SIZE) {
      loadBatch(
          tables.subList(offset, Math.min(tables.size(), offset + LOOKUP_BATCH_SIZE)),
          start,
          end,
          counts);
    }
    return new Coverage(Map.copyOf(counts));
  }

  private void loadBatch(List<Table> tables, long start, long end, Map<TableDay, Long> counts)
      throws IOException {
    final List<Long> days = days(start, end);
    final Set<String> complete = completedDays(tables, days);
    if (!complete.isEmpty()) {
      final Map<TableDay, Long> observed = countSnapshots(tables, start, end);
      for (Table table : tables) {
        for (long day : days) {
          if (complete.contains(checkpointId(day, ALL_SERVICES))
              || complete.contains(checkpointId(day, table.getService().getName()))) {
            final TableDay key = new TableDay(table.getId().toString(), day);
            counts.put(key, observed.getOrDefault(key, 0L));
          }
        }
      }
    }
  }

  private Set<String> completedDays(List<Table> tables, List<Long> days) throws IOException {
    final Set<String> scopes = new HashSet<>();
    scopes.add(ALL_SERVICES);
    tables.forEach(table -> scopes.add(table.getService().getName()));
    final List<String> ids =
        days.stream()
            .flatMap(day -> scopes.stream().map(scope -> checkpointId(day, scope)))
            .toList();
    final SearchClient.RawSearchResponse response =
        client.rawSearchRequest(
            "POST", "/" + checkpoints + "/_mget", JsonUtils.pojoToJson(Map.of("ids", ids)));
    final Set<String> complete = new HashSet<>();
    if (response.statusCode() != 404) {
      final JsonNode body = checked(response);
      for (JsonNode document : body.path("docs")) {
        if (document.has("error")) {
          throw new IOException(
              "Could not read test case snapshot checkpoint: " + document.get("error"));
        }
        if (document.path("found").asBoolean()) {
          complete.add(document.path("_id").asText());
        }
      }
    }
    return complete;
  }

  private Map<TableDay, Long> countSnapshots(List<Table> tables, long start, long end)
      throws IOException {
    final List<String> ids = tables.stream().map(table -> table.getId().toString()).toList();
    final Map<String, Object> query =
        Map.of(
            "bool",
            Map.of(
                "filter",
                List.of(
                    Map.of("terms", Map.of("originEntityId", ids)),
                    Map.of("range", Map.of("@timestamp", Map.of("gte", start, "lte", end))))));
    final Map<String, Object> aggregations =
        Map.of(
            "days",
            Map.of(
                "date_histogram",
                    Map.of("field", "@timestamp", "calendar_interval", "day", "min_doc_count", 1),
                "aggs",
                    Map.of(
                        "tables",
                        Map.of(
                            "terms", Map.of("field", "originEntityId", "size", tables.size())))));
    final JsonNode result =
        request(
            "POST",
            "/" + stream + "/_search",
            Map.of("size", 0, "query", query, "aggs", aggregations));
    if (result.path("timed_out").asBoolean() || result.path("_shards").path("failed").asInt() > 0) {
      throw new IOException("Incomplete test case snapshot aggregation");
    }
    final Map<TableDay, Long> counts = new HashMap<>();
    for (JsonNode day : result.path("aggregations").path("days").path("buckets")) {
      for (JsonNode table : day.path("tables").path("buckets")) {
        counts.put(
            new TableDay(table.path("key").asText(), day.path("key").asLong()),
            table.path("doc_count").asLong());
      }
    }
    return counts;
  }

  private void ensureCheckpointIndex() throws IOException {
    final SearchClient.RawSearchResponse exists =
        client.rawSearchRequest("HEAD", "/" + checkpoints, null);
    if (exists.statusCode() == 404) {
      request(
          "PUT",
          "/" + checkpoints,
          Map.of(
              "mappings",
              Map.of(
                  "properties",
                  Map.of(
                      "@timestamp", Map.of("type", "date"), "scope", Map.of("type", "keyword")))));
    } else {
      checked(exists);
    }
  }

  private void delete(String index, Map<String, Object> query) throws IOException {
    final JsonNode result =
        request("POST", "/" + index + "/_delete_by_query?refresh=true", Map.of("query", query));
    if (result.path("failures").size() > 0 || result.path("timed_out").asBoolean()) {
      throw new IOException("Could not replace test case snapshots in " + index + ": " + result);
    }
  }

  private static Map<String, Object> dayFilter(long day, String service) {
    final List<Map<String, Object>> filters = new ArrayList<>();
    filters.add(Map.of("term", Map.of("@timestamp", day)));
    if (service != null) {
      filters.add(Map.of("term", Map.of("service.name.keyword", normalize(service))));
    }
    return Map.of("bool", Map.of("filter", filters));
  }

  private JsonNode request(String method, String path, Map<String, Object> body)
      throws IOException {
    return checked(
        client.rawSearchRequest(method, path, body == null ? null : JsonUtils.pojoToJson(body)));
  }

  private static JsonNode checked(SearchClient.RawSearchResponse response) throws IOException {
    if (response.statusCode() >= 300) {
      throw new IOException(
          "Test case snapshot request failed: " + response.statusCode() + " " + response.body());
    }
    final JsonNode body =
        response.body().isBlank() ? JsonUtils.readTree("{}") : JsonUtils.readTree(response.body());
    if (body.path("timed_out").asBoolean() || body.path("_shards").path("failed").asInt() > 0) {
      throw new IOException("Incomplete test case snapshot search response: " + body);
    }
    return body;
  }

  private static String checkpointId(long day, String service) {
    return UUID.nameUUIDFromBytes((day + ":" + service).getBytes(StandardCharsets.UTF_8))
        .toString();
  }

  private static String scope(String service) {
    return service == null ? ALL_SERVICES : service;
  }

  private static String normalize(String fqn) {
    return fqn.toLowerCase(Locale.ROOT);
  }

  private static List<Long> days(long start, long end) {
    final List<Long> days = new ArrayList<>();
    for (long day = TimestampUtils.getStartOfDayTimestamp(start);
        day <= end;
        day = TimestampUtils.addDays(day, 1)) {
      days.add(day);
    }
    return days;
  }

  public record TableDay(String tableId, long timestamp) {}

  public record Coverage(Map<TableDay, Long> counts) {
    public void enrich(Map<String, Object> snapshot) {
      final TableDay key =
          new TableDay(
              snapshot.get("id").toString(), ((Number) snapshot.get("@timestamp")).longValue());
      final Long count = counts.get(key);
      if (count != null) {
        snapshot.put(COUNT_FIELD, count);
        snapshot.put(HAS_TESTS_FIELD, count > 0 ? 1 : 0);
      }
    }
  }
}
