/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask;

import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import java.util.HashMap;
import org.flowable.bpmn.model.BoundaryEvent;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.ExclusiveGateway;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.bpmn.model.SubProcess;
import org.flowable.bpmn.model.TerminateEventDefinition;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.ResolvePendingChangeAction;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.ResolvePendingChangeTaskDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl.ResolvePendingChangeImpl;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ExclusiveGatewayBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.SubProcessBuilder;

public class ResolvePendingChangeTask implements NodeInterface {
  private final SubProcess subProcess;
  private final BoundaryEvent runtimeExceptionBoundaryEvent;

  public ResolvePendingChangeTask(
      ResolvePendingChangeTaskDefinition nodeDefinition, WorkflowConfiguration config) {
    String subProcessId = nodeDefinition.getName();

    SubProcess subProcess = new SubProcessBuilder().id(subProcessId).build();

    StartEvent startEvent =
        new StartEventBuilder().id(getFlowableElementId(subProcessId, "startEvent")).build();

    ServiceTask resolvePendingChange =
        getResolvePendingChangeServiceTask(
            subProcessId,
            nodeDefinition.getConfig().getAction().value(),
            JsonUtils.pojoToJson(
                nodeDefinition.getInputNamespaceMap() != null
                    ? nodeDefinition.getInputNamespaceMap()
                    : new HashMap<>()));

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(subProcessId, "endEvent")).build();

    subProcess.addFlowElement(startEvent);
    subProcess.addFlowElement(resolvePendingChange);
    subProcess.addFlowElement(endEvent);

    subProcess.addFlowElement(new SequenceFlow(startEvent.getId(), resolvePendingChange.getId()));
    if (nodeDefinition.getConfig().getAction() == ResolvePendingChangeAction.COMMIT) {
      addNotAppliedTermination(subProcess, subProcessId, resolvePendingChange, endEvent);
    } else {
      subProcess.addFlowElement(new SequenceFlow(resolvePendingChange.getId(), endEvent.getId()));
    }

    if (config.getStoreStageStatus()) {
      attachWorkflowInstanceStageListeners(subProcess);
    }

    this.runtimeExceptionBoundaryEvent =
        getRuntimeExceptionBoundaryEvent(subProcess, config.getStoreStageStatus());
    this.subProcess = subProcess;
  }

  // A commit that could not be applied leaves the request open with its conflicts, so the run ends
  // here: the steps after the commit only follow a published change. The requester's next edit is a
  // new revision with its own run.
  private void addNotAppliedTermination(
      SubProcess subProcess, String subProcessId, ServiceTask commit, EndEvent endEvent) {
    ExclusiveGateway appliedGateway =
        new ExclusiveGatewayBuilder()
            .id(getFlowableElementId(subProcessId, "appliedGateway"))
            .name("Check if the change was applied")
            .setAsync(false)
            .build();

    TerminateEventDefinition terminateAll = new TerminateEventDefinition();
    terminateAll.setTerminateAll(true);
    EndEvent notAppliedEvent =
        new EndEventBuilder().id(getFlowableElementId(subProcessId, "notAppliedEvent")).build();
    notAppliedEvent.addEventDefinition(terminateAll);
    attachMainWorkflowTerminationListener(notAppliedEvent);

    SequenceFlow toNotApplied = new SequenceFlow(appliedGateway.getId(), notAppliedEvent.getId());
    toNotApplied.setConditionExpression(
        "${%s == '%s'}"
            .formatted(
                getNamespacedVariableName(subProcessId, RESULT_VARIABLE),
                ResolvePendingChangeImpl.NOT_APPLIED));
    toNotApplied.setId(getFlowableElementId(subProcessId, "notAppliedFlow"));
    toNotApplied.setName("Not applied");
    SequenceFlow toEnd = new SequenceFlow(appliedGateway.getId(), endEvent.getId());
    toEnd.setId(getFlowableElementId(subProcessId, "appliedFlow"));
    toEnd.setName("Applied");

    subProcess.addFlowElement(appliedGateway);
    subProcess.addFlowElement(notAppliedEvent);
    subProcess.addFlowElement(new SequenceFlow(commit.getId(), appliedGateway.getId()));
    subProcess.addFlowElement(toNotApplied);
    subProcess.addFlowElement(toEnd);
    appliedGateway.setDefaultFlow(toEnd.getId());
  }

  @Override
  public BoundaryEvent getRuntimeExceptionBoundaryEvent() {
    return runtimeExceptionBoundaryEvent;
  }

  private ServiceTask getResolvePendingChangeServiceTask(
      String subProcessId, String action, String inputNamespaceMap) {
    FieldExtension actionExpr =
        new FieldExtensionBuilder().fieldName("actionExpr").fieldValue(action).build();
    FieldExtension inputNamespaceMapExpr =
        new FieldExtensionBuilder()
            .fieldName("inputNamespaceMapExpr")
            .fieldValue(inputNamespaceMap)
            .build();

    return new ServiceTaskBuilder()
        .id(getFlowableElementId(subProcessId, "resolvePendingChange"))
        .implementation(ResolvePendingChangeImpl.class.getName())
        .addFieldExtension(actionExpr)
        .addFieldExtension(inputNamespaceMapExpr)
        .build();
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(subProcess);
    process.addFlowElement(runtimeExceptionBoundaryEvent);
  }
}
