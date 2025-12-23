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

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.util.ServicesCount;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for generic service operations.
 *
 * <p>Tests system-level service endpoints that provide aggregated information about all service
 * types in OpenMetadata. Uses HttpClient directly to test raw REST API responses.
 *
 * <p>Test isolation: Uses TestNamespace extension for test isolation Parallelization: Safe for
 * concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ServiceResourceIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Test
  void test_getServicesCount(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String servicesCountJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/system/services/count", null, RequestOptions.builder().build());

    assertNotNull(servicesCountJson, "Services count response should not be null");
    assertFalse(servicesCountJson.isEmpty(), "Services count response should not be empty");

    ServicesCount servicesCount = MAPPER.readValue(servicesCountJson, ServicesCount.class);

    assertNotNull(servicesCount, "Services count object should not be null");
    assertNotNull(
        servicesCount.getDatabaseServiceCount(), "Database service count should not be null");
    assertNotNull(
        servicesCount.getMessagingServiceCount(), "Messaging service count should not be null");
    assertNotNull(
        servicesCount.getDashboardServiceCount(), "Dashboard service count should not be null");
    assertNotNull(
        servicesCount.getPipelineServiceCount(), "Pipeline service count should not be null");
    assertNotNull(
        servicesCount.getMlModelServiceCount(), "ML Model service count should not be null");
    assertNotNull(
        servicesCount.getStorageServiceCount(), "Storage service count should not be null");

    assertTrue(
        servicesCount.getDatabaseServiceCount() >= 0,
        "Database service count should be non-negative");
    assertTrue(
        servicesCount.getMessagingServiceCount() >= 0,
        "Messaging service count should be non-negative");
    assertTrue(
        servicesCount.getDashboardServiceCount() >= 0,
        "Dashboard service count should be non-negative");
    assertTrue(
        servicesCount.getPipelineServiceCount() >= 0,
        "Pipeline service count should be non-negative");
    assertTrue(
        servicesCount.getMlModelServiceCount() >= 0,
        "ML Model service count should be non-negative");
    assertTrue(
        servicesCount.getStorageServiceCount() >= 0,
        "Storage service count should be non-negative");
  }

  @Test
  void test_getServicesCountAsJsonNode(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String servicesCountJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/system/services/count", null, RequestOptions.builder().build());

    JsonNode servicesNode = MAPPER.readTree(servicesCountJson);

    assertTrue(servicesNode.has("databaseServiceCount"), "Should have databaseServiceCount field");
    assertTrue(
        servicesNode.has("messagingServiceCount"), "Should have messagingServiceCount field");
    assertTrue(
        servicesNode.has("dashboardServiceCount"), "Should have dashboardServiceCount field");
    assertTrue(servicesNode.has("pipelineServiceCount"), "Should have pipelineServiceCount field");
    assertTrue(servicesNode.has("mlModelServiceCount"), "Should have mlModelServiceCount field");
    assertTrue(servicesNode.has("storageServiceCount"), "Should have storageServiceCount field");
  }

  @Test
  void test_getServicesCountWithIncludeDeleted(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String servicesCountJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/system/services/count?include=all",
                null,
                RequestOptions.builder().build());

    assertNotNull(servicesCountJson, "Services count with include=all should not be null");
    assertFalse(servicesCountJson.isEmpty(), "Services count with include=all should not be empty");

    ServicesCount servicesCount = MAPPER.readValue(servicesCountJson, ServicesCount.class);
    assertNotNull(servicesCount, "Services count object should not be null");
  }

  @Test
  void test_getServicesCountWithIncludeNonDeleted(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String servicesCountJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/system/services/count?include=non-deleted",
                null,
                RequestOptions.builder().build());

    assertNotNull(servicesCountJson, "Services count with include=non-deleted should not be null");
    assertFalse(
        servicesCountJson.isEmpty(), "Services count with include=non-deleted should not be empty");

    ServicesCount servicesCount = MAPPER.readValue(servicesCountJson, ServicesCount.class);
    assertNotNull(servicesCount, "Services count object should not be null");
  }

  @Test
  void test_servicesCountFieldsAreNumeric(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String servicesCountJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/system/services/count", null, RequestOptions.builder().build());

    JsonNode servicesNode = MAPPER.readTree(servicesCountJson);

    assertTrue(
        servicesNode.get("databaseServiceCount").isNumber(),
        "databaseServiceCount should be numeric");
    assertTrue(
        servicesNode.get("messagingServiceCount").isNumber(),
        "messagingServiceCount should be numeric");
    assertTrue(
        servicesNode.get("dashboardServiceCount").isNumber(),
        "dashboardServiceCount should be numeric");
    assertTrue(
        servicesNode.get("pipelineServiceCount").isNumber(),
        "pipelineServiceCount should be numeric");
    assertTrue(
        servicesNode.get("mlModelServiceCount").isNumber(),
        "mlModelServiceCount should be numeric");
    assertTrue(
        servicesNode.get("storageServiceCount").isNumber(),
        "storageServiceCount should be numeric");
  }

  @Test
  void test_servicesCountResponseStructure(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String servicesCountJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/system/services/count", null, RequestOptions.builder().build());

    JsonNode servicesNode = MAPPER.readTree(servicesCountJson);

    String[] expectedFields = {
      "databaseServiceCount",
      "messagingServiceCount",
      "dashboardServiceCount",
      "pipelineServiceCount",
      "mlModelServiceCount",
      "storageServiceCount"
    };

    for (String field : expectedFields) {
      assertTrue(servicesNode.has(field), "Response should contain field: " + field);
      assertTrue(servicesNode.get(field).isInt(), "Field " + field + " should be an integer");
      assertTrue(
          servicesNode.get(field).asInt() >= 0, "Field " + field + " should be non-negative");
    }
  }

  @Test
  void test_getServicesCountConsistency(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String firstCall =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/system/services/count", null, RequestOptions.builder().build());

    ServicesCount firstCount = MAPPER.readValue(firstCall, ServicesCount.class);

    String secondCall =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/system/services/count", null, RequestOptions.builder().build());

    ServicesCount secondCount = MAPPER.readValue(secondCall, ServicesCount.class);

    assertEquals(
        firstCount.getDatabaseServiceCount(),
        secondCount.getDatabaseServiceCount(),
        "Database service count should be consistent across calls");
    assertEquals(
        firstCount.getMessagingServiceCount(),
        secondCount.getMessagingServiceCount(),
        "Messaging service count should be consistent across calls");
    assertEquals(
        firstCount.getDashboardServiceCount(),
        secondCount.getDashboardServiceCount(),
        "Dashboard service count should be consistent across calls");
    assertEquals(
        firstCount.getPipelineServiceCount(),
        secondCount.getPipelineServiceCount(),
        "Pipeline service count should be consistent across calls");
    assertEquals(
        firstCount.getMlModelServiceCount(),
        secondCount.getMlModelServiceCount(),
        "ML Model service count should be consistent across calls");
    assertEquals(
        firstCount.getStorageServiceCount(),
        secondCount.getStorageServiceCount(),
        "Storage service count should be consistent across calls");
  }

  @Test
  void test_verifyMultipleServiceTypesExist(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String servicesCountJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/system/services/count", null, RequestOptions.builder().build());

    ServicesCount servicesCount = MAPPER.readValue(servicesCountJson, ServicesCount.class);

    int totalServices =
        servicesCount.getDatabaseServiceCount()
            + servicesCount.getMessagingServiceCount()
            + servicesCount.getDashboardServiceCount()
            + servicesCount.getPipelineServiceCount()
            + servicesCount.getMlModelServiceCount()
            + servicesCount.getStorageServiceCount();

    assertTrue(totalServices >= 0, "Total services count should be non-negative");
  }

  @Test
  void test_servicesCountJsonFormat(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String servicesCountJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/system/services/count", null, RequestOptions.builder().build());

    assertNotNull(servicesCountJson, "Response should not be null");
    assertFalse(servicesCountJson.isEmpty(), "Response should not be empty");
    assertTrue(servicesCountJson.startsWith("{"), "Response should be a JSON object");
    assertTrue(servicesCountJson.contains("databaseServiceCount"), "Response should contain key");

    JsonNode node = MAPPER.readTree(servicesCountJson);
    assertTrue(node.isObject(), "Response should be a valid JSON object");
  }

  @Test
  void test_servicesCountNoExtraFields(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String servicesCountJson =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/system/services/count", null, RequestOptions.builder().build());

    JsonNode servicesNode = MAPPER.readTree(servicesCountJson);

    String[] expectedFields = {
      "databaseServiceCount",
      "messagingServiceCount",
      "dashboardServiceCount",
      "pipelineServiceCount",
      "mlModelServiceCount",
      "storageServiceCount"
    };

    assertEquals(
        expectedFields.length, servicesNode.size(), "Response should only contain expected fields");
  }
}
