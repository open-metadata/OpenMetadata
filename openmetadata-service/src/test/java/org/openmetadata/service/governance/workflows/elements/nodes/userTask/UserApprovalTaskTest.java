/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.governance.workflows.elements.nodes.userTask;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.flowable.bpmn.model.BoundaryEvent;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.ExclusiveGateway;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.SubProcess;
import org.flowable.bpmn.model.TerminateEventDefinition;
import org.flowable.bpmn.model.TimerEventDefinition;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.userTask.UserApprovalTaskDefinition;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.utils.JsonUtils;

class UserApprovalTaskTest {

  @Test
  void expiryTimerUsesAbsoluteTimeDateWhenDateVariableIsConfigured() {
    UserApprovalTaskDefinition definition =
        JsonUtils.readValue(USER_TASK_WITH_DATE_TIMER, UserApprovalTaskDefinition.class);
    UserApprovalTask task =
        new UserApprovalTask(definition, new WorkflowConfiguration().withStoreStageStatus(false));
    BpmnModel model = new BpmnModel();
    Process process = new Process();

    task.addToWorkflow(model, process);

    SubProcess subProcess = (SubProcess) process.getFlowElement("Review");
    BoundaryEvent boundary =
        (BoundaryEvent) subProcess.getFlowElement("Review.expiryTimerBoundary");
    TimerEventDefinition timer = (TimerEventDefinition) boundary.getEventDefinitions().getFirst();
    assertEquals("${accessExpirationDate}", timer.getTimeDate());
    assertNull(timer.getTimeDuration());
  }

  @Test
  void approvalTaskThatHoldsChangesPublishesOrDiscardsBeforeLeaving() {
    SubProcess subProcess = build(true);

    ExclusiveGateway decision =
        (ExclusiveGateway) subProcess.getFlowElement("Review.decisionGateway");
    assertEquals(List.of("Review.decisionGateway"), targetsOf(subProcess, "Review.approvalTask"));
    assertEquals(
        List.of("Review.decisionGateway"), targetsOf(subProcess, "Review.autoApproveUserTask"));
    assertEquals(
        "${Review_result == 'approve' || Review_result == 'true'}",
        flow(subProcess, "Review.publishChange_flow").getConditionExpression());
    assertEquals(
        "${Review_result == 'reject' || Review_result == 'false'}",
        flow(subProcess, "Review.discardChange_flow").getConditionExpression());
    assertEquals(
        "${Review_result == 'partialApprove'}",
        flow(subProcess, "Review.publishAgreedChanges_flow").getConditionExpression());
    assertEquals(
        "${Review_result == 'partialReject'}",
        flow(subProcess, "Review.discardRejectedChanges_flow").getConditionExpression());
    assertEquals("Review.undecidedFlow", decision.getDefaultFlow());

    // Partial decisions return to the review; whole decisions leave the approval step.
    assertEquals(
        List.of("Review.agreedAppliedGateway"),
        targetsOf(subProcess, "Review.publishAgreedChanges"));
    assertEquals(
        "Review.setAssigneesVariable", flow(subProcess, "Review.agreedAppliedFlow").getTargetRef());
    assertEquals(
        "Review.agreedNotAppliedEvent",
        flow(subProcess, "Review.agreedNotAppliedFlow").getTargetRef());
    assertEquals(
        List.of("Review.setAssigneesVariable"),
        targetsOf(subProcess, "Review.discardRejectedChanges"));
    assertEquals(List.of("Review.appliedGateway"), targetsOf(subProcess, "Review.publishChange"));
    assertEquals(List.of("Review.endEvent"), targetsOf(subProcess, "Review.discardChange"));
    assertEquals(
        "${Review_heldChangeResult == 'notApplied'}",
        flow(subProcess, "Review.notAppliedFlow").getConditionExpression());
    EndEvent notApplied = (EndEvent) subProcess.getFlowElement("Review.notAppliedEvent");
    assertTrue(
        ((TerminateEventDefinition) notApplied.getEventDefinitions().getFirst()).isTerminateAll());
  }

