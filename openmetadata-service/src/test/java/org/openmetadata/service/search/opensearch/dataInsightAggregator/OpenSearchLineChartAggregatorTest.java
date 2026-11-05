package org.openmetadata.service.search.opensearch.dataInsightAggregator;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.json.stream.JsonGenerator;
import java.io.StringReader;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.dataInsight.custom.Function;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.schema.dataInsight.custom.LineChartMetric;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;
import os.org.opensearch.client.opensearch.core.SearchRequest;
import os.org.opensearch.client.opensearch.core.SearchResponse;

class OpenSearchLineChartAggregatorTest {

  private static final String TABLE_FILTER =
      "{\"query\":{\"term\":{\"entityType.keyword\":\"table\"}}}";
  private static final String DASHBOARD_FILTER =
      "{\"query\":{\"term\":{\"entityType.keyword\":\"dashboard\"}}}";
  private static final String TABLE_QUERY_TEXT = "{\"term\":{\"entityType.keyword\":\"table\"}}";
  private static final com.fasterxml.jackson.databind.JsonNode TABLE_QUERY = tableQuery();

  private static com.fasterxml.jackson.databind.JsonNode tableQuery() {
    try {
      return new com.fasterxml.jackson.databind.ObjectMapper().readTree(TABLE_QUERY_TEXT);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final JacksonJsonpMapper JACKSON_JSONP_MAPPER =
      new JacksonJsonpMapper(OBJECT_MAPPER);

  private static final String SERVICE_NAME = "myservice";
  private static final String X_AXIS_FIELD = "service.name.keyword";
  private static final String OWNER_METRIC = "withOwner";
  private static final String DESCRIPTION_METRIC = "withDescription";
  private static final long END_TIME = 24L * 60 * 60 * 1000;

  private final OpenSearchLineChartAggregator aggregator = new OpenSearchLineChartAggregator();

  @BeforeEach
  void setUp() {
    SearchRepository searchRepository = mock(SearchRepository.class);
    lenient().when(searchRepository.getClusterAlias()).thenReturn(null);
    Entity.setSearchRepository(searchRepository);
  }

  @Test
  void includeFilterSurvivesSubAggregationRebuild() throws Exception {
    DataInsightCustomChart chart = formulaChart(SERVICE_NAME, null);

    JsonNode serviceAgg = serviceTermsAggregation(prepare(chart));

    assertEquals(SERVICE_NAME, serviceAgg.path("terms").path("include").asText());
    assertFalse(
        serviceAgg.path("aggregations").isMissingNode(),
        "Sub-aggregations must be attached so the test exercises the rebuild branch");
  }

  @Test
  void excludeFilterSurvivesSubAggregationRebuild() throws Exception {
    DataInsightCustomChart chart = formulaChart(null, SERVICE_NAME);

    JsonNode serviceAgg = serviceTermsAggregation(prepare(chart));

    assertEquals(SERVICE_NAME, serviceAgg.path("terms").path("exclude").asText());
  }

  @Test
  void noServiceFilterLeavesTermsAggregationUnfiltered() throws Exception {
    JsonNode serviceAgg = serviceTermsAggregation(prepare(formulaChart(null, null)));

    assertTrue(serviceAgg.path("terms").path("include").isMissingNode());
    assertTrue(serviceAgg.path("terms").path("exclude").isMissingNode());
  }

  @Test
  void includeFilterSurvivesForGroupedChart() throws Exception {
    DataInsightCustomChart chart = groupedFormulaChart(SERVICE_NAME);

    JsonNode serviceAgg = serviceTermsAggregation(prepare(chart));

    assertEquals(SERVICE_NAME, serviceAgg.path("terms").path("include").asText());
  }

  @Test
  void nullFunctionAndFormulaMetricThrows() {
    DataInsightCustomChart chart = incompleteMetricChart();

    assertThrows(IllegalArgumentException.class, () -> prepare(chart));
  }

  @Test
  void groupedChartKeepsAnAggregationForEveryNamedMetric() throws Exception {
    JsonNode aggregations =
        OBJECT_MAPPER
            .readTree(serializeToJson(prepare(groupedMultiMetricChart())))
            .path("aggregations");

    assertEquals(2, aggregations.size(), "Each metric needs its own group-by aggregation");

    Set<String> metricNames = new HashSet<>();
    aggregations.forEach(
        groupBy -> groupBy.path("aggregations").fieldNames().forEachRemaining(metricNames::add));
    assertEquals(Set.of(OWNER_METRIC, DESCRIPTION_METRIC), metricNames);
  }

  @Test
  void aFilteredChartNeverNarrowsItsRequest() throws Exception {
    // Narrowing the request with the metric filter aligns selection with counting, but a terms
    // aggregation carries min_doc_count 1: every category the filter emptied loses its bucket, and
    // the chart can no longer say that a service holds none. Ranking the axis achieves the same
    // alignment while leaving those categories in the response.
    assertTrue(
        OBJECT_MAPPER
            .readTree(serializeToJson(prepare(filteredChart(TABLE_FILTER, TABLE_FILTER))))
            .path("query")
            .isMissingNode(),
        "the live request must stay wide");

    JsonNode historical =
        OBJECT_MAPPER
            .readTree(serializeToJson(prepareHistorical(filteredChart(TABLE_FILTER, TABLE_FILTER))))
            .path("query");
    assertTrue(
        historical.has("range"), "the historical request carries the bare range: " + historical);
  }

  @Test
  void anUnreadableFilterLeavesBothTheRequestAndTheSubAggregationUnfiltered() throws Exception {
    // Asserting both halves together is what stops a later change narrowing the request while the
    // sub-aggregations silently fall back, which would count one population and select from
    // another.
    for (String bad : new String[] {"{", "{\"bool\":{}}", "{}"}) {
      JsonNode root = OBJECT_MAPPER.readTree(serializeToJson(prepare(filteredChart(bad, bad))));
      assertTrue(root.path("query").isMissingNode(), "the request stays wide for filter " + bad);
      JsonNode terms = findAggregationWithTermsField(root.path("aggregations"), X_AXIS_FIELD);
      assertTrue(
          terms.path("terms").path("order").isMissingNode(),
          "nothing was wrapped, so there is nothing to rank by for filter " + bad);
      // Naming the surviving aggregation rather than looking for an absent "filter" key: the
      // formula path keys its wrapper "filter<index>", so a probe for the bare name can never fail.
      Set<String> subAggregations = new HashSet<>();
      terms.path("aggregations").fieldNames().forEachRemaining(subAggregations::add);
      assertEquals(
          Set.of("id.keyword0"),
          subAggregations,
          "the metric must fall back to one unfiltered leaf aggregation for " + bad);
    }
  }

  @Test
  void metricsThatDisagreeEachRankByTheirOwnWrapper() throws Exception {
    // Every metric owns its axis, so two metrics filtering to different populations need no shared
    // filter between them -- each ranks by the wrapper built for it.
    JsonNode aggregations =
        OBJECT_MAPPER
            .readTree(serializeToJson(prepare(filteredChart(TABLE_FILTER, DASHBOARD_FILTER))))
            .path("aggregations");

    for (String metricName : new String[] {OWNER_METRIC, DESCRIPTION_METRIC}) {
      JsonNode terms = aggregations.path(metricName);
      assertEquals("filter0", orderKey(terms), metricName);
      assertTrue(terms.path("aggregations").has("filter0"), metricName);
    }
  }

  @Test
  void aGroupedChartStillRanksItsAxis() throws Exception {
    JsonNode terms = serviceTermsAggregation(prepare(groupedFilteredChart()));

    assertEquals("filter0", orderKey(terms), "a groupBy nests the axis, it does not disable it");
    assertTrue(terms.path("aggregations").has("filter0"));
  }

  @Test
  void aTimestampAxisIsNeitherRankedNorNarrowed() throws Exception {
    // A date histogram has no top-N to align. Narrowing the query would shorten the window it
    // plots, moving the first/last delta the dashboard renders; a groupBy must not change that.
    for (String groupBy : new String[] {null, "entityType"}) {
      JsonNode root =
          OBJECT_MAPPER.readTree(serializeToJson(prepareHistorical(timestampAxisChart(groupBy))));

      assertTrue(
          root.path("query").has("range"),
          "the request must carry the bare @timestamp range, got: " + root.path("query"));
      assertTrue(
          root.toString().indexOf("\"order\"") < 0, "a date histogram carries no order: " + root);
    }
  }

  @Test
  void anEmptyBucketDoesNotKillTheResponse() throws Exception {
    // avg over a category the metric filter matched nothing in comes back as {"value": null},
    // not NaN. This engine boxes the value, so unboxing it threw a 500.
    String canned =
        "{\"took\":1,\"timed_out\":false,"
            + "\"_shards\":{\"total\":1,\"successful\":1,\"skipped\":0,\"failed\":0},"
            + "\"hits\":{\"total\":{\"value\":0,\"relation\":\"eq\"},\"hits\":[]},"
            + "\"aggregations\":{\"sterms#"
            + OWNER_METRIC
            + "\":{\"doc_count_error_upper_bound\":0,\"sum_other_doc_count\":0,\"buckets\":["
            + "{\"key\":\"svc-with-none\",\"doc_count\":10,"
            + "\"filter#filter\":{\"doc_count\":0,"
            + "\"avg#columns.dataLength0\":{\"value\":null}}}]}}}";

    SearchResponse<JsonData> response =
        SearchResponse.createSearchResponseDeserializer(JsonData._DESERIALIZER)
            .deserialize(
                JACKSON_JSONP_MAPPER.jsonProvider().createParser(new StringReader(canned)),
                JACKSON_JSONP_MAPPER);

    DataInsightCustomChartResultList results =
        assertDoesNotThrow(
            () ->
                aggregator.processSearchResponse(
                    avgChart(), response, new ArrayList<>(), new HashMap<>()));
    assertTrue(results.getResults().isEmpty(), "a null metric value must be skipped, not emitted");
  }

  private static DataInsightCustomChart avgChart() {
    LineChart lineChart =
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withName(OWNER_METRIC)
                        .withFunction(Function.AVG)
                        .withField("columns.dataLength")
                        .withFilter(TABLE_FILTER)))
            .withxAxisField(X_AXIS_FIELD);
    return new DataInsightCustomChart().withName("avg_chart").withChartDetails(lineChart);
  }

