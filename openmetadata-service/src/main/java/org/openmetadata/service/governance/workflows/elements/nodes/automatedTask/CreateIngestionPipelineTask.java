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
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.CreateIngestionPipelineTaskDefinition;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl.CreateIngestionPipelineImpl;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.SubProcessBuilder;
import org.openmetadata.service.util.JsonUtils;

public class CreateIngestionPipelineTask implements NodeInterface {
  private final SubProcess subProcess;
  private final BoundaryEvent runtimeExceptionBoundaryEvent;

  public CreateIngestionPipelineTask(CreateIngestionPipelineTaskDefinition nodeDefinition) {
    String subProcessId = nodeDefinition.getName();

    SubProcess subProcess =
        new SubProcessBuilder().id(subProcessId).setAsync(true).exclusive(true).build();

    StartEvent startEvent =
        new StartEventBuilder().id(getFlowableElementId(subProcessId, "startEvent")).build();

    ServiceTask createIngestionPipelineTask =
        getCreateIngestionPipelineTask(
            subProcessId,
            nodeDefinition.getConfig().getPipelineType(),
            nodeDefinition.getConfig().getDeploy(),
            JsonUtils.pojoToJson(nodeDefinition.getInputNamespaceMap()));

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(subProcessId, "endEvent")).build();

    subProcess.addFlowElement(startEvent);
    subProcess.addFlowElement(createIngestionPipelineTask);
    subProcess.addFlowElement(endEvent);

    subProcess.addFlowElement(
        new SequenceFlow(startEvent.getId(), createIngestionPipelineTask.getId()));
    subProcess.addFlowElement(
        new SequenceFlow(createIngestionPipelineTask.getId(), endEvent.getId()));

    this.runtimeExceptionBoundaryEvent = getRuntimeExceptionBoundaryEvent(subProcess);
    this.subProcess = subProcess;
  }

  @Override
  public BoundaryEvent getRuntimeExceptionBoundaryEvent() {
    return runtimeExceptionBoundaryEvent;
  }

  private ServiceTask getCreateIngestionPipelineTask(
      String subProcessId, PipelineType pipelineType, boolean deploy, String inputNamespaceMap) {
    FieldExtension pipelineTypeExpr =
        new FieldExtensionBuilder()
            .fieldName("pipelineTypeExpr")
            .fieldValue(pipelineType.toString())
            .build();

    FieldExtension deployExpr =
        new FieldExtensionBuilder()
            .fieldName("deployExpr")
            .fieldValue(String.valueOf(deploy))
            .build();

    FieldExtension ingestionPipelineMapperExpr =
        new FieldExtensionBuilder()
            .fieldName("ingestionPipelineMapperExpr")
            .expression("${IngestionPipelineMapper}")
            .build();

    FieldExtension pipelineServiceClientExpr =
        new FieldExtensionBuilder()
            .fieldName("pipelineServiceClientExpr")
            .expression("${PipelineServiceClient}")
            .build();

    FieldExtension inputNamespaceMapExpr =
        new FieldExtensionBuilder()
            .fieldName("inputNamespaceMapExpr")
            .fieldValue(inputNamespaceMap)
            .build();

    return new ServiceTaskBuilder()
        .id(getFlowableElementId(subProcessId, "checkIngestionPipelineSucceeded"))
        .implementation(CreateIngestionPipelineImpl.class.getName())
        .addFieldExtension(pipelineTypeExpr)
        .addFieldExtension(deployExpr)
        .addFieldExtension(ingestionPipelineMapperExpr)
        .addFieldExtension(pipelineServiceClientExpr)
        .addFieldExtension(inputNamespaceMapExpr)
        .setAsync(true)
        .build();
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(subProcess);
    process.addFlowElement(runtimeExceptionBoundaryEvent);
  }
}
