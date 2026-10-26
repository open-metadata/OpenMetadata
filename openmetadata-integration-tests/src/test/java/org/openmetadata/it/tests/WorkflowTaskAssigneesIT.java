package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.governance.CreateWorkflowDefinition;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.resources.feeds.MessageParser;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class WorkflowTaskAssigneesIT {
  @ParameterizedTest
  @ValueSource(strings = {"none", "wait"})
  void onlyExplicitWaitSuppressesOwnerFallback(final String strategy, final TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final var owner = client.users().getByName("shared_user1").getEntityReference();
    final Domain domain =
        client
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix("ownedDomain_" + strategy))
                    .withDescription("Owned domain for workflow assignee tests")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE)
                    .withOwners(List.of(owner)));
    final var workflow =
        client.workflowDefinitions().create(workflow(ns.prefix("assignees_" + strategy), strategy));
    try {
      Awaitility.await()
          .atMost(Duration.ofSeconds(30))
          .until(
              () ->
                  Boolean.TRUE.equals(
                      client
                          .workflowDefinitions()
                          .get(workflow.getId().toString(), "deployed")
                          .getDeployed()));
      WorkflowHandler.getInstance()
          .triggerByKey(
              workflow.getName(),
              UUID.randomUUID().toString(),
              Map.of(
                  "global_relatedEntity",
                  new MessageParser.EntityLink("domain", domain.getFullyQualifiedName())
                      .getLinkString(),
                  "global_updatedBy",
                  "admin",
                  "taskEntityId",
                  UUID.randomUUID().toString()));
      Awaitility.await()
          .atMost(Duration.ofSeconds(30))
          .untilAsserted(() -> assertEquals(1, tasks(domain).size()));
      final Task task = JsonUtils.convertValue(tasks(domain).get(0), Task.class);

      assertNotNull(task.getWorkflowInstanceId());
      assertEquals(TaskEntityStatus.Open, task.getStatus());
      if ("wait".equals(strategy)) {
        assertEquals(false, task.getUseEntityOwnerFallback());
        assertTrue(task.getAssignees().isEmpty());
      } else {
        assertEquals(true, task.getUseEntityOwnerFallback());
        assertEquals(
            List.of(owner.getId()), task.getAssignees().stream().map(ref -> ref.getId()).toList());
      }
    } finally {
      final var deleteParams = Map.of("hardDelete", "true", "recursive", "true");
      client.workflowDefinitions().delete(workflow.getId().toString(), deleteParams);
      tasks(domain).forEach(task -> client.tasks().delete(task.get("id").asText(), deleteParams));
      client.domains().delete(domain.getId().toString(), deleteParams);
    }
  }

  private static JsonNode tasks(final Domain domain) {
    return JsonUtils.readTree(
            SdkClients.adminClient()
                .getHttpClient()
                .executeForString(
                    HttpMethod.GET,
                    "/v1/tasks?fields=assignees,about&aboutEntity="
                        + domain.getFullyQualifiedName(),
                    null))
        .get("data");
  }

  private static CreateWorkflowDefinition workflow(final String name, final String strategy) {
    return JsonUtils.readValue(
        """
        {
          "name":"%s", "description":"Workflow assignee regression",
          "trigger":{"type":"noOp","config":{},"output":[]},
          "nodes":[
            {"type":"startEvent","subType":"startEvent","name":"start"},
            {"type":"userTask","subType":"userApprovalTask","name":"review",
             "config":{"assignees":{"addReviewers":false,"addOwners":false,
               "emptyAssigneeStrategy":"%s"}},
             "inputNamespaceMap":{"relatedEntity":"global"}},
            {"type":"endEvent","subType":"endEvent","name":"end"}
          ],
          "edges":[{"from":"start","to":"review"},{"from":"review","to":"end","condition":"true"},
            {"from":"review","to":"end","condition":"false"}],
          "config":{"storeStageStatus":false}
        }
        """
            .formatted(name, strategy),
        CreateWorkflowDefinition.class);
  }
}
