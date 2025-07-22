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
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.ConditionalSetEntityAttributeTaskDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl.ConditionalSetEntityAttributeImpl;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.SubProcessBuilder;

public class ConditionalSetEntityAttributeTask implements NodeInterface {
  private final SubProcess subProcess;
  private final BoundaryEvent runtimeExceptionBoundaryEvent;

  public ConditionalSetEntityAttributeTask(
      ConditionalSetEntityAttributeTaskDefinition nodeDefinition, WorkflowConfiguration config) {
    String subProcessId = nodeDefinition.getName();

    SubProcess subProcess = new SubProcessBuilder().id(subProcessId).build();

    StartEvent startEvent =
        new StartEventBuilder().id(getFlowableElementId(subProcessId, "startEvent")).build();

    ServiceTask conditionalSetEntityAttribute =
        getConditionalSetEntityAttributeServiceTask(
            subProcessId,
            nodeDefinition.getConfig().getFieldName(),
            nodeDefinition.getConfig().getConditionVariableName(),
            nodeDefinition.getConfig().getTrueValue(),
            nodeDefinition.getConfig().getFalseValue(),
            JsonUtils.pojoToJson(nodeDefinition.getInputNamespaceMap()));

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(subProcessId, "endEvent")).build();

    subProcess.addFlowElement(startEvent);
    subProcess.addFlowElement(conditionalSetEntityAttribute);
    subProcess.addFlowElement(endEvent);

    subProcess.addFlowElement(
        new SequenceFlow(startEvent.getId(), conditionalSetEntityAttribute.getId()));
    subProcess.addFlowElement(
        new SequenceFlow(conditionalSetEntityAttribute.getId(), endEvent.getId()));

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

  private ServiceTask getConditionalSetEntityAttributeServiceTask(
      String subProcessId,
      String fieldName,
      String conditionVariableName,
      String trueValue,
      String falseValue,
      String inputNamespaceMap) {
    FieldExtension fieldNameExpr =
        new FieldExtensionBuilder()
            .fieldName("fieldNameExpr")
            .fieldValue(fieldName != null ? fieldName : "")
            .build();
    FieldExtension conditionVariableNameExpr =
        new FieldExtensionBuilder()
            .fieldName("conditionVariableNameExpr")
            .fieldValue(conditionVariableName != null ? conditionVariableName : "result")
            .build();
    FieldExtension trueValueExpr =
        new FieldExtensionBuilder()
            .fieldName("trueValueExpr")
            .fieldValue(trueValue != null ? trueValue : "")
            .build();
    FieldExtension falseValueExpr =
        new FieldExtensionBuilder()
            .fieldName("falseValueExpr")
            .fieldValue(falseValue != null ? falseValue : "")
            .build();
    FieldExtension inputNamespaceMapExpr =
        new FieldExtensionBuilder()
            .fieldName("inputNamespaceMapExpr")
            .fieldValue(inputNamespaceMap)
            .build();

    return new ServiceTaskBuilder()
        .id(getFlowableElementId(subProcessId, "conditionalSetEntityAttribute"))
        .implementation(ConditionalSetEntityAttributeImpl.class.getName())
        .addFieldExtension(fieldNameExpr)
        .addFieldExtension(conditionVariableNameExpr)
        .addFieldExtension(trueValueExpr)
        .addFieldExtension(falseValueExpr)
        .addFieldExtension(inputNamespaceMapExpr)
        .build();
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(subProcess);
    process.addFlowElement(runtimeExceptionBoundaryEvent);
  }
}
