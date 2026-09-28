package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.elasticsearch.dataInsightAggregators.ElasticSearchLineChartAggregator;
import org.openmetadata.service.util.DataInsightFormulaEvaluator;

class HealthyDataAssetsChartMigrationTest {
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final JacksonJsonpMapper JSONP_MAPPER = new JacksonJsonpMapper(OBJECT_MAPPER);
  private static final long END_TIME = 7L * 24 * 60 * 60 * 1000;

  private final ElasticSearchLineChartAggregator aggregator =
      new ElasticSearchLineChartAggregator();

  @BeforeEach
  void setUp() {
    Entity.setSearchRepository(mock(SearchRepository.class));
  }

  @Test
  void dailyChartBucketsByDaySoTheCardGetsOnePointPerDay() throws Exception {
    JsonNode request = prepare(HealthyDataAssetsChartMigration.dailyChart(), false);

    assertFalse(
        request.findValues("date_histogram").isEmpty(), "expected daily buckets: " + request);
    assertTrue(request.findValues("terms").isEmpty(), "must not bucket by service: " + request);
  }

  @Test
  void dailyChartCountsTablesOnFieldsThatExistInTheTestCaseResultIndex() throws Exception {
    JsonNode request = prepare(HealthyDataAssetsChartMigration.dailyChart(), false);

    assertEquals(Set.of("table.id"), cardinalityFields(request));
    assertFalse(request.toString().contains(".keyword"), "result-index fields are keyword already");
  }

  @Test
  void liveChartCountsEntitiesByTheirLatestResult() throws Exception {
    JsonNode request = prepare(HealthyDataAssetsChartMigration.liveChart(), true);

    assertFalse(request.findValues("terms").isEmpty(), "live chart is scoped per service");
    assertEquals(Set.of("originEntityFQN"), cardinalityFields(request));
    assertTrue(request.toString().contains("testCaseResult.testCaseStatus"));
  }

  @Test
  void bothFormulasAreHealthyPercentages() {
    for (String formula :
        Set.of(
            HealthyDataAssetsChartMigration.DAILY_FORMULA,
            HealthyDataAssetsChartMigration.LIVE_FORMULA)) {
      assertTrue(DataInsightFormulaEvaluator.isValidFormula(formula), formula);
      assertTrue(formula.endsWith("*100"), formula);
    }
  }

  private JsonNode prepare(LineChart lineChart, boolean live) throws Exception {
    DataInsightCustomChart chart =
        new DataInsightCustomChart().withName("healthy").withChartDetails(lineChart);
    SearchRequest request =
        aggregator.prepareSearchRequest(
            chart, 0L, END_TIME, new ArrayList<>(), new HashMap<>(), live);
    StringWriter writer = new StringWriter();
    try (JsonGenerator generator = JSONP_MAPPER.jsonProvider().createGenerator(writer)) {
      request.serialize(generator, JSONP_MAPPER);
    }
    return OBJECT_MAPPER.readTree(writer.toString());
  }

  private static Set<String> cardinalityFields(JsonNode request) {
    Set<String> fields = new HashSet<>();
    request.findValues("cardinality").forEach(node -> fields.add(node.path("field").asText()));
    return fields;
  }
}
