package org.openmetadata.it.tests.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.dataInsight.custom.Function;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.schema.dataInsight.custom.LineChartMetric;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;

/**
 * Runs the request a line chart aggregator actually builds against a real engine.
 *
 * <p>Every categorical-axis defect this code has carried was invisible to the unit tests, because a
 * serialized request that looks right can still be rejected or silently mis-ordered by the engine:
 * an order path containing a dot is an {@code invalid_path} error, a path naming an aggregation the
 * request never built fails the whole search, and ordering by a metric value floats the categories
 * that matched nothing to the top. Only an engine can answer those.
 *
 * <p>The fixture is built so that picking categories from the wrong documents is the difference
 * between a correct chart and an empty one: {@value #NOISE_SERVICES} services hold nothing but
 * dashboards, and only {@value #DATA_SERVICES} hold tables, each with fewer documents than any noise
 * service. A terms axis built over every document and ordered by raw document count therefore fills
 * all {@value #AXIS_SIZE} slots with dashboard services and drops every service the chart is about.
 */
public abstract class CategoricalAxisSelectionBase {

  protected static final String X_AXIS_FIELD = "service.name.keyword";
  protected static final String TABLE_FILTER =
      "{\"query\":{\"term\":{\"entityType.keyword\":\"table\"}}}";
  protected static final String DASHBOARD_FILTER =
      "{\"query\":{\"term\":{\"entityType.keyword\":\"dashboard\"}}}";

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

  protected final String index = "di-categorical-axis-" + UUID.randomUUID();

  /** Base URL of the running engine, e.g. {@code http://localhost:32769}. */
  protected abstract String engineUrl();

  /** The request the aggregator under test builds for this chart, serialized as it is sent. */
  protected abstract String requestFor(LineChart lineChart);

  @AfterEach
  void dropIndex() throws Exception {
    delete(index);
  }

  protected void seed() throws Exception {
    delete(index);
    put(
        index,
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
          .append(index)
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
  void theAxisHoldsExactlyTheServicesTheChartCounts() throws Exception {
    // A dashboard-only service is not part of a tables-per-service chart, so it gets no bucket
    // rather than a zero bar.
    JsonNode buckets = search(requestFor(tablesPerService()));

    assertEquals(dataServices(), new TreeSet<>(keysOf(buckets)), "only services holding tables");
    for (String service : dataServices()) {
      assertEquals(
          TABLES_PER_DATA_SERVICE, metricValue(buckets, service), service + " counts its tables");
    }
  }

  @Test
  void aServiceTheChartCountsKeepsItsBucketWhenTheMetricFindsNothingThere() throws Exception {
    // The population stops at the metric filter, never at a term's own q=: no table is INCOMPLETE,
    // and each data service must still say so with a zero.
    LineChart incompleteTablesPerService =
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withName("incomplete")
                        .withFormula("count(k='id.keyword',q='descriptionStatus: INCOMPLETE')")
                        .withFilter(TABLE_FILTER)))
            .withxAxisField(X_AXIS_FIELD);
    JsonNode buckets = search(requestFor(incompleteTablesPerService));

    assertEquals(dataServices(), new TreeSet<>(keysOf(buckets)));
    for (String service : dataServices()) {
      assertEquals(0, metricValue(buckets, service), service + " holds no incomplete table");
    }
  }

  @Test
  void aMetricReportsZeroForAServiceOnlyAnotherMetricCounts() throws Exception {
    // With two metrics the population is every document either counts, so a noise service is in
    // the chart through its dashboards and the tables metric must say it holds none.
    LineChart tablesAndDashboardsPerService =
        new LineChart()
            .withMetrics(
                List.of(countOf("tables", TABLE_FILTER), countOf("dashboards", DASHBOARD_FILTER)))
            .withxAxisField(X_AXIS_FIELD);
    JsonNode tables = search(requestFor(tablesAndDashboardsPerService), "tables");

    for (String service : dataServices()) {
      assertEquals(TABLES_PER_DATA_SERVICE, metricValue(tables, service), service);
    }
    String noiseService =
        keysOf(tables).stream()
            .filter(key -> key.startsWith("noise-"))
            .findFirst()
            .orElseThrow(() -> new AssertionError("no dashboard service in " + tables));
    assertEquals(0, metricValue(tables, noiseService), noiseService + " holds no tables");
  }

