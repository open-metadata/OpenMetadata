package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask;

import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;

import org.flowable.bpmn.model.BoundaryEvent;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.bpmn.model.SubProcess;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.JsonLogicTaskDefinition;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl.JsonLogicFilterImpl;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.SubProcessBuilder;

public class JsonLogicFilterTask implements NodeInterface {
  private final SubProcess subProcess;
  private final BoundaryEvent runtimeExceptionBoundaryEvent;

  public JsonLogicFilterTask(JsonLogicTaskDefinition nodeDefinition) {
    String subProcessId = nodeDefinition.getName();

    SubProcess subProcess = new SubProcessBuilder().id(subProcessId).build();

    StartEvent startEvent =
        new StartEventBuilder().id(getFlowableElementId(subProcessId, "startEvent")).build();

    ServiceTask checkEntityAttributes =
        getCheckEntityAttributesServiceTask(subProcessId, nodeDefinition.getConfig().getRules());

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(subProcessId, "endEvent")).build();

    subProcess.addFlowElement(startEvent);
    subProcess.addFlowElement(checkEntityAttributes);
    subProcess.addFlowElement(endEvent);

    subProcess.addFlowElement(new SequenceFlow(startEvent.getId(), checkEntityAttributes.getId()));
    subProcess.addFlowElement(new SequenceFlow(checkEntityAttributes.getId(), endEvent.getId()));

    this.runtimeExceptionBoundaryEvent = getRuntimeExceptionBoundaryEvent(subProcess);
    this.subProcess = subProcess;
  }

  @Override
  public BoundaryEvent getRuntimeExceptionBoundaryEvent() {
    return runtimeExceptionBoundaryEvent;
  }

  private ServiceTask getCheckEntityAttributesServiceTask(String subProcessId, String rules) {
    FieldExtension rulesExpr =
        new FieldExtensionBuilder().fieldName("rulesExpr").fieldValue(rules).build();

    ServiceTask serviceTask =
        new ServiceTaskBuilder()
            .id(getFlowableElementId(subProcessId, "jsonLogic"))
            .implementation(JsonLogicFilterImpl.class.getName())
            .build();
    serviceTask.getFieldExtensions().add(rulesExpr);
    return serviceTask;
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(subProcess);
    process.addFlowElement(runtimeExceptionBoundaryEvent);
  }
}