  @Test
  void aFunctionMetricRanksTheAxisAndKeepsTheEmptyCategories() throws Exception {
    JsonNode root = OBJECT_MAPPER.readTree(serializeToJson(prepare(functionChart(Function.COUNT))));

    assertTrue(
        root.path("query").isMissingNode(),
        "a ranked axis must not also narrow the request, or the empty categories vanish: "
            + root.path("query"));

    JsonNode terms = findAggregationWithTermsField(root.path("aggregations"), X_AXIS_FIELD);
    String path = terms.path("terms").path("order").path(0).fieldNames().next();
    assertEquals("filter", path, "the axis must rank by the filter wrapper's document count");
    assertFalse(
        terms.path("aggregations").path(path).isMissingNode(),
        "the order path must name an aggregation the request actually builds: " + terms);
  }

  @Test
  void everyFunctionRanksTheSameWay() throws Exception {
    // Ranking is on the wrapper's document count, never the metric value, so no function needs
    // special handling -- an empty min or a negative sum cannot float to the top.
    for (Function fn :
        List.of(Function.COUNT, Function.SUM, Function.AVG, Function.MIN, Function.MAX)) {
      JsonNode terms =
          findAggregationWithTermsField(
              OBJECT_MAPPER
                  .readTree(serializeToJson(prepare(functionChart(fn))))
                  .path("aggregations"),
              X_AXIS_FIELD);
      assertEquals(
          "desc", terms.path("terms").path("order").path(0).path("filter").asText(), fn.value());
    }
  }

