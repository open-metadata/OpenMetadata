package org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics;

import static org.openmetadata.service.apps.bundles.insights.DataInsightsApp.REPORT_DATA_TYPE_KEY;
import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.TIMESTAMP_KEY;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.analytics.WebAnalyticEntityViewReportData;
import org.openmetadata.schema.analytics.WebAnalyticEventData;
import org.openmetadata.schema.analytics.WebAnalyticUserActivityReportData;
import org.openmetadata.schema.analytics.type.WebAnalyticEventType;
import org.openmetadata.schema.entity.applications.configuration.internal.AppAnalyticsConfig;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.DataInsightsApp;
import org.openmetadata.service.apps.bundles.insights.processors.CreateReportDataProcessor;
import org.openmetadata.service.apps.bundles.insights.sinks.ReportDataSink;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.apps.bundles.insights.workflows.WorkflowStats;
import org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.processors.WebAnalyticsEntityViewProcessor;
import org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.processors.WebAnalyticsUserActivityAggregator;
import org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.processors.WebAnalyticsUserActivityProcessor;
import org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.sources.PaginatedWebAnalyticEventDataSource;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.ReportDataRepository;
import org.openmetadata.service.jdbi3.WebAnalyticEventRepository;
import org.openmetadata.service.util.ResultList;

@Slf4j
public class WebAnalyticsWorkflow {
  private final Long startTimestamp;
  private final Long endTimestamp;
  private final int batchSize;
  private final AppAnalyticsConfig webAnalyticsConfig;
  private static final int WEB_ANALYTIC_EVENTS_RETENTION_DAYS = 7;
  private final List<PaginatedWebAnalyticEventDataSource> sources = new ArrayList<>();
  private WebAnalyticsEntityViewProcessor webAnalyticsEntityViewProcessor;
  private WebAnalyticsUserActivityProcessor webAnalyticsUserActivityProcessor;

  public record UserActivityData(
      String userName,
      UUID userId,
      String team,
      Map<UUID, List<Long>> sessions,
      int totalPageView,
      int totalSessions,
      Long lastSession) {}

  @Getter private final WorkflowStats workflowStats = new WorkflowStats("WebAnalyticsWorkflow");
  public static final String USER_ACTIVITY_DATA_KEY = "userActivityData";
  public static final String USER_ACTIVITY_REPORT_DATA_KEY = "userActivityReportData";
  public static final String ENTITY_VIEW_REPORT_DATA_KEY = "entityViewReportData";

  public WebAnalyticsWorkflow(
      AppAnalyticsConfig webAnalyticsConfig,
      Long timestamp,
      int batchSize,
      Optional<DataInsightsApp.Backfill> backfill) {
    if (backfill.isPresent()) {
      Long oldestPossibleTimestamp =
          TimestampUtils.getStartOfDayTimestamp(
              TimestampUtils.subtractDays(timestamp, WEB_ANALYTIC_EVENTS_RETENTION_DAYS));

      this.endTimestamp =
          TimestampUtils.getEndOfDayTimestamp(
              Collections.max(
                  List.of(TimestampUtils.getTimestampFromDateString(backfill.get().endDate()))));
      this.startTimestamp =
          TimestampUtils.getStartOfDayTimestamp(
              Collections.max(
                  List.of(
                      TimestampUtils.getTimestampFromDateString(backfill.get().startDate()),
                      oldestPossibleTimestamp)));

      if (oldestPossibleTimestamp.equals(endTimestamp)) {
        LOG.warn(
            "Backfill won't happen because the set date is before the limit of {}",
            oldestPossibleTimestamp);
      }
    } else {
      this.endTimestamp =
          TimestampUtils.getEndOfDayTimestamp(TimestampUtils.subtractDays(timestamp, 1));
      this.startTimestamp = TimestampUtils.getStartOfDayTimestamp(endTimestamp);
    }
    this.batchSize = batchSize;
    this.webAnalyticsConfig = webAnalyticsConfig;
  }

  private void initialize() {
    Long pointerTimestamp = this.endTimestamp;

    while (pointerTimestamp > startTimestamp) {
      sources.add(
          new PaginatedWebAnalyticEventDataSource(
              batchSize,
              TimestampUtils.getStartOfDayTimestamp(pointerTimestamp),
              pointerTimestamp));
      pointerTimestamp = TimestampUtils.subtractDays(pointerTimestamp, 1);
    }

    int total = 0;
    for (PaginatedWebAnalyticEventDataSource source : sources) {
      total += source.getTotalRecords();
    }

    workflowStats.setWorkflowStatsTotalRecords(total);

    webAnalyticsEntityViewProcessor = new WebAnalyticsEntityViewProcessor(total);
    webAnalyticsUserActivityProcessor = new WebAnalyticsUserActivityProcessor(total);
  }

