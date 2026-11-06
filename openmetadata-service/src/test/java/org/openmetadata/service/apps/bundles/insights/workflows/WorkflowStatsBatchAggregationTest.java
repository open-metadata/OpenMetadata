package org.openmetadata.service.apps.bundles.insights.workflows;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.analytics.DataAssetMetrics;
import org.openmetadata.schema.analytics.DataAssetValues;
import org.openmetadata.schema.analytics.RawCostAnalysisReportData;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.analytics.WebAnalyticEntityViewReportData;
import org.openmetadata.schema.analytics.WebAnalyticUserActivityReportData;
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
  private static final String AGGREGATOR_MARKER = "Aggregator";

  @Test
  void costAnalysisStepsAggregateAcrossServices() throws Exception {
    CostAnalysisWorkflow workflow =
        new CostAnalysisWorkflow(
            new CostAnalysisConfig().withEnabled(true), TIMESTAMP, BATCH_SIZE, Optional.empty());
    Method method =
        workflowMethod(
            CostAnalysisWorkflow.class, "processRawCostAnalysisReportData", List.class, Map.class);

    try (MockedStatic<Entity> entity = mockEntity()) {
      method.invoke(workflow, rawData(100), contextData());
      method.invoke(workflow, rawData(200), contextData());
    }

    Map<String, StepStats> steps = workflow.getWorkflowStats().getWorkflowStepStats();
    assertSteps(steps, PROCESSOR_MARKER, 300);
    assertSteps(steps, SINK_MARKER, 300);
  }

  @Test
  void webAnalyticsStepsAggregateAcrossDays() throws Exception {
    WebAnalyticsWorkflow workflow =
        new WebAnalyticsWorkflow(
            new AppAnalyticsConfig().withEnabled(true), TIMESTAMP, BATCH_SIZE, Optional.empty());
    Method method =
        workflowMethod(WebAnalyticsWorkflow.class, "processEntityViewData", Map.class, Map.class);

    try (MockedStatic<Entity> entity = mockEntity()) {
      method.invoke(workflow, entityViewData(50), contextData());
      method.invoke(workflow, entityViewData(70), contextData());
    }

    Map<String, StepStats> steps = workflow.getWorkflowStats().getWorkflowStepStats();
    assertSteps(steps, PROCESSOR_MARKER, 120);
    assertSteps(steps, SINK_MARKER, 120);
  }

  @Test
  void cumulativeProgressSnapshotsStillReplaceStepStats() {
    WorkflowStats workflowStats = new WorkflowStats("test");
    workflowStats.updateWorkflowStepStats(
        PROCESSOR_MARKER, new StepStats().withTotalRecords(100).withSuccessRecords(50));
    workflowStats.updateWorkflowStepStats(
        PROCESSOR_MARKER, new StepStats().withTotalRecords(100).withSuccessRecords(70));

    assertEquals(1, workflowStats.getWorkflowStepStats().size());
    assertStep(workflowStats.getWorkflowStepStats().get(PROCESSOR_MARKER), 100, 70, 0);
  }

  @Test
  void aggregatedCostAnalysisStepsAggregateAcrossServices() throws Exception {
    CostAnalysisWorkflow workflow =
        new CostAnalysisWorkflow(
            new CostAnalysisConfig().withEnabled(true), TIMESTAMP, BATCH_SIZE, Optional.empty());
    Method method =
        workflowMethod(
            CostAnalysisWorkflow.class,
            "processAggregatedCostAnalysisReportData",
            Map.class,
            Map.class);

    try (MockedStatic<Entity> entity = mockEntity()) {
      method.invoke(workflow, aggregatedCostData(2), contextData());
      method.invoke(workflow, aggregatedCostData(3), contextData());
    }

    Map<String, StepStats> steps = workflow.getWorkflowStats().getWorkflowStepStats();
    assertEquals(3, steps.size());
    assertSteps(steps, AGGREGATOR_MARKER, 5);
    assertSteps(steps, PROCESSOR_MARKER, 5);
    assertSteps(steps, SINK_MARKER, 5);
  }

  @Test
  void userActivityStepsAggregateAcrossDays() throws Exception {
    WebAnalyticsWorkflow workflow =
        new WebAnalyticsWorkflow(
            new AppAnalyticsConfig().withEnabled(true), TIMESTAMP, BATCH_SIZE, Optional.empty());
    Method method =
        workflowMethod(
            WebAnalyticsWorkflow.class, "processUserActivityData", Map.class, Map.class, Map.class);

    try (MockedStatic<Entity> entity = mockEntity()) {
      processUserActivity(workflow, method, 2);
      processUserActivity(workflow, method, 3);
    }

    Map<String, StepStats> steps = workflow.getWorkflowStats().getWorkflowStepStats();
    assertEquals(3, steps.size());
    assertSteps(steps, AGGREGATOR_MARKER, 5);
    assertSteps(steps, PROCESSOR_MARKER, 5);
    assertSteps(steps, SINK_MARKER, 5);
  }

  @Test
  void laterSuccessfulServicePreservesEarlierSinkFailures() throws Exception {
    CostAnalysisWorkflow workflow =
        new CostAnalysisWorkflow(
            new CostAnalysisConfig().withEnabled(true), TIMESTAMP, BATCH_SIZE, Optional.empty());
    Method method =
        workflowMethod(
            CostAnalysisWorkflow.class, "processRawCostAnalysisReportData", List.class, Map.class);
    ReportDataRepository repository = mock(ReportDataRepository.class);
    when(repository.createNewRecord(any(ReportData.class), anyString(), anyString()))
        .thenThrow(new IllegalStateException("test write failure"))
        .thenAnswer(invocation -> invocation.getArgument(0));

    try (MockedStatic<Entity> entity = mockEntity(repository)) {
      method.invoke(workflow, rawData(100), contextData());
      method.invoke(workflow, rawData(200), contextData());
    }

    assertTrue(workflow.getWorkflowStats().hasFailed());
    List<StepStats> sinks =
        workflow.getWorkflowStats().getWorkflowStepStats().entrySet().stream()
            .filter(entry -> entry.getKey().contains(SINK_MARKER))
            .map(Map.Entry::getValue)
            .toList();
    assertEquals(1, sinks.size());
    assertStep(sinks.get(0), 300, 200, 100);
  }

  @Test
  void emptyDayPreservesEarlierReportCounts() throws Exception {
    WebAnalyticsWorkflow workflow =
        new WebAnalyticsWorkflow(
            new AppAnalyticsConfig().withEnabled(true), TIMESTAMP, BATCH_SIZE, Optional.empty());
    Method method =
        workflowMethod(WebAnalyticsWorkflow.class, "processEntityViewData", Map.class, Map.class);

    try (MockedStatic<Entity> entity = mockEntity()) {
      method.invoke(workflow, entityViewData(50), contextData());
      method.invoke(workflow, entityViewData(0), contextData());
    }

    Map<String, StepStats> steps = workflow.getWorkflowStats().getWorkflowStepStats();
    assertSteps(steps, PROCESSOR_MARKER, 50);
    assertSteps(steps, SINK_MARKER, 50);
  }

  @Test
  void accumulationKeepsIndependentCounters() {
    WorkflowStats workflowStats = new WorkflowStats("test");
    StepStats completedStep =
        new StepStats().withTotalRecords(10).withSuccessRecords(8).withFailedRecords(2);
    workflowStats.accumulateWorkflowStepStats(PROCESSOR_MARKER, completedStep);
    completedStep.setSuccessRecords(10);
    completedStep.setFailedRecords(0);
    workflowStats.accumulateWorkflowStepStats(
        PROCESSOR_MARKER, new StepStats().withTotalRecords(20).withSuccessRecords(20));

    assertEquals(1, workflowStats.getWorkflowStepStats().size());
    assertStep(workflowStats.getWorkflowStepStats().get(PROCESSOR_MARKER), 30, 28, 2);
  }

  private static void assertStep(StepStats stats, int total, int success, int failed) {
    assertEquals(total, stats.getTotalRecords());
    assertEquals(success, stats.getSuccessRecords());
    assertEquals(failed, stats.getFailedRecords());
  }

  private static Method workflowMethod(
      Class<?> workflowClass, String name, Class<?>... parameterTypes)
      throws NoSuchMethodException {
    Method method = workflowClass.getDeclaredMethod(name, parameterTypes);
    method.setAccessible(true);
    return method;
  }

  private static Map<
          String, Map<String, Map<String, CostAnalysisWorkflow.AggregatedCostAnalysisData>>>
      aggregatedCostData(int count) {
    Map<String, Map<String, Map<String, CostAnalysisWorkflow.AggregatedCostAnalysisData>>> data =
        new HashMap<>();
    IntStream.range(0, count)
        .forEach(
            i ->
                data.put(
                    "entity-" + i,
                    Map.of(
                        "Snowflake",
                        Map.of(
                            "service",
                            new CostAnalysisWorkflow.AggregatedCostAnalysisData(
                                1.0, 1.0, dataAssetMetrics(), dataAssetMetrics())))));
    return data;
  }

  private static DataAssetMetrics dataAssetMetrics() {
    return new DataAssetMetrics()
        .withCount(new DataAssetValues().withThreeDays(1.0))
        .withSize(new DataAssetValues().withThreeDays(1.0));
  }

  private static void processUserActivity(WebAnalyticsWorkflow workflow, Method method, int count)
      throws Exception {
    Map<UUID, WebAnalyticsWorkflow.UserActivityData> users = new HashMap<>();
    IntStream.range(0, count)
        .forEach(
            i -> {
              UUID userId = UUID.randomUUID();
              users.put(
                  userId,
                  new WebAnalyticsWorkflow.UserActivityData(
                      "user-" + i,
                      userId,
                      null,
                      Map.of(UUID.randomUUID(), List.of(TIMESTAMP)),
                      1,
                      1,
                      TIMESTAMP));
            });
    Map<UUID, WebAnalyticUserActivityReportData> reports = new HashMap<>();
    Map<String, Object> contextData = contextData();
    contextData.put(WebAnalyticsWorkflow.USER_ACTIVITY_REPORT_DATA_KEY, reports);
    method.invoke(workflow, users, reports, contextData);
  }

  private static void assertSteps(Map<String, StepStats> steps, String marker, int expectedTotal) {
    assertFalse(steps.keySet().stream().anyMatch(name -> name.contains(" (")));
    List<StepStats> matching =
        steps.entrySet().stream()
            .filter(entry -> entry.getKey().contains(marker))
            .map(Map.Entry::getValue)
            .toList();
    assertEquals(1, matching.size());
    assertStep(matching.getFirst(), expectedTotal, expectedTotal, 0);
  }

  private static MockedStatic<Entity> mockEntity() {
    return mockEntity(mock(ReportDataRepository.class));
  }

  private static MockedStatic<Entity> mockEntity(ReportDataRepository repository) {
    MockedStatic<Entity> entity = mockStatic(Entity.class, CALLS_REAL_METHODS);
    entity
        .when(() -> Entity.getEntityTimeSeriesRepository(Entity.ENTITY_REPORT_DATA))
        .thenReturn(repository);
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
