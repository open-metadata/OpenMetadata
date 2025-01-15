package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask;

import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;

import org.flowable.bpmn.model.BoundaryEvent;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.bpmn.model.SubProcess;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.TriggerIngestionPipelineTaskDefinition;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl.TriggerIngestionPipelineImpl;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.SubProcessBuilder;

public class TriggerIngestionPipelineTask implements NodeInterface {
  private final SubProcess subProcess;
  private final BoundaryEvent runtimeExceptionBoundaryEvent;

  public TriggerIngestionPipelineTask(TriggerIngestionPipelineTaskDefinition nodeDefinition) {
    String subProcessId = nodeDefinition.getName();

    SubProcess subProcess = new SubProcessBuilder().id(subProcessId).build();

    StartEvent startEvent =
        new StartEventBuilder().id(getFlowableElementId(subProcessId, "startEvent")).build();

    ServiceTask triggerIngestionWorkflow = getTriggerIngestionWorkflowServiceTask(subProcessId);

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(subProcessId, "endEvent")).build();

    subProcess.addFlowElement(startEvent);
    subProcess.addFlowElement(triggerIngestionWorkflow);
    subProcess.addFlowElement(endEvent);

    subProcess.addFlowElement(
        new SequenceFlow(startEvent.getId(), triggerIngestionWorkflow.getId()));
    subProcess.addFlowElement(new SequenceFlow(triggerIngestionWorkflow.getId(), endEvent.getId()));

    this.runtimeExceptionBoundaryEvent = getRuntimeExceptionBoundaryEvent(subProcess);
    this.subProcess = subProcess;
  }

  @Override
  public BoundaryEvent getRuntimeExceptionBoundaryEvent() {
    return runtimeExceptionBoundaryEvent;
  }

  private ServiceTask getTriggerIngestionWorkflowServiceTask(String subProcessId) {
    ServiceTask serviceTask =
        new ServiceTaskBuilder()
            .id(getFlowableElementId(subProcessId, "triggerIngestionWorkflow"))
            .implementation(TriggerIngestionPipelineImpl.class.getName())
            .build();
    return serviceTask;
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(subProcess);
    process.addFlowElement(runtimeExceptionBoundaryEvent);
  }
}