  @Test
  void aFormulaMetricRanksByItsWrapperToo() throws Exception {
    // A formula compiles to one wrapper per term, each named with an index and each addressable.
    JsonNode terms = serviceTermsAggregation(prepare(filteredChart(TABLE_FILTER, TABLE_FILTER)));

    assertEquals("filter0", orderKey(terms));
    assertEquals(
        TABLE_QUERY,
        unwrap(terms.path("aggregations").path("filter0").path("filter")),
        "the wrapper the axis ranks by must be the one carrying the metric filter");
  }

  @Test
  void theUnnarrowedTermLeadsTheOrder() throws Exception {
    // The first term carries its own q=, which selects the numerator's population; the second
    // carries the metric filter alone, which is the population the formula is evaluated over.
    // Ranking must lead with the latter or the axis picks the categories that satisfy one operand.
    JsonNode terms = serviceTermsAggregation(prepare(formulaChartWithFilter(TABLE_FILTER)));

    assertEquals(
        List.of("filter1", "filter0"), orderKeys(terms), "unnarrowed wrapper first: " + terms);
    assertTrue(terms.path("aggregations").has("filter1"));
    assertTrue(terms.path("aggregations").has("filter0"));
  }

  @Test
  void aPerTermQueryAloneDoesNotRankTheAxis() throws Exception {
    // Without a metric filter the only wrappers are the terms' own q= clauses. Ranking by one of
    // them would select the categories satisfying a single operand -- for a ratio, the numerator --
    // rather than the population the chart is about.
    JsonNode root = OBJECT_MAPPER.readTree(serializeToJson(prepare(formulaChart(null, null))));
    JsonNode terms = findAggregationWithTermsField(root.path("aggregations"), X_AXIS_FIELD);

    assertTrue(root.path("query").isMissingNode());
    assertTrue(terms.path("aggregations").has("filter0"), "the q= wrapper is still built");
    assertTrue(terms.path("terms").path("order").isMissingNode(), "but it must not rank the axis");
  }

