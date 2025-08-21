package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask;

import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;

import lombok.Getter;
import org.flowable.bpmn.model.BoundaryEvent;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.bpmn.model.SubProcess;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.RollbackEntityTaskDefinition;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl.RollbackEntityImpl;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.SubProcessBuilder;

@Getter
public class RollbackEntityTask implements NodeInterface {
  private final SubProcess subProcess;
  private final BoundaryEvent runtimeExceptionBoundaryEvent;

  public RollbackEntityTask(
      RollbackEntityTaskDefinition nodeDefinition, WorkflowConfiguration config) {
    String subProcessId = nodeDefinition.getName();

    SubProcess subProcess = new SubProcessBuilder().id(subProcessId).build();

    StartEvent startEvent =
        new StartEventBuilder().id(getFlowableElementId(subProcessId, "startEvent")).build();

    ServiceTask rollbackEntityTask = getRollbackEntityServiceTask(subProcessId, nodeDefinition);

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(subProcessId, "endEvent")).build();

    subProcess.addFlowElement(startEvent);
    subProcess.addFlowElement(rollbackEntityTask);
    subProcess.addFlowElement(endEvent);

    subProcess.addFlowElement(new SequenceFlow(startEvent.getId(), rollbackEntityTask.getId()));
    subProcess.addFlowElement(new SequenceFlow(rollbackEntityTask.getId(), endEvent.getId()));

    if (config.getStoreStageStatus()) {
      attachWorkflowInstanceStageListeners(subProcess);
    }

    this.subProcess = subProcess;
    this.runtimeExceptionBoundaryEvent = getRuntimeExceptionBoundaryEvent(subProcess, false);
  }

  private ServiceTask getRollbackEntityServiceTask(
      String subProcessId, RollbackEntityTaskDefinition nodeDefinition) {

    FieldExtension relatedEntityVariable =
        new FieldExtensionBuilder()
            .fieldName(RELATED_ENTITY_VARIABLE)
            .fieldValue(RELATED_ENTITY_VARIABLE)
            .build();

    FieldExtension workflowInstanceExecutionIdVariable =
        new FieldExtensionBuilder()
            .fieldName(WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE)
            .fieldValue(WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE)
            .build();

    FieldExtension rollbackToStatusVariable =
        new FieldExtensionBuilder()
            .fieldName("rollbackToStatus")
            .fieldValue(
                nodeDefinition.getConfig() != null
                        && nodeDefinition.getConfig().getRollbackToStatus() != null
                    ? nodeDefinition.getConfig().getRollbackToStatus()
                    : "Approved")
            .build();

    return new ServiceTaskBuilder()
        .id(getFlowableElementId(subProcessId, "rollbackEntity"))
        .implementation(RollbackEntityImpl.class.getName())
        .addFieldExtension(relatedEntityVariable)
        .addFieldExtension(workflowInstanceExecutionIdVariable)
        .addFieldExtension(rollbackToStatusVariable)
        .build();
  }

  @Override
  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(subProcess);
    process.addFlowElement(runtimeExceptionBoundaryEvent);
  }

  @Override
  public BoundaryEvent getRuntimeExceptionBoundaryEvent() {
    return runtimeExceptionBoundaryEvent;
  }
}
