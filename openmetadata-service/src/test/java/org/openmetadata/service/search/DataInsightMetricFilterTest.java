package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.dataInsight.custom.LineChartMetric;

/**
 * Both engines fall back to an unfiltered aggregation on a filter they cannot read, so this parser
 * decides when a chart counts what it was asked for. Returning null is the safe answer everywhere:
 * the sub-aggregation stays unfiltered, exactly as it did before the parses were shared.
 */
class DataInsightMetricFilterTest {

  @Test
  void theQueryNodeIsExtractedVerbatim() {
    assertEquals(
        "{\"term\":{\"entityType.keyword\":\"table\"}}",
        DataInsightMetricFilter.queryJson(
            "{\"query\":{\"term\":{\"entityType.keyword\":\"table\"}}}"));
  }

  @Test
  void formattingDoesNotChangeTheExtractedQuery() {
    // Re-serialized from the parsed tree, so indentation cannot split two filters that mean the
    // same thing.
    assertEquals(
        DataInsightMetricFilter.queryJson("{\"query\":{\"term\":{\"a\":\"b\"}}}"),
        DataInsightMetricFilter.queryJson("{ \"query\" : { \"term\" : { \"a\" : \"b\" } } }"));
  }

  @Test
  void absentEmptyOrUnreadableFiltersYieldNothing() {
    assertNull(DataInsightMetricFilter.queryJson(null));
    assertNull(
        DataInsightMetricFilter.queryJson("{}"), "the empty filter is an exact-string check");
    assertNull(DataInsightMetricFilter.queryJson("{\"bool\":{}}"), "valid JSON with no query node");
    assertNull(DataInsightMetricFilter.queryJson("{"), "unparseable");
  }

  @Test
  void aPopulationHasOneFilterPerDistinctMetricFilter() {
    List<String> population =
        DataInsightMetricFilter.populationFilters(
            metricsFiltering(
                "{\"query\":{\"term\":{\"a\":\"b\"}}}",
                "{ \"query\" : { \"term\" : { \"a\" : \"b\" } } }",
                "{\"query\":{\"term\":{\"a\":\"c\"}}}"));

    assertEquals(List.of("{\"term\":{\"a\":\"b\"}}", "{\"term\":{\"a\":\"c\"}}"), population);
  }

  @Test
  void aMetricThatCountsEveryDocumentLeavesNoPopulation() {
    // One metric without a readable filter counts the whole index, so no category is outside the
    // chart and a categorical axis must stay wide.
    String table = "{\"query\":{\"term\":{\"entityType.keyword\":\"table\"}}}";
    assertTrue(DataInsightMetricFilter.populationFilters(metricsFiltering(table, null)).isEmpty());
    assertTrue(DataInsightMetricFilter.populationFilters(metricsFiltering(table, "{")).isEmpty());
    assertTrue(DataInsightMetricFilter.populationFilters(List.of()).isEmpty());
  }

  private static List<LineChartMetric> metricsFiltering(String... filters) {
    return Arrays.stream(filters).map(filter -> new LineChartMetric().withFilter(filter)).toList();
  }

  @Test
  void theOrderKeyPrefixCannotContainADot() {
    // An order path splits on '.' into an aggregation and a metric sub-field, and the engine
    // rejects the whole search when the sub-field does not exist.
    assertEquals(-1, DataInsightMetricFilter.FILTER_AGG_KEY.indexOf('.'));
  }
}
