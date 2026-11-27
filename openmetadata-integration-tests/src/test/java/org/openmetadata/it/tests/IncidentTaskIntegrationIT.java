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

package org.openmetadata.it.tests;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.tasks.IncidentWorkflowStages.RESOLVED_STAGE_ID;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.tasks.Payload;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.Assigned;
import org.openmetadata.schema.tests.type.Resolved;
import org.openmetadata.schema.tests.type.Severity;
import org.openmetadata.schema.tests.type.TestCaseFailureReasonType;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskComment;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskPriority;
import org.openmetadata.schema.type.TaskResolution;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.type.TestCaseResolutionPayload;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TaskRepository;

/**
 * Integration tests for task-first incident workflow.
 *
 * <p>In this branch a failed test result creates a workflow-managed incident task immediately in
 * the {@code new} stage. Incident lifecycle changes are then driven via {@code /tasks/{id}/resolve}
 * and mirrored back into the legacy TestCaseResolutionStatus timeline for backward-compatible
 * consumers.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IncidentTaskIntegrationIT {

  private static final Duration TASK_TIMEOUT = Duration.ofSeconds(20);

  @BeforeAll
  static void setup() {
    SharedEntities.get();
  }

  @Test
  void testIncidentCreation_CreatesWorkflowManagedTask(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    TestCase testCase = createTestCase(client, ns, "incident-create");
    createFailedTestResult(client, testCase);

    Task task = awaitIncidentTaskForTestCase(client, testCase);

    assertEquals(TaskCategory.Incident, task.getCategory());
    assertEquals(TaskEntityType.TestCaseResolution, task.getType());
    assertEquals(TaskEntityStatus.Open, task.getStatus());
    assertEquals("new", task.getWorkflowStageId());
    assertNotNull(task.getWorkflowInstanceId());
    assertNotNull(task.getAbout());
    assertEquals(testCase.getFullyQualifiedName(), task.getAbout().getFullyQualifiedName());

    TestCaseResolutionPayload payload =
        JsonUtils.convertValue(task.getPayload(), TestCaseResolutionPayload.class);
    assertEquals(task.getId(), payload.getTestCaseResolutionStatusId());
    assertLatestTcrsEventually(client, task.getId(), TestCaseResolutionStatusTypes.New, null);
  }

  @Test
  void testPatch_PreservesComments(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    TestCase testCase = createTestCase(client, ns, "incident-comment-patch");
    createFailedTestResult(client, testCase);
    Task task = awaitIncidentTaskForTestCase(client, testCase);

    client.tasks().addComment(task.getId().toString(), "keep me across a patch");

    // A generic PATCH that does not touch comments must not drop them (they live in the task JSON).
    JsonNode patch =
        JsonUtils.readTree(
            "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"investigating\"}]");
    client.tasks().patch(task.getId().toString(), patch);

    Task afterPatch = client.tasks().get(task.getId().toString(), "comments");
    assertNotNull(afterPatch.getComments(), "comments must not be dropped by a task patch");
    assertEquals(1, afterPatch.getComments().size(), "the comment must survive the patch");
    assertEquals("keep me across a patch", afterPatch.getComments().get(0).getMessage());
  }

  @Test
  void testAppendingCommentKeepsEditsMadeAfterTaskWasLoaded(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    TestCase testCase = createTestCase(client, ns, "incident-comment-stale-task");
    createFailedTestResult(client, testCase);
    Task staleTask = awaitIncidentTaskForTestCase(client, testCase);
    String taskId = staleTask.getId().toString();
    TaskRepository repository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);

    client.tasks().addComment(taskId, "Concurrent note");
    client
        .tasks()
        .patch(
            taskId,
            JsonUtils.readTree(
                "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"Updated description\"}]"));
    repository.addComment(
        staleTask,
        new TaskComment()
            .withId(UUID.randomUUID())
            .withAuthor(staleTask.getCreatedBy())
            .withCreatedAt(System.currentTimeMillis())
            .withMessage("Resolution note"));

    Task stored = client.tasks().get(taskId, "comments");
    assertEquals("Updated description", stored.getDescription());
    assertEquals(2, stored.getCommentCount());
    assertEquals(
        List.of("Concurrent note", "Resolution note"),
        stored.getComments().stream().map(TaskComment::getMessage).toList());
  }

  @ParameterizedTest
  @CsvSource({"edit", "delete"})
  void testCommentMutationKeepsResolutionSavedAfterTaskWasLoaded(
      String operation, TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    TestCase testCase = createTestCase(client, ns, "incident-resolve-comment-" + operation);
    createFailedTestResult(client, testCase);
    Task incident = awaitIncidentTaskForTestCase(client, testCase);
    String taskId = incident.getId().toString();
    client.tasks().addComment(taskId, "Investigation note");
    Task staleTask = client.tasks().get(taskId, "comments");
    TaskComment note = staleTask.getComments().getFirst();

    client
        .tasks()
        .resolve(
            taskId,
            new ResolveTask()
                .withTransitionId("resolve")
                .withResolutionType(TaskResolutionType.Completed)
                .withComment("Resolution note")
                .withPayload(
                    resolutionPayload(
                        "Other", "Resolution note", TestCaseFailureReasonType.Other)));

    TaskRepository repository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    if (operation.equals("edit")) {
      repository.editComment(staleTask, note.getId(), "Edited note", note.getAuthor().getName());
    } else {
      repository.deleteComment(staleTask, note.getId(), note.getAuthor().getName(), false);
    }

    Task stored = client.tasks().get(taskId, "comments,resolution");
    assertEquals(TaskEntityStatus.Completed, stored.getStatus());
    assertEquals("Resolution note", stored.getResolution().getComment());
    List<String> expected =
        operation.equals("edit")
            ? List.of("Edited note", "Resolution note")
            : List.of("Resolution note");
    assertEquals(expected.size(), stored.getCommentCount());
    assertEquals(expected, stored.getComments().stream().map(TaskComment::getMessage).toList());
  }

  @Test
  void testFullIncidentWorkflow_TaskTransitionsMirrorTcrs(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    SharedEntities shared = SharedEntities.get();

    TestCase testCase = createTestCase(client, ns, "incident-full");
    createFailedTestResult(client, testCase);

    Task task = awaitIncidentTaskForTestCase(client, testCase);
    UUID stateId = task.getId();

    client.tasks().resolve(stateId.toString(), new ResolveTask().withTransitionId("ack"));
    Task ackedTask = awaitIncidentTask(client, stateId, TaskEntityStatus.InProgress, "ack", null);
    assertLatestTcrsEventually(client, stateId, TestCaseResolutionStatusTypes.Ack, null);

    client
        .tasks()
        .resolve(
            stateId.toString(),
            new ResolveTask()
                .withTransitionId("assign")
                .withPayload(assigneePayload(shared.USER1_REF)));
    Task assignedTask =
        awaitIncidentTask(
            client, stateId, TaskEntityStatus.InProgress, "assigned", shared.USER1.getName());
    assertEquals(ackedTask.getId(), assignedTask.getId());
    assertLatestTcrsEventually(
        client, stateId, TestCaseResolutionStatusTypes.Assigned, shared.USER1.getName());

    client
        .tasks()
        .resolve(
            stateId.toString(),
            new ResolveTask()
                .withTransitionId("resolve")
                .withResolutionType(TaskResolutionType.Completed)
                .withComment("Resolved via integration test")
                .withPayload(
                    resolutionPayload(
                        "False positive",
                        "Resolved via integration test",
                        TestCaseFailureReasonType.FalsePositive)));

    Task completedTask =
        awaitIncidentTask(client, stateId, TaskEntityStatus.Completed, "resolved", null);
    assertNotNull(completedTask.getResolution());
    assertEquals(
        assignedTask.getAssignees().stream().map(EntityReference::getId).toList(),
        completedTask.getAssignees().stream().map(EntityReference::getId).toList());
    assertEquals(List.of(shared.USER1.getName()), assignedAssigneeNames(client, stateId));
    await()
        .atMost(TASK_TIMEOUT)
        .untilAsserted(
            () -> {
              TestCaseResolutionStatus latest = tcrsTimeline(client, stateId).getLast();
              assertEquals(
                  TestCaseResolutionStatusTypes.Resolved, latest.getTestCaseResolutionStatusType());
              Resolved details =
                  JsonUtils.convertValue(
                      latest.getTestCaseResolutionStatusDetails(), Resolved.class);
              assertEquals(shared.USER1.getId(), details.getAssignee().getId());
              assertEquals(
                  completedTask.getResolution().getResolvedBy().getId(),
                  details.getResolvedBy().getId());
            });
    Task withComments = client.tasks().get(stateId.toString(), "comments");
    assertEquals(1, withComments.getComments().size());
    assertEquals(
        "Resolved via integration test", withComments.getComments().getFirst().getMessage());
  }

  @Test
  void testDirectAssignment_NewToAssigned(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    SharedEntities shared = SharedEntities.get();

    TestCase testCase = createTestCase(client, ns, "incident-assign");
    createFailedTestResult(client, testCase);

    Task task = awaitIncidentTaskForTestCase(client, testCase);

    client
        .tasks()
        .resolve(
            task.getId().toString(),
            new ResolveTask()
                .withTransitionId("assign")
                .withPayload(assigneePayload(shared.USER2_REF)));

    Task assignedTask =
        awaitIncidentTask(
            client, task.getId(), TaskEntityStatus.InProgress, "assigned", shared.USER2.getName());
    assertEquals(task.getId(), assignedTask.getId());
    assertLatestTcrsEventually(
        client, task.getId(), TestCaseResolutionStatusTypes.Assigned, shared.USER2.getName());
  }

  @Test
  void testReassignment_AssignedToAssigned(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    SharedEntities shared = SharedEntities.get();

    TestCase testCase = createTestCase(client, ns, "incident-reassign");
    createFailedTestResult(client, testCase);

    Task task = awaitIncidentTaskForTestCase(client, testCase);

    client
        .tasks()
        .resolve(
            task.getId().toString(),
            new ResolveTask()
                .withTransitionId("assign")
                .withPayload(assigneePayload(shared.USER1_REF)));
    awaitIncidentTask(
        client, task.getId(), TaskEntityStatus.InProgress, "assigned", shared.USER1.getName());

    client
        .tasks()
        .resolve(
            task.getId().toString(),
            new ResolveTask()
                .withTransitionId("reassign")
                .withPayload(assigneePayload(shared.USER2_REF)));

    Task reassignedTask =
        awaitIncidentTask(
            client, task.getId(), TaskEntityStatus.InProgress, "assigned", shared.USER2.getName());
    assertEquals(task.getId(), reassignedTask.getId());

    // Reassign is a self-loop on the `assigned` stage, so the mirror has to follow the
    // assignee rather than the stage.
    assertLatestTcrsEventually(
        client, task.getId(), TestCaseResolutionStatusTypes.Assigned, shared.USER2.getName());
    assertEquals(
        List.of(shared.USER1.getName(), shared.USER2.getName()),
        assignedAssigneeNames(client, task.getId()),
        "every assignment appends its own record");
  }

  @Test
  void testPriorityRaisedOnTheTaskSurvivesAssignment(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    SharedEntities shared = SharedEntities.get();
    TestCase testCase = createTestCase(client, ns, "incident-priority");
    createFailedTestResult(client, testCase);
    Task task = awaitIncidentTaskForTestCase(client, testCase);
    assertEquals(TaskPriority.Medium, task.getPriority());

    client
        .tasks()
        .patch(
            task.getId().toString(),
            JsonUtils.readTree("[{\"op\":\"replace\",\"path\":\"/priority\",\"value\":\"High\"}]"));
    client
        .tasks()
        .resolve(
            task.getId().toString(),
            new ResolveTask()
                .withTransitionId("assign")
                .withPayload(assigneePayload(shared.USER1_REF)));

    Task assigned =
        awaitIncidentTask(
            client, task.getId(), TaskEntityStatus.InProgress, "assigned", shared.USER1.getName());
    assertEquals(TaskPriority.High, assigned.getPriority());
  }

  @Test
  void testDescriptionAndDisplayNameEditedOnTheTaskSurviveAssignment(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    SharedEntities shared = SharedEntities.get();
    TestCase testCase = createTestCase(client, ns, "incident-edited-text");
    createFailedTestResult(client, testCase);
    Task task = awaitIncidentTaskForTestCase(client, testCase);

    client
        .tasks()
        .patch(
            task.getId().toString(),
            JsonUtils.valueToTree(
                List.of(
                    Map.of("op", "replace", "path", "/description", "value", "investigating"),
                    Map.of("op", "add", "path", "/displayName", "value", "Renamed incident"))));
    client
        .tasks()
        .resolve(
            task.getId().toString(),
            new ResolveTask()
                .withTransitionId("assign")
                .withPayload(assigneePayload(shared.USER1_REF)));

    Task assigned =
        awaitIncidentTask(
            client, task.getId(), TaskEntityStatus.InProgress, "assigned", shared.USER1.getName());
    assertAll(
        () -> assertEquals("investigating", assigned.getDescription()),
        () -> assertEquals("Renamed incident", assigned.getDisplayName()));
  }

  @Test
  void testUpdatesThatDoNotChangeTheMirror_AppendNothing(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    SharedEntities shared = SharedEntities.get();

    TestCase testCase = createTestCase(client, ns, "incident-no-op-update");
    createFailedTestResult(client, testCase);

    Task task = awaitIncidentTaskForTestCase(client, testCase);
    UUID stateId = task.getId();

    client
        .tasks()
        .resolve(
            stateId.toString(),
            new ResolveTask()
                .withTransitionId("assign")
                .withPayload(assigneePayload(shared.USER1_REF)));
    awaitIncidentTask(
        client, stateId, TaskEntityStatus.InProgress, "assigned", shared.USER1.getName());
    assertLatestTcrsEventually(
        client, stateId, TestCaseResolutionStatusTypes.Assigned, shared.USER1.getName());

    int recordsAfterAssign = tcrsTimeline(client, stateId).size();

    client.tasks().addComment(stateId.toString(), "still investigating");
    client
        .tasks()
        .patch(
            stateId.toString(),
            JsonUtils.readTree(
                "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"no mirror change\"}]"));

    assertEquals(
        recordsAfterAssign,
        tcrsTimeline(client, stateId).size(),
        "comments and unrelated patches must not append TCRS records");

    client
        .tasks()
        .resolve(
            stateId.toString(),
            new ResolveTask()
                .withTransitionId("resolve")
                .withResolutionType(TaskResolutionType.Completed)
                .withComment("Resolved via integration test")
                .withPayload(
                    resolutionPayload(
                        "False positive",
                        "Resolved via integration test",
                        TestCaseFailureReasonType.FalsePositive)));
    awaitIncidentTask(client, stateId, TaskEntityStatus.Completed, "resolved", null);
    assertLatestTcrsEventually(client, stateId, TestCaseResolutionStatusTypes.Resolved, null);

    int recordsAfterResolve = tcrsTimeline(client, stateId).size();
    assertEquals(
        recordsAfterAssign + 1, recordsAfterResolve, "resolving appends exactly one record");

    client.tasks().addComment(stateId.toString(), "post-mortem note");
    assertEquals(
        recordsAfterResolve,
        tcrsTimeline(client, stateId).size(),
        "commenting on a resolved incident must not duplicate the Resolved record");

    JsonNode reassignment =
        JsonUtils.valueToTree(
            List.of(
                Map.of("op", "replace", "path", "/assignees", "value", List.of(shared.USER2_REF))));
    client.tasks().patch(stateId.toString(), reassignment);
    Task reassigned = client.tasks().get(stateId.toString(), "assignees");
    assertEquals(shared.USER2.getId(), reassigned.getAssignees().getFirst().getId());

    List<TestCaseResolutionStatus> history = tcrsTimeline(client, stateId);
    assertEquals(recordsAfterResolve, history.size(), "the resolution is a historical snapshot");
    Resolved details =
        JsonUtils.convertValue(
            history.getLast().getTestCaseResolutionStatusDetails(), Resolved.class);
    assertEquals(shared.USER1.getId(), details.getAssignee().getId());
  }

  @Test
  void testResolutionCommentFailure_RollsBackResolution(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    TestCase testCase = createTestCase(client, ns, "resolution-comment-rollback");
    createFailedTestResult(client, testCase);
    Task task = awaitIncidentTaskForTestCase(client, testCase);
    TaskRepository repository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    // The lifecycle JSON accepts the note; the comment's mention write rejects its invalid FQN.
    String invalidMention = "<#E::table::broken..name>";
    TaskResolution resolution =
        new TaskResolution()
            .withType(TaskResolutionType.Completed)
            .withComment(invalidMention)
            .withResolvedBy(task.getCreatedBy())
            .withResolvedAt(System.currentTimeMillis());

    assertThrows(
        IllegalArgumentException.class, () -> repository.resolveTask(task, resolution, "admin"));

    Task unchanged = client.tasks().get(task.getId().toString(), "resolution,comments");
    assertEquals(TaskEntityStatus.Open, unchanged.getStatus());
    assertNull(unchanged.getResolution());
    assertEquals(task.getVersion(), unchanged.getVersion());
    resolution.setComment("Resolution note");
    Task retried = repository.resolveTask(unchanged, resolution, "admin");
    assertEquals(TaskEntityStatus.Completed, retried.getStatus());
    assertEquals("Resolution note", retried.getComments().getLast().getMessage());
  }

  @Test
  void testDeletingResolvedAssignee_DoesNotChangeNewIncident(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String name = ns.shortPrefix("former-assignee");
    User assignee =
        client.users().create(new CreateUser().withName(name).withEmail(name + "@example.com"));
    TestCase testCase = createTestCase(client, ns, "deleted-resolved-assignee");
    createFailedTestResult(client, testCase);
    Task first = awaitIncidentTaskForTestCase(client, testCase);
    client
        .tasks()
        .resolve(
            first.getId().toString(),
            new ResolveTask()
                .withTransitionId("assign")
                .withPayload(assigneePayload(assignee.getEntityReference())));
    awaitIncidentTask(client, first.getId(), TaskEntityStatus.InProgress, "assigned", name);
    client
        .tasks()
        .resolve(
            first.getId().toString(),
            new ResolveTask()
                .withTransitionId("resolve")
                .withResolutionType(TaskResolutionType.Completed)
                .withComment("Fixed")
                .withPayload(
                    resolutionPayload("Fixed", "Fixed", TestCaseFailureReasonType.FalsePositive)));
    awaitIncidentTask(client, first.getId(), TaskEntityStatus.Completed, "resolved", null);
    assertLatestTcrsEventually(client, first.getId(), TestCaseResolutionStatusTypes.Resolved, null);
    createFailedTestResult(client, testCase);
    Task second = awaitIncidentTaskForTestCase(client, testCase);
    assertNotEquals(first.getId(), second.getId());
    List<TestCaseResolutionStatus> before = tcrsTimeline(client, second.getId());

    client.users().delete(assignee.getId().toString());

    Task stillOpen = client.tasks().get(second.getId().toString());
    assertEquals(TaskEntityStatus.Open, stillOpen.getStatus());
    assertEquals("new", stillOpen.getWorkflowStageId());
    assertEquals(
        second.getId(),
        client.testCases().get(testCase.getId().toString(), "incidentId").getIncidentId());
    assertEquals(before, tcrsTimeline(client, second.getId()));
    assertEquals(
        TestCaseResolutionStatusTypes.Resolved,
        tcrsTimeline(client, first.getId()).getLast().getTestCaseResolutionStatusType());
  }

  @Test
  void testDirectResolution_NewToResolved_CompletesExistingTask(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    TestCase testCase = createTestCase(client, ns, "incident-direct-resolve");
    createFailedTestResult(client, testCase);

    Task task = awaitIncidentTaskForTestCase(client, testCase);

    client
        .tasks()
        .resolve(
            task.getId().toString(),
            new ResolveTask()
                .withTransitionId("resolve")
                .withResolutionType(TaskResolutionType.Completed)
                .withComment("Direct resolution")
                .withPayload(
                    resolutionPayload(
                        "Resolved directly",
                        "Direct resolution",
                        TestCaseFailureReasonType.FalsePositive)));

    Task completedTask =
        awaitIncidentTask(client, task.getId(), TaskEntityStatus.Completed, "resolved", null);
    assertEquals(task.getId(), completedTask.getId());
    assertTrue(completedTask.getAssignees() == null || completedTask.getAssignees().isEmpty());
    assertLatestTcrsEventually(client, task.getId(), TestCaseResolutionStatusTypes.Resolved, null);
    Resolved details =
        JsonUtils.convertValue(
            tcrsTimeline(client, task.getId()).getLast().getTestCaseResolutionStatusDetails(),
            Resolved.class);
    assertNull(details.getAssignee());
    assertNotNull(details.getResolvedBy());
    assertTrue(assignedAssigneeNames(client, task.getId()).isEmpty());
  }

  @Test
  void testTaskPayload_ContainsStateId(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    TestCase testCase = createTestCase(client, ns, "incident-payload");
    createFailedTestResult(client, testCase);

    Task task = awaitIncidentTaskForTestCase(client, testCase);
    assertNotNull(task.getPayload());

    TestCaseResolutionPayload payload =
        JsonUtils.convertValue(task.getPayload(), TestCaseResolutionPayload.class);

    assertNotNull(payload.getTestCaseResolutionStatusId());
    assertEquals(task.getId(), payload.getTestCaseResolutionStatusId());
  }

  @Test
  void testMultipleIncidents_IndependentTasks(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    TestCase testCase1 = createTestCase(client, ns, "incident-one");
    TestCase testCase2 = createTestCase(client, ns, "incident-two");

    createFailedTestResult(client, testCase1);
    createFailedTestResult(client, testCase2);

    Task task1 = awaitIncidentTaskForTestCase(client, testCase1);
    Task task2 = awaitIncidentTaskForTestCase(client, testCase2);

    assertNotEquals(task1.getId(), task2.getId(), "Each incident should have a separate task");

    TestCaseResolutionPayload payload1 =
        JsonUtils.convertValue(task1.getPayload(), TestCaseResolutionPayload.class);
    TestCaseResolutionPayload payload2 =
        JsonUtils.convertValue(task2.getPayload(), TestCaseResolutionPayload.class);

    assertEquals(task1.getId(), payload1.getTestCaseResolutionStatusId());
    assertEquals(task2.getId(), payload2.getTestCaseResolutionStatusId());
    assertNotEquals(
        payload1.getTestCaseResolutionStatusId(), payload2.getTestCaseResolutionStatusId());
  }

  @Test
  void testIncidentTaskListByCategory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    TestCase testCase = createTestCase(client, ns, "incident-list");
    createFailedTestResult(client, testCase);

    Task task = awaitIncidentTaskForTestCase(client, testCase);

    ListParams params =
        new ListParams().addFilter("category", "Incident").setFields("payload,about").setLimit(100);
    ListResponse<Task> incidentTasks = client.tasks().list(params);

    assertNotNull(incidentTasks);
    assertFalse(incidentTasks.getData().isEmpty());

    Task ourTask =
        incidentTasks.getData().stream()
            .filter(candidate -> task.getId().equals(candidate.getId()))
            .findFirst()
            .orElse(null);

    assertNotNull(ourTask, "Our incident task should be in the list");
    assertEquals(TaskCategory.Incident, ourTask.getCategory());
  }

  @Test
  void testResolvedIncident_TaskApiCannotReopenIt(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    TestCase testCase = createTestCase(client, ns, "incident-final-task-api");
    createFailedTestResult(client, testCase);
    Task task = awaitIncidentTaskForTestCase(client, testCase);
    resolveIncidentTask(client, task.getId());
    Task resolved =
        awaitIncidentTask(client, task.getId(), TaskEntityStatus.Completed, "resolved", null);

    JsonNode patch =
        JsonUtils.readTree("[{\"op\":\"replace\",\"path\":\"/status\",\"value\":\"Open\"}]");
    assertThrows(
        OpenMetadataException.class, () -> client.tasks().patch(task.getId().toString(), patch));
    assertThrows(
        OpenMetadataException.class,
        () ->
            client
                .tasks()
                .resolve(task.getId().toString(), new ResolveTask().withTransitionId("new")));
    TaskRepository repository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    assertThrows(
        IllegalArgumentException.class,
        () -> repository.reopenTask(resolved, Entity.ADMIN_USER_NAME));
    awaitIncidentTask(client, task.getId(), TaskEntityStatus.Completed, "resolved", null);
    assertLatestTcrsEventually(client, task.getId(), TestCaseResolutionStatusTypes.Resolved, null);
    assertEquals(1, countIncidentTasksForTestCase(client, testCase));
  }

  @Test
  void testResolvedIncident_AckIsRejectedAndStaysResolved(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    TestCase testCase = createTestCase(client, ns, "incident-final-ack");
    createFailedTestResult(client, testCase);
    Task task = awaitIncidentTaskForTestCase(client, testCase);
    UUID stateId = task.getId();

    resolveIncidentTask(client, stateId);
    awaitIncidentTask(client, stateId, TaskEntityStatus.Completed, "resolved", null);

    assertThrows(
        OpenMetadataException.class,
        () -> createTcrs(client, testCase, TestCaseResolutionStatusTypes.Ack, null));

    awaitIncidentTask(client, stateId, TaskEntityStatus.Completed, "resolved", null);
    awaitTestCaseIncidentId(client, testCase, null);
    assertEquals(
        1,
        countIncidentTasksForTestCase(client, testCase),
        "a rejected reopen must not mint or reopen a task");
  }

  @Test
  void testResolvedIncident_NewIsRejectedWithoutAnIncidentRecord(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    TestCase testCase = createTestCase(client, ns, "incident-final-new");
    createFailedTestResult(client, testCase);
    Task task = awaitIncidentTaskForTestCase(client, testCase);
    UUID stateId = task.getId();

    resolveIncidentTask(client, stateId);
    awaitIncidentTask(client, stateId, TaskEntityStatus.Completed, "resolved", null);

    assertThrows(
        OpenMetadataException.class,
        () -> createTcrs(client, testCase, TestCaseResolutionStatusTypes.New, null));

    awaitTestCaseIncidentId(client, testCase, null);
    assertEquals(
        1,
        countIncidentTasksForTestCase(client, testCase),
        "a rejected New must not open an incident beside the resolved one");
  }

  @Test
  void testResolvedIncident_AssignedIsRejectedAndStaysResolved(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    SharedEntities shared = SharedEntities.get();

    TestCase testCase = createTestCase(client, ns, "incident-final-assign");
    createFailedTestResult(client, testCase);
    Task task = awaitIncidentTaskForTestCase(client, testCase);
    UUID stateId = task.getId();

    resolveIncidentTask(client, stateId);
    awaitIncidentTask(client, stateId, TaskEntityStatus.Completed, "resolved", null);

    assertThrows(
        OpenMetadataException.class,
        () ->
            createTcrs(
                client,
                testCase,
                TestCaseResolutionStatusTypes.Assigned,
                new Assigned().withAssignee(shared.USER1_REF)));

    awaitIncidentTask(client, stateId, TaskEntityStatus.Completed, "resolved", null);
    assertEquals(
        1,
        countIncidentTasksForTestCase(client, testCase),
        "a rejected reopen must not mint or reopen a task");
  }

  @Test
  void testOpenIncident_AckReturnsToNewOnTheSameTask(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    TestCase testCase = createTestCase(client, ns, "incident-ack-to-new");
    createFailedTestResult(client, testCase);
    Task task = awaitIncidentTaskForTestCase(client, testCase);
    UUID stateId = task.getId();

    createTcrs(client, testCase, TestCaseResolutionStatusTypes.Ack, null);
    awaitIncidentTask(client, stateId, TaskEntityStatus.InProgress, "ack", null);

    createTcrs(client, testCase, TestCaseResolutionStatusTypes.New, null);
    Task backAtNew = awaitIncidentTask(client, stateId, TaskEntityStatus.Open, "new", null);

    assertEquals(stateId, backAtNew.getId(), "returning to New must keep the same incident task");
    assertLatestTcrsEventually(client, stateId, TestCaseResolutionStatusTypes.New, null);
    awaitTestCaseIncidentId(client, testCase, stateId);
    assertEquals(
        1,
        countIncidentTasksForTestCase(client, testCase),
        "returning to New must not mint a second incident task");
  }

  @Test
  void testAssignedIncident_ReturnsToNewAndDropsItsAssignee(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    SharedEntities shared = SharedEntities.get();

    TestCase testCase = createTestCase(client, ns, "incident-assigned-to-new");
    createFailedTestResult(client, testCase);
    Task task = awaitIncidentTaskForTestCase(client, testCase);
    UUID stateId = task.getId();

    createTcrs(
        client,
        testCase,
        TestCaseResolutionStatusTypes.Assigned,
        new Assigned().withAssignee(shared.USER1_REF));
    awaitIncidentTask(
        client, stateId, TaskEntityStatus.InProgress, "assigned", shared.USER1.getName());

    createTcrs(client, testCase, TestCaseResolutionStatusTypes.New, null);
    Task backAtNew = awaitIncidentTask(client, stateId, TaskEntityStatus.Open, "new", null);

    assertFalse(
        backAtNew.getAssignees() != null
            && backAtNew.getAssignees().stream()
                .anyMatch(assignee -> shared.USER1.getId().equals(assignee.getId())),
        "returning to New must drop the incident assignee");
    assertLatestTcrsEventually(client, stateId, TestCaseResolutionStatusTypes.New, null);
    assertEquals(
        1,
        countIncidentTasksForTestCase(client, testCase),
        "returning to New must not mint a second incident task");
  }

  @Test
  void testTaskApi_ReturnToNewDropsManualAssignee(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    SharedEntities shared = SharedEntities.get();
    TestCase testCase = createTestCase(client, ns, "task-api-return-new");
    createFailedTestResult(client, testCase);
    Task task = awaitIncidentTaskForTestCase(client, testCase);
    client
        .tasks()
        .resolve(
            task.getId().toString(),
            new ResolveTask()
                .withTransitionId("assign")
                .withPayload(assigneePayload(shared.USER1_REF)));
    awaitIncidentTask(
        client, task.getId(), TaskEntityStatus.InProgress, "assigned", shared.USER1.getName());

    client.tasks().resolve(task.getId().toString(), new ResolveTask().withTransitionId("new"));

    Task returned = awaitIncidentTask(client, task.getId(), TaskEntityStatus.Open, "new", null);
    assertTrue(returned.getAssignees() == null || returned.getAssignees().isEmpty());
    assertLatestTcrsEventually(client, task.getId(), TestCaseResolutionStatusTypes.New, null);
    client.tasks().resolve(task.getId().toString(), new ResolveTask().withTransitionId("ack"));
    Task acknowledged =
        awaitIncidentTask(client, task.getId(), TaskEntityStatus.InProgress, "ack", null);
    assertTrue(
        acknowledged.getAssignees() == null || acknowledged.getAssignees().isEmpty(),
        "a later stage must not restore the old process assignees");
  }

  @ParameterizedTest
  @CsvSource({"task,New", "task,Ack", "status,New", "status,Ack", "bulk,New", "bulk,Ack"})
  void testAssignedIncident_ReturnsUnassignedWithHistory(
      String api, TestCaseResolutionStatusTypes target, TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    SharedEntities shared = SharedEntities.get();
    TestCase testCase = createTestCase(client, ns, "assigned-return-" + api + target);
    createFailedTestResult(client, testCase);
    Task task = awaitIncidentTaskForTestCase(client, testCase);
    createTcrs(
        client,
        testCase,
        TestCaseResolutionStatusTypes.Assigned,
        new Assigned().withAssignee(shared.USER1_REF));
    awaitIncidentTask(
        client, task.getId(), TaskEntityStatus.InProgress, "assigned", shared.USER1.getName());
    assertLatestTcrsEventually(
        client, task.getId(), TestCaseResolutionStatusTypes.Assigned, shared.USER1.getName());
    List<TestCaseResolutionStatus> assignedHistory = tcrsTimeline(client, task.getId());
    CreateTestCaseResolutionStatus statusChange =
        new CreateTestCaseResolutionStatus()
            .withTestCaseReference(testCase.getFullyQualifiedName())
            .withTestCaseResolutionStatusType(target);
    String targetStage = target == TestCaseResolutionStatusTypes.New ? "new" : "ack";

    switch (api) {
      case "task" -> client
          .tasks()
          .resolve(task.getId().toString(), new ResolveTask().withTransitionId(targetStage));
      case "status" -> client.testCaseResolutionStatuses().create(statusChange);
      case "bulk" -> assertEquals(
          1,
          client
              .testCaseResolutionStatuses()
              .bulkCreate(List.of(statusChange))
              .getNumberOfRowsPassed());
      default -> throw new IllegalArgumentException(api);
    }

    Task returned =
        awaitIncidentTask(
            client,
            task.getId(),
            target == TestCaseResolutionStatusTypes.New
                ? TaskEntityStatus.Open
                : TaskEntityStatus.InProgress,
            targetStage,
            null);
    assertEquals(task.getId(), returned.getId());
    assertTrue(returned.getAssignees() == null || returned.getAssignees().isEmpty());
    assertLatestTcrsEventually(client, task.getId(), target, null);
    List<TestCaseResolutionStatus> returnedHistory = tcrsTimeline(client, task.getId());
    assertEquals(assignedHistory.size() + 1, returnedHistory.size());
    assertEquals(assignedHistory, returnedHistory.subList(0, assignedHistory.size()));
    assertEquals(target, returnedHistory.getLast().getTestCaseResolutionStatusType());
    awaitTestCaseIncidentId(client, testCase, task.getId());
    assertEquals(1, countIncidentTasksForTestCase(client, testCase));
  }

  @Test
  void testBulkNewOnOpenIncident_MovesItBackToNew(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    TestCase testCase = createTestCase(client, ns, "incident-bulk-new");
    createFailedTestResult(client, testCase);
    Task task = awaitIncidentTaskForTestCase(client, testCase);
    UUID stateId = task.getId();

    createTcrs(client, testCase, TestCaseResolutionStatusTypes.Ack, null);
    awaitIncidentTask(client, stateId, TaskEntityStatus.InProgress, "ack", null);

    BulkOperationResult result =
        client
            .testCaseResolutionStatuses()
            .bulkCreate(
                List.of(
                    new CreateTestCaseResolutionStatus()
                        .withTestCaseReference(testCase.getFullyQualifiedName())
                        .withTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.New)));

    assertEquals(1, result.getNumberOfRowsPassed(), "the open incident must accept New in bulk");
    awaitIncidentTask(client, stateId, TaskEntityStatus.Open, "new", null);
  }

  @ParameterizedTest
  @CsvSource({"new,ack", "ack,resolved", "new,assign"})
  void testAssignmentPatchedAfterReturningToTriageSurvivesLaterStages(
      String returnStage, String nextStage, TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    SharedEntities shared = SharedEntities.get();
    TestCase testCase = createTestCase(client, ns, "patched-assignee-" + returnStage + nextStage);
    createFailedTestResult(client, testCase);
    Task task = awaitIncidentTaskForTestCase(client, testCase);
    createTcrs(
        client,
        testCase,
        TestCaseResolutionStatusTypes.Assigned,
        new Assigned().withAssignee(shared.USER1_REF));
    client
        .tasks()
        .resolve(task.getId().toString(), new ResolveTask().withTransitionId(returnStage));
    Task returned = client.tasks().get(task.getId().toString(), "assignees");
    assertTrue(returned.getAssignees() == null || returned.getAssignees().isEmpty());
    JsonNode patch =
        JsonUtils.valueToTree(
            List.of(Map.of("op", "add", "path", "/assignees", "value", List.of(shared.USER2_REF))));
    client.tasks().patch(task.getId().toString(), patch);
    if (!RESOLVED_STAGE_ID.equals(nextStage)) {
      client
          .tasks()
          .resolve(task.getId().toString(), new ResolveTask().withTransitionId(nextStage));
      Task advanced = client.tasks().get(task.getId().toString(), "assignees");
      assertEquals(
          List.of(shared.USER2.getId()),
          advanced.getAssignees().stream().map(EntityReference::getId).toList());
    }
    resolveIncidentTask(client, task.getId());
    awaitIncidentTask(
        client, task.getId(), TaskEntityStatus.Completed, "resolved", shared.USER2.getName());
  }

  @Test
  void testResolvedIncident_NewFailureOpensADistinctIncident(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    TestCase testCase = createTestCase(client, ns, "incident-refail");
    createFailedTestResult(client, testCase);
    Task task = awaitIncidentTaskForTestCase(client, testCase);
    UUID firstStateId = task.getId();

    resolveIncidentTask(client, firstStateId);
    awaitIncidentTask(client, firstStateId, TaskEntityStatus.Completed, "resolved", null);

    TestCaseResult newFailure = createFailedTestResult(client, testCase);
    assertNotNull(newFailure.getIncidentId());

    UUID[] secondStateId = new UUID[1];
    await()
        .atMost(TASK_TIMEOUT)
        .pollInterval(Duration.ofMillis(250))
        .untilAsserted(
            () -> {
              TestCase fetched =
                  client.testCases().get(testCase.getId().toString(), "incidentId,testCaseResult");
              assertNotNull(fetched.getIncidentId());
              assertNotEquals(
                  firstStateId,
                  fetched.getIncidentId(),
                  "a failure after a resolved incident must open a new incident");
              assertNotNull(fetched.getTestCaseResult());
              assertEquals(fetched.getIncidentId(), fetched.getTestCaseResult().getIncidentId());
              secondStateId[0] = fetched.getIncidentId();
            });
    assertLatestTcrsEventually(client, secondStateId[0], TestCaseResolutionStatusTypes.New, null);
    assertEquals(secondStateId[0], newFailure.getIncidentId());
    List<TestCaseResolutionStatus> resolvedHistory = tcrsTimeline(client, firstStateId);
    List<TestCaseResolutionStatus> newHistory = tcrsTimeline(client, secondStateId[0]);
    client
        .testCaseResolutionStatuses()
        .patch(
            newHistory.getLast().getId(),
            JsonUtils.readTree(
                "[{\"op\":\"add\",\"path\":\"/severity\",\"value\":\"Severity5\"}]"));
    List<TestCaseResolutionStatus> prioritizedHistory = tcrsTimeline(client, secondStateId[0]);
    assertEquals(newHistory.size(), prioritizedHistory.size());
    assertEquals(Severity.Severity5, prioritizedHistory.getLast().getSeverity());
    assertEquals(
        TestCaseResolutionStatusTypes.New,
        prioritizedHistory.getLast().getTestCaseResolutionStatusType());
    createTcrs(client, testCase, TestCaseResolutionStatusTypes.Ack, null);
    createTcrs(
        client,
        testCase,
        TestCaseResolutionStatusTypes.Assigned,
        new Assigned().withAssignee(SharedEntities.get().USER1_REF));
    createTcrs(client, testCase, TestCaseResolutionStatusTypes.Resolved, null);
    assertLatestTcrsEventually(
        client, secondStateId[0], TestCaseResolutionStatusTypes.Resolved, null);
    awaitIncidentTask(client, firstStateId, TaskEntityStatus.Completed, "resolved", null);
    assertEquals(resolvedHistory, tcrsTimeline(client, firstStateId));
    assertEquals(
        2,
        countIncidentTasksForTestCase(client, testCase),
        "the resolved incident stays final beside the new one");
  }

  @Test
  void testRepeatedFailureOnAckIncident_KeepsItAtAck(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    TestCase testCase = createTestCase(client, ns, "incident-repeat-ack");
    createFailedTestResult(client, testCase);
    Task task = awaitIncidentTaskForTestCase(client, testCase);
    UUID stateId = task.getId();

    createTcrs(client, testCase, TestCaseResolutionStatusTypes.Ack, null);
    awaitIncidentTask(client, stateId, TaskEntityStatus.InProgress, "ack", null);

    createFailedTestResult(client, testCase);

    awaitTestCaseIncidentId(client, testCase, stateId);
    awaitIncidentTask(client, stateId, TaskEntityStatus.InProgress, "ack", null);
    assertLatestTcrsEventually(client, stateId, TestCaseResolutionStatusTypes.Ack, null);
    assertEquals(
        1,
        countIncidentTasksForTestCase(client, testCase),
        "a repeated failure must not open another incident");
  }

  @Test
  void testRepeatedFailureOnAssignedIncident_KeepsItAssigned(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    SharedEntities shared = SharedEntities.get();

    TestCase testCase = createTestCase(client, ns, "incident-repeat-assigned");
    createFailedTestResult(client, testCase);
    Task task = awaitIncidentTaskForTestCase(client, testCase);
    UUID stateId = task.getId();

    createTcrs(
        client,
        testCase,
        TestCaseResolutionStatusTypes.Assigned,
        new Assigned().withAssignee(shared.USER1_REF));
    awaitIncidentTask(
        client, stateId, TaskEntityStatus.InProgress, "assigned", shared.USER1.getName());

    createFailedTestResult(client, testCase);

    awaitTestCaseIncidentId(client, testCase, stateId);
    awaitIncidentTask(
        client, stateId, TaskEntityStatus.InProgress, "assigned", shared.USER1.getName());
    assertLatestTcrsEventually(
        client, stateId, TestCaseResolutionStatusTypes.Assigned, shared.USER1.getName());
    assertEquals(
        1,
        countIncidentTasksForTestCase(client, testCase),
        "a repeated failure must not open another incident");
  }

  private void createTcrs(
      OpenMetadataClient client,
      TestCase testCase,
      TestCaseResolutionStatusTypes type,
      Object details) {
    CreateTestCaseResolutionStatus request =
        new CreateTestCaseResolutionStatus()
            .withTestCaseReference(testCase.getFullyQualifiedName())
            .withTestCaseResolutionStatusType(type);
    if (details != null) {
      request.withTestCaseResolutionStatusDetails(details);
    }
    client.testCaseResolutionStatuses().create(request);
  }

  private TestCase createTestCase(OpenMetadataClient client, TestNamespace ns, String prefix) {
    String id = ns.shortPrefix();
    DatabaseService service =
        DatabaseServiceTestFactory.createPostgresWithName(prefix + "-svc-" + id, ns);
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimpleWithName(prefix + "-sch-" + id, ns, service);
    Table table =
        TableTestFactory.createSimpleWithName(
            prefix + "-tbl-" + id, ns, schema.getFullyQualifiedName());

    return TestCaseBuilder.create(client)
        .name(prefix + "-tc-" + id)
        .forTable(table)
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "100")
        .create();
  }

  private void resolveIncidentTask(OpenMetadataClient client, UUID stateId) {
    client
        .tasks()
        .resolve(
            stateId.toString(),
            new ResolveTask()
                .withTransitionId("resolve")
                .withResolutionType(TaskResolutionType.Completed)
                .withComment("Resolved by mistake")
                .withPayload(
                    resolutionPayload(
                        "Mistake",
                        "Resolved by mistake",
                        TestCaseFailureReasonType.FalsePositive)));
  }

  private void awaitTestCaseIncidentId(
      OpenMetadataClient client, TestCase testCase, UUID expectedIncidentId) {
    await()
        .atMost(TASK_TIMEOUT)
        .pollInterval(Duration.ofMillis(250))
        .untilAsserted(
            () -> {
              TestCase fetched = client.testCases().get(testCase.getId().toString(), "incidentId");
              assertEquals(expectedIncidentId, fetched.getIncidentId());
            });
  }

  private long countIncidentTasksForTestCase(OpenMetadataClient client, TestCase testCase) {
    ListParams params =
        new ListParams().setLimit(200).setFields("about").addFilter("category", "Incident");
    ListResponse<Task> tasks = client.tasks().list(params);

    return tasks.getData().stream()
        .filter(task -> task.getAbout() != null)
        .filter(
            task ->
                testCase.getFullyQualifiedName().equals(task.getAbout().getFullyQualifiedName()))
        .count();
  }

  private TestCaseResult createFailedTestResult(OpenMetadataClient client, TestCase testCase) {
    CreateTestCaseResult failedResult = new CreateTestCaseResult();
    failedResult.setTimestamp(System.currentTimeMillis());
    failedResult.setTestCaseStatus(TestCaseStatus.Failed);
    failedResult.setResult("Test failed - triggering incident");
    return client.testCaseResults().create(testCase.getFullyQualifiedName(), failedResult);
  }

  private Task awaitIncidentTaskForTestCase(OpenMetadataClient client, TestCase testCase) {
    AtomicReference<Task> taskRef = new AtomicReference<>();

    await()
        .atMost(TASK_TIMEOUT)
        .pollInterval(Duration.ofMillis(250))
        .untilAsserted(
            () -> {
              Task task = findIncidentTaskForTestCase(client, testCase);
              assertNotNull(task, "incident task should be created for failed test case");
              assertEquals(TaskCategory.Incident, task.getCategory());
              taskRef.set(
                  awaitIncidentTask(client, task.getId(), TaskEntityStatus.Open, "new", null));
            });

    return taskRef.get();
  }

  private Task awaitIncidentTask(
      OpenMetadataClient client,
      UUID taskId,
      TaskEntityStatus expectedStatus,
      String expectedStageId,
      String expectedAssignee) {
    AtomicReference<Task> taskRef = new AtomicReference<>();

    await()
        .atMost(TASK_TIMEOUT)
        .pollInterval(Duration.ofMillis(250))
        .untilAsserted(
            () -> {
              Task task =
                  client
                      .tasks()
                      .get(
                          taskId.toString(),
                          "payload,assignees,about,status,resolution,workflowInstanceId,"
                              + "workflowStageId,availableTransitions");

              assertNotNull(task);
              assertEquals(expectedStatus, task.getStatus());
              assertEquals(expectedStageId, task.getWorkflowStageId());
              assertNotNull(task.getWorkflowInstanceId());
              assertNotNull(task.getPayload());

              TestCaseResolutionPayload payload =
                  JsonUtils.convertValue(task.getPayload(), TestCaseResolutionPayload.class);
              assertEquals(taskId, payload.getTestCaseResolutionStatusId());

              if (expectedAssignee != null) {
                assertNotNull(task.getAssignees());
                assertTrue(
                    task.getAssignees().stream()
                        .map(EntityReference::getName)
                        .anyMatch(expectedAssignee::equals),
                    "Expected assignee '" + expectedAssignee + "' to be present");
              }

              taskRef.set(task);
            });

    return taskRef.get();
  }

  private Task findIncidentTaskForTestCase(OpenMetadataClient client, TestCase testCase) {
    ListParams params =
        new ListParams().setLimit(200).setFields("payload,about").addFilter("category", "Incident");
    ListResponse<Task> tasks = client.tasks().list(params);

    return tasks.getData().stream()
        .filter(task -> task.getAbout() != null)
        .filter(task -> task.getAbout().getFullyQualifiedName() != null)
        .filter(
            task ->
                task.getAbout().getFullyQualifiedName().equals(testCase.getFullyQualifiedName()))
        .findFirst()
        .orElse(null);
  }

  /** The stateId's records oldest first, so the last element is the one consumers render. */
  private List<TestCaseResolutionStatus> tcrsTimeline(OpenMetadataClient client, UUID stateId) {
    return listTcrsForStateId(client, stateId).stream()
        .sorted(Comparator.comparing(TestCaseResolutionStatus::getTimestamp))
        .toList();
  }

  private void assertLatestTcrsEventually(
      OpenMetadataClient client,
      UUID stateId,
      TestCaseResolutionStatusTypes expectedStatus,
      String expectedAssignee) {
    await()
        .atMost(TASK_TIMEOUT)
        .pollInterval(Duration.ofMillis(250))
        .untilAsserted(
            () -> {
              List<TestCaseResolutionStatus> timeline = tcrsTimeline(client, stateId);
              assertFalse(timeline.isEmpty(), "no TCRS records for stateId " + stateId);
              TestCaseResolutionStatus latest = timeline.getLast();
              assertEquals(expectedStatus, latest.getTestCaseResolutionStatusType());
              assertEquals(expectedAssignee, tcrsAssigneeName(latest));
            });
  }

  private List<String> assignedAssigneeNames(OpenMetadataClient client, UUID stateId) {
    return tcrsTimeline(client, stateId).stream()
        .filter(
            record ->
                record.getTestCaseResolutionStatusType() == TestCaseResolutionStatusTypes.Assigned)
        .map(IncidentTaskIntegrationIT::tcrsAssigneeName)
        .toList();
  }

  private static String tcrsAssigneeName(TestCaseResolutionStatus record) {
    if (record.getTestCaseResolutionStatusType() != TestCaseResolutionStatusTypes.Assigned) {
      return null;
    }
    Assigned assigned =
        JsonUtils.convertValue(record.getTestCaseResolutionStatusDetails(), Assigned.class);
    return assigned != null && assigned.getAssignee() != null
        ? assigned.getAssignee().getName()
        : null;
  }

  @SuppressWarnings("unchecked")
  private List<TestCaseResolutionStatus> listTcrsForStateId(
      OpenMetadataClient client, UUID stateId) {
    try {
      String response =
          client
              .getHttpClient()
              .executeForString(
                  HttpMethod.GET,
                  "/v1/dataQuality/testCases/testCaseIncidentStatus/stateId/" + stateId,
                  null,
                  RequestOptions.builder().build());

      Map<String, Object> result = JsonUtils.readValue(response, new TypeReference<>() {});
      List<Object> data = (List<Object>) result.get("data");
      if (data == null) {
        return List.of();
      }

      return data.stream()
          .map(entry -> JsonUtils.convertValue(entry, TestCaseResolutionStatus.class))
          .toList();
    } catch (Exception e) {
      return List.of();
    }
  }

  private Payload assigneePayload(EntityReference assignee) {
    return new Payload().withAdditionalProperty("assignees", List.of(assignee));
  }

  private Payload resolutionPayload(
      String rootCause, String resolution, TestCaseFailureReasonType failureReasonType) {
    return new Payload()
        .withAdditionalProperty("rootCause", rootCause)
        .withAdditionalProperty("resolution", resolution)
        .withAdditionalProperty("testCaseFailureReason", failureReasonType.value());
  }
}
