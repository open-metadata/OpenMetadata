package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.schema.dataInsight.custom.LineChartMetric;

/**
 * Both engines fall back to an unfiltered aggregation on a filter they cannot read, so this parser
 * decides when a chart counts what it was asked for. Returning null is the safe answer everywhere:
 * the sub-aggregation stays unfiltered exactly as before, and the request-level hoist declines.
 */
class DataInsightMetricFilterTest {

  private static final String TABLES = "{\"query\":{\"term\":{\"entityType.keyword\":\"table\"}}}";
  private static final String DASHBOARDS =
      "{\"query\":{\"term\":{\"entityType.keyword\":\"dashboard\"}}}";

  @Test
  void absentEmptyOrUnreadableFiltersYieldNothing() {
    assertNull(DataInsightMetricFilter.queryJson(null));
    assertNull(
        DataInsightMetricFilter.queryJson("{}"), "the empty filter is an exact-string check");
    assertNull(DataInsightMetricFilter.queryJson("{\"bool\":{}}"), "valid JSON with no query node");
    assertNull(DataInsightMetricFilter.queryJson("{"), "unparseable");
  }

  @Test
  void metricsAgreeingOnOneFilterShareIt() {
    assertEquals(
        "{\"term\":{\"entityType.keyword\":\"table\"}}",
        DataInsightMetricFilter.sharedQueryJson(List.of(metric(TABLES), metric(TABLES))));
  }

  @Test
  void formattingDifferencesStillCountAsAgreement() {
    // Both sides are re-serialized from the parsed tree, so indentation cannot split a pair that
    // means the same thing.
    String spaced = "{ \"query\" : { \"term\" : { \"entityType.keyword\" : \"table\" } } }";
    assertEquals(
        DataInsightMetricFilter.queryJson(TABLES),
        DataInsightMetricFilter.sharedQueryJson(List.of(metric(TABLES), metric(spaced))));
  }

  @Test
  void thereIsNoSharedFilterWhenTheMetricsDisagree() {
    assertNull(
        DataInsightMetricFilter.sharedQueryJson(List.of(metric(TABLES), metric(DASHBOARDS))));
    assertNull(
        DataInsightMetricFilter.sharedQueryJson(List.of(metric(TABLES), metric(null))),
        "one unfiltered metric means there is no population every metric shares");
    assertNull(DataInsightMetricFilter.sharedQueryJson(List.of(metric(TABLES), metric("{"))));
    assertNull(DataInsightMetricFilter.sharedQueryJson(List.of()));
    assertNull(DataInsightMetricFilter.sharedQueryJson(null));
  }

  @Test
  void onlyATermsAxisIsHoistable() {
    assertNotNull(
        DataInsightMetricFilter.hoistableQueryJson(chart("service.name.keyword", null)),
        "a terms axis has a top-N to align");

    // A date histogram has no top-N, and narrowing its query would shorten the window it plots,
    // which moves the first/last delta the dashboard renders. Both variants below are shipped
    // chart shapes: the KPI charts, and the six v150 grouped system charts.
    assertNull(DataInsightMetricFilter.hoistableQueryJson(chart(null, null)));
    assertNull(
        DataInsightMetricFilter.hoistableQueryJson(chart("@timestamp", "entityType")),
        "a groupBy must not widen the gate: this is the grouped system-chart shape");
  }

  private static LineChart chart(String xAxisField, String groupBy) {
    return new LineChart()
        .withMetrics(List.of(metric(TABLES), metric(TABLES)))
        .withxAxisField(xAxisField)
        .withGroupBy(groupBy);
  }

  private static LineChartMetric metric(String filter) {
    return new LineChartMetric().withFormula("count(k='id.keyword')").withFilter(filter);
  }
}