  @Test
  void aFilterOnlyTheTypedClientWouldRejectStillRanksHere() throws Exception {
    // This engine base64-wraps the filter's bytes instead of parsing them, so a filter the
    // ElasticSearch client drops is still sent, still wrapped, and still rankable. The divergence
    // is intended: each engine ranks by exactly what it built, which is why the order keys come
    // from the aggregations rather than from the chart definition.
    JsonNode terms = serviceTermsAggregation(prepare(functionChart(Function.COUNT, UNMAPPABLE)));

    assertEquals("filter", orderKey(terms));
    assertTrue(terms.path("aggregations").has("filter"));
  }

  /** Order paths of a terms aggregation, in the order the request declares them. */
  private static List<String> orderKeys(JsonNode terms) {
    List<String> keys = new ArrayList<>();
    terms
        .path("terms")
        .path("order")
        .forEach(entry -> entry.fieldNames().forEachRemaining(keys::add));
    return keys;
  }

  private static String orderKey(JsonNode terms) {
    List<String> keys = orderKeys(terms);
    assertEquals(1, keys.size(), "expected exactly one order path: " + terms);
    return keys.get(0);
  }

  /** Readable JSON the ElasticSearch client refuses to map: {@code term} has no such option. */
  private static final String UNMAPPABLE =
      "{\"query\":{\"term\":{\"entityType.keyword\":{\"value\":\"table\",\"bogus_option\":1}}}}";

  private static DataInsightCustomChart functionChart(Function function) {
    return functionChart(function, TABLE_FILTER);
  }

