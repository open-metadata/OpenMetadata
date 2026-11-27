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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.StartEvent;
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
   * A pre-1.7.1 WorkflowDefinition can be stored with {@code config = null}: the JSON schema does
   * not require {@code config}, and the v1.7.1 backfill that writes a default
   * WorkflowConfiguration is the only writer — so a definition whose backfill was skipped (the
   * v1.7.1 migration swallowed the backfill failure and recorded itself complete) is left with
   * {@code config = null}. The node builders dereference {@code config.getStoreStageStatus()},
   * which used to throw a raw NullPointerException on every edit/redeploy and leave the workflow
   * permanently un-editable. MainWorkflow now builds with an effective config defaulting to
   * {@code storeStageStatus = false} (the same default the backfill writes), so such a legacy
   * definition still builds and can be repaired by a save.
   */
  private static final String START_TO_END_NULL_CONFIG =
      """
      {
        "name": "startToEndNullConfig",
        "fullyQualifiedName": "startToEndNullConfig",
        "trigger": {"type": "noOp", "output": []},
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

  /**
   * A legacy WorkflowDefinition stored with {@code config = null} builds without throwing — the
   * node builders receive an effective config defaulting to {@code storeStageStatus = false}
   * instead of dereferencing null. Without this, {@code new MainWorkflow(...)} throws
   * NullPointerException from {@code config.getStoreStageStatus()} on the StartEvent, so the
   * workflow can never be edited, redeployed, or repaired by a save.
   */
  @Test
  void nullConfigBuildsWithoutNullPointerException() {
    WorkflowDefinition definition =
        JsonUtils.readValue(START_TO_END_NULL_CONFIG, WorkflowDefinition.class);

    // Sanity: the stored definition really has no config, so this is the legacy broken state.
    assertNull(definition.getConfig());

    Process process = new MainWorkflow(definition).getModel().getMainProcess();

    // The start and end nodes were built (their constructors call config.getStoreStageStatus())
    // and added to the process without throwing a NullPointerException.
    assertNotNull(process.getFlowElement("start"));
    assertInstanceOf(StartEvent.class, process.getFlowElement("start"));
    assertNotNull(process.getFlowElement("end"));
    assertInstanceOf(EndEvent.class, process.getFlowElement("end"));
  }
}
