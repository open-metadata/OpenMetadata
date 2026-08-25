package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import jakarta.json.stream.JsonGenerator;
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
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.schema.dataInsight.custom.LineChartMetric;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

class ElasticSearchLineChartAggregatorTest {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final JacksonJsonpMapper JACKSON_JSONP_MAPPER =
      new JacksonJsonpMapper(OBJECT_MAPPER);

  private static final String SERVICE_NAME = "myservice";
  private static final String X_AXIS_FIELD = "service.name.keyword";
  private static final String OWNER_METRIC = "withOwner";
  private static final String DESCRIPTION_METRIC = "withDescription";
  private static final long END_TIME = 24L * 60 * 60 * 1000;

  private final ElasticSearchLineChartAggregator aggregator =
      new ElasticSearchLineChartAggregator();

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

  private static final String TABLE_FILTER =
      "{\"query\":{\"term\":{\"entityType.keyword\":\"table\"}}}";
  private static final String DASHBOARD_FILTER =
      "{\"query\":{\"term\":{\"entityType.keyword\":\"dashboard\"}}}";
  private static final JsonNode TABLE_QUERY = tableQuery();

  /**
   * The canonical typed form. Unlike the OpenSearch wrapper, which passes the filter's bytes
   * through untouched, {@code withJson} parses client side and re-serializes, so the shorthand
   * {@code {"term":{"f":"v"}}} comes back as {@code {"term":{"f":{"value":"v"}}}}. Same query, and
   * pinning it here is what would catch the client silently dropping a clause it cannot map.
   */
  private static JsonNode tableQuery() {
    try {
      return new com.fasterxml.jackson.databind.ObjectMapper()
          .readTree("{\"term\":{\"entityType.keyword\":{\"value\":\"table\"}}}");
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
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

  /** ElasticSearch serializes the hoisted query as the typed query, so it compares directly. */
  private static JsonNode unwrap(JsonNode query) {
    return query;
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
