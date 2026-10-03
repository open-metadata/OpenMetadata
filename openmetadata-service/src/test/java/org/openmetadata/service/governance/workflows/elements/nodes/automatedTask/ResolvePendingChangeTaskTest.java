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

package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.ExclusiveGateway;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.SubProcess;
import org.flowable.bpmn.model.TerminateEventDefinition;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.ResolvePendingChangeTaskDefinition;
import org.openmetadata.schema.utils.JsonUtils;

class ResolvePendingChangeTaskTest {

  @Test
  void commitEndsTheRunWhenTheChangeIsNotApplied() {
    SubProcess subProcess = build("commit");

    ExclusiveGateway gateway =
        (ExclusiveGateway) subProcess.getFlowElement("Resolve.appliedGateway");
    EndEvent notApplied = (EndEvent) subProcess.getFlowElement("Resolve.notAppliedEvent");
    TerminateEventDefinition terminate =
        (TerminateEventDefinition) notApplied.getEventDefinitions().getFirst();
    assertTrue(terminate.isTerminateAll());

    SequenceFlow toNotApplied =
        subProcess.getFlowElements().stream()
            .filter(SequenceFlow.class::isInstance)
            .map(SequenceFlow.class::cast)
            .filter(flow -> flow.getSourceRef().equals(gateway.getId()))
            .filter(flow -> flow.getTargetRef().equals(notApplied.getId()))
            .findFirst()
            .orElseThrow();
    assertEquals("${Resolve_result == 'notApplied'}", toNotApplied.getConditionExpression());
    SequenceFlow toEnd = (SequenceFlow) subProcess.getFlowElement(gateway.getDefaultFlow());
    assertEquals("Resolve.endEvent", toEnd.getTargetRef());
  }

  @Test
  void discardEndsTheNodeWithoutBranching() {
    SubProcess subProcess = build("discard");

    assertNull(subProcess.getFlowElement("Resolve.appliedGateway"));
    assertNull(subProcess.getFlowElement("Resolve.notAppliedEvent"));
  }

  private static SubProcess build(String action) {
    ResolvePendingChangeTaskDefinition definition =
        JsonUtils.readValue(NODE.formatted(action), ResolvePendingChangeTaskDefinition.class);
    ResolvePendingChangeTask task =
        new ResolvePendingChangeTask(
            definition, new WorkflowConfiguration().withStoreStageStatus(false));
    BpmnModel model = new BpmnModel();
    Process process = new Process();
    task.addToWorkflow(model, process);
    return (SubProcess) process.getFlowElement("Resolve");
  }

  private static final String NODE =
      """
      {
        "type": "automatedTask",
        "subType": "resolvePendingChangeTask",
        "name": "Resolve",
        "config": {"action": "%s"},
        "inputNamespaceMap": {"relatedEntity": "global"}
      }
      """;
}
