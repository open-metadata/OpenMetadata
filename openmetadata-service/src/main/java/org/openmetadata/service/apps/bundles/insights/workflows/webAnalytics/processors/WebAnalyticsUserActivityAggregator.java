package org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.processors;

import static org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.WebAnalyticsWorkflow.USER_ACTIVITY_REPORT_DATA_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.internal.util.ExceptionUtils;
import org.openmetadata.schema.analytics.WebAnalyticUserActivityReportData;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.WebAnalyticsWorkflow;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.workflows.interfaces.Processor;

@Slf4j
public class WebAnalyticsUserActivityAggregator
    implements Processor<
        Map<UUID, WebAnalyticUserActivityReportData>,
        Map<UUID, WebAnalyticsWorkflow.UserActivityData>> {
  @Getter private final String name = "[WebAnalyticsWorkflow] User Activity Aggregator";
  private final StepStats stats = new StepStats();

  public WebAnalyticsUserActivityAggregator(int total) {
    this.stats.withTotalRecords(total).withSuccessRecords(0).withFailedRecords(0);
  }

  @Override
  public Map<UUID, WebAnalyticUserActivityReportData> process(
      Map<UUID, WebAnalyticsWorkflow.UserActivityData> input, Map<String, Object> contextData)
      throws SearchIndexException {
    // NOTE: We don't care about the return since we are editing inplace
    try {
      for (WebAnalyticsWorkflow.UserActivityData userActivitydata : input.values()) {
        processEvent(userActivitydata, contextData);
      }
      updateStats(input.size(), 0);
    } catch (Exception e) {
      IndexingError error =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.PROCESSOR)
              .withSubmittedCount(input.size())
              .withFailedCount(input.size())
              .withSuccessCount(0)
              .withMessage(
                  String.format(
                      "Web Analytics User Activity Aggregator Encounter Failure: %s",
                      e.getMessage()))
              .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
      LOG.debug(
          "[WebAnalyticsUserActivityAggregator] Failed. Details: {}", JsonUtils.pojoToJson(error));
      updateStats(0, input.size());
      throw new SearchIndexException(error);
    }
    return (HashMap<UUID, WebAnalyticUserActivityReportData>)
        contextData.get(USER_ACTIVITY_REPORT_DATA_KEY);
  }

  private void processEvent(
      WebAnalyticsWorkflow.UserActivityData userActivityData, Map<String, Object> contextData) {
    Map<UUID, WebAnalyticUserActivityReportData> userActivityReportData =
        (HashMap<UUID, WebAnalyticUserActivityReportData>)
            contextData.get(USER_ACTIVITY_REPORT_DATA_KEY);
    int totalSessionDurationSeconds = 0;

    for (List<Long> timestampList : userActivityData.sessions().values()) {
      totalSessionDurationSeconds +=
          (Collections.max(timestampList) - Collections.min(timestampList)) / 1000;
    }

    WebAnalyticUserActivityReportData data =
        new WebAnalyticUserActivityReportData()
            .withUserId(userActivityData.userId())
            .withUserName(userActivityData.userName())
            .withTeam(userActivityData.team())
            .withTotalSessions(userActivityData.totalSessions())
            .withTotalSessionDuration(totalSessionDurationSeconds)
            .withTotalPageView(userActivityData.totalPageView())
            .withLastSession(userActivityData.lastSession());

    userActivityReportData.put(userActivityData.userId(), data);
  }

  @Override
  public void updateStats(int currentSuccess, int currentFailed) {
    getUpdatedStats(stats, currentSuccess, currentFailed);
  }

  @Override
  public StepStats getStats() {
    return stats;
  }
}
