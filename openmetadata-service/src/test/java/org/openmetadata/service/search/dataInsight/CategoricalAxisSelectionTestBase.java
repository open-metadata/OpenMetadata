package org.openmetadata.service.search.dataInsight;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.Set;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

/**
 * Runs the request a line chart aggregator actually builds against a real engine.
 *
 * <p>Every categorical-axis defect this code has carried was invisible to the unit tests, because a
 * serialized request that looks right can still be rejected or silently mis-ordered by the engine:
 * an order path containing a dot is an {@code invalid_path} error, a path naming an aggregation the
 * request never built fails the whole search, and ordering by a metric value floats the categories
 * that matched nothing to the top. Only an engine can answer those.
 *
 * <p>The fixture is built so that ranking is the difference between a correct chart and an empty
 * one: {@value #NOISE_SERVICES} services hold nothing but dashboards, and only {@value
 * #DATA_SERVICES} hold tables, each with fewer documents than any noise service. A terms axis
 * ordered by raw document count therefore fills all {@value #AXIS_SIZE} slots with dashboard
 * services and drops every service the chart is about.
 */
public abstract class CategoricalAxisSelectionTestBase {

  protected static final String INDEX = "di-categorical-axis-test";
  protected static final String X_AXIS_FIELD = "service.name.keyword";
  protected static final String TABLE_FILTER =
      "{\"query\":{\"term\":{\"entityType.keyword\":\"table\"}}}";

  /** Services holding only dashboards. Above the axis size, so they can fill it on their own. */
  private static final int NOISE_SERVICES = 110;

  /** Services holding tables, which is what the chart counts. */
  private static final int DATA_SERVICES = 10;

  private static final int DASHBOARDS_PER_NOISE_SERVICE = 3;
  private static final int TABLES_PER_DATA_SERVICE = 2;

  /** The size both aggregators hard-code on a categorical axis. */
  protected static final int AXIS_SIZE = 100;

  protected static final ObjectMapper MAPPER = new ObjectMapper();
  private static final HttpClient HTTP =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  /** Base URL of the running engine, e.g. {@code http://localhost:32769}. */
  protected abstract String engineUrl();

  /** The chart request under test, serialized exactly as the aggregator would send it. */
  protected abstract String rankedRequest();

  @BeforeAll
  static void stubTheSearchRepository() {
    // DataInsightSystemChartRepository reads the cluster alias when it names an index, and its
    // static initializer needs a repository present before the aggregator touches it.
    SearchRepository searchRepository = mock(SearchRepository.class);
    lenient().when(searchRepository.getClusterAlias()).thenReturn(null);
    Entity.setSearchRepository(searchRepository);
  }

  protected void seed() throws Exception {
    delete(INDEX);
    put(
        INDEX,
        "{\"settings\":{\"number_of_shards\":3,\"number_of_replicas\":0},"
            + "\"mappings\":{\"properties\":{"
            + "\"id\":{\"type\":\"text\",\"fields\":{\"keyword\":{\"type\":\"keyword\"}}},"
            + "\"@timestamp\":{\"type\":\"date\",\"format\":\"epoch_millis\"},"
            + "\"descriptionStatus\":{\"type\":\"keyword\"},"
            + "\"entityType\":{\"type\":\"text\",\"fields\":{\"keyword\":{\"type\":\"keyword\"}}},"
            + "\"service\":{\"properties\":{\"name\":{\"type\":\"text\","
            + "\"fields\":{\"keyword\":{\"type\":\"keyword\"}}}}}}}}");

    StringBuilder bulk = new StringBuilder();
    for (int svc = 0; svc < NOISE_SERVICES; svc++) {
      appendDocs(bulk, noiseService(svc), "dashboard", DASHBOARDS_PER_NOISE_SERVICE);
    }
    for (int svc = 0; svc < DATA_SERVICES; svc++) {
      appendDocs(bulk, dataService(svc), "table", TABLES_PER_DATA_SERVICE);
    }
    post("_bulk?refresh=wait_for", bulk.toString());
  }

  private void appendDocs(StringBuilder bulk, String service, String entityType, int count) {
    for (int doc = 0; doc < count; doc++) {
      bulk.append("{\"index\":{\"_index\":\"")
          .append(INDEX)
          .append("\"}}\n")
          .append("{\"id\":\"")
          .append(service)
          .append('-')
          .append(entityType)
          .append('-')
          .append(doc)
          .append("\",\"entityType\":\"")
          .append(entityType)
          .append("\",\"descriptionStatus\":\"COMPLETE\",\"@timestamp\":1,\"service\":{\"name\":\"")
          .append(service)
          .append("\"}}\n");
    }
  }

  private static String noiseService(int index) {
    return String.format("noise-%03d", index);
  }

