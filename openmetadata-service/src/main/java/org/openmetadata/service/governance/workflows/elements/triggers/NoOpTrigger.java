package org.openmetadata.service.governance.workflows.elements.triggers;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import lombok.Getter;
import org.flowable.bpmn.model.BoundaryEvent;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.CallActivity;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.ErrorEventDefinition;
import org.flowable.bpmn.model.FlowableListener;
import org.flowable.bpmn.model.IOParameter;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.StartEvent;
import org.openmetadata.schema.governance.workflows.elements.triggers.NoOpTriggerDefinition;
import org.openmetadata.service.governance.workflows.elements.TriggerInterface;
import org.openmetadata.service.governance.workflows.flowable.builders.CallActivityBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;

public class NoOpTrigger implements TriggerInterface {
  private final Process process;

  @Getter private final String triggerWorkflowId;

  public NoOpTrigger(
      String mainWorkflowName, String triggerWorkflowId, NoOpTriggerDefinition triggerDefinition) {
    Process process = new Process();
    process.setId(triggerWorkflowId);
    process.setName(triggerWorkflowId);
    attachWorkflowInstanceListeners(process);

    StartEvent startEvent =
        new StartEventBuilder().id(getFlowableElementId(triggerWorkflowId, "startEvent")).build();
    process.addFlowElement(startEvent);

    CallActivity workflowTrigger =
        getWorkflowTrigger(triggerWorkflowId, mainWorkflowName, triggerDefinition.getOutput());
    process.addFlowElement(workflowTrigger);

    ErrorEventDefinition runtimeExceptionDefinition = new ErrorEventDefinition();
    runtimeExceptionDefinition.setErrorCode(WORKFLOW_RUNTIME_EXCEPTION);

    BoundaryEvent runtimeExceptionBoundaryEvent = new BoundaryEvent();
    runtimeExceptionBoundaryEvent.setId(
        getFlowableElementId(workflowTrigger.getId(), "runtimeExceptionBoundaryEvent"));
    runtimeExceptionBoundaryEvent.addEventDefinition(runtimeExceptionDefinition);

    runtimeExceptionBoundaryEvent.setAttachedToRef(workflowTrigger);
    for (FlowableListener listener : getWorkflowInstanceListeners(List.of("end"))) {
      runtimeExceptionBoundaryEvent.getExecutionListeners().add(listener);
    }
    process.addFlowElement(runtimeExceptionBoundaryEvent);

    EndEvent errorEndEvent =
        new EndEventBuilder().id(getFlowableElementId(triggerWorkflowId, "errorEndEvent")).build();
    process.addFlowElement(errorEndEvent);
    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(triggerWorkflowId, "endEvent")).build();
    process.addFlowElement(endEvent);

    process.addFlowElement(new SequenceFlow(startEvent.getId(), workflowTrigger.getId()));
    process.addFlowElement(new SequenceFlow(workflowTrigger.getId(), endEvent.getId()));
    process.addFlowElement(
        new SequenceFlow(runtimeExceptionBoundaryEvent.getId(), errorEndEvent.getId()));

    this.process = process;
    this.triggerWorkflowId = triggerWorkflowId;
  }

  private CallActivity getWorkflowTrigger(
      String triggerWorkflowId, String mainWorkflowName, Set<String> triggerOutputs) {
    CallActivity workflowTrigger =
        new CallActivityBuilder()
            .id(getFlowableElementId(triggerWorkflowId, "workflowTrigger"))
            .calledElement(mainWorkflowName)
            .inheritBusinessKey(true)
            .build();

    List<IOParameter> inputParameters = new ArrayList<>();

    for (String triggerOutput : triggerOutputs) {
      IOParameter inputParameter = new IOParameter();
      inputParameter.setSource(getNamespacedVariableName(GLOBAL_NAMESPACE, triggerOutput));
      inputParameter.setTarget(getNamespacedVariableName(GLOBAL_NAMESPACE, triggerOutput));
      inputParameters.add(inputParameter);
    }

    IOParameter outputParameter = new IOParameter();
    outputParameter.setSource(getNamespacedVariableName(GLOBAL_NAMESPACE, EXCEPTION_VARIABLE));
    outputParameter.setTarget(getNamespacedVariableName(GLOBAL_NAMESPACE, EXCEPTION_VARIABLE));

    workflowTrigger.setInParameters(inputParameters);
    workflowTrigger.setOutParameters(List.of(outputParameter));

    return workflowTrigger;
  }

  @Override
  public void addToWorkflow(BpmnModel model) {
    model.addProcess(process);
  }
}
