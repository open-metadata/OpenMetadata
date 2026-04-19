package org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics;

import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.TIMESTAMP_KEY;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.analytics.WebAnalyticEntityViewReportData;
import org.openmetadata.schema.analytics.WebAnalyticEventData;
import org.openmetadata.schema.analytics.WebAnalyticUserActivityReportData;
import org.openmetadata.schema.analytics.type.WebAnalyticEventType;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.config.InsightsConfig;
import org.openmetadata.service.apps.bundles.insights.processors.CreateReportDataProcessor;
import org.openmetadata.service.apps.bundles.insights.sinks.ReportDataSink;
import org.openmetadata.service.apps.bundles.insights.stats.StepResult;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.apps.bundles.insights.workflow.AbstractInsightsWorkflow;
import org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.processors.WebAnalyticsEntityViewProcessor;
import org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.processors.WebAnalyticsUserActivityAggregator;
import org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.processors.WebAnalyticsUserActivityProcessor;
import org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.sources.PaginatedWebAnalyticEventDataSource;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.ReportDataRepository;
import org.openmetadata.service.jdbi3.WebAnalyticEventRepository;

@Slf4j
public class WebAnalyticsWorkflow extends AbstractInsightsWorkflow {

  private static final int WEB_ANALYTIC_EVENTS_RETENTION_DAYS = 7;

  public record UserActivityData(
      String userName,
      UUID userId,
      String team,
      Map<UUID, List<Long>> sessions,
      int totalPageView,
      int totalSessions,
      Long lastSession) {}

  public static final String USER_ACTIVITY_DATA_KEY = "userActivityData";
  public static final String USER_ACTIVITY_REPORT_DATA_KEY = "userActivityReportData";
  public static final String ENTITY_VIEW_REPORT_DATA_KEY = "entityViewReportData";

  private final InsightsConfig config;
  private final long startTimestamp;
  private final long endTimestamp;

  private final List<PaginatedWebAnalyticEventDataSource> sources = new ArrayList<>();
  private WebAnalyticsEntityViewProcessor webAnalyticsEntityViewProcessor;
  private WebAnalyticsUserActivityProcessor webAnalyticsUserActivityProcessor;

  public WebAnalyticsWorkflow(InsightsConfig config) {
    super("WebAnalyticsWorkflow");
    this.config = config;

    if (config.backfillPeriod().isPresent()) {
      this.endTimestamp = config.backfillPeriod().get().endTimestamp();
      this.startTimestamp = config.backfillPeriod().get().startTimestamp();
    } else {
      long ts = config.steadyStatePeriod().endTimestamp();
      this.endTimestamp = TimestampUtils.getEndOfDayTimestamp(TimestampUtils.subtractDays(ts, 1));
      this.startTimestamp = TimestampUtils.getStartOfDayTimestamp(endTimestamp);
    }
  }

  @Override
  protected boolean isEnabled() {
    return config.webAnalyticsConfig() != null
        && Boolean.TRUE.equals(config.webAnalyticsConfig().getEnabled());
  }

  @Override
  protected void initialize() {
    long pointer = this.endTimestamp;
    while (pointer > startTimestamp) {
      sources.add(
          new PaginatedWebAnalyticEventDataSource(
              config.batchSize(),
              TimestampUtils.getStartOfDayTimestamp(pointer),
              pointer));
      pointer = TimestampUtils.subtractDays(pointer, 1);
    }
    int total = sources.stream().mapToInt(PaginatedWebAnalyticEventDataSource::getTotalRecords).sum();
    webAnalyticsEntityViewProcessor = new WebAnalyticsEntityViewProcessor(total);
    webAnalyticsUserActivityProcessor = new WebAnalyticsUserActivityProcessor(total);
  }

