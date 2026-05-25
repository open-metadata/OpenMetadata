package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask;

import static org.openmetadata.service.governance.workflows.Workflow.ENTITY_LIST_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
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
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.CheckChangeDescriptionTaskDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl.CheckChangeDescriptionTaskImpl;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.SubProcessBuilder;

@Slf4j
public class CheckChangeDescriptionTask implements NodeInterface {
  private final SubProcess subProcess;
  private final BoundaryEvent runtimeExceptionBoundaryEvent;

  public CheckChangeDescriptionTask(
      CheckChangeDescriptionTaskDefinition nodeDefinition, WorkflowConfiguration config) {
    String subProcessId = nodeDefinition.getName();

    SubProcess subProcess = new SubProcessBuilder().id(subProcessId).build();

    StartEvent startEvent =
        new StartEventBuilder().id(getFlowableElementId(subProcessId, "startEvent")).build();

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

    ServiceTask checkChangeDescriptionTask =
        getCheckChangeDescriptionServiceTask(
            subProcessId,
            nodeDefinition.getConfig() != null && nodeDefinition.getConfig().getCondition() != null
                ? nodeDefinition.getConfig().getCondition().value()
                : "OR",
            nodeDefinition.getConfig() != null
                ? JsonUtils.pojoToJson(nodeDefinition.getConfig().getRules())
                : "{}",
            JsonUtils.pojoToJson(inputNamespaceMap));

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(subProcessId, "endEvent")).build();

    subProcess.addFlowElement(startEvent);
    subProcess.addFlowElement(checkChangeDescriptionTask);
    subProcess.addFlowElement(endEvent);

    subProcess.addFlowElement(
        new SequenceFlow(startEvent.getId(), checkChangeDescriptionTask.getId()));
    subProcess.addFlowElement(
        new SequenceFlow(checkChangeDescriptionTask.getId(), endEvent.getId()));

    if (config.getStoreStageStatus()) {
      attachWorkflowInstanceStageListeners(subProcess);
    }

    this.runtimeExceptionBoundaryEvent =
        getRuntimeExceptionBoundaryEvent(subProcess, config.getStoreStageStatus());
    this.subProcess = subProcess;
  }

  @Override
  public Set<String> getOutputPorts() {
    return Set.of("true", "false");
  }

  @Override
  public BoundaryEvent getRuntimeExceptionBoundaryEvent() {
    return runtimeExceptionBoundaryEvent;
  }

  private ServiceTask getCheckChangeDescriptionServiceTask(
      String subProcessId, String condition, String rules, String inputNamespaceMap) {
    LOG.debug("CheckChangeDescriptionTask: condition = {}", condition);
    LOG.debug("CheckChangeDescriptionTask: rules = {}", rules);
    LOG.debug("CheckChangeDescriptionTask: inputNamespaceMap = {}", inputNamespaceMap);

    FieldExtension conditionExpr =
        new FieldExtensionBuilder().fieldName("conditionExpr").fieldValue(condition).build();
    FieldExtension rulesExpr =
        new FieldExtensionBuilder().fieldName("rulesExpr").fieldValue(rules).build();
    FieldExtension inputNamespaceMapExpr =
        new FieldExtensionBuilder()
            .fieldName("inputNamespaceMapExpr")
            .fieldValue(inputNamespaceMap)
            .build();

    return new ServiceTaskBuilder()
        .id(getFlowableElementId(subProcessId, "checkChangeDescriptionTask"))
        .implementation(CheckChangeDescriptionTaskImpl.class.getName())
        .addFieldExtension(conditionExpr)
        .addFieldExtension(rulesExpr)
        .addFieldExtension(inputNamespaceMapExpr)
        .build();
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(subProcess);
    process.addFlowElement(runtimeExceptionBoundaryEvent);
  }
}
