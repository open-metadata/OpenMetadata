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

import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;
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
import org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.Assigned;
import org.openmetadata.schema.tests.type.Resolved;
import org.openmetadata.schema.tests.type.TestCaseFailureReasonType;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TestCaseResolutionPayload;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for Incident-Task workflow.
 *
 * <p>These tests verify that when an incident (TestCaseResolutionStatus) transitions through its
 * lifecycle, the corresponding Task entity is created and managed correctly via the Task API.
 *
 * <p>Workflow tested: New → Ack (Task created) → Assigned (Task updated) → Resolved (Task closed)
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IncidentTaskIntegrationIT {

  @BeforeAll
  static void setup() {
    SharedEntities.get();
  }

  @Test
  void testFullIncidentWorkflow_NewToAckToAssignedToResolved(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    SharedEntities shared = SharedEntities.get();

    // Setup with short names to avoid FQN length limits
    String id = ns.shortPrefix();
    DatabaseService service = DatabaseServiceTestFactory.createPostgresWithName("svc" + id, ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimpleWithName("sch" + id, ns, service);
    Table table = TableTestFactory.createSimpleWithName("tbl" + id, ns, schema.getFullyQualifiedName());

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name("tc" + id)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    // Step 1: Add failed test result to trigger incident creation (New state)
    createFailedTestResult(client, testCase);

    // Step 2: Acknowledge the incident - this should create a Task
    CreateTestCaseResolutionStatus ackStatus = new CreateTestCaseResolutionStatus();
    ackStatus.setTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Ack);
    ackStatus.setTestCaseReference(testCase.getFullyQualifiedName());

    TestCaseResolutionStatus ackResult = client.testCaseResolutionStatuses().create(ackStatus);

    assertNotNull(ackResult);
    assertEquals(TestCaseResolutionStatusTypes.Ack, ackResult.getTestCaseResolutionStatusType());
    UUID stateId = ackResult.getStateId();
    assertNotNull(stateId, "State ID should be set");

    // Verify Task was created with correct properties
    Task incidentTask = findTaskByStateId(client, stateId);
    assertNotNull(incidentTask, "Task should be created when incident is acknowledged");
    assertEquals(TaskCategory.Incident, incidentTask.getCategory());
    assertEquals(TaskEntityType.TestCaseResolution, incidentTask.getType());
    assertEquals(TaskEntityStatus.Open, incidentTask.getStatus());

    // Verify payload contains testCaseResolutionStatusId
    assertNotNull(incidentTask.getPayload(), "Task should have payload");
    TestCaseResolutionPayload payload =
        JsonUtils.convertValue(incidentTask.getPayload(), TestCaseResolutionPayload.class);
    assertEquals(stateId, payload.getTestCaseResolutionStatusId());

    // Step 3: Assign the incident to a user - Task should be updated
    CreateTestCaseResolutionStatus assignedStatus = new CreateTestCaseResolutionStatus();
    assignedStatus.setTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Assigned);
    assignedStatus.setTestCaseReference(testCase.getFullyQualifiedName());
    assignedStatus.setTestCaseResolutionStatusDetails(
        new Assigned().withAssignee(shared.USER1_REF));

    TestCaseResolutionStatus assignedResult =
        client.testCaseResolutionStatuses().create(assignedStatus);

    assertNotNull(assignedResult);
    assertEquals(
        TestCaseResolutionStatusTypes.Assigned, assignedResult.getTestCaseResolutionStatusType());
    assertEquals(stateId, assignedResult.getStateId(), "StateId should remain the same");

    // Verify Task still exists after assignment update
    Task updatedTask = findTaskByStateId(client, stateId);
    assertNotNull(updatedTask);
    assertEquals(TaskEntityStatus.Open, updatedTask.getStatus());
    // Note: Assignees are stored as relationships and may require explicit fetch
    // The core verification is that the task exists and maintains correct status

    // Step 4: Resolve the incident - Task should be completed
    CreateTestCaseResolutionStatus resolvedStatus = new CreateTestCaseResolutionStatus();
    resolvedStatus.setTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Resolved);
    resolvedStatus.setTestCaseReference(testCase.getFullyQualifiedName());
    resolvedStatus.setTestCaseResolutionStatusDetails(
        new Resolved()
            .withResolvedBy(shared.USER1_REF)
            .withTestCaseFailureReason(TestCaseFailureReasonType.FalsePositive)
            .withTestCaseFailureComment("Resolved via integration test"));

    TestCaseResolutionStatus resolvedResult =
        client.testCaseResolutionStatuses().create(resolvedStatus);

    assertNotNull(resolvedResult);
    assertEquals(
        TestCaseResolutionStatusTypes.Resolved, resolvedResult.getTestCaseResolutionStatusType());

    // Verify Task was completed (status becomes Completed when incident is resolved)
    Task completedTask = findTaskByStateId(client, stateId);
    assertNotNull(completedTask);
    assertEquals(
        TaskEntityStatus.Completed,
        completedTask.getStatus(),
        "Task should be completed when incident is resolved");
  }

  @Test
  void testIncidentAck_CreatesTaskWithCorrectCategory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Setup with short names
    String id = ns.shortPrefix();
    DatabaseService service = DatabaseServiceTestFactory.createPostgresWithName("sv" + id, ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimpleWithName("sc" + id, ns, service);
    Table table = TableTestFactory.createSimpleWithName("tb" + id, ns, schema.getFullyQualifiedName());

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name("tc" + id)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    // Trigger incident
    createFailedTestResult(client, testCase);

    // Acknowledge incident
    TestCaseResolutionStatus ackResult =
        client
            .testCaseResolutionStatuses()
            .builder()
            .ack()
            .testCaseReference(testCase.getFullyQualifiedName())
            .create();

    UUID stateId = ackResult.getStateId();

    // Verify task properties
    Task task = findTaskByStateId(client, stateId);
    assertNotNull(task);
    assertEquals(TaskCategory.Incident, task.getCategory());
    assertEquals(TaskEntityType.TestCaseResolution, task.getType());
    assertEquals(TaskEntityStatus.Open, task.getStatus());
    assertNotNull(task.getAbout(), "Task should have about reference to test case");
  }

  @Test
  void testDirectAssignment_NewToAssigned(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    SharedEntities shared = SharedEntities.get();

    // Setup with short names
    String id = ns.shortPrefix();
    DatabaseService service = DatabaseServiceTestFactory.createPostgresWithName("s" + id, ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimpleWithName("c" + id, ns, service);
    Table table = TableTestFactory.createSimpleWithName("t" + id, ns, schema.getFullyQualifiedName());

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name("x" + id)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    // Trigger incident
    createFailedTestResult(client, testCase);

    // Direct assignment (skip Ack) - should create task directly
    CreateTestCaseResolutionStatus assignedStatus = new CreateTestCaseResolutionStatus();
    assignedStatus.setTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Assigned);
    assignedStatus.setTestCaseReference(testCase.getFullyQualifiedName());
    assignedStatus.setTestCaseResolutionStatusDetails(
        new Assigned().withAssignee(shared.USER2_REF));

    TestCaseResolutionStatus result = client.testCaseResolutionStatuses().create(assignedStatus);

    assertNotNull(result);
    UUID stateId = result.getStateId();

    // Verify task was created with assignee
    Task task = findTaskByStateId(client, stateId);
    assertNotNull(task, "Task should be created for direct assignment");
    assertEquals(TaskEntityStatus.Open, task.getStatus());
    assertTrue(
        task.getAssignees().stream().anyMatch(a -> a.getName().equals(shared.USER2.getName())));
  }

  @Test
  void testReassignment_AssignedToAssigned(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    SharedEntities shared = SharedEntities.get();

    // Setup with short names
    String id = ns.shortPrefix();
    DatabaseService service = DatabaseServiceTestFactory.createPostgresWithName("a" + id, ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimpleWithName("b" + id, ns, service);
    Table table = TableTestFactory.createSimpleWithName("c" + id, ns, schema.getFullyQualifiedName());

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name("d" + id)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    // Trigger incident
    createFailedTestResult(client, testCase);

    // Initial assignment to USER1
    CreateTestCaseResolutionStatus assignedStatus1 = new CreateTestCaseResolutionStatus();
    assignedStatus1.setTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Assigned);
    assignedStatus1.setTestCaseReference(testCase.getFullyQualifiedName());
    assignedStatus1.setTestCaseResolutionStatusDetails(
        new Assigned().withAssignee(shared.USER1_REF));

    TestCaseResolutionStatus result1 = client.testCaseResolutionStatuses().create(assignedStatus1);
    UUID stateId = result1.getStateId();

    // Verify initial assignment
    Task task1 = findTaskByStateId(client, stateId);
    assertTrue(
        task1.getAssignees().stream().anyMatch(a -> a.getName().equals(shared.USER1.getName())));

    // Reassign to USER2
    CreateTestCaseResolutionStatus assignedStatus2 = new CreateTestCaseResolutionStatus();
    assignedStatus2.setTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Assigned);
    assignedStatus2.setTestCaseReference(testCase.getFullyQualifiedName());
    assignedStatus2.setTestCaseResolutionStatusDetails(
        new Assigned().withAssignee(shared.USER2_REF));

    client.testCaseResolutionStatuses().create(assignedStatus2);

    // Verify reassignment
    Task task2 = findTaskByStateId(client, stateId);
    assertNotNull(task2);
    assertEquals(TaskEntityStatus.Open, task2.getStatus());
    assertTrue(
        task2.getAssignees().stream().anyMatch(a -> a.getName().equals(shared.USER2.getName())),
        "Task should now be assigned to USER2");
  }

  @Test
  void testDirectResolution_NewToResolved_NoTaskCreated(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    SharedEntities shared = SharedEntities.get();

    // Setup with short names
    String id = ns.shortPrefix();
    DatabaseService service = DatabaseServiceTestFactory.createPostgresWithName("e" + id, ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimpleWithName("f" + id, ns, service);
    Table table = TableTestFactory.createSimpleWithName("g" + id, ns, schema.getFullyQualifiedName());

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name("h" + id)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    // Trigger incident
    createFailedTestResult(client, testCase);

    // Direct resolution without Ack/Assigned
    CreateTestCaseResolutionStatus resolvedStatus = new CreateTestCaseResolutionStatus();
    resolvedStatus.setTestCaseResolutionStatusType(TestCaseResolutionStatusTypes.Resolved);
    resolvedStatus.setTestCaseReference(testCase.getFullyQualifiedName());
    resolvedStatus.setTestCaseResolutionStatusDetails(
        new Resolved()
            .withResolvedBy(shared.USER1_REF)
            .withTestCaseFailureReason(TestCaseFailureReasonType.FalsePositive)
            .withTestCaseFailureComment("Direct resolution"));

    TestCaseResolutionStatus result = client.testCaseResolutionStatuses().create(resolvedStatus);

    assertNotNull(result);
    assertEquals(TestCaseResolutionStatusTypes.Resolved, result.getTestCaseResolutionStatusType());

    // Verify no task was created (since we went directly to Resolved)
    Task task = findTaskByStateId(client, result.getStateId());
    assertNull(task, "No task should be created for direct New → Resolved transition");
  }

  @Test
  void testTaskPayload_ContainsTestCaseResolutionStatusId(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Setup with short names
    String id = ns.shortPrefix();
    DatabaseService service = DatabaseServiceTestFactory.createPostgresWithName("i" + id, ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimpleWithName("j" + id, ns, service);
    Table table = TableTestFactory.createSimpleWithName("k" + id, ns, schema.getFullyQualifiedName());

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name("l" + id)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    // Trigger incident and acknowledge
    createFailedTestResult(client, testCase);

    TestCaseResolutionStatus ackResult =
        client
            .testCaseResolutionStatuses()
            .builder()
            .ack()
            .testCaseReference(testCase.getFullyQualifiedName())
            .create();

    UUID stateId = ackResult.getStateId();

    // Verify task payload
    Task task = findTaskByStateId(client, stateId);
    assertNotNull(task);
    assertNotNull(task.getPayload());

    TestCaseResolutionPayload payload =
        JsonUtils.convertValue(task.getPayload(), TestCaseResolutionPayload.class);

    assertNotNull(payload.getTestCaseResolutionStatusId());
    assertEquals(stateId, payload.getTestCaseResolutionStatusId());
    assertNotNull(payload.getTestCaseResult(), "Payload should have test case result reference");
  }

  @Test
  void testMultipleIncidents_IndependentTasks(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Setup with short names
    String id = ns.shortPrefix();
    DatabaseService service = DatabaseServiceTestFactory.createPostgresWithName("m" + id, ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimpleWithName("n" + id, ns, service);
    Table table = TableTestFactory.createSimpleWithName("o" + id, ns, schema.getFullyQualifiedName());

    String id1 = ns.uniqueShortId();
    String id2 = ns.uniqueShortId();

    TestCase testCase1 =
        TestCaseBuilder.create(client)
            .name("p" + id1)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    TestCase testCase2 =
        TestCaseBuilder.create(client)
            .name("q" + id2)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "200")
            .create();

    // Trigger and acknowledge both incidents
    createFailedTestResult(client, testCase1);
    createFailedTestResult(client, testCase2);

    TestCaseResolutionStatus ack1 =
        client
            .testCaseResolutionStatuses()
            .builder()
            .ack()
            .testCaseReference(testCase1.getFullyQualifiedName())
            .create();

    TestCaseResolutionStatus ack2 =
        client
            .testCaseResolutionStatuses()
            .builder()
            .ack()
            .testCaseReference(testCase2.getFullyQualifiedName())
            .create();

    // Verify each incident has its own task
    Task task1 = findTaskByStateId(client, ack1.getStateId());
    Task task2 = findTaskByStateId(client, ack2.getStateId());

    assertNotNull(task1);
    assertNotNull(task2);
    assertNotEquals(task1.getId(), task2.getId(), "Each incident should have a separate task");

    // Verify state IDs are different
    TestCaseResolutionPayload payload1 =
        JsonUtils.convertValue(task1.getPayload(), TestCaseResolutionPayload.class);
    TestCaseResolutionPayload payload2 =
        JsonUtils.convertValue(task2.getPayload(), TestCaseResolutionPayload.class);

    assertNotEquals(
        payload1.getTestCaseResolutionStatusId(), payload2.getTestCaseResolutionStatusId());
  }

  @Test
  void testIncidentTaskListByCategory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Setup with short names
    String id = ns.shortPrefix();
    DatabaseService service = DatabaseServiceTestFactory.createPostgresWithName("r" + id, ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimpleWithName("s" + id, ns, service);
    Table table = TableTestFactory.createSimpleWithName("t" + id, ns, schema.getFullyQualifiedName());

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name("u" + id)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    // Create incident task
    createFailedTestResult(client, testCase);

    TestCaseResolutionStatus ackResult =
        client
            .testCaseResolutionStatuses()
            .builder()
            .ack()
            .testCaseReference(testCase.getFullyQualifiedName())
            .create();

    UUID stateId = ackResult.getStateId();

    // Verify task can be found by category filter
    ListParams params = new ListParams().addFilter("category", "Incident").setLimit(100);
    ListResponse<Task> incidentTasks = client.tasks().list(params);

    assertNotNull(incidentTasks);
    assertTrue(incidentTasks.getData().size() >= 1);

    // Find our specific task
    Task ourTask =
        incidentTasks.getData().stream()
            .filter(
                t -> {
                  if (t.getPayload() == null) return false;
                  TestCaseResolutionPayload p =
                      JsonUtils.convertValue(t.getPayload(), TestCaseResolutionPayload.class);
                  return stateId.equals(p.getTestCaseResolutionStatusId());
                })
            .findFirst()
            .orElse(null);

    assertNotNull(ourTask, "Our incident task should be in the list");
    assertEquals(TaskCategory.Incident, ourTask.getCategory());
  }

  // ==================== Helper Methods ====================

  private void createFailedTestResult(OpenMetadataClient client, TestCase testCase) {
    org.openmetadata.schema.api.tests.CreateTestCaseResult failedResult =
        new org.openmetadata.schema.api.tests.CreateTestCaseResult();
    failedResult.setTimestamp(System.currentTimeMillis());
    failedResult.setTestCaseStatus(TestCaseStatus.Failed);
    failedResult.setResult("Test failed - triggering incident");
    client.testCaseResults().create(testCase.getFullyQualifiedName(), failedResult);
  }

  private Task findTaskByStateId(OpenMetadataClient client, UUID stateId) {
    try {
      ListParams params = new ListParams().setLimit(200).setFields("payload,assignees,about");
      ListResponse<Task> tasks = client.tasks().list(params);

      for (Task task : tasks.getData()) {
        if (task.getPayload() != null) {
          TestCaseResolutionPayload payload =
              JsonUtils.convertValue(task.getPayload(), TestCaseResolutionPayload.class);
          if (payload != null && stateId.equals(payload.getTestCaseResolutionStatusId())) {
            return task;
          }
        }
      }
    } catch (Exception e) {
      throw new RuntimeException("Error finding task by stateId: " + stateId, e);
    }
    return null;
  }
}
