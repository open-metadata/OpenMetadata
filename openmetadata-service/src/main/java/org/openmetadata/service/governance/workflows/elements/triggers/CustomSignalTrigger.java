package org.openmetadata.service.governance.workflows.elements.triggers;

import static org.openmetadata.service.governance.workflows.Workflow.PAYLOAD;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;

import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import org.flowable.bpmn.model.BoundaryEvent;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.CallActivity;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.ErrorEventDefinition;
import org.flowable.bpmn.model.IOParameter;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.Signal;
import org.flowable.bpmn.model.SignalEventDefinition;
import org.flowable.bpmn.model.StartEvent;
import org.jetbrains.annotations.NotNull;
import org.openmetadata.schema.governance.workflows.elements.triggers.CustomSignalTriggerDefinition;
import org.openmetadata.service.governance.workflows.elements.TriggerInterface;
import org.openmetadata.service.governance.workflows.flowable.builders.CallActivityBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.SignalBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;

public class CustomSignalTrigger implements TriggerInterface {
  private final Process process;
  @Getter private final String triggerWorkflowId;
  private StartEvent startEvent = null;
  private final List<Signal> signals = new ArrayList<>();

  public CustomSignalTrigger(
      String mainWorkflowName,
      String triggerWorkflowId,
      CustomSignalTriggerDefinition triggerDefinition) {
    Process process = new Process();
    process.setId(triggerWorkflowId);
    process.setName(triggerWorkflowId);
    attachWorkflowInstanceListeners(process);

    setStartEvent(triggerWorkflowId, triggerDefinition);

    CallActivity workflowTrigger = getWorkflowTrigger(triggerWorkflowId, mainWorkflowName);
    process.addFlowElement(workflowTrigger);

    BoundaryEvent runtimeExceptionBoundaryEvent = getBoundaryEvent(workflowTrigger);
    process.addFlowElement(runtimeExceptionBoundaryEvent);

    EndEvent errorEndEvent =
        new EndEventBuilder().id(getFlowableElementId(triggerWorkflowId, "errorEndEvent")).build();
    process.addFlowElement(errorEndEvent);

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(triggerWorkflowId, "endEvent")).build();
    process.addFlowElement(endEvent);

    // Start Events -> FilterTask
    process.addFlowElement(startEvent);
    process.addFlowElement(new SequenceFlow(startEvent.getId(), workflowTrigger.getId()));
    process.addFlowElement(new SequenceFlow(workflowTrigger.getId(), endEvent.getId()));

    // WorkflowTrigger -> End
    process.addFlowElement(
        new SequenceFlow(runtimeExceptionBoundaryEvent.getId(), errorEndEvent.getId()));

    this.process = process;
    this.triggerWorkflowId = triggerWorkflowId;
  }

  private static @NotNull BoundaryEvent getBoundaryEvent(CallActivity workflowTrigger) {
    ErrorEventDefinition runtimeExceptionDefinition = new ErrorEventDefinition();
    runtimeExceptionDefinition.setErrorCode(WORKFLOW_RUNTIME_EXCEPTION);

    BoundaryEvent runtimeExceptionBoundaryEvent = new BoundaryEvent();
    runtimeExceptionBoundaryEvent.setId(
        getFlowableElementId(workflowTrigger.getId(), "runtimeExceptionBoundaryEvent"));
    runtimeExceptionBoundaryEvent.addEventDefinition(runtimeExceptionDefinition);

    runtimeExceptionBoundaryEvent.setAttachedToRef(workflowTrigger);
    return runtimeExceptionBoundaryEvent;
  }

  private void setStartEvent(
      String workflowTriggerId, CustomSignalTriggerDefinition triggerDefinition) {
    Signal signal = new SignalBuilder().id(triggerDefinition.getConfig().getSignal()).build();

    SignalEventDefinition signalEventDefinition = new SignalEventDefinition();
    signalEventDefinition.setSignalRef(signal.getId());

    StartEvent startEvent =
        new StartEventBuilder().id(getFlowableElementId(workflowTriggerId, "customSignal")).build();
    startEvent.getEventDefinitions().add(signalEventDefinition);

    this.startEvent = startEvent;
    this.signals.add(signal);
  }

  private CallActivity getWorkflowTrigger(String triggerWorkflowId, String mainWorkflowName) {
    CallActivity workflowTrigger =
        new CallActivityBuilder()
            .id(getFlowableElementId(triggerWorkflowId, "workflowTrigger"))
            .calledElement(mainWorkflowName)
            .inheritBusinessKey(true)
            .build();

    IOParameter inputParameter = new IOParameter();
    inputParameter.setSource(PAYLOAD);
    inputParameter.setTarget(PAYLOAD);

    IOParameter outputParameter = new IOParameter();
    outputParameter.setSource(PAYLOAD);
    outputParameter.setTarget(PAYLOAD);

    workflowTrigger.setInParameters(List.of(inputParameter));
    workflowTrigger.setOutParameters(List.of(outputParameter));

    return workflowTrigger;
  }

  @Override
  public void addToWorkflow(BpmnModel model) {
    model.addProcess(process);
    for (Signal signal : signals) {
      model.addSignal(signal);
    }
  }
}
