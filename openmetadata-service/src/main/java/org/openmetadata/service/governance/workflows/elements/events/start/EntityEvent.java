package org.openmetadata.service.governance.workflows.elements.events.start;

import static org.openmetadata.service.governance.workflows.Workflow.getMetadataExtension;

import java.util.ArrayList;
import java.util.List;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.Signal;
import org.flowable.bpmn.model.SignalEventDefinition;
import org.flowable.bpmn.model.StartEvent;
import org.openmetadata.schema.governanceWorkflows.elements.events.start.Event;

public class EntityEvent {
  private final StartEvent startEvent;
  private final List<Signal> signals;

  public EntityEvent(
      org.openmetadata.schema.governanceWorkflows.elements.events.start.EntityEvent entityEvent) {
    StartEvent startEvent = new StartEvent();
    startEvent.setId(entityEvent.getName());
    startEvent.setName(entityEvent.getDisplayName());
    startEvent.addExtensionElement(
        getMetadataExtension(
            entityEvent.getName(), entityEvent.getDisplayName(), entityEvent.getDescription()));

    List<Signal> signals = new ArrayList<>();

    for (Event event : entityEvent.getConfig().getEvents()) {
      for (String entityType : entityEvent.getConfig().getEntityTypes()) {
        String signalId = String.format("%s-%s", entityType, event.toString());

        Signal signal = new Signal();
        signal.setId(signalId);
        signal.setName(signalId);

        SignalEventDefinition signalEventDefinition = new SignalEventDefinition();
        signalEventDefinition.setSignalRef(signalId);
        startEvent.getEventDefinitions().add(signalEventDefinition);

        signals.add(signal);
      }
    }

    this.signals = signals;
    this.startEvent = startEvent;
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    for (Signal signal : signals) {
      model.addSignal(signal);
    }
    process.addFlowElement(startEvent);
  }
}