  @Test
  void aGroupedChartListsOnlyTheGroupsItsMetricCounts() throws Exception {
    LineChart tablesPerServiceByType = tablesPerService().withGroupBy("entityType.keyword");
    JsonNode groups = search(requestFor(tablesPerServiceByType), "term_0");

    assertEquals(Set.of("table"), keysOf(groups), "a dashboard group is outside the chart");
    JsonNode services = groups.path(0).path("tables").path("buckets");
    assertEquals(dataServices(), new TreeSet<>(keysOf(services)));
  }

  @Test
  void aBuiltInChartReadForOneServiceListsOnlyThatService() throws Exception {
    // Built-in charts declare no filter: the repository merges the caller's into every metric.
    String service = dataService(0);
    String serviceFilter = "{\"query\":{\"match\":{\"" + X_AXIS_FIELD + "\":\"" + service + "\"}}}";
    LineChart completeAssetsPerService =
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula("count(k='id.keyword',q='descriptionStatus: COMPLETE')")
                        .withFilter(
                            DataInsightSystemChartRepository.combineFilters(null, serviceFilter))))
            .withxAxisField(X_AXIS_FIELD);
    JsonNode buckets = search(requestFor(completeAssetsPerService));

    assertEquals(Set.of(service), keysOf(buckets), "not the other services at zero");
    assertEquals(TABLES_PER_DATA_SERVICE, metricValue(buckets, service));
  }

  private static LineChart tablesPerService() {
    return new LineChart()
        .withMetrics(List.of(countOf("tables", TABLE_FILTER)))
        .withxAxisField(X_AXIS_FIELD);
  }

  private static LineChartMetric countOf(String name, String filter) {
    return new LineChartMetric()
        .withName(name)
        .withFunction(Function.COUNT)
        .withField("id.keyword")
        .withFilter(filter);
  }

  private static Set<String> dataServices() {
    return IntStream.range(0, DATA_SERVICES)
        .mapToObj(CategoricalAxisSelectionBase::dataService)
        .collect(Collectors.toCollection(TreeSet::new));
  }

  /** Bucket keys in the order the engine returned them. */
  private static Set<String> keysOf(JsonNode buckets) {
    Set<String> keys = new LinkedHashSet<>();
    buckets.forEach(bucket -> keys.add(bucket.path("key").asText()));
    return keys;
  }

  /**
   * The number the chart plots for a category: the leaf metric inside whichever filter wrapper the
   * metric was built with ({@code filter}, or {@code filter<index>} for a formula term), or the bare
   * leaf when the metric carries no filter.
   */
  private static long metricValue(JsonNode buckets, String key) {
    JsonNode bucket = null;
    for (JsonNode candidate : buckets) {
      if (key.equals(candidate.path("key").asText())) {
        bucket = candidate;
      }
    }
    if (bucket == null) {
      throw new AssertionError("no bucket for " + key + " in " + buckets);
    }
    JsonNode found = bucket;
    return leafValue(bucket).orElseThrow(() -> new AssertionError("no metric value in " + found));
  }

  private static Optional<Long> leafValue(JsonNode node) {
    Optional<Long> value =
        node.has("value") ? Optional.of(node.path("value").asLong()) : Optional.empty();
    for (Iterator<JsonNode> children = node.elements(); value.isEmpty() && children.hasNext(); ) {
      JsonNode child = children.next();
      value = child.isObject() ? leafValue(child) : Optional.empty();
    }
    return value;
  }

  /** Buckets of the one aggregation a single-metric chart builds. */
  private JsonNode search(String body) throws Exception {
    JsonNode aggregations = aggregationsOf(body);
    for (Iterator<String> it = aggregations.fieldNames(); it.hasNext(); ) {
      JsonNode agg = aggregations.path(it.next());
      if (agg.has("buckets")) {
        return agg.path("buckets");
      }
    }
    throw new AssertionError("no bucketed aggregation in " + aggregations);
  }

  /** Buckets of the aggregation a chart builds for the metric with this name. */
  private JsonNode search(String body, String metricName) throws Exception {
    JsonNode buckets = aggregationsOf(body).path(metricName).path("buckets");
    assertTrue(buckets.isArray(), "no aggregation named " + metricName + " in " + body);
    return buckets;
  }

  private JsonNode aggregationsOf(String body) throws Exception {
    JsonNode response = MAPPER.readTree(post(index + "/_search", body));
    assertEquals(0, response.path("_shards").path("failed").asInt(), "shard failures: " + response);
    return response.path("aggregations");
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
