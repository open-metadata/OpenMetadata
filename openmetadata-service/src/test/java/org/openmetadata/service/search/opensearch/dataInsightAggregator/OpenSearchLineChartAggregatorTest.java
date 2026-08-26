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
  void metricsSharingAFilterConstrainTheLiveRequest() throws Exception {
    JsonNode query =
        OBJECT_MAPPER
            .readTree(serializeToJson(prepare(filteredChart(TABLE_FILTER, TABLE_FILTER))))
            .path("query");

    assertEquals(TABLE_QUERY, unwrap(query), "the live request carried no query at all before");
  }

  @Test
  void metricsSharingAFilterAndTheDateRangeBothConstrainTheHistoricalRequest() throws Exception {
    JsonNode query =
        OBJECT_MAPPER
            .readTree(serializeToJson(prepareHistorical(filteredChart(TABLE_FILTER, TABLE_FILTER))))
            .path("query");

    JsonNode clauses = query.path("bool").path("filter");
    assertEquals(2, clauses.size(), "expected the range and the metric filter: " + query);
    assertTrue(clauses.get(0).has("range"), "first clause should be the @timestamp range");
    assertEquals(TABLE_QUERY, unwrap(clauses.get(1)));
  }

  @Test
  void anUnreadableFilterLeavesBothTheRequestAndTheSubAggregationUnfiltered() throws Exception {
    // Asserting both halves together is what stops a later change narrowing the request while the
    // sub-aggregations silently fall back, which would count one population and select from
    // another.
    for (String bad : new String[] {"{", "{\"bool\":{}}", "{}"}) {
      JsonNode root = OBJECT_MAPPER.readTree(serializeToJson(prepare(filteredChart(bad, bad))));
      assertTrue(root.path("query").isMissingNode(), "no hoist for filter " + bad);
      // Naming the surviving aggregation rather than looking for an absent "filter" key: the
      // formula path keys its wrapper "filter<index>", so a probe for the bare name can never fail.
      Set<String> subAggregations = new HashSet<>();
      findAggregationWithTermsField(root.path("aggregations"), X_AXIS_FIELD)
          .path("aggregations")
          .fieldNames()
          .forEachRemaining(subAggregations::add);
      assertEquals(
          Set.of("id.keyword0"),
          subAggregations,
          "the metric must fall back to one unfiltered leaf aggregation for " + bad);
    }
  }

  @Test
  void metricsThatDisagreeAreNotHoistedButStillFilterTheirOwnBuckets() throws Exception {
    // Two populations, so there is no single one to select from. The request must stay wide while
    // each metric keeps counting inside its own filter.
    JsonNode root =
        OBJECT_MAPPER.readTree(
            serializeToJson(prepare(filteredChart(TABLE_FILTER, DASHBOARD_FILTER))));

    assertTrue(root.path("query").isMissingNode(), "no hoist: " + root.path("query"));
    assertTrue(
        findAggregationWithTermsField(root.path("aggregations"), X_AXIS_FIELD)
            .path("aggregations")
            .has("filter0"),
        "each metric must still filter its own bucket");
  }

  @Test
  void aGroupByDoesNotDisableTheHoist() throws Exception {
    JsonNode query =
        OBJECT_MAPPER.readTree(serializeToJson(prepare(groupedFilteredChart()))).path("query");

    assertEquals(TABLE_QUERY, unwrap(query), "a terms axis is hoistable with or without a groupBy");
  }

  @Test
  void aTimestampAxisChartIsNeverHoisted() throws Exception {
    // Narrowing the query here would shorten the window the date histogram plots, moving the
    // first/last delta the dashboard renders. A groupBy must not widen the gate either.
    for (String groupBy : new String[] {null, "entityType"}) {
      JsonNode query =
          OBJECT_MAPPER
              .readTree(serializeToJson(prepareHistorical(timestampAxisChart(groupBy))))
              .path("query");

      assertTrue(
          query.has("range"), "the request must carry the bare @timestamp range, got: " + query);
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

  /** OpenSearch wraps a hoisted query as base64, so assertions decode before comparing. */
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
