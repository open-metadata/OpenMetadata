/*
 *  Copyright 2025 Collate
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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mockStatic;

import java.io.InputStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SetEntityAttributeTaskDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;

/**
 * Graph-structure validation of {@link WorkflowDefinitionRepository}. Regression guard for the
 * incident-task flakiness: {@code TestCaseResolutionTaskWorkflow} is a state machine with legitimate
 * cycles (New-&gt;Ack-&gt;New, Assigned self-reassign), so it must validate successfully — the old
 * cycle-rejecting check refused to deploy it on a fresh DB, stranding every incident task.
 */
class WorkflowDefinitionGraphValidationTest {

  private static final String INCIDENT_WORKFLOW =
      "json/data/governance/workflows/TestCaseResolutionTaskWorkflow.json";
  private static final String METRIC_APPROVAL_WORKFLOW =
      "json/data/governance/workflows/MetricApprovalWorkflow.json";

  @Test
  void cyclicStateMachineWorkflowPassesGraphValidation() throws Exception {
    WorkflowDefinition workflow = loadWorkflow(INCIDENT_WORKFLOW);

    boolean hasBackEdge =
        workflow.getEdges().stream()
            .anyMatch(e -> "AckStage".equals(e.getFrom()) && "NewStage".equals(e.getTo()));
    assertTrue(hasBackEdge, "fixture must contain the legitimate Ack->New back edge (a cycle)");

    assertDoesNotThrow(
        () -> validateGraph(workflow), "cycles are valid in workflow state machines");
  }

  /**
   * A userApprovalTask node with expiryTimer.transitionId set emits an outgoing edge condition
   * named after that transitionId when the boundary timer fires. The validator must treat that
   * transitionId as a declared transition so the edge condition doesn't fail the
   * "conditions not declared in transitionMetadata" check.
   */
  @Test
  void expiryTimerTransitionIdCountsAsDeclaredTransition() throws Exception {
    WorkflowDefinition workflow =
        JsonUtils.readValue(EXPIRY_TIMER_WORKFLOW_JSON, WorkflowDefinition.class);
    assertDoesNotThrow(
        () -> validateGraph(workflow),
        "expiryTimer.transitionId should be treated as a declared transition");
  }

  @Test
  void metricApprovalWorkflowSeedPassesGraphValidation() throws Exception {
    WorkflowDefinition workflow = loadWorkflow(METRIC_APPROVAL_WORKFLOW);

    assertDoesNotThrow(
        () -> validateGraph(workflow),
        "the shipped Metric approval workflow must be deployable during seed bootstrap");
    assertTrue(
        workflow.getNodes().stream()
            .anyMatch(node -> "rollbackEntityTask".equals(node.getSubType())),
        "update rejection must retain the rollback task");
    assertEdge(workflow, "ApproveMetric", "SetMetricStatusToRejected", "reject");
    assertEdge(workflow, "ApprovalForUpdates", "RollbackMetricChanges", "reject");

    WorkflowNodeDefinitionInterface rejectionNode =
        workflow.getNodes().stream()
            .filter(node -> "SetMetricStatusToRejected".equals(node.getName()))
            .findFirst()
            .orElseThrow();
    SetEntityAttributeTaskDefinition rejectionTask =
        assertInstanceOf(SetEntityAttributeTaskDefinition.class, rejectionNode);
    assertEquals("status", rejectionTask.getConfig().getFieldName());
    assertEquals("Rejected", rejectionTask.getConfig().getFieldValue());
  }

  @Test
  void enforceModeAcceptsOneApprovalTask() {
    WorkflowDefinition workflow =
        enforceWorkflow(
            List.of(approvalNode("Review", "")),
            List.of(
                edge("Start", "Review", null),
                edge("Review", "End", "approve"),
                edge("Review", "End", "reject")));
    assertDoesNotThrow(() -> validate("validateEnforceMode", workflow));
    assertDoesNotThrow(() -> validate("validateConditionalTasks", workflow));
  }

  @Test
  void enforceModeAcceptsApprovalTasksOnSeparateBranches() {
    WorkflowDefinition workflow =
        enforceWorkflow(
            List.of(checkNode("Route"), approvalNode("ReviewA", ""), approvalNode("ReviewB", "")),
            List.of(
                edge("Start", "Route", null),
                edge("Route", "ReviewA", "true"),
                edge("Route", "ReviewB", "false"),
                edge("ReviewA", "End", "approve"),
                edge("ReviewA", "End", "reject"),
                edge("ReviewB", "End", "approve"),
                edge("ReviewB", "End", "reject")));
    assertDoesNotThrow(() -> validate("validateEnforceMode", workflow));
  }

