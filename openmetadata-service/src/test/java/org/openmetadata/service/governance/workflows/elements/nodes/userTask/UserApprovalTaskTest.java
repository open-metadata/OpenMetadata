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

import org.flowable.bpmn.model.BoundaryEvent;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SubProcess;
import org.flowable.bpmn.model.TimerEventDefinition;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.userTask.UserApprovalTaskDefinition;
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
