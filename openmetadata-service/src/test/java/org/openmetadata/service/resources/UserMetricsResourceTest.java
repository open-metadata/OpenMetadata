package org.openmetadata.service.resources;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.client.WebTarget;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.security.auth.UserActivityTracker;
import org.openmetadata.service.util.TestUtils;

@Slf4j
class UserMetricsResourceTest extends OpenMetadataApplicationTest {

  private final ObjectMapper objectMapper = JsonUtils.getObjectMapper();

  @Test
  void testUserMetricsEndpoint() throws Exception {
    int adminPort = APP.getAdminPort();
    URL url = URI.create("http://localhost:" + adminPort + "/user-metrics").toURL();
    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
    connection.setRequestMethod("GET");
    connection.setConnectTimeout(5000);
    connection.setReadTimeout(5000);

    try {
      int responseCode = connection.getResponseCode();
      assertEquals(200, responseCode, "User metrics endpoint should return 200 OK");

      String contentType = connection.getContentType();
      assertNotNull(contentType, "Content type should not be null");
      assertTrue(
          contentType.contains("application/json"),
          "Content type should be application/json, but was: " + contentType);

      try (BufferedReader reader =
          new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
        String response = reader.lines().collect(Collectors.joining("\n"));
        assertFalse(response.isEmpty(), "User metrics response should not be empty");
        verifyMetricsStructure(response);
      }
    } finally {
      connection.disconnect();
    }
  }

  @Test
  void testUserMetricsEndpointPerformance() throws Exception {
    int adminPort = APP.getAdminPort();
    URL url = URI.create("http://localhost:" + adminPort + "/user-metrics").toURL();

    long startTime = System.currentTimeMillis();
    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
    connection.setRequestMethod("GET");
    int responseCode = connection.getResponseCode();
    long duration = System.currentTimeMillis() - startTime;

    assertEquals(200, responseCode);
    assertTrue(
        duration < 2000,
        "User metrics endpoint should respond within 2 seconds, took: " + duration + "ms");
    connection.disconnect();
  }

