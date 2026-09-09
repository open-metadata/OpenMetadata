/*
 *  Copyright 2026 Collate.
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.Assigned;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * E2E tests for automatic incident assignment (issue #22967).
 *
 * <p>When a test case fails and the incident inherits assignees from the target entity's owners,
 * the incident must land on the workflow's {@code assigned} stage rather than sitting in {@code
 * new} with an assignee no consumer of the TCRS time series can see.
 */
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class AutoAssignIncidentIT {

  private static final String WORKFLOW_NAME = "TestCaseResolutionTaskWorkflow";
  private static final String NEW_STAGE_ID = "new";
  private static final String ASSIGNED_STAGE_ID = "assigned";
  private static final Duration PIPELINE_TIMEOUT = Duration.ofSeconds(120);

  @Test
  void ownedTestCase_failedResult_incidentAutoAssigned(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String id = ns.shortPrefix();

    User owner = UserTestFactory.createUser(ns, "own" + id);
    TestCase testCase = createFailingTestCaseOwnedBy(client, ns, id, owner);

    Task task = awaitIncidentTask(client, testCase);
    assertEquals(
        ASSIGNED_STAGE_ID,
        task.getWorkflowStageId(),
        "Incident with inherited owners should advance past the New stage");
    assertEquals(TaskEntityStatus.InProgress, task.getStatus());
    assertTrue(
        task.getAssignees().stream().anyMatch(a -> owner.getId().equals(a.getId())),
        "Owner should be an assignee of the incident task");

    TestCase failedTc =
        client.testCases().getByName(testCase.getFullyQualifiedName(), "incidentId");
    UUID stateId = failedTc.getIncidentId();
    assertNotNull(stateId);

    await()
        .atMost(PIPELINE_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> findTcrsOfType(client, stateId, TestCaseResolutionStatusTypes.Assigned) != null);

    TestCaseResolutionStatus assigned =
        findTcrsOfType(client, stateId, TestCaseResolutionStatusTypes.Assigned);
    Assigned details =
        JsonUtils.convertValue(assigned.getTestCaseResolutionStatusDetails(), Assigned.class);
    assertNotNull(details.getAssignee(), "Assigned TCRS record must carry an assignee");
    assertEquals(
        owner.getId(),
        details.getAssignee().getId(),
        "Assigned TCRS record should name the owner as assignee");
  }

  @Test
  void unownedTestCase_failedResult_incidentStaysNew(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String id = ns.shortPrefix();

    TestCase testCase = createFailingTestCaseOwnedBy(client, ns, id, null);

    Task task = awaitIncidentTask(client, testCase);
    assertEquals(
        NEW_STAGE_ID,
        task.getWorkflowStageId(),
        "Incident without owners has nobody to assign to and must stay New");
    assertEquals(TaskEntityStatus.Open, task.getStatus());

    TestCase failedTc =
        client.testCases().getByName(testCase.getFullyQualifiedName(), "incidentId");
    UUID stateId = failedTc.getIncidentId();
    assertNotNull(stateId);

    await()
        .atMost(PIPELINE_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .until(() -> findTcrsOfType(client, stateId, TestCaseResolutionStatusTypes.New) != null);
    assertNull(
        findTcrsOfType(client, stateId, TestCaseResolutionStatusTypes.Assigned),
        "An unowned incident must not produce an Assigned record");
  }

  private TestCase createFailingTestCaseOwnedBy(
      OpenMetadataClient client, TestNamespace ns, String id, User owner) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgresWithName("sv" + id, ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimpleWithName("sc" + id, ns, service);
    Table table =
        TableTestFactory.createSimpleWithName("tbl" + id, ns, schema.getFullyQualifiedName());

    if (owner != null) {
      setTableOwner(client, table, owner);
    }

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name("tc" + id)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    awaitWorkflowDeployed(client);
    createFailedTestResult(client, testCase);
    return testCase;
  }

  private void setTableOwner(OpenMetadataClient client, Table table, User owner) {
    String patchJson =
        String.format(
            "[{\"op\": \"add\", \"path\": \"/owners\", \"value\": "
                + "[{\"id\": \"%s\", \"type\": \"user\"}]}]",
            owner.getId());
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            "/v1/tables/" + table.getId(),
            patchJson,
            RequestOptions.builder().header("Content-Type", "application/json-patch+json").build());
  }

  private void awaitWorkflowDeployed(OpenMetadataClient client) {
    await()
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> {
              try {
                var wd = client.workflowDefinitions().getByName(WORKFLOW_NAME, "deployed");
                return Boolean.TRUE.equals(wd.getDeployed());
              } catch (Exception e) {
                return false;
              }
            });
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
        .atMost(PIPELINE_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> {
              Task found = findIncidentTaskForTestCase(client, testCase);
              boolean started = found != null && found.getWorkflowInstanceId() != null;
              if (started) {
                taskRef.set(found);
              }
              return started;
            });
    return taskRef.get();
  }

  private Task findIncidentTaskForTestCase(OpenMetadataClient client, TestCase testCase) {
    ListParams params =
        new ListParams()
            .addFilter("category", "Incident")
            .setFields("assignees,payload,about")
            .setLimit(100);
    ListResponse<Task> tasks = client.tasks().list(params);

    return tasks.getData().stream()
        .filter(
            task ->
                task.getAbout() != null
                    && testCase
                        .getFullyQualifiedName()
                        .equals(task.getAbout().getFullyQualifiedName()))
        .findFirst()
        .orElse(null);
  }

  private TestCaseResolutionStatus findTcrsOfType(
      OpenMetadataClient client, UUID stateId, TestCaseResolutionStatusTypes type) {
    return listTcrsForStateId(client, stateId).stream()
        .filter(r -> r.getTestCaseResolutionStatusType() == type)
        .findFirst()
        .orElse(null);
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
          .map(d -> JsonUtils.convertValue(d, TestCaseResolutionStatus.class))
          .toList();
    } catch (Exception e) {
      return List.of();
    }
  }
}
