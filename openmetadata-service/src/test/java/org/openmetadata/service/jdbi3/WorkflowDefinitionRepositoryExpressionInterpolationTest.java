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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;

class WorkflowDefinitionRepositoryExpressionInterpolationTest {

  @Test
  void acceptsApprovalNodeBareVariableNames() {
    assertDoesNotThrow(
        () ->
            WorkflowDefinitionRepository.validateExpressionInterpolation(workflow(USER_TASK_DATE)));
    assertDoesNotThrow(
        () ->
            WorkflowDefinitionRepository.validateExpressionInterpolation(
                workflow(USER_TASK_DURATION)));
  }

  @Test
  void rejectsApprovalNodeExpressionCharacterTimerVariable() {
    // The timer's process-variable name is interpolated alone inside a JUEL expression, so every
    // non-reference character (here and below) reaches generated expression code position.
    for (String badVariable :
        new String[] {
          "has space",
          "a'z",
          "a.1",
          "accessDuration;}${x",
          "accessDuration;x",
          "T(java.lang.Runtime)"
        }) {
      BadRequestException exception =
          assertThrows(
              BadRequestException.class,
              () ->
                  WorkflowDefinitionRepository.validateExpressionInterpolation(
                      workflow(USER_TASK_DURATION.replace("accessDuration", badVariable))),
              "expected rejection for " + badVariable);
      assertTrue(exception.getMessage().contains("expiryTimer.durationVariable"));
    }
  }

  @Test
  void rejectsApprovalNodeExpressionCharacterDateVariable() {
    assertThrows(
        BadRequestException.class,
        () ->
            WorkflowDefinitionRepository.validateExpressionInterpolation(
                workflow(USER_TASK_DATE.replace("accessExpirationDate", "a\\b"))));
  }

  @Test
  void rejectsExpressionCharacterNodeNamesOnApprovalNodes() {
    assertThrows(
        BadRequestException.class,
        () ->
            WorkflowDefinitionRepository.validateExpressionInterpolation(
                workflow(USER_TASK_DURATION.replace("ApproveAccess", "a'z"))));
    // The other node kinds keep the broader entityName charset: their names never reach an
    // expression.
    assertDoesNotThrow(
        () ->
            WorkflowDefinitionRepository.validateExpressionInterpolation(
                workflow(NON_INTERPOLATED_NODE.replace("SetStatus", "a'z"))));
  }

  private static WorkflowDefinition workflow(String nodeJson) {
    WorkflowNodeDefinitionInterface node =
        JsonUtils.readValue(nodeJson, WorkflowNodeDefinitionInterface.class);
    return new WorkflowDefinition().withName("wf").withNodes(List.of(node));
  }

  private static final String USER_TASK_DATE =
      """
        {
          "type": "userTask",
          "subType": "userApprovalTask",
          "name": "ApproveAccess",
          "config": {
            "assignees": {"addReviewers": true},
            "expiryTimer": {"dateVariable": "accessExpirationDate", "transitionId": "expired"}
          }
        }
        """;

  private static final String USER_TASK_DURATION =
      """
        {
          "type": "userTask",
          "subType": "userApprovalTask",
          "name": "ApproveAccess",
          "config": {
            "assignees": {"addReviewers": true},
            "expiryTimer": {"durationVariable": "accessDuration", "transitionId": "expired"}
          }
        }
        """;

  private static final String NON_INTERPOLATED_NODE =
      """
        {
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "name": "SetStatus",
          "input": ["relatedEntity"],
          "output": ["updatedBy"]
        }
        """;
}
