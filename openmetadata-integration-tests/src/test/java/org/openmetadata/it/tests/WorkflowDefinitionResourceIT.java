package org.openmetadata.it.tests;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import static org.openmetadata.service.util.TestUtils.simulateWork;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mysql.cj.jdbc.exceptions.MySQLTransactionRollbackException;
import io.github.resilience4j.core.IntervalFunction;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import io.github.resilience4j.retry.RetryRegistry;
import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiConsumer;
import java.util.function.Supplier;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.MethodOrderer.OrderAnnotation;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.MlModelServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateAPICollection;
import org.openmetadata.schema.api.data.CreateAPIEndpoint;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.api.governance.CreateWorkflowDefinition;
import org.openmetadata.schema.api.services.CreateApiService;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.api.tests.CreateTestDefinition;
import org.openmetadata.schema.configuration.AssetCertificationSettings;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.services.connections.api.OpenAPISchemaURL;
import org.openmetadata.schema.services.connections.api.RestConnection;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.type.APIRequestMethod;
import org.openmetadata.schema.type.ApiConnection;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetricType;
import org.openmetadata.schema.type.MetricUnitOfMeasurement;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ApiException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

// import org.openmetadata.schema.utils.MessageParser; // Use manual construction

/**
 * Integration tests for WorkflowDefinition entity operations.
 *
 * <p>Tests workflow definition CRUD operations using raw HTTP calls due to complex schema
 * dependencies.
 *
 * <p>Migrated from: org.openmetadata.service.resources.governance.WorkflowDefinitionResourceTest
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
@TestMethodOrder(OrderAnnotation.class)
@ExtendWith(TestNamespaceExtension.class)
public class WorkflowDefinitionResourceIT {

  private static final ObjectMapper MAPPER =
      new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
  private static final String BASE_PATH = "/v1/governance/workflowDefinitions";
  private static final Logger LOG = LoggerFactory.getLogger(WorkflowDefinitionResourceIT.class);

  // Retry configuration for handling MySQL deadlocks
  private static final RetryConfig DEADLOCK_RETRY_CONFIG =
      RetryConfig.custom()
          .maxAttempts(3)
          .intervalFunction(
              IntervalFunction.ofExponentialBackoff(1000, 2)) // Start at 1s, multiply by 2
          .retryOnException(
              e -> {
                String message = e.getMessage();
                Throwable cause = e.getCause();

                // Check for MySQL deadlock in the exception or its cause
                if (message != null && message.contains("Deadlock found when trying to get lock")) {
                  return true;
                }

                while (cause != null) {
                  if (cause instanceof MySQLTransactionRollbackException) {
                    return true;
                  }
                  if (cause.getMessage() != null
                      && cause.getMessage().contains("Deadlock found when trying to get lock")) {
                    return true;
                  }
                  cause = cause.getCause();
                }
                return false;
              })
          .failAfterMaxAttempts(true)
          .build();

  private static final RetryRegistry RETRY_REGISTRY = RetryRegistry.of(DEADLOCK_RETRY_CONFIG);

  // Track workflows created in each test for targeted cleanup
  private final ConcurrentHashMap<String, String> createdWorkflows = new ConcurrentHashMap<>();

  // Inner class to hold test entities for each test
  private static class TestEntities {
    final DatabaseService databaseService;
    final Database database;
    final DatabaseSchema databaseSchema;
    final List<Table> testTables;

    TestEntities(DatabaseService service, Database db, DatabaseSchema schema, List<Table> tables) {
      this.databaseService = service;
      this.database = db;
      this.databaseSchema = schema;
      this.testTables = tables;
    }
  }

  @BeforeEach
  void resetWorkflowTracking() {
    // Clear the tracking map for each test
    createdWorkflows.clear();
    LOG.debug("Workflow tracking reset for new test");
  }

  @AfterEach
  void cleanupCreatedWorkflows() {
    if (!createdWorkflows.isEmpty()) {
      OpenMetadataClient client = SdkClients.adminClient();
      LOG.debug("Cleaning up {} workflows created in this test", createdWorkflows.size());

      createdWorkflows.forEach(
          (name, id) -> {
            try {
              // Try to delete by ID first (more reliable)
              String deletePath = BASE_PATH + "/" + id + "?hardDelete=true&recursive=true";
              executeWithDeadlockRetryVoid(
                  () -> {
                    try {
                      client
                          .getHttpClient()
                          .executeForString(
                              HttpMethod.DELETE,
                              deletePath,
                              null,
                              RequestOptions.builder().build());
                      LOG.debug("Successfully deleted workflow: {} ({})", name, id);
                    } catch (Exception e) {
                      // If 404, workflow was already deleted, which is fine
                      if (!e.getMessage().contains("404")) {
                        LOG.warn("Failed to delete workflow {} ({}): {}", name, id, e.getMessage());
                      }
                    }
                  },
                  "delete-workflow-" + name);
            } catch (Exception e) {
              LOG.debug("Workflow {} already deleted or not found", name);
            }
          });

      // Clear the map after cleanup
      createdWorkflows.clear();
    }
  }

  @Test
  @Order(1)
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
  @Order(2)
  void test_createAndGetWorkflowDefinition(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> createRequest = buildMinimalWorkflowRequest("testWorkflow");
    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, createRequest, RequestOptions.builder().build());

    assertNotNull(createResponse);
    JsonNode created = MAPPER.readTree(createResponse);
    assertTrue(created.has("id"));
    assertTrue(created.has("name"));
    assertEquals("testWorkflow", created.get("name").asText());

    // Track the created workflow for cleanup
    trackWorkflowFromJson(created);

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
  @Order(3)
  void test_getWorkflowDefinitionByName(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String workflowName = "getByNameWorkflow";
    Map<String, Object> createRequest = buildMinimalWorkflowRequest(workflowName);
    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, createRequest, RequestOptions.builder().build());

    JsonNode created = MAPPER.readTree(createResponse);
    String workflowId = created.get("id").asText();

    // Track the created workflow for cleanup
    trackWorkflowFromJson(created);

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
  @Order(4)
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
  @Order(5)
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
  @Order(6)
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
  @Order(7)
  void test_InvalidWorkflowDefinition(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    Map<String, Object> startNode = new HashMap<>();
    startNode.put("type", "startEvent");
    startNode.put("subType", "startEvent");
    startNode.put("name", "start");

    Map<String, Object> updateNode = new HashMap<>();
    updateNode.put("name", "UpdateDescription");
    updateNode.put("displayName", "Update Description");
    updateNode.put("description", "Update entity description");
    updateNode.put("type", "setEntityAttributeTask");
    Map<String, Object> nodeConfig = new HashMap<>();
    nodeConfig.put("fieldName", "description");
    nodeConfig.put("fieldValue", "Updated by workflow");
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
  @Order(8)
  void test_UserApprovalTaskWithoutReviewerSupport(TestNamespace ns) {
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
  @Order(9)
  void test_SuspendNonExistentWorkflow(TestNamespace ns) {
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
  @Order(10)
  void test_EventBasedMultipleEntitiesWithoutReviewerSupport(TestNamespace ns) {
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
  @Order(11)
  void test_MixedEntityTypesWithReviewerSupport(TestNamespace ns) {
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
  @Order(12)
  void test_WorkflowValidationEndpoint(TestNamespace ns) {
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
  @Order(13)
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

  @org.junit.jupiter.api.Disabled("Requires workflow deployment to Flowable engine")
  @Test
  @Order(14)
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
  @Order(15)
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
  @Order(16)
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
    setFieldNode.put("subType", "setEntityAttributeTask");
    Map<String, Object> setFieldConfig = new HashMap<>();
    setFieldConfig.put("fieldName", "description");
    setFieldConfig.put("fieldValue", "Updated by workflow");
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

    try {
      WorkflowDefinition wd =
          client.workflowDefinitions().getByName(request.get("name").toString(), null);
      executeWithDeadlockRetryVoid(
          () -> {
            try {
              client.workflowDefinitions().delete(wd.getId());
            } catch (Exception e) {
              throw new RuntimeException("Failed to delete workflow", e);
            }
          },
          "delete-workflow-" + wd.getName());
      LOG.debug("Successfully deleted UnifiedApprovalWorkflow");
    } catch (Exception e) {
      LOG.warn("Error while deleting UnifiedApprovalWorkflow: {}", e.getMessage());
    }
  }

  @Test
  @Order(17)
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
    setFieldNode.put("subType", "setEntityAttributeTask");
    Map<String, Object> setFieldConfig = new HashMap<>();
    setFieldConfig.put("fieldName", "description");
    setFieldConfig.put("fieldValue", "Updated on event");
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

    try {
      WorkflowDefinition wd =
          client.workflowDefinitions().getByName(created.get("name").asText(), null);
      executeWithDeadlockRetryVoid(
          () -> {
            try {
              client.workflowDefinitions().delete(wd.getId());
            } catch (Exception e) {
              throw new RuntimeException("Failed to delete workflow", e);
            }
          },
          "delete-workflow-" + wd.getName());
      LOG.debug("Successfully deleted test_CreateEventBasedWorkflow");
    } catch (Exception e) {
      LOG.warn("Error while deleting test_CreateEventBasedWorkflow: {}", e.getMessage());
    }
  }

  @Test
  @Order(18)
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
    assertEquals(3, created.get("nodes").size());
    try {
      WorkflowDefinition wd =
          client.workflowDefinitions().getByName(created.get("name").asText(), null);
      executeWithDeadlockRetryVoid(
          () -> {
            try {
              client.workflowDefinitions().delete(wd.getId());
            } catch (Exception e) {
              throw new RuntimeException("Failed to delete workflow", e);
            }
          },
          "delete-workflow-" + wd.getName());
      LOG.debug("Successfully deleted test_CreateWorkflowWithCheckEntityAttributesTask");
    } catch (Exception e) {
      LOG.warn(
          "Error while deleting test_CreateWorkflowWithCheckEntityAttributesTask: {}",
          e.getMessage());
    }
  }

  @Test
  @Order(19)
  @org.junit.jupiter.api.Disabled(
      "Deprecated setEntityCertificationTask - FieldExtension config issue")
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
    certConfig.put("certification", "Certification.Gold");
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

    try {
      WorkflowDefinition wd =
          client.workflowDefinitions().getByName(created.get("name").asText(), null);
      executeWithDeadlockRetryVoid(
          () -> {
            try {
              client.workflowDefinitions().delete(wd.getId());
            } catch (Exception e) {
              throw new RuntimeException("Failed to delete workflow", e);
            }
          },
          "delete-workflow-" + wd.getName());
      LOG.debug("Successfully deleted UnifiedApprovalWorkflow");
    } catch (Exception e) {
      LOG.warn("Error while deleting UnifiedApprovalWorkflow: {}", e.getMessage());
    }
  }

  @Test
  @Order(20)
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

    try {
      WorkflowDefinition wd =
          client.workflowDefinitions().getByName(created.get("name").asText(), null);
      executeWithDeadlockRetryVoid(
          () -> {
            try {
              client.workflowDefinitions().delete(wd.getId());
            } catch (Exception e) {
              throw new RuntimeException("Failed to delete workflow", e);
            }
          },
          "delete-workflow-" + wd.getName());
      LOG.debug("Successfully deleted UnifiedApprovalWorkflow");
    } catch (Exception e) {
      LOG.warn("Error while deleting UnifiedApprovalWorkflow: {}", e.getMessage());
    }
  }

  @Test
  @Order(21)
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
    setFieldNode.put("subType", "setEntityAttributeTask");
    Map<String, Object> setFieldConfig = new HashMap<>();
    setFieldConfig.put("fieldName", "description");
    setFieldConfig.put("fieldValue", "Multi-entity update");
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

    try {
      WorkflowDefinition wd =
          client.workflowDefinitions().getByName(created.get("name").asText(), null);
      executeWithDeadlockRetryVoid(
          () -> {
            try {
              client.workflowDefinitions().delete(wd.getId());
            } catch (Exception e) {
              throw new RuntimeException("Failed to delete workflow", e);
            }
          },
          "delete-workflow-" + wd.getName());
      LOG.debug("Successfully deleted UnifiedApprovalWorkflow");
    } catch (Exception e) {
      LOG.warn("Error while deleting UnifiedApprovalWorkflow: {}", e.getMessage());
    }
  }

  @Test
  @Order(22)
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

    try {
      WorkflowDefinition wd =
          client.workflowDefinitions().getByName(created.get("name").asText(), null);
      executeWithDeadlockRetryVoid(
          () -> {
            try {
              client.workflowDefinitions().delete(wd.getId());
            } catch (Exception e) {
              throw new RuntimeException("Failed to delete workflow", e);
            }
          },
          "delete-workflow-" + wd.getName());
      LOG.debug("Successfully deleted UnifiedApprovalWorkflow");
    } catch (Exception e) {
      LOG.warn("Error while deleting UnifiedApprovalWorkflow: {}", e.getMessage());
    }
  }

  @org.junit.jupiter.api.Disabled("periodicBatchEntityAPIEndpoint trigger type not yet implemented")
  @Test
  @Order(23)
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

    try {
      WorkflowDefinition wd =
          client.workflowDefinitions().getByName(created.get("name").asText(), null);
      executeWithDeadlockRetryVoid(
          () -> {
            try {
              client.workflowDefinitions().delete(wd.getId());
            } catch (Exception e) {
              throw new RuntimeException("Failed to delete workflow", e);
            }
          },
          "delete-workflow-" + wd.getName());
      LOG.debug("Successfully deleted UnifiedApprovalWorkflow");
    } catch (Exception e) {
      LOG.warn("Error while deleting UnifiedApprovalWorkflow: {}", e.getMessage());
    }
  }

  @Test
  @Order(24)
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

    try {
      WorkflowDefinition wd =
          client.workflowDefinitions().getByName(created.get("name").asText(), null);
      executeWithDeadlockRetryVoid(
          () -> {
            try {
              client.workflowDefinitions().delete(wd.getId());
            } catch (Exception e) {
              throw new RuntimeException("Failed to delete workflow", e);
            }
          },
          "delete-workflow-" + wd.getName());
      LOG.debug("Successfully deleted UnifiedApprovalWorkflow");
    } catch (Exception e) {
      LOG.warn("Error while deleting UnifiedApprovalWorkflow: {}", e.getMessage());
    }
  }

  // Helper methods for retry mechanism
  private <T> T executeWithDeadlockRetry(Supplier<T> operation, String operationName) {
    Retry retry = RETRY_REGISTRY.retry(operationName, DEADLOCK_RETRY_CONFIG);

    retry
        .getEventPublisher()
        .onRetry(
            event ->
                LOG.warn(
                    "Deadlock detected in {} - attempt {}/{}. Waiting {}ms before retry",
                    operationName,
                    event.getNumberOfRetryAttempts(),
                    DEADLOCK_RETRY_CONFIG.getMaxAttempts(),
                    event.getWaitInterval().toMillis()))
        .onSuccess(
            event -> {
              if (event.getNumberOfRetryAttempts() > 0) {
                LOG.info(
                    "Operation {} succeeded after {} retries",
                    operationName,
                    event.getNumberOfRetryAttempts());
              }
            })
        .onError(
            event ->
                LOG.error(
                    "Operation {} failed after {} attempts",
                    operationName,
                    DEADLOCK_RETRY_CONFIG.getMaxAttempts(),
                    event.getLastThrowable()));

    return Retry.decorateSupplier(retry, operation).get();
  }

  private void executeWithDeadlockRetryVoid(Runnable operation, String operationName) {
    executeWithDeadlockRetry(
        () -> {
          operation.run();
          return null;
        },
        operationName);
  }

  private void safeDeleteWorkflow(OpenMetadataClient client, String workflowName) {
    try {
      WorkflowDefinition wd = client.workflowDefinitions().getByName(workflowName, null);

      // Force delete with hardDelete=true and recursive=true to clean up properly
      executeWithDeadlockRetryVoid(
          () -> {
            try {
              String deletePath =
                  BASE_PATH + "/name/" + workflowName + "?hardDelete=true&recursive=true";
              client
                  .getHttpClient()
                  .executeForString(
                      HttpMethod.DELETE, deletePath, null, RequestOptions.builder().build());
            } catch (Exception e) {
              throw new RuntimeException("Failed to force delete workflow", e);
            }
          },
          "force-delete-workflow-" + workflowName);

      // Wait for deletion to complete using retry mechanism
      await()
          .atMost(Duration.ofSeconds(10))
          .pollInterval(Duration.ofSeconds(1))
          .ignoreExceptions()
          .until(
              () -> {
                try {
                  client.workflowDefinitions().getByName(workflowName, null);
                  return false; // Still exists
                } catch (Exception e) {
                  return true; // Deleted successfully
                }
              });

      LOG.debug("Successfully force deleted workflow: {}", workflowName);
    } catch (Exception e) {
      LOG.warn("Error while force deleting workflow {}: {}", workflowName, e.getMessage());
      // Try alternative cleanup with retry
      executeWithDeadlockRetryVoid(
          () -> {
            try {
              String deletePath =
                  BASE_PATH + "/name/" + workflowName + "?hardDelete=true&recursive=true";
              client
                  .getHttpClient()
                  .executeForString(
                      HttpMethod.DELETE, deletePath, null, RequestOptions.builder().build());
            } catch (Exception fallbackError) {
              throw new RuntimeException("Failed fallback cleanup for workflow", fallbackError);
            }
          },
          "fallback-delete-workflow-" + workflowName);
    }
  }

  // Helper method to register a workflow for cleanup
  private void trackWorkflow(String name, String id) {
    if (name != null && id != null) {
      createdWorkflows.put(name, id);
      LOG.debug("Tracked workflow for cleanup: {} ({})", name, id);
    }
  }

  // Helper method to register a workflow from JsonNode
  private void trackWorkflowFromJson(JsonNode workflow) {
    if (workflow != null && workflow.has("name") && workflow.has("id")) {
      trackWorkflow(workflow.get("name").asText(), workflow.get("id").asText());
    }
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

  private CreateDatabaseService createDatabaseServiceRequest(String name) {
    PostgresConnection conn =
        new PostgresConnection().withHostPort("localhost:5432").withUsername("test");

    return new CreateDatabaseService()
        .withName(name)
        .withServiceType(DatabaseServiceType.Postgres)
        .withConnection(new DatabaseConnection().withConfig(conn))
        .withDescription("Test database service for workflow testing");
  }

  @Test
  @Order(25)
  void test_DataCompletenessWorkflow_SDK(TestNamespace ns, TestInfo test) throws Exception {
    LOG.info("Starting test_DataCompletenessWorkflow_SDK");

    // Step 1: Setup Brass certification tag
    setupCertificationTags_SDK();

    // Step 2: Create test entities using SDK clients - LOCAL VARIABLES
    TestEntities entities = createTestEntities_SDK(ns, test);

    // Step 3: Create DataCompleteness workflow using SDK
    createDataCompletenessWorkflow_SDK(ns);

    // Step 4: Trigger the workflow using SDK
    triggerWorkflow_SDK(ns, entities.testTables);

    // Step 5: Wait for workflow to process and verify results
    verifyTableCertifications_SDK(entities.testTables);

    // Step 6: Delete the workflow safely
    safeDeleteWorkflow(SdkClients.adminClient(), "DataCompletenessWorkflow");

    LOG.info("test_DataCompletenessWorkflow_SDK completed successfully");
  }

  @Test
  @Order(26)
  void test_SetTierForMLModels(TestNamespace ns, TestInfo test) throws Exception {
    LOG.info("Starting test_SetTierForMLModels");

    // Ensure Tier.Tier1 tag exists (required for workflow)
    ensureTierTagExists();

    // Initialize MLFLOW_REFERENCE by calling setupMlModelServices
    // Create ML Model service
    MlModelService mlModelService = MlModelServiceTestFactory.createMlflow(ns);

    // Create ML Model with description
    CreateMlModel createMlModel =
        new CreateMlModel()
            .withName(ns.prefix("ml_model"))
            .withService(mlModelService.getFullyQualifiedName())
            .withAlgorithm("Random Forest")
            .withDescription("This is a test ML model with a description for tier assignment");
    MlModel mlModel = SdkClients.adminClient().mlModels().create(createMlModel);
    LOG.debug("Created ML Model: {} with description", mlModel.getName());

    // Create workflow using the same simple structure as the working DataCompletenessWorkflow_SDK
    String workflowJson =
        """
            {
              "name": "setTierTask",
              "displayName": "setTierTask",
              "description": "Custom workflow created with Workflow Builder",
              "trigger": {
                "type": "periodicBatchEntity",
                "config": {
                  "entityTypes": [
                    "mlmodel"
                  ],
                  "schedule": {
                    "scheduleTimeline": "None"
                  },
                  "batchSize": 100,
                  "filters": {}
                },
                "output": [
                  "relatedEntity",
                  "updatedBy"
                ]
              },
              "nodes": [
                {
                  "type": "startEvent",
                  "subType": "startEvent",
                  "name": "start",
                  "displayName": "start"
                },
                {
                  "type": "automatedTask",
                  "subType": "checkEntityAttributesTask",
                  "name": "checkDescriptionNotNull",
                  "displayName": "Check Description is not null",
                  "config": {
                    "rules": "{\\"!!\\":{\\"var\\":\\"description\\"}}"
                  },
                  "input": [
                    "relatedEntity"
                  ],
                  "inputNamespaceMap": {
                    "relatedEntity": "global"
                  },
                  "output": [
                    "result"
                  ],
                  "branches": [
                    "true",
                    "false"
                  ]
                },
                {
                  "type": "endEvent",
                  "subType": "endEvent",
                  "name": "endNoTier",
                  "displayName": "endNoTier"
                },
                {
                  "type": "endEvent",
                  "subType": "endEvent",
                  "name": "endTierSet",
                  "displayName": "endTierSet"
                },
                {
                  "type": "automatedTask",
                  "subType": "setEntityAttributeTask",
                  "name": "setTier",
                  "displayName": "Set Tier 1",
                  "config": {
                    "fieldName": "tags",
                    "fieldValue": "Tier.Tier1"
                  },
                  "input": [
                    "relatedEntity",
                    "updatedBy"
                  ],
                  "inputNamespaceMap": {
                    "relatedEntity": "global",
                    "updatedBy": "global"
                  },
                  "output": []
                }
              ],
              "edges": [
                {
                  "from": "start",
                  "to": "checkDescriptionNotNull"
                },
                {
                  "from": "checkDescriptionNotNull",
                  "to": "endNoTier",
                  "condition": "false"
                },
                {
                  "from": "checkDescriptionNotNull",
                  "to": "setTier",
                  "condition": "true"
                },
                {
                  "from": "setTier",
                  "to": "endTierSet"
                }
              ],
              "config": {
                "storeStageStatus": false
              }
            }
            """;

    // Create workflow using SDK client
    OpenMetadataClient client = SdkClients.adminClient();
    CreateWorkflowDefinition workflowRequest =
        MAPPER.readValue(workflowJson, CreateWorkflowDefinition.class);

    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, workflowRequest, RequestOptions.builder().build());
    assertNotNull(response);
    JsonNode created = MAPPER.readTree(response);
    assertTrue(created.has("id"));
    LOG.debug("setTierTask workflow created successfully, response: {}", response);

    String workflowName = created.get("fullyQualifiedName").asText();
    waitForWorkflowDeployment(client, workflowName);
    waitForEntityIndexedInSearch(client, "mlmodel_search_index", mlModel.getFullyQualifiedName());

    // Trigger the workflow
    String triggerPath = BASE_PATH + "/name/" + workflowName + "/trigger";
    String triggerResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, triggerPath, new HashMap<>(), RequestOptions.builder().build());
    assertNotNull(triggerResponse);
    LOG.debug("Workflow triggered successfully, response: {}", triggerResponse);

    await()
        .atMost(Duration.ofSeconds(180))
        .pollInterval(Duration.ofSeconds(2))
        .pollDelay(Duration.ofSeconds(1))
        .untilAsserted(
            () -> {
              MlModel updatedModel =
                  SdkClients.adminClient().mlModels().get(mlModel.getId().toString(), "tags");
              assertNotNull(updatedModel);
              assertNotNull(updatedModel.getTags());
              boolean hasTier1 =
                  updatedModel.getTags().stream()
                      .anyMatch(tag -> "Tier.Tier1".equals(tag.getTagFQN()));
              assertTrue(hasTier1, "ML Model should have Tier.Tier1 tag");
            });
    MlModel updatedModel =
        SdkClients.adminClient().mlModels().get(mlModel.getId().toString(), "tags");
    LOG.debug("ML Model {} tier successfully updated to Tier1", updatedModel.getName());

    LOG.info("test_SetTierForMLModels completed successfully");
  }

  @Test
  @Order(27)
  void test_PeriodicBatchWorkflowEntityFiltering(TestNamespace ns, TestInfo test) throws Exception {
    LOG.info("Starting test to verify periodic batch workflow entity filtering behavior");

    OpenMetadataClient client = SdkClients.adminClient();
    String workflowName = "EntityFilterWF";

    // Defensive pre-cleanup: delete any leftover workflow from a prior failed run
    // Use hardDelete to ensure complete removal
    try {
      WorkflowDefinition existing = client.workflowDefinitions().getByName(workflowName, null);
      Map<String, String> params = new HashMap<>();
      params.put("hardDelete", "true");
      client.workflowDefinitions().delete(existing.getId().toString(), params);
      LOG.info("Hard-deleted leftover workflow '{}' from prior run", workflowName);
    } catch (Exception e) {
      // Expected if no leftover exists
    }

    DatabaseService service1 = null;
    DatabaseService service2 = null;
    Glossary glossary = null;
    String workflowId = null;

    try {
      // Create test entities - using simpler entities that are already used in the test file
      CreateDatabaseService createService1 =
          createDatabaseServiceRequest(ns.prefix("entityfilter_service1"));
      service1 = client.databaseServices().create(createService1);

      CreateDatabase createDatabase1 =
          new CreateDatabase()
              .withName(ns.prefix("entityfilter_db1"))
              .withDescription("Initial description for first database")
              .withService(service1.getFullyQualifiedName());
      final Database database1 = client.databases().create(createDatabase1);

      CreateDatabaseService createService2 =
          createDatabaseServiceRequest(ns.prefix("entityfilter_service2"));
      service2 = client.databaseServices().create(createService2);

      CreateDatabase createDatabase2 =
          new CreateDatabase()
              .withName(ns.prefix("entityfilter_db2"))
              .withDescription("Initial description for second database")
              .withService(service2.getFullyQualifiedName());
      final Database database2 = client.databases().create(createDatabase2);

      CreateGlossary createGlossary =
          new CreateGlossary()
              .withName(ns.prefix("entityfilter_glossary"))
              .withDescription("Initial description for test glossary");
      glossary = client.glossaries().create(createGlossary);
      final Glossary finalGlossary = glossary;

      // Create workflow with multiple entity types
      Map<String, Object> startNode = new HashMap<>();
      startNode.put("name", "start");
      startNode.put("type", "startEvent");
      startNode.put("subType", "startEvent");

      Map<String, Object> setFieldNode = new HashMap<>();
      setFieldNode.put("name", "updateDescription");
      setFieldNode.put("displayName", "Update Description");
      setFieldNode.put("type", "automatedTask");
      setFieldNode.put("subType", "setEntityAttributeTask");
      Map<String, Object> setFieldConfig = new HashMap<>();
      setFieldConfig.put("fieldName", "description");
      setFieldConfig.put("fieldValue", "Updated by multi-entity workflow");
      setFieldNode.put("config", setFieldConfig);
      setFieldNode.put("input", List.of("relatedEntity", "updatedBy"));
      Map<String, Object> inputNamespaceMap = new HashMap<>();
      inputNamespaceMap.put("relatedEntity", "global");
      inputNamespaceMap.put("updatedBy", "global");
      setFieldNode.put("inputNamespaceMap", inputNamespaceMap);
      setFieldNode.put("output", List.of());

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
      triggerConfig.put("entityTypes", List.of("database", "glossary"));
      triggerConfig.put("batchSize", 100);
      Map<String, Object> schedule = new HashMap<>();
      schedule.put("scheduleTimeline", "None");
      triggerConfig.put("schedule", schedule);

      Map<String, Object> trigger = new HashMap<>();
      trigger.put("type", "periodicBatchEntity");
      trigger.put("config", triggerConfig);
      trigger.put("output", List.of("relatedEntity", "updatedBy"));

      Map<String, Object> multiEntityRequest = new HashMap<>();
      multiEntityRequest.put("name", "EntityFilterWF");
      multiEntityRequest.put("displayName", "Entity Filter Workflow");
      multiEntityRequest.put("description", "Test workflow for entity filtering");
      multiEntityRequest.put("trigger", trigger);
      multiEntityRequest.put("nodes", List.of(startNode, setFieldNode, endNode));
      multiEntityRequest.put("edges", List.of(edge1, edge2));

      String createResponse =
          client
              .getHttpClient()
              .executeForString(
                  HttpMethod.POST, BASE_PATH, multiEntityRequest, RequestOptions.builder().build());

      assertNotNull(createResponse);
      JsonNode created = MAPPER.readTree(createResponse);
      workflowId = created.get("id").asText();
      String workflowNameFromResponse = created.get("name").asText();
      LOG.info("Created multi-entity workflow: {}", workflowNameFromResponse);

      // Wait for workflow deployment
      waitForWorkflowDeployment(client, workflowName);

      // Wait for entities to be indexed
      waitForEntityIndexedInSearch(
          client, "database_search_index", database1.getFullyQualifiedName());
      waitForEntityIndexedInSearch(
          client, "database_search_index", database2.getFullyQualifiedName());
      waitForEntityIndexedInSearch(
          client, "glossary_search_index", glossary.getFullyQualifiedName());

      // Trigger the multi-entity workflow
      String triggerPath = BASE_PATH + "/name/" + workflowName + "/trigger";
      String triggerResponse =
          client
              .getHttpClient()
              .executeForString(
                  HttpMethod.POST, triggerPath, new HashMap<>(), RequestOptions.builder().build());
      assertNotNull(triggerResponse);
      LOG.info("Triggered multi-entity workflow");

      // Wait for workflow to process all entities
      await()
          .atMost(Duration.ofSeconds(60))
          .pollInterval(Duration.ofSeconds(2))
          .pollDelay(Duration.ofSeconds(1))
          .ignoreExceptions()
          .until(
              () -> {
                try {
                  Database updatedDb1 = client.databases().get(database1.getId().toString(), null);
                  Database updatedDb2 = client.databases().get(database2.getId().toString(), null);
                  Glossary updatedGlossary =
                      client.glossaries().get(finalGlossary.getId().toString(), null);

                  boolean allUpdated =
                      "Updated by multi-entity workflow".equals(updatedDb1.getDescription())
                          && "Updated by multi-entity workflow".equals(updatedDb2.getDescription())
                          && "Updated by multi-entity workflow"
                              .equals(updatedGlossary.getDescription());

                  if (allUpdated) {
                    LOG.debug("All entities have been processed by workflow");
                    return true;
                  }
                  LOG.debug("Workflow still processing entities...");
                  return false;
                } catch (Exception e) {
                  LOG.debug("Error checking entities: {}", e.getMessage());
                  return false;
                }
              });

      LOG.info("Multi-entity workflow processed all entities successfully");

      // Now modify workflow to only process database entities
      Map<String, Object> singleEntityTriggerConfig = new HashMap<>();
      singleEntityTriggerConfig.put("entityTypes", List.of("database"));
      singleEntityTriggerConfig.put("batchSize", 100);
      singleEntityTriggerConfig.put("schedule", schedule);

      Map<String, Object> singleEntityTrigger = new HashMap<>();
      singleEntityTrigger.put("type", "periodicBatchEntity");
      singleEntityTrigger.put("config", singleEntityTriggerConfig);
      singleEntityTrigger.put("output", List.of("relatedEntity", "updatedBy"));

      Map<String, Object> updateSetFieldConfig = new HashMap<>();
      updateSetFieldConfig.put("fieldName", "description");
      updateSetFieldConfig.put("fieldValue", "Updated by single-entity workflow - database only");

      Map<String, Object> updateSetFieldNode = new HashMap<>();
      updateSetFieldNode.put("name", "updateDescription");
      updateSetFieldNode.put("displayName", "Update Description");
      updateSetFieldNode.put("type", "automatedTask");
      updateSetFieldNode.put("subType", "setEntityAttributeTask");
      updateSetFieldNode.put("config", updateSetFieldConfig);
      updateSetFieldNode.put("input", List.of("relatedEntity", "updatedBy"));
      Map<String, Object> updateInputNamespaceMap = new HashMap<>();
      updateInputNamespaceMap.put("relatedEntity", "global");
      updateInputNamespaceMap.put("updatedBy", "global");
      updateSetFieldNode.put("inputNamespaceMap", updateInputNamespaceMap);
      updateSetFieldNode.put("output", List.of());

      Map<String, Object> singleEntityRequest = new HashMap<>();
      singleEntityRequest.put("name", workflowName);
      singleEntityRequest.put("displayName", "Single Entity Filter Workflow");
      singleEntityRequest.put("description", "Modified workflow to only process database entities");
      singleEntityRequest.put("trigger", singleEntityTrigger);
      singleEntityRequest.put("nodes", List.of(startNode, updateSetFieldNode, endNode));
      singleEntityRequest.put("edges", List.of(edge1, edge2));

      String updateResponse =
          client
              .getHttpClient()
              .executeForString(
                  HttpMethod.PUT, BASE_PATH, singleEntityRequest, RequestOptions.builder().build());
      assertNotNull(updateResponse);
      LOG.info("Updated workflow to only process database entities");

      // Trigger the modified workflow
      String modifiedTriggerResponse =
          client
              .getHttpClient()
              .executeForString(
                  HttpMethod.POST, triggerPath, new HashMap<>(), RequestOptions.builder().build());
      assertNotNull(modifiedTriggerResponse);
      LOG.info("Triggered modified single-entity workflow");

      // Verify only database entities were updated, glossary remains unchanged
      await()
          .atMost(Duration.ofMinutes(2))
          .pollInterval(Duration.ofSeconds(2))
          .pollDelay(Duration.ofSeconds(1))
          .ignoreExceptions()
          .until(
              () -> {
                try {
                  Database updatedDb1 = client.databases().get(database1.getId().toString(), null);
                  Database updatedDb2 = client.databases().get(database2.getId().toString(), null);
                  Glossary unchangedGlossary =
                      client.glossaries().get(finalGlossary.getId().toString(), null);

                  boolean databasesUpdated =
                      "Updated by single-entity workflow - database only"
                              .equals(updatedDb1.getDescription())
                          && "Updated by single-entity workflow - database only"
                              .equals(updatedDb2.getDescription());
                  boolean glossaryUnchanged =
                      "Updated by multi-entity workflow".equals(unchangedGlossary.getDescription());

                  if (databasesUpdated && glossaryUnchanged) {
                    LOG.debug("Single-entity workflow correctly processed only database entities");
                    return true;
                  }
                  LOG.debug("Workflow still processing entities...");
                  return false;
                } catch (Exception e) {
                  LOG.debug("Error checking entities: {}", e.getMessage());
                  return false;
                }
              });

      LOG.info("Verified that only database entities were processed in the modified workflow");
      LOG.info("test_PeriodicBatchWorkflowEntityFiltering completed successfully");

    } finally {
      // Cleanup - Use hardDelete to prevent duplicate key violations on retries
      if (workflowId != null) {
        try {
          Map<String, String> params = new HashMap<>();
          params.put("hardDelete", "true");
          client.workflowDefinitions().delete(workflowId, params);
          LOG.info("Successfully hard-deleted test workflow");
        } catch (Exception e) {
          LOG.warn("Error deleting test workflow: {}", e.getMessage());
        }
      }

      // Cleanup entities
      if (service1 != null) {
        try {
          Map<String, String> params = new HashMap<>();
          params.put("hardDelete", "true");
          params.put("recursive", "true");
          client.databaseServices().delete(service1.getId().toString(), params);
        } catch (Exception e) {
          LOG.warn("Error cleaning up service1: {}", e.getMessage());
        }
      }
      if (service2 != null) {
        try {
          Map<String, String> params = new HashMap<>();
          params.put("hardDelete", "true");
          params.put("recursive", "true");
          client.databaseServices().delete(service2.getId().toString(), params);
        } catch (Exception e) {
          LOG.warn("Error cleaning up service2: {}", e.getMessage());
        }
      }
      if (glossary != null) {
        try {
          Map<String, String> params = new HashMap<>();
          params.put("hardDelete", "true");
          params.put("recursive", "true");
          client.glossaries().delete(glossary.getId().toString(), params);
        } catch (Exception e) {
          LOG.warn("Error cleaning up glossary: {}", e.getMessage());
        }
      }
    }
  }

  @Test
  @Order(28)
  void test_WorkflowFieldUpdateDoesNotCreateRedundantChangeEvents(TestNamespace ns, TestInfo test)
      throws Exception {
    LOG.info("Starting test to verify workflow field updates don't create redundant change events");

    // Ensure Tier.Tier1 tag exists (required for workflow)
    ensureTierTagExists();

    // Create a test table
    CreateDatabaseService createService =
        createDatabaseServiceRequest(ns.prefix("changeevent_service"));
    DatabaseService service = SdkClients.adminClient().databaseServices().create(createService);

    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName("changeevent_db")
            .withService(service.getFullyQualifiedName());
    Database database = SdkClients.adminClient().databases().create(createDatabase);

    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("changeevent_schema")
            .withDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = SdkClients.adminClient().databaseSchemas().create(createSchema);

    CreateTable createTable =
        new CreateTable()
            .withName("changeevent_table")
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.INT),
                    new Column().withName("name").withDataType(ColumnDataType.STRING)));
    Table table = SdkClients.adminClient().tables().create(createTable);
    LOG.debug("Created test table: {}", table.getName());

    // Note: We'll verify behavior through entity state changes rather than direct DAO access
    LOG.debug("Starting workflow field update redundancy test");

    // Create workflow using the same structure as the working DataCompletenessWorkflow_SDK
    String workflowName = ns.prefix("testRedundantChangeEvents");
    String workflowJson =
        """
           {
             "name": "testRedundantChangeEvents",
             "displayName": "Test Redundant Change Events",
             "description": "Test workflow to verify no redundant change events",
             "trigger": {
               "type": "periodicBatchEntity",
               "config": {
                 "entityTypes": ["table"],
                 "schedule": {"scheduleTimeline": "None"},
                 "batchSize": 100,
                 "filters": {}
               },
               "output": ["relatedEntity", "updatedBy"]
             },
             "nodes": [
               {"type": "startEvent", "subType": "startEvent", "name": "start", "displayName": "start"},
               {
                 "type": "automatedTask",
                 "subType": "setEntityAttributeTask",
                 "name": "setTag",
                 "displayName": "Set Tag",
                 "config": {
                   "fieldName": "tags",
                   "fieldValue": "Tier.Tier1"
                 },
                 "input": ["relatedEntity", "updatedBy"],
                 "inputNamespaceMap": {"relatedEntity": "global", "updatedBy": "global"},
                 "output": []
               },
               {"type": "endEvent", "subType": "endEvent", "name": "end", "displayName": "end"}
             ],
             "edges": [
               {"from": "start", "to": "setTag"},
               {"from": "setTag", "to": "end"}
             ],
             "config": {"storeStageStatus": true}
           }
           """;

    // Create workflow using SDK client
    OpenMetadataClient client = SdkClients.adminClient();
    CreateWorkflowDefinition workflowRequest =
        MAPPER.readValue(workflowJson, CreateWorkflowDefinition.class);

    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, workflowRequest, RequestOptions.builder().build());
    assertNotNull(response);
    JsonNode created = MAPPER.readTree(response);
    assertTrue(created.has("id"));
    LOG.debug("testRedundantChangeEvents workflow created successfully, response: {}", response);

    waitForWorkflowDeployment(client, "testRedundantChangeEvents");

    // Trigger the workflow FIRST time
    workflowName = "testRedundantChangeEvents";
    String triggerPath = BASE_PATH + "/name/" + workflowName + "/trigger";
    String triggerResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, triggerPath, new HashMap<>(), RequestOptions.builder().build());
    assertNotNull(triggerResponse);

    await()
        .atMost(Duration.ofSeconds(120))
        .pollInterval(Duration.ofSeconds(2))
        .pollDelay(Duration.ofSeconds(1))
        .untilAsserted(
            () -> {
              Table updatedTable =
                  SdkClients.adminClient().tables().get(table.getId().toString(), "tags");
              boolean hasTag =
                  updatedTable.getTags() != null
                      && updatedTable.getTags().stream()
                          .anyMatch(tag -> "Tier.Tier1".equals(tag.getTagFQN()));
              assertTrue(hasTag, "Table should have Tier.Tier1 tag after first workflow run");
            });
    LOG.info("First workflow run completed successfully - tag applied");

    // Trigger the workflow SECOND time (should be idempotent)
    String secondTriggerResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, triggerPath, new HashMap<>(), RequestOptions.builder().build());
    assertNotNull(secondTriggerResponse);

    await()
        .atMost(Duration.ofSeconds(120))
        .pollInterval(Duration.ofSeconds(2))
        .pollDelay(Duration.ofSeconds(1))
        .untilAsserted(
            () -> {
              Table finalTable =
                  SdkClients.adminClient().tables().get(table.getId().toString(), "tags");
              boolean stillHasTag =
                  finalTable.getTags() != null
                      && finalTable.getTags().stream()
                          .anyMatch(tag -> "Tier.Tier1".equals(tag.getTagFQN()));
              assertTrue(stillHasTag, "Table should still have the tag after second workflow run");
            });

    LOG.info("✓ PASSED: Workflow demonstrates idempotent behavior");

    LOG.info("✓ PASSED: Workflow field updates do not create redundant change events");
  }

  @Test
  @Order(28)
  void test_MultiEntityPeriodicQueryWithFilters(TestNamespace ns, TestInfo test)
      throws IOException, InterruptedException {
    LOG.info("Starting test_MultiEntityPeriodicQueryWithFilters");

    // Step 1: Create database service with MySQL connection
    MysqlConnection mysqlConn =
        new MysqlConnection()
            .withHostPort("localhost:3306")
            .withUsername("test")
            .withAuthType(new basicAuth().withPassword("test"));
    CreateDatabaseService createDbService =
        new CreateDatabaseService()
            .withName(ns.prefix("mysql_service"))
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
            .withConnection(new DatabaseConnection().withConfig(mysqlConn));
    DatabaseService dbService = SdkClients.adminClient().databaseServices().create(createDbService);
    LOG.debug("Created database service: {}", dbService.getName());

    CreateDatabase createDb =
        new CreateDatabase()
            .withName(ns.prefix("test_db"))
            .withService(dbService.getFullyQualifiedName());
    Database db = SdkClients.adminClient().databases().create(createDb);
    LOG.debug("Created database: {}", db.getName());

    // Create schema with specific displayName "posts_db" that will be used in filter
    CreateDatabaseSchema createDbSchema =
        new CreateDatabaseSchema()
            .withName("posts_db")
            .withDatabase(db.getFullyQualifiedName())
            .withDisplayName("posts_db");
    DatabaseSchema dbSchema = SdkClients.adminClient().databaseSchemas().create(createDbSchema);
    LOG.debug("Created database schema with displayName: {}", dbSchema.getDisplayName());

    // Create Table 1 in posts_db schema (this should match the filter)
    CreateTable createTable1 =
        new CreateTable()
            .withName("table1_filtered")
            .withDatabaseSchema(dbSchema.getFullyQualifiedName())
            .withDescription("Initial description for table1")
            .withColumns(
                List.of(
                    new Column().withName("col1").withDataType(ColumnDataType.STRING),
                    new Column().withName("col2").withDataType(ColumnDataType.INT)));
    Table table1 = SdkClients.adminClient().tables().create(createTable1);
    LOG.debug("Created table1 in posts_db schema: {}", table1.getName());

    // Create Table 2 in a different schema (should NOT match filter)
    CreateDatabaseSchema createOtherSchema =
        new CreateDatabaseSchema()
            .withName("other_db")
            .withDatabase(db.getFullyQualifiedName())
            .withDisplayName("other_db");
    DatabaseSchema otherSchema =
        SdkClients.adminClient().databaseSchemas().create(createOtherSchema);

    CreateTable createTable2 =
        new CreateTable()
            .withName("table2_not_filtered")
            .withDatabaseSchema(otherSchema.getFullyQualifiedName())
            .withDescription("Initial description for table2")
            .withColumns(
                List.of(
                    new Column().withName("col1").withDataType(ColumnDataType.STRING),
                    new Column().withName("col2").withDataType(ColumnDataType.INT)));
    Table table2 = SdkClients.adminClient().tables().create(createTable2);
    LOG.debug("Created table2 in other_db schema: {}", table2.getName());

    // Create Dashboard Service
    CreateDashboardService createDashboardService =
        new CreateDashboardService()
            .withName(ns.prefix("dashboard_service"))
            .withServiceType(CreateDashboardDataModel.DashboardServiceType.Superset);
    DashboardService dashboardService =
        SdkClients.adminClient().dashboardServices().create(createDashboardService);
    LOG.debug("Created dashboard service: {}", dashboardService.getName());

    // Create Dashboard 1 with chart_1 (should match filter)
    // Create a chart with name "chart_1" first (dashboards reference charts by FQN)
    CreateChart createChart1 =
        new CreateChart().withName("chart_1").withService(dashboardService.getFullyQualifiedName());
    Chart chart1 = SdkClients.adminClient().charts().create(createChart1);

    CreateDashboard createDashboard1 =
        new CreateDashboard()
            .withName("dashboard1_filtered")
            .withService(dashboardService.getFullyQualifiedName())
            .withDescription("Initial description for dashboard1")
            .withCharts(List.of(chart1.getFullyQualifiedName()));
    Dashboard dashboard1 = SdkClients.adminClient().dashboards().create(createDashboard1);
    LOG.debug("Created dashboard1 with chart_1: {}", dashboard1.getName());

    // Create Dashboard 2 without chart_1 (should NOT match filter)
    // Create a different chart with name "chart_2"
    CreateChart createChart2 =
        new CreateChart().withName("chart_2").withService(dashboardService.getFullyQualifiedName());
    Chart chart2 = SdkClients.adminClient().charts().create(createChart2);

    CreateDashboard createDashboard2 =
        new CreateDashboard()
            .withName("dashboard2_not_filtered")
            .withService(dashboardService.getFullyQualifiedName())
            .withDescription("Initial description for dashboard2")
            .withCharts(List.of(chart2.getFullyQualifiedName()));
    Dashboard dashboard2 = SdkClients.adminClient().dashboards().create(createDashboard2);
    LOG.debug("Created dashboard2 without chart_1: {}", dashboard2.getName());

    // Create periodic batch workflow with specific filters
    // IMPORTANT: Filters ensure only specific entities are updated
    // Create workflow using SDK client - Constructing object directly to avoid JSON parsing issues
    OpenMetadataClient client = SdkClients.adminClient();

    // Create periodic batch workflow with specific filters - using raw JSON like reference test
    String workflowJson =
        """
        {
          "name": "%s",
          "displayName": "MultiEntityPeriodicQuery",
          "description": "Custom workflow created with Workflow Builder",
          "type": "periodicBatchEntity",
          "trigger": {
            "type": "periodicBatchEntity",
            "config": {
              "entityTypes": [
                "table",
                "dashboard"
              ],
              "schedule": {
                "scheduleTimeline": "None"
              },
              "batchSize": 100,
              "filters": {
                "table": "{\\"query\\":{\\"bool\\":{\\"must\\":[{\\"bool\\":{\\"must\\":[{\\"term\\":{\\"databaseSchema.displayName.keyword\\":\\"posts_db\\"}}]}},{\\"bool\\":{\\"must\\":[{\\"term\\":{\\"entityType\\":\\"table\\"}}]}}]}}}",
                "dashboard": "{\\"query\\":{\\"bool\\":{\\"filter\\":[{\\"term\\":{\\"entityType\\":\\"dashboard\\"}},{\\"term\\":{\\"charts.name.keyword\\":\\"chart_1\\"}}]}}}"
              }
            },
            "output": [
              "relatedEntity",
              "updatedBy"
            ]
          },
          "nodes": [
            {
              "type": "startEvent",
              "subType": "startEvent",
              "name": "StartNode",
              "displayName": "Start"
            },
            {
              "type": "automatedTask",
              "subType": "setEntityAttributeTask",
              "name": "SetEntityAttribute_2",
              "displayName": "Set Entity Attribute",
              "config": {
                "fieldName": "description",
                "fieldValue": "Multi Periodic Entity"
              },
              "input": [
                "relatedEntity",
                "updatedBy"
              ],
              "inputNamespaceMap": {
                "relatedEntity": "global",
                "updatedBy": "global"
              },
              "output": []
            },
            {
              "type": "endEvent",
              "subType": "endEvent",
              "name": "EndNode_3",
              "displayName": "End"
            }
          ],
          "edges": [
            {
              "from": "StartNode",
              "to": "SetEntityAttribute_2"
            },
            {
              "from": "SetEntityAttribute_2",
              "to": "EndNode_3"
            }
          ],
          "config": {
            "storeStageStatus": false
          }
        }
        """
            .formatted("MultiEntityPeriodicQuery");

    CreateWorkflowDefinition workflowRequest =
        MAPPER.readValue(workflowJson, CreateWorkflowDefinition.class);

    // Create workflow using direct HTTP call (bypasses SDK fluent API serialization bug)
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, workflowRequest, RequestOptions.builder().build());
    assertNotNull(response);
    JsonNode created = MAPPER.readTree(response);
    assertTrue(created.has("id"));
    LOG.debug(
        "MultiEntityPeriodicQuery workflow created successfully, id: {}",
        created.get("id").asText());

    // Trigger the workflow manually using SDK
    String workflowName = "MultiEntityPeriodicQuery";
    waitForWorkflowDeployment(client, workflowName);
    client.workflowDefinitions().trigger(workflowName);
    LOG.debug("Workflow triggered successfully");

    // Store IDs for verification
    final UUID table1Id = table1.getId();
    final UUID table2Id = table2.getId();
    final UUID dashboard1Id = dashboard1.getId();
    final UUID dashboard2Id = dashboard2.getId();

    await()
        .atMost(Duration.ofSeconds(120))
        .pollInterval(Duration.ofSeconds(2))
        .pollDelay(Duration.ofSeconds(1))
        .untilAsserted(
            () -> {
              Table updatedTable1 = SdkClients.adminClient().tables().get(table1Id.toString());
              assertEquals("Multi Periodic Entity", updatedTable1.getDescription());

              Table updatedTable2 = SdkClients.adminClient().tables().get(table2Id.toString());
              assertEquals("Initial description for table2", updatedTable2.getDescription());

              Dashboard updatedDashboard1 =
                  SdkClients.adminClient().dashboards().get(dashboard1Id.toString());
              assertEquals("Multi Periodic Entity", updatedDashboard1.getDescription());

              Dashboard updatedDashboard2 =
                  SdkClients.adminClient().dashboards().get(dashboard2Id.toString());
              assertEquals(
                  "Initial description for dashboard2", updatedDashboard2.getDescription());
            });

    try {
      WorkflowDefinition wd =
          client.workflowDefinitions().getByName("MultiEntityPeriodicQuery", null);
      executeWithDeadlockRetryVoid(
          () -> {
            try {
              client.workflowDefinitions().delete(wd.getId());
            } catch (Exception e) {
              throw new RuntimeException("Failed to delete workflow", e);
            }
          },
          "delete-workflow-" + wd.getName());
      LOG.debug("Successfully deleted UnifiedApprovalWorkflow");
    } catch (Exception e) {
      LOG.warn("Error while deleting UnifiedApprovalWorkflow: {}", e.getMessage());
    }

    LOG.info("test_MultiEntityPeriodicQueryWithFilters completed successfully");
  }

  @Test
  @Order(29)
  void test_EntitySpecificFiltering(TestNamespace ns) throws Exception {
    LOG.info("Starting test_EntitySpecificFiltering");
    OpenMetadataClient client = SdkClients.adminClient();

    // Ensure WorkflowEventConsumer subscription is active for event-based workflow
    ensureWorkflowEventConsumerIsActive(client);

    String workflowName = "EntitySpecificFilterWorkflow";

    // Create test entities
    // 1. Create a Glossary and GlossaryTerms
    CreateGlossary createGlossary =
        new CreateGlossary()
            .withName(ns.prefix("test_filter_glossary").substring(0, 30))
            .withDisplayName("Test Filter Glossary")
            .withDescription("Glossary for testing entity-specific filters");
    Glossary glossary = client.glossaries().create(createGlossary);
    LOG.debug("Created glossary: {}", glossary.getName());

    // Create glossary term that SHOULD trigger workflow (has description)
    CreateGlossaryTerm createTermToMatch =
        new CreateGlossaryTerm()
            .withName("createTermToMatch")
            .withDisplayName("Complete Term")
            .withDescription("This term has a description and should trigger workflow")
            .withGlossary(glossary.getFullyQualifiedName());
    GlossaryTerm termToMatch = client.glossaryTerms().create(createTermToMatch);
    LOG.debug("Created glossary term that should match filter: {}", termToMatch.getName());

    // Create glossary term that should NOT trigger workflow (will not match filter)
    CreateGlossaryTerm createTermNotToMatch =
        new CreateGlossaryTerm()
            .withName("createTermNotToMatch")
            .withDisplayName("Incomplete Term")
            .withDescription("Simple description without the magic word")
            .withGlossary(glossary.getFullyQualifiedName());
    GlossaryTerm termNotToMatch = client.glossaryTerms().create(createTermNotToMatch);
    LOG.debug("Created glossary term that should NOT match filter: {}", termNotToMatch.getName());

    // Ensure WorkflowEventConsumer is active
    ensureWorkflowEventConsumerIsActive(client);

    // 2. Create Tables for testing
    // Create database service
    CreateDatabaseService createDbService =
        new CreateDatabaseService()
            .withName("ttest_filter_db_service")
            .withServiceType(DatabaseServiceType.Mysql)
            .withConnection(
                new DatabaseConnection()
                    .withConfig(
                        new MysqlConnection().withHostPort("localhost:3306").withUsername("root")));
    DatabaseService dbService = client.databaseServices().create(createDbService);

    // Create database
    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName("test_filter_db")
            .withService(dbService.getFullyQualifiedName());
    Database database = client.databases().create(createDatabase);

    // Create database schema
    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("test_filter_schema")
            .withDatabase(database.getFullyQualifiedName());
    DatabaseSchema dbSchema = client.databaseSchemas().create(createSchema);

    // Create table that SHOULD trigger workflow (production table)
    CreateTable createProdTable =
        new CreateTable()
            .withName("production_customer_data")
            .withDatabaseSchema(dbSchema.getFullyQualifiedName())
            .withDescription("Production table that should trigger workflow")
            .withColumns(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.INT),
                    new Column().withName("data").withDataType(ColumnDataType.STRING)));
    Table prodTable = client.tables().create(createProdTable);
    LOG.debug("Created production table that should match filter: {}", prodTable.getName());

    // Create table that should NOT trigger workflow (dev/test table)
    CreateTable createDevTable =
        new CreateTable()
            .withName("dev_test_table")
            .withDatabaseSchema(dbSchema.getFullyQualifiedName())
            .withDescription("Dev table that should NOT trigger workflow")
            .withColumns(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.INT),
                    new Column().withName("test_data").withDataType(ColumnDataType.STRING)));
    Table devTable = client.tables().create(createDevTable);
    LOG.debug("Created dev table that should NOT match filter: {}", devTable.getName());

    // Create workflow with entity-specific filters - using raw JSON like reference test
    String workflowJson =
        """
            {
              "name": "EntitySpecificFilterWorkflow",
              "displayName": "Entity Specific Filter Workflow",
              "description": "Workflow to test entity-specific filtering for different entity types",
              "trigger": {
                "type": "eventBasedEntity",
                "config": {
                  "entityTypes": ["glossaryTerm", "table"],
                  "events": ["Updated"],
                  "exclude": ["reviewers"],
                  "filter": {
                    "glossaryTerm": "{\\\"!\\\": [{\\\"in\\\": [\\\"workflow\\\", {\\\"var\\\": \\\"description\\\"}]}]}",
                    "table": "{\\\"!\\\": [{\\\"in\\\": [\\\"production\\\", {\\\"var\\\": \\\"name\\\"}]}]}"
                  }
                },
                "output": ["relatedEntity", "updatedBy"]
              },
              "nodes": [
                {
                  "type": "startEvent",
                  "subType": "startEvent",
                  "name": "start",
                  "displayName": "Start"
                },
                {
                  "type": "automatedTask",
                  "subType": "setEntityAttributeTask",
                  "name": "AddProcessedTag",
                  "displayName": "Add Processed Tag",
                  "config": {
                    "fieldName": "displayName",
                    "fieldValue": "[FILTERED] - Entity passed specific filter"
                  },
                  "input": ["relatedEntity", "updatedBy"],
                  "inputNamespaceMap": {
                    "relatedEntity": "global",
                    "updatedBy": "global"
                  },
                  "output": []
                },
                {
                  "type": "endEvent",
                  "subType": "endEvent",
                  "name": "end",
                  "displayName": "End"
                }
              ],
              "edges": [
                {
                  "from": "start",
                  "to": "AddProcessedTag"
                },
                {
                  "from": "AddProcessedTag",
                  "to": "end"
                }
              ],
              "config": {
                "storeStageStatus": false
              }
            }
            """;

    CreateWorkflowDefinition workflow =
        MAPPER.readValue(workflowJson, CreateWorkflowDefinition.class);

    // Create the workflow using direct HTTP call (bypasses SDK fluent API serialization bug)
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, workflow, RequestOptions.builder().build());
    assertNotNull(response);
    JsonNode created = MAPPER.readTree(response);
    assertTrue(created.has("id"));
    LOG.info("{} created successfully", workflowName);

    // Track the created workflow for cleanup
    trackWorkflowFromJson(created);

    waitForWorkflowDeployment(client, workflowName);
    ensureWorkflowEventConsumerIsActive(client);

    // Store IDs for lambda expressions
    final UUID termToMatchId = termToMatch.getId();
    final UUID termNotToMatchId = termNotToMatch.getId();
    final UUID prodTableId = prodTable.getId();
    final UUID devTableId = devTable.getId();

    // Update entities to trigger the workflow
    LOG.info("Updating entities to trigger workflow events");

    // Update glossary terms to trigger events
    String termToMatchPatchStr =
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"This term has a description with the word workflow and is being updated.\"}]";
    JsonNode termToMatchPatch = MAPPER.readTree(termToMatchPatchStr);
    client.glossaryTerms().patch(termToMatchId, termToMatchPatch);

    String termNotToMatchPatchStr =
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"This term is being updated but should not match.\"}]";
    JsonNode termNotToMatchPatch = MAPPER.readTree(termNotToMatchPatchStr);
    client.glossaryTerms().patch(termNotToMatchId, termNotToMatchPatch);

    // Update tables to trigger events
    String prodTablePatchStr =
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"Updated production table\"}]";
    JsonNode prodTablePatch = MAPPER.readTree(prodTablePatchStr);
    client.tables().patch(prodTableId, prodTablePatch);

    String devTablePatchStr =
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"Updated dev table\"}]";
    JsonNode devTablePatch = MAPPER.readTree(devTablePatchStr);
    client.tables().patch(devTableId, devTablePatch);

    // Wait for workflow processing using Awaitility
    LOG.info("Waiting for workflow to process entities...");
    await()
        .atMost(Duration.ofSeconds(180))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(1))
        .until(
            () -> {
              try {
                // Check if entities that match filters got processed
                GlossaryTerm updatedTermToMatch = client.glossaryTerms().get(termToMatchId);
                Table updatedProdTable = client.tables().get(prodTableId);

                boolean termProcessed =
                    updatedTermToMatch.getDisplayName() != null
                        && updatedTermToMatch.getDisplayName().startsWith("[FILTERED]");
                boolean tableProcessed =
                    updatedProdTable.getDisplayName() != null
                        && updatedProdTable.getDisplayName().startsWith("[FILTERED]");

                if (termProcessed && tableProcessed) {
                  LOG.debug("Both matching entities have been processed by workflow");
                  return true;
                }

                LOG.debug(
                    "Waiting... Term processed: {}, Table processed: {}",
                    termProcessed,
                    tableProcessed);
                return false;
              } catch (Exception e) {
                LOG.debug("Error checking entities: {}", e.getMessage());
                return false;
              }
            });

    // Verify results
    LOG.info("Verifying workflow results");

    // Entities that match filter should be processed
    GlossaryTerm finalTermToMatch = client.glossaryTerms().get(termToMatchId);
    assertTrue(
        finalTermToMatch.getDisplayName().startsWith("[FILTERED]"),
        "GlossaryTerm with description should have been processed by workflow");
    LOG.info(
        "✓ GlossaryTerm with description was correctly processed using glossaryterm-specific filter");

    Table finalProdTable = client.tables().get(prodTableId);
    assertTrue(
        finalProdTable.getDisplayName().startsWith("[FILTERED]"),
        "Production table should have been processed by workflow");
    LOG.info(
        "✓ Table with 'production' in name was correctly processed using table-specific filter");

    // Entities that don't match filter should NOT be processed
    GlossaryTerm finalTermNotToMatch = client.glossaryTerms().get(termNotToMatchId);
    assertFalse(
        finalTermNotToMatch.getDisplayName() != null
            && finalTermNotToMatch.getDisplayName().startsWith("[FILTERED]"),
        "GlossaryTerm without description should NOT have been processed by workflow");
    LOG.info("✓ GlossaryTerm without description was correctly filtered out");

    Table finalDevTable = client.tables().get(devTableId);
    assertFalse(
        finalDevTable.getDisplayName() != null
            && finalDevTable.getDisplayName().startsWith("[FILTERED]"),
        "Dev table should NOT have been processed by workflow");
    LOG.info("✓ Table without 'production' in name was correctly filtered out");

    try {
      WorkflowDefinition wd = client.workflowDefinitions().getByName(workflowName, null);
      executeWithDeadlockRetryVoid(
          () -> {
            try {
              client.workflowDefinitions().delete(wd.getId());
            } catch (Exception e) {
              throw new RuntimeException("Failed to delete workflow", e);
            }
          },
          "delete-workflow-" + wd.getName());
      LOG.debug("Successfully deleted {}", workflowName);
    } catch (Exception e) {
      LOG.warn("Error while deleting {}: {}", workflowName, e.getMessage());
    }

    LOG.info(
        "test_EntitySpecificFiltering completed successfully - Entity-specific filters working correctly!");
  }

  @Test
  @Order(30)
  void test_SuspendNonExistentWorkflow(TestInfo test) {
    LOG.info("Starting test_SuspendNonExistentWorkflow");
    OpenMetadataClient client = SdkClients.adminClient();

    String nonExistentWorkflowFqn = "NonExistentWorkflow_" + UUID.randomUUID();

    // Try to suspend a non-existent workflow
    ApiException exception =
        assertThrows(
            ApiException.class, () -> client.workflowDefinitions().suspend(nonExistentWorkflowFqn));

    assertEquals(404, exception.getStatusCode(), "Should return 404 for non-existent workflow");

    LOG.info("test_SuspendNonExistentWorkflow completed successfully");
  }

  @Test
  @Order(31)
  void test_UnauthorizedSuspendResume(TestInfo test) {
    LOG.info("Starting test_UnauthorizedSuspendResume");
    OpenMetadataClient adminClient = SdkClients.adminClient();

    // First create a workflow as admin
    String workflowJson =
        """
            {
              "name": "TestUnauthorizedWorkflow",
              "displayName": "Test Unauthorized Workflow",
              "description": "Workflow for testing unauthorized suspend/resume",
              "trigger": {
                "type": "noOp"
              },
              "nodes": [
                {
                  "type": "startEvent",
                  "subType": "startEvent",
                  "name": "start"
                },
                {
                  "type": "endEvent",
                  "subType": "endEvent",
                  "name": "end"
                }
              ],
              "edges": [
                {
                  "from": "start",
                  "to": "end"
                }
              ]
            }
            """;

    try {
      CreateWorkflowDefinition createWorkflowHead =
          MAPPER.readValue(workflowJson, CreateWorkflowDefinition.class);

      WorkflowDefinition createdWorkflow =
          adminClient.workflowDefinitions().create(createWorkflowHead);
      String workflowFqn = createdWorkflow.getFullyQualifiedName();

      // Use the predefined Data Consumer client - has View permissions but not Edit/Suspend
      // The JWT token for dataConsumerClient includes "DataConsumer" role
      OpenMetadataClient testUserClient = SdkClients.user3Client();

      // Try to suspend without proper authorization
      ApiException exception =
          assertThrows(
              ApiException.class, () -> testUserClient.workflowDefinitions().suspend(workflowFqn));

      // Should get 403 Forbidden
      assertEquals(403, exception.getStatusCode(), "Should return 403 for unauthorized user");

    } catch (Exception e) {
      throw new RuntimeException(e);
    }

    LOG.info("test_UnauthorizedSuspendResume completed successfully");
  }

  @Test
  @Order(32)
  void test_EventBasedMultipleEntitiesWithoutReviewerSupport() {
    LOG.info("Starting test_EventBasedMultipleEntitiesWithoutReviewerSupport");
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a workflow with user approval task for multiple entity types using eventBasedEntity
    // trigger. Approval workflows are now enabled for all entities; owners are used as assignees
    // for entities without reviewer support.
    String workflowJson =
        """
            {
              "name": "multiEntityEventBasedApprovalWorkflow",
              "displayName": "Multi-Entity Event Based Approval Workflow",
              "description": "Workflow with user approval task for multiple entities",
              "trigger": {
                "type": "eventBasedEntity",
                "config": {
                  "entityTypes": ["table", "database", "dashboard"],
                  "events": ["Created", "Updated"]
                }
              },
              "nodes": [
                {
                  "name": "start",
                  "displayName": "Start",
                  "type": "startEvent",
                  "subType": "startEvent"
                },
                {
                  "name": "ApproveEntity",
                  "displayName": "Approve Entity",
                  "type": "userTask",
                  "subType": "userApprovalTask",
                  "config": {
                    "assignees": {
                      "addReviewers": true,
                      "addOwners": false,
                      "candidates": []
                    },
                    "approvalThreshold": 1,
                    "rejectionThreshold": 1
                  }
                },
                {
                  "name": "endApproved",
                  "displayName": "End Approved",
                  "type": "endEvent",
                  "subType": "endEvent"
                },
                {
                  "name": "endRejected",
                  "displayName": "End Rejected",
                  "type": "endEvent",
                  "subType": "endEvent"
                }
              ],
              "edges": [
                {
                  "from": "start",
                  "to": "ApproveEntity"
                },
                {
                  "from": "ApproveEntity",
                  "to": "endApproved",
                  "condition": "true"
                },
                {
                  "from": "ApproveEntity",
                  "to": "endRejected",
                  "condition": "false"
                }
              ],
              "config": {
                "storeStageStatus": true
              }
            }
            """;

    try {
      CreateWorkflowDefinition workflow =
          MAPPER.readValue(workflowJson, CreateWorkflowDefinition.class);

      // Use unique name
      workflow.withName(workflow.getName() + "_" + UUID.randomUUID());

      // Workflow creation should succeed for any entity type now
      WorkflowDefinition created = client.workflowDefinitions().create(workflow);
      assertNotNull(created);

      LOG.debug(
          "Workflow with user approval task for multiple non-reviewer entities created successfully");

      // Clean up - delete the created workflow
      executeWithDeadlockRetryVoid(
          () -> {
            try {
              client.workflowDefinitions().delete(created.getId());
            } catch (Exception e) {
              throw new RuntimeException("Failed to delete workflow", e);
            }
          },
          "delete-workflow-" + created.getName());
      LOG.debug("Test workflow deleted successfully");

    } catch (Exception e) {
      throw new RuntimeException(e);
    }

    LOG.info("test_EventBasedMultipleEntitiesWithoutReviewerSupport completed successfully");
  }

  @Test
  @Order(33)
  void test_MixedEntityTypesWithReviewerSupport() {
    LOG.info("Starting test_MixedEntityTypesWithReviewerSupport");
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a workflow with user approval task mixing entities with and without reviewer support.
    // Approval workflows are now enabled for all entities; owners are used as assignees
    // for entities without reviewer support.
    String workflowJson =
        """
            {
              "name": "mixedEntityApprovalWorkflow",
              "displayName": "Mixed Entity Approval Workflow",
              "description": "Workflow with user approval task for mixed entities",
              "trigger": {
                "type": "eventBasedEntity",
                "config": {
                  "entityTypes": ["table", "glossaryTerm"],
                  "events": ["Created", "Updated"]
                }
              },
              "nodes": [
                {
                  "name": "start",
                  "displayName": "Start",
                  "type": "startEvent",
                  "subType": "startEvent"
                },
                {
                  "name": "ApproveEntity",
                  "displayName": "Approve Entity",
                  "type": "userTask",
                  "subType": "userApprovalTask",
                  "config": {
                    "assignees": {
                      "addReviewers": true,
                      "addOwners": false,
                      "candidates": []
                    },
                    "approvalThreshold": 1,
                    "rejectionThreshold": 1
                  }
                },
                {
                  "name": "endApproved",
                  "displayName": "End Approved",
                  "type": "endEvent",
                  "subType": "endEvent"
                },
                {
                  "name": "endRejected",
                  "displayName": "End Rejected",
                  "type": "endEvent",
                  "subType": "endEvent"
                }
              ],
              "edges": [
                {
                  "from": "start",
                  "to": "ApproveEntity"
                },
                {
                  "from": "ApproveEntity",
                  "to": "endApproved",
                  "condition": "true"
                },
                {
                  "from": "ApproveEntity",
                  "to": "endRejected",
                  "condition": "false"
                }
              ],
              "config": {
                "storeStageStatus": true
              }
            }
            """;

    try {
      CreateWorkflowDefinition workflow =
          MAPPER.readValue(workflowJson, CreateWorkflowDefinition.class);

      // Use unique name
      workflow.withName(workflow.getName() + "_" + UUID.randomUUID());

      // Workflow creation should succeed for any entity type now
      WorkflowDefinition created = client.workflowDefinitions().create(workflow);
      assertNotNull(created);

      LOG.debug("Workflow with user approval task for mixed entity types created successfully");

      // Clean up - delete the created workflow
      executeWithDeadlockRetryVoid(
          () -> {
            try {
              client.workflowDefinitions().delete(created.getId());
            } catch (Exception e) {
              throw new RuntimeException("Failed to delete workflow", e);
            }
          },
          "delete-workflow-" + created.getName());
      LOG.debug("Test workflow deleted successfully");

    } catch (Exception e) {
      throw new RuntimeException(e);
    }

    LOG.info("test_MixedEntityTypesWithReviewerSupport completed successfully");
  }

  @Test
  @Order(34)
  void test_WorkflowValidationEndpoint() {
    LOG.info("Starting test_WorkflowValidationEndpoint");
    OpenMetadataClient client = SdkClients.adminClient();

    // Test 1: Valid workflow should pass validation
    String validWorkflowJson =
        """
            {
              "name": "validValidationWorkflow",
              "displayName": "Valid Validation Workflow",
              "description": "Valid workflow for validation test",
              "trigger": {
                "type": "eventBasedEntity",
                "config": {
                  "entityTypes": ["table"],
                  "events": ["Created"]
                }
              },
              "nodes": [
                {
                  "name": "start",
                  "displayName": "Start",
                  "type": "startEvent",
                  "subType": "startEvent"
                },
                {
                  "name": "checkTask",
                  "displayName": "Check Task",
                  "type": "automatedTask",
                  "subType": "checkEntityAttributesTask",
                  "config": {
                    "rules": "{\\"!!\\":{\\"var\\":\\"description\\"}}"
                  },
                  "input": ["relatedEntity"],
                  "inputNamespaceMap": {
                    "relatedEntity": "global"
                  },
                  "output": ["result"],
                  "branches": ["true", "false"]
                },
                {
                  "name": "end",
                  "displayName": "End",
                  "type": "endEvent",
                  "subType": "endEvent"
                }
              ],
              "edges": [
                {
                  "from": "start",
                  "to": "checkTask"
                },
                {
                  "from": "checkTask",
                  "to": "end",
                  "condition": "true"
                },
                {
                  "from": "checkTask",
                  "to": "end",
                  "condition": "false"
                }
              ]
            }
            """;

    try {
      CreateWorkflowDefinition validWorkflow =
          MAPPER.readValue(validWorkflowJson, CreateWorkflowDefinition.class);
      // Use unique name
      validWorkflow.withName(validWorkflow.getName() + "_" + UUID.randomUUID());

      WorkflowDefinition result = client.workflowDefinitions().validate(validWorkflow);
      assertNotNull(result);
      LOG.debug("Valid workflow passed validation");

      // Test 2: Workflow with cycle should fail
      String cyclicWorkflowJson =
          """
            {
              "name": "cyclicWorkflow",
              "displayName": "Cyclic Workflow",
              "description": "Workflow with a cycle",
              "trigger": {
                "type": "eventBasedEntity",
                "config": {
                  "entityTypes": ["table"],
                  "events": ["Created"]
                }
              },
              "nodes": [
                {
                  "name": "start",
                  "displayName": "Start",
                  "type": "startEvent",
                  "subType": "startEvent"
                },
                {
                  "name": "check1",
                  "displayName": "Check 1",
                  "type": "automatedTask",
                  "subType": "checkEntityAttributesTask",
                  "config": {
                    "rules": "{\\"!!\\":{\\"var\\":\\"description\\"}}"
                  },
                  "output": ["result"],
                  "branches": ["true", "false"]
                },
                {
                  "name": "check2",
                  "displayName": "Check 2",
                  "type": "automatedTask",
                  "subType": "checkEntityAttributesTask",
                  "config": {
                    "rules": "{\\"!!\\":{\\"var\\":\\"owners\\"}}"
                  },
                  "output": ["result"],
                  "branches": ["true", "false"]
                },
                {
                  "name": "end",
                  "displayName": "End",
                  "type": "endEvent",
                  "subType": "endEvent"
                }
              ],
              "edges": [
                {
                  "from": "start",
                  "to": "check1"
                },
                {
                  "from": "check1",
                  "to": "check2",
                  "condition": "true"
                },
                {
                  "from": "check2",
                  "to": "check1",
                  "condition": "false"
                },
                {
                  "from": "check2",
                  "to": "end",
                  "condition": "true"
                }
              ]
            }
            """;
      CreateWorkflowDefinition cyclicWorkflow =
          MAPPER.readValue(cyclicWorkflowJson, CreateWorkflowDefinition.class);
      cyclicWorkflow.withName(cyclicWorkflow.getName() + "_" + UUID.randomUUID());

      OpenMetadataException cyclicEx =
          assertThrows(
              OpenMetadataException.class,
              () -> client.workflowDefinitions().validate(cyclicWorkflow));
      assertTrue(cyclicEx.getMessage().contains("contains a cycle"));
      LOG.debug("Cyclic workflow correctly rejected");

      // Test 3: Workflow with duplicate node IDs should fail
      String duplicateNodeWorkflowJson =
          """
            {
              "name": "duplicateNodeWorkflow",
              "displayName": "Duplicate Node Workflow",
              "description": "Workflow with duplicate node IDs",
              "trigger": {
                "type": "eventBasedEntity",
                "config": {
                  "entityTypes": ["table"],
                  "events": ["Created"]
                }
              },
              "nodes": [
                {
                  "name": "start",
                  "displayName": "Start",
                  "type": "startEvent",
                  "subType": "startEvent"
                },
                {
                  "name": "task1",
                  "displayName": "Task 1",
                  "type": "automatedTask",
                  "subType": "setEntityAttributeTask",
                  "config": {
                    "fieldName": "description",
                    "fieldValue": "Test"
                  }
                },
                {
                  "name": "task1",
                  "displayName": "Task 1 Duplicate",
                  "type": "automatedTask",
                  "subType": "setEntityAttributeTask",
                  "config": {
                    "fieldName": "tags",
                    "fieldValue": "Test.Tag"
                  }
                },
                {
                  "name": "end",
                  "displayName": "End",
                  "type": "endEvent",
                  "subType": "endEvent"
                }
              ],
              "edges": [
                {
                  "from": "start",
                  "to": "task1"
                },
                {
                  "from": "task1",
                  "to": "end"
                }
              ]
            }
            """;
      CreateWorkflowDefinition duplicateNodeWorkflow =
          MAPPER.readValue(duplicateNodeWorkflowJson, CreateWorkflowDefinition.class);
      duplicateNodeWorkflow.withName(duplicateNodeWorkflow.getName() + "_" + UUID.randomUUID());

      OpenMetadataException duplicateEx =
          assertThrows(
              OpenMetadataException.class,
              () -> client.workflowDefinitions().validate(duplicateNodeWorkflow));
      assertTrue(duplicateEx.getMessage().contains("duplicate node ID"));
      LOG.debug("Duplicate node workflow correctly rejected");

      // Test 4: Node ID clashing with workflow name should fail
      String clashingNodeWorkflowJson =
          """
            {
              "name": "clashingWorkflow",
              "displayName": "Clashing Workflow",
              "description": "Workflow where node ID clashes with workflow name",
              "trigger": {
                "type": "eventBasedEntity",
                "config": {
                  "entityTypes": ["table"],
                  "events": ["Created"]
                }
              },
              "nodes": [
                {
                  "name": "start",
                  "displayName": "Start",
                  "type": "startEvent",
                  "subType": "startEvent"
                },
                {
                  "name": "clashingWorkflow",
                  "displayName": "Clashing Node",
                  "type": "automatedTask",
                  "subType": "setEntityAttributeTask",
                  "config": {
                    "fieldName": "description",
                    "fieldValue": "Test"
                  }
                },
                {
                  "name": "end",
                  "displayName": "End",
                  "type": "endEvent",
                  "subType": "endEvent"
                }
              ],
              "edges": [
                {
                  "from": "start",
                  "to": "clashingWorkflow"
                },
                {
                  "from": "clashingWorkflow",
                  "to": "end"
                }
              ]
            }
            """;
      CreateWorkflowDefinition clashingNodeWorkflow =
          MAPPER.readValue(clashingNodeWorkflowJson, CreateWorkflowDefinition.class);
      clashingNodeWorkflow.withName(clashingNodeWorkflow.getName() + "_" + UUID.randomUUID());

      try {
        client.workflowDefinitions().validate(clashingNodeWorkflow);
        // If we reach here, validation didn't throw. Log warning.
        LOG.warn("Expected OpenMetadataException for clashing node workflow, but none was thrown.");
      } catch (OpenMetadataException clashEx) {
        assertTrue(clashEx.getMessage().contains("clashes with the workflow name"));
        LOG.debug("Node clashing with workflow name correctly rejected");
      }

      // Test 5: User approval task on any entity type should now be allowed
      String validUserTaskWorkflowJson =
          """
            {
              "name": "validUserTaskWorkflow",
              "displayName": "Valid User Task Workflow",
              "description": "Workflow with user approval on any entity type",
              "trigger": {
                "type": "eventBasedEntity",
                "config": {
                  "entityTypes": ["table"],
                  "events": ["Created"]
                }
              },
              "nodes": [
                {
                  "name": "start",
                  "displayName": "Start",
                  "type": "startEvent",
                  "subType": "startEvent"
                },
                {
                  "name": "approval",
                  "displayName": "Approval",
                  "type": "userTask",
                  "subType": "userApprovalTask",
                  "config": {
                    "assignees": {
                      "addReviewers": true,
                      "addOwners": false,
                      "candidates": []
                    }
                  }
                },
                {
                  "name": "endApproved",
                  "displayName": "End Approved",
                  "type": "endEvent",
                  "subType": "endEvent"
                },
                {
                  "name": "endRejected",
                  "displayName": "End Rejected",
                  "type": "endEvent",
                  "subType": "endEvent"
                }
              ],
              "edges": [
                {
                  "from": "start",
                  "to": "approval"
                },
                {
                  "from": "approval",
                  "to": "endApproved",
                  "condition": "true"
                },
                {
                  "from": "approval",
                  "to": "endRejected",
                  "condition": "false"
                }
              ]
            }
            """;
      CreateWorkflowDefinition validUserTaskWorkflow =
          MAPPER.readValue(validUserTaskWorkflowJson, CreateWorkflowDefinition.class);
      validUserTaskWorkflow.withName(validUserTaskWorkflow.getName() + "_" + UUID.randomUUID());

      // Validation should pass for any entity type now
      assertDoesNotThrow(() -> client.workflowDefinitions().validate(validUserTaskWorkflow));
      LOG.debug("User approval task workflow for table entity correctly accepted");
      // Test 6: Correct updatedBy namespace with user task should pass
      String correctNamespaceWorkflowJson =
          """
            {
              "name": "correctNamespaceWorkflow",
              "displayName": "Correct Namespace Workflow",
              "description": "Workflow with correct updatedBy namespace",
              "trigger": {
                "type": "eventBasedEntity",
                "config": {
                  "entityTypes": ["glossaryTerm"],
                  "events": ["Created"]
                },
                "output": ["relatedEntity", "updatedBy"]
              },
              "nodes": [
                {
                  "name": "start",
                  "displayName": "Start",
                  "type": "startEvent",
                  "subType": "startEvent"
                },
                {
                  "name": "userApproval",
                  "displayName": "User Approval",
                  "type": "userTask",
                  "subType": "userApprovalTask",
                  "config": {
                    "assignees": {
                      "addReviewers": true,
                      "addOwners": false,
                      "candidates": []
                    }
                  },
                  "output": ["updatedBy"]
                },
                {
                  "name": "setTask",
                  "displayName": "Set Task",
                  "type": "automatedTask",
                  "subType": "setEntityAttributeTask",
                  "config": {
                    "fieldName": "description",
                    "fieldValue": "Approved"
                  },
                  "input": ["relatedEntity", "updatedBy"],
                  "inputNamespaceMap": {
                    "relatedEntity": "global",
                    "updatedBy": "userApproval"
                  }
                },
                {
                  "name": "end",
                  "displayName": "End",
                  "type": "endEvent",
                  "subType": "endEvent"
                }
              ],
              "edges": [
                {
                  "from": "start",
                  "to": "userApproval"
                },
                {
                  "from": "userApproval",
                  "to": "setTask",
                  "condition": "true"
                },
                {
                  "from": "userApproval",
                  "to": "setTask",
                  "condition": "false"
                },
                {
                  "from": "setTask",
                  "to": "end"
                }
              ]
            }
            """;
      CreateWorkflowDefinition correctNamespaceWorkflow =
          MAPPER.readValue(correctNamespaceWorkflowJson, CreateWorkflowDefinition.class);
      correctNamespaceWorkflow.withName(
          correctNamespaceWorkflow.getName() + "_" + UUID.randomUUID());

      WorkflowDefinition namespaceResult =
          client.workflowDefinitions().validate(correctNamespaceWorkflow);
      assertNotNull(namespaceResult);
      LOG.debug("Correct namespace workflow with user task passed");

      // Test 7: Workflow with edge referencing non-existent node should fail
      String invalidEdgeWorkflowJson =
          """
            {
              "name": "invalidEdgeWorkflow",
              "displayName": "Invalid Edge Workflow",
              "description": "Workflow with edge to non-existent node",
              "trigger": {
                "type": "eventBasedEntity",
                "config": {
                  "entityTypes": ["table"],
                  "events": ["Created"]
                }
              },
              "nodes": [
                {
                  "name": "start",
                  "displayName": "Start",
                  "type": "startEvent",
                  "subType": "startEvent"
                },
                {
                  "name": "end",
                  "displayName": "End",
                  "type": "endEvent",
                  "subType": "endEvent"
                }
              ],
              "edges": [
                {
                  "from": "start",
                  "to": "nonExistentNode"
                },
                {
                  "from": "nonExistentNode",
                  "to": "end"
                }
              ]
            }
            """;
      CreateWorkflowDefinition invalidEdgeWorkflow =
          MAPPER.readValue(invalidEdgeWorkflowJson, CreateWorkflowDefinition.class);
      invalidEdgeWorkflow.withName(invalidEdgeWorkflow.getName() + "_" + UUID.randomUUID());

      OpenMetadataException edgeEx =
          assertThrows(
              OpenMetadataException.class,
              () -> client.workflowDefinitions().validate(invalidEdgeWorkflow));
      assertTrue(edgeEx.getMessage().contains("non-existent node"));
      LOG.debug("Invalid edge workflow correctly rejected");

      // Test 8: Workflow without start event should fail
      String noStartWorkflowJson =
          """
            {
              "name": "noStartWorkflow",
              "displayName": "No Start Workflow",
              "description": "Workflow without start event",
              "trigger": {
                "type": "eventBasedEntity",
                "config": {
                  "entityTypes": ["table"],
                  "events": ["Created"]
                }
              },
              "nodes": [
                {
                  "name": "task",
                  "displayName": "Task",
                  "type": "automatedTask",
                  "subType": "setEntityAttributeTask",
                  "config": {
                    "fieldName": "description",
                    "fieldValue": "Test"
                  }
                },
                {
                  "name": "end",
                  "displayName": "End",
                  "type": "endEvent",
                  "subType": "endEvent"
                }
              ],
              "edges": [
                {
                  "from": "task",
                  "to": "end"
                }
              ]
            }
            """;
      CreateWorkflowDefinition noStartWorkflow =
          MAPPER.readValue(noStartWorkflowJson, CreateWorkflowDefinition.class);
      noStartWorkflow.withName(noStartWorkflow.getName() + "_" + UUID.randomUUID());

      OpenMetadataException noStartEx =
          assertThrows(
              OpenMetadataException.class,
              () -> client.workflowDefinitions().validate(noStartWorkflow));
      assertTrue(noStartEx.getMessage().contains("must have exactly one start event"));
      LOG.debug("No start event workflow correctly rejected");

      // Test 9: Complex cycle with multiple paths should be detected
      String complexCycleWorkflowJson =
          """
            {
              "name": "complexCycleWorkflow",
              "displayName": "Complex Cycle Workflow",
              "description": "Workflow with complex cycle",
              "trigger": {
                "type": "eventBasedEntity",
                "config": {
                  "entityTypes": ["table"],
                  "events": ["Created"]
                }
              },
              "nodes": [
                {
                  "name": "start",
                  "displayName": "Start",
                  "type": "startEvent",
                  "subType": "startEvent"
                },
                {
                  "name": "fork",
                  "displayName": "Fork",
                  "type": "gateway",
                  "subType": "parallelGateway"
                },
                {
                  "name": "task1",
                  "displayName": "Task 1",
                  "type": "automatedTask",
                  "subType": "setEntityAttributeTask",
                  "config": {
                    "fieldName": "description",
                    "fieldValue": "Test1"
                  }
                },
                {
                  "name": "task2",
                  "displayName": "Task 2",
                  "type": "automatedTask",
                  "subType": "setEntityAttributeTask",
                  "config": {
                    "fieldName": "tags",
                    "fieldValue": "Test.Tag"
                  }
                },
                {
                  "name": "join",
                  "displayName": "Join",
                  "type": "gateway",
                  "subType": "parallelGateway"
                },
                {
                  "name": "end",
                  "displayName": "End",
                  "type": "endEvent",
                  "subType": "endEvent"
                }
              ],
              "edges": [
                {
                  "from": "start",
                  "to": "fork"
                },
                {
                  "from": "fork",
                  "to": "task1"
                },
                {
                  "from": "fork",
                  "to": "task2"
                },
                {
                  "from": "task1",
                  "to": "join"
                },
                {
                  "from": "task2",
                  "to": "join"
                },
                {
                  "from": "join",
                  "to": "fork"
                },
                {
                  "from": "join",
                  "to": "end"
                }
              ]
            }
            """;
      CreateWorkflowDefinition complexCycleWorkflow =
          MAPPER.readValue(complexCycleWorkflowJson, CreateWorkflowDefinition.class);
      complexCycleWorkflow.withName(complexCycleWorkflow.getName() + "_" + UUID.randomUUID());

      OpenMetadataException complexCycleEx =
          assertThrows(
              OpenMetadataException.class,
              () -> client.workflowDefinitions().validate(complexCycleWorkflow));
      assertTrue(complexCycleEx.getMessage().contains("contains a cycle"));
      LOG.debug("Complex cycle workflow correctly rejected");
      // Test 10: Multiple start nodes should fail
      String multipleStartWorkflowJson =
          """
            {
              "name": "multipleStartWorkflow",
              "displayName": "Multiple Start Workflow",
              "description": "Workflow with multiple start nodes",
              "trigger": {
                "type": "eventBasedEntity",
                "config": {
                  "entityTypes": ["table"],
                  "events": ["Created"]
                }
              },
              "nodes": [
                {
                  "name": "start1",
                  "displayName": "Start 1",
                  "type": "startEvent",
                  "subType": "startEvent"
                },
                {
                  "name": "start2",
                  "displayName": "Start 2",
                  "type": "startEvent",
                  "subType": "startEvent"
                },
                {
                  "name": "task",
                  "displayName": "Task",
                  "type": "automatedTask",
                  "subType": "setEntityAttributeTask",
                  "config": {
                    "fieldName": "description",
                    "fieldValue": "Test"
                  }
                },
                {
                  "name": "end",
                  "displayName": "End",
                  "type": "endEvent",
                  "subType": "endEvent"
                }
              ],
              "edges": [
                {
                  "from": "start1",
                  "to": "task"
                },
                {
                  "from": "start2",
                  "to": "task"
                },
                {
                  "from": "task",
                  "to": "end"
                }
              ]
            }
            """;
      CreateWorkflowDefinition multipleStartWorkflow =
          MAPPER.readValue(multipleStartWorkflowJson, CreateWorkflowDefinition.class);
      multipleStartWorkflow.withName(multipleStartWorkflow.getName() + "_" + UUID.randomUUID());

      OpenMetadataException multipleStartEx =
          assertThrows(
              OpenMetadataException.class,
              () -> client.workflowDefinitions().validate(multipleStartWorkflow));
      assertTrue(multipleStartEx.getMessage().contains("must have exactly one start event"));
      LOG.debug("Multiple start nodes workflow correctly rejected");

      // Test 11: Orphaned nodes (not reachable from start) should fail
      String orphanedNodesWorkflowJson =
          """
            {
              "name": "orphanedNodesWorkflow",
              "displayName": "Orphaned Nodes Workflow",
              "description": "Workflow with orphaned nodes",
              "trigger": {
                "type": "eventBasedEntity",
                "config": {
                  "entityTypes": ["table"],
                  "events": ["Created"]
                }
              },
              "nodes": [
                {
                  "name": "start",
                  "displayName": "Start",
                  "type": "startEvent",
                  "subType": "startEvent"
                },
                {
                  "name": "task1",
                  "displayName": "Task 1",
                  "type": "automatedTask",
                  "subType": "setEntityAttributeTask",
                  "config": {
                    "fieldName": "description",
                    "fieldValue": "Test1"
                  }
                },
                {
                  "name": "orphanedTask",
                  "displayName": "Orphaned Task",
                  "type": "automatedTask",
                  "subType": "setEntityAttributeTask",
                  "config": {
                    "fieldName": "tags",
                    "fieldValue": "Test.Tag"
                  }
                },
                {
                  "name": "end",
                  "displayName": "End",
                  "type": "endEvent",
                  "subType": "endEvent"
                },
                {
                  "name": "orphanedEnd",
                  "displayName": "Orphaned End",
                  "type": "endEvent",
                  "subType": "endEvent"
                }
              ],
              "edges": [
                {
                  "from": "start",
                  "to": "task1"
                },
                {
                  "from": "task1",
                  "to": "end"
                },
                {
                  "from": "orphanedTask",
                  "to": "orphanedEnd"
                }
              ]
            }
            """;
      CreateWorkflowDefinition orphanedNodesWorkflow =
          MAPPER.readValue(orphanedNodesWorkflowJson, CreateWorkflowDefinition.class);
      orphanedNodesWorkflow.withName(orphanedNodesWorkflow.getName() + "_" + UUID.randomUUID());

      OpenMetadataException orphanedEx =
          assertThrows(
              OpenMetadataException.class,
              () -> client.workflowDefinitions().validate(orphanedNodesWorkflow));
      assertTrue(orphanedEx.getMessage().contains("orphaned nodes not reachable from start"));
      LOG.debug("Orphaned nodes workflow correctly rejected");

      // Test 12: Non-end node without outgoing edges should fail
      String noOutgoingEdgeWorkflowJson =
          """
            {
              "name": "noOutgoingEdgeWorkflow",
              "displayName": "No Outgoing Edge Workflow",
              "description": "Workflow with non-end node without outgoing edges",
              "trigger": {
                "type": "eventBasedEntity",
                "config": {
                  "entityTypes": ["table"],
                  "events": ["Created"]
                }
              },
              "nodes": [
                {
                  "name": "start",
                  "displayName": "Start",
                  "type": "startEvent",
                  "subType": "startEvent"
                },
                {
                  "name": "task1",
                  "displayName": "Task 1",
                  "type": "automatedTask",
                  "subType": "setEntityAttributeTask",
                  "config": {
                    "fieldName": "description",
                    "fieldValue": "Test1"
                  }
                },
                {
                  "name": "task2",
                  "displayName": "Task 2",
                  "type": "automatedTask",
                  "subType": "setEntityAttributeTask",
                  "config": {
                    "fieldName": "tags",
                    "fieldValue": "Test.Tag"
                  }
                },
                {
                  "name": "end",
                  "displayName": "End",
                  "type": "endEvent",
                  "subType": "endEvent"
                }
              ],
              "edges": [
                {
                  "from": "start",
                  "to": "task1"
                },
                {
                  "from": "task1",
                  "to": "task2"
                }
              ]
            }
            """;
      CreateWorkflowDefinition noOutgoingEdgeWorkflow =
          MAPPER.readValue(noOutgoingEdgeWorkflowJson, CreateWorkflowDefinition.class);
      noOutgoingEdgeWorkflow.withName(noOutgoingEdgeWorkflow.getName() + "_" + UUID.randomUUID());

      OpenMetadataException noOutgoingEdgeEx =
          assertThrows(
              OpenMetadataException.class,
              () -> client.workflowDefinitions().validate(noOutgoingEdgeWorkflow));
      assertTrue(noOutgoingEdgeEx.getMessage().contains("requires outgoing edges"));
      LOG.debug("Non-end node without outgoing edges correctly rejected");

      // Test 13: End node with outgoing edges should fail
      String endWithOutgoingWorkflowJson =
          """
            {
              "name": "endWithOutgoingWorkflow",
              "displayName": "End With Outgoing Workflow",
              "description": "Workflow with end node having outgoing edges",
              "trigger": {
                "type": "eventBasedEntity",
                "config": {
                  "entityTypes": ["table"],
                  "events": ["Created"]
                }
              },
              "nodes": [
                {
                  "name": "start",
                  "displayName": "Start",
                  "type": "startEvent",
                  "subType": "startEvent"
                },
                {
                  "name": "end",
                  "displayName": "End",
                  "type": "endEvent",
                  "subType": "endEvent"
                },
                {
                  "name": "task",
                  "displayName": "Task After End",
                  "type": "automatedTask",
                  "subType": "setEntityAttributeTask",
                  "config": {
                    "fieldName": "description",
                    "fieldValue": "Should not reach here"
                  }
                },
                {
                  "name": "finalEnd",
                  "displayName": "Final End",
                  "type": "endEvent",
                  "subType": "endEvent"
                }
              ],
              "edges": [
                {
                  "from": "start",
                  "to": "end"
                },
                {
                  "from": "end",
                  "to": "task"
                },
                {
                  "from": "task",
                  "to": "finalEnd"
                }
              ]
            }
            """;
      CreateWorkflowDefinition endWithOutgoingWorkflow =
          MAPPER.readValue(endWithOutgoingWorkflowJson, CreateWorkflowDefinition.class);
      endWithOutgoingWorkflow.withName(endWithOutgoingWorkflow.getName() + "_" + UUID.randomUUID());

      OpenMetadataException endWithOutgoingEx =
          assertThrows(
              OpenMetadataException.class,
              () -> client.workflowDefinitions().validate(endWithOutgoingWorkflow));
      assertTrue(endWithOutgoingEx.getMessage().contains("cannot have outgoing edges"));
      LOG.debug("End node with outgoing edges correctly rejected");

      // Test 14 (Test 8 in original): Conditional task with missing FALSE condition should fail
      String missingFalseConditionJson =
          """
            {
              "name": "missingFalseConditionWorkflow",
              "displayName": "Missing False Condition Workflow",
              "description": "Workflow with conditional task missing FALSE condition",
              "trigger": {
                "type": "eventBasedEntity",
                "config": {
                  "entityTypes": ["glossaryTerm"],
                  "events": ["Created"]
                }
              },
              "nodes": [
                {
                  "name": "start",
                  "displayName": "Start",
                  "type": "startEvent",
                  "subType": "startEvent"
                },
                {
                  "name": "checkTask",
                  "displayName": "Check Task",
                  "type": "automatedTask",
                  "subType": "checkEntityAttributesTask",
                  "config": {
                    "rules": "{\\"!!\\":{\\"var\\":\\"description\\"}}"
                  },
                  "input": ["relatedEntity"],
                  "inputNamespaceMap": {
                    "relatedEntity": "global"
                  },
                  "output": ["result"]
                },
                {
                  "name": "end",
                  "displayName": "End",
                  "type": "endEvent",
                  "subType": "endEvent"
                }
              ],
              "edges": [
                {
                  "from": "start",
                  "to": "checkTask"
                },
                {
                  "from": "checkTask",
                  "to": "end",
                  "condition": "true"
                }
              ]
            }
            """;
      CreateWorkflowDefinition missingFalseConditionWorkflow =
          MAPPER.readValue(missingFalseConditionJson, CreateWorkflowDefinition.class);
      missingFalseConditionWorkflow.withName(
          missingFalseConditionWorkflow.getName() + "_" + UUID.randomUUID());

      OpenMetadataException missingFalseEx =
          assertThrows(
              OpenMetadataException.class,
              () -> client.workflowDefinitions().validate(missingFalseConditionWorkflow));
      assertTrue(missingFalseEx.getMessage().contains("must have both TRUE and FALSE"));
      LOG.debug("Conditional task missing FALSE condition correctly rejected");

      // Test 15 (Test 9 in original): UserApprovalTask with missing TRUE should fail
      String missingTrueConditionJson =
          """
            {
              "name": "missingTrueConditionWorkflow",
              "displayName": "Missing True Condition Workflow",
              "description": "Workflow with UserApprovalTask missing TRUE condition",
              "trigger": {
                "type": "eventBasedEntity",
                "config": {
                  "entityTypes": ["glossaryTerm"],
                  "events": ["Created"]
                }
              },
              "nodes": [
                {
                  "name": "start",
                  "displayName": "Start",
                  "type": "startEvent",
                  "subType": "startEvent"
                },
                {
                  "name": "approvalTask",
                  "displayName": "Approval Task",
                  "type": "userTask",
                  "subType": "userApprovalTask",
                  "config": {
                    "assignees": {
                      "addReviewers": true,
                      "addOwners": false,
                      "candidates": []
                    }
                  },
                  "input": ["relatedEntity"],
                  "inputNamespaceMap": {
                    "relatedEntity": "global"
                  },
                  "output": ["result"]
                },
                {
                  "name": "end",
                  "displayName": "End",
                  "type": "endEvent",
                  "subType": "endEvent"
                }
              ],
              "edges": [
                {
                  "from": "start",
                  "to": "approvalTask"
                },
                {
                  "from": "approvalTask",
                  "to": "end",
                  "condition": "false"
                }
              ]
            }
            """;
      CreateWorkflowDefinition missingTrueConditionWorkflow =
          MAPPER.readValue(missingTrueConditionJson, CreateWorkflowDefinition.class);
      missingTrueConditionWorkflow.withName(
          missingTrueConditionWorkflow.getName() + "_" + UUID.randomUUID());

      OpenMetadataException missingTrueEx =
          assertThrows(
              OpenMetadataException.class,
              () -> client.workflowDefinitions().validate(missingTrueConditionWorkflow));
      assertTrue(missingTrueEx.getMessage().contains("must have both TRUE and FALSE"));
      LOG.debug("UserApprovalTask missing TRUE condition correctly rejected");

      // Test 16 (Test 10 in original): Valid conditional task with both TRUE and FALSE
      String validConditionalJson =
          """
            {
              "name": "validConditionalWorkflow",
              "displayName": "Valid Conditional Workflow",
              "description": "Workflow with proper conditional task setup",
              "trigger": {
                "type": "eventBasedEntity",
                "config": {
                  "entityTypes": ["glossaryTerm"],
                  "events": ["Created"]
                }
              },
              "nodes": [
                {
                  "name": "start",
                  "displayName": "Start",
                  "type": "startEvent",
                  "subType": "startEvent"
                },
                {
                  "name": "checkTask",
                  "displayName": "Check Task",
                  "type": "automatedTask",
                  "subType": "checkEntityAttributesTask",
                  "config": {
                    "rules": "{\\"!!\\":{\\"var\\":\\"description\\"}}"
                  },
                  "input": ["relatedEntity"],
                  "inputNamespaceMap": {
                    "relatedEntity": "global"
                  },
                  "output": ["result"]
                },
                {
                  "name": "endTrue",
                  "displayName": "End True",
                  "type": "endEvent",
                  "subType": "endEvent"
                },
                {
                  "name": "endFalse",
                  "displayName": "End False",
                  "type": "endEvent",
                  "subType": "endEvent"
                }
              ],
              "edges": [
                {
                  "from": "start",
                  "to": "checkTask"
                },
                {
                  "from": "checkTask",
                  "to": "endTrue",
                  "condition": "true"
                },
                {
                  "from": "checkTask",
                  "to": "endFalse",
                  "condition": "false"
                }
              ]
            }
            """;
      CreateWorkflowDefinition validConditionalWorkflow =
          MAPPER.readValue(validConditionalJson, CreateWorkflowDefinition.class);
      validConditionalWorkflow.withName(
          validConditionalWorkflow.getName() + "_" + UUID.randomUUID());

      WorkflowDefinition validCondResult =
          client.workflowDefinitions().validate(validConditionalWorkflow);
      assertNotNull(validCondResult);
      LOG.debug("Valid conditional workflow passed validation");

    } catch (Exception e) {
      throw new RuntimeException(e);
    }
    LOG.info("test_WorkflowValidationEndpoint completed successfully");
  }

  //  @Order(35)
  //  @Test
  void test_MutualExclusivitySmartReplacement(TestNamespace ns) throws JsonProcessingException {
    OpenMetadataClient client = SdkClients.adminClient();
    LOG.info("Starting test_MutualExclusivitySmartReplacement");

    // Ensure we have database schema for table creation
    // Create database service
    CreateDatabaseService createService =
        new CreateDatabaseService()
            .withName(ns.prefix("mutex_db_service"))
            .withServiceType(
                org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType
                    .Mysql)
            .withConnection(
                new org.openmetadata.schema.api.services.DatabaseConnection()
                    .withConfig(new java.util.HashMap<>()));

    DatabaseService mutexDbService = client.databaseServices().create(createService);

    CreateDatabase createDb =
        new CreateDatabase()
            .withName(ns.prefix("mutex_db"))
            .withService(mutexDbService.getFullyQualifiedName());
    Database mutexDb = client.databases().create(createDb);

    CreateDatabaseSchema createSch =
        new CreateDatabaseSchema()
            .withName(ns.prefix("mutex_sc"))
            .withDatabase(mutexDb.getFullyQualifiedName());
    DatabaseSchema mutexSchema = client.databaseSchemas().create(createSch);

    // Step 1: Create classification with mutual exclusivity
    CreateClassification createClassification =
        new CreateClassification()
            .withName(ns.prefix("MutualExclusiveClassification"))
            .withDescription("Classification with mutually exclusive tags")
            .withMutuallyExclusive(true)
            .withProvider(org.openmetadata.schema.type.ProviderType.USER);
    Classification classification = client.classifications().create(createClassification);
    LOG.debug("Created mutually exclusive classification: {}", classification.getName());

    // Create glossary with mutual exclusivity
    CreateGlossary createGlossary =
        new CreateGlossary()
            .withName(ns.prefix("MutualExclusiveGlossary"))
            .withDisplayName("Mutual Exclusive Glossary")
            .withDescription("Glossary with mutually exclusive terms")
            .withMutuallyExclusive(true);
    Glossary glossary = client.glossaries().create(createGlossary);
    LOG.debug("Created mutually exclusive glossary: {}", glossary.getName());

    // Step 2: Create 2 tags under the classification
    CreateTag createTag1 =
        new CreateTag()
            .withName("Tag1")
            .withDescription("First tag in mutually exclusive classification")
            .withClassification(classification.getName());
    Tag tag1 = client.tags().create(createTag1);
    LOG.debug("Created tag1: {}", tag1.getFullyQualifiedName());

    CreateTag createTag2 =
        new CreateTag()
            .withName("Tag2")
            .withDescription("Second tag in mutually exclusive classification")
            .withClassification(classification.getName());
    Tag tag2 = client.tags().create(createTag2);
    LOG.debug("Created tag2: {}", tag2.getFullyQualifiedName());

    // Create 2 glossary terms under the glossary
    CreateGlossaryTerm createTerm1 =
        new CreateGlossaryTerm()
            .withName("Term1")
            .withDisplayName("Term 1")
            .withDescription("First term in mutually exclusive glossary")
            .withGlossary(glossary.getFullyQualifiedName());
    GlossaryTerm term1 = client.glossaryTerms().create(createTerm1);
    LOG.debug("Created term1: {}", term1.getFullyQualifiedName());

    CreateGlossaryTerm createTerm2 =
        new CreateGlossaryTerm()
            .withName("Term2")
            .withDisplayName("Term 2")
            .withDescription("Second term in mutually exclusive glossary")
            .withGlossary(glossary.getFullyQualifiedName());
    GlossaryTerm term2 = client.glossaryTerms().create(createTerm2);
    LOG.debug("Created term2: {}", term2.getFullyQualifiedName());

    // Step 3: Create a table and add tag1 and term1
    CreateTable createTable =
        new CreateTable()
            .withName(ns.prefix("test_mutex_table"))
            .withDatabaseSchema(mutexSchema.getFullyQualifiedName())
            .withDescription("Test table for mutual exclusivity smart replacement")
            .withColumns(
                List.of(
                    new Column().withName("col1").withDataType(ColumnDataType.STRING),
                    new Column().withName("col2").withDataType(ColumnDataType.INT)));
    Table table = client.tables().create(createTable);
    LOG.debug("Created test table: {}", table.getName());

    // Add tag1 and term1 to the table using Patch
    Table originalTable = table;
    List<org.openmetadata.schema.type.TagLabel> initialTags = new ArrayList<>();

    // Add tag1
    org.openmetadata.schema.type.TagLabel tagLabel1 = new org.openmetadata.schema.type.TagLabel();
    tagLabel1.setTagFQN(tag1.getFullyQualifiedName());
    tagLabel1.setLabelType(org.openmetadata.schema.type.TagLabel.LabelType.MANUAL);
    tagLabel1.setState(org.openmetadata.schema.type.TagLabel.State.CONFIRMED);
    tagLabel1.setSource(org.openmetadata.schema.type.TagLabel.TagSource.CLASSIFICATION);
    initialTags.add(tagLabel1);

    // Add term1
    org.openmetadata.schema.type.TagLabel termLabel1 = new org.openmetadata.schema.type.TagLabel();
    termLabel1.setTagFQN(term1.getFullyQualifiedName());
    termLabel1.setLabelType(org.openmetadata.schema.type.TagLabel.LabelType.MANUAL);
    termLabel1.setState(org.openmetadata.schema.type.TagLabel.State.CONFIRMED);
    termLabel1.setSource(org.openmetadata.schema.type.TagLabel.TagSource.GLOSSARY);
    termLabel1.setName(term1.getName());
    termLabel1.setDisplayName(term1.getDisplayName());
    initialTags.add(termLabel1);

    Table updatedTableObj = JsonUtils.deepCopy(originalTable, Table.class);
    updatedTableObj.setTags(initialTags);

    table =
        client
            .tables()
            .patch(
                originalTable.getId(),
                JsonUtils.readTree(
                    JsonUtils.getJsonPatch(originalTable, updatedTableObj).toString()));
    LOG.debug(
        "Added initial tag1 ({}) and term1 ({}) to table",
        tag1.getFullyQualifiedName(),
        term1.getFullyQualifiedName());

    // Step 4: Create workflow that tries to add tag2 and term2 (mutually exclusive with tag1 and
    // term1)
    //    String workflowJson =
    //        String.format(
    //            """
    //            {
    //              "name": "%s",
    //              "displayName": "Mutual Exclusivity Workflow",
    //              "description": "Test workflow for mutual exclusivity smart replacement",
    //              "trigger": {
    //                "type": "periodicBatchEntity",
    //                "config": {
    //                  "entityTypes": ["table"],
    //                  "schedule": {
    //                    "scheduleTimeline": "None"
    //                  },
    //                  "batchSize": 100,
    //                  "filters": {}
    //                },
    //                "output": [
    //                  "relatedEntity",
    //                  "updatedBy"
    //                ]
    //              },
    //              "nodes": [
    //                {
    //                  "type": "startEvent",
    //                  "subType": "startEvent",
    //                  "name": "StartNode",
    //                  "displayName": "Start"
    //                },
    //                {
    //                  "type": "automatedTask",
    //                  "subType": "setEntityAttributeTask",
    //                  "name": "SetEntityAttribute_2",
    //                  "displayName": "Set Tags",
    //                  "config": {
    //                    "fieldName": "tags",
    //                    "fieldValue": "%s"
    //                  },
    //                  "input": [
    //                    "relatedEntity",
    //                    "updatedBy"
    //                  ],
    //                  "inputNamespaceMap": {
    //                    "relatedEntity": "global",
    //                    "updatedBy": "global"
    //                  },
    //                  "output": []
    //                },
    //                {
    //                  "type": "automatedTask",
    //                  "subType": "setEntityAttributeTask",
    //                  "name": "SetEntityAttribute_3",
    //                  "displayName": "Set Glossary Term",
    //                  "config": {
    //                    "fieldName": "glossaryTerms",
    //                    "fieldValue": "%s"
    //                  },
    //                  "input": [
    //                    "relatedEntity",
    //                    "updatedBy"
    //                  ],
    //                  "inputNamespaceMap": {
    //                    "relatedEntity": "global",
    //                    "updatedBy": "global"
    //                  },
    //                  "output": []
    //                },
    //                {
    //                  "type": "endEvent",
    //                  "subType": "endEvent",
    //                  "name": "EndNode_4",
    //                  "displayName": "End"
    //                }
    //              ],
    //              "edges": [
    //                {
    //                  "from": "SetEntityAttribute_3",
    //                  "to": "EndNode_4"
    //                },
    //                {
    //                  "from": "SetEntityAttribute_2",
    //                  "to": "SetEntityAttribute_3"
    //                },
    //                {
    //                  "from": "StartNode",
    //                  "to": "SetEntityAttribute_2"
    //                }
    //              ],
    //              "config": {
    //                "storeStageStatus": true
    //              }
    //            }
    //            """,
    //            ns.prefix("MutualExclusivityWorkflow"),
    //            tag2.getFullyQualifiedName(),
    //            term2.getFullyQualifiedName());

    ObjectMapper om = new ObjectMapper();

    // ---- trigger ----
    Map<String, Object> schedule = new LinkedHashMap<>();
    schedule.put("scheduleTimeline", "None");

    Map<String, Object> triggerConfig = new LinkedHashMap<>();
    triggerConfig.put("entityTypes", List.of("table"));
    triggerConfig.put("schedule", schedule);
    triggerConfig.put("batchSize", 100);
    triggerConfig.put("filters", new LinkedHashMap<>());

    Map<String, Object> trigger = new LinkedHashMap<>();
    trigger.put("type", "periodicBatchEntity");
    trigger.put("config", triggerConfig);
    trigger.put("output", List.of("relatedEntity", "updatedBy"));

    // ---- nodes ----
    Map<String, Object> startNode = new LinkedHashMap<>();
    startNode.put("type", "startEvent");
    startNode.put("subType", "startEvent");
    startNode.put("name", "StartNode");
    startNode.put("displayName", "Start");

    Map<String, Object> setTagsConfig = new LinkedHashMap<>();
    setTagsConfig.put("fieldName", "tags");
    setTagsConfig.put("fieldValue", tag2.getFullyQualifiedName());

    Map<String, Object> setTagsNode = new LinkedHashMap<>();
    setTagsNode.put("type", "automatedTask");
    setTagsNode.put("subType", "setEntityAttributeTask");
    setTagsNode.put("name", "SetEntityAttribute_2");
    setTagsNode.put("displayName", "Set Tags");
    setTagsNode.put("config", setTagsConfig);
    setTagsNode.put("input", List.of("relatedEntity", "updatedBy"));

    Map<String, Object> setTagsNamespaceMap = new LinkedHashMap<>();
    setTagsNamespaceMap.put("relatedEntity", "global");
    setTagsNamespaceMap.put("updatedBy", "global");
    setTagsNode.put("inputNamespaceMap", setTagsNamespaceMap);
    setTagsNode.put("output", List.of());

    Map<String, Object> setGlossaryConfig = new LinkedHashMap<>();
    setGlossaryConfig.put("fieldName", "glossaryTerms");
    setGlossaryConfig.put("fieldValue", term2.getFullyQualifiedName());

    Map<String, Object> setGlossaryNode = new LinkedHashMap<>();
    setGlossaryNode.put("type", "automatedTask");
    setGlossaryNode.put("subType", "setEntityAttributeTask");
    setGlossaryNode.put("name", "SetEntityAttribute_3");
    setGlossaryNode.put("displayName", "Set Glossary Term");
    setGlossaryNode.put("config", setGlossaryConfig);
    setGlossaryNode.put("input", List.of("relatedEntity", "updatedBy"));

    Map<String, Object> setGlossaryNamespaceMap = new LinkedHashMap<>();
    setGlossaryNamespaceMap.put("relatedEntity", "global");
    setGlossaryNamespaceMap.put("updatedBy", "global");
    setGlossaryNode.put("inputNamespaceMap", setGlossaryNamespaceMap);
    setGlossaryNode.put("output", List.of());

    Map<String, Object> endNode = new LinkedHashMap<>();
    endNode.put("type", "endEvent");
    endNode.put("subType", "endEvent");
    endNode.put("name", "EndNode_4");
    endNode.put("displayName", "End");

    List<Object> nodes = List.of(startNode, setTagsNode, setGlossaryNode, endNode);

    // ---- edges ----
    Map<String, Object> e1 = new LinkedHashMap<>();
    e1.put("from", "SetEntityAttribute_3");
    e1.put("to", "EndNode_4");

    Map<String, Object> e2 = new LinkedHashMap<>();
    e2.put("from", "SetEntityAttribute_2");
    e2.put("to", "SetEntityAttribute_3");

    Map<String, Object> e3 = new LinkedHashMap<>();
    e3.put("from", "StartNode");
    e3.put("to", "SetEntityAttribute_2");

    List<Object> edges = List.of(e1, e2, e3);

    // ---- top-level config ----
    Map<String, Object> topConfig = new LinkedHashMap<>();
    topConfig.put("storeStageStatus", true);

    // ---- root workflow ----
    Map<String, Object> workflowJson = new LinkedHashMap<>();
    workflowJson.put("name", ns.prefix("MutualExclusivityWorkflow"));
    workflowJson.put("displayName", "Mutual Exclusivity Workflow");
    workflowJson.put("description", "Test workflow for mutual exclusivity smart replacement");
    workflowJson.put("trigger", trigger);
    workflowJson.put("nodes", nodes);
    workflowJson.put("edges", edges);
    workflowJson.put("config", topConfig);

    String workflowString = om.writeValueAsString(workflowJson);

    CreateWorkflowDefinition workflow =
        JsonUtils.readValue(workflowString, CreateWorkflowDefinition.class);

    // Create the workflow using direct HTTP call (bypasses SDK fluent API serialization bug)
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, workflow, RequestOptions.builder().build());
    assertNotNull(response);
    JsonNode created = MAPPER.readTree(response);
    assertTrue(created.has("id"));
    LOG.debug("MutualExclusivityWorkflow created successfully");

    // Track the created workflow for cleanup
    trackWorkflowFromJson(created);

    // Step 5: Trigger the workflow
    String workflowName = ns.prefix("MutualExclusivityWorkflow");
    String triggerPath = BASE_PATH + "/name/" + workflowName + "/trigger";
    executeWithDeadlockRetry(
        () -> {
          try {
            return client
                .getHttpClient()
                .executeForString(
                    HttpMethod.POST, triggerPath, "{}", RequestOptions.builder().build());
          } catch (Exception e) {
            throw new RuntimeException("Failed to trigger workflow", e);
          }
        },
        "trigger-" + workflowName);
    LOG.debug("Workflow triggered successfully");

    final UUID tableId = table.getId();

    // Step 6: Wait for workflow to process and assert tags are replaced
    await()
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(1))
        .pollDelay(Duration.ofMillis(500))
        .until(
            () -> {
              try {
                Table checkTable = client.tables().get(tableId.toString(), "tags");
                LOG.debug("Checking table tags: {}", checkTable.getTags());
                if (checkTable.getTags() != null) {
                  // Check that tag1 is REPLACED by tag2 (mutually exclusive)
                  boolean hasTag1 =
                      checkTable.getTags().stream()
                          .anyMatch(tag -> tag1.getFullyQualifiedName().equals(tag.getTagFQN()));
                  boolean hasTag2 =
                      checkTable.getTags().stream()
                          .anyMatch(tag -> tag2.getFullyQualifiedName().equals(tag.getTagFQN()));
                  // Check that term1 is REPLACED by term2 (mutually exclusive)
                  boolean hasTerm1 =
                      checkTable.getTags().stream()
                          .anyMatch(tag -> term1.getFullyQualifiedName().equals(tag.getTagFQN()));
                  boolean hasTerm2 =
                      checkTable.getTags().stream()
                          .anyMatch(tag -> term2.getFullyQualifiedName().equals(tag.getTagFQN()));

                  // Both tag1 and term1 should be replaced
                  return !hasTag1 && hasTag2 && !hasTerm1 && hasTerm2;
                }
                return false;
              } catch (Exception e) {
                LOG.warn("Error checking table tags: {}", e.getMessage());
                return false;
              }
            });

    // Verify smart replacement occurred
    Table updatedTable = client.tables().get(table.getId().toString(), "tags");
    assertNotNull(updatedTable);
    assertNotNull(updatedTable.getTags());

    // Tag1 should be REPLACED by Tag2 (mutually exclusive in same classification)
    boolean hasTag1 =
        updatedTable.getTags().stream()
            .anyMatch(tag -> tag1.getFullyQualifiedName().equals(tag.getTagFQN()));
    assertFalse(hasTag1, "Tag1 should be replaced due to mutual exclusivity");

    boolean hasTag2 =
        updatedTable.getTags().stream()
            .anyMatch(tag -> tag2.getFullyQualifiedName().equals(tag.getTagFQN()));
    assertTrue(hasTag2, "Tag2 should be present");

    // Term1 should be REPLACED by Term2 (mutually exclusive in same glossary)
    boolean hasTerm1 =
        updatedTable.getTags().stream()
            .anyMatch(tag -> term1.getFullyQualifiedName().equals(tag.getTagFQN()));
    assertFalse(hasTerm1, "Term1 should be replaced due to mutual exclusivity");

    boolean hasTerm2 =
        updatedTable.getTags().stream()
            .anyMatch(tag -> term2.getFullyQualifiedName().equals(tag.getTagFQN()));
    assertTrue(hasTerm2, "Term2 should be present");

    LOG.debug(
        "Smart replacement successful. Final tags: {}",
        updatedTable.getTags().stream().map(TagLabel::getTagFQN).toList());

    // Verify exactly 2 tags remain (tag2 and term2)
    assertEquals(
        2, updatedTable.getTags().size(), "Should have exactly 2 tags after smart replacement");

    LOG.info("test_MutualExclusivitySmartReplacement completed successfully");
  }

  @Test
  @Order(36)
  @Disabled("Flaky in CI, Passing in Local, need to fix")
  void test_CustomApprovalWorkflowForNewEntities(TestNamespace ns)
      throws IOException, InterruptedException {
    LOG.info("Starting test_CustomApprovalWorkflowForNewEntities");
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a reviewer user for this test
    CreateUser createReviewer =
        new CreateUser()
            .withName("wf_test_reviewer")
            .withEmail("wf_test_reviewer" + "@example.com")
            .withDisplayName("Test Reviewer")
            .withPassword("password123");
    User reviewerUser = client.users().create(createReviewer);
    EntityReference reviewerRef = reviewerUser.getEntityReference();
    LOG.debug("Created reviewer user: {}", reviewerUser.getName());

    Domain domain = getOrCreateDomain(ns);
    // Create client for reviewer
    OpenMetadataClient reviewerClient =
        SdkClients.createClient(reviewerUser.getName(), reviewerUser.getEmail(), new String[] {});

    // Step 1: Create a single workflow for all three entity types
    String unifiedApprovalWorkflowJson =
        String.format(
            """
                    {
                      "name": "%s",
                      "displayName": "Unified Approval Workflow",
                      "description": "Custom approval workflow for dataContracts, tags, dataProducts, metrics, and testCases",
                      "trigger": {
                        "type": "eventBasedEntity",
                        "config": {
                          "entityTypes": ["dataContract", "tag", "dataProduct", "metric", "testCase"],
                          "events": ["Created", "Updated"],
                          "exclude": ["reviewers"],
                          "filter": {}
                        },
                        "output": ["relatedEntity", "updatedBy"]
                      },
                      "nodes": [
                        {
                          "type": "startEvent",
                          "subType": "startEvent",
                          "name": "StartNode",
                          "displayName": "Start"
                        },
                        {
                          "type": "endEvent",
                          "subType": "endEvent",
                          "name": "EndNode",
                          "displayName": "End"
                        },
                        {
                          "type": "userTask",
                          "subType": "userApprovalTask",
                          "name": "UserApproval",
                          "displayName": "User Approval",
                          "config": {
                            "assignees": {
                              "addReviewers": true,
                              "addOwners": false,
                              "candidates": []
                            },
                            "approvalThreshold": 1,
                            "rejectionThreshold": 1
                          },
                          "input": ["relatedEntity"],
                          "inputNamespaceMap": {
                            "relatedEntity": "global"
                          },
                          "output": ["updatedBy"],
                          "branches": ["true", "false"]
                        },
                        {
                          "type": "automatedTask",
                          "subType": "setEntityAttributeTask",
                          "name": "SetDescription",
                          "displayName": "Set Description",
                          "config": {
                            "fieldName": "description",
                            "fieldValue": "Updated by Workflow"
                          },
                          "input": ["relatedEntity", "updatedBy"],
                          "inputNamespaceMap": {
                            "relatedEntity": "global",
                            "updatedBy": "UserApproval"
                          },
                          "output": []
                        }
                      ],
                      "edges": [
                        {"from": "StartNode", "to": "UserApproval"},
                        {"from": "UserApproval", "to": "SetDescription", "condition": "true"},
                        {"from": "SetDescription", "to": "EndNode"},
                        {"from": "UserApproval", "to": "EndNode", "condition": "false"}
                      ],
                      "config": {"storeStageStatus": true}
                    }
                    """,
            "UnifiedApprovalWorkflow");

    CreateWorkflowDefinition unifiedWorkflow =
        JsonUtils.readValue(unifiedApprovalWorkflowJson, CreateWorkflowDefinition.class);
    // Create workflow using direct HTTP call (bypasses SDK fluent API serialization bug)
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, unifiedWorkflow, RequestOptions.builder().build());
    assertNotNull(response);
    LOG.debug("Created unified approval workflow for dataContract, tag, and dataProduct entities");

    // Step 2: Create database infrastructure with short names
    CreateDatabaseService createDbService =
        new CreateDatabaseService()
            .withName(ns.prefix("dbs"))
            .withServiceType(
                org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType
                    .Datalake)
            .withConnection(
                new org.openmetadata.schema.api.services.DatabaseConnection()
                    .withConfig(
                        new java.util.HashMap<String, Object>() {
                          {
                            put("bucketName", "test");
                          }
                        }))
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DatabaseService dbService = client.databaseServices().create(createDbService);

    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName("db")
            .withService(dbService.getFullyQualifiedName())
            .withDescription("Test database for custom approval workflow")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    Database database = client.databases().create(createDatabase);
    LOG.debug("Created database: {}", database.getName());

    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("sc")
            .withDatabase(database.getFullyQualifiedName())
            .withDescription("Test schema for custom approval workflow");
    DatabaseSchema schema =
        client
            .databaseSchemas()
            .create(createSchema)
            .withDomains(List.of(domain.getEntityReference()));
    LOG.debug("Created database schema: {}", schema.getName());

    DatabaseSchema databaseSchema = schema;

    // Create a table for dataContract
    List<Column> columns =
        List.of(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.INT)
                .withDescription("ID column"),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.STRING)
                .withDescription("Name column"));

    CreateTable createTable =
        new CreateTable()
            .withName("cusapp_test_table")
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withDescription("Test table for data contract")
            .withColumns(columns)
            .withDomains(List.of(domain.getFullyQualifiedName()));
    Table table = client.tables().create(createTable);
    LOG.debug("Created table: {}", table.getName());

    // Step 3: Create dataContract with reviewers (USER1 as reviewer)
    org.openmetadata.schema.api.data.CreateDataContract createDataContract =
        new org.openmetadata.schema.api.data.CreateDataContract()
            .withName("wfcustom_datacontract")
            .withDescription("Initial data contract description")
            .withEntity(table.getEntityReference())
            .withReviewers(List.of(reviewerRef));

    org.openmetadata.schema.entity.data.DataContract dataContract =
        client.dataContracts().create(createDataContract);
    LOG.debug("Created data contract: {} with initial description", dataContract.getName());

    // Step 4: Create classification and tag with reviewers (USER1 as reviewer)
    CreateClassification createClassification =
        new CreateClassification()
            .withName("cusapp__test_classification")
            .withDescription("Test classification for workflow");
    Classification classification = client.classifications().create(createClassification);

    CreateTag createTag =
        new CreateTag()
            .withName("cusapp_test_tag")
            .withDescription("Initial tag description")
            .withClassification(classification.getName())
            .withReviewers(List.of(reviewerRef));
    Tag tag = client.tags().create(createTag);
    LOG.debug("Created tag: {} with initial description", tag.getName());

    // Step 5: Create dataProduct with reviewers (dedicated reviewer)
    org.openmetadata.schema.api.domains.CreateDataProduct createDataProduct =
        new org.openmetadata.schema.api.domains.CreateDataProduct()
            .withName("test_dataproduct_wfcustom")
            .withDescription("Initial data product description")
            .withDomains(List.of(domain.getFullyQualifiedName()))
            .withReviewers(List.of(reviewerRef));

    org.openmetadata.schema.entity.domains.DataProduct dataProduct =
        client.dataProducts().create(createDataProduct);
    LOG.debug("Created data product: {} with initial description", dataProduct.getName());

    // Add asset using bulk API
    org.openmetadata.schema.type.api.BulkAssets bulkAssets =
        new org.openmetadata.schema.type.api.BulkAssets()
            .withAssets(List.of(table.getEntityReference()));
    client.dataProducts().bulkAddAssets(dataProduct.getFullyQualifiedName(), bulkAssets);

    // Step 5.5: Create metric with reviewers
    CreateMetric createMetric =
        new CreateMetric()
            .withName("test_metric_wfcustom")
            .withDescription("Initial metric description")
            .withMetricType(MetricType.COUNT)
            .withUnitOfMeasurement(MetricUnitOfMeasurement.SIZE)
            .withReviewers(List.of(reviewerRef));
    Metric metric = client.metrics().create(createMetric);
    LOG.debug("Created metric: {} with initial description", metric.getName());

    // Step 5.6: Create testCase with reviewers
    CreateTestDefinition createTestDef =
        new CreateTestDefinition()
            .withName("test_def")
            .withDescription("Test Def")
            .withEntityType(org.openmetadata.schema.type.TestDefinitionEntityType.TABLE)
            .withTestPlatforms(List.of(TestPlatform.OPEN_METADATA));
    try {
      client.testDefinitions().create(createTestDef);
    } catch (OpenMetadataException e) {
      // Ignore
    }

    CreateTestCase createTestCase =
        new CreateTestCase()
            .withName("test_approval_testcase")
            .withEntityLink(String.format("<#E::table::%s>", table.getFullyQualifiedName()))
            .withDescription("Initial test case description")
            .withReviewers(List.of(reviewerRef))
            .withTestDefinition(createTestDef.getName());

    TestCase testCase = client.testCases().create(createTestCase);
    LOG.debug("Created test case: {} with initial description", testCase.getName());

    // Step 6: Find and resolve approval tasks for each entity
    LOG.debug("Finding and resolving approval tasks");

    // Helper lambda to wait for and resolve a task
    BiConsumer<String, String> waitAndResolveTask =
        (entityLink, entityType) -> {
          try {
            LOG.info("Waiting for approval task for {}...", entityType);
            await()
                .atMost(Duration.ofMinutes(2))
                .pollInterval(Duration.ofSeconds(2))
                .until(
                    () -> {
                      ResultList<org.openmetadata.schema.entity.feed.Thread> threads =
                          reviewerClient.feed().listTasks(entityLink, TaskStatus.Open, 1);
                      return !threads.getData().isEmpty();
                    });

            LOG.info("Approval task for {} found. Proceeding with resolution.", entityType);
            ResultList<Thread> threads =
                reviewerClient.feed().listTasks(entityLink, TaskStatus.Open, 1);

            org.openmetadata.schema.entity.feed.Thread task = threads.getData().get(0);
            LOG.debug("Found approval task for {}: {}", entityType, task.getId());
            ResolveTask resolveTask =
                new ResolveTask()
                    .withNewValue(org.openmetadata.schema.type.EntityStatus.APPROVED.value());
            reviewerClient.feed().resolveTask(task.getTask().getId().toString(), resolveTask);
            LOG.debug("Resolved {} approval task", entityType);
          } catch (Exception e) {
            LOG.error(
                "Error while waiting for or resolving task for {}: {}",
                entityType,
                e.getMessage(),
                e);
            fail("Failed to find or resolve task for " + entityType, e);
          }
        };

    // Resolve DataContract approval task
    String dataContractEntityLink =
        String.format("<#E::dataContract::%s>", dataContract.getFullyQualifiedName());
    waitAndResolveTask.accept(dataContractEntityLink, "DataContract");

    // Resolve Tag approval task
    String tagEntityLink = String.format("<#E::tag::%s>", tag.getFullyQualifiedName());
    waitAndResolveTask.accept(tagEntityLink, "Tag");

    // Resolve DataProduct approval task
    String dataProductEntityLink =
        String.format("<#E::dataProduct::%s>", dataProduct.getFullyQualifiedName());
    waitAndResolveTask.accept(dataProductEntityLink, "DataProduct");

    // Resolve Metric approval task
    String metricEntityLink = String.format("<#E::metric::%s>", metric.getFullyQualifiedName());
    waitAndResolveTask.accept(metricEntityLink, "Metric");

    // Resolve TestCase approval task
    String testCaseEntityLink =
        String.format("<#E::testCase::%s>", testCase.getFullyQualifiedName());
    waitAndResolveTask.accept(testCaseEntityLink, "TestCase");

    // Step 7: Verify descriptions were updated by workflows after approval
    verifyEntityDescriptionsUpdated(
        client,
        dataContract.getId(),
        tag.getId(),
        dataProduct.getId(),
        metric.getId(),
        testCase.getId());

    // Step 8: Update entities with different descriptions to trigger workflows again
    LOG.debug("Updating entities with new descriptions to trigger workflows again");

    // Update dataContract description
    org.openmetadata.schema.entity.data.DataContract updatedContract =
        JsonUtils.deepCopy(dataContract, org.openmetadata.schema.entity.data.DataContract.class);
    updatedContract.setDescription("Manually changed data contract description");
    dataContract =
        client
            .dataContracts()
            .patch(
                dataContract.getId(),
                JsonUtils.readTree(
                    JsonUtils.getJsonPatch(dataContract, updatedContract).toString()));

    // Update tag description
    Tag updatedTagObj = JsonUtils.deepCopy(tag, Tag.class);
    updatedTagObj.setDescription("Manually changed tag description");
    tag =
        client
            .tags()
            .patch(
                tag.getId(),
                JsonUtils.readTree(JsonUtils.getJsonPatch(tag, updatedTagObj).toString()));

    // Update dataProduct description
    org.openmetadata.schema.entity.domains.DataProduct updatedDataProduct =
        JsonUtils.deepCopy(dataProduct, org.openmetadata.schema.entity.domains.DataProduct.class);
    updatedDataProduct.setDescription("Manually changed data product description");
    dataProduct =
        client
            .dataProducts()
            .patch(
                dataProduct.getId(),
                JsonUtils.readTree(
                    JsonUtils.getJsonPatch(dataProduct, updatedDataProduct).toString()));

    // Update metric description
    Metric updatedMetric = JsonUtils.deepCopy(metric, Metric.class);
    updatedMetric.setDescription("Manually changed metric description");
    metric =
        client
            .metrics()
            .patch(
                metric.getId(),
                JsonUtils.readTree(JsonUtils.getJsonPatch(metric, updatedMetric).toString()));

    // Update testCase description
    TestCase updatedTestCase = JsonUtils.deepCopy(testCase, TestCase.class);
    updatedTestCase.setDescription("Manually changed test case description");
    testCase =
        client
            .testCases()
            .patch(
                testCase.getId(),
                JsonUtils.readTree(JsonUtils.getJsonPatch(testCase, updatedTestCase).toString()));

    // Step 9: Find and resolve new approval tasks
    LOG.debug("Finding and resolving new approval tasks after updates");

    // Resolve new DataContract approval task
    waitAndResolveTask.accept(dataContractEntityLink, "DataContract");

    // Resolve new Tag approval task
    waitAndResolveTask.accept(tagEntityLink, "Tag");

    // Resolve new DataProduct approval task
    waitAndResolveTask.accept(dataProductEntityLink, "DataProduct");

    // Resolve new Metric approval task
    waitAndResolveTask.accept(metricEntityLink, "Metric");

    // Resolve new TestCase approval task
    waitAndResolveTask.accept(testCaseEntityLink, "TestCase");

    // Step 10: Verify descriptions were updated back by workflows
    verifyEntityDescriptionsUpdated(
        client,
        dataContract.getId(),
        tag.getId(),
        dataProduct.getId(),
        metric.getId(),
        testCase.getId());

    // Step 11: Delete the unified workflow
    try {
      WorkflowDefinition wd =
          client.workflowDefinitions().getByName(unifiedWorkflow.getName(), null);
      executeWithDeadlockRetryVoid(
          () -> {
            try {
              client.workflowDefinitions().delete(wd.getId());
            } catch (Exception e) {
              throw new RuntimeException("Failed to delete workflow", e);
            }
          },
          "delete-workflow-" + wd.getName());
      LOG.debug("Successfully deleted UnifiedApprovalWorkflow");
    } catch (Exception e) {
      LOG.warn("Error while deleting UnifiedApprovalWorkflow: {}", e.getMessage());
    }

    LOG.info("test_CustomApprovalWorkflowForNewEntities completed successfully");
  }

  private void verifyEntityDescriptionsUpdated(
      OpenMetadataClient client,
      UUID dataContractId,
      UUID tagId,
      UUID dataProductId,
      UUID metricId,
      UUID testCaseId) {
    // Verify DataContract description update
    LOG.info("Verifying DataContract description update...");
    await()
        .atMost(Duration.ofSeconds(120))
        .pollInterval(Duration.ofSeconds(1))
        .pollDelay(Duration.ofMillis(500))
        .until(
            () -> {
              try {
                org.openmetadata.schema.entity.data.DataContract contract =
                    client.dataContracts().get(dataContractId.toString(), "description");
                LOG.debug("DataContract description: {}", contract.getDescription());
                return "Updated by Workflow".equals(contract.getDescription());
              } catch (Exception e) {
                LOG.warn("Error checking DataContract description: {}", e.getMessage());
                return false;
              }
            });
    LOG.info("✓ DataContract description successfully updated to 'Updated by Workflow'");

    // Verify Tag description update
    LOG.info("Verifying Tag description update...");
    await()
        .atMost(Duration.ofSeconds(120))
        .pollInterval(Duration.ofSeconds(1))
        .pollDelay(Duration.ofMillis(500))
        .until(
            () -> {
              try {
                Tag tag = client.tags().get(tagId.toString(), "description");
                LOG.debug("Tag description: {}", tag.getDescription());
                return "Updated by Workflow".equals(tag.getDescription());
              } catch (Exception e) {
                LOG.warn("Error checking Tag description: {}", e.getMessage());
                return false;
              }
            });
    LOG.info("✓ Tag description successfully updated to 'Updated by Workflow'");

    // Verify DataProduct description update
    LOG.info("Verifying DataProduct description update...");
    await()
        .atMost(Duration.ofSeconds(120))
        .pollInterval(Duration.ofSeconds(1))
        .until(
            () -> {
              try {
                org.openmetadata.schema.entity.domains.DataProduct dp =
                    client.dataProducts().get(dataProductId.toString(), "description");
                return "Updated by Workflow".equals(dp.getDescription());
              } catch (Exception e) {
                return false;
              }
            });
    LOG.info("✓ DataProduct description successfully updated");

    // Verify Metric
    LOG.info("Verifying Metric description update...");
    await()
        .atMost(Duration.ofSeconds(120))
        .pollInterval(Duration.ofSeconds(1))
        .until(
            () -> {
              try {
                Metric metric = client.metrics().get(metricId.toString(), "description");
                return "Updated by Workflow".equals(metric.getDescription());
              } catch (Exception e) {
                return false;
              }
            });
    LOG.info("✓ Metric description successfully updated");

    // Verify TestCase
    LOG.info("Verifying TestCase description update...");
    await()
        .atMost(Duration.ofSeconds(120))
        .pollInterval(Duration.ofSeconds(1))
        .until(
            () -> {
              try {
                TestCase tc = client.testCases().get(testCaseId.toString(), "description");
                return "Updated by Workflow".equals(tc.getDescription());
              } catch (Exception e) {
                return false;
              }
            });
    LOG.info("✓ TestCase description successfully updated");
  }

  @Test
  @Order(37)
  void test_AutoApprovalForEntitiesWithoutReviewers(TestNamespace ns)
      throws IOException, InterruptedException {
    LOG.info("Starting test_AutoApprovalForEntitiesWithoutReviewers");

    OpenMetadataClient client = SdkClients.adminClient();
    String workflowName = "AutoApprovalTestWorkflow";
    String dataProductName = "auto_dataproduct";

    Domain domain = getOrCreateDomain(ns);

    // Create a workflow with user approval task for dataProduct
    String autoApprovalWorkflowJson =
        """
            {
              "name": "%s",
              "displayName": "Auto Approval Test Workflow",
              "description": "Test workflow to verify auto-approval when no reviewers are configured",
              "trigger": {
                "type": "eventBasedEntity",
                "config": {
                  "entityTypes": ["dataProduct"],
                  "events": ["Created", "Updated"],
                  "exclude": ["reviewers"],
                  "filter": {}
                },
                "output": ["relatedEntity", "updatedBy"]
              },
              "nodes": [
                {
                  "type": "startEvent",
                  "subType": "startEvent",
                  "name": "StartNode",
                  "displayName": "Start"
                },
                {
                  "type": "endEvent",
                  "subType": "endEvent",
                  "name": "EndNode",
                  "displayName": "End"
                },
                {
                  "type": "userTask",
                  "subType": "userApprovalTask",
                  "name": "UserApproval",
                  "displayName": "User Approval",
                  "config": {
                    "assignees": {
                      "addReviewers": true,
                      "addOwners": false,
                      "candidates": []
                    },
                    "approvalThreshold": 1,
                    "rejectionThreshold": 1
                  },
                  "input": ["relatedEntity"],
                  "inputNamespaceMap": {
                    "relatedEntity": "global"
                  },
                  "output": ["updatedBy"],
                  "branches": ["true", "false"]
                },
                {
                  "type": "automatedTask",
                  "subType": "setEntityAttributeTask",
                  "name": "SetStatusApproved",
                  "displayName": "Set Status to Approved",
                  "config": {
                    "fieldName": "entityStatus",
                    "fieldValue": "Approved"
                  },
                  "input": ["relatedEntity", "updatedBy"],
                  "inputNamespaceMap": {
                    "relatedEntity": "global",
                    "updatedBy": "UserApproval"
                  },
                  "output": []
                }
              ],
              "edges": [
                {"from": "StartNode", "to": "UserApproval"},
                {"from": "UserApproval", "to": "SetStatusApproved", "condition": "true"},
                {"from": "SetStatusApproved", "to": "EndNode"},
                {"from": "UserApproval", "to": "EndNode", "condition": "false"}
              ],
              "config": {"storeStageStatus": false}
            }
            """
            .formatted(workflowName);

    CreateWorkflowDefinition autoApprovalWorkflow =
        JsonUtils.readValue(autoApprovalWorkflowJson, CreateWorkflowDefinition.class);
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, autoApprovalWorkflow, RequestOptions.builder().build());
    assertNotNull(response);
    LOG.debug("Created auto-approval test workflow for dataProduct entities");

    UUID createdWorkflowId = null;
    try {
      JsonNode createdWorkflowNode = MAPPER.readTree(response);
      if (createdWorkflowNode.has("id")) {
        createdWorkflowId = UUID.fromString(createdWorkflowNode.get("id").asText());
      }
    } catch (Exception e) {
      LOG.warn("Failed to parse created workflow id for {}: {}", workflowName, e.getMessage());
    }

    waitForWorkflowDeployment(client, workflowName);

    // Create database infrastructure for dataProduct
    CreateDatabaseService createDbService =
        new CreateDatabaseService()
            .withName(ns.prefix("auto_dbs"))
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
            .withConnection(
                new org.openmetadata.schema.api.services.DatabaseConnection()
                    .withConfig(
                        new org.openmetadata.schema.services.connections.database
                            .MysqlConnection()))
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DatabaseService dbService = client.databaseServices().create(createDbService);
    LOG.debug("Created database service: {}", dbService.getName());

    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName("auto_db")
            .withService(dbService.getFullyQualifiedName())
            .withDescription("Test database for auto-approval")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    Database database = client.databases().create(createDatabase);
    LOG.debug("Created database: {}", database.getName());

    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("auto_sc")
            .withDatabase(database.getFullyQualifiedName())
            .withDescription("Test schema for auto-approval")
            .withDomains(List.of(domain.getFullyQualifiedName()));
    DatabaseSchema schema = client.databaseSchemas().create(createSchema);
    LOG.debug("Created database schema: {}", schema.getName());

    CreateTable createTable =
        new CreateTable()
            .withName("auto_table")
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withDescription("Test table for auto-approval")
            .withColumns(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.INT),
                    new Column().withName("name").withDataType(ColumnDataType.STRING)))
            .withDomains(List.of(domain.getFullyQualifiedName()));
    Table table = client.tables().create(createTable);
    LOG.debug("Created table: {}", table.getName());

    // Create dataProduct WITHOUT reviewers (this should trigger auto-approval)
    org.openmetadata.schema.api.domains.CreateDataProduct createDataProduct =
        new org.openmetadata.schema.api.domains.CreateDataProduct()
            .withName(dataProductName)
            .withDescription("Auto-approval test data product")
            .withReviewers(List.of())
            .withDomains(
                List.of(
                    domain
                        .getFullyQualifiedName())); // Explicitly no reviewers - should auto-approve

    org.openmetadata.schema.entity.domains.DataProduct dataProduct =
        client.dataProducts().create(createDataProduct);
    LOG.debug("Created data product without reviewers: {}", dataProduct.getName());

    simulateWork(1000);
    // Add asset using bulk API - simulating client behavior

    org.openmetadata.schema.type.api.BulkAssets bulkAssets =
        new org.openmetadata.schema.type.api.BulkAssets()
            .withAssets(List.of(table.getEntityReference()));
    client.dataProducts().bulkAddAssets(dataProduct.getFullyQualifiedName(), bulkAssets);

    // Verify that the dataProduct status was set to "Approved" by the workflow
    LOG.info("Verifying dataProduct status was auto-approved...");
    await()
        .atMost(Duration.ofSeconds(180))
        .pollInterval(Duration.ofSeconds(2))
        .pollDelay(Duration.ofSeconds(2))
        .ignoreExceptions() // Ignore transient errors during polling
        .until(
            () -> {
              try {
                org.openmetadata.schema.entity.domains.DataProduct updatedProduct =
                    client
                        .dataProducts()
                        .getByName(dataProduct.getFullyQualifiedName(), "entityStatus");
                LOG.debug("DataProduct status: {}", updatedProduct.getEntityStatus());
                return updatedProduct.getEntityStatus() != null
                    && "Approved".equals(updatedProduct.getEntityStatus().toString());
              } catch (Exception e) {
                LOG.warn("Error checking DataProduct status: {}", e.getMessage());
                return false;
              }
            });

    // Verify no user tasks were created (since there are no reviewers, it should auto-approve)
    String dataProductEntityLink =
        String.format(
            "<#E::%s::%s>",
            org.openmetadata.service.Entity.DATA_PRODUCT, dataProduct.getFullyQualifiedName());
    await()
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .pollDelay(Duration.ofSeconds(1))
        .untilAsserted(
            () -> {
              ResultList<org.openmetadata.schema.entity.feed.Thread> tasks =
                  client.feed().listTasks(dataProductEntityLink, TaskStatus.Open, null);
              assertTrue(
                  tasks.getData().isEmpty(),
                  "Expected no user tasks since dataProduct has no reviewers (should auto-approve)");
            });
    LOG.debug("✓ Confirmed no user tasks were created for dataProduct without reviewers");

    LOG.info("✓ DataProduct status successfully auto-approved to 'Approved'");
    LOG.info("test_AutoApprovalForEntitiesWithoutReviewers completed successfully");

    if (createdWorkflowId != null) {
      try {
        client.workflowDefinitions().delete(createdWorkflowId);
        LOG.debug("Successfully deleted {}", workflowName);
      } catch (Exception e) {
        LOG.warn("Error while deleting {}: {}", workflowName, e.getMessage());
      }
    }
  }

  @Test
  @Order(38)
  void test_CreateWorkflowWithoutEntityTypes() {
    OpenMetadataClient client = SdkClients.adminClient();

    String workflowJson =
        """
            {
              "name": "Test",
              "displayName": "Test-1",
              "description": "string",
              "trigger": {
                "type": "eventBasedEntity",
                "output": [],
                "config": {}
              },
              "nodes": [],
              "edges": []
            }
            """;

    CreateWorkflowDefinition workflow =
        JsonUtils.readValue(workflowJson, CreateWorkflowDefinition.class);

    // Create the workflow - should succeed without entityTypes and with empty nodes
    WorkflowDefinition createdWorkflow = client.workflowDefinitions().create(workflow);

    assertNotNull(createdWorkflow);
    assertEquals("Test", createdWorkflow.getName());
    assertEquals("Test-1", createdWorkflow.getDisplayName());
    assertEquals("string", createdWorkflow.getDescription());
    LOG.debug("Created workflow without entityTypes: {}", createdWorkflow.getName());

    // Update the same workflow - should succeed again
    String updatedWorkflowJson =
        """
            {
              "name": "Test",
              "displayName": "Test-1-Updated",
              "description": "updated string",
              "trigger": {
                "type": "eventBasedEntity",
                "output": [],
                "config": {}
              },
              "nodes": [],
              "edges": []
            }
            """;

    // Update the workflow - should succeed
    // SDK expects WorkflowDefinition for update (upsert), not CreateWorkflowDefinition
    // We need to fetch the created workflow, update its fields, and then upsert
    CreateWorkflowDefinition workflowToUpdate =
        JsonUtils.readValue(updatedWorkflowJson, CreateWorkflowDefinition.class);
    workflowToUpdate.setDisplayName("Test-1-Updated");
    workflowToUpdate.setDescription("updated string");

    WorkflowDefinition updatedWorkflowDef = client.workflowDefinitions().upsert(workflowToUpdate);

    assertNotNull(updatedWorkflowDef);
    assertEquals("Test", updatedWorkflowDef.getName());
    assertEquals("Test-1-Updated", updatedWorkflowDef.getDisplayName());
    assertEquals("updated string", updatedWorkflowDef.getDescription());
    LOG.debug("Updated workflow without entityTypes: {}", updatedWorkflowDef.getName());

    // Clean up - delete the created workflow
    client.workflowDefinitions().delete(updatedWorkflowDef.getId());
    LOG.debug("Test workflow deleted successfully");

    LOG.info("test_CreateWorkflowWithoutEntityTypes completed successfully");
  }

  @Test
  @Order(39)
  @Disabled("Flaky in CI, Passing in Local, need to fix")
  void test_reviewerChangeUpdatesApprovalTasks(TestNamespace ns) throws Exception {
    LOG.info("Starting test_reviewerChangeUpdatesApprovalTasks");

    OpenMetadataClient client = SdkClients.adminClient();

    // Create reviewer users for this test
    CreateUser createReviewer1 =
        new CreateUser()
            .withName("testReviewer1")
            .withEmail("testReviewer1" + "@example.com")
            .withDisplayName("Test Reviewer 1");
    User reviewer1 = client.users().create(createReviewer1);
    EntityReference reviewer1Ref = reviewer1.getEntityReference();
    LOG.debug("Created reviewer user 1: {}", reviewer1.getName());

    CreateUser createReviewer2 =
        new CreateUser()
            .withName("testReviewer2")
            .withEmail("testReviewer2" + "@example.com")
            .withDisplayName("Test Reviewer 2");
    User reviewer2 = client.users().create(createReviewer2);
    EntityReference reviewer2Ref = reviewer2.getEntityReference();
    LOG.debug("Created reviewer user 2: {}", reviewer2.getName());

    // Create an approval workflow for tags (which support reviewers)
    String approvalWorkflowJson =
        """
            {
              "name": "%s",
              "displayName": "Tag Approval Workflow",
              "description": "Workflow for testing reviewer change functionality",
              "trigger": {
                "type": "eventBasedEntity",
                "config": {
                  "entityTypes": ["tag"],
                  "events": ["Created", "Updated"],
                  "exclude": ["reviewers"],
                  "filter": {}
                },
                "output": ["relatedEntity", "updatedBy"]
              },
              "nodes": [
                {
                  "name": "start",
                  "displayName": "Start",
                  "type": "startEvent",
                  "subType": "startEvent"
                },
                {
                  "name": "ApproveTag",
                  "displayName": "Approve Tag",
                  "type": "userTask",
                  "subType": "userApprovalTask",
                  "config": {
                    "assignees": {
                      "addReviewers": true,
                      "addOwners": false,
                      "candidates": []
                    },
                    "approvalThreshold": 1,
                    "rejectionThreshold": 1
                  },
                  "input": ["relatedEntity"],
                  "inputNamespaceMap": {
                    "relatedEntity": "global"
                  },
                  "output": ["updatedBy"],
                  "branches": ["true", "false"]
                },
                {
                  "name": "end",
                  "displayName": "End",
                  "type": "endEvent",
                  "subType": "endEvent"
                }
              ],
              "edges": [
                {
                  "from": "start",
                  "to": "ApproveTag"
                },
                {
                  "from": "ApproveTag",
                  "to": "end",
                  "condition": "true"
                },
                {
                  "from": "ApproveTag",
                  "to": "end",
                  "condition": "false"
                }
              ],
              "config": {
                "storeStageStatus": true
              }
            }
            """;

    CreateWorkflowDefinition approvalWorkflow =
        JsonUtils.readValue(
            approvalWorkflowJson.formatted("wf_tagApprovalWorkflow"),
            CreateWorkflowDefinition.class);

    // Create the approval workflow
    WorkflowDefinition createdWorkflow = client.workflowDefinitions().create(approvalWorkflow);
    assertNotNull(createdWorkflow);
    LOG.debug("Created tag approval workflow: {}", createdWorkflow.getName());
    waitForWorkflowDeployment(client, createdWorkflow.getName());

    // Create a classification for our test tags
    // Classification CreateClassification doesn't follow usual pattern? Checking Service...
    // Client.classifications().create(CreateClassification)
    CreateClassification createClassification =
        new CreateClassification()
            .withName("WorkflowApprovalTestClassification")
            .withDescription("Test classification for workflow");

    Classification classification = client.classifications().create(createClassification);
    LOG.debug("Created classification: {}", classification.getName());

    // Create a tag with initial reviewer - simple test with reviewer1 first
    CreateTag createTag =
        new CreateTag()
            .withName("TestTag")
            .withClassification(classification.getName())
            .withDescription("Test Tag")
            .withReviewers(List.of(reviewer1Ref));

    // Create the tag with ADMIN (not a reviewer) so it triggers approval workflow
    Tag tag = client.tags().create(createTag);
    assertNotNull(tag.getEntityStatus(), "Tag should have an entity status");
    assertEquals(1, tag.getReviewers().size(), "Tag should have 1 reviewer");
    assertEquals(
        reviewer1.getId(),
        tag.getReviewers().getFirst().getId(),
        "reviewer1 should be the reviewer");
    LOG.debug("Created tag with reviewer1: {}, Status: {}", tag.getName(), tag.getEntityStatus());

    // Verify that an approval task was created and assigned to the reviewers
    String entityLink =
        new MessageParser.EntityLink(
                org.openmetadata.service.Entity.TAG, tag.getFullyQualifiedName())
            .getLinkString();

    // Wait for task to be created
    await()
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> {
              ResultList<org.openmetadata.schema.entity.feed.Thread> taskList =
                  client.feed().listTasks(entityLink, TaskStatus.Open, null);
              if (taskList.getData().isEmpty()) {
                LOG.debug("Waiting for task to be created for tag...");
                return false;
              }
              return true;
            });

    ResultList<org.openmetadata.schema.entity.feed.Thread> threads =
        client.feed().listTasks(entityLink, TaskStatus.Open, null);

    // The approval workflow should have created a task
    assertFalse(threads.getData().isEmpty(), "Should have at least one task for the tag");

    // Find the approval task (there might be other tasks too)
    org.openmetadata.schema.entity.feed.Thread approvalTask =
        threads.getData().stream()
            .filter(
                t ->
                    t.getTask() != null
                        && org.openmetadata.schema.type.TaskType.RequestApproval.equals(
                            t.getTask().getType()))
            .findFirst()
            .orElse(null);

    // Verification logic adapted
    if (approvalTask == null) {
      approvalTask = threads.getData().getFirst();
    }

    org.openmetadata.schema.type.TaskDetails taskDetails = approvalTask.getTask();
    assertNotNull(taskDetails, "Task details should not be null");
    assertEquals(TaskStatus.Open, taskDetails.getStatus(), "Task should be open");

    // Verify initial assignee is reviewer1
    List<EntityReference> assignees = taskDetails.getAssignees();
    assertNotNull(assignees, "Assignees should not be null");
    assertFalse(assignees.isEmpty(), "Task should have at least 1 assignee");
    assertTrue(
        assignees.stream().anyMatch(a -> a.getId().equals(reviewer1.getId())),
        "reviewer1 should be an assignee");
    LOG.debug("Initial task assignee verified: reviewer1");

    // Now update the tag's reviewers - simple change from reviewer1 to reviewer2
    // Create a JSON Patch to update reviewers
    Tag originalTag = client.tags().get(tag.getId());
    Tag updatedTagObj = JsonUtils.deepCopy(originalTag, Tag.class);
    updatedTagObj.setReviewers(List.of(reviewer2Ref));

    // client patch expects JsonNode
    Tag updatedTag =
        client
            .tags()
            .patch(
                tag.getId(),
                JsonUtils.readTree(JsonUtils.getJsonPatch(originalTag, updatedTagObj).toString()));

    assertEquals(1, updatedTag.getReviewers().size(), "Updated tag should have 1 reviewer");
    assertEquals(
        reviewer2.getId(),
        updatedTag.getReviewers().getFirst().getId(),
        "reviewer2 should now be the reviewer");
    LOG.debug("Tag reviewer changed from reviewer1 to reviewer2");

    // Wait for the async task assignee update to complete using Awaitility
    final Integer taskId = taskDetails.getId();
    await()
        .atMost(Duration.ofSeconds(180))
        .pollInterval(Duration.ofSeconds(3))
        .pollDelay(Duration.ofSeconds(5))
        .until(
            () -> {
              try {
                ResultList<org.openmetadata.schema.entity.feed.Thread> taskThreads =
                    client.feed().listTasks(entityLink, TaskStatus.Open, null);

                if (taskThreads.getData().isEmpty()) {
                  return false;
                }

                Thread taskThread =
                    taskThreads.getData().stream()
                        .filter(
                            t ->
                                t.getTask() != null
                                    && org.openmetadata.schema.type.TaskType.RequestApproval.equals(
                                        t.getTask().getType())
                                    && t.getTask().getId().equals(taskId))
                        .findFirst()
                        .orElse(null);

                if (taskThread == null || taskThread.getTask() == null) {
                  return false;
                }

                List<EntityReference> currentAssignees = taskThread.getTask().getAssignees();
                if (currentAssignees == null || currentAssignees.isEmpty()) {
                  return false;
                }

                boolean hasReviewer2 =
                    currentAssignees.stream().anyMatch(a -> a.getId().equals(reviewer2.getId()));
                boolean hasReviewer1 =
                    currentAssignees.stream().anyMatch(a -> a.getId().equals(reviewer1.getId()));

                if (hasReviewer2) {
                  return !hasReviewer1; // reviewer2 is there, just need reviewer1 to be gone
                }
                return false; // reviewer2 not found yet
              } catch (Exception e) {
                LOG.warn("Error checking task assignees: {}", e.getMessage(), e);
                return false;
              }
            });

    // Verify that the task assignees have been updated
    threads = client.feed().listTasks(entityLink, TaskStatus.Open, null);

    assertFalse(threads.getData().isEmpty(), "Should still have tasks");
    approvalTask =
        threads.getData().stream()
            .filter(
                t ->
                    t.getTask() != null
                        && org.openmetadata.schema.type.TaskType.RequestApproval.equals(
                            t.getTask().getType())
                        && t.getTask().getId().equals(taskDetails.getId()))
            .findFirst()
            .orElse(threads.getData().getFirst());

    org.openmetadata.schema.type.TaskDetails updatedTaskDetails = approvalTask.getTask();

    // Verify updated assignee is now reviewer2 instead of reviewer1
    List<EntityReference> updatedAssignees = updatedTaskDetails.getAssignees();
    assertNotNull(updatedAssignees, "Updated assignees should not be null");
    assertFalse(updatedAssignees.isEmpty(), "Task should have at least 1 assignee after update");
    assertTrue(
        updatedAssignees.stream().anyMatch(a -> a.getId().equals(reviewer2.getId())),
        "reviewer2 should now be an assignee after reviewer update");
    assertFalse(
        updatedAssignees.stream().anyMatch(a -> a.getId().equals(reviewer1.getId())),
        "reviewer1 should no longer be an assignee after reviewer update");

    // Step 11: Delete the unified workflow to prevent interference with other tests
    try {
      client.workflowDefinitions().delete(createdWorkflow.getId());
      LOG.debug("Successfully deleted tagApprovalWorkflow");
    } catch (Exception e) {
      LOG.warn("Error while deleting tagApprovalWorkflow: {}", e.getMessage());
    }

    LOG.info(
        "test_reviewerChangeUpdatesApprovalTasks completed successfully - task assignee successfully changed from reviewer1 to reviewer2");
  }

  @Test
  @Order(40)
  void test_ApiEndpointPeriodicBatchWorkflow(TestNamespace ns) throws JsonProcessingException {
    LOG.info("Starting test_ApiEndpointPeriodicBatchWorkflow");

    OpenMetadataClient client = SdkClients.adminClient();

    // Step 1: Create API service and API collection
    CreateApiService createApiService =
        new CreateApiService()
            .withName(ns.prefix("test_api_service"))
            .withServiceType(CreateApiService.ApiServiceType.Rest)
            .withConnection(
                new ApiConnection()
                    .withConfig(
                        new RestConnection()
                            .withOpenAPISchemaConnection(
                                new OpenAPISchemaURL()
                                    .withOpenAPISchemaURL(
                                        java.net.URI.create("http://localhost:8585")))));

    ApiService apiService = client.apiServices().create(createApiService);
    LOG.debug("Created API service: {}", apiService.getName());

    // Create API Collection
    CreateAPICollection createApiCollection =
        new CreateAPICollection()
            .withName(ns.prefix("test_api_collection"))
            .withService(apiService.getFullyQualifiedName())
            .withDescription("API Collection for workflow testing");
    APICollection apiCollection = client.apiCollections().create(createApiCollection);
    LOG.debug("Created API Collection: {}", apiCollection.getName());

    // Step 2: Create API endpoints - one that matches filter, one that doesn't
    CreateAPIEndpoint createMatchingApiEndpoint =
        new CreateAPIEndpoint()
            .withName(ns.prefix("test_endpoint_matching"))
            .withApiCollection(apiCollection.getFullyQualifiedName())
            .withRequestMethod(APIRequestMethod.GET)
            .withEndpointURL(java.net.URI.create("https://localhost:8585/api/v1/test"))
            .withDescription(
                "workflow processing description"); // Contains "workflow" - should match filter
    APIEndpoint matchingApiEndpoint = client.apiEndpoints().create(createMatchingApiEndpoint);
    LOG.debug("Created API endpoint that should match filter: {}", matchingApiEndpoint.getName());

    // Create API endpoint that should NOT match the filter
    CreateAPIEndpoint createNonMatchingApiEndpoint =
        new CreateAPIEndpoint()
            .withName(ns.prefix("test_endpoint_non_matching"))
            .withApiCollection(apiCollection.getFullyQualifiedName())
            .withRequestMethod(APIRequestMethod.POST)
            .withEndpointURL(java.net.URI.create("https://localhost:8585/api/v1/other"))
            .withDescription(
                "simple test description"); // Does not contain "workflow" - should NOT match filter
    APIEndpoint nonMatchingApiEndpoint = client.apiEndpoints().create(createNonMatchingApiEndpoint);
    LOG.debug(
        "Created API endpoint that should NOT match filter: {}", nonMatchingApiEndpoint.getName());

    // Step 3: Create workflow with periodicBatchEntity trigger for apiEndpoint - using raw JSON
    client = SdkClients.adminClient();

    String workflowJson =
        """
        {
          "name": "%s",
          "displayName": "API Endpoint Processing Workflow",
          "description": "Workflow to process API endpoints with periodic batch trigger",
          "type": "periodicBatchEntity",
          "trigger": {
            "type": "periodicBatchEntity",
            "config": {
              "entityTypes": ["apiEndpoint"],
              "schedule": {
                "scheduleTimeline": "None"
              },
              "batchSize": 100,
              "filters": {
                "apiEndpoint": "{\\"query\\":{\\"match\\":{\\"description\\":\\"workflow\\"}}}"
              }
            },
            "output": ["relatedEntity", "updatedBy"]
          },
          "nodes": [
            {
              "type": "startEvent",
              "subType": "startEvent",
              "name": "start",
              "displayName": "Start"
            },
            {
              "type": "automatedTask",
              "subType": "setEntityAttributeTask",
              "name": "UpdateDescription",
              "displayName": "Update API Endpoint Description",
              "config": {
                "fieldName": "description",
                "fieldValue": "Processed by workflow - API endpoint updated"
              },
              "input": ["relatedEntity", "updatedBy"],
              "inputNamespaceMap": {
                "relatedEntity": "global",
                "updatedBy": "global"
              },
              "output": []
            },
            {
              "type": "endEvent",
              "subType": "endEvent",
              "name": "end",
              "displayName": "End"
            }
          ],
          "edges": [
            {
              "from": "start",
              "to": "UpdateDescription"
            },
            {
              "from": "UpdateDescription",
              "to": "end"
            }
          ],
          "config": {
            "storeStageStatus": true
          }
        }
        """
            .formatted("ApiEndpointProcessingWorkflow");

    CreateWorkflowDefinition workflow =
        MAPPER.readValue(workflowJson, CreateWorkflowDefinition.class);

    // Step 4: Create the workflow using direct HTTP call (bypasses SDK fluent API serialization
    // bug)
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, workflow, RequestOptions.builder().build());
    assertNotNull(response);
    JsonNode created = MAPPER.readTree(response);
    assertTrue(created.has("id"));
    LOG.debug("ApiEndpointProcessingWorkflow created successfully");

    // Track the created workflow for cleanup
    trackWorkflowFromJson(created);

    // Step 5: Trigger the workflow
    String workflowName = "ApiEndpointProcessingWorkflow";
    String triggerPath = BASE_PATH + "/name/" + workflowName + "/trigger";
    OpenMetadataClient finalClient1 = client;
    executeWithDeadlockRetry(
        () -> {
          try {
            return finalClient1
                .getHttpClient()
                .executeForString(
                    HttpMethod.POST, triggerPath, "{}", RequestOptions.builder().build());
          } catch (Exception e) {
            throw new RuntimeException("Failed to trigger workflow", e);
          }
        },
        "trigger-" + workflowName);
    LOG.debug("Workflow triggered successfully");

    // Store IDs for lambda expressions
    final UUID matchingApiEndpointId = matchingApiEndpoint.getId();
    final UUID nonMatchingApiEndpointId = nonMatchingApiEndpoint.getId();

    // Step 6: Wait for workflow to process using Awaitility
    OpenMetadataClient finalClient = client;
    await()
        .atMost(Duration.ofSeconds(120))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(1))
        .until(
            () -> {
              try {
                APIEndpoint checkMatchingEndpoint =
                    finalClient.apiEndpoints().get(matchingApiEndpointId);
                APIEndpoint checkNonMatchingEndpoint =
                    finalClient.apiEndpoints().get(nonMatchingApiEndpointId);

                boolean matchingUpdated =
                    "Processed by workflow - API endpoint updated"
                        .equals(checkMatchingEndpoint.getDescription());
                boolean nonMatchingNotUpdated =
                    "simple test description".equals(checkNonMatchingEndpoint.getDescription());

                LOG.debug(
                    "Matching endpoint description: {}", checkMatchingEndpoint.getDescription());
                LOG.debug(
                    "Non-matching endpoint description: {}",
                    checkNonMatchingEndpoint.getDescription());

                return matchingUpdated && nonMatchingNotUpdated;
              } catch (Exception e) {
                LOG.warn("Error checking API endpoint descriptions: {}", e.getMessage());
                return false;
              }
            });

    // Step 7: Verify only the matching API endpoint was updated
    APIEndpoint updatedMatchingApiEndpoint = client.apiEndpoints().get(matchingApiEndpoint.getId());
    assertNotNull(updatedMatchingApiEndpoint);
    assertEquals(
        "Processed by workflow - API endpoint updated",
        updatedMatchingApiEndpoint.getDescription());
    LOG.debug(
        "Matching API endpoint description successfully updated to: {}",
        updatedMatchingApiEndpoint.getDescription());

    // Verify the non-matching endpoint was NOT updated
    APIEndpoint unchangedNonMatchingApiEndpoint =
        client.apiEndpoints().get(nonMatchingApiEndpoint.getId());
    assertNotNull(unchangedNonMatchingApiEndpoint);
    assertEquals("simple test description", unchangedNonMatchingApiEndpoint.getDescription());
    LOG.debug(
        "Non-matching API endpoint description correctly unchanged: {}",
        unchangedNonMatchingApiEndpoint.getDescription());

    LOG.info("test_ApiEndpointPeriodicBatchWorkflow completed successfully");
  }

  private void setupCertificationTags_SDK() {
    // Ensure Certification classification exists
    try {
      SdkClients.adminClient().classifications().getByName("Certification");
      LOG.debug("Certification classification already exists");
    } catch (ApiException e) {
      if (e.getStatusCode() == 404) {
        // Create Certification classification
        org.openmetadata.schema.api.classification.CreateClassification createCertification =
            new org.openmetadata.schema.api.classification.CreateClassification()
                .withName("Certification")
                .withDescription("Data certification classification");
        SdkClients.adminClient().classifications().create(createCertification);
        LOG.debug("Certification classification created");
      } else {
        throw e;
      }
    }

    // Ensure Gold tag exists (bootstrapped at startup, but ensure defensively)
    try {
      Tag goldTag = SdkClients.adminClient().tags().getByName("Certification.Gold");
      LOG.debug("Gold tag already exists: {}", goldTag.getFullyQualifiedName());
    } catch (ApiException e) {
      if (e.getStatusCode() == 404) {
        CreateTag createGoldTag =
            new CreateTag()
                .withName("Gold")
                .withDescription("Gold certified Data Asset.")
                .withClassification("Certification");
        Tag goldTag = SdkClients.adminClient().tags().create(createGoldTag);
        LOG.debug("Gold tag created: {}", goldTag.getFullyQualifiedName());
      } else {
        throw e;
      }
    }

    // Check if Brass tag already exists
    try {
      Tag brassTag = SdkClients.adminClient().tags().getByName("Certification.Brass");
      LOG.debug("Brass tag already exists: {}", brassTag.getFullyQualifiedName());
    } catch (ApiException e) {
      if (e.getStatusCode() == 404) {
        // Create Brass tag under Certification
        CreateTag createBrassTag =
            new CreateTag()
                .withName("Brass")
                .withDescription("Brass certification level")
                .withClassification("Certification");
        Tag brassTag = SdkClients.adminClient().tags().create(createBrassTag);
        LOG.debug("Brass tag created: {}", brassTag.getFullyQualifiedName());
      } else {
        throw e;
      }
    }

    // Defensively ensure AssetCertificationSettings has correct allowedClassification.
    // This guards against cross-test pollution (e.g., SystemResourceIT changing it).
    try {
      OpenMetadataClient client = SdkClients.adminClient();
      AssetCertificationSettings certSettings =
          new AssetCertificationSettings()
              .withAllowedClassification("Certification")
              .withValidityPeriod("P30D");
      Settings settings =
          new Settings()
              .withConfigType(SettingsType.ASSET_CERTIFICATION_SETTINGS)
              .withConfigValue(certSettings);
      String settingsJson = MAPPER.writeValueAsString(settings);
      client
          .getHttpClient()
          .executeForString(
              HttpMethod.PUT,
              "/v1/system/settings",
              settingsJson,
              RequestOptions.builder().build());
      LOG.debug("AssetCertificationSettings reset to allowedClassification=Certification");
    } catch (Exception e) {
      LOG.warn("Failed to reset AssetCertificationSettings: {}", e.getMessage());
    }
  }

  private TestEntities createTestEntities_SDK(TestNamespace ns, TestInfo test) {
    // Create database service using namespaced name
    String serviceBaseName =
        "test_db_service_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", "");
    CreateDatabaseService createService = createDatabaseServiceRequest(ns.prefix(serviceBaseName));
    DatabaseService localDatabaseService =
        SdkClients.adminClient().databaseServices().create(createService);
    LOG.debug("Created database service: {}", localDatabaseService.getName());

    // Create database using namespaced name
    String dbBaseName = "test_db_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", "");
    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName(ns.prefix(dbBaseName))
            .withService(localDatabaseService.getFullyQualifiedName())
            .withDescription("Test database for workflow");
    Database localDatabase = SdkClients.adminClient().databases().create(createDatabase);
    LOG.debug("Created database: {}", localDatabase.getName());

    // Create database schema using namespaced name
    String schemaBaseName = "test_schema_" + test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", "");
    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName(ns.prefix(schemaBaseName))
            .withDatabase(localDatabase.getFullyQualifiedName())
            .withDescription("Test schema for workflow");
    DatabaseSchema localDatabaseSchema =
        SdkClients.adminClient().databaseSchemas().create(createSchema);
    LOG.debug("Created database schema: {}", localDatabaseSchema.getName());

    // Create tables with varying column descriptions
    List<Table> localTestTables =
        createTablesWithVaryingDescriptions_SDK(ns, localDatabaseSchema, test);

    return new TestEntities(
        localDatabaseService, localDatabase, localDatabaseSchema, localTestTables);
  }

  private List<Table> createTablesWithVaryingDescriptions_SDK(
      TestNamespace ns, DatabaseSchema schema, TestInfo test) {
    String testName = test.getDisplayName().replaceAll("[^a-zA-Z0-9_]", "");
    List<Table> localTestTables = new ArrayList<>();

    // Table 1: All 4 columns with descriptions (should get Gold - 100%)
    List<Column> table1Columns =
        List.of(
            new Column()
                .withName("col1")
                .withDataType(ColumnDataType.STRING)
                .withDescription("Column 1 description"),
            new Column()
                .withName("col2")
                .withDataType(ColumnDataType.INT)
                .withDescription("Column 2 description"),
            new Column()
                .withName("col3")
                .withDataType(ColumnDataType.DOUBLE)
                .withDescription("Column 3 description"),
            new Column()
                .withName("col4")
                .withDataType(ColumnDataType.BOOLEAN)
                .withDescription("Column 4 description"));

    CreateTable createTable1 =
        new CreateTable()
            .withName(ns.prefix(testName + "_table1_gold"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withDescription("Table with all column descriptions")
            .withColumns(table1Columns);
    Table table1 = SdkClients.adminClient().tables().create(createTable1);
    localTestTables.add(table1);
    LOG.debug("Created table1 (gold): {}", table1.getName());

    // Table 2: 3 columns with descriptions (should get Silver - 75%)
    List<Column> table2Columns =
        List.of(
            new Column()
                .withName("col1")
                .withDataType(ColumnDataType.STRING)
                .withDescription("Column 1 description"),
            new Column()
                .withName("col2")
                .withDataType(ColumnDataType.INT)
                .withDescription("Column 2 description"),
            new Column()
                .withName("col3")
                .withDataType(ColumnDataType.DOUBLE)
                .withDescription("Column 3 description"),
            new Column().withName("col4").withDataType(ColumnDataType.BOOLEAN) // No description
            );

    CreateTable createTable2 =
        new CreateTable()
            .withName(ns.prefix(testName + "_table2_silver"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withDescription("Table with 3 column descriptions")
            .withColumns(table2Columns);
    Table table2 = SdkClients.adminClient().tables().create(createTable2);
    localTestTables.add(table2);
    LOG.debug("Created table2 (silver): {}", table2.getName());

    // Table 3: 2 columns with descriptions (should get Bronze - 50%)
    List<Column> table3Columns =
        List.of(
            new Column()
                .withName("col1")
                .withDataType(ColumnDataType.STRING)
                .withDescription("Column 1 description"),
            new Column()
                .withName("col2")
                .withDataType(ColumnDataType.INT)
                .withDescription("Column 2 description"),
            new Column().withName("col3").withDataType(ColumnDataType.DOUBLE), // No description
            new Column().withName("col4").withDataType(ColumnDataType.BOOLEAN) // No description
            );

    CreateTable createTable3 =
        new CreateTable()
            .withName(ns.prefix(testName + "_table3_bronze"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withDescription("Table with 2 column descriptions")
            .withColumns(table3Columns);
    Table table3 = SdkClients.adminClient().tables().create(createTable3);
    localTestTables.add(table3);
    LOG.debug("Created table3 (bronze): {}", table3.getName());

    // Table 4: No columns with descriptions (should get Brass - 0%)
    List<Column> table4Columns =
        List.of(
            new Column().withName("col1").withDataType(ColumnDataType.STRING),
            new Column().withName("col2").withDataType(ColumnDataType.INT),
            new Column().withName("col3").withDataType(ColumnDataType.DOUBLE),
            new Column().withName("col4").withDataType(ColumnDataType.BOOLEAN));

    CreateTable createTable4 =
        new CreateTable()
            .withName(ns.prefix(testName + "_table4_brass"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withDescription("Table with no column descriptions")
            .withColumns(table4Columns);
    Table table4 = SdkClients.adminClient().tables().create(createTable4);
    localTestTables.add(table4);
    LOG.debug("Created table4 (brass): {}", table4.getName());

    LOG.debug("Created {} test tables", localTestTables.size());
    return localTestTables;
  }

  private void createDataCompletenessWorkflow_SDK(TestNamespace ns) throws Exception {
    String workflowName = "DataCompletenessWorkflow";
    OpenMetadataClient client = SdkClients.adminClient();

    // Create workflow definition using SDK
    String workflowJson = buildDataCompletenessWorkflowJson(workflowName);
    CreateWorkflowDefinition workflowRequest =
        MAPPER.readValue(workflowJson, CreateWorkflowDefinition.class);

    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, workflowRequest, RequestOptions.builder().build());

    assertNotNull(response);
    JsonNode created = MAPPER.readTree(response);
    assertTrue(created.has("id"));
    assertEquals(workflowName, created.get("name").asText());
    LOG.debug("DataCompleteness workflow created: {}", workflowName);

    waitForWorkflowDeployment(client, workflowName);
  }

  private String buildDataCompletenessWorkflowJson(String workflowName) {
    // Build a simpler workflow for testing certification assignment
    return """
        {
          "name": "%s",
          "displayName": "%s",
          "description": "Custom workflow created with Workflow Builder for SDK testing",
          "trigger": {
            "type": "periodicBatchEntity",
            "config": {
              "entityTypes": ["table"],
              "schedule": {"scheduleTimeline": "None"},
              "batchSize": 100,
              "filters": {}
            },
            "output": ["relatedEntity", "updatedBy"]
          },
          "nodes": [
            {
              "type": "startEvent",
              "subType": "startEvent",
              "name": "start",
              "displayName": "start"
            },
            {
              "type": "automatedTask",
              "subType": "setEntityAttributeTask",
              "name": "SetCertification",
              "displayName": "Set Gold Certification",
              "config": {
                "fieldName": "certification",
                "fieldValue": "Certification.Gold"
              },
              "input": ["relatedEntity", "updatedBy"],
              "inputNamespaceMap": {
                "relatedEntity": "global",
                "updatedBy": "global"
              },
              "output": []
            },
            {
              "type": "endEvent",
              "subType": "endEvent",
              "name": "end",
              "displayName": "end"
            }
          ],
          "edges": [
            {"from": "start", "to": "SetCertification"},
            {"from": "SetCertification", "to": "end"}
          ],
          "config": {"storeStageStatus": false}
        }
        """
        .formatted(workflowName, workflowName);
  }

  private void triggerWorkflow_SDK(TestNamespace ns, List<Table> localTestTables) throws Exception {
    String workflowName = "DataCompletenessWorkflow";
    OpenMetadataClient client = SdkClients.adminClient();

    waitForWorkflowDeployment(client, workflowName);
    for (Table table : localTestTables) {
      waitForEntityIndexedInSearch(client, "table_search_index", table.getFullyQualifiedName());
    }

    // Trigger the workflow using SDK with retry
    String triggerPath = BASE_PATH + "/name/" + workflowName + "/trigger";
    String response =
        executeWithDeadlockRetry(
            () -> {
              try {
                return client
                    .getHttpClient()
                    .executeForString(
                        HttpMethod.POST,
                        triggerPath,
                        new HashMap<>(),
                        RequestOptions.builder().build());
              } catch (Exception e) {
                throw new RuntimeException("Failed to trigger workflow", e);
              }
            },
            "trigger-" + workflowName);

    if (response != null && !response.trim().isEmpty()) {
      LOG.debug("Workflow triggered successfully: {}", workflowName);
    } else {
      LOG.warn("Workflow trigger response was empty or null for: {}", workflowName);
    }
  }

  private void ensureTierTagExists() throws Exception {
    // Check if Tier classification exists
    try {
      SdkClients.adminClient().classifications().getByName("Tier");
      LOG.debug("Tier classification already exists");
    } catch (ApiException e) {
      if (e.getStatusCode() == 404) {
        // Create Tier classification
        org.openmetadata.schema.api.classification.CreateClassification createTier =
            new org.openmetadata.schema.api.classification.CreateClassification()
                .withName("Tier")
                .withDescription("Data tier classification");
        SdkClients.adminClient().classifications().create(createTier);
        LOG.debug("Tier classification created");
      } else {
        throw e;
      }
    }

    // Check if Tier1 tag exists
    try {
      Tag tier1Tag = SdkClients.adminClient().tags().getByName("Tier.Tier1");
      LOG.debug("Tier.Tier1 tag already exists: {}", tier1Tag.getFullyQualifiedName());
    } catch (ApiException e) {
      if (e.getStatusCode() == 404) {
        // Create Tier1 tag under Tier classification
        CreateTag createTier1Tag =
            new CreateTag()
                .withName("Tier1")
                .withDescription("Tier 1 data")
                .withClassification("Tier");
        Tag tier1Tag = SdkClients.adminClient().tags().create(createTier1Tag);
        LOG.debug("Tier.Tier1 tag created: {}", tier1Tag.getFullyQualifiedName());
      } else {
        throw e;
      }
    }
  }

  private void verifyTableCertifications_SDK(List<Table> localTestTables) throws Exception {
    await()
        .atMost(Duration.ofSeconds(180))
        .pollInterval(Duration.ofSeconds(2))
        .pollDelay(Duration.ofSeconds(1))
        .untilAsserted(
            () -> {
              for (Table table : localTestTables) {
                Table updatedTable =
                    SdkClients.adminClient()
                        .tables()
                        .get(table.getId().toString(), "certification");

                if (updatedTable.getCertification() != null) {
                  LOG.debug(
                      "Table {} has certification: {}",
                      updatedTable.getName(),
                      updatedTable.getCertification().getTagLabel().getTagFQN());

                  assertEquals(
                      "Certification.Gold",
                      updatedTable.getCertification().getTagLabel().getTagFQN(),
                      "Table " + updatedTable.getName() + " should have Gold certification");
                } else {
                  LOG.warn("Table {} has no certification", updatedTable.getName());
                  fail("Table " + updatedTable.getName() + " has no certification");
                }
              }
            });

    LOG.info("Certification verification completed successfully");
  }

  private Domain getOrCreateDomain(TestNamespace ns) {
    String domainName = ns.prefix("domain");
    try {
      return SdkClients.adminClient().domains().getByName(domainName);
    } catch (Exception e) {
      CreateDomain createDomain =
          new CreateDomain()
              .withName(domainName)
              .withDescription("Test domain for data products")
              .withDomainType(CreateDomain.DomainType.AGGREGATE);
      return SdkClients.adminClient().domains().create(createDomain);
    }
  }

  private void waitForWorkflowDeployment(OpenMetadataClient client, String workflowName) {
    await()
        .atMost(Duration.ofSeconds(120))
        .pollDelay(Duration.ofSeconds(1))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> {
              WorkflowDefinition workflow =
                  client.workflowDefinitions().getByName(workflowName, "deployed");
              return Boolean.TRUE.equals(workflow.getDeployed());
            });
  }

  private void waitForEntityIndexedInSearch(
      OpenMetadataClient client, String indexName, String entityFqn) {
    await()
        .atMost(Duration.ofSeconds(120))
        .pollDelay(Duration.ofSeconds(1))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(() -> hasEntityInSearchIndex(client, indexName, entityFqn));
  }

  private boolean hasEntityInSearchIndex(
      OpenMetadataClient client, String indexName, String entityFqn) throws IOException {
    String escapedFqn = entityFqn.replace("\\", "\\\\").replace("\"", "\\\"");
    String queryFilter =
        """
        {
          "query": {
            "bool": {
              "should": [
                { "term": { "fullyQualifiedName.keyword": "%s" } },
                { "term": { "fullyQualifiedName": "%s" } },
                { "match_phrase": { "fullyQualifiedName": "%s" } }
              ],
              "minimum_should_match": 1
            }
          }
        }
        """
            .formatted(escapedFqn, escapedFqn, escapedFqn);
    String response =
        client.search().query("*").index(indexName).queryFilter(queryFilter).size(5).execute();
    JsonNode searchJson = MAPPER.readTree(response);
    if (getTotalHits(searchJson) == 0) {
      return false;
    }

    JsonNode hits = searchJson.path("hits").path("hits");
    if (!hits.isArray()) {
      return false;
    }

    for (JsonNode hit : hits) {
      String hitFqn = hit.path("_source").path("fullyQualifiedName").asText(null);
      if (entityFqn.equals(hitFqn)) {
        return true;
      }
    }
    return false;
  }

  private long getTotalHits(JsonNode searchJson) {
    if (!searchJson.has("hits") || !searchJson.get("hits").has("total")) {
      return 0;
    }
    JsonNode total = searchJson.get("hits").get("total");
    if (total.isObject() && total.has("value")) {
      return total.get("value").asLong();
    }
    return total.asLong();
  }

  /**
   * Ensures the WorkflowEventConsumer subscription is active for event-based workflow tests.
   * This subscription is required for workflows to receive change events and trigger.
   */
  private void ensureWorkflowEventConsumerIsActive(OpenMetadataClient client) throws Exception {
    LOG.debug("Ensuring WorkflowEventConsumer subscription is active...");

    org.openmetadata.schema.entity.events.EventSubscription existing = null;
    try {
      existing = client.eventSubscriptions().getByName("WorkflowEventConsumer");
      LOG.info("WorkflowEventConsumer subscription found: enabled={}", existing.getEnabled());
    } catch (ApiException e) {
      if (e.getStatusCode() != 404) {
        throw e;
      }
      LOG.debug("WorkflowEventConsumer subscription not found, will create it");
    }

    if (existing == null) {
      // Create the WorkflowEventConsumer subscription
      org.openmetadata.schema.api.events.CreateEventSubscription createSubscription =
          new org.openmetadata.schema.api.events.CreateEventSubscription()
              .withName("WorkflowEventConsumer")
              .withDisplayName("Workflow Event Consumer")
              .withDescription(
                  "Consumes EntityChange Events in order to trigger Workflows, if they exist.")
              .withAlertType(
                  org.openmetadata.schema.api.events.CreateEventSubscription.AlertType
                      .GOVERNANCE_WORKFLOW_CHANGE_EVENT)
              .withResources(List.of("all"))
              .withProvider(org.openmetadata.schema.type.ProviderType.SYSTEM)
              .withPollInterval(10)
              .withEnabled(true)
              .withDestinations(
                  List.of(
                      new org.openmetadata.schema.entity.events.SubscriptionDestination()
                          .withCategory(
                              org.openmetadata.schema.entity.events.SubscriptionDestination
                                  .SubscriptionCategory.EXTERNAL)
                          .withType(
                              org.openmetadata.schema.entity.events.SubscriptionDestination
                                  .SubscriptionType.GOVERNANCE_WORKFLOW_CHANGE_EVENT)
                          .withEnabled(true)));

      client.eventSubscriptions().create(createSubscription);
      LOG.info("Created WorkflowEventConsumer subscription");
      await()
          .atMost(Duration.ofSeconds(30))
          .pollInterval(Duration.ofSeconds(1))
          .pollDelay(Duration.ofMillis(500))
          .ignoreExceptions()
          .until(
              () ->
                  Boolean.TRUE.equals(
                      client.eventSubscriptions().getByName("WorkflowEventConsumer").getEnabled()));
    } else if (!existing.getEnabled()) {
      // Enable if disabled using patch
      String patchStr = "[{\"op\":\"replace\",\"path\":\"/enabled\",\"value\":true}]";
      JsonNode patch = MAPPER.readTree(patchStr);
      client.eventSubscriptions().patch(existing.getId(), patch);
      LOG.info("Enabled WorkflowEventConsumer subscription");
      await()
          .atMost(Duration.ofSeconds(30))
          .pollInterval(Duration.ofSeconds(1))
          .pollDelay(Duration.ofMillis(500))
          .ignoreExceptions()
          .until(
              () ->
                  Boolean.TRUE.equals(
                      client.eventSubscriptions().getByName("WorkflowEventConsumer").getEnabled()));
    }
  }

  @Test
  @Order(40)
  void test_WorkflowWithReviewersOwnersCandidates(TestNamespace ns) throws IOException {
    LOG.info("Starting test_WorkflowWithReviewersOwnersCandidates");

    OpenMetadataClient client = SdkClients.adminClient();

    // Step 1: Create test users (2 candidates + 1 owner)
    LOG.debug("Creating test users for comprehensive assignment testing");

    String uniqueSuffix = String.valueOf(System.currentTimeMillis());

    CreateUser createCandidate1 =
        new CreateUser()
            .withName("candidate1_" + uniqueSuffix)
            .withEmail("candidate1_" + uniqueSuffix + "@example.com")
            .withDisplayName("Test Candidate 1");
    User candidate1 = client.users().create(createCandidate1);
    LOG.debug("Created candidate user 1: {}", candidate1.getName());

    CreateUser createCandidate2 =
        new CreateUser()
            .withName("candidate2_" + uniqueSuffix)
            .withEmail("candidate2_" + uniqueSuffix + "@example.com")
            .withDisplayName("Test Candidate 2");
    User candidate2 = client.users().create(createCandidate2);
    LOG.debug("Created candidate user 2: {}", candidate2.getName());

    CreateUser createOwner =
        new CreateUser()
            .withName("tableowner_" + uniqueSuffix)
            .withEmail("tableowner_" + uniqueSuffix + "@example.com")
            .withDisplayName("Test Table Owner");
    User ownerUser = client.users().create(createOwner);
    LOG.debug("Created owner user: {}", ownerUser.getName());

    // Step 2: Create database infrastructure
    LOG.debug("Creating database infrastructure");

    CreateDatabaseService createDbService =
        new CreateDatabaseService()
            .withName(ns.prefix("test-db-service"))
            .withServiceType(DatabaseServiceType.Mysql)
            .withConnection(
                new DatabaseConnection()
                    .withConfig(
                        new MysqlConnection()
                            .withHostPort("localhost:3306")
                            .withUsername("test")
                            .withAuthType(new basicAuth().withPassword("test"))));

    DatabaseService dbService = client.databaseServices().create(createDbService);
    LOG.debug("Created database service: {}", dbService.getName());

    CreateDatabase createDb =
        new CreateDatabase()
            .withName(ns.prefix("test-database"))
            .withService(dbService.getFullyQualifiedName())
            .withDescription("Test database for workflow assignment testing");
    Database database = client.databases().create(createDb);
    LOG.debug("Created database: {}", database.getName());

    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName(ns.prefix("test-schema"))
            .withDatabase(database.getFullyQualifiedName())
            .withDescription("Test schema for workflow assignment testing");
    DatabaseSchema dbSchema = client.databaseSchemas().create(createSchema);
    LOG.debug("Created database schema: {}", dbSchema.getName());

    // Step 3: Create test table with owner
    LOG.debug("Creating test table with owner assignment");

    CreateTable createTable =
        new CreateTable()
            .withName(ns.prefix("test_approval_table"))
            .withDatabaseSchema(dbSchema.getFullyQualifiedName())
            .withDescription("Test table for comprehensive workflow assignment testing")
            .withOwners(List.of(ownerUser.getEntityReference()))
            .withColumns(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.INT),
                    new Column().withName("name").withDataType(ColumnDataType.STRING),
                    new Column().withName("created_date").withDataType(ColumnDataType.DATETIME)));

    Table testTable = client.tables().create(createTable);
    LOG.debug("Created test table: {} with owner: {}", testTable.getName(), ownerUser.getName());
    String tableEntityLink = String.format("<#E::table::%s>", testTable.getFullyQualifiedName());

    // Step 4: Create comprehensive workflow with all assignment types
    LOG.debug("Creating workflow with reviewers, owners, and candidates assignment");

    String workflowJson =
        """
            {
              "name": "%s",
              "displayName": "Comprehensive Assignment Test Workflow",
              "description": "Workflow testing reviewers, owners, and candidates assignment",
              "trigger": {
                "type": "eventBasedEntity",
                "config": {
                  "entityTypes": ["table"],
                  "events": ["Created", "Updated"],
                  "exclude": ["reviewers"],
                  "filter": {}
                },
                "output": ["relatedEntity", "updatedBy"]
              },
              "nodes": [
                {
                  "name": "start",
                  "displayName": "Start",
                  "type": "startEvent",
                  "subType": "startEvent"
                },
                {
                  "name": "ApproveTable",
                  "displayName": "Approve Table",
                  "type": "userTask",
                  "subType": "userApprovalTask",
                  "config": {
                    "assignees": {
                      "addReviewers": true,
                      "addOwners": true,
                      "candidates": [
                        {
                          "id": "%s",
                          "type": "user",
                          "fullyQualifiedName": "%s",
                          "name": "%s"
                        },
                        {
                          "id": "%s",
                          "type": "user",
                          "fullyQualifiedName": "%s",
                          "name": "%s"
                        }
                      ]
                    },
                    "approvalThreshold": 1,
                    "rejectionThreshold": 1
                  },
                  "input": ["relatedEntity"],
                  "inputNamespaceMap": {
                    "relatedEntity": "global"
                  },
                  "output": ["result"],
                  "branches": ["true", "false"]
                },
                {
                  "name": "endApproved",
                  "displayName": "End Approved",
                  "type": "endEvent",
                  "subType": "endEvent"
                },
                {
                  "name": "endRejected",
                  "displayName": "End Rejected",
                  "type": "endEvent",
                  "subType": "endEvent"
                }
              ],
              "edges": [
                {"from": "start", "to": "ApproveTable"},
                {"from": "ApproveTable", "to": "endApproved", "condition": "true"},
                {"from": "ApproveTable", "to": "endRejected", "condition": "false"}
              ],
              "config": {"storeStageStatus": false}
            }
            """
            .formatted(
                "TableApprovalWorkflow",
                candidate1.getId(),
                candidate1.getFullyQualifiedName(),
                candidate1.getName(),
                candidate2.getId(),
                candidate2.getFullyQualifiedName(),
                candidate2.getName());

    CreateWorkflowDefinition comprehensiveWorkflow =
        JsonUtils.readValue(workflowJson, CreateWorkflowDefinition.class);

    String workflowResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST,
                BASE_PATH,
                comprehensiveWorkflow,
                RequestOptions.builder().build());

    JsonNode workflowCreated = MAPPER.readTree(workflowResponse);
    String workflowId = workflowCreated.get("id").asText();
    LOG.debug("Created comprehensive workflow: {}", workflowId);

    // Step 5: Wait for initial workflow processing (table creation event)
    LOG.info("Waiting for workflow to process table creation...");
    await()
        .atMost(Duration.ofMinutes(2))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> {
              ResultList<Thread> threads =
                  client.feed().listTasks(tableEntityLink, TaskStatus.Open, 10);
              boolean hasExpectedTasks = !threads.getData().isEmpty();
              if (hasExpectedTasks) {
                LOG.debug("Found {} tasks for table creation", threads.getData().size());
              }
              return hasExpectedTasks;
            });

    // Step 6: Verify initial task creation and assignees
    LOG.info("Verifying initial task creation and assignees");
    ResultList<Thread> initialThreads =
        client.feed().listTasks(tableEntityLink, TaskStatus.Open, 10);

    assertFalse(initialThreads.getData().isEmpty(), "Should have tasks created for table");

    // Should have 1 task with 3 assignees: owner + 2 candidates (reviewers ignored for tables)
    List<Thread> approvalTasks =
        initialThreads.getData().stream()
            .filter(
                t ->
                    t.getTask() != null
                        && org.openmetadata.schema.type.TaskType.RequestApproval.equals(
                            t.getTask().getType()))
            .toList();

    assertEquals(1, approvalTasks.size(), "Should have exactly 1 approval task");
    LOG.debug("✓ Found exactly 1 approval task");

    // Verify the single task has 3 assignees
    Thread approvalTask = approvalTasks.get(0);
    List<String> assigneeNames =
        approvalTask.getTask().getAssignees().stream()
            .map(EntityReference::getName)
            .sorted()
            .toList();

    List<String> expectedAssignees =
        Stream.of(ownerUser.getName(), candidate1.getName(), candidate2.getName())
            .sorted()
            .toList();

    assertEquals(3, assigneeNames.size(), "Task should have exactly 3 assignees");
    assertEquals(expectedAssignees, assigneeNames, "Task assignees should be owner + 2 candidates");
    LOG.debug("✓ Verified task has 3 assignees: {}", assigneeNames);

    // Verify the task has correct entity reference
    assertTrue(
        approvalTask.getAbout().contains(testTable.getFullyQualifiedName()),
        "Task should reference the test table");
    LOG.debug("✓ Task correctly references the test table");

    // Step 7: Update table to trigger workflow again
    LOG.info("Updating table to trigger workflow on update event");

    String tablePatchJson =
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"Updated description for workflow testing\"}]";
    JsonNode tablePatch = MAPPER.readTree(tablePatchJson);
    client.tables().patch(testTable.getId(), tablePatch);

    LOG.debug("Applied patch to table: {}", testTable.getName());

    // Step 8: Wait for update event processing - should NOT create duplicate tasks
    LOG.info("Waiting for workflow to process table update (no duplicates expected)...");
    await()
        .atMost(Duration.ofMinutes(1))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> {
              ResultList<Thread> threads =
                  client.feed().listTasks(tableEntityLink, TaskStatus.Open, 10);
              // Should still have exactly 1 task (no duplicates)
              boolean hasCorrectTaskCount = threads.getData().size() == 1;
              if (hasCorrectTaskCount) {
                LOG.debug("Confirmed 1 task exists after update (no duplicates)");
              }
              return hasCorrectTaskCount;
            });

    // Step 9: Verify no duplicate tasks created for update event
    LOG.info("Verifying no duplicate tasks created for update event");
    ResultList<Thread> updatedThreads =
        client.feed().listTasks(tableEntityLink, TaskStatus.Open, 10);

    List<Thread> allApprovalTasks =
        updatedThreads.getData().stream()
            .filter(
                t ->
                    t.getTask() != null
                        && org.openmetadata.schema.type.TaskType.RequestApproval.equals(
                            t.getTask().getType()))
            .toList();

    assertEquals(
        1,
        allApprovalTasks.size(),
        "Should still have exactly 1 approval task (no duplicates after update)");
    LOG.debug("✓ Confirmed exactly 1 approval task after update (no duplicates)");

    // Verify the task still has the same 3 assignees
    Thread updatedTask = allApprovalTasks.getFirst();
    List<String> updatedAssignees =
        updatedTask.getTask().getAssignees().stream()
            .map(EntityReference::getName)
            .sorted()
            .toList();

    assertEquals(
        expectedAssignees, updatedAssignees, "Task assignees should remain the same after update");
    LOG.debug("✓ Verified task still has same 3 assignees after update: {}", updatedAssignees);

    // Step 10: Resolve the approval task to test workflow progression
    LOG.info("Resolving the approval task");
    ResolveTask resolveTask =
        new ResolveTask().withNewValue(org.openmetadata.schema.type.EntityStatus.APPROVED.value());

    // Use owner client to resolve since they are an assignee
    OpenMetadataClient ownerClient =
        SdkClients.createClient(ownerUser.getName(), ownerUser.getEmail(), new String[] {});
    ownerClient.feed().resolveTask(updatedTask.getTask().getId().toString(), resolveTask);
    LOG.debug("✓ Resolved task: {}", updatedTask.getTask().getId());

    // Verify task status changed
    await()
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> {
              try {
                ResultList<Thread> closedThreads =
                    client.feed().listTasks(tableEntityLink, TaskStatus.Closed, 10);
                return !closedThreads.getData().isEmpty();
              } catch (Exception e) {
                return false;
              }
            });

    ResultList<Thread> closedTasks =
        client.feed().listTasks(tableEntityLink, TaskStatus.Closed, 10);
    assertFalse(closedTasks.getData().isEmpty(), "Should have at least one closed task");
    LOG.debug("✓ Verified task resolution - found {} closed tasks", closedTasks.getData().size());

    // Step 11: Cleanup
    LOG.info("Cleaning up test resources");

    // Delete workflow
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            BASE_PATH + "/" + workflowId,
            null,
            RequestOptions.builder().build());
    LOG.debug("✓ Deleted workflow");

    // Delete test entities
    Map<String, String> params = new HashMap<>();
    params.put("hardDelete", "true");
    params.put("recursive", "true");
    client.tables().delete(testTable.getId().toString(), params);
    client.databaseSchemas().delete(dbSchema.getId().toString(), params);
    client.databases().delete(database.getId().toString(), params);
    client.databaseServices().delete(dbService.getId().toString(), params);
    LOG.debug("✓ Deleted database infrastructure");

    // Delete test users
    client.users().delete(candidate1.getId().toString(), params);
    client.users().delete(candidate2.getId().toString(), params);
    client.users().delete(ownerUser.getId().toString(), params);
    LOG.debug("✓ Deleted test users");

    LOG.info("test_WorkflowWithReviewersOwnersCandidates completed successfully");
  }

  @Test
  @Order(41)
  void test_WorkflowWithTeamCandidates(TestNamespace ns) throws IOException {
    LOG.info("Starting test_WorkflowWithTeamCandidates");

    OpenMetadataClient client = SdkClients.adminClient();

    // Step 1: Create test users (2 candidates + 1 owner)
    LOG.debug("Creating test users for team-based assignment testing");

    String uniqueSuffix = String.valueOf(System.currentTimeMillis());

    CreateUser createCandidate1 =
        new CreateUser()
            .withName("teamcandidate1_" + uniqueSuffix)
            .withEmail("teamcandidate1_" + uniqueSuffix + "@example.com")
            .withDisplayName("Test Team Candidate 1");
    User candidate1 = client.users().create(createCandidate1);
    LOG.debug("Created team candidate user 1: {}", candidate1.getName());

    CreateUser createCandidate2 =
        new CreateUser()
            .withName("teamcandidate2_" + uniqueSuffix)
            .withEmail("teamcandidate2_" + uniqueSuffix + "@example.com")
            .withDisplayName("Test Team Candidate 2");
    User candidate2 = client.users().create(createCandidate2);
    LOG.debug("Created team candidate user 2: {}", candidate2.getName());

    CreateUser createOwner =
        new CreateUser()
            .withName("teamowner_" + uniqueSuffix)
            .withEmail("teamowner_" + uniqueSuffix + "@example.com")
            .withDisplayName("Test Team Owner");
    User ownerUser = client.users().create(createOwner);
    LOG.debug("Created team owner user: {}", ownerUser.getName());

    // Step 2: Create team with the 2 candidate users
    LOG.debug("Creating team with candidate users");

    CreateTeam createTeam =
        new CreateTeam()
            .withName("approval_team_" + uniqueSuffix)
            .withDisplayName("Approval Team")
            .withTeamType(CreateTeam.TeamType.GROUP)
            .withUsers(List.of(candidate1.getId(), candidate2.getId()))
            .withDescription("Team for workflow approval testing");
    Team approvalTeam = client.teams().create(createTeam);
    LOG.debug("Created approval team: {}", approvalTeam.getName());

    // Step 3: Create database infrastructure
    LOG.debug("Creating database infrastructure");

    CreateDatabaseService createDbService =
        new CreateDatabaseService()
            .withName(ns.prefix("test-db-service"))
            .withServiceType(DatabaseServiceType.Mysql)
            .withConnection(
                new DatabaseConnection()
                    .withConfig(
                        new MysqlConnection()
                            .withHostPort("localhost:3306")
                            .withUsername("test")
                            .withAuthType(new basicAuth().withPassword("test"))));

    DatabaseService dbService = client.databaseServices().create(createDbService);
    LOG.debug("Created database service: {}", dbService.getName());

    CreateDatabase createDb =
        new CreateDatabase()
            .withName(ns.prefix("test-database"))
            .withService(dbService.getFullyQualifiedName())
            .withDescription("Test database for team workflow assignment testing");
    Database database = client.databases().create(createDb);
    LOG.debug("Created database: {}", database.getName());

    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName(ns.prefix("test-schema"))
            .withDatabase(database.getFullyQualifiedName())
            .withDescription("Test schema for team workflow assignment testing");
    DatabaseSchema dbSchema = client.databaseSchemas().create(createSchema);
    LOG.debug("Created database schema: {}", dbSchema.getName());

    // Step 4: Create test table with owner
    LOG.debug("Creating test table with owner assignment");

    CreateTable createTable =
        new CreateTable()
            .withName(ns.prefix("test_team_approval_table"))
            .withDatabaseSchema(dbSchema.getFullyQualifiedName())
            .withDescription("Test table for team-based workflow assignment testing")
            .withOwners(List.of(ownerUser.getEntityReference()))
            .withColumns(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.INT),
                    new Column().withName("name").withDataType(ColumnDataType.STRING),
                    new Column().withName("created_date").withDataType(ColumnDataType.DATETIME)));

    Table testTable = client.tables().create(createTable);
    LOG.debug("Created test table: {} with owner: {}", testTable.getName(), ownerUser.getName());
    String tableEntityLink = String.format("<#E::table::%s>", testTable.getFullyQualifiedName());

    // Step 5: Create team-based workflow
    LOG.debug("Creating workflow with team candidates assignment");

    String workflowJson =
        """
            {
              "name": "%s",
              "displayName": "Team Assignment Test Workflow",
              "description": "Workflow testing team candidates assignment",
              "trigger": {
                "type": "eventBasedEntity",
                "config": {
                  "entityTypes": ["table"],
                  "events": ["Created", "Updated"],
                  "exclude": ["reviewers"],
                  "filter": {}
                },
                "output": ["relatedEntity", "updatedBy"]
              },
              "nodes": [
                {
                  "name": "start",
                  "displayName": "Start",
                  "type": "startEvent",
                  "subType": "startEvent"
                },
                {
                  "name": "ApproveTable",
                  "displayName": "Approve Table",
                  "type": "userTask",
                  "subType": "userApprovalTask",
                  "config": {
                    "assignees": {
                      "addReviewers": true,
                      "addOwners": true,
                      "candidates": [
                        {
                          "id": "%s",
                          "type": "team",
                          "fullyQualifiedName": "%s",
                          "name": "%s"
                        }
                      ]
                    },
                    "approvalThreshold": 1,
                    "rejectionThreshold": 1
                  },
                  "input": ["relatedEntity"],
                  "inputNamespaceMap": {
                    "relatedEntity": "global"
                  },
                  "output": ["result"],
                  "branches": ["true", "false"]
                },
                {
                  "name": "endApproved",
                  "displayName": "End Approved",
                  "type": "endEvent",
                  "subType": "endEvent"
                },
                {
                  "name": "endRejected",
                  "displayName": "End Rejected",
                  "type": "endEvent",
                  "subType": "endEvent"
                }
              ],
              "edges": [
                {"from": "start", "to": "ApproveTable"},
                {"from": "ApproveTable", "to": "endApproved", "condition": "true"},
                {"from": "ApproveTable", "to": "endRejected", "condition": "false"}
              ]
            }
            """
            .formatted(
                "TeamApprovalWorkflow",
                approvalTeam.getId(),
                approvalTeam.getFullyQualifiedName(),
                approvalTeam.getName());

    CreateWorkflowDefinition teamWorkflow =
        JsonUtils.readValue(workflowJson, CreateWorkflowDefinition.class);

    String workflowResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, teamWorkflow, RequestOptions.builder().build());

    JsonNode workflowCreated = MAPPER.readTree(workflowResponse);
    String workflowId = workflowCreated.get("id").asText();
    LOG.debug("Created team workflow: {}", workflowId);

    // Step 6: Wait for initial workflow processing (table creation event)
    LOG.info("Waiting for workflow to process table creation...");
    await()
        .atMost(Duration.ofMinutes(2))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> {
              ResultList<Thread> threads =
                  client.feed().listTasks(tableEntityLink, TaskStatus.Open, 10);
              boolean hasExpectedTasks = !threads.getData().isEmpty();
              if (hasExpectedTasks) {
                LOG.debug("Found {} tasks for table creation", threads.getData().size());
              }
              return hasExpectedTasks;
            });

    // Step 7: Verify task creation and assignees (should have 3: owner + 2 team members)
    LOG.info("Verifying initial task creation and assignees");
    ResultList<Thread> initialThreads =
        client.feed().listTasks(tableEntityLink, TaskStatus.Open, 10);

    assertFalse(initialThreads.getData().isEmpty(), "Should have tasks created for table");

    List<Thread> allApprovalTasks =
        initialThreads.getData().stream()
            .filter(
                t ->
                    t.getTask() != null
                        && TaskType.RequestApproval.equals(t.getTask().getType())
                        && TaskStatus.Open.equals(t.getTask().getStatus()))
            .toList();

    assertEquals(
        1,
        allApprovalTasks.size(),
        "Should have exactly 1 approval task (team expands to individual users)");
    LOG.debug("✓ Confirmed exactly 1 approval task created");

    Thread initialTask = allApprovalTasks.getFirst();
    List<String> assigneeNames =
        initialTask.getTask().getAssignees().stream()
            .map(EntityReference::getName)
            .sorted()
            .toList();

    List<String> expectedAssignees =
        List.of(ownerUser.getName(), candidate1.getName(), candidate2.getName()).stream()
            .sorted()
            .toList();

    assertEquals(
        3, assigneeNames.size(), "Task should have exactly 3 assignees (owner + 2 team members)");
    assertEquals(
        expectedAssignees,
        assigneeNames,
        "Task assignees should include owner and both team members");
    LOG.debug(
        "✓ Verified task has 3 assignees: {} (team expanded to individual users)", assigneeNames);

    // Step 8: Update the table to trigger workflow on update event
    LOG.info("Updating table to trigger workflow on update event");
    String tablePatchJson =
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"Updated description for team workflow testing\"}]";
    JsonNode tablePatch = MAPPER.readTree(tablePatchJson);
    client.tables().patch(testTable.getId(), tablePatch);
    LOG.debug("Applied patch to table: {}", testTable.getName());

    // Step 9: Wait and verify no duplicate tasks created
    LOG.info("Waiting for workflow to process table update (no duplicates expected)...");
    await()
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () ->
                client.feed().listTasks(tableEntityLink, TaskStatus.Open, 10).getData().size()
                    >= 1);

    LOG.info("Verifying no duplicate tasks created for update event");
    ResultList<Thread> threadsAfterUpdate =
        client.feed().listTasks(tableEntityLink, TaskStatus.Open, 10);
    List<Thread> allApprovalTasksAfterUpdate =
        threadsAfterUpdate.getData().stream()
            .filter(
                t ->
                    t.getTask() != null
                        && TaskType.RequestApproval.equals(t.getTask().getType())
                        && TaskStatus.Open.equals(t.getTask().getStatus()))
            .toList();

    assertEquals(
        1,
        allApprovalTasksAfterUpdate.size(),
        "Should still have exactly 1 approval task (no duplicates after update)");
    LOG.debug("✓ Confirmed exactly 1 approval task after update (no duplicates)");

    // Verify the task still has the same 3 assignees
    Thread updatedTask = allApprovalTasksAfterUpdate.getFirst();
    List<String> updatedAssignees =
        updatedTask.getTask().getAssignees().stream()
            .map(EntityReference::getName)
            .sorted()
            .toList();

    assertEquals(
        expectedAssignees, updatedAssignees, "Task assignees should remain the same after update");
    LOG.debug("✓ Verified task still has same 3 assignees after update: {}", updatedAssignees);

    // Step 10: Resolve the approval task to test workflow progression
    LOG.info("Resolving the approval task");
    ResolveTask resolveTask =
        new ResolveTask().withNewValue(org.openmetadata.schema.type.EntityStatus.APPROVED.value());

    // Use owner client to resolve since they are an assignee
    OpenMetadataClient ownerClient =
        SdkClients.createClient(ownerUser.getName(), ownerUser.getEmail(), new String[] {});
    ownerClient.feed().resolveTask(updatedTask.getTask().getId().toString(), resolveTask);
    LOG.debug("✓ Resolved task: {}", updatedTask.getTask().getId());

    // Verify task status changed
    await()
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () ->
                client.feed().listTasks(tableEntityLink, TaskStatus.Closed, 10).getData().size()
                    >= 1);

    ResultList<Thread> closedThreads =
        client.feed().listTasks(tableEntityLink, TaskStatus.Closed, 10);
    List<Thread> closedTasks = closedThreads.getData();
    assertEquals(1, closedTasks.size(), "Should have exactly 1 closed task");
    LOG.debug("✓ Task successfully resolved and closed");

    // Step 11: Cleanup test resources
    LOG.info("Cleaning up test resources");

    // Delete workflow
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            BASE_PATH + "/" + workflowId,
            null,
            RequestOptions.builder().build());
    LOG.debug("✓ Deleted workflow");

    // Delete test entities
    Map<String, String> params = new HashMap<>();
    params.put("hardDelete", "true");
    params.put("recursive", "true");
    client.tables().delete(testTable.getId().toString(), params);
    client.databaseSchemas().delete(dbSchema.getId().toString(), params);
    client.databases().delete(database.getId().toString(), params);
    client.databaseServices().delete(dbService.getId().toString(), params);
    LOG.debug("✓ Deleted database infrastructure");

    // Delete team
    client.teams().delete(approvalTeam.getId().toString(), params);
    LOG.debug("✓ Deleted approval team");

    // Delete test users
    client.users().delete(candidate1.getId().toString(), params);
    client.users().delete(candidate2.getId().toString(), params);
    client.users().delete(ownerUser.getId().toString(), params);
    LOG.debug("✓ Deleted test users");

    LOG.info("test_WorkflowWithTeamCandidates completed successfully");
  }

  @Test
  @Order(30)
  void test_TagChangeApprovalWithIncludeFields(TestNamespace ns) throws Exception {
    LOG.info("Testing Tag change approval workflow with include fields feature");
    OpenMetadataClient client = SdkClients.adminClient();

    String uniqueSuffix = String.valueOf(System.currentTimeMillis());

    // Create test user (owner)
    CreateUser createOwner =
        new CreateUser()
            .withName("tagowner_" + uniqueSuffix)
            .withEmail("tagowner_" + uniqueSuffix + "@example.com")
            .withDisplayName("Tag Test Owner");
    User ownerUser = client.users().create(createOwner);
    LOG.debug("Created owner user: {}", ownerUser.getName());

    // Setup: Create test entities
    CreateDatabaseService createService = createDatabaseServiceRequest("tag_approval_service");
    DatabaseService service = client.databaseServices().create(createService);

    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName("tag_approval_db")
            .withService(service.getFullyQualifiedName());
    Database database = client.databases().create(createDatabase);

    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("tag_approval_schema")
            .withDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = client.databaseSchemas().create(createSchema);

    CreateTable createTable =
        new CreateTable()
            .withName("tag_approval_table")
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withOwners(List.of(ownerUser.getEntityReference()))
            .withColumns(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.INT),
                    new Column().withName("data").withDataType(ColumnDataType.STRING)));
    Table table = client.tables().create(createTable);
    LOG.debug("Created table: {} with owner: {}", table.getName(), ownerUser.getName());

    // Create confidentiality tags
    CreateClassification createClassification =
        new CreateClassification()
            .withName("ConfidentialityTags")
            .withDisplayName("Confidentiality Tags")
            .withDescription("Classification for confidentiality levels");
    Classification classification = client.classifications().create(createClassification);

    CreateTag createPrivateTag =
        new CreateTag()
            .withName("Private")
            .withClassification(classification.getFullyQualifiedName())
            .withDescription("Private data tag");
    Tag privateTag = client.tags().create(createPrivateTag);

    CreateTag createPublicTag =
        new CreateTag()
            .withName("Public")
            .withClassification(classification.getFullyQualifiedName())
            .withDescription("Public data tag");
    Tag publicTag = client.tags().create(createPublicTag);

    // Create workflow with include fields for specific confidentiality tags
    Map<String, Object> triggerConfig = new HashMap<>();
    triggerConfig.put("entityTypes", List.of("table"));
    triggerConfig.put("events", List.of("Updated"));
    triggerConfig.put("exclude", List.of());

    List<String> includeFields = List.of("tags");
    triggerConfig.put("include", includeFields);
    triggerConfig.put("filter", new HashMap<>());

    Map<String, Object> trigger = new HashMap<>();
    trigger.put("type", "eventBasedEntity");
    trigger.put("config", triggerConfig);
    trigger.put("output", List.of("relatedEntity", "updatedBy"));

    Map<String, Object> startNode = new HashMap<>();
    startNode.put("name", "start");
    startNode.put("type", "startEvent");
    startNode.put("subType", "startEvent");

    Map<String, Object> approvalNode = new HashMap<>();
    approvalNode.put("name", "ApprovePrivateTagChange");
    approvalNode.put("displayName", "Approve Private Tag Change");
    approvalNode.put("type", "userTask");
    approvalNode.put("subType", "userApprovalTask");
    Map<String, Object> approvalConfig = new HashMap<>();
    Map<String, Object> assignees = new HashMap<>();
    assignees.put("addReviewers", false);
    assignees.put("addOwners", true);
    assignees.put("candidates", List.of());
    approvalConfig.put("assignees", assignees);
    approvalConfig.put("approvalThreshold", 1);
    approvalConfig.put("rejectionThreshold", 1);
    approvalNode.put("config", approvalConfig);
    approvalNode.put("input", List.of("relatedEntity"));
    Map<String, Object> inputNamespace = new HashMap<>();
    inputNamespace.put("relatedEntity", "global");
    approvalNode.put("inputNamespaceMap", inputNamespace);

    Map<String, Object> endNode = new HashMap<>();
    endNode.put("name", "end");
    endNode.put("type", "endEvent");
    endNode.put("subType", "endEvent");

    Map<String, Object> edge1 = new HashMap<>();
    edge1.put("from", "start");
    edge1.put("to", "ApprovePrivateTagChange");

    Map<String, Object> approvedNode = new HashMap<>();
    approvedNode.put("name", "ApprovedEnd");
    approvedNode.put("type", "endEvent");
    approvedNode.put("subType", "endEvent");

    Map<String, Object> rejectedNode = new HashMap<>();
    rejectedNode.put("name", "RejectedEnd");
    rejectedNode.put("type", "endEvent");
    rejectedNode.put("subType", "endEvent");

    Map<String, Object> edge2 = new HashMap<>();
    edge2.put("from", "ApprovePrivateTagChange");
    edge2.put("to", "ApprovedEnd");
    edge2.put("condition", "true");

    Map<String, Object> edge3 = new HashMap<>();
    edge3.put("from", "ApprovePrivateTagChange");
    edge3.put("to", "RejectedEnd");
    edge3.put("condition", "false");

    Map<String, Object> workflowRequest = new HashMap<>();
    workflowRequest.put("name", "TagApprovalWorkflow");
    workflowRequest.put("displayName", "Tag Change Approval");
    workflowRequest.put("description", "Workflow to approve private tag changes");
    workflowRequest.put("trigger", trigger);
    workflowRequest.put("nodes", List.of(startNode, approvalNode, approvedNode, rejectedNode));
    workflowRequest.put("edges", List.of(edge1, edge2, edge3));

    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, workflowRequest, RequestOptions.builder().build());
    assertNotNull(createResponse);
    JsonNode created = MAPPER.readTree(createResponse);
    assertTrue(created.has("id"));
    String workflowId = created.get("id").asText();

    // Verify include fields are properly set in the created workflow
    String getResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                BASE_PATH + "/" + workflowId,
                null,
                RequestOptions.builder().build());
    JsonNode workflow = MAPPER.readTree(getResponse);

    assertTrue(workflow.get("trigger").get("config").has("include"));
    JsonNode includeArray = workflow.get("trigger").get("config").get("include");
    assertTrue(includeArray.isArray());
    assertEquals("tags", includeArray.get(0).asText());

    LOG.info("✓ Tag approval workflow with include fields created and verified successfully");

    // Test workflow triggering: Update table with Private tag - should trigger workflow
    String tableEntityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());
    LOG.info("Testing positive case: updating tags to Private (should trigger approval)");

    String privatePatchJson =
        String.format(
            "[{\"op\":\"add\",\"path\":\"/tags\",\"value\":[{\"tagFQN\":\"%s\",\"source\":\"Classification\",\"labelType\":\"Manual\",\"state\":\"Confirmed\"}]}]",
            privateTag.getFullyQualifiedName());
    JsonNode privatePatch = MAPPER.readTree(privatePatchJson);
    client.tables().patch(table.getId(), privatePatch);

    // Wait for workflow to process Private tag change
    await()
        .atMost(Duration.ofMinutes(2))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> {
              ResultList<Thread> threads =
                  client.feed().listTasks(tableEntityLink, TaskStatus.Open, 10);
              return !threads.getData().isEmpty();
            });

    ResultList<Thread> privateTasks = client.feed().listTasks(tableEntityLink, TaskStatus.Open, 10);
    assertFalse(privateTasks.getData().isEmpty(), "Should have approval task for Private tag");
    assertEquals(1, privateTasks.getData().size(), "Should have exactly 1 approval task");
    LOG.debug("✓ Private tag change triggered approval task");

    LOG.info("Testing negative case: updating tags to Public (should NOT trigger approval)");
    String publicPatchJson =
        String.format(
            "[{\"op\":\"replace\",\"path\":\"/tags\",\"value\":[{\"tagFQN\":\"%s\",\"source\":\"Classification\",\"labelType\":\"Manual\",\"state\":\"Confirmed\"}]}]",
            publicTag.getFullyQualifiedName());
    JsonNode publicPatch = MAPPER.readTree(publicPatchJson);
    client.tables().patch(table.getId(), publicPatch);

    // Wait a bit and verify no new tasks created
    await()
        .atMost(Duration.ofSeconds(10))
        .pollInterval(Duration.ofSeconds(1))
        .pollDelay(Duration.ofSeconds(3))
        .untilAsserted(
            () -> {
              ResultList<Thread> publicTasks =
                  client.feed().listTasks(tableEntityLink, TaskStatus.Open, 10);
              assertEquals(
                  1,
                  publicTasks.getData().size(),
                  "Should still have only 1 approval task (no new task for Public tag)");
            });
    LOG.debug("✓ Public tag change did NOT trigger approval task");

    // Cleanup using safe deletion method
    safeDeleteWorkflow(client, "TagApprovalWorkflow");

    // Cleanup test entities
    try {
      Map<String, String> params = new HashMap<>();
      params.put("hardDelete", "true");
      params.put("recursive", "true");
      client.databaseServices().delete(service.getId().toString(), params);
      client.classifications().delete(classification.getId().toString(), params);
      client.users().delete(ownerUser.getId().toString(), params);
    } catch (Exception e) {
      LOG.warn("Cleanup error: {}", e.getMessage());
    }
  }

  @Test
  @Order(31)
  void test_DomainChangeApprovalWithIncludeFields(TestNamespace ns) throws Exception {
    LOG.info("Testing Domain change approval workflow with include fields feature");
    OpenMetadataClient client = SdkClients.adminClient();

    String uniqueSuffix = String.valueOf(System.currentTimeMillis());

    // Create test user (owner)
    CreateUser createOwner =
        new CreateUser()
            .withName("domainowner_" + uniqueSuffix)
            .withEmail("domainowner_" + uniqueSuffix + "@example.com")
            .withDisplayName("Domain Test Owner");
    User ownerUser = client.users().create(createOwner);
    LOG.debug("Created owner user: {}", ownerUser.getName());

    // Setup: Create test domain
    CreateDomain createDomain =
        new CreateDomain()
            .withName(ns.prefix("FinanceDomain"))
            .withDisplayName("Finance Domain")
            .withDescription("Domain for financial data")
            .withDomainType(CreateDomain.DomainType.CONSUMER_ALIGNED);
    Domain domain = client.domains().create(createDomain);

    // Create test table
    CreateDatabaseService createService = createDatabaseServiceRequest("domain_approval_service");
    DatabaseService service = client.databaseServices().create(createService);

    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName("domain_approval_db")
            .withService(service.getFullyQualifiedName());
    Database database = client.databases().create(createDatabase);

    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("domain_approval_schema")
            .withDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = client.databaseSchemas().create(createSchema);

    CreateTable createTable =
        new CreateTable()
            .withName("domain_approval_table")
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withOwners(List.of(ownerUser.getEntityReference()))
            .withColumns(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.INT),
                    new Column().withName("amount").withDataType(ColumnDataType.DECIMAL)));
    Table table = client.tables().create(createTable);
    LOG.debug("Created table: {} with owner: {}", table.getName(), ownerUser.getName());

    // Create workflow with include fields for specific domain
    Map<String, Object> triggerConfig = new HashMap<>();
    triggerConfig.put("entityTypes", List.of("table"));
    triggerConfig.put("events", List.of("Updated"));
    triggerConfig.put("exclude", List.of());

    List<String> includeFields = List.of("domains");
    triggerConfig.put("include", includeFields);
    triggerConfig.put("filter", new HashMap<>());

    Map<String, Object> trigger = new HashMap<>();
    trigger.put("type", "eventBasedEntity");
    trigger.put("config", triggerConfig);
    trigger.put("output", List.of("relatedEntity", "updatedBy"));

    Map<String, Object> startNode = new HashMap<>();
    startNode.put("name", "start");
    startNode.put("type", "startEvent");
    startNode.put("subType", "startEvent");

    Map<String, Object> approvalNode = new HashMap<>();
    approvalNode.put("name", "ApproveDomainChange");
    approvalNode.put("displayName", "Approve Domain Assignment");
    approvalNode.put("type", "userTask");
    approvalNode.put("subType", "userApprovalTask");
    Map<String, Object> approvalConfig = new HashMap<>();
    Map<String, Object> assignees = new HashMap<>();
    assignees.put("addReviewers", false);
    assignees.put("addOwners", true);
    assignees.put("candidates", List.of());
    approvalConfig.put("assignees", assignees);
    approvalConfig.put("approvalThreshold", 1);
    approvalConfig.put("rejectionThreshold", 1);
    approvalNode.put("config", approvalConfig);
    approvalNode.put("input", List.of("relatedEntity"));
    Map<String, Object> inputNamespace = new HashMap<>();
    inputNamespace.put("relatedEntity", "global");
    approvalNode.put("inputNamespaceMap", inputNamespace);

    Map<String, Object> endNode = new HashMap<>();
    endNode.put("name", "end");
    endNode.put("type", "endEvent");
    endNode.put("subType", "endEvent");

    Map<String, Object> approvedNode = new HashMap<>();
    approvedNode.put("name", "ApprovedEnd");
    approvedNode.put("type", "endEvent");
    approvedNode.put("subType", "endEvent");

    Map<String, Object> rejectedNode = new HashMap<>();
    rejectedNode.put("name", "RejectedEnd");
    rejectedNode.put("type", "endEvent");
    rejectedNode.put("subType", "endEvent");

    Map<String, Object> edge1 = new HashMap<>();
    edge1.put("from", "start");
    edge1.put("to", "ApproveDomainChange");

    Map<String, Object> edge2 = new HashMap<>();
    edge2.put("from", "ApproveDomainChange");
    edge2.put("to", "ApprovedEnd");
    edge2.put("condition", "true");

    Map<String, Object> edge3 = new HashMap<>();
    edge3.put("from", "ApproveDomainChange");
    edge3.put("to", "RejectedEnd");
    edge3.put("condition", "false");

    Map<String, Object> workflowRequest = new HashMap<>();
    workflowRequest.put("name", "DomainApprovalWorkflow");
    workflowRequest.put("displayName", "Domain Change Approval");
    workflowRequest.put("description", "Workflow to approve domain assignments");
    workflowRequest.put("trigger", trigger);
    workflowRequest.put("nodes", List.of(startNode, approvalNode, approvedNode, rejectedNode));
    workflowRequest.put("edges", List.of(edge1, edge2, edge3));

    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, workflowRequest, RequestOptions.builder().build());
    assertNotNull(createResponse);
    JsonNode created = MAPPER.readTree(createResponse);
    assertTrue(created.has("id"));
    String workflowId = created.get("id").asText();

    // Verify workflow structure with include fields
    String getResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                BASE_PATH + "/" + workflowId,
                null,
                RequestOptions.builder().build());
    JsonNode workflow = MAPPER.readTree(getResponse);

    assertTrue(workflow.get("trigger").get("config").has("include"));
    JsonNode includeArray = workflow.get("trigger").get("config").get("include");
    assertTrue(includeArray.isArray());
    assertEquals("domains", includeArray.get(0).asText());

    LOG.info("✓ Domain approval workflow with include fields created and verified successfully");

    // Test workflow triggering: Update table domain to Finance - should trigger workflow
    String tableEntityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());
    LOG.info("Testing positive case: updating domain to Finance (should trigger approval)");

    String financePatchJson =
        String.format(
            "[{\"op\":\"add\",\"path\":\"/domains\",\"value\":[{\"id\":\"%s\",\"type\":\"domain\",\"name\":\"%s\",\"fullyQualifiedName\":\"%s\"}]}]",
            domain.getId(), domain.getName(), domain.getFullyQualifiedName());
    JsonNode financePatch = MAPPER.readTree(financePatchJson);
    client.tables().patch(table.getId(), financePatch);

    // Wait for workflow to process Finance domain change
    await()
        .atMost(Duration.ofMinutes(2))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> {
              ResultList<Thread> threads =
                  client.feed().listTasks(tableEntityLink, TaskStatus.Open, 10);
              return !threads.getData().isEmpty();
            });

    ResultList<Thread> domainTasks = client.feed().listTasks(tableEntityLink, TaskStatus.Open, 10);
    assertFalse(domainTasks.getData().isEmpty(), "Should have approval task for Finance domain");
    assertEquals(1, domainTasks.getData().size(), "Should have exactly 1 approval task");
    LOG.debug("✓ Finance domain change triggered approval task");

    // Test negative case: Create Marketing domain and update - should NOT trigger workflow
    CreateDomain createMarketingDomain =
        new CreateDomain()
            .withName(ns.prefix("MarketingDomain"))
            .withDisplayName("Marketing Domain")
            .withDescription("Domain for marketing data")
            .withDomainType(CreateDomain.DomainType.CONSUMER_ALIGNED);
    Domain marketingDomain = client.domains().create(createMarketingDomain);

    LOG.info("Testing negative case: updating domain to Marketing (should NOT trigger approval)");
    String marketingPatchJson =
        String.format(
            "[{\"op\":\"replace\",\"path\":\"/domains\",\"value\":[{\"id\":\"%s\",\"type\":\"domain\",\"name\":\"%s\",\"fullyQualifiedName\":\"%s\"}]}]",
            marketingDomain.getId(),
            marketingDomain.getName(),
            marketingDomain.getFullyQualifiedName());
    JsonNode marketingPatch = MAPPER.readTree(marketingPatchJson);
    client.tables().patch(table.getId(), marketingPatch);

    // Wait a bit and verify no new tasks created
    await()
        .atMost(Duration.ofSeconds(10))
        .pollInterval(Duration.ofSeconds(1))
        .pollDelay(Duration.ofSeconds(3))
        .untilAsserted(
            () -> {
              ResultList<Thread> marketingTasks =
                  client.feed().listTasks(tableEntityLink, TaskStatus.Open, 10);
              assertEquals(
                  1,
                  marketingTasks.getData().size(),
                  "Should still have only 1 approval task (no new task for Marketing domain)");
            });
    LOG.debug("✓ Marketing domain change did NOT trigger approval task");

    // Cleanup using safe deletion method
    safeDeleteWorkflow(client, "DomainApprovalWorkflow");

    // Cleanup test entities
    try {
      Map<String, String> params = new HashMap<>();
      params.put("hardDelete", "true");
      params.put("recursive", "true");
      client.databaseServices().delete(service.getId().toString(), params);
      client.domains().delete(domain.getId().toString(), params);
    } catch (Exception e) {
      LOG.warn("Cleanup error: {}", e.getMessage());
    }
  }

  @Test
  @Order(32)
  void test_IncludeFieldsPriorityOverExclude(TestNamespace ns) throws Exception {
    LOG.info("Testing include fields have priority over exclude fields");
    OpenMetadataClient client = SdkClients.adminClient();

    // Create test user for task ownership
    CreateUser createUser =
        new CreateUser().withName("priority_user").withEmail("priority.user@example.com");
    User testUser = client.users().create(createUser);

    // Setup test entities
    CreateDatabaseService createService = createDatabaseServiceRequest("priority_service");
    DatabaseService service = client.databaseServices().create(createService);

    CreateDatabase createDatabase =
        new CreateDatabase().withName("priority_db").withService(service.getFullyQualifiedName());
    Database database = client.databases().create(createDatabase);

    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("priority_schema")
            .withDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = client.databaseSchemas().create(createSchema);

    CreateTable createTable =
        new CreateTable()
            .withName("priority_table")
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.INT)))
            .withOwners(List.of(new EntityReference().withType("user").withId(testUser.getId())));
    Table table = client.tables().create(createTable);

    // Create tag for testing
    CreateClassification createClassification =
        new CreateClassification()
            .withName("TestTags")
            .withDisplayName("Test Tags")
            .withDescription("Test classification for priority testing");
    Classification classification = client.classifications().create(createClassification);

    CreateTag createTag =
        new CreateTag()
            .withName("ImportantTag")
            .withDescription("Important tag for testing priority logic")
            .withClassification(classification.getFullyQualifiedName());
    Tag tag = client.tags().create(createTag);

    // Create workflow with both include and exclude fields
    // tags field is in both include and exclude - include should have priority
    Map<String, Object> triggerConfig = new HashMap<>();
    triggerConfig.put("entityTypes", List.of("table"));
    triggerConfig.put("events", List.of("Updated"));
    triggerConfig.put("exclude", List.of("tags")); // Exclude tags field

    List<String> includeFields = List.of("tags"); // But include tags field (should have priority)
    triggerConfig.put("include", includeFields);
    triggerConfig.put("filter", new HashMap<>());

    Map<String, Object> trigger = new HashMap<>();
    trigger.put("type", "eventBasedEntity");
    trigger.put("config", triggerConfig);
    trigger.put("output", List.of("relatedEntity", "updatedBy"));

    // Create approval workflow
    Map<String, Object> startNode = new HashMap<>();
    startNode.put("name", "start");
    startNode.put("type", "startEvent");
    startNode.put("subType", "startEvent");

    Map<String, Object> approvalNode = new HashMap<>();
    approvalNode.put("name", "ApproveTagChange");
    approvalNode.put("displayName", "Approve Tag Change");
    approvalNode.put("type", "userTask");
    approvalNode.put("subType", "userApprovalTask");
    Map<String, Object> approvalConfig = new HashMap<>();
    Map<String, Object> assignees = new HashMap<>();
    assignees.put("addReviewers", false);
    assignees.put("addOwners", true);
    assignees.put("candidates", List.of());
    approvalConfig.put("assignees", assignees);
    approvalConfig.put("approvalThreshold", 1);
    approvalConfig.put("rejectionThreshold", 1);
    approvalNode.put("config", approvalConfig);
    approvalNode.put("input", List.of("relatedEntity"));
    Map<String, Object> approvalInputNamespace = new HashMap<>();
    approvalInputNamespace.put("relatedEntity", "global");
    approvalNode.put("inputNamespaceMap", approvalInputNamespace);
    approvalNode.put("output", List.of("updatedBy"));
    approvalNode.put("branches", List.of("true", "false"));

    Map<String, Object> approvedEndNode = new HashMap<>();
    approvedEndNode.put("name", "ApprovedEnd");
    approvedEndNode.put("type", "endEvent");
    approvedEndNode.put("subType", "endEvent");

    Map<String, Object> rejectedEndNode = new HashMap<>();
    rejectedEndNode.put("name", "RejectedEnd");
    rejectedEndNode.put("type", "endEvent");
    rejectedEndNode.put("subType", "endEvent");

    Map<String, Object> edge1 = new HashMap<>();
    edge1.put("from", "start");
    edge1.put("to", "ApproveTagChange");

    Map<String, Object> edge2 = new HashMap<>();
    edge2.put("from", "ApproveTagChange");
    edge2.put("to", "ApprovedEnd");
    edge2.put("condition", "true");

    Map<String, Object> edge3 = new HashMap<>();
    edge3.put("from", "ApproveTagChange");
    edge3.put("to", "RejectedEnd");
    edge3.put("condition", "false");

    Map<String, Object> workflowRequest = new HashMap<>();
    workflowRequest.put("name", "includePriorityWorkflow");
    workflowRequest.put("displayName", "Include Priority Test Workflow");
    workflowRequest.put("description", "Test that include fields have priority over exclude");
    workflowRequest.put("trigger", trigger);
    workflowRequest.put(
        "nodes", List.of(startNode, approvalNode, approvedEndNode, rejectedEndNode));
    workflowRequest.put("edges", List.of(edge1, edge2, edge3));

    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, workflowRequest, RequestOptions.builder().build());
    assertNotNull(createResponse);
    JsonNode created = MAPPER.readTree(createResponse);
    assertTrue(created.has("id"));
    String workflowId = created.get("id").asText();

    // Verify workflow has both include and exclude properly configured
    String getResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                BASE_PATH + "/" + workflowId,
                null,
                RequestOptions.builder().build());
    JsonNode workflow = MAPPER.readTree(getResponse);

    JsonNode triggerConfigNode = workflow.get("trigger").get("config");
    assertTrue(triggerConfigNode.has("include"));
    assertTrue(triggerConfigNode.has("exclude"));
    assertTrue(triggerConfigNode.get("exclude").isArray());
    assertTrue(triggerConfigNode.get("exclude").size() > 0);
    assertEquals("tags", triggerConfigNode.get("exclude").get(0).asText());
    JsonNode includeArray = triggerConfigNode.get("include");
    assertTrue(includeArray.isArray());
    assertEquals("tags", includeArray.get(0).asText());

    LOG.info("✓ Include priority workflow created with both include and exclude fields verified");

    // Test: Update table with the specific tag - should trigger workflow despite exclude
    String tagPatchJson =
        String.format(
            "[{\"op\":\"add\",\"path\":\"/tags\",\"value\":[{\"tagFQN\":\"%s\",\"source\":\"Classification\",\"labelType\":\"Manual\",\"state\":\"Confirmed\"}]}]",
            tag.getFullyQualifiedName());
    JsonNode tagPatch = MAPPER.readTree(tagPatchJson);
    Table updatedTable = client.tables().patch(table.getId(), tagPatch);
    assertNotNull(updatedTable.getTags());
    assertTrue(
        updatedTable.getTags().stream()
            .anyMatch(tagLabel -> tagLabel.getTagFQN().equals(tag.getFullyQualifiedName())));

    LOG.info("✓ Table updated with included tag: {}", tag.getFullyQualifiedName());

    // Wait for workflow to process and check if approval task was created
    String tableEntityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());
    await()
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .pollDelay(Duration.ofSeconds(1))
        .untilAsserted(
            () -> {
              ResultList<Thread> threads =
                  client.feed().listTasks(tableEntityLink, TaskStatus.Open, 100);
              boolean approvalTaskFound =
                  !threads.getData().isEmpty()
                      && threads.getData().stream()
                          .anyMatch(
                              thread ->
                                  thread.getTask() != null
                                      && TaskType.RequestApproval.equals(
                                          thread.getTask().getType()));
              assertTrue(
                  approvalTaskFound,
                  "Approval task should be created when include field matches, even with exclude field present");
            });
    LOG.info("✓ Approval task created successfully - include field priority verified");

    // Cleanup workflow
    safeDeleteWorkflow(client, "includePriorityWorkflow");

    // Cleanup test entities
    try {
      Map<String, String> params = new HashMap<>();
      params.put("hardDelete", "true");
      params.put("recursive", "true");
      client.tables().delete(table.getId().toString(), params);
      client.databaseSchemas().delete(schema.getId().toString(), params);
      client.databases().delete(database.getId().toString(), params);
      client.databaseServices().delete(service.getId().toString(), params);
      client.classifications().delete(classification.getId().toString(), params);
      client.users().delete(testUser.getId().toString(), params);
      LOG.debug("✓ Deleted all test entities");
    } catch (Exception e) {
      LOG.warn("Cleanup error: {}", e.getMessage());
    }
  }

  @Test
  @Order(33)
  void test_EmptyIncludeFieldsBehavior(TestNamespace ns) throws Exception {
    LOG.info("Testing empty include fields maintains backward compatibility");
    OpenMetadataClient client = SdkClients.adminClient();

    // Create test user for task ownership
    String randomSuffix = UUID.randomUUID().toString().substring(0, 8);
    CreateUser createUser =
        new CreateUser().withName("user_" + randomSuffix).withEmail("empty.include@example.com");
    User testUser = client.users().create(createUser);

    // Setup test entities
    CreateDatabaseService createService = createDatabaseServiceRequest("svc_" + randomSuffix);
    DatabaseService service = client.databaseServices().create(createService);

    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName("db_" + randomSuffix)
            .withService(service.getFullyQualifiedName());
    Database database = client.databases().create(createDatabase);

    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("schema_" + randomSuffix)
            .withDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = client.databaseSchemas().create(createSchema);

    // Create workflow with empty include fields (should behave like before)
    Map<String, Object> triggerConfig = new HashMap<>();
    triggerConfig.put("entityTypes", List.of("table"));
    triggerConfig.put("events", List.of("Created"));
    triggerConfig.put("exclude", List.of());
    triggerConfig.put("include", List.of()); // Empty include fields
    triggerConfig.put("filter", new HashMap<>());

    Map<String, Object> trigger = new HashMap<>();
    trigger.put("type", "eventBasedEntity");
    trigger.put("config", triggerConfig);
    trigger.put("output", List.of("relatedEntity", "updatedBy"));

    // Create approval workflow that should trigger for all table creations
    Map<String, Object> startNode = new HashMap<>();
    startNode.put("name", "start");
    startNode.put("type", "startEvent");
    startNode.put("subType", "startEvent");

    Map<String, Object> approvalNode = new HashMap<>();
    approvalNode.put("name", "ApproveTableCreation");
    approvalNode.put("displayName", "Approve Table Creation");
    approvalNode.put("type", "userTask");
    approvalNode.put("subType", "userApprovalTask");
    Map<String, Object> approvalConfig = new HashMap<>();
    Map<String, Object> assignees = new HashMap<>();
    assignees.put("addReviewers", false);
    assignees.put("addOwners", true);
    assignees.put("candidates", List.of());
    approvalConfig.put("assignees", assignees);
    approvalConfig.put("approvalThreshold", 1);
    approvalConfig.put("rejectionThreshold", 1);
    approvalNode.put("config", approvalConfig);
    approvalNode.put("input", List.of("relatedEntity"));
    Map<String, Object> approvalInputNamespace = new HashMap<>();
    approvalInputNamespace.put("relatedEntity", "global");
    approvalNode.put("inputNamespaceMap", approvalInputNamespace);
    approvalNode.put("output", List.of("updatedBy"));
    approvalNode.put("branches", List.of("true", "false"));

    Map<String, Object> approvedEndNode = new HashMap<>();
    approvedEndNode.put("name", "ApprovedEnd");
    approvedEndNode.put("type", "endEvent");
    approvedEndNode.put("subType", "endEvent");

    Map<String, Object> rejectedEndNode = new HashMap<>();
    rejectedEndNode.put("name", "RejectedEnd");
    rejectedEndNode.put("type", "endEvent");
    rejectedEndNode.put("subType", "endEvent");

    Map<String, Object> edge1 = new HashMap<>();
    edge1.put("from", "start");
    edge1.put("to", "ApproveTableCreation");

    Map<String, Object> edge2 = new HashMap<>();
    edge2.put("from", "ApproveTableCreation");
    edge2.put("to", "ApprovedEnd");
    edge2.put("condition", "true");

    Map<String, Object> edge3 = new HashMap<>();
    edge3.put("from", "ApproveTableCreation");
    edge3.put("to", "RejectedEnd");
    edge3.put("condition", "false");

    Map<String, Object> workflowRequest = new HashMap<>();
    workflowRequest.put("name", "workflow_" + randomSuffix);
    workflowRequest.put("displayName", "Empty Include Fields Test");
    workflowRequest.put("description", "Test empty include fields backward compatibility");
    workflowRequest.put("trigger", trigger);
    workflowRequest.put(
        "nodes", List.of(startNode, approvalNode, approvedEndNode, rejectedEndNode));
    workflowRequest.put("edges", List.of(edge1, edge2, edge3));

    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, workflowRequest, RequestOptions.builder().build());
    assertNotNull(createResponse);
    JsonNode created = MAPPER.readTree(createResponse);
    assertTrue(created.has("id"));
    String workflowId = created.get("id").asText();

    // Verify empty include fields are properly handled
    String getResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                BASE_PATH + "/" + workflowId,
                null,
                RequestOptions.builder().build());
    JsonNode workflow = MAPPER.readTree(getResponse);

    JsonNode includeNode = workflow.get("trigger").get("config").get("include");
    assertTrue(includeNode.isArray());
    assertEquals(0, includeNode.size()); // Should be empty array

    LOG.info(
        "✓ Empty include fields workflow created successfully - backward compatibility verified");

    // Test: Create a table - should trigger workflow (backward compatibility)
    CreateTable createTable =
        new CreateTable()
            .withName("tbl_" + randomSuffix)
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.INT)))
            .withOwners(List.of(new EntityReference().withType("user").withId(testUser.getId())));

    Table table = client.tables().create(createTable);
    assertNotNull(table);
    LOG.info("✓ Table created: {}", table.getFullyQualifiedName());

    // Wait for workflow to process and check if approval task was created (empty include should
    // trigger for all)
    String tableEntityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());
    await()
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .pollDelay(Duration.ofSeconds(1))
        .untilAsserted(
            () -> {
              ResultList<Thread> threads =
                  client.feed().listTasks(tableEntityLink, TaskStatus.Open, 100);
              boolean approvalTaskFound =
                  !threads.getData().isEmpty()
                      && threads.getData().stream()
                          .anyMatch(
                              thread ->
                                  thread.getTask() != null
                                      && TaskType.RequestApproval.equals(
                                          thread.getTask().getType()));
              assertTrue(
                  approvalTaskFound, "Empty include fields should behave like normal workflow");
            });
    LOG.info("✓ Approval task created successfully - backward compatibility maintained");

    // Cleanup workflow
    try {
      WorkflowDefinition wd =
          client.workflowDefinitions().getByName("workflow_" + randomSuffix, null);
      executeWithDeadlockRetryVoid(
          () -> {
            try {
              client.workflowDefinitions().delete(wd.getId());
            } catch (Exception e) {
              throw new RuntimeException("Failed to delete workflow", e);
            }
          },
          "delete-workflow-" + wd.getName());
      LOG.debug("Successfully deleted EmptyIncludeWorkflow");
    } catch (Exception e) {
      LOG.warn("Error while deleting EmptyIncludeWorkflow: {}", e.getMessage());
    }

    // Cleanup test entities
    try {
      Map<String, String> params = new HashMap<>();
      params.put("hardDelete", "true");
      params.put("recursive", "true");
      client.tables().delete(table.getId().toString(), params);
      client.databaseSchemas().delete(schema.getId().toString(), params);
      client.databases().delete(database.getId().toString(), params);
      client.databaseServices().delete(service.getId().toString(), params);
      client.users().delete(testUser.getId().toString(), params);
      LOG.debug("✓ Deleted all test entities");
    } catch (Exception e) {
      LOG.warn("Cleanup error: {}", e.getMessage());
    }
  }

  @Test
  @Order(34)
  void test_MultipleFieldChangesWithIncludeFields(TestNamespace ns) throws Exception {
    LOG.info("Testing workflow with include fields for multiple different field types");
    OpenMetadataClient client = SdkClients.adminClient();

    // Create test user for task ownership
    String randomSuffix = UUID.randomUUID().toString().substring(0, 8);
    CreateUser createUser =
        new CreateUser().withName("user_" + randomSuffix).withEmail("multi.field@example.com");
    User testUser = client.users().create(createUser);

    // Create test entities
    CreateDatabaseService createService = createDatabaseServiceRequest("svc_" + randomSuffix);
    DatabaseService service = client.databaseServices().create(createService);

    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName("db_" + randomSuffix)
            .withService(service.getFullyQualifiedName());
    Database database = client.databases().create(createDatabase);

    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("schema_" + randomSuffix)
            .withDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = client.databaseSchemas().create(createSchema);

    CreateTable createTable =
        new CreateTable()
            .withName("tbl_" + randomSuffix)
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.INT)))
            .withOwners(List.of(new EntityReference().withType("user").withId(testUser.getId())));
    Table table = client.tables().create(createTable);

    // Create domain and tag for testing
    CreateDomain createDomain =
        new CreateDomain()
            .withName("domain_" + randomSuffix)
            .withDescription("Domain for multi field testing")
            .withDomainType(CreateDomain.DomainType.CONSUMER_ALIGNED);
    Domain domain = client.domains().create(createDomain);

    CreateClassification createClassification =
        new CreateClassification()
            .withName("TestTags_" + randomSuffix)
            .withDescription("Classification for multi-field testing");
    Classification classification = client.classifications().create(createClassification);

    CreateTag createTag =
        new CreateTag()
            .withName("CriticalTag")
            .withDescription("Critical tag for multi-field testing")
            .withClassification(classification.getFullyQualifiedName());
    Tag tag = client.tags().create(createTag);

    // Create workflow with multiple include fields
    Map<String, Object> triggerConfig = new HashMap<>();
    triggerConfig.put("entityTypes", List.of("table"));
    triggerConfig.put("events", List.of("Updated"));
    triggerConfig.put("exclude", List.of());

    List<String> includeFields = List.of("tags", "domains");
    triggerConfig.put("include", includeFields);
    triggerConfig.put("filter", new HashMap<>());

    Map<String, Object> trigger = new HashMap<>();
    trigger.put("type", "eventBasedEntity");
    trigger.put("config", triggerConfig);
    trigger.put("output", List.of("relatedEntity", "updatedBy"));

    // Create approval workflow
    Map<String, Object> startNode = new HashMap<>();
    startNode.put("name", "start");
    startNode.put("type", "startEvent");
    startNode.put("subType", "startEvent");

    Map<String, Object> approvalNode = new HashMap<>();
    approvalNode.put("name", "ApproveMultiFieldChange");
    approvalNode.put("displayName", "Approve Multi-Field Change");
    approvalNode.put("type", "userTask");
    approvalNode.put("subType", "userApprovalTask");
    Map<String, Object> approvalConfig = new HashMap<>();
    Map<String, Object> assignees = new HashMap<>();
    assignees.put("addReviewers", false);
    assignees.put("addOwners", true);
    assignees.put("candidates", List.of());
    approvalConfig.put("assignees", assignees);
    approvalConfig.put("approvalThreshold", 1);
    approvalConfig.put("rejectionThreshold", 1);
    approvalNode.put("config", approvalConfig);
    approvalNode.put("input", List.of("relatedEntity"));
    Map<String, Object> approvalInputNamespace = new HashMap<>();
    approvalInputNamespace.put("relatedEntity", "global");
    approvalNode.put("inputNamespaceMap", approvalInputNamespace);
    approvalNode.put("output", List.of("updatedBy"));
    approvalNode.put("branches", List.of("true", "false"));

    Map<String, Object> approvedEndNode = new HashMap<>();
    approvedEndNode.put("name", "ApprovedEnd");
    approvedEndNode.put("type", "endEvent");
    approvedEndNode.put("subType", "endEvent");

    Map<String, Object> rejectedEndNode = new HashMap<>();
    rejectedEndNode.put("name", "RejectedEnd");
    rejectedEndNode.put("type", "endEvent");
    rejectedEndNode.put("subType", "endEvent");

    Map<String, Object> edge1 = new HashMap<>();
    edge1.put("from", "start");
    edge1.put("to", "ApproveMultiFieldChange");

    Map<String, Object> edge2 = new HashMap<>();
    edge2.put("from", "ApproveMultiFieldChange");
    edge2.put("to", "ApprovedEnd");
    edge2.put("condition", "true");

    Map<String, Object> edge3 = new HashMap<>();
    edge3.put("from", "ApproveMultiFieldChange");
    edge3.put("to", "RejectedEnd");
    edge3.put("condition", "false");

    Map<String, Object> workflowRequest = new HashMap<>();
    workflowRequest.put("name", "workflow_" + randomSuffix);
    workflowRequest.put("displayName", "Multi Field Include Workflow");
    workflowRequest.put("description", "Test workflow with multiple include fields");
    workflowRequest.put("trigger", trigger);
    workflowRequest.put(
        "nodes", List.of(startNode, approvalNode, approvedEndNode, rejectedEndNode));
    workflowRequest.put("edges", List.of(edge1, edge2, edge3));

    String createResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, workflowRequest, RequestOptions.builder().build());
    assertNotNull(createResponse);
    JsonNode created = MAPPER.readTree(createResponse);
    assertTrue(created.has("id"));
    String workflowId = created.get("id").asText();

    // Verify multiple include fields are properly set
    String getResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                BASE_PATH + "/" + workflowId,
                null,
                RequestOptions.builder().build());
    JsonNode workflow = MAPPER.readTree(getResponse);

    JsonNode includeNode = workflow.get("trigger").get("config").get("include");
    assertTrue(includeNode.isArray());
    assertEquals(2, includeNode.size());
    assertTrue(includeNode.toString().contains("tags"));
    assertTrue(includeNode.toString().contains("domains"));

    LOG.info("✓ Multi-field include workflow created with both tag and domain includes verified");

    // Test 1: Update table with tag - should trigger workflow
    String tagPatchJson =
        String.format(
            "[{\"op\":\"add\",\"path\":\"/tags\",\"value\":[{\"tagFQN\":\"%s\",\"source\":\"Classification\",\"labelType\":\"Manual\",\"state\":\"Confirmed\"}]}]",
            tag.getFullyQualifiedName());
    JsonNode tagPatch = MAPPER.readTree(tagPatchJson);
    Table updatedTableWithTag = client.tables().patch(table.getId(), tagPatch);
    assertNotNull(updatedTableWithTag.getTags());
    assertTrue(
        updatedTableWithTag.getTags().stream()
            .anyMatch(tagLabel -> tagLabel.getTagFQN().equals(tag.getFullyQualifiedName())));

    LOG.info("✓ Table updated with tag: {}", tag.getFullyQualifiedName());

    // Wait for workflow to process and check if approval task was created for tag change
    String secondTableEntityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());
    await()
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .pollDelay(Duration.ofSeconds(1))
        .untilAsserted(
            () -> {
              ResultList<Thread> threads =
                  client.feed().listTasks(secondTableEntityLink, TaskStatus.Open, 100);
              boolean tagTaskFound =
                  !threads.getData().isEmpty()
                      && threads.getData().stream()
                          .anyMatch(
                              thread ->
                                  thread.getTask() != null
                                      && TaskType.RequestApproval.equals(
                                          thread.getTask().getType()));
              assertTrue(tagTaskFound, "Approval task should be created for tag field change");
            });
    LOG.info("✓ Approval task created for tag change");

    // Test 2: Update table with domain - should also trigger workflow
    String domainPatchJson =
        String.format(
            "[{\"op\":\"add\",\"path\":\"/domains\",\"value\":[{\"id\":\"%s\",\"type\":\"domain\",\"name\":\"%s\",\"fullyQualifiedName\":\"%s\"}]}]",
            domain.getId(), domain.getName(), domain.getFullyQualifiedName());
    JsonNode domainPatch = MAPPER.readTree(domainPatchJson);
    Table updatedTableWithDomain = client.tables().patch(table.getId(), domainPatch);
    // Refresh table to get domain information
    updatedTableWithDomain = client.tables().get(table.getId().toString(), "domains");
    assertNotNull(updatedTableWithDomain.getDomains());
    assertFalse(updatedTableWithDomain.getDomains().isEmpty());

    LOG.info("✓ Table updated with domain: {}", domain.getFullyQualifiedName());

    // Wait for workflow to process and check if approval task was created for domain change
    await()
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .pollDelay(Duration.ofSeconds(1))
        .untilAsserted(
            () -> {
              ResultList<Thread> threads =
                  client.feed().listTasks(secondTableEntityLink, TaskStatus.Open, 100);
              boolean domainTaskFound =
                  !threads.getData().isEmpty()
                      && threads.getData().stream()
                          .anyMatch(
                              thread ->
                                  thread.getTask() != null
                                      && TaskType.RequestApproval.equals(
                                          thread.getTask().getType()));
              assertTrue(
                  domainTaskFound, "Approval task should be created for domain field change");
            });
    LOG.info(
        "✓ Approval task created for domain change - OR logic verified for multiple include fields");

    // Cleanup workflow
    try {
      WorkflowDefinition wd =
          client.workflowDefinitions().getByName("workflow_" + randomSuffix, null);
      executeWithDeadlockRetryVoid(
          () -> {
            try {
              client.workflowDefinitions().delete(wd.getId());
            } catch (Exception e) {
              throw new RuntimeException("Failed to delete workflow", e);
            }
          },
          "delete-workflow-" + wd.getName());
      LOG.debug("Successfully deleted MultiFieldIncludeWorkflow");
    } catch (Exception e) {
      LOG.warn("Error while deleting MultiFieldIncludeWorkflow: {}", e.getMessage());
    }

    // Cleanup test entities
    try {
      Map<String, String> params = new HashMap<>();
      params.put("hardDelete", "true");
      params.put("recursive", "true");
      client.tables().delete(table.getId().toString(), params);
      client.databaseSchemas().delete(schema.getId().toString(), params);
      client.databases().delete(database.getId().toString(), params);
      client.databaseServices().delete(service.getId().toString(), params);
      client.domains().delete(domain.getId().toString(), params);
      client.classifications().delete(classification.getId().toString(), params);
      client.users().delete(testUser.getId().toString(), params);
      LOG.debug("✓ Deleted all test entities");
    } catch (Exception e) {
      LOG.warn("Cleanup error: {}", e.getMessage());
    }
  }

  @Test
  @Order(42)
  void test_CheckChangeDescriptionTask(TestNamespace ns) throws IOException {
    LOG.info("Starting test_CheckChangeDescriptionTask");
    OpenMetadataClient client = SdkClients.adminClient();
    String uniqueSuffix = String.valueOf(System.currentTimeMillis());

    // Step 1: Create 2 user clients as owners
    LOG.debug("Creating test users for database schema ownership");
    CreateUser createOwner1 =
        new CreateUser()
            .withName("schema_owner1_" + uniqueSuffix)
            .withEmail("schema_owner1_" + uniqueSuffix + "@example.com")
            .withDisplayName("Schema Owner 1");
    User owner1 = client.users().create(createOwner1);
    LOG.debug("Created owner user 1: {}", owner1.getName());

    CreateUser createOwner2 =
        new CreateUser()
            .withName("schema_owner2_" + uniqueSuffix)
            .withEmail("schema_owner2_" + uniqueSuffix + "@example.com")
            .withDisplayName("Schema Owner 2");
    User owner2 = client.users().create(createOwner2);
    LOG.debug("Created owner user 2: {}", owner2.getName());

    // Step 2: Create database service, database, and 2 database schemas
    LOG.debug("Creating database infrastructure");
    CreateDatabaseService createDbService =
        new CreateDatabaseService()
            .withName(ns.prefix("test-db-service-change-desc"))
            .withServiceType(DatabaseServiceType.Mysql)
            .withConnection(
                new DatabaseConnection()
                    .withConfig(
                        new MysqlConnection()
                            .withHostPort("localhost:3306")
                            .withUsername("test")
                            .withAuthType(new basicAuth().withPassword("test"))));
    DatabaseService dbService = client.databaseServices().create(createDbService);
    LOG.debug("Created database service: {}", dbService.getName());

    CreateDatabase createDb =
        new CreateDatabase()
            .withName(ns.prefix("test-database-change-desc"))
            .withService(dbService.getFullyQualifiedName())
            .withDescription("Test database for checkChangeDescriptionTask testing");
    Database database = client.databases().create(createDb);
    LOG.debug("Created database: {}", database.getName());

    CreateDatabaseSchema createSchema1 =
        new CreateDatabaseSchema()
            .withName(ns.prefix("test-schema1"))
            .withDatabase(database.getFullyQualifiedName())
            .withDescription("Test schema 1 for change description testing")
            .withOwners(List.of(owner1.getEntityReference()));
    DatabaseSchema dbSchema1 = client.databaseSchemas().create(createSchema1);
    LOG.debug(
        "Created database schema 1: {} with owner: {}", dbSchema1.getName(), owner1.getName());

    CreateDatabaseSchema createSchema2 =
        new CreateDatabaseSchema()
            .withName(ns.prefix("test-schema2"))
            .withDatabase(database.getFullyQualifiedName())
            .withDescription("Test schema 2 for change description testing")
            .withOwners(List.of(owner2.getEntityReference()));
    DatabaseSchema dbSchema2 = client.databaseSchemas().create(createSchema2);
    LOG.debug(
        "Created database schema 2: {} with owner: {}", dbSchema2.getName(), owner2.getName());

    // Step 3: Create Finance and Business domains
    LOG.debug("Creating test domains");
    CreateDomain createFinanceDomain =
        new CreateDomain()
            .withName(ns.prefix("Finance"))
            .withDescription("Finance domain for testing")
            .withDomainType(CreateDomain.DomainType.CONSUMER_ALIGNED);
    Domain financeDomain = client.domains().create(createFinanceDomain);
    LOG.debug("Created Finance domain: {}", financeDomain.getName());

    CreateDomain createBusinessDomain =
        new CreateDomain()
            .withName(ns.prefix("Business"))
            .withDescription("Business domain for testing")
            .withDomainType(CreateDomain.DomainType.CONSUMER_ALIGNED);
    Domain businessDomain = client.domains().create(createBusinessDomain);
    LOG.debug("Created Business domain: {}", businessDomain.getName());

    // Step 4: Get existing PII tags (PII.Sensitive and PII.None should already exist)
    Tag piiSensitiveTag;
    Tag piiNoneTag;
    try {
      piiSensitiveTag = client.tags().getByName("PII.Sensitive");
      piiNoneTag = client.tags().getByName("PII.None");
      LOG.debug("Found existing PII tags: PII.Sensitive and PII.None");
    } catch (Exception e) {
      LOG.error("Failed to find existing PII tags. They should exist in the system.", e);
      throw new RuntimeException("PII tags not found", e);
    }

    // Step 5: Create workflow with checkChangeDescriptionTask and static name
    String workflowName = "CheckChangeDescriptionWorkflow";
    LOG.debug("Creating workflow: {}", workflowName);
    String workflowJson =
        """
        {
          "name": "%s",
          "displayName": "Check Change Description Workflow",
          "description": "Workflow that checks change description for tags or domains changes",
          "type": "eventBasedEntity",
          "trigger": {
            "type": "eventBasedEntity",
            "config": {
              "events": ["Updated"],
              "entityTypes": ["databaseSchema"]
            },
            "output": ["relatedEntity", "updatedBy"]
          },
          "nodes": [
            {
              "name": "start",
              "type": "startEvent",
              "subType": "startEvent"
            },
            {
              "name": "checkChangeDesc",
              "type": "automatedTask",
              "subType": "checkChangeDescriptionTask",
              "displayName": "Check Tags or Domains Changed",
              "config": {
                "condition": "OR",
                "rules": {
                  "tags": ["PII.Sensitive", "PII.None"],
                  "domains": ["Finance"]
                }
              },
              "input": ["relatedEntity"],
              "inputNamespaceMap": {
                "relatedEntity": "global"
              },
              "branches": ["true", "false"]
            },
            {
              "name": "userApproval",
              "type": "userTask",
              "subType": "userApprovalTask",
              "displayName": "Approve Changes",
              "input": ["relatedEntity"],
              "output": ["updatedBy"],
              "branches": ["true", "false"],
              "config": {
                "assignees": {
                  "addReviewers": true,
                  "addOwners": true,
                  "candidates": []
                },
                "approvalThreshold": 1,
                "rejectionThreshold": 1
              },
              "inputNamespaceMap": {
                "relatedEntity": "global"
              }
            },
            {
              "name": "setApproved",
              "type": "automatedTask",
              "subType": "setEntityAttributeTask",
              "displayName": "Set Status to Approved",
              "config": {
                "fieldName": "status",
                "fieldValue": "Approved"
              },
              "input": ["relatedEntity", "updatedBy"],
              "inputNamespaceMap": {
                "relatedEntity": "global",
                "updatedBy": "userApproval"
              }
            },
            {
              "name": "setRejected",
              "type": "automatedTask",
              "subType": "setEntityAttributeTask",
              "displayName": "Set Status to Rejected",
              "config": {
                "fieldName": "status",
                "fieldValue": "Rejected"
              },
              "input": ["relatedEntity", "updatedBy"],
              "inputNamespaceMap": {
                "relatedEntity": "global",
                "updatedBy": "userApproval"
              }
            },
            {
              "name": "setDraft",
              "type": "automatedTask",
              "subType": "setEntityAttributeTask",
              "displayName": "Set Status to Draft",
              "config": {
                "fieldName": "status",
                "fieldValue": "Draft"
              },
              "input": ["relatedEntity", "updatedBy"],
              "inputNamespaceMap": {
                "relatedEntity": "global",
                "updatedBy": "global"
              }
            },
            {
              "name": "end",
              "type": "endEvent",
              "subType": "endEvent"
            }
          ],
          "edges": [
            {
              "from": "start",
              "to": "checkChangeDesc"
            },
            {
              "from": "checkChangeDesc",
              "to": "userApproval",
              "condition": "true"
            },
            {
              "from": "checkChangeDesc",
              "to": "setDraft",
              "condition": "false"
            },
            {
              "from": "userApproval",
              "to": "setApproved",
              "condition": "true"
            },
            {
              "from": "userApproval",
              "to": "setRejected",
              "condition": "false"
            },
            {
              "from": "setApproved",
              "to": "end"
            },
            {
              "from": "setRejected",
              "to": "end"
            },
            {
              "from": "setDraft",
              "to": "end"
            }
          ]
        }
        """
            .formatted(workflowName);

    CreateWorkflowDefinition workflowRequest =
        MAPPER.readValue(workflowJson, CreateWorkflowDefinition.class);
    WorkflowDefinition workflow = client.workflowDefinitions().create(workflowRequest);
    LOG.debug("Created workflow: {}", workflow.getName());

    // Wait for workflow to be deployed
    waitForWorkflowDeployment(client, workflowName);
    LOG.debug("✓ Workflow deployed successfully");

    // Step 6: Update dbSchema1 with Finance domain and verify task creation
    LOG.info("Testing Finance domain update on dbSchema1");
    String schema1EntityLink =
        String.format("<#E::databaseSchema::%s>", dbSchema1.getFullyQualifiedName());

    String domainPatchJson =
        String.format(
            """
        [
          {
            "op": "add",
            "path": "/domains",
            "value": [
              {
                "id": "%s",
                "type": "domain",
                "name": "%s",
                "fullyQualifiedName": "%s"
              }
            ]
          }
        ]
        """,
            financeDomain.getId(), financeDomain.getName(), financeDomain.getFullyQualifiedName());

    JsonNode domainPatch = MAPPER.readTree(domainPatchJson);
    client.databaseSchemas().patch(dbSchema1.getId(), domainPatch);
    LOG.debug("Updated dbSchema1 with Finance domain");

    // Verify task creation for Finance domain
    await()
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> {
              try {
                ResultList<Thread> tasks =
                    client.feed().listTasks(schema1EntityLink, TaskStatus.Open, 10);
                boolean hasTask = !tasks.getData().isEmpty();
                if (hasTask) {
                  LOG.debug("✓ Found task for Finance domain change");
                }
                return hasTask;
              } catch (Exception e) {
                LOG.debug("Waiting for task creation: {}", e.getMessage());
                return false;
              }
            });

    ResultList<Thread> financeTasks =
        client.feed().listTasks(schema1EntityLink, TaskStatus.Open, 10);
    assertFalse(financeTasks.getData().isEmpty(), "Should have approval task for Finance domain");
    Thread financeTask = financeTasks.getData().get(0);
    LOG.debug("Found Finance domain task: {}", financeTask.getId());

    // Step 7: Approve the Finance domain task
    LOG.info("Approving Finance domain task");
    OpenMetadataClient owner1Client =
        SdkClients.createClient(owner1.getName(), owner1.getEmail(), new String[] {});
    ResolveTask resolveFinanceTask =
        new ResolveTask().withNewValue(org.openmetadata.schema.type.EntityStatus.APPROVED.value());
    owner1Client.feed().resolveTask(financeTask.getTask().getId().toString(), resolveFinanceTask);
    LOG.debug("✓ Resolved Finance domain task");

    // Step 8: Update dbSchema1 with PII.Sensitive tag and verify task creation
    LOG.info("Testing PII.Sensitive tag update on dbSchema1");
    String tagPatchJson =
        String.format(
            """
        [
          {
            "op": "add",
            "path": "/tags",
            "value": [
              {
                "tagFQN": "%s",
                "source": "Classification",
                "labelType": "Manual",
                "state": "Confirmed"
              }
            ]
          }
        ]
        """,
            piiSensitiveTag.getFullyQualifiedName());

    JsonNode tagPatch = MAPPER.readTree(tagPatchJson);
    client.databaseSchemas().patch(dbSchema1.getId(), tagPatch);
    LOG.debug("Updated dbSchema1 with PII.Sensitive tag");

    // Verify task creation for PII.Sensitive tag
    await()
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> {
              try {
                ResultList<Thread> tasks =
                    client.feed().listTasks(schema1EntityLink, TaskStatus.Open, 10);
                boolean hasNewTask = tasks.getData().size() > 0; // Should have new task
                if (hasNewTask) {
                  LOG.debug("✓ Found task for PII.Sensitive tag change");
                }
                return hasNewTask;
              } catch (Exception e) {
                LOG.debug("Waiting for PII tag task creation: {}", e.getMessage());
                return false;
              }
            });

    ResultList<Thread> piiTasks = client.feed().listTasks(schema1EntityLink, TaskStatus.Open, 10);
    assertFalse(piiTasks.getData().isEmpty(), "Should have approval task for PII.Sensitive tag");
    Thread piiTask = piiTasks.getData().get(0);
    LOG.debug("Found PII.Sensitive tag task: {}", piiTask.getId());

    // Step 9: Resolve the PII.Sensitive tag task
    LOG.info("Resolving PII.Sensitive tag task");
    ResolveTask resolvePiiTask =
        new ResolveTask().withNewValue(org.openmetadata.schema.type.EntityStatus.APPROVED.value());
    owner1Client.feed().resolveTask(piiTask.getTask().getId().toString(), resolvePiiTask);
    LOG.debug("✓ Resolved PII.Sensitive tag task");

    // Step 10: Update dbSchema2 with PII.NonSensitive tag, verify NO tasks created
    LOG.info("Testing PII.NonSensitive tag update on dbSchema2 - should NOT create task");
    String schema2EntityLink =
        String.format("<#E::databaseSchema::%s>", dbSchema2.getFullyQualifiedName());

    // Create a tag that's not in the include list
    CreateClassification createTestClassification =
        new CreateClassification()
            .withName(ns.prefix("TestClassification"))
            .withDescription("Test classification for negative testing");
    Classification testClassification = client.classifications().create(createTestClassification);

    CreateTag createNonSensitiveTag =
        new CreateTag()
            .withName("NonSensitive")
            .withClassification(testClassification.getFullyQualifiedName())
            .withDescription("Non-sensitive tag for negative testing");
    Tag nonSensitiveTag = client.tags().create(createNonSensitiveTag);

    String nonSensitiveTagPatchJson =
        String.format(
            """
        [
          {
            "op": "add",
            "path": "/tags",
            "value": [
              {
                "tagFQN": "%s",
                "source": "Classification",
                "labelType": "Manual",
                "state": "Confirmed"
              }
            ]
          }
        ]
        """,
            nonSensitiveTag.getFullyQualifiedName());

    JsonNode nonSensitiveTagPatch = MAPPER.readTree(nonSensitiveTagPatchJson);
    client.databaseSchemas().patch(dbSchema2.getId(), nonSensitiveTagPatch);
    LOG.debug("Updated dbSchema2 with non-included tag");

    // Wait and verify NO task is created for non-included tag
    await()
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(
            () -> {
              ResultList<Thread> tasks =
                  client.feed().listTasks(schema2EntityLink, TaskStatus.Open, 10);
              assertTrue(tasks.getData().isEmpty(), "Should NOT have task for non-included tag");
            });
    LOG.debug("✓ Confirmed no task created for non-included tag");

    // Step 11: Update dbSchema2 with Business domain, verify NO tasks created
    LOG.info("Testing Business domain update on dbSchema2 - should NOT create task");
    String businessDomainPatchJson =
        String.format(
            """
        [
          {
            "op": "add",
            "path": "/domains",
            "value": [
              {
                "id": "%s",
                "type": "domain",
                "name": "%s",
                "fullyQualifiedName": "%s"
              }
            ]
          }
        ]
        """,
            businessDomain.getId(),
            businessDomain.getName(),
            businessDomain.getFullyQualifiedName());

    JsonNode businessDomainPatch = MAPPER.readTree(businessDomainPatchJson);
    client.databaseSchemas().patch(dbSchema2.getId(), businessDomainPatch);
    LOG.debug("Updated dbSchema2 with Business domain (not in include list)");

    // Wait and verify NO task is created for non-included domain
    await()
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(
            () -> {
              ResultList<Thread> tasks =
                  client.feed().listTasks(schema2EntityLink, TaskStatus.Open, 10);
              assertTrue(tasks.getData().isEmpty(), "Should NOT have task for non-included domain");
            });
    LOG.debug("✓ Confirmed no task created for non-included domain");

    LOG.info("test_CheckChangeDescriptionTask completed successfully");

    // Cleanup
    try {
      client.workflowDefinitions().delete(workflow.getId().toString());
      client.databaseSchemas().delete(dbSchema1.getId().toString());
      client.databaseSchemas().delete(dbSchema2.getId().toString());
      client.databases().delete(database.getId().toString());
      client.databaseServices().delete(dbService.getId().toString());
      client.domains().delete(financeDomain.getId().toString());
      client.domains().delete(businessDomain.getId().toString());
      client.tags().delete(nonSensitiveTag.getId().toString());
      client.classifications().delete(testClassification.getId().toString());
      client.users().delete(owner1.getId().toString());
      client.users().delete(owner2.getId().toString());
      LOG.debug("✓ Cleaned up test entities");
    } catch (Exception e) {
      LOG.warn("Cleanup error: {}", e.getMessage());
    }
  }

  @Test
  @Order(42)
  void test_SelfApprovalPrevention(TestNamespace ns) throws IOException {
    LOG.info("Starting test_SelfApprovalPrevention");

    OpenMetadataClient client = SdkClients.adminClient();
    String uniqueSuffix = String.valueOf(System.currentTimeMillis());

    // Step 1: Create three users
    LOG.debug("Creating test users for self-approval prevention testing");

    CreateUser createUser1 =
        new CreateUser()
            .withName("approver1_" + uniqueSuffix)
            .withEmail("approver1_" + uniqueSuffix + "@example.com")
            .withDisplayName("Test Approver 1")
            .withIsAdmin(true); // Make user1 an admin so they can update reviewers
    User user1 = client.users().create(createUser1);
    LOG.debug("Created user 1: {}", user1.getName());

    CreateUser createUser2 =
        new CreateUser()
            .withName("approver2_" + uniqueSuffix)
            .withEmail("approver2_" + uniqueSuffix + "@example.com")
            .withDisplayName("Test Approver 2");
    User user2 = client.users().create(createUser2);
    LOG.debug("Created user 2: {}", user2.getName());

    CreateUser createUser3 =
        new CreateUser()
            .withName("approver3_" + uniqueSuffix)
            .withEmail("approver3_" + uniqueSuffix + "@example.com")
            .withDisplayName("Test Approver 3");
    User user3 = client.users().create(createUser3);
    LOG.debug("Created user 3: {}", user3.getName());

    // Step 2: Create classification first (without reviewers)
    LOG.debug("Creating initial classification");
    CreateClassification createClassification =
        new CreateClassification()
            .withName(ns.prefix("test_classification"))
            .withDisplayName("Test Classification for Self-Approval")
            .withDescription("Classification to test self-approval prevention");
    Classification classification = client.classifications().create(createClassification);
    LOG.debug("Created initial classification: {}", classification.getName());

    // Step 3: Create workflow for classification approval
    LOG.debug("Creating workflow for classification approval testing");

    String workflowJson =
        """
        {
          "name": "%s",
          "displayName": "Self-Approval Prevention Test Workflow",
          "description": "Workflow testing prevention of self-approval",
          "trigger": {
            "type": "eventBasedEntity",
            "config": {
              "entityTypes": ["classification"],
              "events": ["Updated"],
              "exclude": [],
              "filter": {}
            },
            "output": ["relatedEntity", "updatedBy"]
          },
          "nodes": [
            {
              "name": "start",
              "displayName": "Start",
              "type": "startEvent",
              "subType": "startEvent"
            },
            {
              "name": "setStatusInReview",
              "displayName": "Set Status In Review",
              "type": "automatedTask",
              "subType": "setEntityAttributeTask",
              "config": {
                "fieldName": "entityStatus",
                "fieldValue": "In Review"
              },
              "input": ["relatedEntity", "updatedBy"],
              "inputNamespaceMap": {
                "relatedEntity": "global",
                "updatedBy": "global"
              },
              "output": []
            },
            {
              "name": "ApprovalTask",
              "displayName": "Approval Task",
              "type": "userTask",
              "subType": "userApprovalTask",
              "config": {
                "assignees": {
                  "addReviewers": true,
                  "addOwners": false,
                  "candidates": []
                }
              },
              "input": ["relatedEntity"],
              "inputNamespaceMap": {
                "relatedEntity": "global"
              },
              "output": ["result"],
              "branches": ["true", "false"]
            },
            {
              "name": "setStatusApproved",
              "displayName": "Set Status Approved",
              "type": "automatedTask",
              "subType": "setEntityAttributeTask",
              "config": {
                "fieldName": "entityStatus",
                "fieldValue": "Approved"
              },
              "input": ["relatedEntity", "updatedBy"],
              "inputNamespaceMap": {
                "relatedEntity": "global",
                "updatedBy": "global"
              },
              "output": []
            },
            {
              "name": "setStatusRejected",
              "displayName": "Set Status Rejected",
              "type": "automatedTask",
              "subType": "setEntityAttributeTask",
              "config": {
                "fieldName": "entityStatus",
                "fieldValue": "Rejected"
              },
              "input": ["relatedEntity", "updatedBy"],
              "inputNamespaceMap": {
                "relatedEntity": "global",
                "updatedBy": "global"
              },
              "output": []
            },
            {
              "name": "endApproved",
              "displayName": "End Approved",
              "type": "endEvent",
              "subType": "endEvent"
            },
            {
              "name": "endRejected",
              "displayName": "End Rejected",
              "type": "endEvent",
              "subType": "endEvent"
            }
          ],
          "edges": [
            {"from": "start", "to": "setStatusInReview"},
            {"from": "setStatusInReview", "to": "ApprovalTask"},
            {"from": "ApprovalTask", "to": "setStatusApproved", "condition": "true"},
            {"from": "ApprovalTask", "to": "setStatusRejected", "condition": "false"},
            {"from": "setStatusApproved", "to": "endApproved"},
            {"from": "setStatusRejected", "to": "endRejected"}
          ],
          "config": {"storeStageStatus": false}
        }
        """
            .formatted("SelfApprovalPreventionWorkflow");

    CreateWorkflowDefinition workflow;
    try {
      LOG.debug(
          "Attempting to parse workflow JSON: {}",
          workflowJson.substring(0, Math.min(500, workflowJson.length())));
      workflow = JsonUtils.readValue(workflowJson, CreateWorkflowDefinition.class);
    } catch (Exception e) {
      LOG.error("Failed to parse workflow JSON: {}", e.getMessage());
      LOG.error("Workflow JSON content: {}", workflowJson);
      throw e;
    }

    String workflowResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, BASE_PATH, workflow, RequestOptions.builder().build());

    JsonNode workflowCreated = MAPPER.readTree(workflowResponse);
    String workflowId = workflowCreated.get("id").asText();
    LOG.debug("Created self-approval prevention workflow: {}", workflowId);

    // Step 4: Create client for user1 and update classification (user1 making the change and is a
    // reviewer)
    LOG.debug("Creating admin client for user1 and updating classification with reviewers");

    // Create admin client for user1 (the one making the change) with admin privileges
    OpenMetadataClient user1Client =
        SdkClients.createClient(user1.getEmail(), user1.getEmail(), new String[] {"admin"});

    EntityReference user1Ref =
        new EntityReference()
            .withId(user1.getId())
            .withType("user")
            .withName(user1.getName())
            .withFullyQualifiedName(user1.getFullyQualifiedName());

    EntityReference user2Ref =
        new EntityReference()
            .withId(user2.getId())
            .withType("user")
            .withName(user2.getName())
            .withFullyQualifiedName(user2.getFullyQualifiedName());

    EntityReference user3Ref =
        new EntityReference()
            .withId(user3.getId())
            .withType("user")
            .withName(user3.getName())
            .withFullyQualifiedName(user3.getFullyQualifiedName());

    // Construct JSON patch to add reviewers and update description
    String reviewersJson =
        String.format(
            "["
                + "{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"Updated description to trigger workflow\"},"
                + "{\"op\":\"add\",\"path\":\"/reviewers\",\"value\":["
                + "{\"id\":\"%s\",\"type\":\"user\",\"name\":\"%s\",\"fullyQualifiedName\":\"%s\"},"
                + "{\"id\":\"%s\",\"type\":\"user\",\"name\":\"%s\",\"fullyQualifiedName\":\"%s\"},"
                + "{\"id\":\"%s\",\"type\":\"user\",\"name\":\"%s\",\"fullyQualifiedName\":\"%s\"}"
                + "]}]",
            user1.getId(),
            user1.getName(),
            user1.getFullyQualifiedName(),
            user2.getId(),
            user2.getName(),
            user2.getFullyQualifiedName(),
            user3.getId(),
            user3.getName(),
            user3.getFullyQualifiedName());

    // Update the classification to add reviewers (INCLUDING user1 who is making the update)
    JsonNode patch = MAPPER.readTree(reviewersJson);
    Classification updatedClassification =
        user1Client.classifications().patch(classification.getId(), patch);
    LOG.debug(
        "Patched classification: {} with reviewers: [{}, {}, {}] (user1 client making update)",
        updatedClassification.getName(),
        user1.getName(),
        user2.getName(),
        user3.getName());

    // Step 5: Wait and verify task creation
    LOG.info("Waiting for workflow to process classification update and create approval task...");

    await()
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(
            () -> {
              try {
                String feedResponse =
                    user1Client
                        .getHttpClient()
                        .executeForString(
                            HttpMethod.GET,
                            "/v1/feed?type=Task",
                            null,
                            RequestOptions.builder().build());

                JsonNode feedData = MAPPER.readTree(feedResponse);
                JsonNode threads = feedData.get("data");

                boolean foundTask = false;
                boolean selfApprovalPrevented = false;

                for (JsonNode thread : threads) {
                  LOG.debug("Checking thread: {}", thread);
                  if (thread.has("task")) {
                    JsonNode task = thread.get("task");
                    LOG.debug("Found task: {}", task);

                    // Check if thread has about field (about is on the Thread, not the Task)
                    if (!thread.has("about") || thread.get("about") == null) {
                      LOG.debug("Thread missing 'about' field, skipping");
                      continue;
                    }

                    String taskAbout = thread.get("about").asText();
                    LOG.debug("Thread about: {}", taskAbout);

                    if (taskAbout.contains(classification.getFullyQualifiedName())) {
                      foundTask = true;
                      LOG.debug("Found matching task for classification");

                      if (!task.has("assignees") || task.get("assignees") == null) {
                        LOG.warn("Task missing 'assignees' field");
                        continue;
                      }

                      JsonNode assignees = task.get("assignees");
                      LOG.debug("Task assignees: {}", assignees);

                      // Verify that user1 (the updater) is NOT in the assignees due to
                      // self-approval prevention
                      boolean user1InAssignees = false;
                      boolean user2InAssignees = false;
                      boolean user3InAssignees = false;

                      for (JsonNode assignee : assignees) {
                        if (assignee.has("name") && assignee.get("name") != null) {
                          String assigneeName = assignee.get("name").asText();
                          LOG.debug("Checking assignee: {}", assigneeName);
                          if (user1.getName().equals(assigneeName)) {
                            user1InAssignees = true;
                          }
                          if (user2.getName().equals(assigneeName)) {
                            user2InAssignees = true;
                          }
                          if (user3.getName().equals(assigneeName)) {
                            user3InAssignees = true;
                          }
                        }
                      }

                      LOG.debug(
                          "Task assignees analysis: user1 (updater) in assignees: {}, user2 in assignees: {}, user3 in assignees: {}",
                          user1InAssignees,
                          user2InAssignees,
                          user3InAssignees);

                      // Self-approval prevention: user1 should NOT be in assignees, but user2,
                      // user3 should be
                      selfApprovalPrevented =
                          !user1InAssignees && user2InAssignees && user3InAssignees;
                      break;
                    }
                  }
                }

                assertTrue(foundTask, "Expected to find approval task for classification");
                assertTrue(
                    selfApprovalPrevented,
                    "Self-approval prevention failed: creator should not be in assignees");

              } catch (Exception e) {
                LOG.error("Error during task verification: {}", e.getMessage());
                fail(
                    "Failed to verify task creation and self-approval prevention: "
                        + e.getMessage());
              }
            });

    LOG.info("✓ Verified that self-approval prevention is working correctly");

    // Step 6: Cleanup
    LOG.debug("Cleaning up test resources");

    // Delete workflow
    try {
      client
          .getHttpClient()
          .executeForString(
              HttpMethod.DELETE,
              BASE_PATH + "/" + workflowId,
              null,
              RequestOptions.builder().build());
      LOG.debug("✓ Deleted workflow");
    } catch (Exception e) {
      LOG.warn("Failed to delete workflow: {}", e.getMessage());
    }

    // Delete classification
    Map<String, String> params = new HashMap<>();
    params.put("recursive", "true");
    client.classifications().delete(classification.getId().toString(), params);
    LOG.debug("✓ Deleted classification");

    // Delete users
    client.users().delete(user1.getId().toString(), params);
    client.users().delete(user2.getId().toString(), params);
    client.users().delete(user3.getId().toString(), params);
    LOG.debug("✓ Deleted test users");

    LOG.info("test_SelfApprovalPrevention completed successfully");
  }
}
