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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Duration;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
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
import org.openmetadata.sdk.exceptions.OpenMetadataException;
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
  private static final String LEGACY_ASSIGNED_STAGE = "LegacyAssignedStage";
  private static final Set<String> RETURN_TRANSITIONS = Set.of("new", "ack");
  private static final String ASSIGNED_STAGE_ID = "assigned";
  private static final String NEW_STAGE_ID = "new";
  private static final Duration TIMEOUT = Duration.ofSeconds(120);

  @ParameterizedTest
  @EnumSource(
      value = TestCaseResolutionStatusTypes.class,
      names = {"New", "Ack"})
  void failedProcessMigrationDoesNotAdvertiseTransitionsOrClearAssignees(
      TestCaseResolutionStatusTypes target, TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    try {
      installPreUpgradeWorkflow();
      renameAssignedStage(ASSIGNED_STAGE, LEGACY_ASSIGNED_STAGE);
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
      renameAssignedStage(LEGACY_ASSIGNED_STAGE, ASSIGNED_STAGE);
      IncidentWorkflowTransitionMigration.addAssignedStatusTransitions();

      Task unchanged =
          client.tasks().get(task.getId().toString(), "assignees,availableTransitions");
      assertFalse(
          unchanged.getAvailableTransitions().stream()
              .anyMatch(t -> RETURN_TRANSITIONS.contains(t.getId())));
      assertThrows(
          OpenMetadataException.class,
          () ->
              client
                  .testCaseResolutionStatuses()
                  .create(
                      new CreateTestCaseResolutionStatus()
                          .withTestCaseReference(testCase.getFullyQualifiedName())
                          .withTestCaseResolutionStatusType(target)));
      Task rejected = client.tasks().get(task.getId().toString(), "assignees");
      assertEquals(ASSIGNED_STAGE_ID, rejected.getWorkflowStageId());
      assertEquals(
          SharedEntities.get().USER1_REF.getId(), rejected.getAssignees().getFirst().getId());
    } finally {
      IncidentWorkflowTransitionMigration.addAssignedStatusTransitions();
    }
  }

  @ParameterizedTest
  @EnumSource(
      value = TestCaseResolutionStatusTypes.class,
      names = {"New", "Ack"})
  void incidentAssignedBeforeTheUpgradeCanReturnToEarlierStage(
      TestCaseResolutionStatusTypes target, TestNamespace ns) {
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

      IncidentWorkflowTransitionMigration.addAssignedStatusTransitions();
      Double migratedVersion = client.tasks().get(task.getId().toString()).getVersion();
      IncidentWorkflowTransitionMigration.addAssignedStatusTransitions();
      assertEquals(
          migratedVersion,
          client.tasks().get(task.getId().toString()).getVersion(),
          "retrying the backfill must not rewrite an already refreshed task");

      client
          .testCaseResolutionStatuses()
          .create(
              new CreateTestCaseResolutionStatus()
                  .withTestCaseReference(testCase.getFullyQualifiedName())
                  .withTestCaseResolutionStatusType(target));
      awaitStage(
          client, task.getId(), target == TestCaseResolutionStatusTypes.New ? NEW_STAGE_ID : "ack");
      assertEquals(
          target == TestCaseResolutionStatusTypes.New
              ? TaskEntityStatus.Open
              : TaskEntityStatus.InProgress,
          client.tasks().get(task.getId().toString(), "status").getStatus());
    } finally {
      IncidentWorkflowTransitionMigration.addAssignedStatusTransitions();
    }
  }

  private void renameAssignedStage(String from, String to) {
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    WorkflowDefinition definition = repository.findByNameOrNull(WORKFLOW_NAME, Include.NON_DELETED);
    definition.getNodes().stream()
        .filter(node -> from.equals(node.getName()))
        .forEach(node -> node.setName(to));
    definition
        .getEdges()
        .forEach(
            edge -> {
              if (from.equals(edge.getFrom())) {
                edge.setFrom(to);
              }
              if (from.equals(edge.getTo())) {
                edge.setTo(to);
              }
            });
    repository.createOrUpdate(null, definition, Entity.ADMIN_USER_NAME);
  }

  private void installPreUpgradeWorkflow() {
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    WorkflowDefinition persisted = repository.findByNameOrNull(WORKFLOW_NAME, Include.NON_DELETED);
    ObjectNode definition = (ObjectNode) JsonUtils.readTree(JsonUtils.pojoToJson(persisted));
    removeAssignedReturnTransitions(definition);
    WorkflowDefinition preUpgrade =
        JsonUtils.readValue(JsonUtils.pojoToJson(definition), WorkflowDefinition.class);
    repository.createOrUpdate(null, preUpgrade, Entity.ADMIN_USER_NAME);
  }

  private static void removeAssignedReturnTransitions(ObjectNode definition) {
    for (JsonNode node : definition.path("nodes")) {
      if (ASSIGNED_STAGE.equals(node.path("name").asText())) {
        ArrayNode transitions = (ArrayNode) node.path("config").path("transitionMetadata");
        for (int index = transitions.size() - 1; index >= 0; index--) {
          if (RETURN_TRANSITIONS.contains(transitions.get(index).path("id").asText())) {
            transitions.remove(index);
          }
        }
      }
    }
    ArrayNode edges = (ArrayNode) definition.path("edges");
    for (int index = edges.size() - 1; index >= 0; index--) {
      JsonNode edge = edges.get(index);
      if (ASSIGNED_STAGE.equals(edge.path("from").asText())
          && RETURN_TRANSITIONS.contains(edge.path("condition").asText())) {
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
