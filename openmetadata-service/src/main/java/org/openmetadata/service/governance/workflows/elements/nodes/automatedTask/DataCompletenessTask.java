package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask;

import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;

import java.util.List;
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

  public DataCompletenessTask(
      DataCompletenessTaskDefinition nodeDefinition, WorkflowConfiguration workflowConfig) {
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

    this.subProcess = subProcess;
    this.runtimeExceptionBoundaryEvent = getRuntimeExceptionBoundaryEvent(dataCompletenessTask);
  }

  private ServiceTask getDataCompletenessServiceTask(
      String parentId, DataCompletenessTaskDefinition nodeDefinition) {

    // Get configuration with defaults if null
    var config = nodeDefinition.getConfig();
    Boolean treatEmptyStringAsNull = config.getTreatEmptyStringAsNull();
    Boolean treatEmptyArrayAsNull = config.getTreatEmptyArrayAsNull();

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
                .fieldName("treatEmptyStringAsNullExpr")
                .fieldValue(
                    String.valueOf(treatEmptyStringAsNull != null ? treatEmptyStringAsNull : true))
                .build(),
            new FieldExtensionBuilder()
                .fieldName("treatEmptyArrayAsNullExpr")
                .fieldValue(
                    String.valueOf(treatEmptyArrayAsNull != null ? treatEmptyArrayAsNull : true))
                .build(),
            new FieldExtensionBuilder()
                .fieldName("inputNamespaceMapExpr")
                .fieldValue(
                    JsonUtils.pojoToJson(
                        nodeDefinition.getInputNamespaceMap() != null
                            ? nodeDefinition.getInputNamespaceMap()
                            : new java.util.HashMap<>()))
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
  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(subProcess);
    process.addFlowElement(runtimeExceptionBoundaryEvent);
  }

  @Override
  public BoundaryEvent getRuntimeExceptionBoundaryEvent() {
    return runtimeExceptionBoundaryEvent;
  }

  private BoundaryEvent getRuntimeExceptionBoundaryEvent(ServiceTask serviceTask) {
    BoundaryEvent boundaryEvent = new BoundaryEvent();
    boundaryEvent.setId(getFlowableElementId(serviceTask.getId(), "runtimeExceptionBoundaryEvent"));
    boundaryEvent.setAttachedToRefId(serviceTask.getId());

    org.flowable.bpmn.model.ErrorEventDefinition errorEventDef =
        new org.flowable.bpmn.model.ErrorEventDefinition();
    errorEventDef.setErrorCode("workflowRuntimeException");
    boundaryEvent.addEventDefinition(errorEventDef);

    return boundaryEvent;
  }
}
