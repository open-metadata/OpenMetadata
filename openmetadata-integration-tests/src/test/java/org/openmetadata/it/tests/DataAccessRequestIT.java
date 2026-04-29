/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.tasks.CreateTask;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.TaskFormSchema;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.TaskAvailableTransition;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskPriority;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.sdk.exceptions.InvalidRequestException;

/**
 * Integration tests for the Data Access Request task type.
 *
 * <p>Exercises the full lifecycle through the REST API:
 *
 * <ul>
 *   <li>Seed: DataAccessRequest form schema and DataAccessRequestTaskWorkflow are loaded on boot.
 *   <li>Create: POST /tasks with category=DataAccess, type=DataAccessRequest and an
 *       accessType+reason payload succeeds and lands the task at the "review" stage.
 *   <li>Approve: /resolve transitions the task to status=InProgress, stage="approved",
 *       and surfaces a "revoke" available transition (matches the IncidentResolution pattern).
 *   <li>Revoke: /resolve from the approved stage closes the task with status=Revoked and
 *       resolution.type=Revoked.
 *   <li>Reject: alternative terminal path lands at status=Rejected.
 *   <li>Validation: missing required fields (accessType/reason) are rejected by the form
 *       schema validator.
 * </ul>
 */
@Execution(ExecutionMode.CONCURRENT)
public class DataAccessRequestIT {

  private static final String DAR_FORM_SCHEMA_NAME = "DataAccessRequest";
  private static final String DAR_WORKFLOW_NAME = "DataAccessRequestTaskWorkflow";

  private static String createTargetTable(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema dbSchema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = TableTestFactory.createSimple(ns, dbSchema.getFullyQualifiedName());

    return table.getFullyQualifiedName();
  }

  private static CreateTask buildDarRequest(TestNamespace ns, String tableFqn, String accessType) {
    return new CreateTask()
        .withName(ns.prefix("dar-task"))
        .withDisplayName("Test DAR")
        .withCategory(TaskCategory.DataAccess)
        .withType(TaskEntityType.DataAccessRequest)
        .withPriority(TaskPriority.Medium)
        .withAbout(tableFqn)
        .withAboutType("table")
        .withPayload(
            Map.of(
                "accessType", accessType,
                "requestedAccess", "Read",
                "reason", "Need access for IT test",
                "duration", "P14D"));
  }

  @Test
  void darFormSchemaIsSeeded() {
    TaskFormSchema schema =
        SdkClients.adminClient().taskFormSchemas().getByName(DAR_FORM_SCHEMA_NAME);

    assertNotNull(schema, "DataAccessRequest form schema must be seeded on boot");
    assertEquals(TaskEntityType.DataAccessRequest.value(), schema.getTaskType());
    assertEquals(TaskCategory.DataAccess.value(), schema.getTaskCategory());
    assertNotNull(schema.getTransitionForms());
    assertTrue(
        schema.getTransitionForms().getAdditionalProperties().containsKey("approve"),
        "approve transition form must exist");
    assertTrue(
        schema.getTransitionForms().getAdditionalProperties().containsKey("reject"),
        "reject transition form must exist");
    assertTrue(
        schema.getTransitionForms().getAdditionalProperties().containsKey("revoke"),
        "revoke transition form must exist");
  }

  @Test
  void darWorkflowDefinitionIsSeeded() {
    WorkflowDefinition workflow =
        SdkClients.adminClient().workflowDefinitions().getByName(DAR_WORKFLOW_NAME);

    assertNotNull(workflow, "DataAccessRequestTaskWorkflow must be seeded on boot");
    List<String> nodeNames = workflow.getNodes().stream().map(n -> n.getName()).toList();
    assertTrue(nodeNames.contains("TaskReview"));
    assertTrue(nodeNames.contains("ApprovedAccess"));
    assertTrue(nodeNames.contains("RejectedEnd"));
    assertTrue(nodeNames.contains("RevokedEnd"));
  }

