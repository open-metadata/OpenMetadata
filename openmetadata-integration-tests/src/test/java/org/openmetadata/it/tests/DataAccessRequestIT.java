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

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
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
 *   <li>Approve: /resolve transitions the task to status=Approved, stage="approved",
 *       captures approvedBy/approvedAt, and surfaces "markAsGranted" + "revoke" transitions.
 *   <li>Grant: /resolve with markAsGranted moves the task to status=Granted (active access).
 *   <li>Revoke: /resolve from either Approved or Granted closes the task with status=Revoked.
 *   <li>Reject: alternative terminal path lands at status=Rejected.
 *   <li>Validation: missing required fields (accessType/reason) are rejected by the form
 *       schema validator.
 *   <li>Policy: non-admin users can create DARs via the DataConsumerPolicy Create-task rule.
 *   <li>Filters: /v1/tasks/dataAccessRequests honors status/accessType/requestedBy/sortOrder.
 * </ul>
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class DataAccessRequestIT {

  private static final String DAR_FORM_SCHEMA_NAME = "DataAccessRequest";
  private static final String DAR_WORKFLOW_NAME = "DataAccessRequestTaskWorkflow";

  private static String createTargetTable(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema dbSchema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = TableTestFactory.createSimple(ns, dbSchema.getFullyQualifiedName());

    return table.getFullyQualifiedName();
  }

  private static String tableEntityLink(String tableFqn) {
    return String.format("<#E::table::%s>", tableFqn);
  }

  private static CreateTask buildDarRequest(TestNamespace ns, String tableFqn, String accessType) {
    return new CreateTask()
        .withName(ns.prefix("dar-task"))
        .withDisplayName("Test DAR")
        .withCategory(TaskCategory.DataAccess)
        .withType(TaskEntityType.DataAccessRequest)
        .withPriority(TaskPriority.Medium)
        .withAbout(tableEntityLink(tableFqn))
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
    assertTrue(nodeNames.contains("GrantedAccess"));
    assertTrue(nodeNames.contains("RejectedEnd"));
    assertTrue(nodeNames.contains("RevokedEnd"));
  }

  @Test
  void createApproveGrantRevokeLifecycle(TestNamespace ns) {
    String tableFqn = createTargetTable(ns);

    Task created =
        SdkClients.adminClient().tasks().create(buildDarRequest(ns, tableFqn, "FullAccess"));

    AtomicReference<Task> reviewTaskRef = new AtomicReference<>();
    await()
        .atMost(Duration.ofSeconds(20))
        .pollInterval(Duration.ofMillis(250))
        .untilAsserted(
            () -> {
              Task t =
                  SdkClients.adminClient()
                      .tasks()
                      .get(
                          created.getId().toString(),
                          "status,workflowStageId,availableTransitions");
              assertEquals(TaskEntityStatus.Open, t.getStatus());
              assertEquals("review", t.getWorkflowStageId());
              List<String> transitions =
                  t.getAvailableTransitions().stream().map(TaskAvailableTransition::getId).toList();
              assertTrue(transitions.contains("approve"));
              assertTrue(transitions.contains("reject"));
              reviewTaskRef.set(t);
            });

    Task reviewed = reviewTaskRef.get();

    // Approve → status=Approved (awaiting grant). approvedBy/approvedAt captured.
    // Available transitions: markAsGranted (provision) and revoke (back out).
    Task approved =
        SdkClients.adminClient()
            .tasks()
            .resolve(
                reviewed.getId().toString(),
                new ResolveTask().withTransitionId("approve").withComment("approved"));

    assertEquals(TaskEntityStatus.Approved, approved.getStatus());
    assertEquals("approved", approved.getWorkflowStageId());
    assertNotNull(approved.getApprovedBy(), "approvedBy must be captured on approve transition");
    assertNotNull(approved.getApprovedById());
    assertNotNull(approved.getApprovedAt());
    List<String> approvedTransitions =
        approved.getAvailableTransitions().stream().map(TaskAvailableTransition::getId).toList();
    assertTrue(approvedTransitions.contains("markAsGranted"));
    assertTrue(approvedTransitions.contains("revoke"));

    // Mark as granted → status=Granted (active access).
    Task granted =
        SdkClients.adminClient()
            .tasks()
            .resolve(
                approved.getId().toString(),
                new ResolveTask().withTransitionId("markAsGranted").withComment("provisioned"));

    assertEquals(TaskEntityStatus.Granted, granted.getStatus());
    assertEquals("granted", granted.getWorkflowStageId());
    // approvedBy must persist through the grant transition.
    assertEquals(approved.getApprovedById(), granted.getApprovedById());
    List<String> grantedTransitions =
        granted.getAvailableTransitions().stream().map(TaskAvailableTransition::getId).toList();
    assertEquals(List.of("revoke"), grantedTransitions);

    // Revoke from Granted → terminal Revoked status with resolution.
    Task revoked =
        SdkClients.adminClient()
            .tasks()
            .resolve(
                granted.getId().toString(),
                new ResolveTask().withTransitionId("revoke").withComment("revoking"));

    assertEquals(TaskEntityStatus.Revoked, revoked.getStatus());
    assertNotNull(revoked.getResolution());
    assertEquals(TaskResolutionType.Revoked, revoked.getResolution().getType());
    assertTrue(revoked.getAvailableTransitions().isEmpty());
  }

  @Test
  void approvedCanBeRevokedWithoutGranting(TestNamespace ns) {
    String tableFqn = createTargetTable(ns);
    Task created =
        SdkClients.adminClient().tasks().create(buildDarRequest(ns, tableFqn, "FullAccess"));

    Task approved =
        SdkClients.adminClient()
            .tasks()
            .resolve(
                created.getId().toString(),
                new ResolveTask().withTransitionId("approve").withComment("approved"));
    assertEquals(TaskEntityStatus.Approved, approved.getStatus());

    // Revoke directly from the Approved stage (admin backs out before granting).
    Task revoked =
        SdkClients.adminClient()
            .tasks()
            .resolve(
                approved.getId().toString(),
                new ResolveTask().withTransitionId("revoke").withComment("backing out"));

    assertEquals(TaskEntityStatus.Revoked, revoked.getStatus());
    assertEquals(TaskResolutionType.Revoked, revoked.getResolution().getType());
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
    assertFalse(
        rejected.getAvailableTransitions().stream().anyMatch(t -> "revoke".equals(t.getId())));
  }

  @Test
  void columnLevelPayloadStoresColumns(TestNamespace ns) {
    String tableFqn = createTargetTable(ns);

    CreateTask req =
        new CreateTask()
            .withName(ns.prefix("dar-cols"))
            .withCategory(TaskCategory.DataAccess)
            .withType(TaskEntityType.DataAccessRequest)
            .withAbout(tableEntityLink(tableFqn))
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
            .withAbout(tableEntityLink(tableFqn))
            // accessType missing — required by both the JSON Schema payload
            // (dataAccessRequestPayload.json) and the seeded form schema.
            .withPayload(Map.of("reason", "I need it"));

    assertThrows(
        InvalidRequestException.class, () -> SdkClients.adminClient().tasks().create(invalid));
  }

  @Test
  void nonAdminUserCanCreateDar(TestNamespace ns) {
    // DataConsumerPolicy grants Create on resource=task to every authenticated user, so a
    // non-admin user can file a DAR without an explicit role. Verifies the policy fix for the
    // "Principal: ... operations [Create] not allowed" failure when adam.matthews2-style users
    // tried to request access.
    String tableFqn = createTargetTable(ns);
    Task created =
        SdkClients.user1Client().tasks().create(buildDarRequest(ns, tableFqn, "FullAccess"));

    assertNotNull(created.getId());
    assertEquals(TaskCategory.DataAccess, created.getCategory());
    assertEquals(TaskEntityType.DataAccessRequest, created.getType());
  }

  @Test
  void darListEndpointFiltersByAccessTypeAndStatusAndSorts(TestNamespace ns) throws Exception {
    String tableFqn = createTargetTable(ns);

    Task openFull =
        SdkClients.adminClient().tasks().create(buildDarRequest(ns, tableFqn, "FullAccess"));
    Task openColumn =
        SdkClients.adminClient().tasks().create(buildDarRequest(ns, tableFqn, "ColumnLevel"));
    Task approvedFull =
        SdkClients.adminClient().tasks().create(buildDarRequest(ns, tableFqn, "FullAccess"));
    SdkClients.adminClient()
        .tasks()
        .resolve(
            approvedFull.getId().toString(),
            new ResolveTask().withTransitionId("approve").withComment("approved"));

    // Filter by dataset → all three DARs come back (newest first by default sort DESC on
    // createdAt).
    var byDataset =
        SdkClients.adminClient()
            .tasks()
            .listDataAccessRequests(Map.of("dataset", tableFqn, "limit", "50"));
    List<String> idsByDataset =
        byDataset.getData().stream().map(t -> t.getId().toString()).toList();
    assertTrue(idsByDataset.contains(openFull.getId().toString()));
    assertTrue(idsByDataset.contains(openColumn.getId().toString()));
    assertTrue(idsByDataset.contains(approvedFull.getId().toString()));

    // Filter by accessType=ColumnLevel → only the ColumnLevel DAR comes back.
    var byColumnAccess =
        SdkClients.adminClient()
            .tasks()
            .listDataAccessRequests(
                Map.of("dataset", tableFqn, "accessType", "ColumnLevel", "limit", "50"));
    List<String> columnIds =
        byColumnAccess.getData().stream().map(t -> t.getId().toString()).toList();
    assertTrue(columnIds.contains(openColumn.getId().toString()));
    assertFalse(columnIds.contains(openFull.getId().toString()));
    assertFalse(columnIds.contains(approvedFull.getId().toString()));

    // Filter by status=Approved → only the approved DAR comes back.
    var byApproved =
        SdkClients.adminClient()
            .tasks()
            .listDataAccessRequests(
                Map.of("dataset", tableFqn, "status", "Approved", "limit", "50"));
    List<String> approvedIds =
        byApproved.getData().stream().map(t -> t.getId().toString()).toList();
    assertEquals(List.of(approvedFull.getId().toString()), approvedIds);

    // sortOrder=asc → oldest first; reverse of default DESC. Both lists span the same scope.
    var ascending =
        SdkClients.adminClient()
            .tasks()
            .listDataAccessRequests(Map.of("dataset", tableFqn, "sortOrder", "asc", "limit", "50"));
    var descending =
        SdkClients.adminClient()
            .tasks()
            .listDataAccessRequests(
                Map.of("dataset", tableFqn, "sortOrder", "desc", "limit", "50"));
    List<String> ascIds = ascending.getData().stream().map(t -> t.getId().toString()).toList();
    List<String> descIds = descending.getData().stream().map(t -> t.getId().toString()).toList();
    assertEquals(ascIds.size(), descIds.size());
    // The first id of the ascending list is the last id of the descending list and vice versa.
    assertEquals(ascIds.get(0), descIds.get(descIds.size() - 1));
    assertEquals(ascIds.get(ascIds.size() - 1), descIds.get(0));
  }

  @Test
  void darListEndpointFiltersByApprover(TestNamespace ns) throws Exception {
    String tableFqn = createTargetTable(ns);
    Task created =
        SdkClients.adminClient().tasks().create(buildDarRequest(ns, tableFqn, "FullAccess"));
    Task approved =
        SdkClients.adminClient()
            .tasks()
            .resolve(
                created.getId().toString(),
                new ResolveTask().withTransitionId("approve").withComment("approved"));

    String approverId = approved.getApprovedById();
    assertNotNull(approverId, "approvedById must be captured on approve");

    var byApprover =
        SdkClients.adminClient()
            .tasks()
            .listDataAccessRequests(
                Map.of("dataset", tableFqn, "approverId", approverId, "limit", "50"));
    List<String> ids = byApprover.getData().stream().map(t -> t.getId().toString()).toList();
    assertTrue(ids.contains(approved.getId().toString()));
    // A DAR that was never approved by the same user must not appear.
    Task openDar =
        SdkClients.adminClient().tasks().create(buildDarRequest(ns, tableFqn, "FullAccess"));
    var byApproverAgain =
        SdkClients.adminClient()
            .tasks()
            .listDataAccessRequests(
                Map.of("dataset", tableFqn, "approverId", approverId, "limit", "50"));
    List<String> idsAgain =
        byApproverAgain.getData().stream().map(t -> t.getId().toString()).toList();
    assertFalse(idsAgain.contains(openDar.getId().toString()));
  }

  @Test
  void darListEndpointExcludesNonDarTaskTypes(TestNamespace ns) throws Exception {
    // Verifies that /v1/tasks/dataAccessRequests pre-scopes to category=DataAccess +
    // type=DataAccessRequest so non-DAR tasks (e.g. a description-update task) never appear.
    String tableFqn = createTargetTable(ns);

    Task dar = SdkClients.adminClient().tasks().create(buildDarRequest(ns, tableFqn, "FullAccess"));

    // Create a non-DAR task about the same entity.
    CreateTask nonDar =
        new CreateTask()
            .withName(ns.prefix("non-dar-task"))
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DescriptionUpdate)
            .withAbout(tableEntityLink(tableFqn))
            .withPayload(Map.of("newDescription", "test"));
    Task descTask = SdkClients.adminClient().tasks().create(nonDar);

    var listed =
        SdkClients.adminClient()
            .tasks()
            .listDataAccessRequests(Map.of("dataset", tableFqn, "limit", "50"));
    List<String> ids = listed.getData().stream().map(t -> t.getId().toString()).toList();
    assertTrue(ids.contains(dar.getId().toString()));
    assertFalse(ids.contains(descTask.getId().toString()));
  }

  @Test
  void darListEndpointSearchByDarSearchCondition(TestNamespace ns) throws Exception {
    // q matches case-insensitively against name/displayName/payload.reason/about.* — verify the
    // payload.reason path specifically, since that's what users typically search for.
    String tableFqn = createTargetTable(ns);

    CreateTask quarterly =
        new CreateTask()
            .withName(ns.prefix("dar-quarterly"))
            .withCategory(TaskCategory.DataAccess)
            .withType(TaskEntityType.DataAccessRequest)
            .withAbout(tableEntityLink(tableFqn))
            .withPayload(
                Map.of(
                    "accessType", "FullAccess",
                    "reason", "Quarterly compliance review",
                    "duration", "P14D"));
    Task qDar = SdkClients.adminClient().tasks().create(quarterly);
    Task otherDar =
        SdkClients.adminClient().tasks().create(buildDarRequest(ns, tableFqn, "FullAccess"));

    var matches =
        SdkClients.adminClient()
            .tasks()
            .listDataAccessRequests(Map.of("dataset", tableFqn, "q", "quarterly", "limit", "50"));
    List<String> ids = matches.getData().stream().map(t -> t.getId().toString()).toList();
    assertTrue(ids.contains(qDar.getId().toString()));
    assertFalse(ids.contains(otherDar.getId().toString()));
  }

  @Test
  void darListEndpointMultiSelectStatus(TestNamespace ns) throws Exception {
    // status=Approved,Granted exercises the comma-separated SQL IN(...) path.
    String tableFqn = createTargetTable(ns);

    Task openDar =
        SdkClients.adminClient().tasks().create(buildDarRequest(ns, tableFqn, "FullAccess"));

    Task approvedDar =
        SdkClients.adminClient().tasks().create(buildDarRequest(ns, tableFqn, "FullAccess"));
    SdkClients.adminClient()
        .tasks()
        .resolve(
            approvedDar.getId().toString(),
            new ResolveTask().withTransitionId("approve").withComment("approved"));

    Task grantedDar =
        SdkClients.adminClient().tasks().create(buildDarRequest(ns, tableFqn, "FullAccess"));
    SdkClients.adminClient()
        .tasks()
        .resolve(
            grantedDar.getId().toString(),
            new ResolveTask().withTransitionId("approve").withComment("approved"));
    SdkClients.adminClient()
        .tasks()
        .resolve(
            grantedDar.getId().toString(),
            new ResolveTask().withTransitionId("markAsGranted").withComment("granted"));

    var matches =
        SdkClients.adminClient()
            .tasks()
            .listDataAccessRequests(
                Map.of("dataset", tableFqn, "status", "Approved,Granted", "limit", "50"));
    List<String> ids = matches.getData().stream().map(t -> t.getId().toString()).toList();
    assertTrue(ids.contains(approvedDar.getId().toString()));
    assertTrue(ids.contains(grantedDar.getId().toString()));
    assertFalse(ids.contains(openDar.getId().toString()));
  }

  @Test
  void darListEndpointMultiSelectAccessType(TestNamespace ns) throws Exception {
    // accessType=FullAccess,Masked exercises the JSON_EXTRACT IN(...) path.
    String tableFqn = createTargetTable(ns);

    Task fullDar =
        SdkClients.adminClient().tasks().create(buildDarRequest(ns, tableFqn, "FullAccess"));
    Task maskedDar =
        SdkClients.adminClient().tasks().create(buildDarRequest(ns, tableFqn, "Masked"));
    Task columnLevelDar =
        SdkClients.adminClient().tasks().create(buildDarRequest(ns, tableFqn, "ColumnLevel"));

    var matches =
        SdkClients.adminClient()
            .tasks()
            .listDataAccessRequests(
                Map.of(
                    "dataset", tableFqn,
                    "accessType", "FullAccess,Masked",
                    "limit", "50"));
    List<String> ids = matches.getData().stream().map(t -> t.getId().toString()).toList();
    assertTrue(ids.contains(fullDar.getId().toString()));
    assertTrue(ids.contains(maskedDar.getId().toString()));
    assertFalse(ids.contains(columnLevelDar.getId().toString()));
  }

  @Test
  void darListEndpointAssigneeFilter(TestNamespace ns) throws Exception {
    // assignee=<userFqn> walks the entity_relationship + nameHash join already used by
    // /v1/tasks. Multi-value (comma-separated) hits the IN-list branch.
    String tableFqn = createTargetTable(ns);
    String assignee1 = SharedEntities.get().USER1.getFullyQualifiedName();
    String assignee2 = SharedEntities.get().USER2.getFullyQualifiedName();

    Task dar1 =
        SdkClients.adminClient()
            .tasks()
            .create(buildDarRequest(ns, tableFqn, "FullAccess").withAssignees(List.of(assignee1)));
    Task dar2 =
        SdkClients.adminClient()
            .tasks()
            .create(buildDarRequest(ns, tableFqn, "FullAccess").withAssignees(List.of(assignee2)));

    var singleAssignee =
        SdkClients.adminClient()
            .tasks()
            .listDataAccessRequests(
                Map.of("dataset", tableFqn, "assignee", assignee1, "limit", "50"));
    List<String> singleIds =
        singleAssignee.getData().stream().map(t -> t.getId().toString()).toList();
    assertTrue(singleIds.contains(dar1.getId().toString()));
    assertFalse(singleIds.contains(dar2.getId().toString()));

    var bothAssignees =
        SdkClients.adminClient()
            .tasks()
            .listDataAccessRequests(
                Map.of(
                    "dataset", tableFqn, "assignee", assignee1 + "," + assignee2, "limit", "50"));
    List<String> bothIds = bothAssignees.getData().stream().map(t -> t.getId().toString()).toList();
    assertTrue(bothIds.contains(dar1.getId().toString()));
    assertTrue(bothIds.contains(dar2.getId().toString()));
  }
}
