/*
 *  Copyright 2025 Collate.
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
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * E2E tests for auto-close incident on test pass.
 *
 * <p>When a TestCase has autoCloseIncident=true and a test result arrives with status=Success, the
 * open incident is automatically resolved with reason AutoResolved by governance-bot.
 */
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class AutoCloseIncidentIT {

  private static final String WORKFLOW_NAME = "TestCaseResolutionTaskWorkflow";
  private static final Duration PIPELINE_TIMEOUT = Duration.ofSeconds(120);

  @Test
  void autoCloseEnabled_testPasses_incidentResolved(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String id = ns.shortPrefix();

    DatabaseService service = DatabaseServiceTestFactory.createPostgresWithName("sv" + id, ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimpleWithName("sc" + id, ns, service);
    Table table =
        TableTestFactory.createSimpleWithName("tbl" + id, ns, schema.getFullyQualifiedName());

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name("tc" + id)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    patchTestCase(client, testCase, "autoCloseIncident", "true");

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

    createTestResult(client, testCase, TestCaseStatus.Failed);

    AtomicReference<Task> taskRef = new AtomicReference<>();
    await()
        .atMost(PIPELINE_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> {
              Task found = findIncidentTaskForTestCase(client, testCase);
              if (found != null && found.getWorkflowInstanceId() != null) {
                taskRef.set(found);
                return true;
              }
              return false;
            });

    Task task = taskRef.get();
    assertEquals(TaskCategory.Incident, task.getCategory());
    assertNotNull(task.getWorkflowInstanceId());

    TestCase failedTc =
        client.testCases().getByName(testCase.getFullyQualifiedName(), "incidentId");
    UUID stateId = failedTc.getIncidentId();
    assertNotNull(stateId, "Should have an open incident after failure");

    createTestResult(client, testCase, TestCaseStatus.Success);

    await()
        .atMost(PIPELINE_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () ->
                listTcrsForStateId(client, stateId).stream()
                    .anyMatch(
                        r ->
                            r.getTestCaseResolutionStatusType()
                                == TestCaseResolutionStatusTypes.Resolved));

    List<TestCaseResolutionStatus> records = listTcrsForStateId(client, stateId);
    TestCaseResolutionStatus resolved =
        records.stream()
            .filter(
                r -> r.getTestCaseResolutionStatusType() == TestCaseResolutionStatusTypes.Resolved)
            .findFirst()
            .orElseThrow();

    assertTrue(
        resolved.getTestCaseResolutionStatusDetails().toString().contains("AutoResolved"),
        "Resolution reason should be AutoResolved");

    // Verify the Task was resolved by autoResolveIncident
    Task resolvedTask = client.tasks().get(task.getId().toString(), "resolution");
    assertEquals(TaskEntityStatus.Completed, resolvedTask.getStatus());
    assertNotNull(resolvedTask.getResolution());

    // Workflow should reach FINISHED (outbox delivers Completed to ManualTask)
    String workflowInstanceId = task.getWorkflowInstanceId().toString();
    await()
        .atMost(PIPELINE_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> {
              Map<String, Object> instance = getWorkflowInstance(client, workflowInstanceId);
              return instance != null && "FINISHED".equals(instance.get("status"));
            });
  }

  @Test
  void autoCloseDisabled_testPasses_incidentStaysOpen(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String id = ns.shortPrefix();

    DatabaseService service = DatabaseServiceTestFactory.createPostgresWithName("sv" + id, ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimpleWithName("sc" + id, ns, service);
    Table table =
        TableTestFactory.createSimpleWithName("tbl" + id, ns, schema.getFullyQualifiedName());

    TestCase testCase =
        TestCaseBuilder.create(client)
            .name("tc" + id)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();

    // autoCloseIncident defaults to false — don't patch

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

    createTestResult(client, testCase, TestCaseStatus.Failed);

    AtomicReference<Task> taskRef = new AtomicReference<>();
    await()
        .atMost(PIPELINE_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> {
              Task found = findIncidentTaskForTestCase(client, testCase);
              if (found != null && found.getWorkflowInstanceId() != null) {
                taskRef.set(found);
                return true;
              }
              return false;
            });

    TestCase failedTc =
        client.testCases().getByName(testCase.getFullyQualifiedName(), "incidentId");
    UUID stateId = failedTc.getIncidentId();
    assertNotNull(stateId);

    createTestResult(client, testCase, TestCaseStatus.Success);

    // Verify incident is NOT resolved — no Resolved TCRS record appears
    await()
        .during(Duration.ofSeconds(10))
        .atMost(Duration.ofSeconds(15))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () ->
                listTcrsForStateId(client, stateId).stream()
                    .noneMatch(
                        r ->
                            r.getTestCaseResolutionStatusType()
                                == TestCaseResolutionStatusTypes.Resolved));

    // Workflow should still be running
    String workflowInstanceId = taskRef.get().getWorkflowInstanceId().toString();
    Map<String, Object> instance = getWorkflowInstance(client, workflowInstanceId);
    assertEquals("RUNNING", instance.get("status"), "Workflow should still be running");

    // Cleanup through the workflow path used by the migrated incident task model.
    client
        .tasks()
        .resolve(
            taskRef.get().getId().toString(),
            new ResolveTask()
                .withTransitionId("resolve")
                .withResolutionType(TaskResolutionType.Completed)
                .withComment("cleanup")
                .withPayload(
                    new Payload()
                        .withAdditionalProperty("resolution", "cleanup")
                        .withAdditionalProperty(
                            "testCaseFailureReason", TestCaseFailureReasonType.Other.value())));
    await()
        .atMost(PIPELINE_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> {
              Map<String, Object> inst = getWorkflowInstance(client, workflowInstanceId);
              return inst != null && "FINISHED".equals(inst.get("status"));
            });
  }

  // --- Helpers ---

  private void createTestResult(
      OpenMetadataClient client, TestCase testCase, TestCaseStatus status) {
    org.openmetadata.schema.api.tests.CreateTestCaseResult result =
        new org.openmetadata.schema.api.tests.CreateTestCaseResult();
    result.setTimestamp(System.currentTimeMillis());
    result.setTestCaseStatus(status);
    result.setResult(status == TestCaseStatus.Failed ? "Test failed" : "Test passed");
    client.testCaseResults().create(testCase.getFullyQualifiedName(), result);
  }

  private void patchTestCase(
      OpenMetadataClient client, TestCase testCase, String field, String value) {
    String patchJson =
        String.format("[{\"op\": \"add\", \"path\": \"/%s\", \"value\": %s}]", field, value);
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            "/v1/dataQuality/testCases/" + testCase.getId(),
            patchJson,
            RequestOptions.builder().header("Content-Type", "application/json-patch+json").build());
  }

  private Task findIncidentTaskForTestCase(OpenMetadataClient client, TestCase testCase) {
    ListParams params =
        new ListParams().addFilter("category", "Incident").setFields("payload,about").setLimit(100);
    ListResponse<Task> tasks = client.tasks().list(params);

    for (Task task : tasks.getData()) {
      if (task.getAbout() != null
          && task.getAbout().getFullyQualifiedName() != null
          && task.getAbout().getFullyQualifiedName().equals(testCase.getFullyQualifiedName())) {
        return task;
      }
    }
    return null;
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
      if (data == null) return List.of();
      return data.stream()
          .map(d -> JsonUtils.convertValue(d, TestCaseResolutionStatus.class))
          .toList();
    } catch (Exception e) {
      return List.of();
    }
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> getWorkflowInstance(OpenMetadataClient client, String instanceId) {
    try {
      String response =
          client
              .getHttpClient()
              .executeForString(
                  HttpMethod.GET,
                  "/v1/governance/workflowInstances?startTs=0&endTs="
                      + System.currentTimeMillis()
                      + "&workflowDefinitionName="
                      + WORKFLOW_NAME
                      + "&limit=100",
                  null,
                  RequestOptions.builder().build());

      Map<String, Object> result = JsonUtils.readValue(response, new TypeReference<>() {});
      List<Map<String, Object>> data = (List<Map<String, Object>>) result.get("data");
      if (data == null) return null;

      for (Map<String, Object> instance : data) {
        if (instanceId.equals(instance.get("id"))) {
          return instance;
        }
      }
    } catch (Exception e) {
      // Polling — return null to retry
    }
    return null;
  }
}