  public void process() throws SearchIndexException {
    if (!webAnalyticsConfig.getEnabled()) {
      return;
    }
    LOG.info("[Data Insights] Processing App Analytics.");
    initialize();
    Map<String, Object> contextData = new HashMap<>();

    for (PaginatedWebAnalyticEventDataSource source : sources) {
      // TODO: Could the size of the Maps be an issue?
      Map<UUID, UserActivityData> userActivityData = new HashMap<>();
      Map<UUID, WebAnalyticUserActivityReportData> userActivityReportData = new HashMap<>();
      Map<String, WebAnalyticEntityViewReportData> entityViewReportData = new HashMap<>();
      Long referenceTimestamp = source.getStartTs();

      // Delete the records of the days we are going to process
      deleteReportDataRecordsAtDate(
          referenceTimestamp, ReportData.ReportDataType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA);
      deleteReportDataRecordsAtDate(
          referenceTimestamp, ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA);

      contextData.put(TIMESTAMP_KEY, referenceTimestamp);
      contextData.put(USER_ACTIVITY_DATA_KEY, userActivityData);
      contextData.put(USER_ACTIVITY_REPORT_DATA_KEY, userActivityReportData);
      contextData.put(ENTITY_VIEW_REPORT_DATA_KEY, entityViewReportData);

      // Process Raw WebAnalyticEventData
      // Fills the entityViewReportData and userActivityData Maps
      Optional<String> processEventsError = processEvents(source, contextData);

      if (processEventsError.isPresent()) {
        LOG.debug(processEventsError.get());
        continue;
      }

      // Process each Report.
      Optional<String> processEntityViewDataError =
          processEntityViewData(entityViewReportData, contextData);

      processEntityViewDataError.ifPresent(LOG::debug);

      Optional<String> processUserActivityError =
          processUserActivityData(userActivityData, userActivityReportData, contextData);

      processUserActivityError.ifPresent(LOG::debug);
    }

    // Prune WebAnalyticEvents older than retentionDays
    pruneWebAnalyticEvents();
  }

  // TODO: How to better divide the two flows while keeping stats consistent and avoiding breaking
  // one flow if
  // the other one errors.
  private Optional<String> processEvents(
      PaginatedWebAnalyticEventDataSource source, Map<String, Object> contextData)
      throws SearchIndexException {
    Optional<String> error = Optional.empty();

    while (!source.isDone().get()) {
      ResultList<WebAnalyticEventData> resultList = source.readNext(null);
      try {
        if (!resultList.getData().isEmpty()) {
          webAnalyticsEntityViewProcessor.process(resultList, contextData);
          webAnalyticsUserActivityProcessor.process(resultList, contextData);
        }
        source.updateStats(resultList.getData().size(), 0);
      } catch (SearchIndexException ex) {
        source.updateStats(
            ex.getIndexingError().getSuccessCount(), ex.getIndexingError().getFailedCount());
        error =
            Optional.of(
                String.format("Failed processing events from %s: %s", source.getName(), ex));
        workflowStats.addFailure(error.get());
      } finally {
        updateWorkflowStats(source.getName(), source.getStats());
      }
    }
    return error;
  }

  private Optional<String> processEntityViewData(
      Map<String, WebAnalyticEntityViewReportData> entityViewReportData,
      Map<String, Object> contextData) {
    Optional<String> error = Optional.empty();

    contextData.put(
        REPORT_DATA_TYPE_KEY, ReportData.ReportDataType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA);
    CreateReportDataProcessor createReportDataProcessor =
        new CreateReportDataProcessor(
            entityViewReportData.values().size(),
            "[WebAnalyticsWorkflow] Entity View Report Data Processor");

    Optional<List<ReportData>> entityViewReportDataList = Optional.empty();

    // Process EntityView ReportData
    try {
      entityViewReportDataList =
          Optional.of(
              createReportDataProcessor.process(
                  entityViewReportData.values().stream().toList(), contextData));
    } catch (SearchIndexException ex) {
      error = Optional.of(String.format("Failed Processing Entity View Data: %s", ex.getMessage()));
      workflowStats.addFailure(error.get());
    } finally {
      updateWorkflowStats(
          createReportDataProcessor.getName(), createReportDataProcessor.getStats());
    }

    // Sink EntityView ReportData
    if (entityViewReportDataList.isPresent()) {
      ReportDataSink reportDataSink =
          new ReportDataSink(
              entityViewReportDataList.get().size(),
              "[WebAnalyticsWorkflow] Entity View Report Data Sink");

      try {
        reportDataSink.write(entityViewReportDataList.get(), contextData);
      } catch (SearchIndexException ex) {
        error = Optional.of(String.format("Failed Sinking Entity View Data: %s", ex.getMessage()));
        workflowStats.addFailure(error.get());
      } finally {
        updateWorkflowStats(reportDataSink.getName(), reportDataSink.getStats());
      }
    }

    return error;
  }

