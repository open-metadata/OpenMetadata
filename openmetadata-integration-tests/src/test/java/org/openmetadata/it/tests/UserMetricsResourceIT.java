package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Users;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Integration tests for User Metrics endpoint.
 *
 * <p>Tests user metrics collection and retrieval including: - Total users count - Bot users count
 * - Daily active users count - Last activity timestamp
 *
 * <p>Test isolation: Uses TestNamespace for unique entity naming Parallelization: Safe for
 * concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 *
 * <p>Migrated from: org.openmetadata.service.resources.UserMetricsResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class UserMetricsResourceIT {

  private static final ObjectMapper OBJECT_MAPPER = JsonUtils.getObjectMapper();
  private static final String USER_METRICS_PATH = "/admin/user-metrics";

  @Test
  void test_userMetricsEndpoint_200(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String responseJson =
        client.getHttpClient().executeForString(HttpMethod.GET, USER_METRICS_PATH, null);

    assertNotNull(responseJson, "User metrics response should not be null");
    assertFalse(responseJson.isEmpty(), "User metrics response should not be empty");

    TypeReference<Map<String, Object>> typeRef = new TypeReference<Map<String, Object>>() {};
    Map<String, Object> metrics = OBJECT_MAPPER.readValue(responseJson, typeRef);

    assertNotNull(metrics, "Metrics should not be null");
    assertTrue(metrics.containsKey("total_users"), "Should contain total_users");
    assertTrue(metrics.containsKey("bot_users"), "Should contain bot_users");
    assertTrue(metrics.containsKey("daily_active_users"), "Should contain daily_active_users");
    assertTrue(metrics.containsKey("last_activity"), "Should contain last_activity");
  }

  @Test
  void test_userMetricsContent_200(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> metrics = getUserMetrics(client);

    assertInstanceOf(Integer.class, metrics.get("total_users"), "total_users should be an integer");
    assertInstanceOf(Integer.class, metrics.get("bot_users"), "bot_users should be an integer");
    assertInstanceOf(
        Integer.class,
        metrics.get("daily_active_users"),
        "daily_active_users should be an integer");

    int totalUsers = (Integer) metrics.get("total_users");
    int botUsers = (Integer) metrics.get("bot_users");
    int dailyActiveUsers = (Integer) metrics.get("daily_active_users");

    assertTrue(totalUsers >= 0, "Total users should be non-negative");
    assertTrue(botUsers >= 0, "Bot users should be non-negative");
    assertTrue(botUsers <= totalUsers, "Bot users should not exceed total users");
    assertTrue(dailyActiveUsers >= 0, "Daily active users should be non-negative");

    Object lastActivity = metrics.get("last_activity");
    if (lastActivity != null) {
      assertInstanceOf(String.class, lastActivity, "last_activity should be a string when present");
      String timestamp = (String) lastActivity;
      assertTrue(
          timestamp.matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}.*"),
          "last_activity should be in ISO format: " + timestamp);
    }
  }

  @Test
  void test_userMetricsStructure_200(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> metrics = getUserMetrics(client);

    assertEquals(4, metrics.size(), "Should have exactly 4 metrics");
  }

  @Test
  void test_userMetricsWithSystemUsers_200(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> metrics = getUserMetrics(client);

    int botUsers = (Integer) metrics.get("bot_users");
    assertTrue(botUsers >= 1, "Should have at least one bot user (ingestion-bot)");
  }

  @Test
  void test_userMetricsAfterUserCreation_200(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> initialMetrics = getUserMetrics(client);
    int initialTotalUsers = (Integer) initialMetrics.get("total_users");
    int initialBotUsers = (Integer) initialMetrics.get("bot_users");

    String userName = ns.prefix("metricsTestUser");
    String userEmail = generateValidEmail(userName);
    CreateUser createUser =
        new CreateUser()
            .withName(userName)
            .withEmail(userEmail)
            .withIsBot(false)
            .withDescription("User for metrics test");

    User newUser = Users.create(createUser);
    assertNotNull(newUser);

    Map<String, Object> updatedMetrics = getUserMetrics(client);
    int updatedTotalUsers = (Integer) updatedMetrics.get("total_users");
    int updatedBotUsers = (Integer) updatedMetrics.get("bot_users");

    assertEquals(initialTotalUsers + 1, updatedTotalUsers, "Total users should increase by 1");
    assertEquals(
        initialBotUsers,
        updatedBotUsers,
        "Bot users count should remain the same for non-bot user");
  }

  @Test
  void test_userMetricsAfterBotUserCreation_200(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> initialMetrics = getUserMetrics(client);
    int initialTotalUsers = (Integer) initialMetrics.get("total_users");
    int initialBotUsers = (Integer) initialMetrics.get("bot_users");

    String botName = ns.prefix("metricsTestBot");
    String botEmail = generateValidEmail(botName);

    AuthenticationMechanism authMechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.JWT)
            .withConfig(new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited));

    CreateUser createBot =
        new CreateUser()
            .withName(botName)
            .withEmail(botEmail)
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism)
            .withDescription("Bot user for metrics test");

    User newBot = Users.create(createBot);
    assertNotNull(newBot);

    Map<String, Object> updatedMetrics = getUserMetrics(client);
    int updatedTotalUsers = (Integer) updatedMetrics.get("total_users");
    int updatedBotUsers = (Integer) updatedMetrics.get("bot_users");

    assertEquals(initialTotalUsers + 1, updatedTotalUsers, "Total users should increase by 1");
    assertEquals(initialBotUsers + 1, updatedBotUsers, "Bot users count should increase by 1");
  }

  @Test
  void test_userMetricsWithLastActivity_200(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String userName = ns.prefix("activityTestUser");
    String userEmail = generateValidEmail(userName);
    CreateUser createUser =
        new CreateUser()
            .withName(userName)
            .withEmail(userEmail)
            .withIsBot(false)
            .withDescription("User for activity test");

    User newUser = Users.create(createUser);
    assertNotNull(newUser);

    User fetchedUser = Users.get(newUser.getId().toString());
    assertNotNull(fetchedUser);

    Map<String, Object> metrics = getUserMetrics(client);

    String lastActivity = (String) metrics.get("last_activity");
    if (lastActivity != null) {
      Instant lastActivityTime = Instant.parse(lastActivity);
      Instant now = Instant.now();
      long secondsSinceActivity = now.getEpochSecond() - lastActivityTime.getEpochSecond();

      assertTrue(
          secondsSinceActivity < 300,
          "Last activity should be within last 5 minutes, but was "
              + secondsSinceActivity
              + " seconds ago");
    }
  }

  @Test
  void test_userMetricsConsistency_200(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> metrics1 = getUserMetrics(client);
    Map<String, Object> metrics2 = getUserMetrics(client);

    assertEquals(
        metrics1.get("total_users"),
        metrics2.get("total_users"),
        "Total users should be consistent across calls");
    assertEquals(
        metrics1.get("bot_users"),
        metrics2.get("bot_users"),
        "Bot users should be consistent across calls");
  }

  @Test
  void test_userMetricsNonNegativeValues_200(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> metrics = getUserMetrics(client);

    int totalUsers = (Integer) metrics.get("total_users");
    int botUsers = (Integer) metrics.get("bot_users");
    int dailyActiveUsers = (Integer) metrics.get("daily_active_users");

    assertTrue(totalUsers >= 0, "Total users should be non-negative");
    assertTrue(botUsers >= 0, "Bot users should be non-negative");
    assertTrue(dailyActiveUsers >= 0, "Daily active users should be non-negative");
    assertTrue(totalUsers >= botUsers, "Total users should be >= bot users");
  }

  @Test
  void test_userMetricsBotFiltering_200(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> initialMetrics = getUserMetrics(client);
    int initialTotalUsers = (Integer) initialMetrics.get("total_users");
    int initialBotUsers = (Integer) initialMetrics.get("bot_users");

    int initialNonBotUsers = initialTotalUsers - initialBotUsers;

    String userName = ns.prefix("nonBotUser");
    String userEmail = generateValidEmail(userName);
    CreateUser createUser =
        new CreateUser()
            .withName(userName)
            .withEmail(userEmail)
            .withIsBot(false)
            .withDescription("Non-bot user for filtering test");

    User newUser = Users.create(createUser);
    assertNotNull(newUser);

    Map<String, Object> updatedMetrics = getUserMetrics(client);
    int updatedTotalUsers = (Integer) updatedMetrics.get("total_users");
    int updatedBotUsers = (Integer) updatedMetrics.get("bot_users");

    int updatedNonBotUsers = updatedTotalUsers - updatedBotUsers;

    assertEquals(initialNonBotUsers + 1, updatedNonBotUsers, "Non-bot users should increase by 1");
    assertEquals(initialBotUsers, updatedBotUsers, "Bot users should remain unchanged");
  }

  @Test
  void test_userMetricsDailyActiveUsers_200(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> metrics = getUserMetrics(client);

    assertTrue(
        metrics.containsKey("daily_active_users"), "Metrics should include daily_active_users");

    Object dauValue = metrics.get("daily_active_users");
    assertNotNull(dauValue, "Daily active users should not be null");
    assertInstanceOf(Integer.class, dauValue, "Daily active users should be an integer");

    int dailyActiveUsers = (Integer) dauValue;
    assertTrue(dailyActiveUsers >= 0, "Daily active users should be non-negative");
  }

  @Test
  void test_userMetricsMultipleUsers_200(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> initialMetrics = getUserMetrics(client);
    int initialTotalUsers = (Integer) initialMetrics.get("total_users");

    int usersToCreate = 3;
    for (int i = 0; i < usersToCreate; i++) {
      String userName = ns.prefix("multiUser" + i);
      String userEmail = generateValidEmail(userName);
      CreateUser createUser =
          new CreateUser()
              .withName(userName)
              .withEmail(userEmail)
              .withIsBot(false)
              .withDescription("User " + i + " for multiple users test");

      User user = Users.create(createUser);
      assertNotNull(user);
    }

    Map<String, Object> updatedMetrics = getUserMetrics(client);
    int updatedTotalUsers = (Integer) updatedMetrics.get("total_users");

    assertEquals(
        initialTotalUsers + usersToCreate,
        updatedTotalUsers,
        "Total users should increase by " + usersToCreate);
  }

  @Test
  void test_userMetricsLastActivityFormat_200(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> metrics = getUserMetrics(client);

    Object lastActivity = metrics.get("last_activity");
    if (lastActivity != null) {
      assertInstanceOf(String.class, lastActivity, "last_activity should be a string");
      String timestamp = (String) lastActivity;

      assertDoesNotThrow(
          () -> Instant.parse(timestamp),
          "last_activity should be parseable as an Instant: " + timestamp);

      Instant parsed = Instant.parse(timestamp);
      Instant now = Instant.now();

      assertTrue(
          parsed.isBefore(now) || parsed.equals(now), "last_activity should not be in the future");
    }
  }

  private Map<String, Object> getUserMetrics(OpenMetadataClient client) throws Exception {
    String responseJson =
        client.getHttpClient().executeForString(HttpMethod.GET, USER_METRICS_PATH, null);

    TypeReference<Map<String, Object>> typeRef = new TypeReference<Map<String, Object>>() {};
    return OBJECT_MAPPER.readValue(responseJson, typeRef);
  }

  private String generateValidEmail(String name) {
    String sanitized = name.replaceAll("[^a-zA-Z0-9._-]", "");
    sanitized = sanitized.replaceAll("^\\.+|\\.+$", "");
    sanitized = sanitized.replaceAll("\\.{2,}", ".");
    sanitized = sanitized.replaceAll("_{2,}", "_");
    sanitized = sanitized.replaceAll("-{2,}", "-");

    if (sanitized.length() > 60) {
      sanitized = sanitized.substring(0, 52) + UUID.randomUUID().toString().substring(0, 8);
    }
    return sanitized + "@test.openmetadata.org";
  }
}
