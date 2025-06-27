package org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.processors;

import static org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.WebAnalyticsWorkflow.USER_ACTIVITY_DATA_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.internal.util.ExceptionUtils;
import org.openmetadata.schema.analytics.WebAnalyticEventData;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.WebAnalyticsWorkflow;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.workflows.interfaces.Processor;

@Slf4j
public class WebAnalyticsUserActivityProcessor
    implements Processor<
        Map<UUID, WebAnalyticsWorkflow.UserActivityData>, ResultList<WebAnalyticEventData>> {
  private final StepStats stats = new StepStats();

  public WebAnalyticsUserActivityProcessor(int total) {
    this.stats.withTotalRecords(total).withSuccessRecords(0).withFailedRecords(0);
  }

  @Override
  public Map<UUID, WebAnalyticsWorkflow.UserActivityData> process(
      ResultList<WebAnalyticEventData> input, Map<String, Object> contextData)
      throws SearchIndexException {
    // NOTE: We don't care about the return since we are editing inplace
    try {
      for (WebAnalyticEventData event : input.getData()) {
        processEvent(event, contextData);
      }
      updateStats(input.getData().size(), 0);
    } catch (Exception e) {
      IndexingError error =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.PROCESSOR)
              .withSubmittedCount(input.getData().size())
              .withFailedCount(input.getData().size())
              .withSuccessCount(0)
              .withMessage(
                  String.format(
                      "WebAnalytics User Activity Processor Encounter Failure: %s", e.getMessage()))
              .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
      LOG.debug(
          "[WebAnalyticsUserActivityProcessor] Failed. Details: {}", JsonUtils.pojoToJson(error));
      updateStats(0, input.getData().size());
      throw new SearchIndexException(error);
    }
    return (HashMap<UUID, WebAnalyticsWorkflow.UserActivityData>)
        contextData.get(USER_ACTIVITY_DATA_KEY);
  }

  private void processEvent(WebAnalyticEventData event, Map<String, Object> contextData) {
    Map<UUID, WebAnalyticsWorkflow.UserActivityData> userActivityDataMap =
        (HashMap<UUID, WebAnalyticsWorkflow.UserActivityData>)
            contextData.get(USER_ACTIVITY_DATA_KEY);
    Map<String, Object> eventData = JsonUtils.getMap(event.getEventData());

    UUID userId = UUID.fromString((String) eventData.get("userId"));
    UUID sessionId = UUID.fromString((String) eventData.get("sessionId"));
    Long timestamp = event.getTimestamp();

    if (!userActivityDataMap.containsKey(userId)) {
      // Fetch user Info
      try {
        User userDetails =
            (User)
                Entity.getEntityRepository(Entity.USER)
                    .get(null, userId, new EntityUtil.Fields(Set.of("teams")), Include.ALL, false);

        Map<UUID, List<Long>> sessions = new HashMap<>();
        sessions.put(sessionId, List.of(timestamp));

        String team = null;
        if (!userDetails.getTeams().isEmpty()) {
          team = userDetails.getTeams().get(0).getName();
        }

        WebAnalyticsWorkflow.UserActivityData userActivityData =
            new WebAnalyticsWorkflow.UserActivityData(
                userDetails.getName(), userId, team, sessions, 1, 1, timestamp);
        userActivityDataMap.put(userId, userActivityData);
      } catch (EntityNotFoundException ex) {
        LOG.debug(
            String.format(
                "Skipping user with id '%s' because it was not found in the database.", userId));
      }
    } else {
      WebAnalyticsWorkflow.UserActivityData userActivityData = userActivityDataMap.get(userId);
      Map<UUID, List<Long>> sessions = userActivityData.sessions();
      int totalSessions = userActivityData.totalSessions();
      int totalPageView = userActivityData.totalPageView() + 1;
      Long lastSession = userActivityData.lastSession();

      if (sessions.containsKey(sessionId)) {
        List<Long> sessionList = new ArrayList<>(sessions.get(sessionId));
        sessionList.add(timestamp);
        sessions.put(sessionId, sessionList);
      } else {
        sessions.put(sessionId, List.of(timestamp));
        totalSessions += 1;
      }

      if (timestamp > lastSession) {
        lastSession = timestamp;
      }

      WebAnalyticsWorkflow.UserActivityData newUserActivityData =
          new WebAnalyticsWorkflow.UserActivityData(
              userActivityData.userName(),
              userId,
              userActivityData.team(),
              sessions,
              totalPageView,
              totalSessions,
              lastSession);

      userActivityDataMap.put(userId, newUserActivityData);
    }
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
