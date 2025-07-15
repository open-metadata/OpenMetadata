package org.openmetadata.service.monitoring;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.io.PrintWriter;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.dataInsight.type.DailyActiveUsers;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.DataReportIndex;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.ResultList;

/**
 * Servlet that exposes user metrics on the admin port.
 * Provides metrics including:
 * - daily_active_users: Number of daily active users (from analytics if available)
 * - last_activity: Last non-bot user activity timestamp
 * - total_users: Total number of users
 * - bot_users: Number of bot users
 */
@Slf4j
public class UserMetricsServlet extends HttpServlet {
  private static final String CONTENT_TYPE = "application/json; charset=utf-8";
  private final ObjectMapper objectMapper = JsonUtils.getObjectMapper();
  private transient UserRepository userRepository;
  private transient SearchRepository searchRepository;

  @Override
  public void init() {
    userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    searchRepository = Entity.getSearchRepository();
  }

  @Override
  protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
    resp.setStatus(HttpServletResponse.SC_OK);
    resp.setContentType(CONTENT_TYPE);

    try {
      Map<String, Object> metrics = collectUserMetrics();
      writeJsonResponse(resp, metrics);
    } catch (Exception e) {
      LOG.error("Error collecting user metrics", e);
      handleErrorResponse(resp);
    }
  }

  private void writeJsonResponse(HttpServletResponse resp, Object data) throws IOException {
    try {
      String json = objectMapper.writeValueAsString(data);
      PrintWriter writer = resp.getWriter();
      writer.write(json);
      writer.flush();
    } catch (JsonProcessingException e) {
      LOG.error("Error serializing response to JSON", e);
      throw new IOException("Failed to serialize response", e);
    }
  }

  private void handleErrorResponse(HttpServletResponse resp) throws IOException {
    resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
    Map<String, String> error = Map.of("error", "Failed to collect user metrics");
    writeJsonResponse(resp, error);
  }

  private Map<String, Object> collectUserMetrics() {
    Map<String, Object> metrics = new HashMap<>();
    ListFilter filter = new ListFilter(null);
    int totalUsers = userRepository.getDao().listCount(filter);
    metrics.put("total_users", totalUsers);

    ListFilter botFilter = new ListFilter(null);
    botFilter.addQueryParam("isBot", "true");
    int botUsers = userRepository.getDao().listCount(botFilter);
    metrics.put("bot_users", botUsers);

    Integer dailyActiveUsers = getDailyActiveUsers();
    metrics.put("daily_active_users", dailyActiveUsers != null ? dailyActiveUsers : 0);

    String lastActivity = getLastUserActivity();
    metrics.put("last_activity", lastActivity);

    return metrics;
  }

  private Integer getDailyActiveUsers() {
    try {
      Response response = fetchDailyActiveUsersResponse();
      return extractActiveUsersCount(response);
    } catch (Exception e) {
      LOG.warn("Could not fetch daily active users from analytics", e);
      return 0;
    }
  }

  private Response fetchDailyActiveUsersResponse() throws IOException {
    long endTs = System.currentTimeMillis();
    long startTs = endTs - (24 * 60 * 60 * 1000); // 24 hours ago

    return searchRepository.listDataInsightChartResult(
        startTs,
        endTs,
        null,
        null,
        DataInsightChartResult.DataInsightChartType.DAILY_ACTIVE_USERS,
        1,
        0,
        null,
        DataReportIndex.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA_INDEX.value());
  }

  private Integer extractActiveUsersCount(Response response) {
    if (!isValidResponse(response)) {
      LOG.debug("No daily active users data found for the last 24 hours");
      return 0;
    }

    Object entity = response.getEntity();

    // The API might return either DataInsightChartResult or ResultList directly
    if (entity instanceof DataInsightChartResult) {
      DataInsightChartResult chartResult = (DataInsightChartResult) entity;
      if (!hasValidData(chartResult)) {
        return 0;
      }
      return findMaxActiveUsers(chartResult.getData());
    } else if (entity instanceof ResultList) {
      @SuppressWarnings("unchecked")
      ResultList<Object> resultList = (ResultList<Object>) entity;
      if (resultList.getData() == null || resultList.getData().isEmpty()) {
        return 0;
      }
      return findMaxActiveUsers(resultList.getData());
    }

    LOG.debug(
        "Unexpected response type from daily active users API: {}", entity.getClass().getName());
    return 0;
  }

  private boolean isValidResponse(Response response) {
    return response != null && response.getStatus() == 200 && response.getEntity() != null;
  }

  private boolean hasValidData(DataInsightChartResult chartResult) {
    return chartResult != null && chartResult.getData() != null && !chartResult.getData().isEmpty();
  }

  private Integer findMaxActiveUsers(List<Object> dataList) {
    int maxActiveUsers = 0;
    for (Object obj : dataList) {
      Integer activeUsers = extractActiveUsersFromObject(obj);
      if (activeUsers != null) {
        maxActiveUsers = Math.max(maxActiveUsers, activeUsers);
      }
    }
    return maxActiveUsers;
  }

  private Integer extractActiveUsersFromObject(Object obj) {
    if (obj instanceof DailyActiveUsers dailyActiveUsers) {
      return dailyActiveUsers.getActiveUsers();
    } else if (obj instanceof Map) {
      return extractActiveUsersFromMap((Map<?, ?>) obj);
    }
    return null;
  }

  @SuppressWarnings("unchecked")
  private Integer extractActiveUsersFromMap(Map<?, ?> map) {
    Map<String, Object> dauMap = (Map<String, Object>) map;
    Object activeUsersObj = dauMap.get("activeUsers");
    if (activeUsersObj instanceof Number number) {
      return number.intValue();
    }
    return null;
  }

  private String getLastUserActivity() {
    try {
      ListFilter nonBotFilter = createNonBotFilter();
      Long lastActivityTime = findMostRecentActivity(nonBotFilter, 1);
      if (lastActivityTime != null) {
        return Instant.ofEpochMilli(lastActivityTime).toString();
      }

      lastActivityTime = findMostRecentActivity(nonBotFilter, 100);
      if (lastActivityTime != null) {
        return Instant.ofEpochMilli(lastActivityTime).toString();
      }
      return null;
    } catch (Exception e) {
      LOG.error("Error getting last user activity", e);
      return null;
    }
  }

  private ListFilter createNonBotFilter() {
    ListFilter filter = new ListFilter(null);
    filter.addQueryParam("isBot", "false");
    return filter;
  }

  private Long findMostRecentActivity(ListFilter filter, int limit) {
    List<User> users =
        userRepository
            .listAfter(null, EntityUtil.Fields.EMPTY_FIELDS, filter, limit, null)
            .getData();
    long maxActivityTime = 0;

    for (User user : users) {
      Long activityTime = getUserActivityTime(user);
      if (activityTime != null && activityTime > maxActivityTime) {
        maxActivityTime = activityTime;
      }
    }

    return maxActivityTime > 0 ? maxActivityTime : null;
  }

  private Long getUserActivityTime(User user) {
    if (user.getLastActivityTime() != null) {
      return user.getLastActivityTime();
    }
    return user.getUpdatedAt();
  }
}