  @Test
  void createApproveAndRevokeLifecycle(TestNamespace ns) {
    String tableFqn = createTargetTable(ns);

    Task created =
        SdkClients.adminClient().tasks().create(buildDarRequest(ns, tableFqn, "FullAccess"));

    assertEquals(TaskEntityStatus.Open, created.getStatus());
    assertEquals("review", created.getWorkflowStageId());
    List<String> openTransitions =
        created.getAvailableTransitions().stream().map(TaskAvailableTransition::getId).toList();
    assertTrue(openTransitions.contains("approve"));
    assertTrue(openTransitions.contains("reject"));

    // Approve → moves to ApprovedAccess userTask. Status stays non-terminal so the workflow
    // can continue to a Revoke transition (matches IncidentResolution pattern).
    Task approved =
        SdkClients.adminClient()
            .tasks()
            .resolve(
                created.getId().toString(),
                new ResolveTask().withTransitionId("approve").withComment("approved"));

    assertEquals(TaskEntityStatus.InProgress, approved.getStatus());
    assertEquals("approved", approved.getWorkflowStageId());
    List<String> approvedTransitions =
        approved.getAvailableTransitions().stream().map(TaskAvailableTransition::getId).toList();
    assertEquals(List.of("revoke"), approvedTransitions);

    // Revoke → terminal Revoked status with resolution.
    Task revoked =
        SdkClients.adminClient()
            .tasks()
            .resolve(
                approved.getId().toString(),
                new ResolveTask().withTransitionId("revoke").withComment("revoking"));

    assertEquals(TaskEntityStatus.Revoked, revoked.getStatus());
    assertNotNull(revoked.getResolution());
    assertEquals(TaskResolutionType.Revoked, revoked.getResolution().getType());
    assertTrue(revoked.getAvailableTransitions().isEmpty());
  }

  @Test
  void rejectLandsAtTerminalRejectedStatus(TestNamespace ns) {
    String tableFqn = createTargetTable(ns);
    Task created =
        SdkClients.adminClient().tasks().create(buildDarRequest(ns, tableFqn, "ColumnLevel"));

    Task rejected =
        SdkClients.adminClient()
            .tasks()
            .resolve(
                created.getId().toString(),
                new ResolveTask().withTransitionId("reject").withComment("not justified"));

    assertEquals(TaskEntityStatus.Rejected, rejected.getStatus());
    assertEquals(TaskResolutionType.Rejected, rejected.getResolution().getType());
    assertFalse(rejected.getAvailableTransitions().stream().anyMatch(t -> "revoke".equals(t.getId())));
  }

  @Test
  void columnLevelPayloadStoresColumns(TestNamespace ns) {
    String tableFqn = createTargetTable(ns);

    CreateTask req =
        new CreateTask()
            .withName(ns.prefix("dar-cols"))
            .withCategory(TaskCategory.DataAccess)
            .withType(TaskEntityType.DataAccessRequest)
            .withAbout(tableFqn)
            .withAboutType("table")
            .withPayload(
                Map.of(
                    "accessType", "ColumnLevel",
                    "columns", List.of(tableFqn + ".id", tableFqn + ".name"),
                    "reason", "Need a couple of columns",
                    "duration", "P7D"));

    Task created = SdkClients.adminClient().tasks().create(req);

    Map<?, ?> payload = (Map<?, ?>) created.getPayload();
    assertEquals("ColumnLevel", payload.get("accessType"));
    assertEquals(2, ((List<?>) payload.get("columns")).size());
  }

  @Test
  void missingAccessTypeIsRejectedByFormSchema(TestNamespace ns) {
    String tableFqn = createTargetTable(ns);

    CreateTask invalid =
        new CreateTask()
            .withName(ns.prefix("dar-invalid"))
            .withCategory(TaskCategory.DataAccess)
            .withType(TaskEntityType.DataAccessRequest)
            .withAbout(tableFqn)
            .withAboutType("table")
            // accessType missing — required by both the JSON Schema payload
            // (dataAccessRequestPayload.json) and the seeded form schema.
            .withPayload(Map.of("reason", "I need it"));

    assertThrows(
        InvalidRequestException.class,
        () -> SdkClients.adminClient().tasks().create(invalid));
  }
}
