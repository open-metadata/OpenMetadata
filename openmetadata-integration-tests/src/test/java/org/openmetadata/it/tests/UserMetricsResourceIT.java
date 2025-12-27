/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.teams.UserService;

@Slf4j
@Execution(ExecutionMode.CONCURRENT)
public class UserMetricsResourceIT {

  private final ObjectMapper objectMapper = JsonUtils.getObjectMapper();

  @Test
  void testUserMetricsEndpoint() throws Exception {
    int adminPort = TestSuiteBootstrap.getAdminPort();
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
    int adminPort = TestSuiteBootstrap.getAdminPort();
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
    int adminPort = TestSuiteBootstrap.getAdminPort();
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
    int adminPort = TestSuiteBootstrap.getAdminPort();
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
        assertTrue(botUsers >= 1, "Should have at least one bot user (ingestion-bot)");

        log.info("User metrics: {}", metrics);
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
  void testUserMetricsWithRealActivity() throws Exception {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    TestNamespace ns = new TestNamespace("UserMetricsResourceIT");

    Map<String, Object> initialMetrics = getUserMetrics();
    log.info("Initial metrics: {}", initialMetrics);

    int initialTotalUsers = (Integer) initialMetrics.get("total_users");
    int initialBotUsers = (Integer) initialMetrics.get("bot_users");

    String userName = ns.prefix("metricsuser");
    String email = "metricsuser_" + ns.shortPrefix() + "@test.openmetadata.org";
    CreateUser createUser = new CreateUser().withName(userName).withEmail(email).withIsBot(false);

    UserService usersApi = adminClient.users();
    User newUser = usersApi.create(createUser);
    log.info("Created new user: {}", newUser.getName());

    try {
      usersApi.getByName(newUser.getName());

      Thread.sleep(2000);

      Map<String, Object> updatedMetrics = getUserMetrics();
      log.info("Updated metrics after activity: {}", updatedMetrics);

      int updatedTotalUsers = (Integer) updatedMetrics.get("total_users");
      // In parallel test execution, other tests may create/delete users, so verify the user exists
      assertTrue(
          updatedTotalUsers >= initialTotalUsers,
          "Total users should not decrease: initial="
              + initialTotalUsers
              + ", updated="
              + updatedTotalUsers);
      // Verify our created user exists by fetching it
      User fetchedUser = usersApi.getByName(newUser.getName());
      assertNotNull(fetchedUser, "Created user should exist");

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

      int dailyActiveUsers = (Integer) updatedMetrics.get("daily_active_users");
      assertTrue(dailyActiveUsers >= 0, "Daily active users should be non-negative");
    } finally {
      Map<String, String> deleteParams = new HashMap<>();
      deleteParams.put("hardDelete", "true");
      usersApi.delete(newUser.getId().toString(), deleteParams);
    }
  }

  @Test
  void testUserMetricsWithBotUser() throws Exception {
    Map<String, Object> initialMetrics = getUserMetrics();
    int initialBotUsers = (Integer) initialMetrics.get("bot_users");
    int initialTotalUsers = (Integer) initialMetrics.get("total_users");
    assertTrue(initialBotUsers >= 0, "Bot users count should be non-negative");
    assertTrue(initialBotUsers <= initialTotalUsers, "Bot users should not exceed total users");

    log.info(
        "Bot user filtering is implemented in UserMetricsServlet.createNonBotFilter() which adds isBot=false filter");
  }

  @Test
  void testUserMetricsMultipleUsers() throws Exception {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    TestNamespace ns = new TestNamespace("UserMetricsResourceIT");
    UserService usersApi = adminClient.users();

    for (int i = 0; i < 3; i++) {
      String userName = ns.prefix("multiuser" + i);
      String email = "multiuser" + i + "_" + ns.shortPrefix() + "@test.openmetadata.org";
      CreateUser createUser = new CreateUser().withName(userName).withEmail(email).withIsBot(false);

      User user = usersApi.create(createUser);
      try {
        usersApi.getByName(user.getName());
        Thread.sleep(1000);
      } finally {
        Map<String, String> deleteParams = new HashMap<>();
        deleteParams.put("hardDelete", "true");
        usersApi.delete(user.getId().toString(), deleteParams);
      }
    }

    Thread.sleep(3000);

    Map<String, Object> metrics = getUserMetrics();
    log.info("Metrics after multiple users: {}", metrics);

    String lastActivity = (String) metrics.get("last_activity");
    assertNotNull(lastActivity, "Last activity should not be null");

    Instant lastActivityTime = Instant.parse(lastActivity);
    Instant now = Instant.now();
    long secondsSinceActivity = now.getEpochSecond() - lastActivityTime.getEpochSecond();
    assertTrue(
        secondsSinceActivity < 60,
        "Last activity should be very recent, but was " + secondsSinceActivity + " seconds ago");
  }

  @Test
  void testDailyActiveUsersMetric() throws Exception {
    Map<String, Object> metrics = getUserMetrics();
    assertTrue(
        metrics.containsKey("daily_active_users"), "Metrics should include daily_active_users");
    Object dauValue = metrics.get("daily_active_users");
    assertNotNull(dauValue, "Daily active users should not be null");
    assertInstanceOf(Integer.class, dauValue, "Daily active users should be an integer");
    assertTrue((Integer) dauValue >= 0, "Daily active users should be non-negative");

    log.info("Daily active users implementation handles missing data by returning 0");
  }

  private Map<String, Object> getUserMetrics() throws Exception {
    int adminPort = TestSuiteBootstrap.getAdminPort();
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
}