  @Test
  void enforceModeRefusesTwoApprovalTasksOnOnePath() {
    WorkflowDefinition workflow =
        enforceWorkflow(
            List.of(approvalNode("First", ""), checkNode("Route"), approvalNode("Second", "")),
            List.of(
                edge("Start", "First", null),
                edge("First", "Route", "approve"),
                edge("First", "End", "reject"),
                edge("Route", "Second", "true"),
                edge("Route", "End", "false"),
                edge("Second", "End", "approve"),
                edge("Second", "End", "reject")));
    BadRequestException error =
        assertThrows(BadRequestException.class, () -> validate("validateEnforceMode", workflow));
    assertTrue(error.getMessage().contains("on the same path"), error.getMessage());
  }

  @Test
  void enforceModeRefusesAPathThatSkipsTheApprovalTask() {
    WorkflowDefinition workflow =
        enforceWorkflow(
            List.of(checkNode("Route"), approvalNode("Review", "")),
            List.of(
                edge("Start", "Route", null),
                edge("Route", "Review", "true"),
                edge("Route", "End", "false"),
                edge("Review", "End", "approve"),
                edge("Review", "End", "reject")));
    BadRequestException error =
        assertThrows(BadRequestException.class, () -> validate("validateEnforceMode", workflow));
    assertTrue(error.getMessage().contains("without a user approval task"), error.getMessage());
  }

  @Test
  void enforceModeRefusesAWorkflowWithoutAnApprovalTask() {
    WorkflowDefinition workflow =
        enforceWorkflow(List.of(checkNode("Route")), List.of(edge("Start", "Route", null)));
    BadRequestException error =
        assertThrows(BadRequestException.class, () -> validate("validateEnforceMode", workflow));
    assertTrue(error.getMessage().contains("no user approval task"), error.getMessage());
  }

  @Test
  void enforceModeRefusesAnApprovalTransitionOtherThanApproveOrReject() {
    String transitions =
        """
        ,"transitionMetadata": [{"id": "approve", "label": "Approve"},
                                {"id": "reject", "label": "Reject"},
                                {"id": "escalate", "label": "Escalate"}]""";
    WorkflowDefinition workflow =
        enforceWorkflow(
            List.of(approvalNode("Review", transitions)), List.of(edge("Start", "Review", null)));
    BadRequestException error =
        assertThrows(BadRequestException.class, () -> validate("validateEnforceMode", workflow));
    assertTrue(error.getMessage().contains("'escalate'"), error.getMessage());
  }

  @Test
  void partialDecisionsNeedEnforceMode() {
    WorkflowDefinition workflow =
        enforceWorkflow(
            List.of(approvalNode("Review", ",\"allowPartialDecisions\": true")),
            List.of(
                edge("Start", "Review", null),
                edge("Review", "End", "approve"),
                edge("Review", "End", "reject")));
    assertDoesNotThrow(() -> validate("validateConditionalTasks", workflow));

    String defaultMode = JsonUtils.pojoToJson(workflow).replace("\"Enforce\"", "\"Default\"");
    WorkflowDefinition defaultWorkflow = JsonUtils.readValue(defaultMode, WorkflowDefinition.class);
    BadRequestException error =
        assertThrows(
            BadRequestException.class, () -> validate("validateConditionalTasks", defaultWorkflow));
    assertTrue(error.getMessage().contains("Enforce approval mode"), error.getMessage());
  }

  @Test
  void partialDecisionEdgesAreRefused() {
    WorkflowDefinition workflow =
        enforceWorkflow(
            List.of(approvalNode("Review", ",\"allowPartialDecisions\": true")),
            List.of(
                edge("Start", "Review", null),
                edge("Review", "End", "approve"),
                edge("Review", "End", "reject"),
                edge("Review", "End", "partialApprove")));
    BadRequestException error =
        assertThrows(
            BadRequestException.class, () -> validate("validateConditionalTasks", workflow));
    assertTrue(error.getMessage().contains("'partialApprove'"), error.getMessage());
  }

  private static WorkflowDefinition enforceWorkflow(List<String> nodes, List<String> edges) {
    String json =
        """
        {
          "name": "EnforceFixture",
          "fullyQualifiedName": "EnforceFixture",
          "trigger": {"type": "eventBasedEntity",
                      "config": {"approvalMode": "Enforce", "entityTypes": ["glossaryTerm"],
                                 "events": ["Updated"], "include": ["description"],
                                 "filter": {}},
                      "output": ["relatedEntity", "updatedBy"]},
          "nodes": [
            {"type": "startEvent", "subType": "startEvent", "name": "Start"},
            %s,
            {"type": "endEvent", "subType": "endEvent", "name": "End"}
          ],
          "edges": [%s]
        }
        """
            .formatted(String.join(",", nodes), String.join(",", edges));
    return JsonUtils.readValue(json, WorkflowDefinition.class);
  }

