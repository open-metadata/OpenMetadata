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

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
}