  @Test
  void approvalTaskThatDoesNotHoldChangesEndsOnTheDecision() {
    SubProcess subProcess = build(false);

    assertEquals(List.of("Review.endEvent"), targetsOf(subProcess, "Review.approvalTask"));
    assertEquals(List.of("Review.endEvent"), targetsOf(subProcess, "Review.autoApproveUserTask"));
    assertNull(subProcess.getFlowElement("Review.decisionGateway"));
    assertNull(subProcess.getFlowElement("Review.publishChange"));
    assertNull(subProcess.getFlowElement("Review.discardChange"));
  }

  @Test
  void expiryOfAnApprovalTaskThatHoldsChangesIsSettledLikeADecision() {
    UserApprovalTaskDefinition definition =
        JsonUtils.readValue(USER_TASK_WITH_DATE_TIMER, UserApprovalTaskDefinition.class);
    Process process = new Process();
    new UserApprovalTask(
            definition,
            new WorkflowConfiguration().withStoreStageStatus(false),
            TaskEntityType.GlossaryApproval,
            TaskCategory.Approval,
            true)
        .addToWorkflow(new BpmnModel(), process);
    SubProcess subProcess = (SubProcess) process.getFlowElement("Review");

    assertEquals(List.of("Review.decisionGateway"), targetsOf(subProcess, "Review.expireOnTimer"));
  }

  private static SubProcess build(boolean holdsChanges) {
    UserApprovalTaskDefinition definition =
        JsonUtils.readValue(USER_TASK, UserApprovalTaskDefinition.class);
    Process process = new Process();
    new UserApprovalTask(
            definition,
            new WorkflowConfiguration().withStoreStageStatus(false),
            TaskEntityType.GlossaryApproval,
            TaskCategory.Approval,
            holdsChanges)
        .addToWorkflow(new BpmnModel(), process);
    return (SubProcess) process.getFlowElement("Review");
  }

  private static List<String> targetsOf(SubProcess subProcess, String source) {
    return subProcess.getFlowElements().stream()
        .filter(SequenceFlow.class::isInstance)
        .map(SequenceFlow.class::cast)
        .filter(flow -> source.equals(flow.getSourceRef()))
        .map(SequenceFlow::getTargetRef)
        .toList();
  }

  private static SequenceFlow flow(SubProcess subProcess, String id) {
    return (SequenceFlow) subProcess.getFlowElement(id);
  }

  private static final String USER_TASK =
      """
      {
        "type": "userTask",
        "subType": "userApprovalTask",
        "name": "Review",
        "config": {
          "assignees": {"addReviewers": true},
          "approvalThreshold": 1,
          "rejectionThreshold": 1,
          "allowPartialDecisions": true
        },
        "inputNamespaceMap": {"relatedEntity": "global"}
      }
      """;

  private static final String USER_TASK_WITH_DATE_TIMER =
      """
      {
        "type": "userTask",
        "subType": "userApprovalTask",
        "name": "Review",
        "displayName": "Review",
        "config": {
          "assignees": {
            "addReviewers": true,
            "addOwners": false,
            "candidates": [],
            "emptyAssigneeStrategy": "assignAdmins"
          },
          "approvalThreshold": 1,
          "rejectionThreshold": 1,
          "stageId": "review",
          "stageDisplayName": "Review",
          "taskStatus": "Open",
          "assigneeStrategy": "reviewers-and-assignees",
          "transitionMetadata": [
            {
              "id": "approve",
              "label": "Approve",
              "targetStageId": "approved",
              "targetTaskStatus": "Approved",
              "requiresComment": false
            }
          ],
          "expiryTimer": {
            "dateVariable": "accessExpirationDate",
            "transitionId": "expired",
            "closeAsResolution": "Expired"
          }
        },
        "inputNamespaceMap": {"relatedEntity": "global"}
      }
      """;
}
