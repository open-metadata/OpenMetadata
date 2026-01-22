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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.Config__6;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SinkConfig;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SinkTaskDefinition;
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
  void testPeriodicBatchTrigger_WithBatchModeNode_UsesSingleExecution() {
    WorkflowDefinition workflow = createWorkflowWithBatchSink(true);

    TriggerInterface trigger = TriggerFactory.createTrigger(workflow);

    assertNotNull(trigger);
    assertTrue(trigger instanceof PeriodicBatchEntityTrigger);

    // Verify single execution mode by checking the BPMN model
    BpmnModel model = new BpmnModel();
    trigger.addToWorkflow(model);

    // Find the CallActivity and verify cardinality is "1"
    CallActivity callActivity = findCallActivity(model);
    assertNotNull(callActivity, "CallActivity should exist");

    MultiInstanceLoopCharacteristics loopChars =
        (MultiInstanceLoopCharacteristics) callActivity.getLoopCharacteristics();
    assertNotNull(loopChars, "Loop characteristics should exist");
    assertEquals("1", loopChars.getLoopCardinality(), "Cardinality should be 1 for batch mode");
  }

  @Test
  void testPeriodicBatchTrigger_WithoutBatchModeNode_UsesMultipleExecutions() {
    WorkflowDefinition workflow = createWorkflowWithBatchSink(false);

    TriggerInterface trigger = TriggerFactory.createTrigger(workflow);

    assertNotNull(trigger);
    assertTrue(trigger instanceof PeriodicBatchEntityTrigger);

    BpmnModel model = new BpmnModel();
    trigger.addToWorkflow(model);

    CallActivity callActivity = findCallActivity(model);
    assertNotNull(callActivity, "CallActivity should exist");

    MultiInstanceLoopCharacteristics loopChars =
        (MultiInstanceLoopCharacteristics) callActivity.getLoopCharacteristics();
    assertNotNull(loopChars, "Loop characteristics should exist");
    assertEquals(
        "${numberOfEntities}",
        loopChars.getLoopCardinality(),
        "Cardinality should be ${numberOfEntities} for non-batch mode");
  }

  @Test
  void testPeriodicBatchTrigger_WithNoSinkNodes_UsesMultipleExecutions() {
    WorkflowDefinition workflow = createWorkflowWithoutSink();

    TriggerInterface trigger = TriggerFactory.createTrigger(workflow);

    assertNotNull(trigger);

    BpmnModel model = new BpmnModel();
    trigger.addToWorkflow(model);

    CallActivity callActivity = findCallActivity(model);
    assertNotNull(callActivity, "CallActivity should exist");

    MultiInstanceLoopCharacteristics loopChars =
        (MultiInstanceLoopCharacteristics) callActivity.getLoopCharacteristics();
    assertEquals(
        "${numberOfEntities}",
        loopChars.getLoopCardinality(),
        "Cardinality should be ${numberOfEntities} when no sink nodes");
  }

  @Test
  void testPeriodicBatchTrigger_WithNullNodes_UsesMultipleExecutions() {
    WorkflowDefinition workflow = createWorkflowWithNullNodes();

    TriggerInterface trigger = TriggerFactory.createTrigger(workflow);

    assertNotNull(trigger);

    BpmnModel model = new BpmnModel();
    trigger.addToWorkflow(model);

    CallActivity callActivity = findCallActivity(model);
    assertNotNull(callActivity, "CallActivity should exist");

    MultiInstanceLoopCharacteristics loopChars =
        (MultiInstanceLoopCharacteristics) callActivity.getLoopCharacteristics();
    assertEquals(
        "${numberOfEntities}",
        loopChars.getLoopCardinality(),
        "Cardinality should be ${numberOfEntities} when nodes is null");
  }

  @Test
  void testPeriodicBatchTrigger_WithMultipleSinkNodes_OneBatchMode_UsesSingleExecution() {
    WorkflowDefinition workflow = createWorkflowWithMultipleSinks();

    TriggerInterface trigger = TriggerFactory.createTrigger(workflow);

    BpmnModel model = new BpmnModel();
    trigger.addToWorkflow(model);

    CallActivity callActivity = findCallActivity(model);
    MultiInstanceLoopCharacteristics loopChars =
        (MultiInstanceLoopCharacteristics) callActivity.getLoopCharacteristics();

    // If ANY sink has batchMode=true, should use single execution
    assertEquals(
        "1",
        loopChars.getLoopCardinality(),
        "Cardinality should be 1 if any sink has batchMode=true");
  }

  @Test
  void testPeriodicBatchTrigger_WithSinkBatchModeNotSet_DefaultsToSingleExecution() {
    // When batchMode is not explicitly set, it should default to true per schema
    WorkflowDefinition workflow = createWorkflowWithSinkBatchModeNotSet();

    TriggerInterface trigger = TriggerFactory.createTrigger(workflow);

    BpmnModel model = new BpmnModel();
    trigger.addToWorkflow(model);

    CallActivity callActivity = findCallActivity(model);
    MultiInstanceLoopCharacteristics loopChars =
        (MultiInstanceLoopCharacteristics) callActivity.getLoopCharacteristics();

    assertEquals(
        "1",
        loopChars.getLoopCardinality(),
        "Cardinality should be 1 when batchMode not set (defaults to true)");
  }

  private CallActivity findCallActivity(BpmnModel model) {
    for (Process process : model.getProcesses()) {
      for (FlowElement element : process.getFlowElements()) {
        if (element instanceof CallActivity) {
          return (CallActivity) element;
        }
      }
    }
    return null;
  }

  private WorkflowDefinition createWorkflowWithBatchSink(boolean batchMode) {
    WorkflowDefinition workflow = new WorkflowDefinition();
    workflow.setName("TestBatchWorkflow");
    workflow.setFullyQualifiedName("TestBatchWorkflow");

    // Create periodic batch trigger using JSON
    PeriodicBatchEntityTriggerDefinition trigger = createPeriodicBatchTrigger();
    workflow.setTrigger(trigger);

    // Create nodes with sink task
    List<WorkflowNodeDefinitionInterface> nodes = new ArrayList<>();
    nodes.add(createStartEvent());
    nodes.add(createSinkTask("gitSink", batchMode));
    nodes.add(createEndEvent());
    workflow.setNodes(nodes);

    return workflow;
  }

  private WorkflowDefinition createWorkflowWithoutSink() {
    WorkflowDefinition workflow = new WorkflowDefinition();
    workflow.setName("TestNoSinkWorkflow");
    workflow.setFullyQualifiedName("TestNoSinkWorkflow");

    PeriodicBatchEntityTriggerDefinition trigger = createPeriodicBatchTrigger();
    workflow.setTrigger(trigger);

    List<WorkflowNodeDefinitionInterface> nodes = new ArrayList<>();
    nodes.add(createStartEvent());
    nodes.add(createEndEvent());
    workflow.setNodes(nodes);

    return workflow;
  }

  private WorkflowDefinition createWorkflowWithNullNodes() {
    WorkflowDefinition workflow = new WorkflowDefinition();
    workflow.setName("TestNullNodesWorkflow");
    workflow.setFullyQualifiedName("TestNullNodesWorkflow");

    PeriodicBatchEntityTriggerDefinition trigger = createPeriodicBatchTrigger();
    workflow.setTrigger(trigger);

    workflow.setNodes(null);

    return workflow;
  }

  private WorkflowDefinition createWorkflowWithMultipleSinks() {
    WorkflowDefinition workflow = new WorkflowDefinition();
    workflow.setName("TestMultiSinkWorkflow");
    workflow.setFullyQualifiedName("TestMultiSinkWorkflow");

    PeriodicBatchEntityTriggerDefinition trigger = createPeriodicBatchTrigger();
    workflow.setTrigger(trigger);

    List<WorkflowNodeDefinitionInterface> nodes = new ArrayList<>();
    nodes.add(createStartEvent());
    nodes.add(createSinkTask("webhookSink", false)); // batchMode=false
    nodes.add(createSinkTask("gitSink", true)); // batchMode=true
    nodes.add(createEndEvent());
    workflow.setNodes(nodes);

    return workflow;
  }

  private WorkflowDefinition createWorkflowWithSinkBatchModeNotSet() {
    WorkflowDefinition workflow = new WorkflowDefinition();
    workflow.setName("TestDefaultBatchModeWorkflow");
    workflow.setFullyQualifiedName("TestDefaultBatchModeWorkflow");

    PeriodicBatchEntityTriggerDefinition trigger = createPeriodicBatchTrigger();
    workflow.setTrigger(trigger);

    List<WorkflowNodeDefinitionInterface> nodes = new ArrayList<>();
    nodes.add(createStartEvent());
    nodes.add(createSinkTaskWithoutBatchMode("gitSink")); // batchMode not set
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

  private SinkTaskDefinition createSinkTask(String name, boolean batchMode) {
    SinkTaskDefinition sinkTask = new SinkTaskDefinition();
    sinkTask.setName(name);

    Config__6 config = new Config__6();
    config.setSinkType(Config__6.SinkType.GIT);
    config.setSyncMode(Config__6.SyncMode.OVERWRITE);
    config.setOutputFormat(Config__6.OutputFormat.YAML);
    config.setBatchMode(batchMode);
    config.setTimeoutSeconds(300);

    SinkConfig sinkConfig = new SinkConfig();
    sinkConfig.setAdditionalProperty("repositoryUrl", "https://github.com/org/repo.git");
    config.setSinkConfig(sinkConfig);

    sinkTask.setConfig(config);
    return sinkTask;
  }

  private SinkTaskDefinition createSinkTaskWithoutBatchMode(String name) {
    SinkTaskDefinition sinkTask = new SinkTaskDefinition();
    sinkTask.setName(name);

    Config__6 config = new Config__6();
    config.setSinkType(Config__6.SinkType.GIT);
    config.setSyncMode(Config__6.SyncMode.OVERWRITE);
    config.setOutputFormat(Config__6.OutputFormat.YAML);
    // Note: batchMode is NOT set, should default to true per schema
    config.setTimeoutSeconds(300);

    SinkConfig sinkConfig = new SinkConfig();
    sinkConfig.setAdditionalProperty("repositoryUrl", "https://github.com/org/repo.git");
    config.setSinkConfig(sinkConfig);

    sinkTask.setConfig(config);
    return sinkTask;
  }
}