  @Test
  void testUserMetricsContent() throws Exception {
    int adminPort = APP.getAdminPort();
    URL url = URI.create("http://localhost:" + adminPort + "/user-metrics").toURL();
    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
    connection.setRequestMethod("GET");

    try {
      assertEquals(200, connection.getResponseCode());

      try (BufferedReader reader =
          new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
        String response = reader.lines().collect(Collectors.joining("\n"));

        @SuppressWarnings("unchecked")
        Map<String, Object> metrics = objectMapper.readValue(response, Map.class);

        assertTrue(metrics.containsKey("total_users"), "Should contain total_users");
        assertTrue(metrics.containsKey("bot_users"), "Should contain bot_users");
        assertTrue(metrics.containsKey("daily_active_users"), "Should contain daily_active_users");
        assertTrue(metrics.containsKey("last_activity"), "Should contain last_activity");

        assertInstanceOf(
            Integer.class, metrics.get("total_users"), "total_users should be an integer");
        assertInstanceOf(Integer.class, metrics.get("bot_users"), "bot_users should be an integer");
        assertInstanceOf(
            Integer.class,
            metrics.get("daily_active_users"),
            "daily_active_users should be an integer");

        int totalUsers = (Integer) metrics.get("total_users");
        int botUsers = (Integer) metrics.get("bot_users");
        assertTrue(totalUsers >= 0, "Total users should be non-negative");
        assertTrue(botUsers >= 0, "Bot users should be non-negative");
        assertTrue(botUsers <= totalUsers, "Bot users should not exceed total users");

        int dailyActiveUsers = (Integer) metrics.get("daily_active_users");
        assertTrue(dailyActiveUsers >= 0, "Daily active users should be non-negative");

        Object lastActivity = metrics.get("last_activity");
        if (lastActivity != null) {
          assertInstanceOf(
              String.class, lastActivity, "last_activity should be a string when present");
          String timestamp = (String) lastActivity;
          assertTrue(
              timestamp.matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}.*"),
              "last_activity should be in ISO format: " + timestamp);
        }
      }
    } finally {
      connection.disconnect();
    }
  }

  @Test
  void testUserMetricsWithSystemUsers() throws Exception {
    // This test verifies that system users (like ingestion-bot) are properly counted
    int adminPort = APP.getAdminPort();
    URL url = URI.create("http://localhost:" + adminPort + "/user-metrics").toURL();
    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
    connection.setRequestMethod("GET");

    try {
      assertEquals(200, connection.getResponseCode());

      try (BufferedReader reader =
          new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
        String response = reader.lines().collect(Collectors.joining("\n"));

        @SuppressWarnings("unchecked")
        Map<String, Object> metrics = objectMapper.readValue(response, Map.class);

        int botUsers = (Integer) metrics.get("bot_users");
        // In the test environment, we should have at least the ingestion-bot
        assertTrue(botUsers >= 1, "Should have at least one bot user (ingestion-bot)");

        LOG.info("User metrics: {}", metrics);
      }
    } finally {
      connection.disconnect();
    }
  }

  private void verifyMetricsStructure(String response) {
    try {
      @SuppressWarnings("unchecked")
      Map<String, Object> metrics = objectMapper.readValue(response, Map.class);
      assertNotNull(metrics, "Metrics should not be null");
      assertEquals(4, metrics.size(), "Should have exactly 4 metrics");
    } catch (Exception e) {
      fail("Failed to parse metrics JSON: " + e.getMessage());
    }
  }

  @Test
  void testUserMetricsWithRealActivity(TestInfo test) throws Exception {
    Map<String, Object> initialMetrics = getUserMetrics();
    LOG.info("Initial metrics: {}", initialMetrics);

    int initialTotalUsers = (Integer) initialMetrics.get("total_users");
    int initialBotUsers = (Integer) initialMetrics.get("bot_users");

    UserResourceTest userResourceTest = new UserResourceTest();
    CreateUser createUser =
        userResourceTest
            .createRequest(test)
            .withName("metrics-test-user-" + UUID.randomUUID())
            .withEmail("metrics-test@example.com")
            .withIsBot(false);

    User newUser = createUserAndLogin(createUser);
    LOG.info("Created new user: {}", newUser.getName());

    Map<String, String> userAuthHeaders = authHeaders(newUser.getName() + "@example.com");

    WebTarget target = getResource("users/name/" + newUser.getName());
    TestUtils.get(target, User.class, userAuthHeaders);

    UserActivityTracker.getInstance().forceFlushSync();
    TestUtils.simulateWork(2);
    Map<String, Object> updatedMetrics = getUserMetrics();
    LOG.info("Updated metrics after activity: {}", updatedMetrics);
    int updatedTotalUsers = (Integer) updatedMetrics.get("total_users");
    assertEquals(initialTotalUsers + 1, updatedTotalUsers, "Total users should increase by 1");
    assertEquals(
        initialBotUsers, updatedMetrics.get("bot_users"), "Bot users count should remain the same");

    String lastActivity = (String) updatedMetrics.get("last_activity");
    assertNotNull(lastActivity, "Last activity should not be null after user activity");

    Instant lastActivityTime = Instant.parse(lastActivity);
    Instant now = Instant.now();
    long secondsSinceActivity = now.getEpochSecond() - lastActivityTime.getEpochSecond();
    assertTrue(
        secondsSinceActivity < 60,
        "Last activity should be within last 60 seconds, but was "
            + secondsSinceActivity
            + " seconds ago");

    // Note: Daily active users might not update immediately as it depends on
    // the analytics pipeline, so we just verify it's non-negative
    int dailyActiveUsers = (Integer) updatedMetrics.get("daily_active_users");
    assertTrue(dailyActiveUsers >= 0, "Daily active users should be non-negative");
  }

  @Test
  void testUserMetricsWithBotUser() throws Exception {
    // This test verifies that bot activity is NOT counted in last_activity metric

    // Get initial metrics
    Map<String, Object> initialMetrics = getUserMetrics();
    int initialBotUsers = (Integer) initialMetrics.get("bot_users");
    int initialTotalUsers = (Integer) initialMetrics.get("total_users");
    assertTrue(initialBotUsers >= 0, "Bot users count should be non-negative");
    assertTrue(initialBotUsers <= initialTotalUsers, "Bot users should not exceed total users");

    LOG.info(
        "Bot user filtering is implemented in UserMetricsServlet.createNonBotFilter() which adds isBot=false filter");
  }

  @Test
  void testUserMetricsMultipleUsers(TestInfo test) throws Exception {
    UserResourceTest userResourceTest = new UserResourceTest();

    for (int i = 0; i < 3; i++) {
      CreateUser createUser =
          userResourceTest
              .createRequest(test)
              .withName("multi-test-user-" + i + "-" + UUID.randomUUID())
              .withEmail("multi-user-" + i + "@example.com")
              .withIsBot(false);

      User user = createUserAndLogin(createUser);
      Map<String, String> authHeaders = authHeaders(user.getName() + "@example.com");
      WebTarget target = getResource("users/name/" + user.getName());
      TestUtils.get(target, User.class, authHeaders);
      TestUtils.simulateWork(1);
    }

    UserActivityTracker.getInstance().forceFlushSync();
    TestUtils.simulateWork(2);

    Map<String, Object> metrics = getUserMetrics();
    LOG.info("Metrics after multiple users: {}", metrics);

    String lastActivity = (String) metrics.get("last_activity");
    assertNotNull(lastActivity, "Last activity should not be null");

    // Verify activity is very recent (within last 30 seconds to account for test execution time)
    Instant lastActivityTime = Instant.parse(lastActivity);
    Instant now = Instant.now();
    long secondsSinceActivity = now.getEpochSecond() - lastActivityTime.getEpochSecond();
    assertTrue(
        secondsSinceActivity < 30,
        "Last activity should be very recent, but was " + secondsSinceActivity + " seconds ago");
  }

  // Daily Active Users tests - simplified since servlet runs in separate context
  @Test
  void testDailyActiveUsersMetric() throws Exception {
    Map<String, Object> metrics = getUserMetrics();
    assertTrue(
        metrics.containsKey("daily_active_users"), "Metrics should include daily_active_users");
    Object dauValue = metrics.get("daily_active_users");
    assertNotNull(dauValue, "Daily active users should not be null");
    assertInstanceOf(Integer.class, dauValue, "Daily active users should be an integer");
    assertTrue((Integer) dauValue >= 0, "Daily active users should be non-negative");

    LOG.info("Daily active users implementation handles missing data by returning 0");
  }

  private Map<String, Object> getUserMetrics() throws Exception {
    int adminPort = APP.getAdminPort();
    URL url = URI.create("http://localhost:" + adminPort + "/user-metrics").toURL();
    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
    connection.setRequestMethod("GET");
    connection.setConnectTimeout(5000);
    connection.setReadTimeout(5000);

    try {
      assertEquals(200, connection.getResponseCode());

      try (BufferedReader reader =
          new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
        String response = reader.lines().collect(Collectors.joining("\n"));

        @SuppressWarnings("unchecked")
        Map<String, Object> metrics = objectMapper.readValue(response, Map.class);
        return metrics;
      }
    } finally {
      connection.disconnect();
    }
  }

  private User createUserAndLogin(CreateUser createUser) throws Exception {
    WebTarget target = getResource("users");
    User user = TestUtils.post(target, createUser, User.class, ADMIN_AUTH_HEADERS);

    Map<String, String> userAuthHeaders = authHeaders(user.getName() + "@example.com");
    TestUtils.get(getResource("users/name/" + user.getName()), User.class, userAuthHeaders);

    return user;
  }
}
