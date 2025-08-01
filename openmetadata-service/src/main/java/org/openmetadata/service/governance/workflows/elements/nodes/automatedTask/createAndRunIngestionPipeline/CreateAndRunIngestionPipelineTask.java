package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.createAndRunIngestionPipeline;

import static org.openmetadata.service.governance.workflows.Workflow.INGESTION_PIPELINE_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

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
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.CreateAndRunIngestionPipelineTaskDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.SubProcessBuilder;

public class CreateAndRunIngestionPipelineTask implements NodeInterface {
  private final SubProcess subProcess;
  private final BoundaryEvent runtimeExceptionBoundaryEvent;

  public CreateAndRunIngestionPipelineTask(
      CreateAndRunIngestionPipelineTaskDefinition nodeDefinition, WorkflowConfiguration config) {

    String subProcessId = nodeDefinition.getName();

    SubProcess subProcess =
        new SubProcessBuilder().id(subProcessId).setAsync(true).exclusive(true).build();

    StartEvent startEvent =
        new StartEventBuilder().id(getFlowableElementId(subProcessId, "startEvent")).build();

    ServiceTask createIngestionPipeline =
        getCreateIngestionPipelineServiceTask(
            subProcessId,
            nodeDefinition.getConfig().getPipelineType(),
            JsonUtils.pojoToJson(nodeDefinition.getInputNamespaceMap()));

    ServiceTask runIngestionPipeline =
        getRunIngestionPipelineServiceTask(
            subProcessId,
            nodeDefinition.getConfig().getShouldRun(),
            nodeDefinition.getConfig().getWaitForCompletion(),
            nodeDefinition.getConfig().getTimeoutSeconds(),
            JsonUtils.pojoToJson(nodeDefinition.getInputNamespaceMap()));

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(subProcessId, "endEvent")).build();

    subProcess.addFlowElement(startEvent);
    subProcess.addFlowElement(createIngestionPipeline);
    subProcess.addFlowElement(runIngestionPipeline);
    subProcess.addFlowElement(endEvent);

    subProcess.addFlowElement(
        new SequenceFlow(startEvent.getId(), createIngestionPipeline.getId()));

    SequenceFlow runIngestionPipelineIfNotNull =
        new SequenceFlow(createIngestionPipeline.getId(), runIngestionPipeline.getId());
    runIngestionPipelineIfNotNull.setConditionExpression(
        String.format(
            "${%s != null}",
            getNamespacedVariableName(nodeDefinition.getName(), INGESTION_PIPELINE_ID_VARIABLE)));
    subProcess.addFlowElement(runIngestionPipelineIfNotNull);

    subProcess.addFlowElement(new SequenceFlow(runIngestionPipeline.getId(), endEvent.getId()));

    SequenceFlow skipRunIngestionPipelineIfNull =
        new SequenceFlow(createIngestionPipeline.getId(), endEvent.getId());
    skipRunIngestionPipelineIfNull.setConditionExpression(
        String.format(
            "${%s == null}",
            getNamespacedVariableName(nodeDefinition.getName(), INGESTION_PIPELINE_ID_VARIABLE)));
    subProcess.addFlowElement(skipRunIngestionPipelineIfNull);

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

  private ServiceTask getRunIngestionPipelineServiceTask(
      String subProcessId,
      boolean shouldRun,
      boolean waitForCompletion,
      long timeoutSeconds,
      String inputNamespaceMap) {
    FieldExtension shouldRunExpr =
        new FieldExtensionBuilder()
            .fieldName("shouldRunExpr")
            .fieldValue(String.valueOf(shouldRun))
            .build();
    FieldExtension waitExpr =
        new FieldExtensionBuilder()
            .fieldName("waitForCompletionExpr")
            .fieldValue(String.valueOf(waitForCompletion))
            .build();
    FieldExtension timeoutSecondsExpr =
        new FieldExtensionBuilder()
            .fieldName("timeoutSecondsExpr")
            .fieldValue(String.valueOf(timeoutSeconds))
            .build();

    FieldExtension inputNamespaceMapExpr =
        new FieldExtensionBuilder()
            .fieldName("inputNamespaceMapExpr")
            .fieldValue(inputNamespaceMap)
            .build();

    FieldExtension pipelineServiceClientExpr =
        new FieldExtensionBuilder()
            .fieldName("pipelineServiceClientExpr")
            .expression("${PipelineServiceClient}")
            .build();

    return new ServiceTaskBuilder()
        .id(getFlowableElementId(subProcessId, "triggerIngestionWorkflow"))
        .implementation(RunIngestionPipelineDelegate.class.getName())
        .addFieldExtension(shouldRunExpr)
        .addFieldExtension(waitExpr)
        .addFieldExtension(timeoutSecondsExpr)
        .addFieldExtension(inputNamespaceMapExpr)
        .addFieldExtension(pipelineServiceClientExpr)
        .setAsync(true)
        .exclusive(true)
        .build();
  }

  private ServiceTask getCreateIngestionPipelineServiceTask(
      String subProcessId, PipelineType pipelineType, String inputNamespaceMap) {
    FieldExtension pipelineTypeExpr =
        new FieldExtensionBuilder()
            .fieldName("pipelineTypeExpr")
            .fieldValue(pipelineType.toString())
            .build();

    FieldExtension deployExpr =
        new FieldExtensionBuilder()
            .fieldName("deployExpr")
            .fieldValue(String.valueOf(true))
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
        .id(getFlowableElementId(subProcessId, "createIngestionPipeline"))
        .implementation(CreateIngestionPipelineDelegate.class.getName())
        .addFieldExtension(pipelineTypeExpr)
        .addFieldExtension(deployExpr)
        .addFieldExtension(ingestionPipelineMapperExpr)
        .addFieldExtension(pipelineServiceClientExpr)
        .addFieldExtension(inputNamespaceMapExpr)
        .setAsync(true)
        .exclusive(true)
        .build();
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(subProcess);
    process.addFlowElement(runtimeExceptionBoundaryEvent);
  }
}
