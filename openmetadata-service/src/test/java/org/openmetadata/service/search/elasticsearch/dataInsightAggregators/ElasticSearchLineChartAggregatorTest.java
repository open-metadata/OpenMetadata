package org.openmetadata.service.search.elasticsearch.dataInsightAggregators;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import es.co.elastic.clients.elasticsearch.core.SearchRequest;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import jakarta.json.stream.JsonGenerator;
import java.io.IOException;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
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

  private SearchRequest prepare(DataInsightCustomChart chart) throws IOException {
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

  private static String serializeToJson(SearchRequest request) {
    StringWriter writer = new StringWriter();
    JsonGenerator generator = JACKSON_JSONP_MAPPER.jsonProvider().createGenerator(writer);
    request.serialize(generator, JACKSON_JSONP_MAPPER);
    generator.close();
    return writer.toString();
  }
}
