package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for WorkflowDefinition entity operations.
 *
 * <p>Tests workflow definition CRUD operations using raw HTTP calls due to complex schema
 * dependencies.
 *
 * <p>Migrated from: org.openmetadata.service.resources.governance.WorkflowDefinitionResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class WorkflowDefinitionResourceIT {

  private static final ObjectMapper MAPPER =
      new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
  private static final String BASE_PATH = "/v1/governance/workflowDefinitions";

  @Test
  void test_listWorkflowDefinitions(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, BASE_PATH, null, RequestOptions.builder().build());

    assertNotNull(response);
    JsonNode root = MAPPER.readTree(response);
    assertTrue(root.has("data"));
  }

  @Test
  void test_createAndGetWorkflowDefinition(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> createRequest = buildMinimalWorkflowRequest(ns.prefix("testWorkflow"));
    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, createRequest, RequestOptions.builder().build());

    assertNotNull(createResponse);
    JsonNode created = MAPPER.readTree(createResponse);
    assertTrue(created.has("id"));
    assertTrue(created.has("name"));
    assertEquals(ns.prefix("testWorkflow"), created.get("name").asText());

    String workflowId = created.get("id").asText();
    String getResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                BASE_PATH + "/" + workflowId,
                null,
                RequestOptions.builder().build());

    assertNotNull(getResponse);
    JsonNode fetched = MAPPER.readTree(getResponse);
    assertEquals(workflowId, fetched.get("id").asText());
  }

  @Test
  void test_getWorkflowDefinitionByName(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String workflowName = ns.prefix("getByNameWorkflow");
    Map<String, Object> createRequest = buildMinimalWorkflowRequest(workflowName);
    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, createRequest, RequestOptions.builder().build());

    JsonNode created = MAPPER.readTree(createResponse);
    String workflowId = created.get("id").asText();

    String getResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                BASE_PATH + "/name/" + workflowName,
                null,
                RequestOptions.builder().build());

    assertNotNull(getResponse);
    JsonNode fetched = MAPPER.readTree(getResponse);
    assertEquals(workflowId, fetched.get("id").asText());
    assertEquals(workflowName, fetched.get("name").asText());
  }

  @Test
  void test_updateWorkflowDefinition(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> createRequest = buildMinimalWorkflowRequest(ns.prefix("updateWorkflow"));
    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, createRequest, RequestOptions.builder().build());

    JsonNode created = MAPPER.readTree(createResponse);
    String workflowId = created.get("id").asText();

    Map<String, Object> updateRequest = new HashMap<>(createRequest);
    updateRequest.put("description", "Updated workflow description");
    String updateResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT, BASE_PATH, updateRequest, RequestOptions.builder().build());

    assertNotNull(updateResponse);
    JsonNode updated = MAPPER.readTree(updateResponse);
    assertEquals("Updated workflow description", updated.get("description").asText());
  }

  @Test
  void test_deleteWorkflowDefinition(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> createRequest = buildMinimalWorkflowRequest(ns.prefix("deleteWorkflow"));
    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, createRequest, RequestOptions.builder().build());

    JsonNode created = MAPPER.readTree(createResponse);
    String workflowId = created.get("id").asText();

    client
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            BASE_PATH + "/" + workflowId,
            null,
            RequestOptions.builder().build());

    assertThrows(
        Exception.class,
        () ->
            client
                .getHttpClient()
                .executeForString(
                    HttpMethod.GET,
                    BASE_PATH + "/" + workflowId,
                    null,
                    RequestOptions.builder().build()));
  }

  @Test
  void test_listWorkflowDefinitionsWithPagination(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    for (int i = 0; i < 3; i++) {
      Map<String, Object> createRequest =
          buildMinimalWorkflowRequest(ns.prefix("listWorkflow" + i));
      client
          .getHttpClient()
          .executeForString(
              HttpMethod.POST, BASE_PATH, createRequest, RequestOptions.builder().build());
    }

    RequestOptions options = RequestOptions.builder().queryParam("limit", "100").build();
    String response =
        client.getHttpClient().executeForString(HttpMethod.GET, BASE_PATH, null, options);

    assertNotNull(response);
    JsonNode root = MAPPER.readTree(response);
    assertTrue(root.has("data"));
    assertTrue(root.get("data").size() >= 3);
  }

  private Map<String, Object> buildMinimalWorkflowRequest(String name) {
    Map<String, Object> startNode = new HashMap<>();
    startNode.put("type", "startEvent");
    startNode.put("subType", "startEvent");
    startNode.put("name", "start");

    Map<String, Object> endNode = new HashMap<>();
    endNode.put("type", "endEvent");
    endNode.put("subType", "endEvent");
    endNode.put("name", "end");

    Map<String, Object> edge = new HashMap<>();
    edge.put("from", "start");
    edge.put("to", "end");

    Map<String, Object> triggerConfig = new HashMap<>();
    triggerConfig.put("entityTypes", List.of("table"));
    triggerConfig.put("batchSize", 100);
    Map<String, Object> schedule = new HashMap<>();
    schedule.put("scheduleTimeline", "None");
    triggerConfig.put("schedule", schedule);

    Map<String, Object> trigger = new HashMap<>();
    trigger.put("type", "periodicBatchEntity");
    trigger.put("config", triggerConfig);

    Map<String, Object> workflowConfig = new HashMap<>();
    workflowConfig.put("storeStageStatus", false);

    Map<String, Object> request = new HashMap<>();
    request.put("name", name);
    request.put("displayName", "Test Workflow");
    request.put("description", "Integration test workflow");
    request.put("type", "PeriodicBatchEntity");
    request.put("trigger", trigger);
    request.put("nodes", List.of(startNode, endNode));
    request.put("edges", List.of(edge));
    request.put("config", workflowConfig);

    return request;
  }
}