  private static String approvalNode(String name, String extraConfig) {
    return """
        {"type": "userTask", "subType": "userApprovalTask", "name": "%s",
         "config": {"assignees": {"addReviewers": true}, "approvalThreshold": 1,
                    "rejectionThreshold": 1%s},
         "inputNamespaceMap": {"relatedEntity": "global"}}"""
        .formatted(name, extraConfig);
  }

  private static String checkNode(String name) {
    return """
        {"type": "automatedTask", "subType": "checkEntityAttributesTask", "name": "%s",
         "config": {"rules": "{\\"==\\":[1,1]}"},
         "inputNamespaceMap": {"relatedEntity": "global"}}"""
        .formatted(name);
  }

  private static String edge(String from, String to, String condition) {
    return condition == null
        ? "{\"from\": \"%s\", \"to\": \"%s\"}".formatted(from, to)
        : "{\"from\": \"%s\", \"to\": \"%s\", \"condition\": \"%s\"}"
            .formatted(from, to, condition);
  }

  private void assertEdge(WorkflowDefinition workflow, String from, String to, String condition) {
    assertTrue(
        workflow.getEdges().stream()
            .anyMatch(
                edge ->
                    from.equals(edge.getFrom())
                        && to.equals(edge.getTo())
                        && condition.equals(edge.getCondition())),
        () -> "expected workflow edge " + from + " -> " + to + " on " + condition);
  }

  private static final String EXPIRY_TIMER_WORKFLOW_JSON =
      """
      {
        "name": "ExpiryTimerFixture",
        "fullyQualifiedName": "ExpiryTimerFixture",
        "displayName": "Expiry Timer Fixture",
        "description": "Regression: expiryTimer.transitionId must satisfy validator.",
        "trigger": {"type": "noOp", "config": {}, "output": ["relatedEntity"]},
        "nodes": [
          {"type": "startEvent", "subType": "startEvent",
           "name": "Start", "displayName": "Start"},
          {"type": "userTask", "subType": "userApprovalTask",
           "name": "Review", "displayName": "Review",
           "config": {
             "assignees": {"addReviewers": true, "addOwners": false,
                           "candidates": [], "emptyAssigneeStrategy": "assignAdmins"},
             "approvalThreshold": 1, "rejectionThreshold": 1,
             "stageId": "review", "stageDisplayName": "Review", "taskStatus": "Open",
             "assigneeStrategy": "reviewers-and-assignees",
             "transitionMetadata": [
               {"id": "approve", "label": "Approve",
                "targetStageId": "approved", "targetTaskStatus": "Approved",
                "requiresComment": false}
             ],
             "expiryTimer": {"durationVariable": "reviewDuration",
                             "transitionId": "expired",
                             "closeAsResolution": "Expired"}
           },
           "inputNamespaceMap": {"relatedEntity": "global"}},
          {"type": "endEvent", "subType": "endEvent",
           "name": "ApprovedEnd", "displayName": "Approved"},
          {"type": "endEvent", "subType": "endEvent",
           "name": "ExpiredEnd", "displayName": "Expired"}
        ],
        "edges": [
          {"from": "Start", "to": "Review"},
          {"from": "Review", "to": "ApprovedEnd", "condition": "approve"},
          {"from": "Review", "to": "ExpiredEnd", "condition": "expired"}
        ]
      }
      """;

  private void validateGraph(WorkflowDefinition workflow) throws Throwable {
    validate("validateWorkflowGraphStructure", workflow);
  }

  private void validate(String validation, WorkflowDefinition workflow) throws Throwable {
    try (MockedStatic<Entity> ignored = mockStatic(Entity.class, RETURNS_DEEP_STUBS)) {
      WorkflowDefinitionRepository repository = new WorkflowDefinitionRepository();
      Method validate =
          WorkflowDefinitionRepository.class.getDeclaredMethod(
              validation, WorkflowDefinition.class);
      validate.setAccessible(true);
      try {
        validate.invoke(repository, workflow);
      } catch (InvocationTargetException e) {
        throw e.getCause();
      }
    }
  }

  private WorkflowDefinition loadWorkflow(String resource) throws Exception {
    try (InputStream in = getClass().getClassLoader().getResourceAsStream(resource)) {
      assertTrue(in != null, "workflow resource not found on classpath: " + resource);
      String json = new String(in.readAllBytes(), StandardCharsets.UTF_8);
      return JsonUtils.readValue(json, WorkflowDefinition.class);
    }
  }
}
