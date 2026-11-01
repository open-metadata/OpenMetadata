package org.openmetadata.service.apps.bundles.insights.workflows;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.analytics.RawCostAnalysisReportData;
import org.openmetadata.schema.analytics.WebAnalyticEntityViewReportData;
import org.openmetadata.schema.entity.applications.configuration.internal.AppAnalyticsConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.CostAnalysisConfig;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.apps.bundles.insights.workflows.costAnalysis.CostAnalysisWorkflow;
import org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.WebAnalyticsWorkflow;
import org.openmetadata.service.jdbi3.ReportDataRepository;

class WorkflowStatsBatchAggregationTest {
  private static final long TIMESTAMP = 1_700_000_000_000L;
  private static final int BATCH_SIZE = 100;
  private static final String PROCESSOR_MARKER = "Processor";
  private static final String SINK_MARKER = "Sink";

  @Test
  void costAnalysisStepsAggregateAcrossServices() throws Exception {
    CostAnalysisWorkflow workflow =
        new CostAnalysisWorkflow(
            new CostAnalysisConfig().withEnabled(true), TIMESTAMP, BATCH_SIZE, Optional.empty());
    Method method =
        CostAnalysisWorkflow.class.getDeclaredMethod(
            "processRawCostAnalysisReportData", List.class, Map.class, String.class);
    method.setAccessible(true);

    try (MockedStatic<Entity> entity = mockEntity()) {
      method.invoke(workflow, rawData(100), contextData(), "svc-a");
      method.invoke(workflow, rawData(200), contextData(), "svc-b");
    }

    Map<String, StepStats> steps = workflow.getWorkflowStats().getWorkflowStepStats();
    assertSteps(steps, PROCESSOR_MARKER, 100, 200);
    assertSteps(steps, SINK_MARKER, 100, 200);
  }

  @Test
  void webAnalyticsStepsAggregateAcrossDays() throws Exception {
    WebAnalyticsWorkflow workflow =
        new WebAnalyticsWorkflow(
            new AppAnalyticsConfig().withEnabled(true), TIMESTAMP, BATCH_SIZE, Optional.empty());
    Method method =
        WebAnalyticsWorkflow.class.getDeclaredMethod(
            "processEntityViewData", Map.class, Map.class, String.class);
    method.setAccessible(true);

    try (MockedStatic<Entity> entity = mockEntity()) {
      method.invoke(workflow, entityViewData(50), contextData(), "day-1");
      method.invoke(workflow, entityViewData(70), contextData(), "day-2");
    }

    Map<String, StepStats> steps = workflow.getWorkflowStats().getWorkflowStepStats();
    assertSteps(steps, PROCESSOR_MARKER, 50, 70);
    assertSteps(steps, SINK_MARKER, 50, 70);
  }

  @Test
  void repeatedQualifierStillReplacesStepStats() throws Exception {
    CostAnalysisWorkflow workflow =
        new CostAnalysisWorkflow(
            new CostAnalysisConfig().withEnabled(true), TIMESTAMP, BATCH_SIZE, Optional.empty());
    Method method =
        CostAnalysisWorkflow.class.getDeclaredMethod(
            "processRawCostAnalysisReportData", List.class, Map.class, String.class);
    method.setAccessible(true);

    try (MockedStatic<Entity> entity = mockEntity()) {
      method.invoke(workflow, rawData(100), contextData(), "svc-a");
      method.invoke(workflow, rawData(200), contextData(), "svc-a");
    }

    Map<String, StepStats> steps = workflow.getWorkflowStats().getWorkflowStepStats();
    assertSteps(steps, PROCESSOR_MARKER, 200);
  }

  private static void assertSteps(
      Map<String, StepStats> steps, String marker, int... expectedTotals) {
    List<StepStats> matching =
        steps.entrySet().stream()
            .filter(entry -> entry.getKey().contains(marker))
            .map(Map.Entry::getValue)
            .toList();
    assertEquals(expectedTotals.length, matching.size());
    int expectedSum = IntStream.of(expectedTotals).sum();
    assertEquals(expectedSum, matching.stream().mapToInt(StepStats::getTotalRecords).sum());
    assertEquals(expectedSum, matching.stream().mapToInt(StepStats::getSuccessRecords).sum());
    assertEquals(0, matching.stream().mapToInt(StepStats::getFailedRecords).sum());
  }

  private static MockedStatic<Entity> mockEntity() {
    MockedStatic<Entity> entity = mockStatic(Entity.class, CALLS_REAL_METHODS);
    entity
        .when(() -> Entity.getEntityTimeSeriesRepository(Entity.ENTITY_REPORT_DATA))
        .thenReturn(mock(ReportDataRepository.class));
    return entity;
  }

  private static Map<String, Object> contextData() {
    Map<String, Object> contextData = new HashMap<>();
    contextData.put(TimestampUtils.TIMESTAMP_KEY, TIMESTAMP);
    return contextData;
  }

  private static List<RawCostAnalysisReportData> rawData(int count) {
    return IntStream.range(0, count).mapToObj(i -> new RawCostAnalysisReportData()).toList();
  }

  private static Map<String, WebAnalyticEntityViewReportData> entityViewData(int count) {
    Map<String, WebAnalyticEntityViewReportData> data = new HashMap<>();
    IntStream.range(0, count)
        .forEach(i -> data.put("entity-" + i, new WebAnalyticEntityViewReportData()));
    return data;
  }
}
