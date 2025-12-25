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

  @Test
  void test_InvalidWorkflowDefinition(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> startNode = new HashMap<>();
    startNode.put("type", "startEvent");
    startNode.put("subType", "startEvent");
    startNode.put("name", "start");

    Map<String, Object> updateNode = new HashMap<>();
    updateNode.put("name", "UpdateDescription");
    updateNode.put("displayName", "Update Description");
    updateNode.put("description", "Update entity description");
    updateNode.put("type", "setFieldValue");
    Map<String, Object> nodeConfig = new HashMap<>();
    nodeConfig.put("targetField", "description");
    nodeConfig.put("value", "Updated by workflow");
    updateNode.put("config", nodeConfig);

    Map<String, Object> edge = new HashMap<>();
    edge.put("from", "start");
    edge.put("to", "NonExistentNode");

    Map<String, Object> triggerConfig = new HashMap<>();
    triggerConfig.put("entityTypes", List.of("table"));
    triggerConfig.put("events", List.of("Created"));

    Map<String, Object> trigger = new HashMap<>();
    trigger.put("type", "eventBasedEntity");
    trigger.put("config", triggerConfig);

    Map<String, Object> workflowConfig = new HashMap<>();
    workflowConfig.put("storeStageStatus", true);

    Map<String, Object> invalidRequest = new HashMap<>();
    invalidRequest.put("name", ns.prefix("invalidWorkflow"));
    invalidRequest.put("displayName", "Invalid Workflow");
    invalidRequest.put("description", "Workflow with mismatched node and edge names");
    invalidRequest.put("trigger", trigger);
    invalidRequest.put("nodes", List.of(startNode, updateNode));
    invalidRequest.put("edges", List.of(edge));
    invalidRequest.put("config", workflowConfig);

    Exception exception =
        assertThrows(
            Exception.class,
            () ->
                client
                    .getHttpClient()
                    .executeForString(
                        HttpMethod.POST,
                        BASE_PATH,
                        invalidRequest,
                        RequestOptions.builder().build()));

    assertNotNull(exception);
  }

  @Test
  void test_UserApprovalTaskWithoutReviewerSupport(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> startNode = new HashMap<>();
    startNode.put("name", "start");
    startNode.put("type", "startEvent");
    startNode.put("subType", "startEvent");

    Map<String, Object> approvalNode = new HashMap<>();
    approvalNode.put("name", "userApproval");
    approvalNode.put("displayName", "User Approval");
    approvalNode.put("type", "userTask");
    approvalNode.put("subType", "userApprovalTask");
    approvalNode.put("output", List.of("approved"));
    Map<String, Object> approvalConfig = new HashMap<>();
    approvalConfig.put("approvalType", "UserApproval");
    approvalNode.put("config", approvalConfig);

    Map<String, Object> endNode = new HashMap<>();
    endNode.put("name", "end");
    endNode.put("type", "endEvent");
    endNode.put("subType", "endEvent");

    Map<String, Object> edge1 = new HashMap<>();
    edge1.put("from", "start");
    edge1.put("to", "userApproval");

    Map<String, Object> edge2 = new HashMap<>();
    edge2.put("from", "userApproval");
    edge2.put("to", "end");

    Map<String, Object> triggerConfig = new HashMap<>();
    triggerConfig.put("entityTypes", List.of("database"));
    triggerConfig.put("events", List.of("Created"));

    Map<String, Object> trigger = new HashMap<>();
    trigger.put("type", "eventBasedEntity");
    trigger.put("config", triggerConfig);

    Map<String, Object> invalidRequest = new HashMap<>();
    invalidRequest.put("name", ns.prefix("databaseApprovalWorkflow"));
    invalidRequest.put("displayName", "Database Approval Workflow");
    invalidRequest.put(
        "description",
        "Invalid workflow - database entity doesn't support reviewers for approval tasks");
    invalidRequest.put("trigger", trigger);
    invalidRequest.put("nodes", List.of(startNode, approvalNode, endNode));
    invalidRequest.put("edges", List.of(edge1, edge2));

    Exception exception =
        assertThrows(
            Exception.class,
            () ->
                client
                    .getHttpClient()
                    .executeForString(
                        HttpMethod.POST,
                        BASE_PATH,
                        invalidRequest,
                        RequestOptions.builder().build()));

    assertNotNull(exception);
  }

  @Test
  void test_SuspendNonExistentWorkflow(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String nonExistentWorkflowName = ns.prefix("NonExistentWorkflow");

    Exception exception =
        assertThrows(
            Exception.class,
            () ->
                client
                    .getHttpClient()
                    .executeForString(
                        HttpMethod.PUT,
                        BASE_PATH + "/name/" + nonExistentWorkflowName + "/suspend",
                        new HashMap<>(),
                        RequestOptions.builder().build()));

    assertNotNull(exception);
  }

  @Test
  void test_EventBasedMultipleEntitiesWithoutReviewerSupport(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> startNode = new HashMap<>();
    startNode.put("name", "start");
    startNode.put("type", "startEvent");
    startNode.put("subType", "startEvent");

    Map<String, Object> approvalNode = new HashMap<>();
    approvalNode.put("name", "userApproval");
    approvalNode.put("displayName", "User Approval");
    approvalNode.put("type", "userTask");
    approvalNode.put("subType", "userApprovalTask");
    approvalNode.put("output", List.of("approved"));
    Map<String, Object> approvalConfig = new HashMap<>();
    approvalConfig.put("approvalType", "UserApproval");
    approvalNode.put("config", approvalConfig);

    Map<String, Object> endNode = new HashMap<>();
    endNode.put("name", "end");
    endNode.put("type", "endEvent");
    endNode.put("subType", "endEvent");

    Map<String, Object> edge1 = new HashMap<>();
    edge1.put("from", "start");
    edge1.put("to", "userApproval");

    Map<String, Object> edge2 = new HashMap<>();
    edge2.put("from", "userApproval");
    edge2.put("to", "end");

    Map<String, Object> triggerConfig = new HashMap<>();
    triggerConfig.put("entityTypes", List.of("table", "database", "dashboard"));
    triggerConfig.put("events", List.of("Created", "Updated"));

    Map<String, Object> trigger = new HashMap<>();
    trigger.put("type", "eventBasedEntity");
    trigger.put("config", triggerConfig);

    Map<String, Object> invalidRequest = new HashMap<>();
    invalidRequest.put("name", ns.prefix("multiEntityEventBasedApprovalWorkflow"));
    invalidRequest.put("displayName", "Multi-Entity Event Based Approval Workflow");
    invalidRequest.put(
        "description",
        "Invalid workflow with user approval task for multiple entities without reviewer support");
    invalidRequest.put("trigger", trigger);
    invalidRequest.put("nodes", List.of(startNode, approvalNode, endNode));
    invalidRequest.put("edges", List.of(edge1, edge2));

    Exception exception =
        assertThrows(
            Exception.class,
            () ->
                client
                    .getHttpClient()
                    .executeForString(
                        HttpMethod.POST,
                        BASE_PATH,
                        invalidRequest,
                        RequestOptions.builder().build()));

    assertNotNull(exception);
  }

  @Test
  void test_MixedEntityTypesWithReviewerSupport(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> startNode = new HashMap<>();
    startNode.put("name", "start");
    startNode.put("type", "startEvent");
    startNode.put("subType", "startEvent");

    Map<String, Object> approvalNode = new HashMap<>();
    approvalNode.put("name", "userApproval");
    approvalNode.put("displayName", "User Approval");
    approvalNode.put("type", "userTask");
    approvalNode.put("subType", "userApprovalTask");
    approvalNode.put("output", List.of("approved"));
    Map<String, Object> approvalConfig = new HashMap<>();
    approvalConfig.put("approvalType", "UserApproval");
    approvalNode.put("config", approvalConfig);

    Map<String, Object> endNode = new HashMap<>();
    endNode.put("name", "end");
    endNode.put("type", "endEvent");
    endNode.put("subType", "endEvent");

    Map<String, Object> edge1 = new HashMap<>();
    edge1.put("from", "start");
    edge1.put("to", "userApproval");

    Map<String, Object> edge2 = new HashMap<>();
    edge2.put("from", "userApproval");
    edge2.put("to", "end");

    Map<String, Object> triggerConfig = new HashMap<>();
    triggerConfig.put("entityTypes", List.of("glossaryTerm", "table"));
    triggerConfig.put("events", List.of("Created"));

    Map<String, Object> trigger = new HashMap<>();
    trigger.put("type", "eventBasedEntity");
    trigger.put("config", triggerConfig);

    Map<String, Object> invalidRequest = new HashMap<>();
    invalidRequest.put("name", ns.prefix("mixedEntityApprovalWorkflow"));
    invalidRequest.put("displayName", "Mixed Entity Approval Workflow");
    invalidRequest.put(
        "description", "Invalid workflow - glossaryTerm supports reviewers but table doesn't");
    invalidRequest.put("trigger", trigger);
    invalidRequest.put("nodes", List.of(startNode, approvalNode, endNode));
    invalidRequest.put("edges", List.of(edge1, edge2));

    Exception exception =
        assertThrows(
            Exception.class,
            () ->
                client
                    .getHttpClient()
                    .executeForString(
                        HttpMethod.POST,
                        BASE_PATH,
                        invalidRequest,
                        RequestOptions.builder().build()));

    assertNotNull(exception);
  }

  @Test
  void test_WorkflowValidationEndpoint(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> startNode = new HashMap<>();
    startNode.put("name", "start");
    startNode.put("displayName", "Start");
    startNode.put("type", "startEvent");
    startNode.put("subType", "startEvent");

    Map<String, Object> checkNode = new HashMap<>();
    checkNode.put("name", "checkTask");
    checkNode.put("displayName", "Check Task");
    checkNode.put("type", "automatedTask");
    checkNode.put("subType", "checkEntityAttributesTask");
    Map<String, Object> checkConfig = new HashMap<>();
    checkConfig.put("rules", "{\"!!\":{\"var\":\"description\"}}");
    checkNode.put("config", checkConfig);
    checkNode.put("input", List.of("relatedEntity"));
    Map<String, Object> inputNamespace = new HashMap<>();
    inputNamespace.put("relatedEntity", "global");
    checkNode.put("inputNamespaceMap", inputNamespace);
    checkNode.put("output", List.of("result"));
    checkNode.put("branches", List.of("true", "false"));

    Map<String, Object> endNode = new HashMap<>();
    endNode.put("name", "end");
    endNode.put("displayName", "End");
    endNode.put("type", "endEvent");
    endNode.put("subType", "endEvent");

    Map<String, Object> edge1 = new HashMap<>();
    edge1.put("from", "start");
    edge1.put("to", "checkTask");

    Map<String, Object> edge2 = new HashMap<>();
    edge2.put("from", "checkTask");
    edge2.put("to", "end");
    edge2.put("condition", "true");

    Map<String, Object> edge3 = new HashMap<>();
    edge3.put("from", "checkTask");
    edge3.put("to", "end");
    edge3.put("condition", "false");

    Map<String, Object> triggerConfig = new HashMap<>();
    triggerConfig.put("entityTypes", List.of("glossaryTerm"));
    triggerConfig.put("events", List.of("Created", "Updated"));

    Map<String, Object> trigger = new HashMap<>();
    trigger.put("type", "eventBasedEntity");
    trigger.put("config", triggerConfig);

    Map<String, Object> validRequest = new HashMap<>();
    validRequest.put("name", ns.prefix("validTestWorkflow"));
    validRequest.put("displayName", "Valid Test Workflow");
    validRequest.put("description", "A valid workflow for testing");
    validRequest.put("trigger", trigger);
    validRequest.put("nodes", List.of(startNode, checkNode, endNode));
    validRequest.put("edges", List.of(edge1, edge2, edge3));

    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST,
                BASE_PATH + "/validate",
                validRequest,
                RequestOptions.builder().build());

    assertNotNull(response);
    assertTrue(response.contains("valid"));

    Map<String, Object> check1Node = new HashMap<>();
    check1Node.put("name", "check1");
    check1Node.put("displayName", "Check 1");
    check1Node.put("type", "automatedTask");
    check1Node.put("subType", "checkEntityAttributesTask");
    Map<String, Object> check1Config = new HashMap<>();
    check1Config.put("rules", "{\"!!\":{\"var\":\"description\"}}");
    check1Node.put("config", check1Config);
    check1Node.put("output", List.of("result"));
    check1Node.put("branches", List.of("true", "false"));

    Map<String, Object> check2Node = new HashMap<>();
    check2Node.put("name", "check2");
    check2Node.put("displayName", "Check 2");
    check2Node.put("type", "automatedTask");
    check2Node.put("subType", "checkEntityAttributesTask");
    Map<String, Object> check2Config = new HashMap<>();
    check2Config.put("rules", "{\"!!\":{\"var\":\"owners\"}}");
    check2Node.put("config", check2Config);
    check2Node.put("output", List.of("result"));
    check2Node.put("branches", List.of("true", "false"));

    Map<String, Object> cyclicEdge1 = new HashMap<>();
    cyclicEdge1.put("from", "start");
    cyclicEdge1.put("to", "check1");

    Map<String, Object> cyclicEdge2 = new HashMap<>();
    cyclicEdge2.put("from", "check1");
    cyclicEdge2.put("to", "check2");
    cyclicEdge2.put("condition", "true");

    Map<String, Object> cyclicEdge3 = new HashMap<>();
    cyclicEdge3.put("from", "check2");
    cyclicEdge3.put("to", "check1");
    cyclicEdge3.put("condition", "false");

    Map<String, Object> cyclicEdge4 = new HashMap<>();
    cyclicEdge4.put("from", "check2");
    cyclicEdge4.put("to", "end");
    cyclicEdge4.put("condition", "true");

    Map<String, Object> cyclicTriggerConfig = new HashMap<>();
    cyclicTriggerConfig.put("entityTypes", List.of("table"));
    cyclicTriggerConfig.put("events", List.of("Created"));

    Map<String, Object> cyclicTrigger = new HashMap<>();
    cyclicTrigger.put("type", "eventBasedEntity");
    cyclicTrigger.put("config", cyclicTriggerConfig);

    Map<String, Object> cyclicRequest = new HashMap<>();
    cyclicRequest.put("name", ns.prefix("cyclicWorkflow"));
    cyclicRequest.put("displayName", "Cyclic Workflow");
    cyclicRequest.put("description", "Workflow with a cycle");
    cyclicRequest.put("trigger", cyclicTrigger);
    cyclicRequest.put("nodes", List.of(startNode, check1Node, check2Node, endNode));
    cyclicRequest.put("edges", List.of(cyclicEdge1, cyclicEdge2, cyclicEdge3, cyclicEdge4));

    Exception cyclicException =
        assertThrows(
            Exception.class,
            () ->
                client
                    .getHttpClient()
                    .executeForString(
                        HttpMethod.POST,
                        BASE_PATH + "/validate",
                        cyclicRequest,
                        RequestOptions.builder().build()));

    assertNotNull(cyclicException);
    String exceptionMessage = cyclicException.getMessage();
    assertTrue(
        exceptionMessage != null && exceptionMessage.contains("cycle"),
        "Expected cycle error message");
  }

  @Test
  void test_CreateWorkflowWithoutEntityTypes(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> triggerConfig = new HashMap<>();
    Map<String, Object> trigger = new HashMap<>();
    trigger.put("type", "eventBasedEntity");
    trigger.put("output", List.of());
    trigger.put("config", triggerConfig);

    Map<String, Object> createRequest = new HashMap<>();
    createRequest.put("name", ns.prefix("Test"));
    createRequest.put("displayName", "Test-1");
    createRequest.put("description", "string");
    createRequest.put("trigger", trigger);
    createRequest.put("nodes", List.of());
    createRequest.put("edges", List.of());

    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, createRequest, RequestOptions.builder().build());

    assertNotNull(createResponse);
    JsonNode created = MAPPER.readTree(createResponse);
    assertTrue(created.has("id"));
    assertEquals(ns.prefix("Test"), created.get("name").asText());
    assertEquals("Test-1", created.get("displayName").asText());
    assertEquals("string", created.get("description").asText());

    Map<String, Object> updateRequest = new HashMap<>();
    updateRequest.put("name", ns.prefix("Test"));
    updateRequest.put("displayName", "Test-1-Updated");
    updateRequest.put("description", "updated string");
    updateRequest.put("trigger", trigger);
    updateRequest.put("nodes", List.of());
    updateRequest.put("edges", List.of());

    String updateResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT, BASE_PATH, updateRequest, RequestOptions.builder().build());

    assertNotNull(updateResponse);
    JsonNode updated = MAPPER.readTree(updateResponse);
    assertEquals(ns.prefix("Test"), updated.get("name").asText());
    assertEquals("Test-1-Updated", updated.get("displayName").asText());
    assertEquals("updated string", updated.get("description").asText());
  }

  @Test
  void test_SuspendAndResumeWorkflow(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> createRequest = buildMinimalWorkflowRequest(ns.prefix("suspendWorkflow"));
    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, createRequest, RequestOptions.builder().build());

    JsonNode created = MAPPER.readTree(createResponse);
    String workflowId = created.get("id").asText();
    String workflowName = created.get("name").asText();

    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            BASE_PATH + "/name/" + workflowName + "/suspend",
            new HashMap<>(),
            RequestOptions.builder().build());

    String suspendedResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                BASE_PATH + "/" + workflowId,
                null,
                RequestOptions.builder().build());

    JsonNode suspended = MAPPER.readTree(suspendedResponse);
    assertEquals("Suspended", suspended.get("status").asText());

    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            BASE_PATH + "/name/" + workflowName + "/resume",
            new HashMap<>(),
            RequestOptions.builder().build());

    String resumedResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                BASE_PATH + "/" + workflowId,
                null,
                RequestOptions.builder().build());

    JsonNode resumed = MAPPER.readTree(resumedResponse);
    assertEquals("Active", resumed.get("status").asText());
  }

  @Test
  void test_PrepareMethodValidation_OnCreate(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> startNode = new HashMap<>();
    startNode.put("type", "startEvent");
    startNode.put("subType", "startEvent");
    startNode.put("name", "start");

    Map<String, Object> task1Node = new HashMap<>();
    task1Node.put("type", "automatedTask");
    task1Node.put("subType", "setEntityAttributeTask");
    task1Node.put("name", "task1");
    Map<String, Object> task1Config = new HashMap<>();
    task1Config.put("fieldName", "tags");
    task1Config.put("fieldValue", "Test");
    task1Node.put("config", task1Config);

    Map<String, Object> task2Node = new HashMap<>();
    task2Node.put("type", "automatedTask");
    task2Node.put("subType", "setEntityAttributeTask");
    task2Node.put("name", "task2");
    Map<String, Object> task2Config = new HashMap<>();
    task2Config.put("fieldName", "tags");
    task2Config.put("fieldValue", "Test");
    task2Node.put("config", task2Config);

    Map<String, Object> endNode = new HashMap<>();
    endNode.put("type", "endEvent");
    endNode.put("subType", "endEvent");
    endNode.put("name", "end");

    Map<String, Object> edge1 = new HashMap<>();
    edge1.put("from", "start");
    edge1.put("to", "task1");

    Map<String, Object> edge2 = new HashMap<>();
    edge2.put("from", "task1");
    edge2.put("to", "task2");

    Map<String, Object> edge3 = new HashMap<>();
    edge3.put("from", "task2");
    edge3.put("to", "task1");

    Map<String, Object> edge4 = new HashMap<>();
    edge4.put("from", "task2");
    edge4.put("to", "end");

    Map<String, Object> triggerConfig = new HashMap<>();
    triggerConfig.put("entityTypes", List.of("table"));
    triggerConfig.put("batchSize", 100);
    Map<String, Object> schedule = new HashMap<>();
    schedule.put("scheduleTimeline", "None");
    triggerConfig.put("schedule", schedule);

    Map<String, Object> trigger = new HashMap<>();
    trigger.put("type", "periodicBatchEntity");
    trigger.put("config", triggerConfig);

    Map<String, Object> cyclicRequest = new HashMap<>();
    cyclicRequest.put("name", ns.prefix("testCyclicValidation"));
    cyclicRequest.put("displayName", "Cyclic Workflow");
    cyclicRequest.put("description", "Test workflow with cycle");
    cyclicRequest.put("trigger", trigger);
    cyclicRequest.put("nodes", List.of(startNode, task1Node, task2Node, endNode));
    cyclicRequest.put("edges", List.of(edge1, edge2, edge3, edge4));

    Exception exception =
        assertThrows(
            Exception.class,
            () ->
                client
                    .getHttpClient()
                    .executeForString(
                        HttpMethod.POST,
                        BASE_PATH,
                        cyclicRequest,
                        RequestOptions.builder().build()));

    assertNotNull(exception);

    Map<String, Object> duplicateTask1Node = new HashMap<>();
    duplicateTask1Node.put("type", "automatedTask");
    duplicateTask1Node.put("subType", "setEntityAttributeTask");
    duplicateTask1Node.put("name", "task1");
    duplicateTask1Node.put("config", task1Config);

    Map<String, Object> simpleEdge1 = new HashMap<>();
    simpleEdge1.put("from", "start");
    simpleEdge1.put("to", "task1");

    Map<String, Object> simpleEdge2 = new HashMap<>();
    simpleEdge2.put("from", "task1");
    simpleEdge2.put("to", "end");

    Map<String, Object> duplicateNodeRequest = new HashMap<>();
    duplicateNodeRequest.put("name", ns.prefix("testDuplicateNodeValidation"));
    duplicateNodeRequest.put("displayName", "Duplicate Node Workflow");
    duplicateNodeRequest.put("description", "Test workflow with duplicate nodes");
    duplicateNodeRequest.put("trigger", trigger);
    duplicateNodeRequest.put("nodes", List.of(startNode, task1Node, duplicateTask1Node, endNode));
    duplicateNodeRequest.put("edges", List.of(simpleEdge1, simpleEdge2));

    Exception duplicateException =
        assertThrows(
            Exception.class,
            () ->
                client
                    .getHttpClient()
                    .executeForString(
                        HttpMethod.POST,
                        BASE_PATH,
                        duplicateNodeRequest,
                        RequestOptions.builder().build()));

    assertNotNull(duplicateException);

    Map<String, Object> validRequest = new HashMap<>();
    validRequest.put("name", ns.prefix("testPrepareValidation"));
    validRequest.put("displayName", "Valid Prepare Workflow");
    validRequest.put("description", "Valid test workflow");
    validRequest.put("trigger", trigger);
    validRequest.put("nodes", List.of(startNode, task1Node, endNode));
    validRequest.put("edges", List.of(simpleEdge1, simpleEdge2));

    String validResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, validRequest, RequestOptions.builder().build());

    assertNotNull(validResponse);
    JsonNode validCreated = MAPPER.readTree(validResponse);
    assertEquals(ns.prefix("testPrepareValidation"), validCreated.get("name").asText());
  }

  @Test
  void test_CreatePeriodicBatchWorkflow(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> startNode = new HashMap<>();
    startNode.put("name", "start");
    startNode.put("type", "startEvent");
    startNode.put("subType", "startEvent");

    Map<String, Object> setFieldNode = new HashMap<>();
    setFieldNode.put("name", "setDescription");
    setFieldNode.put("displayName", "Set Description");
    setFieldNode.put("type", "automatedTask");
    setFieldNode.put("subType", "setFieldValue");
    Map<String, Object> setFieldConfig = new HashMap<>();
    setFieldConfig.put("targetField", "description");
    setFieldConfig.put("value", "Updated by workflow");
    setFieldNode.put("config", setFieldConfig);

    Map<String, Object> endNode = new HashMap<>();
    endNode.put("name", "end");
    endNode.put("type", "endEvent");
    endNode.put("subType", "endEvent");

    Map<String, Object> edge1 = new HashMap<>();
    edge1.put("from", "start");
    edge1.put("to", "setDescription");

    Map<String, Object> edge2 = new HashMap<>();
    edge2.put("from", "setDescription");
    edge2.put("to", "end");

    Map<String, Object> triggerConfig = new HashMap<>();
    triggerConfig.put("entityTypes", List.of("table"));
    triggerConfig.put("batchSize", 100);
    Map<String, Object> schedule = new HashMap<>();
    schedule.put("scheduleTimeline", "None");
    triggerConfig.put("schedule", schedule);

    Map<String, Object> trigger = new HashMap<>();
    trigger.put("type", "periodicBatchEntity");
    trigger.put("config", triggerConfig);

    Map<String, Object> request = new HashMap<>();
    request.put("name", ns.prefix("periodicBatchWorkflow"));
    request.put("displayName", "Periodic Batch Workflow");
    request.put("description", "Test periodic batch workflow");
    request.put("trigger", trigger);
    request.put("nodes", List.of(startNode, setFieldNode, endNode));
    request.put("edges", List.of(edge1, edge2));

    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, request, RequestOptions.builder().build());

    assertNotNull(response);
    JsonNode created = MAPPER.readTree(response);
    assertEquals(ns.prefix("periodicBatchWorkflow"), created.get("name").asText());
    assertEquals("periodicBatchEntity", created.get("trigger").get("type").asText());
  }

  @Test
  void test_CreateEventBasedWorkflow(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> startNode = new HashMap<>();
    startNode.put("name", "start");
    startNode.put("type", "startEvent");
    startNode.put("subType", "startEvent");

    Map<String, Object> setFieldNode = new HashMap<>();
    setFieldNode.put("name", "updateField");
    setFieldNode.put("displayName", "Update Field");
    setFieldNode.put("type", "automatedTask");
    setFieldNode.put("subType", "setFieldValue");
    Map<String, Object> setFieldConfig = new HashMap<>();
    setFieldConfig.put("targetField", "description");
    setFieldConfig.put("value", "Updated on event");
    setFieldNode.put("config", setFieldConfig);

    Map<String, Object> endNode = new HashMap<>();
    endNode.put("name", "end");
    endNode.put("type", "endEvent");
    endNode.put("subType", "endEvent");

    Map<String, Object> edge1 = new HashMap<>();
    edge1.put("from", "start");
    edge1.put("to", "updateField");

    Map<String, Object> edge2 = new HashMap<>();
    edge2.put("from", "updateField");
    edge2.put("to", "end");

    Map<String, Object> triggerConfig = new HashMap<>();
    triggerConfig.put("entityTypes", List.of("glossaryTerm"));
    triggerConfig.put("events", List.of("Created", "Updated"));

    Map<String, Object> trigger = new HashMap<>();
    trigger.put("type", "eventBasedEntity");
    trigger.put("config", triggerConfig);

    Map<String, Object> request = new HashMap<>();
    request.put("name", ns.prefix("eventBasedWorkflow"));
    request.put("displayName", "Event Based Workflow");
    request.put("description", "Test event based workflow");
    request.put("trigger", trigger);
    request.put("nodes", List.of(startNode, setFieldNode, endNode));
    request.put("edges", List.of(edge1, edge2));

    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, request, RequestOptions.builder().build());

    assertNotNull(response);
    JsonNode created = MAPPER.readTree(response);
    assertEquals(ns.prefix("eventBasedWorkflow"), created.get("name").asText());
    assertEquals("eventBasedEntity", created.get("trigger").get("type").asText());
  }

  @Test
  void test_CreateWorkflowWithCheckEntityAttributesTask(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> startNode = new HashMap<>();
    startNode.put("name", "start");
    startNode.put("type", "startEvent");
    startNode.put("subType", "startEvent");

    Map<String, Object> checkNode = new HashMap<>();
    checkNode.put("name", "checkDescription");
    checkNode.put("displayName", "Check Description");
    checkNode.put("type", "automatedTask");
    checkNode.put("subType", "checkEntityAttributesTask");
    Map<String, Object> checkConfig = new HashMap<>();
    checkConfig.put("rules", "{\"!!\":{\"var\":\"description\"}}");
    checkNode.put("config", checkConfig);
    checkNode.put("output", List.of("result"));
    checkNode.put("branches", List.of("true", "false"));

    Map<String, Object> endNode = new HashMap<>();
    endNode.put("name", "end");
    endNode.put("type", "endEvent");
    endNode.put("subType", "endEvent");

    Map<String, Object> edge1 = new HashMap<>();
    edge1.put("from", "start");
    edge1.put("to", "checkDescription");

    Map<String, Object> edge2 = new HashMap<>();
    edge2.put("from", "checkDescription");
    edge2.put("to", "end");
    edge2.put("condition", "true");

    Map<String, Object> edge3 = new HashMap<>();
    edge3.put("from", "checkDescription");
    edge3.put("to", "end");
    edge3.put("condition", "false");

    Map<String, Object> triggerConfig = new HashMap<>();
    triggerConfig.put("entityTypes", List.of("table"));
    triggerConfig.put("batchSize", 100);
    Map<String, Object> schedule = new HashMap<>();
    schedule.put("scheduleTimeline", "None");
    triggerConfig.put("schedule", schedule);

    Map<String, Object> trigger = new HashMap<>();
    trigger.put("type", "periodicBatchEntity");
    trigger.put("config", triggerConfig);

    Map<String, Object> request = new HashMap<>();
    request.put("name", ns.prefix("checkAttributesWorkflow"));
    request.put("displayName", "Check Attributes Workflow");
    request.put("description", "Test workflow with check entity attributes task");
    request.put("trigger", trigger);
    request.put("nodes", List.of(startNode, checkNode, endNode));
    request.put("edges", List.of(edge1, edge2, edge3));

    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, request, RequestOptions.builder().build());

    assertNotNull(response);
    JsonNode created = MAPPER.readTree(response);
    assertEquals(ns.prefix("checkAttributesWorkflow"), created.get("name").asText());
    assertTrue(created.get("nodes").size() == 3);
  }

  @Test
  void test_CreateWorkflowWithSetEntityCertificationTask(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> startNode = new HashMap<>();
    startNode.put("name", "start");
    startNode.put("type", "startEvent");
    startNode.put("subType", "startEvent");

    Map<String, Object> certNode = new HashMap<>();
    certNode.put("name", "setCertification");
    certNode.put("displayName", "Set Certification");
    certNode.put("type", "automatedTask");
    certNode.put("subType", "setEntityCertificationTask");
    Map<String, Object> certConfig = new HashMap<>();
    certConfig.put("tagFQN", "Certification.Gold");
    certNode.put("config", certConfig);

    Map<String, Object> endNode = new HashMap<>();
    endNode.put("name", "end");
    endNode.put("type", "endEvent");
    endNode.put("subType", "endEvent");

    Map<String, Object> edge1 = new HashMap<>();
    edge1.put("from", "start");
    edge1.put("to", "setCertification");

    Map<String, Object> edge2 = new HashMap<>();
    edge2.put("from", "setCertification");
    edge2.put("to", "end");

    Map<String, Object> triggerConfig = new HashMap<>();
    triggerConfig.put("entityTypes", List.of("table"));
    triggerConfig.put("batchSize", 50);
    Map<String, Object> schedule = new HashMap<>();
    schedule.put("scheduleTimeline", "None");
    triggerConfig.put("schedule", schedule);

    Map<String, Object> trigger = new HashMap<>();
    trigger.put("type", "periodicBatchEntity");
    trigger.put("config", triggerConfig);

    Map<String, Object> request = new HashMap<>();
    request.put("name", ns.prefix("certificationWorkflow"));
    request.put("displayName", "Certification Workflow");
    request.put("description", "Test workflow with set certification task");
    request.put("trigger", trigger);
    request.put("nodes", List.of(startNode, certNode, endNode));
    request.put("edges", List.of(edge1, edge2));

    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, request, RequestOptions.builder().build());

    assertNotNull(response);
    JsonNode created = MAPPER.readTree(response);
    assertEquals(ns.prefix("certificationWorkflow"), created.get("name").asText());
  }

  @Test
  void test_CreateWorkflowWithFilters(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> startNode = new HashMap<>();
    startNode.put("name", "start");
    startNode.put("type", "startEvent");
    startNode.put("subType", "startEvent");

    Map<String, Object> endNode = new HashMap<>();
    endNode.put("name", "end");
    endNode.put("type", "endEvent");
    endNode.put("subType", "endEvent");

    Map<String, Object> edge = new HashMap<>();
    edge.put("from", "start");
    edge.put("to", "end");

    Map<String, Object> filters = new HashMap<>();
    filters.put("table", "{\"and\":[{\"!!\":{\"var\":\"description\"}}]}");

    Map<String, Object> triggerConfig = new HashMap<>();
    triggerConfig.put("entityTypes", List.of("table"));
    triggerConfig.put("batchSize", 100);
    triggerConfig.put("filters", filters);
    Map<String, Object> schedule = new HashMap<>();
    schedule.put("scheduleTimeline", "None");
    triggerConfig.put("schedule", schedule);

    Map<String, Object> trigger = new HashMap<>();
    trigger.put("type", "periodicBatchEntity");
    trigger.put("config", triggerConfig);

    Map<String, Object> request = new HashMap<>();
    request.put("name", ns.prefix("filteredWorkflow"));
    request.put("displayName", "Filtered Workflow");
    request.put("description", "Test workflow with filters");
    request.put("trigger", trigger);
    request.put("nodes", List.of(startNode, endNode));
    request.put("edges", List.of(edge));

    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, request, RequestOptions.builder().build());

    assertNotNull(response);
    JsonNode created = MAPPER.readTree(response);
    assertEquals(ns.prefix("filteredWorkflow"), created.get("name").asText());
    assertTrue(created.get("trigger").get("config").has("filters"));
  }

  @Test
  void test_CreateWorkflowWithMultipleEntityTypes(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> startNode = new HashMap<>();
    startNode.put("name", "start");
    startNode.put("type", "startEvent");
    startNode.put("subType", "startEvent");

    Map<String, Object> setFieldNode = new HashMap<>();
    setFieldNode.put("name", "updateDescription");
    setFieldNode.put("displayName", "Update Description");
    setFieldNode.put("type", "automatedTask");
    setFieldNode.put("subType", "setFieldValue");
    Map<String, Object> setFieldConfig = new HashMap<>();
    setFieldConfig.put("targetField", "description");
    setFieldConfig.put("value", "Multi-entity update");
    setFieldNode.put("config", setFieldConfig);

    Map<String, Object> endNode = new HashMap<>();
    endNode.put("name", "end");
    endNode.put("type", "endEvent");
    endNode.put("subType", "endEvent");

    Map<String, Object> edge1 = new HashMap<>();
    edge1.put("from", "start");
    edge1.put("to", "updateDescription");

    Map<String, Object> edge2 = new HashMap<>();
    edge2.put("from", "updateDescription");
    edge2.put("to", "end");

    Map<String, Object> triggerConfig = new HashMap<>();
    triggerConfig.put("entityTypes", List.of("table", "topic", "dashboard"));
    triggerConfig.put("batchSize", 100);
    Map<String, Object> schedule = new HashMap<>();
    schedule.put("scheduleTimeline", "None");
    triggerConfig.put("schedule", schedule);

    Map<String, Object> trigger = new HashMap<>();
    trigger.put("type", "periodicBatchEntity");
    trigger.put("config", triggerConfig);

    Map<String, Object> request = new HashMap<>();
    request.put("name", ns.prefix("multiEntityWorkflow"));
    request.put("displayName", "Multi Entity Workflow");
    request.put("description", "Test workflow with multiple entity types");
    request.put("trigger", trigger);
    request.put("nodes", List.of(startNode, setFieldNode, endNode));
    request.put("edges", List.of(edge1, edge2));

    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, request, RequestOptions.builder().build());

    assertNotNull(response);
    JsonNode created = MAPPER.readTree(response);
    assertEquals(ns.prefix("multiEntityWorkflow"), created.get("name").asText());
    assertEquals(3, created.get("trigger").get("config").get("entityTypes").size());
  }

  @Test
  void test_CreateNoOpWorkflow(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> startNode = new HashMap<>();
    startNode.put("name", "start");
    startNode.put("type", "startEvent");
    startNode.put("subType", "startEvent");

    Map<String, Object> endNode = new HashMap<>();
    endNode.put("name", "end");
    endNode.put("type", "endEvent");
    endNode.put("subType", "endEvent");

    Map<String, Object> edge = new HashMap<>();
    edge.put("from", "start");
    edge.put("to", "end");

    Map<String, Object> trigger = new HashMap<>();
    trigger.put("type", "noOp");

    Map<String, Object> request = new HashMap<>();
    request.put("name", ns.prefix("noOpWorkflow"));
    request.put("displayName", "No-Op Workflow");
    request.put("description", "Test workflow with no-op trigger");
    request.put("trigger", trigger);
    request.put("nodes", List.of(startNode, endNode));
    request.put("edges", List.of(edge));

    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, request, RequestOptions.builder().build());

    assertNotNull(response);
    JsonNode created = MAPPER.readTree(response);
    assertEquals(ns.prefix("noOpWorkflow"), created.get("name").asText());
    assertEquals("noOp", created.get("trigger").get("type").asText());
  }

  @Test
  void test_CreateWorkflowWithApiEndpointTrigger(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> startNode = new HashMap<>();
    startNode.put("name", "start");
    startNode.put("type", "startEvent");
    startNode.put("subType", "startEvent");

    Map<String, Object> endNode = new HashMap<>();
    endNode.put("name", "end");
    endNode.put("type", "endEvent");
    endNode.put("subType", "endEvent");

    Map<String, Object> edge = new HashMap<>();
    edge.put("from", "start");
    edge.put("to", "end");

    Map<String, Object> triggerConfig = new HashMap<>();
    triggerConfig.put("entityTypes", List.of("table"));
    triggerConfig.put("batchSize", 100);

    Map<String, Object> trigger = new HashMap<>();
    trigger.put("type", "periodicBatchEntityAPIEndpoint");
    trigger.put("config", triggerConfig);

    Map<String, Object> request = new HashMap<>();
    request.put("name", ns.prefix("apiEndpointWorkflow"));
    request.put("displayName", "API Endpoint Workflow");
    request.put("description", "Test workflow with API endpoint trigger");
    request.put("trigger", trigger);
    request.put("nodes", List.of(startNode, endNode));
    request.put("edges", List.of(edge));

    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, request, RequestOptions.builder().build());

    assertNotNull(response);
    JsonNode created = MAPPER.readTree(response);
    assertEquals(ns.prefix("apiEndpointWorkflow"), created.get("name").asText());
    assertEquals("periodicBatchEntityAPIEndpoint", created.get("trigger").get("type").asText());
  }

  @Test
  void test_PrepareMethodValidation_OnUpdate(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> startNode = new HashMap<>();
    startNode.put("type", "startEvent");
    startNode.put("subType", "startEvent");
    startNode.put("name", "start");

    Map<String, Object> task1Node = new HashMap<>();
    task1Node.put("type", "automatedTask");
    task1Node.put("subType", "setEntityAttributeTask");
    task1Node.put("name", "task1");
    Map<String, Object> task1Config = new HashMap<>();
    task1Config.put("fieldName", "tags");
    task1Config.put("fieldValue", "Test");
    task1Node.put("config", task1Config);

    Map<String, Object> endNode = new HashMap<>();
    endNode.put("type", "endEvent");
    endNode.put("subType", "endEvent");
    endNode.put("name", "end");

    Map<String, Object> edge1 = new HashMap<>();
    edge1.put("from", "start");
    edge1.put("to", "task1");

    Map<String, Object> edge2 = new HashMap<>();
    edge2.put("from", "task1");
    edge2.put("to", "end");

    Map<String, Object> triggerConfig = new HashMap<>();
    triggerConfig.put("entityTypes", List.of("table"));
    triggerConfig.put("batchSize", 100);
    Map<String, Object> schedule = new HashMap<>();
    schedule.put("scheduleTimeline", "None");
    triggerConfig.put("schedule", schedule);

    Map<String, Object> trigger = new HashMap<>();
    trigger.put("type", "periodicBatchEntity");
    trigger.put("config", triggerConfig);

    Map<String, Object> initialRequest = new HashMap<>();
    initialRequest.put("name", ns.prefix("testUpdateValidation"));
    initialRequest.put("displayName", "Update Test Workflow");
    initialRequest.put("description", "Test workflow for update");
    initialRequest.put("trigger", trigger);
    initialRequest.put("nodes", List.of(startNode, task1Node, endNode));
    initialRequest.put("edges", List.of(edge1, edge2));

    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT, BASE_PATH, initialRequest, RequestOptions.builder().build());

    JsonNode created = MAPPER.readTree(createResponse);
    assertNotNull(created);

    Map<String, Object> task2Node = new HashMap<>();
    task2Node.put("type", "automatedTask");
    task2Node.put("subType", "setEntityAttributeTask");
    task2Node.put("name", "task2");
    Map<String, Object> task2Config = new HashMap<>();
    task2Config.put("fieldName", "tags");
    task2Config.put("fieldValue", "Test");
    task2Node.put("config", task2Config);

    Map<String, Object> cyclicEdge1 = new HashMap<>();
    cyclicEdge1.put("from", "start");
    cyclicEdge1.put("to", "task1");

    Map<String, Object> cyclicEdge2 = new HashMap<>();
    cyclicEdge2.put("from", "task1");
    cyclicEdge2.put("to", "task2");

    Map<String, Object> cyclicEdge3 = new HashMap<>();
    cyclicEdge3.put("from", "task2");
    cyclicEdge3.put("to", "task1");

    Map<String, Object> cyclicEdge4 = new HashMap<>();
    cyclicEdge4.put("from", "task1");
    cyclicEdge4.put("to", "end");

    Map<String, Object> cyclicUpdate = new HashMap<>();
    cyclicUpdate.put("name", ns.prefix("testUpdateValidation"));
    cyclicUpdate.put("displayName", "Update Test Workflow");
    cyclicUpdate.put("description", "Test workflow with cycle for update");
    cyclicUpdate.put("trigger", trigger);
    cyclicUpdate.put("nodes", List.of(startNode, task1Node, task2Node, endNode));
    cyclicUpdate.put("edges", List.of(cyclicEdge1, cyclicEdge2, cyclicEdge3, cyclicEdge4));

    Exception exception =
        assertThrows(
            Exception.class,
            () ->
                client
                    .getHttpClient()
                    .executeForString(
                        HttpMethod.PUT, BASE_PATH, cyclicUpdate, RequestOptions.builder().build()));

    assertNotNull(exception);

    Map<String, Object> validEdge1 = new HashMap<>();
    validEdge1.put("from", "start");
    validEdge1.put("to", "task1");

    Map<String, Object> validEdge2 = new HashMap<>();
    validEdge2.put("from", "task1");
    validEdge2.put("to", "task2");

    Map<String, Object> validEdge3 = new HashMap<>();
    validEdge3.put("from", "task2");
    validEdge3.put("to", "end");

    Map<String, Object> validUpdate = new HashMap<>();
    validUpdate.put("name", ns.prefix("testUpdateValidation"));
    validUpdate.put("displayName", "Updated Test Workflow");
    validUpdate.put("description", "Updated test workflow");
    validUpdate.put("trigger", trigger);
    validUpdate.put("nodes", List.of(startNode, task1Node, task2Node, endNode));
    validUpdate.put("edges", List.of(validEdge1, validEdge2, validEdge3));

    String updateResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT, BASE_PATH, validUpdate, RequestOptions.builder().build());

    assertNotNull(updateResponse);
    JsonNode updated = MAPPER.readTree(updateResponse);
    assertEquals("Updated Test Workflow", updated.get("displayName").asText());
    assertEquals(4, updated.get("nodes").size());
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
    request.put("type", "periodicBatchEntity");
    request.put("trigger", trigger);
    request.put("nodes", List.of(startNode, endNode));
    request.put("edges", List.of(edge));
    request.put("config", workflowConfig);

    return request;
  }
}
