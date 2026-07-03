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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mockStatic;

import java.io.InputStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/**
 * Graph-structure validation of {@link WorkflowDefinitionRepository}. Regression guard for the
 * incident-task flakiness: {@code TestCaseResolutionTaskWorkflow} is a state machine with legitimate
 * cycles (New-&gt;Ack-&gt;New, Assigned self-reassign), so it must validate successfully — the old
 * cycle-rejecting check refused to deploy it on a fresh DB, stranding every incident task.
 */
class WorkflowDefinitionGraphValidationTest {

  private static final String INCIDENT_WORKFLOW =
      "json/data/governance/workflows/TestCaseResolutionTaskWorkflow.json";

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
    try (MockedStatic<Entity> ignored = mockStatic(Entity.class, RETURNS_DEEP_STUBS)) {
      WorkflowDefinitionRepository repository = new WorkflowDefinitionRepository();
      Method validate =
          WorkflowDefinitionRepository.class.getDeclaredMethod(
              "validateWorkflowGraphStructure", WorkflowDefinition.class);
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
