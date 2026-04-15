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

package org.openmetadata.service.governance.workflows.elements;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.ArrayList;
import java.util.List;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.CallActivity;
import org.flowable.bpmn.model.FlowElement;
import org.flowable.bpmn.model.MultiInstanceLoopCharacteristics;
import org.flowable.bpmn.model.Process;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.governance.workflows.elements.nodes.endEvent.EndEventDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.startEvent.StartEventDefinition;
import org.openmetadata.schema.governance.workflows.elements.triggers.PeriodicBatchEntityTriggerDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.elements.triggers.PeriodicBatchEntityTrigger;

class TriggerFactoryTest {

  @Test
  void testGetTriggerWorkflowId() {
    String workflowFQN = "MyWorkflow";
    String triggerId = TriggerFactory.getTriggerWorkflowId(workflowFQN);
    assertEquals("MyWorkflowTrigger", triggerId);
  }

  @Test
  void testGetMainWorkflowDefinitionNameFromTrigger() {
    String triggerName = "MyWorkflowTrigger";
    String mainName = TriggerFactory.getMainWorkflowDefinitionNameFromTrigger(triggerName);
    assertEquals("MyWorkflow", mainName);
  }

  @Test
  void testPeriodicBatchTrigger_CreatesCorrectTriggerType() {
    WorkflowDefinition workflow = createWorkflow();

    TriggerInterface trigger = TriggerFactory.createTrigger(workflow);

    assertNotNull(trigger);
    assertInstanceOf(PeriodicBatchEntityTrigger.class, trigger);
  }

  @Test
  void testPeriodicBatchTrigger_MultiInstanceLoop_WhenNoSinkTask() {
    WorkflowDefinition workflow = createWorkflow();

    TriggerInterface trigger = TriggerFactory.createTrigger(workflow);

    BpmnModel model = new BpmnModel();
    trigger.addToWorkflow(model);

    CallActivity callActivity = findCallActivity(model);
    assertNotNull(callActivity, "CallActivity should exist");
    MultiInstanceLoopCharacteristics loopChars =
        (MultiInstanceLoopCharacteristics) callActivity.getLoopCharacteristics();
    assertNotNull(loopChars, "CallActivity should have multi-instance loop when no SinkTask");
    assertEquals(
        "${numberOfEntities}",
        loopChars.getLoopCardinality(),
        "Cardinality should be ${numberOfEntities} when no SinkTask batch mode");
  }

  private CallActivity findCallActivity(BpmnModel model) {
    for (Process process : model.getProcesses()) {
      for (FlowElement element : process.getFlowElements()) {
        if (element instanceof CallActivity callActivity) {
          return callActivity;
        }
      }
    }
    return null;
  }

  private WorkflowDefinition createWorkflow() {
    WorkflowDefinition workflow = new WorkflowDefinition();
    workflow.setName("TestBatchWorkflow");
    workflow.setFullyQualifiedName("TestBatchWorkflow");
    workflow.setTrigger(createPeriodicBatchTrigger());

    List<WorkflowNodeDefinitionInterface> nodes = new ArrayList<>();
    nodes.add(createStartEvent());
    nodes.add(createEndEvent());
    workflow.setNodes(nodes);

    return workflow;
  }

  private PeriodicBatchEntityTriggerDefinition createPeriodicBatchTrigger() {
    String triggerJson =
        """
        {
          "type": "periodicBatchEntity",
          "config": {
            "schedule": {
              "scheduleTimeline": "None"
            },
            "entityTypes": ["glossaryTerm"],
            "batchSize": 500
          },
          "output": ["relatedEntity"]
        }
        """;
    return JsonUtils.readValue(triggerJson, PeriodicBatchEntityTriggerDefinition.class);
  }

  private StartEventDefinition createStartEvent() {
    StartEventDefinition startEvent = new StartEventDefinition();
    startEvent.setName("start");
    return startEvent;
  }

  private EndEventDefinition createEndEvent() {
    EndEventDefinition endEvent = new EndEventDefinition();
    endEvent.setName("end");
    return endEvent;
  }
}