  private Optional<String> processUserActivityData(
      Map<UUID, UserActivityData> userActivityData,
      Map<UUID, WebAnalyticUserActivityReportData> userActivityReportData,
      Map<String, Object> contextData) {
    Optional<String> error = Optional.empty();

    contextData.put(
        REPORT_DATA_TYPE_KEY, ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA);
    WebAnalyticsUserActivityAggregator webAnalyticsUserActivityAggregator =
        new WebAnalyticsUserActivityAggregator(userActivityData.size());

    // Aggregate UserActivity Data
    try {
      webAnalyticsUserActivityAggregator.process(userActivityData, contextData);
    } catch (SearchIndexException ex) {
      error =
          Optional.of(String.format("Failed Aggregating User Activity Data: %s", ex.getMessage()));
      workflowStats.addFailure(error.get());
    } finally {
      updateWorkflowStats(
          webAnalyticsUserActivityAggregator.getName(),
          webAnalyticsUserActivityAggregator.getStats());
    }

    CreateReportDataProcessor createReportdataProcessor =
        new CreateReportDataProcessor(
            userActivityReportData.values().size(),
            "[WebAnalyticsWorkflow] User Activity Report Data Processor");
    Optional<List<ReportData>> userActivityReportDataList = Optional.empty();

    // Process UserActivity ReportData
    try {
      userActivityReportDataList =
          Optional.of(
              createReportdataProcessor.process(
                  userActivityReportData.values().stream().toList(), contextData));

    } catch (SearchIndexException ex) {
      error =
          Optional.of(
              String.format("Failed Processing User Activity Report Data: %s", ex.getMessage()));
      workflowStats.addFailure(error.get());
    } finally {
      updateWorkflowStats(
          createReportdataProcessor.getName(), createReportdataProcessor.getStats());
    }

    if (userActivityReportDataList.isPresent()) {
      ReportDataSink reportDataSink =
          new ReportDataSink(
              userActivityReportDataList.get().size(),
              "[WebAnalyticsWorkflow] User Activity Report Data Sink");
      try {
        reportDataSink.write(userActivityReportDataList.get(), contextData);
      } catch (SearchIndexException ex) {
        error =
            Optional.of(
                String.format("Failed Sinking User Activity Report Data: %s", ex.getMessage()));
        workflowStats.addFailure(error.get());
      } finally {
        updateWorkflowStats(reportDataSink.getName(), reportDataSink.getStats());
      }
    }

    return error;
  }

  private void deleteReportDataRecordsAtDate(
      Long timestamp, ReportData.ReportDataType reportDataType) {
    String timestampString = TimestampUtils.timestampToString(timestamp, "yyyy-MM-dd");
    ((ReportDataRepository) Entity.getEntityTimeSeriesRepository(Entity.ENTITY_REPORT_DATA))
        .deleteReportDataAtDate(reportDataType, timestampString);
  }

  private void pruneWebAnalyticEvents() {
    for (WebAnalyticEventType eventType : WebAnalyticEventType.values()) {
      ((WebAnalyticEventRepository) Entity.getEntityRepository(Entity.WEB_ANALYTIC_EVENT))
          .deleteWebAnalyticEventData(
              eventType,
              TimestampUtils.subtractDays(endTimestamp, WEB_ANALYTIC_EVENTS_RETENTION_DAYS));
    }
  }

  private void updateWorkflowStats(String stepName, StepStats newStepStats) {
    workflowStats.updateWorkflowStepStats(stepName, newStepStats);

    int currentSuccess =
        workflowStats.getWorkflowStepStats().values().stream()
            .mapToInt(StepStats::getSuccessRecords)
            .sum();
    int currentFailed =
        workflowStats.getWorkflowStepStats().values().stream()
            .mapToInt(StepStats::getFailedRecords)
            .sum();

    workflowStats.updateWorkflowStats(currentSuccess, currentFailed);
  }
}
