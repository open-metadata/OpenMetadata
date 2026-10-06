package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask;

import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;

import java.util.Map;
import org.flowable.bpmn.model.BoundaryEvent;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.SubProcess;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.CollectMetadataTaskDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl.CollectMetadataImpl;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.SubProcessBuilder;

public class CollectMetadataTask implements NodeInterface {
  private final SubProcess subProcess;
  private final BoundaryEvent boundary;

  public CollectMetadataTask(
      final CollectMetadataTaskDefinition node,
      final WorkflowConfiguration configuration,
      final String workflowName) {
    subProcess = new SubProcessBuilder().id(node.getName()).build();
    final var start =
        new StartEventBuilder().id(getFlowableElementId(node.getName(), "startEvent")).build();
    final var end =
        new EndEventBuilder().id(getFlowableElementId(node.getName(), "endEvent")).build();
    final var collect = serviceTask(node, workflowName);
    subProcess.addFlowElement(start);
    subProcess.addFlowElement(collect);
    subProcess.addFlowElement(end);
    subProcess.addFlowElement(new SequenceFlow(start.getId(), collect.getId()));
    subProcess.addFlowElement(new SequenceFlow(collect.getId(), end.getId()));
    if (Boolean.TRUE.equals(configuration.getStoreStageStatus())) {
      attachWorkflowInstanceStageListeners(subProcess);
    }
    boundary = getRuntimeExceptionBoundaryEvent(subProcess, configuration.getStoreStageStatus());
  }

  private ServiceTask serviceTask(
      final CollectMetadataTaskDefinition node, final String workflowName) {
    final var builder =
        new ServiceTaskBuilder()
            .id(getFlowableElementId(node.getName(), "collectMetadata"))
            .implementation(CollectMetadataImpl.class.getName());
    final Map<String, String> fields =
        Map.of(
            "configurationExpr", JsonUtils.pojoToJson(node.getConfig()),
            "inputNamespaceMapExpr",
                JsonUtils.pojoToJson(
                    node.getInputNamespaceMap() != null ? node.getInputNamespaceMap() : Map.of()),
            "taskKeyExpr", workflowName + ":" + node.getConfig().getStage().value());
    fields.forEach(
        (name, value) ->
            builder.addFieldExtension(
                new FieldExtensionBuilder().fieldName(name).fieldValue(value).build()));
    return builder.build();
  }

  @Override
  public void addToWorkflow(final BpmnModel model, final Process process) {
    process.addFlowElement(subProcess);
    process.addFlowElement(boundary);
  }

  @Override
  public BoundaryEvent getRuntimeExceptionBoundaryEvent() {
    return boundary;
  }
}