  private static DataInsightCustomChart functionChart(Function function, String filter) {
    LineChart lineChart =
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withName(OWNER_METRIC)
                        .withFunction(function)
                        .withField("columns.dataLength")
                        .withFilter(filter)))
            .withxAxisField(X_AXIS_FIELD);
    return new DataInsightCustomChart().withName("fn_chart").withChartDetails(lineChart);
  }

  /** A ratio whose numerator narrows further with its own {@code q=}, under a metric filter. */
  private static DataInsightCustomChart formulaChartWithFilter(String filter) {
    LineChart lineChart =
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withName(OWNER_METRIC)
                        .withFormula(
                            "(count(k='id.keyword',q='descriptionStatus: COMPLETE')/count(k='id.keyword'))*100")
                        .withFilter(filter)))
            .withxAxisField(X_AXIS_FIELD);
    return new DataInsightCustomChart().withName("ratio_chart").withChartDetails(lineChart);
  }

  private SearchRequest prepareHistorical(DataInsightCustomChart chart) {
    return aggregator.prepareSearchRequest(
        chart, 0L, END_TIME, new ArrayList<>(), new HashMap<>(), false);
  }

  private static DataInsightCustomChart filteredChart(String firstFilter, String secondFilter) {
    LineChart lineChart =
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withName(OWNER_METRIC)
                        .withFormula("count(k='id.keyword')")
                        .withFilter(firstFilter),
                    new LineChartMetric()
                        .withName(DESCRIPTION_METRIC)
                        .withFormula("count(k='id.keyword')")
                        .withFilter(secondFilter)))
            .withxAxisField(X_AXIS_FIELD);
    return new DataInsightCustomChart().withName("filtered_chart").withChartDetails(lineChart);
  }

  private static DataInsightCustomChart groupedFilteredChart() {
    LineChart lineChart =
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula("count(k='id.keyword')")
                        .withFilter(TABLE_FILTER)))
            .withGroupBy("entityType")
            .withxAxisField(X_AXIS_FIELD);
    return new DataInsightCustomChart()
        .withName("grouped_filtered_chart")
        .withChartDetails(lineChart);
  }

  private static DataInsightCustomChart timestampAxisChart(String groupBy) {
    LineChart lineChart =
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula("count(k='id.keyword')")
                        .withFilter(TABLE_FILTER)))
            .withGroupBy(groupBy);
    return new DataInsightCustomChart()
        .withName("timestamp_axis_chart")
        .withChartDetails(lineChart);
  }

  /** OpenSearch wraps a filter as base64, so assertions decode before comparing. */
  private static JsonNode unwrap(JsonNode query) throws Exception {
    JsonNode wrapper = query.path("wrapper").path("query");
    assertFalse(wrapper.isMissingNode(), "expected a wrapper query, got: " + query);
    return OBJECT_MAPPER.readTree(java.util.Base64.getDecoder().decode(wrapper.asText()));
  }

  private SearchRequest prepare(DataInsightCustomChart chart) {
    return aggregator.prepareSearchRequest(
        chart, 0L, END_TIME, new ArrayList<>(), new HashMap<>(), true);
  }

  private JsonNode serviceTermsAggregation(SearchRequest request) throws Exception {
    JsonNode root = OBJECT_MAPPER.readTree(serializeToJson(request));
    JsonNode serviceAgg = findAggregationWithTermsField(root.path("aggregations"), X_AXIS_FIELD);
    assertNotNull(serviceAgg, "Expected a terms aggregation on " + X_AXIS_FIELD);
    return serviceAgg;
  }

  private static JsonNode findAggregationWithTermsField(JsonNode node, String field) {
    JsonNode match = null;
    if (node != null && node.isContainerNode()) {
      JsonNode terms = node.get("terms");
      if (terms != null && field.equals(terms.path("field").asText())) {
        match = node;
      } else {
        Iterator<JsonNode> children = node.elements();
        while (children.hasNext() && match == null) {
          match = findAggregationWithTermsField(children.next(), field);
        }
      }
    }
    return match;
  }

  private static DataInsightCustomChart formulaChart(String includeService, String excludeService) {
    LineChart lineChart =
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withFormula(
                            "(count(k='id.keyword',q='descriptionStatus: COMPLETE')/count(k='id.keyword'))*100")))
            .withxAxisField(X_AXIS_FIELD)
            .withIncludeXAxisFiled(includeService)
            .withExcludeXAxisField(excludeService);
    return new DataInsightCustomChart()
        .withName("assets_with_description_live")
        .withChartDetails(lineChart);
  }

  private static DataInsightCustomChart groupedFormulaChart(String includeService) {
    LineChart lineChart =
        new LineChart()
            .withMetrics(List.of(new LineChartMetric().withFormula("count(k='id.keyword')")))
            .withGroupBy("entityType")
            .withxAxisField(X_AXIS_FIELD)
            .withExcludeGroups(List.of("testSuite", "testCase"))
            .withIncludeXAxisFiled(includeService);
    return new DataInsightCustomChart()
        .withName("total_data_assets_live")
        .withChartDetails(lineChart);
  }

  private static DataInsightCustomChart groupedMultiMetricChart() {
    LineChart lineChart =
        new LineChart()
            .withMetrics(
                List.of(
                    new LineChartMetric()
                        .withName(OWNER_METRIC)
                        .withFormula("count(k='id.keyword',q='ownerName: *')"),
                    new LineChartMetric()
                        .withName(DESCRIPTION_METRIC)
                        .withFormula("count(k='id.keyword',q='hasDescription: 1')")))
            .withGroupBy("entityType")
            .withxAxisField(X_AXIS_FIELD);
    return new DataInsightCustomChart()
        .withName("ownership_and_description_by_entity_type_live")
        .withChartDetails(lineChart);
  }

  private static DataInsightCustomChart incompleteMetricChart() {
    LineChart lineChart =
        new LineChart()
            .withMetrics(List.of(new LineChartMetric().withField("id.keyword")))
            .withxAxisField(X_AXIS_FIELD);
    return new DataInsightCustomChart()
        .withName("incomplete_metric_chart")
        .withChartDetails(lineChart);
  }

  private static String serializeToJson(SearchRequest request) {
    StringWriter writer = new StringWriter();
    JsonGenerator generator = JACKSON_JSONP_MAPPER.jsonProvider().createGenerator(writer);
    request.serialize(generator, JACKSON_JSONP_MAPPER);
    generator.close();
    return writer.toString();
  }
}
