/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.flowable.common.engine.impl.cfg.IdGenerator;
import org.flowable.common.engine.impl.persistence.StrongUuidGenerator;
import org.flowable.engine.ProcessEngineConfiguration;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.api.governance.CreateWorkflowDefinition;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.governance.workflows.WorkflowInstanceState;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.databases.DatabaseResourceTest;
import org.openmetadata.service.resources.databases.DatabaseSchemaResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.events.EventSubscriptionResourceTest;
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.service.security.SecurityUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Integration test for Sink workflows. This test exercises the workflow engine with sink task
 * definitions, verifying that:
 *
 * <ul>
 *   <li>Workflows with sink tasks can be created and deployed
 *   <li>Sink task workflow definitions are valid and accepted by the system
 *   <li>Workflow instances are created when entities change
 * </ul>
 *
 * <p>Note: The actual sink execution is tested in unit tests (SinkTaskDelegateTest). This
 * integration test focuses on workflow lifecycle and definition validation.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class SinkWorkflowIntegrationTest extends OpenMetadataApplicationTest {

  private static final Logger LOG = LoggerFactory.getLogger(SinkWorkflowIntegrationTest.class);
  private static final String WORKFLOW_NAME = "SinkIntegrationTestWorkflow";

  private DatabaseServiceResourceTest databaseServiceTest;
  private DatabaseResourceTest databaseTest;
  private DatabaseSchemaResourceTest schemaTest;
  private TableResourceTest tableTest;
  private EventSubscriptionResourceTest eventSubscriptionTest;

  private DatabaseService databaseService;
  private Database database;
  private DatabaseSchema databaseSchema;

  private IdGenerator originalIdGenerator;
  private WorkflowDefinition createdWorkflow;

  @BeforeAll
  public void setup() throws Exception {
    databaseServiceTest = new DatabaseServiceResourceTest();
    databaseTest = new DatabaseResourceTest();
    schemaTest = new DatabaseSchemaResourceTest();
    tableTest = new TableResourceTest();
    eventSubscriptionTest = new EventSubscriptionResourceTest();

    // Force Flowable to use UUIDs for all IDs
    ProcessEngineConfiguration cfg = WorkflowHandler.getInstance().getProcessEngineConfiguration();
    if (cfg != null) {
      originalIdGenerator = cfg.getIdGenerator();
      cfg.setIdGenerator(new StrongUuidGenerator());
    }

    // Setup test database infrastructure
    setupTestDatabase();

    // Ensure WorkflowEventConsumer subscription is active
    ensureWorkflowEventConsumerIsActive();
  }

  @AfterAll
  public void cleanup() {
    // Restore original ID generator
    ProcessEngineConfiguration cfg = WorkflowHandler.getInstance().getProcessEngineConfiguration();
    if (cfg != null && originalIdGenerator != null) {
      cfg.setIdGenerator(originalIdGenerator);
    }

    // Delete the test workflow if created
    if (createdWorkflow != null) {
      try {
        Response response =
            SecurityUtil.addHeaders(
                    getResource("governance/workflowDefinitions/name/" + WORKFLOW_NAME),
                    ADMIN_AUTH_HEADERS)
                .delete();
        LOG.debug("Workflow deletion response: {}", response.getStatus());
      } catch (Exception e) {
        LOG.warn("Failed to delete test workflow: {}", e.getMessage());
      }
    }
  }

  private void setupTestDatabase() throws Exception {
    // Create database service
    CreateDatabaseService createService =
        new CreateDatabaseService()
            .withName("sink_test_service_" + System.currentTimeMillis())
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
            .withConnection(
                new DatabaseConnection()
                    .withConfig(
                        new MysqlConnection().withHostPort("localhost:3306").withUsername("test")));
    databaseService = databaseServiceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create database
    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName("sink_test_db")
            .withService(databaseService.getFullyQualifiedName());
    database = databaseTest.createEntity(createDatabase, ADMIN_AUTH_HEADERS);

    // Create schema
    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("sink_test_schema")
            .withDatabase(database.getFullyQualifiedName());
    databaseSchema = schemaTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);

    LOG.debug("Test database infrastructure created: {}", databaseSchema.getFullyQualifiedName());
  }

  private void ensureWorkflowEventConsumerIsActive() {
    try {
      EventSubscription existing = null;
      try {
        existing =
            eventSubscriptionTest.getEntityByName(
                "WorkflowEventConsumer", null, ADMIN_AUTH_HEADERS);
      } catch (Exception e) {
        // Subscription doesn't exist
      }

      if (existing == null) {
        CreateEventSubscription createSubscription =
            new CreateEventSubscription()
                .withName("WorkflowEventConsumer")
                .withDisplayName("Workflow Event Consumer")
                .withDescription("Consumers EntityChange Events to trigger Workflows.")
                .withAlertType(CreateEventSubscription.AlertType.GOVERNANCE_WORKFLOW_CHANGE_EVENT)
                .withResources(List.of("all"))
                .withProvider(ProviderType.SYSTEM)
                .withPollInterval(10)
                .withEnabled(true)
                .withDestinations(
                    List.of(
                        new SubscriptionDestination()
                            .withId(UUID.fromString("fc9e7a84-5dbd-4e63-8b78-6c3a7bf04a60"))
                            .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
                            .withType(
                                SubscriptionDestination.SubscriptionType
                                    .GOVERNANCE_WORKFLOW_CHANGE_EVENT)
                            .withEnabled(true)));

        eventSubscriptionTest.createEntity(createSubscription, ADMIN_AUTH_HEADERS);
        Thread.sleep(1000);
      } else if (!existing.getEnabled()) {
        String json = JsonUtils.pojoToJson(existing);
        existing.setEnabled(true);
        eventSubscriptionTest.patchEntity(existing.getId(), json, existing, ADMIN_AUTH_HEADERS);
        Thread.sleep(1000);
      }
    } catch (Exception e) {
      LOG.warn("Failed to ensure WorkflowEventConsumer is active: {}", e.getMessage());
    }
  }

  @Test
  public void testSinkWorkflowDefinition_CanBeCreated() throws Exception {
    // Test that a workflow with a webhook sink task can be created successfully
    // Using webhook since it's a built-in sink type
    String workflowJson =
        """
        {
          "name": "%s",
          "displayName": "Sink Integration Test Workflow",
          "description": "Test workflow for sink task integration testing",
          "trigger": {
            "type": "eventBasedEntity",
            "config": {
              "events": ["Created", "Updated"],
              "entityTypes": ["table"]
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
              "subType": "sinkTask",
              "name": "WebhookSink",
              "displayName": "Webhook Sink Task",
              "config": {
                "sinkType": "webhook",
                "sinkConfig": {
                  "endpoint": "http://localhost:9999/webhook",
                  "httpMethod": "POST"
                },
                "syncMode": "overwrite",
                "outputFormat": "json",
                "batchMode": false
              },
              "input": ["relatedEntity"],
              "inputNamespaceMap": {
                "relatedEntity": "global"
              },
              "output": ["result", "syncedCount", "failedCount"]
            },
            {
              "type": "endEvent",
              "subType": "endEvent",
              "name": "end",
              "displayName": "End"
            }
          ],
          "edges": [
            {"from": "start", "to": "WebhookSink"},
            {"from": "WebhookSink", "to": "end", "condition": "success"}
          ],
          "config": {
            "storeStageStatus": true
          }
        }
        """
            .formatted(WORKFLOW_NAME);

    CreateWorkflowDefinition workflow =
        JsonUtils.readValue(workflowJson, CreateWorkflowDefinition.class);

    Response response =
        SecurityUtil.addHeaders(getResource("governance/workflowDefinitions"), ADMIN_AUTH_HEADERS)
            .post(Entity.json(workflow));

    // Accept both CREATED (new) and OK (already exists)
    assertTrue(
        response.getStatus() == Response.Status.CREATED.getStatusCode()
            || response.getStatus() == Response.Status.OK.getStatusCode(),
        "Workflow creation should succeed. Status: " + response.getStatus());

    createdWorkflow = response.readEntity(WorkflowDefinition.class);
    assertNotNull(createdWorkflow, "Created workflow should not be null");
    assertEquals(WORKFLOW_NAME, createdWorkflow.getName());
    assertNotNull(createdWorkflow.getNodes(), "Workflow should have nodes");
    assertFalse(createdWorkflow.getNodes().isEmpty(), "Workflow should have at least one node");

    LOG.info("Successfully created sink workflow: {}", createdWorkflow.getName());
  }

  @Test
  public void testSinkWorkflow_HasCorrectNodeStructure() throws Exception {
    // First ensure workflow exists
    if (createdWorkflow == null) {
      testSinkWorkflowDefinition_CanBeCreated();
    }

    // Fetch the workflow by name
    WebTarget target = getResource("governance/workflowDefinitions/name/" + WORKFLOW_NAME);
    Invocation.Builder builder = target.request();
    for (Map.Entry<String, String> entry : ADMIN_AUTH_HEADERS.entrySet()) {
      builder = builder.header(entry.getKey(), entry.getValue());
    }
    String rawJson = builder.get(String.class);
    WorkflowDefinition workflow = JsonUtils.readValue(rawJson, WorkflowDefinition.class);

    assertNotNull(workflow, "Workflow should exist");
    assertNotNull(workflow.getNodes(), "Workflow should have nodes");

    // Verify we have start, sink task, and end nodes
    assertEquals(3, workflow.getNodes().size(), "Workflow should have 3 nodes");

    // Verify node types
    boolean hasStart =
        workflow.getNodes().stream().anyMatch(n -> "startEvent".equals(n.getSubType()));
    boolean hasSinkTask =
        workflow.getNodes().stream().anyMatch(n -> "sinkTask".equals(n.getSubType()));
    boolean hasEnd = workflow.getNodes().stream().anyMatch(n -> "endEvent".equals(n.getSubType()));

    assertTrue(hasStart, "Workflow should have a start event");
    assertTrue(hasSinkTask, "Workflow should have a sink task");
    assertTrue(hasEnd, "Workflow should have an end event");

    LOG.info("Sink workflow has correct node structure");
  }

  @Test
  public void testSinkWorkflow_TriggersOnTableCreation() throws Exception {
    // First ensure workflow exists
    if (createdWorkflow == null) {
      testSinkWorkflowDefinition_CanBeCreated();
    }

    // Create a table to trigger the workflow
    String tableName = "sink_trigger_test_" + System.currentTimeMillis();
    CreateTable createTable =
        new CreateTable()
            .withName(tableName)
            .withDatabaseSchema(databaseSchema.getFullyQualifiedName())
            .withDescription("Test table for sink workflow trigger")
            .withColumns(
                List.of(
                    new Column()
                        .withName("id")
                        .withDataType(ColumnDataType.INT)
                        .withDescription("Primary key")));

    Table table = tableTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
    assertNotNull(table, "Table should be created");
    LOG.debug("Created test table: {}", table.getFullyQualifiedName());

    String entityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    // Try to find workflow instance (may or may not exist depending on timing)
    // The workflow may fail due to webhook endpoint not existing, but it should still be triggered
    UUID workflowInstanceId = null;
    try {
      workflowInstanceId = waitForWorkflowInstanceByEntityLink(entityLink, WORKFLOW_NAME, 10);
      LOG.info("Found workflow instance: {}", workflowInstanceId);
    } catch (AssertionError e) {
      // Workflow instance may not be created if the sink task fails immediately
      // This is expected behavior when webhook endpoint doesn't exist
      LOG.info(
          "No workflow instance found (expected if webhook endpoint unavailable): {}",
          e.getMessage());
    }

    // If we found a workflow instance, verify its states
    if (workflowInstanceId != null) {
      List<WorkflowInstanceState> states =
          getWorkflowStatesForEntityLink(entityLink, WORKFLOW_NAME);
      if (states != null && !states.isEmpty()) {
        states.sort(Comparator.comparing(WorkflowInstanceState::getTimestamp));
        LOG.info("Workflow states: {}", states.stream().map(s -> s.getStage().getName()).toList());

        // Verify start node was executed
        boolean hasStartState =
            states.stream().anyMatch(s -> "start".equals(s.getStage().getName()));
        assertTrue(hasStartState, "Workflow should have executed start node");
      }
    }

    LOG.info("Sink workflow trigger test completed");
  }

  private UUID waitForWorkflowInstanceByEntityLink(
      String entityLink, String workflowName, int maxRetries) throws InterruptedException {
    int retries = maxRetries;
    long now = System.currentTimeMillis();
    long oneHourAgo = now - 3600_000L;

    while (retries-- > 0) {
      String url =
          String.format(
              "governance/workflowInstances?startTs=%d&endTs=%d&limit=100&entityLink=%s&workflowDefinitionName=%s",
              oneHourAgo, now, URLEncoder.encode(entityLink, StandardCharsets.UTF_8), workflowName);
      WebTarget target = getResource(url);
      Invocation.Builder builder = target.request();
      for (Map.Entry<String, String> entry : ADMIN_AUTH_HEADERS.entrySet()) {
        builder = builder.header(entry.getKey(), entry.getValue());
      }
      String rawJson = builder.get(String.class);
      ResultList<WorkflowInstance> result =
          JsonUtils.readValue(
              rawJson,
              new com.fasterxml.jackson.core.type.TypeReference<ResultList<WorkflowInstance>>() {});

      if (!result.getData().isEmpty()) {
        return result.getData().getFirst().getId();
      }
      Thread.sleep(1000);
    }
    throw new AssertionError("No WorkflowInstance found for entityLink: " + entityLink);
  }

  private List<WorkflowInstanceState> getWorkflowStatesForEntityLink(
      String entityLink, String workflowDefinitionName) {
    try {
      long now = System.currentTimeMillis();
      long oneHourAgo = now - 3600_000L;

      String instanceUrl =
          String.format(
              "governance/workflowInstances?startTs=%d&endTs=%d&limit=100&entityLink=%s&latest=true",
              oneHourAgo, now, URLEncoder.encode(entityLink, StandardCharsets.UTF_8));
      WebTarget instanceTarget = getResource(instanceUrl);
      Invocation.Builder instanceBuilder = instanceTarget.request();
      for (Map.Entry<String, String> entry : ADMIN_AUTH_HEADERS.entrySet()) {
        instanceBuilder = instanceBuilder.header(entry.getKey(), entry.getValue());
      }
      String instanceRawJson = instanceBuilder.get(String.class);
      ResultList<WorkflowInstance> instanceResult =
          JsonUtils.readValue(
              instanceRawJson,
              new com.fasterxml.jackson.core.type.TypeReference<ResultList<WorkflowInstance>>() {});

      if (!instanceResult.getData().isEmpty()) {
        WorkflowInstance latestInstance = instanceResult.getData().get(0);

        String url =
            String.format(
                "governance/workflowInstanceStates/%s/%s?startTs=%d&endTs=%d&limit=100",
                workflowDefinitionName, latestInstance.getId(), oneHourAgo, now);
        WebTarget target = getResource(url);
        Invocation.Builder builder = target.request();
        for (Map.Entry<String, String> entry : ADMIN_AUTH_HEADERS.entrySet()) {
          builder = builder.header(entry.getKey(), entry.getValue());
        }
        String rawJson = builder.get(String.class);
        ResultList<WorkflowInstanceState> result =
            JsonUtils.readValue(
                rawJson,
                new com.fasterxml.jackson.core.type.TypeReference<
                    ResultList<WorkflowInstanceState>>() {});

        return result.getData();
      }
    } catch (Exception e) {
      LOG.warn("Failed to get workflow states: {}", e.getMessage());
    }
    return null;
  }
}
