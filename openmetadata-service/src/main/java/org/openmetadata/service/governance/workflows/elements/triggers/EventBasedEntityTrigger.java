package org.openmetadata.service.governance.workflows.elements.triggers;

import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;

import java.util.ArrayList;
import java.util.List;
import java.util.ListIterator;
import lombok.Getter;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.Signal;
import org.flowable.bpmn.model.SignalEventDefinition;
import org.flowable.bpmn.model.StartEvent;
import org.openmetadata.schema.governance.workflows.elements.triggers.Event;
import org.openmetadata.schema.governance.workflows.elements.triggers.EventBasedEntityTriggerDefinition;
import org.openmetadata.service.governance.workflows.elements.TriggerInterface;
import org.openmetadata.service.governance.workflows.elements.triggers.impl.TriggerEntityWorkflowImpl;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.SignalBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;

public class EventBasedEntityTrigger implements TriggerInterface {
  private final Process process;
  @Getter private final String triggerWorkflowId;
  private final List<StartEvent> startEvents = new ArrayList<>();
  private final List<Signal> signals = new ArrayList<>();

  public EventBasedEntityTrigger(
      String mainWorkflowName,
      String triggerWorkflowId,
      EventBasedEntityTriggerDefinition triggerDefinition) {
    Process process = new Process();
    process.setId(triggerWorkflowId);
    process.setName(triggerWorkflowId);
    attachWorkflowInstanceListeners(process);

    setStartEvents(triggerWorkflowId, triggerDefinition);

    ServiceTask triggerWorkflow =
        getWorkflowTriggerTask(triggerWorkflowId, mainWorkflowName, triggerDefinition);
    triggerWorkflow.setAsynchronous(true);
    process.addFlowElement(triggerWorkflow);

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(triggerWorkflowId, "endEvent")).build();
    process.addFlowElement(endEvent);

    for (StartEvent startEvent : startEvents) {
      process.addFlowElement(startEvent);
      process.addFlowElement(new SequenceFlow(startEvent.getId(), triggerWorkflow.getId()));
    }
    process.addFlowElement(new SequenceFlow(triggerWorkflow.getId(), endEvent.getId()));

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

  private ServiceTask getWorkflowTriggerTask(
      String workflowTriggerId,
      String mainWorkflowName,
      EventBasedEntityTriggerDefinition triggerDefinition) {
    FieldExtension workflowNameExpr =
        new FieldExtensionBuilder()
            .fieldName("workflowNameExpr")
            .fieldValue(mainWorkflowName)
            .build();

    ServiceTask serviceTask =
        new ServiceTaskBuilder()
            .id(getFlowableElementId(workflowTriggerId, "workflowTrigger"))
            .implementation(TriggerEntityWorkflowImpl.class.getName())
            .build();
    serviceTask.getFieldExtensions().add(workflowNameExpr);

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