  private static String dataService(int index) {
    return String.format("data-%03d", index);
  }

  @Test
  void anAxisOrderedByRawDocumentCountLosesEveryServiceTheChartIsAbout() throws Exception {
    // The control: main's shape, and the reason ranking exists. Asserting it here is what stops
    // the fixture quietly degenerating into one where ranking makes no difference.
    JsonNode buckets =
        search(
            "{\"size\":0,\"aggregations\":{\"metric\":{\"terms\":{\"field\":\""
                + X_AXIS_FIELD
                + "\",\"size\":"
                + AXIS_SIZE
                + "}}}}");

    Set<String> selected = keysOf(buckets);
    assertEquals(AXIS_SIZE, selected.size(), "the axis is full");
    assertTrue(
        selected.stream().noneMatch(key -> key.startsWith("data-")),
        "every service holding tables is displaced by a service holding none: " + selected);
  }

  @Test
  void theRankedAxisSelectsTheServicesThatHaveDataAndStillReportsTheEmptyOnes() throws Exception {
    JsonNode buckets = search(rankedRequest());
    Set<String> selected = keysOf(buckets);

    assertEquals(AXIS_SIZE, selected.size(), "the axis is still full");
    for (int svc = 0; svc < DATA_SERVICES; svc++) {
      String service = dataService(svc);
      assertTrue(selected.contains(service), service + " must be selected: " + selected);
      assertEquals(
          TABLES_PER_DATA_SERVICE, metricValue(buckets, service), service + " counts its tables");
    }
    assertTrue(
        selected.stream().anyMatch(key -> key.startsWith("noise-")),
        "a service with no tables must still be reported, at zero: " + selected);
    assertEquals(
        0,
        metricValue(
            buckets,
            selected.stream().filter(k -> k.startsWith("noise-")).findFirst().orElseThrow()),
        "and it must report zero rather than being dropped");
  }

  @Test
  void theRankedRequestIsNotNarrowedSoTheEmptyCategoriesSurvive() throws Exception {
    // Narrowing the request with the metric filter would leave only the ten table services in the
    // index the axis sees, and min_doc_count 1 would drop the other hundred entirely.
    assertTrue(
        MAPPER.readTree(rankedRequest()).path("query").isMissingNode(),
        "the request must stay wide: " + rankedRequest());
  }

  /** Bucket keys in the order the engine returned them. */
  private static Set<String> keysOf(JsonNode buckets) {
    Set<String> keys = new LinkedHashSet<>();
    buckets.forEach(bucket -> keys.add(bucket.path("key").asText()));
    return keys;
  }

  /**
   * The number the chart plots for a category: the leaf metric inside the filter wrapper, or the
   * bare leaf when the metric carries no filter.
   */
  private static long metricValue(JsonNode buckets, String key) {
    for (JsonNode bucket : buckets) {
      if (key.equals(bucket.path("key").asText())) {
        JsonNode wrapper = bucket.has("filter") ? bucket.get("filter") : bucket;
        for (Iterator<String> it = wrapper.fieldNames(); it.hasNext(); ) {
          String field = it.next();
          if (wrapper.path(field).has("value")) {
            return wrapper.path(field).path("value").asLong();
          }
        }
      }
    }
    throw new AssertionError("no bucket for " + key + " in " + buckets);
  }

  private JsonNode search(String body) throws Exception {
    JsonNode response = MAPPER.readTree(post(INDEX + "/_search", body));
    assertEquals(0, response.path("_shards").path("failed").asInt(), "shard failures: " + response);
    JsonNode aggregations = response.path("aggregations");
    for (Iterator<String> it = aggregations.fieldNames(); it.hasNext(); ) {
      JsonNode agg = aggregations.path(it.next());
      if (agg.has("buckets")) {
        return agg.path("buckets");
      }
    }
    throw new AssertionError("no bucketed aggregation in " + response);
  }

  private String post(String path, String body) throws IOException, InterruptedException {
    return send(
        HttpRequest.newBuilder(URI.create(engineUrl() + "/" + path))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body)));
  }

  private void put(String path, String body) throws IOException, InterruptedException {
    send(
        HttpRequest.newBuilder(URI.create(engineUrl() + "/" + path))
            .header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(body)));
  }

  private void delete(String path) throws IOException, InterruptedException {
    HTTP.send(
        HttpRequest.newBuilder(URI.create(engineUrl() + "/" + path)).DELETE().build(),
        HttpResponse.BodyHandlers.ofString());
  }

  private String send(HttpRequest.Builder builder) throws IOException, InterruptedException {
    HttpResponse<String> response =
        HTTP.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    assertTrue(
        response.statusCode() < 300,
        "engine rejected the request with " + response.statusCode() + ": " + response.body());
    return response.body();
  }
}