  @Override
  protected void run() {
    int totalSuccess = 0;
    int totalFailed = 0;
    List<String> errors = new ArrayList<>();

    for (PaginatedWebAnalyticEventDataSource source : sources) {
      if (stopped) break;
      Map<UUID, UserActivityData> userActivityData = new HashMap<>();
      Map<UUID, WebAnalyticUserActivityReportData> userActivityReportData = new HashMap<>();
      Map<String, WebAnalyticEntityViewReportData> entityViewReportData = new HashMap<>();
      long referenceTimestamp = source.getStartTs();

      deleteReportDataRecordsAtDate(referenceTimestamp, ReportData.ReportDataType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA);
      deleteReportDataRecordsAtDate(referenceTimestamp, ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA);

      Map<String, Object> contextData = new HashMap<>();
      contextData.put(TIMESTAMP_KEY, referenceTimestamp);
      contextData.put(USER_ACTIVITY_DATA_KEY, userActivityData);
      contextData.put(USER_ACTIVITY_REPORT_DATA_KEY, userActivityReportData);
      contextData.put(ENTITY_VIEW_REPORT_DATA_KEY, entityViewReportData);

      Optional<String> eventsError = processEvents(source, contextData);
      if (eventsError.isPresent()) {
        totalFailed++;
        errors.add(eventsError.get());
        continue;
      }
      processEntityViewData(entityViewReportData, contextData).ifPresent(errors::add);
      processUserActivityData(userActivityData, userActivityReportData, contextData).ifPresent(errors::add);
      totalSuccess++;
    }

    pruneWebAnalyticEvents();
    stats().record(new StepResult("web-analytics", totalSuccess, totalFailed, errors));
  }

  private Optional<String> processEvents(
      PaginatedWebAnalyticEventDataSource source, Map<String, Object> contextData) {
    String cursor = null;
    while (true) {
      try {
        ResultList<WebAnalyticEventData> resultList = source.readNextKeyset(cursor);
        cursor = resultList.getPaging().getAfter();
        if (!resultList.getData().isEmpty()) {
          webAnalyticsEntityViewProcessor.process(resultList, contextData);
          webAnalyticsUserActivityProcessor.process(resultList, contextData);
        }
        source.updateStats(resultList.getData().size(), 0);
        if (cursor == null) break;
      } catch (SearchIndexException ex) {
        source.updateStats(ex.getIndexingError().getSuccessCount(), ex.getIndexingError().getFailedCount());
        return Optional.of(String.format("Failed processing events from %s: %s", source.getName(), ex));
      }
    }
    return Optional.empty();
  }

  private Optional<String> processEntityViewData(
      Map<String, WebAnalyticEntityViewReportData> entityViewReportData,
      Map<String, Object> contextData) {
    try {
      CreateReportDataProcessor processor =
          new CreateReportDataProcessor(entityViewReportData.size(),
              "[WebAnalyticsWorkflow] Entity View Report Data Processor",
              ReportData.ReportDataType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA);
      List<ReportData> reportData =
          processor.process(entityViewReportData.values().stream().toList(), contextData);
      new ReportDataSink(reportData.size(),
          "[WebAnalyticsWorkflow] Entity View Report Data Sink",
          ReportData.ReportDataType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA).write(reportData);
    } catch (SearchIndexException ex) {
      return Optional.of(String.format("Failed processing entity view data: %s", ex.getMessage()));
    }
    return Optional.empty();
  }

  private Optional<String> processUserActivityData(
      Map<UUID, UserActivityData> userActivityData,
      Map<UUID, WebAnalyticUserActivityReportData> userActivityReportData,
      Map<String, Object> contextData) {
    try {
      new WebAnalyticsUserActivityAggregator(userActivityData.size()).process(userActivityData, contextData);
      CreateReportDataProcessor processor =
          new CreateReportDataProcessor(userActivityReportData.size(),
              "[WebAnalyticsWorkflow] User Activity Report Data Processor",
              ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA);
      List<ReportData> reportData =
          processor.process(userActivityReportData.values().stream().toList(), contextData);
      new ReportDataSink(reportData.size(),
          "[WebAnalyticsWorkflow] User Activity Report Data Sink",
          ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA).write(reportData);
    } catch (SearchIndexException ex) {
      return Optional.of(String.format("Failed processing user activity data: %s", ex.getMessage()));
    }
    return Optional.empty();
  }

  private void deleteReportDataRecordsAtDate(long timestamp, ReportData.ReportDataType type) {
    String date = TimestampUtils.timestampToString(timestamp, "yyyy-MM-dd");
    ((ReportDataRepository) Entity.getEntityTimeSeriesRepository(Entity.ENTITY_REPORT_DATA))
        .deleteReportDataAtDate(type, date);
  }

  private void pruneWebAnalyticEvents() {
    for (WebAnalyticEventType eventType : WebAnalyticEventType.values()) {
      ((WebAnalyticEventRepository) Entity.getEntityRepository(Entity.WEB_ANALYTIC_EVENT))
          .deleteWebAnalyticEventData(
              eventType, TimestampUtils.subtractDays(endTimestamp, WEB_ANALYTIC_EVENTS_RETENTION_DAYS));
    }
  }
}
