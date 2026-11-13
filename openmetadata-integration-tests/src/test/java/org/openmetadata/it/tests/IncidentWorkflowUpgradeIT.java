/*
 *  Copyright 2026 Collate
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

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.Assigned;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.migration.utils.v210.IncidentWorkflowTransitionMigration;

/**
 * An incident that started on the workflow before the return-to-New edge existed must still reach
 * New after the upgrade. The upgrade adds the edge and moves the running instance onto it.
 *
 * <p>The test rebuilds the pre-upgrade graph in the shared workflow definition, so it is isolated
 * from every other class and restores the upgraded graph in {@code finally}.
 */
@Isolated
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class IncidentWorkflowUpgradeIT {

  private static final String WORKFLOW_NAME = "TestCaseResolutionTaskWorkflow";
  private static final String ASSIGNED_STAGE = "AssignedStage";
  private static final String NEW_STAGE = "NewStage";
  private static final String NEW_TRANSITION = "new";
  private static final String ASSIGNED_STAGE_ID = "assigned";
  private static final String NEW_STAGE_ID = "new";
  private static final Duration TIMEOUT = Duration.ofSeconds(120);

  @Test
  void incidentAssignedBeforeTheUpgradeReturnsToNew(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    try {
      installPreUpgradeWorkflow();
      TestCase testCase = createTestCase(client, ns);
      createFailedTestResult(client, testCase);
      Task task = awaitIncidentTask(client, testCase);
      client
          .testCaseResolutionStatuses()
          .create(
              new CreateTestCaseResolutionStatus()
                  .withTestCaseReference(testCase.getFullyQualifiedName())
                  .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Assigned)
                  .withTestCaseResolutionStatusDetails(
                      new Assigned().withAssignee(SharedEntities.get().USER1_REF)));
      awaitStage(client, task.getId(), ASSIGNED_STAGE_ID);

      IncidentWorkflowTransitionMigration.addAssignedToNewTransition();

      client
          .testCaseResolutionStatuses()
          .create(
              new CreateTestCaseResolutionStatus()
                  .withTestCaseReference(testCase.getFullyQualifiedName())
                  .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.New));
      awaitStage(client, task.getId(), NEW_STAGE_ID);
      assertEquals(
          TaskEntityStatus.Open, client.tasks().get(task.getId().toString(), "status").getStatus());
    } finally {
      IncidentWorkflowTransitionMigration.addAssignedToNewTransition();
    }
  }

  private void installPreUpgradeWorkflow() {
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    WorkflowDefinition persisted = repository.findByNameOrNull(WORKFLOW_NAME, Include.NON_DELETED);
    ObjectNode definition = (ObjectNode) JsonUtils.readTree(JsonUtils.pojoToJson(persisted));
    removeAssignedToNew(definition);
    WorkflowDefinition preUpgrade =
        JsonUtils.readValue(JsonUtils.pojoToJson(definition), WorkflowDefinition.class);
    repository.createOrUpdate(null, preUpgrade, Entity.ADMIN_USER_NAME);
  }

  private static void removeAssignedToNew(ObjectNode definition) {
    for (JsonNode node : definition.path("nodes")) {
      if (ASSIGNED_STAGE.equals(node.path("name").asText())) {
        ArrayNode transitions = (ArrayNode) node.path("config").path("transitionMetadata");
        for (int index = transitions.size() - 1; index >= 0; index--) {
          if (NEW_TRANSITION.equals(transitions.get(index).path("id").asText())) {
            transitions.remove(index);
          }
        }
      }
    }
    ArrayNode edges = (ArrayNode) definition.path("edges");
    for (int index = edges.size() - 1; index >= 0; index--) {
      JsonNode edge = edges.get(index);
      if (ASSIGNED_STAGE.equals(edge.path("from").asText())
          && NEW_STAGE.equals(edge.path("to").asText())) {
        edges.remove(index);
      }
    }
  }

  private TestCase createTestCase(OpenMetadataClient client, TestNamespace ns) {
    String id = ns.shortPrefix();
    DatabaseService service = DatabaseServiceTestFactory.createPostgresWithName("upg" + id, ns);
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimpleWithName("upgs" + id, ns, service);
    Table table =
        TableTestFactory.createSimpleWithName("upgt" + id, ns, schema.getFullyQualifiedName());
    return TestCaseBuilder.create(client)
        .name("upgtc" + id)
        .forTable(table)
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "100")
        .create();
  }

  private void createFailedTestResult(OpenMetadataClient client, TestCase testCase) {
    CreateTestCaseResult result = new CreateTestCaseResult();
    result.setTimestamp(System.currentTimeMillis());
    result.setTestCaseStatus(TestCaseStatus.Failed);
    result.setResult("Test failed");
    client.testCaseResults().create(testCase.getFullyQualifiedName(), result);
  }

  private Task awaitIncidentTask(OpenMetadataClient client, TestCase testCase) {
    AtomicReference<Task> taskRef = new AtomicReference<>();
    await()
        .atMost(TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> {
              Task found = findIncidentTask(client, testCase);
              if (found != null && found.getWorkflowInstanceId() != null) {
                taskRef.set(found);
                return true;
              }
              return false;
            });
    return taskRef.get();
  }

  private Task findIncidentTask(OpenMetadataClient client, TestCase testCase) {
    ListParams params =
        new ListParams().addFilter("category", "Incident").setFields("about").setLimit(100);
    ListResponse<Task> tasks = client.tasks().list(params);
    return tasks.getData().stream()
        .filter(task -> task.getAbout() != null)
        .filter(
            task ->
                testCase.getFullyQualifiedName().equals(task.getAbout().getFullyQualifiedName()))
        .findFirst()
        .orElse(null);
  }

  private void awaitStage(OpenMetadataClient client, UUID taskId, String stageId) {
    await()
        .atMost(TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(
            () ->
                assertEquals(
                    stageId,
                    client.tasks().get(taskId.toString(), "workflowStageId").getWorkflowStageId()));
  }
}
