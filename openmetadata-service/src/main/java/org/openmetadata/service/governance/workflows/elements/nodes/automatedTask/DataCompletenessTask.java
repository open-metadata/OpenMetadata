package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask;

import static org.openmetadata.service.governance.workflows.Workflow.ENTITY_LIST_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
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
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.DataCompletenessTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.QualityBand;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl.DataCompletenessImpl;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.SubProcessBuilder;

@Slf4j
public class DataCompletenessTask implements NodeInterface {
  private final SubProcess subProcess;
  private final BoundaryEvent runtimeExceptionBoundaryEvent;
  private final Set<String> outputPorts;

  public DataCompletenessTask(
      DataCompletenessTaskDefinition nodeDefinition, WorkflowConfiguration workflowConfig) {
    this.outputPorts =
        Optional.ofNullable(nodeDefinition.getConfig())
            .map(c -> c.getQualityBands())
            .orElse(List.of())
            .stream()
            .map(QualityBand::getName)
            .collect(Collectors.toSet());
    String subProcessId = nodeDefinition.getName();

    SubProcess subProcess = new SubProcessBuilder().id(subProcessId).build();

    StartEvent startEvent =
        new StartEventBuilder().id(getFlowableElementId(subProcessId, "startEvent")).build();

    ServiceTask dataCompletenessTask = getDataCompletenessServiceTask(subProcessId, nodeDefinition);

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(subProcessId, "endEvent")).build();

    subProcess.addFlowElement(startEvent);
    subProcess.addFlowElement(dataCompletenessTask);
    subProcess.addFlowElement(endEvent);

    subProcess.addFlowElement(new SequenceFlow(startEvent.getId(), dataCompletenessTask.getId()));
    subProcess.addFlowElement(new SequenceFlow(dataCompletenessTask.getId(), endEvent.getId()));

    if (workflowConfig.getStoreStageStatus()) {
      attachWorkflowInstanceStageListeners(subProcess);
    }

    this.subProcess = subProcess;
    this.runtimeExceptionBoundaryEvent =
        getRuntimeExceptionBoundaryEvent(subProcess, workflowConfig.getStoreStageStatus());
  }

  private ServiceTask getDataCompletenessServiceTask(
      String parentId, DataCompletenessTaskDefinition nodeDefinition) {

    // Get configuration with defaults if null
    var config = nodeDefinition.getConfig();

    Map<String, String> inputNamespaceMap = new HashMap<>();
    if (nodeDefinition.getInputNamespaceMap() != null) {
      @SuppressWarnings("unchecked")
      Map<String, String> definedNamespaceMap =
          JsonUtils.convertValue(nodeDefinition.getInputNamespaceMap(), Map.class);
      if (definedNamespaceMap != null) {
        inputNamespaceMap.putAll(definedNamespaceMap);
      }
    }
    inputNamespaceMap.putIfAbsent(ENTITY_LIST_VARIABLE, GLOBAL_NAMESPACE);

    List<FieldExtension> fieldExtensions =
        List.of(
            new FieldExtensionBuilder()
                .fieldName("fieldsToCheckExpr")
                .fieldValue(JsonUtils.pojoToJson(config.getFieldsToCheck()))
                .build(),
            new FieldExtensionBuilder()
                .fieldName("qualityBandsExpr")
                .fieldValue(JsonUtils.pojoToJson(config.getQualityBands()))
                .build(),
            new FieldExtensionBuilder()
                .fieldName("inputNamespaceMapExpr")
                .fieldValue(JsonUtils.pojoToJson(inputNamespaceMap))
                .build());

    ServiceTaskBuilder builder =
        new ServiceTaskBuilder()
            .id(getFlowableElementId(parentId, "dataCompletenessTask"))
            .implementation(DataCompletenessImpl.class.getName());

    for (FieldExtension fieldExtension : fieldExtensions) {
      builder.addFieldExtension(fieldExtension);
    }

    return builder.build();
  }

  @Override
  public Set<String> getOutputPorts() {
    return outputPorts;
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
