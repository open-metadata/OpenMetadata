package org.openmetadata.service.monitoring;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.util.EntityUtil;

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

  @Override
  public void init() {
    userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
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
      long twentyFourHoursAgo = System.currentTimeMillis() - (24 * 60 * 60 * 1000);
      return ((CollectionDAO.UserDAO) userRepository.getDao())
          .countDailyActiveUsers(twentyFourHoursAgo);
    } catch (Exception e) {
      LOG.warn("Could not fetch daily active users from database", e);
      return 0;
    }
  }

  private String getLastUserActivity() {
    try {
      ListFilter nonBotFilter = createNonBotFilter();
      LOG.trace("Getting last user activity with filter: {}", nonBotFilter);

      Long lastActivityTime = findMostRecentActivity(nonBotFilter, 1);
      LOG.trace("First attempt (limit 1) returned: {}", lastActivityTime);
      if (lastActivityTime != null) {
        return Instant.ofEpochMilli(lastActivityTime).toString();
      }

      lastActivityTime = findMostRecentActivity(nonBotFilter, 100);
      LOG.trace("Second attempt (limit 100) returned: {}", lastActivityTime);
      if (lastActivityTime != null) {
        return Instant.ofEpochMilli(lastActivityTime).toString();
      }
      LOG.warn("No last activity time found for any user");
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
    // Use the efficient DAO method that queries directly for the max lastActivityTime
    try {
      Long maxActivityTime =
          ((CollectionDAO.UserDAO) userRepository.getDao()).getMaxLastActivityTime();

      if (maxActivityTime != null) {
        LOG.trace("Max activity time from database: {}", maxActivityTime);
        return maxActivityTime;
      }

      // If no lastActivityTime is found, fall back to checking updatedAt
      LOG.debug("No lastActivityTime found, checking updatedAt");
    } catch (Exception e) {
      LOG.error("Error getting max activity time from database", e);
    }

    // Fallback: Get users and check their updatedAt times
    EntityUtil.Fields fields = new EntityUtil.Fields(Set.of("lastActivityTime", "updatedAt"));
    List<User> users = userRepository.listAfter(null, fields, filter, limit, null).getData();

    long maxActivityTime = 0;
    for (User user : users) {
      Long activityTime = getUserActivityTime(user);
      if (activityTime != null && activityTime > maxActivityTime) {
        maxActivityTime = activityTime;
      }
    }

    LOG.trace("Max activity time from fallback: {}", maxActivityTime);
    return maxActivityTime > 0 ? maxActivityTime : null;
  }

  private Long getUserActivityTime(User user) {
    if (user.getLastActivityTime() != null) {
      return user.getLastActivityTime();
    }
    return user.getUpdatedAt();
  }
}
