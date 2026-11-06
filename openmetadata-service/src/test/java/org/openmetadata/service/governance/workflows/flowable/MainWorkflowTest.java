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

package org.openmetadata.service.governance.workflows.flowable;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.TerminateEventDefinition;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.utils.JsonUtils;

class MainWorkflowTest {

  private static final String START_TO_END =
      """
      {
        "name": "startToEnd",
        "fullyQualifiedName": "startToEnd",
        "trigger": {"type": "noOp", "output": []},
        "config": {"storeStageStatus": false},
        "nodes": [
          {"name": "start", "type": "startEvent", "subType": "startEvent"},
          {"name": "end", "type": "endEvent", "subType": "endEvent"}
        ],
        "edges": [{"from": "start", "to": "end"}]
      }""";

  /**
   * A branch that throws reaches the Error end event; terminating there ends the run's other
   * branches, which would otherwise wait at a parallel join forever. Only this run ends: the
   * trigger's call activity resumes and the other runs of a periodic batch go on.
   */
  @Test
  void errorEndEventTerminatesOnlyTheRunThatReachedIt() {
    Process process =
        new MainWorkflow(JsonUtils.readValue(START_TO_END, WorkflowDefinition.class))
            .getModel()
            .getMainProcess();

    EndEvent error = (EndEvent) process.getFlowElement(MainWorkflow.ERROR_END_EVENT_ID);
    assertEquals(1, error.getEventDefinitions().size());
    TerminateEventDefinition terminate =
        assertInstanceOf(TerminateEventDefinition.class, error.getEventDefinitions().getFirst());
    assertFalse(terminate.isTerminateAll());
    assertFalse(terminate.isTerminateMultiInstance());
    assertTrue(((EndEvent) process.getFlowElement("end")).getEventDefinitions().isEmpty());
  }
}
