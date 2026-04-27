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
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeAll;
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
import org.openmetadata.schema.api.tasks.Payload;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseFailureReasonType;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.type.TestCaseResolutionPayload;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

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
    assertTcrsStatusEventually(client, task.getId(), TestCaseResolutionStatusTypes.New);
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
    assertTcrsStatusEventually(client, stateId, TestCaseResolutionStatusTypes.Ack);

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
    assertTcrsStatusEventually(client, stateId, TestCaseResolutionStatusTypes.Assigned);

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
    assertTcrsStatusEventually(client, stateId, TestCaseResolutionStatusTypes.Resolved);
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
    assertTcrsStatusEventually(client, task.getId(), TestCaseResolutionStatusTypes.Assigned);
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
    assertTcrsStatusEventually(client, task.getId(), TestCaseResolutionStatusTypes.Assigned);
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
    assertTcrsStatusEventually(client, task.getId(), TestCaseResolutionStatusTypes.Resolved);
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

  private void createFailedTestResult(OpenMetadataClient client, TestCase testCase) {
    org.openmetadata.schema.api.tests.CreateTestCaseResult failedResult =
        new org.openmetadata.schema.api.tests.CreateTestCaseResult();
    failedResult.setTimestamp(System.currentTimeMillis());
    failedResult.setTestCaseStatus(TestCaseStatus.Failed);
    failedResult.setResult("Test failed - triggering incident");
    client.testCaseResults().create(testCase.getFullyQualifiedName(), failedResult);
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

  private void assertTcrsStatusEventually(
      OpenMetadataClient client, UUID stateId, TestCaseResolutionStatusTypes expectedStatus) {
    await()
        .atMost(TASK_TIMEOUT)
        .pollInterval(Duration.ofMillis(250))
        .untilAsserted(
            () ->
                assertTrue(
                    listTcrsForStateId(client, stateId).stream()
                        .anyMatch(
                            record -> record.getTestCaseResolutionStatusType() == expectedStatus),
                    "Expected mirrored TCRS status " + expectedStatus + " for stateId " + stateId));
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
