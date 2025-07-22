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
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SetEntityAttributeTaskDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl.SetEntityAttributeImpl;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.SubProcessBuilder;

public class SetEntityAttributeTask implements NodeInterface {
  private final SubProcess subProcess;
  private final BoundaryEvent runtimeExceptionBoundaryEvent;

  public SetEntityAttributeTask(
      SetEntityAttributeTaskDefinition nodeDefinition, WorkflowConfiguration config) {
    String subProcessId = nodeDefinition.getName();

    SubProcess subProcess = new SubProcessBuilder().id(subProcessId).build();

    StartEvent startEvent =
        new StartEventBuilder().id(getFlowableElementId(subProcessId, "startEvent")).build();

    ServiceTask setEntityAttribute =
        getSetEntityAttributeServiceTask(
            subProcessId,
            nodeDefinition.getConfig().getFieldName(),
            nodeDefinition.getConfig().getFieldValue(),
            JsonUtils.pojoToJson(nodeDefinition.getInputNamespaceMap()));

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(subProcessId, "endEvent")).build();

    subProcess.addFlowElement(startEvent);
    subProcess.addFlowElement(setEntityAttribute);
    subProcess.addFlowElement(endEvent);

    subProcess.addFlowElement(new SequenceFlow(startEvent.getId(), setEntityAttribute.getId()));
    subProcess.addFlowElement(new SequenceFlow(setEntityAttribute.getId(), endEvent.getId()));

    if (config.getStoreStageStatus()) {
      attachWorkflowInstanceStageListeners(subProcess);
    }

    this.runtimeExceptionBoundaryEvent =
        getRuntimeExceptionBoundaryEvent(subProcess, config.getStoreStageStatus());
    this.subProcess = subProcess;
  }

  @Override
  public BoundaryEvent getRuntimeExceptionBoundaryEvent() {
    return runtimeExceptionBoundaryEvent;
  }

  private ServiceTask getSetEntityAttributeServiceTask(
      String subProcessId, String fieldName, String fieldValue, String inputNamespaceMap) {
    FieldExtension fieldNameExpr =
        new FieldExtensionBuilder()
            .fieldName("fieldNameExpr")
            .fieldValue(fieldName != null ? fieldName : "")
            .build();
    FieldExtension fieldValueExpr =
        new FieldExtensionBuilder()
            .fieldName("fieldValueExpr")
            .fieldValue(fieldValue != null ? fieldValue : "")
            .build();
    FieldExtension inputNamespaceMapExpr =
        new FieldExtensionBuilder()
            .fieldName("inputNamespaceMapExpr")
            .fieldValue(inputNamespaceMap)
            .build();

    return new ServiceTaskBuilder()
        .id(getFlowableElementId(subProcessId, "setEntityAttribute"))
        .implementation(SetEntityAttributeImpl.class.getName())
        .addFieldExtension(fieldNameExpr)
        .addFieldExtension(fieldValueExpr)
        .addFieldExtension(inputNamespaceMapExpr)
        .build();
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(subProcess);
    process.addFlowElement(runtimeExceptionBoundaryEvent);
  }
}
