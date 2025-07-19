package org.openmetadata.service.governance.workflows.elements.triggers;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import java.util.ArrayList;
import java.util.List;
import java.util.ListIterator;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.flowable.bpmn.model.BoundaryEvent;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.CallActivity;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.ErrorEventDefinition;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.FlowableListener;
import org.flowable.bpmn.model.IOParameter;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.Signal;
import org.flowable.bpmn.model.SignalEventDefinition;
import org.flowable.bpmn.model.StartEvent;
import org.openmetadata.schema.governance.workflows.elements.triggers.Config;
import org.openmetadata.schema.governance.workflows.elements.triggers.Event;
import org.openmetadata.schema.governance.workflows.elements.triggers.EventBasedEntityTriggerDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.elements.TriggerInterface;
import org.openmetadata.service.governance.workflows.elements.triggers.impl.FilterEntityImpl;
import org.openmetadata.service.governance.workflows.flowable.builders.CallActivityBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.SignalBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;

@Slf4j
public class EventBasedEntityTrigger implements TriggerInterface {
  private final Process process;
  @Getter private final String triggerWorkflowId;
  private final List<StartEvent> startEvents = new ArrayList<>();
  private final List<Signal> signals = new ArrayList<>();

  public static String PASSES_FILTER_VARIABLE = "passesFilter";

  public EventBasedEntityTrigger(
      String mainWorkflowName,
      String triggerWorkflowId,
      EventBasedEntityTriggerDefinition triggerDefinition) {
    Process process = new Process();
    process.setId(triggerWorkflowId);
    process.setName(triggerWorkflowId);
    attachWorkflowInstanceListeners(process);

    setStartEvents(triggerWorkflowId, triggerDefinition);

    ServiceTask filterTask = getFilterTask(triggerWorkflowId, triggerDefinition);
    process.addFlowElement(filterTask);

    CallActivity workflowTrigger = getWorkflowTrigger(triggerWorkflowId, mainWorkflowName);
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

    // Start Events -> FilterTask
    for (StartEvent startEvent : startEvents) {
      process.addFlowElement(startEvent);
      process.addFlowElement(new SequenceFlow(startEvent.getId(), filterTask.getId()));
    }

    SequenceFlow filterPassed = new SequenceFlow(filterTask.getId(), workflowTrigger.getId());
    filterPassed.setConditionExpression(String.format("${%s}", PASSES_FILTER_VARIABLE));

    SequenceFlow filterNotPassed = new SequenceFlow(filterTask.getId(), endEvent.getId());
    filterNotPassed.setConditionExpression(String.format("${!%s}", PASSES_FILTER_VARIABLE));

    // FilterTask -> WorkflowTrigger (if passes filter)
    process.addFlowElement(filterPassed);
    // FilterTask -> End (if not passes filter)
    process.addFlowElement(filterNotPassed);
    // WorkflowTrigger -> End
    process.addFlowElement(new SequenceFlow(workflowTrigger.getId(), endEvent.getId()));
    process.addFlowElement(
        new SequenceFlow(runtimeExceptionBoundaryEvent.getId(), errorEndEvent.getId()));

    this.process = process;
    this.triggerWorkflowId = triggerWorkflowId;
  }

  private void setStartEvents(
      String workflowTriggerId, EventBasedEntityTriggerDefinition triggerDefinition) {
    ListIterator<Event> eventsIterator =
        triggerDefinition.getConfig().getEvents().stream().toList().listIterator();

    while (eventsIterator.hasNext()) {
      int index = eventsIterator.nextIndex();
      Event event = eventsIterator.next();

      Signal signal =
          new SignalBuilder()
              .id(
                  getEntitySignalId(
                      triggerDefinition.getConfig().getEntityType(), event.toString()))
              .build();

      SignalEventDefinition signalEventDefinition = new SignalEventDefinition();
      signalEventDefinition.setSignalRef(signal.getId());

      StartEvent startEvent =
          new StartEventBuilder()
              .id(
                  getFlowableElementId(
                      workflowTriggerId, String.format("%s-%s", "startEvent", index)))
              .build();
      startEvent.getEventDefinitions().add(signalEventDefinition);

      this.startEvents.add(startEvent);
      this.signals.add(signal);
    }
  }

  private CallActivity getWorkflowTrigger(String triggerWorkflowId, String mainWorkflowName) {
    CallActivity workflowTrigger =
        new CallActivityBuilder()
            .id(getFlowableElementId(triggerWorkflowId, "workflowTrigger"))
            .calledElement(mainWorkflowName)
            .inheritBusinessKey(true)
            .build();

    IOParameter inputParameter = new IOParameter();
    inputParameter.setSource(getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE));
    inputParameter.setTarget(getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE));

    IOParameter outputParameter = new IOParameter();
    outputParameter.setSource(getNamespacedVariableName(GLOBAL_NAMESPACE, EXCEPTION_VARIABLE));
    outputParameter.setTarget(getNamespacedVariableName(GLOBAL_NAMESPACE, EXCEPTION_VARIABLE));

    workflowTrigger.setInParameters(List.of(inputParameter));
    workflowTrigger.setOutParameters(List.of(outputParameter));

    return workflowTrigger;
  }

  private ServiceTask getFilterTask(
      String workflowTriggerId, EventBasedEntityTriggerDefinition triggerDefinition) {

    ServiceTask serviceTask =
        new ServiceTaskBuilder()
            .id(getFlowableElementId(workflowTriggerId, "filterTask"))
            .implementation(FilterEntityImpl.class.getName())
            .build();

    Config triggerConfig = triggerDefinition.getConfig();

    if (triggerConfig != null) {
      if (triggerConfig.getFilter() != null && !triggerConfig.getFilter().trim().isEmpty()) {
        // Use JSON Logic path
        FieldExtension filterExpr =
            new FieldExtensionBuilder()
                .fieldName("filterExpr")
                .fieldValue(JsonUtils.pojoToJson(triggerConfig.getFilter()))
                .build();
        serviceTask.getFieldExtensions().add(filterExpr);
      }
    }

    return serviceTask;
  }

  private String getEntitySignalId(String entityType, String event) {
    return String.format("%s-entity%s", entityType, event);
  }

  @Override
  public void addToWorkflow(BpmnModel model) {
    model.addProcess(process);
    for (Signal signal : signals) {
      model.addSignal(signal);
    }
  }
}
