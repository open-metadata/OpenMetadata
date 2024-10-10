package org.openmetadata.service.governance.workflows.elements.nodes.trigger;

import static org.openmetadata.service.governance.workflows.Workflow.getMetadataExtension;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.Signal;
import org.flowable.bpmn.model.SignalEventDefinition;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.bpmn.model.SubProcess;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.governance.workflows.elements.nodes.trigger.Event;
import org.openmetadata.service.governance.workflows.elements.WorkflowNodeInterface;
import org.openmetadata.schema.governance.workflows.elements.nodes.trigger.EntityEventTriggerDefinition;

import javax.sound.midi.Sequence;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.ListIterator;

public class EntityEventTrigger implements WorkflowNodeInterface {
  private final SubProcess subProcess;
  private final List<StartEvent> startEvents;
  private final List<Signal> signals;
  private final List<SequenceFlow> sequenceFlows;

  public EntityEventTrigger(WorkflowNodeDefinitionInterface nodeDefinition) {
    EntityEventTriggerDefinition node = (EntityEventTriggerDefinition) nodeDefinition;

    SubProcess subProcess = new SubProcess();
    subProcess.setId(node.getName());
    subProcess.setName(node.getDisplayName());
    subProcess.addExtensionElement(
            getMetadataExtension(
                    node.getName(), node.getDisplayName(), node.getDescription()));

    StartEvent subProcessStartEvent = new StartEvent();
    subProcessStartEvent.setId(getFlowableElementId(nodeDefinition.getName(), "startEvent"));
    subProcessStartEvent.setName(getFlowableElementName(nodeDefinition.getNodeDisplayName(), "startEvent"));
    subProcess.addFlowElement(subProcessStartEvent);

    EndEvent endEvent = new EndEvent();
    endEvent.setId(getFlowableElementId(nodeDefinition.getName(), "endEvent"));
    endEvent.setName(getFlowableElementName(nodeDefinition.getNodeDisplayName(), "endEvent"));
    subProcess.addFlowElement(endEvent);

    subProcess.addFlowElement(new SequenceFlow(subProcessStartEvent.getId(), endEvent.getId()));

    // Attach Listeners
    attachWorkflowInstanceStageUpdaterListeners(subProcess);

    List<StartEvent> startEvents = new ArrayList<>();
    List<Signal> signals = new ArrayList<>();
    List<SequenceFlow> sequenceFlows = new ArrayList<>();

    ListIterator<Event> eventsIterator = node.getConfig().getEvents().stream().toList().listIterator();

    while (eventsIterator.hasNext()) {
      int index = eventsIterator.nextIndex();
      Event event = eventsIterator.next();

      String startEventId = String.format("%s-%s", node.getName(), index);
      StartEvent startEvent = new StartEvent();
      startEvent.setId(startEventId);
      startEvent.setName(startEventId);

      String signalId = getEntitySignalId(node.getConfig().getEntityType(), event.toString());
      Signal signal = new Signal();
      signal.setId(signalId);
      signal.setName(signalId);

      SignalEventDefinition signalEventDefinition = new SignalEventDefinition();
      signalEventDefinition.setSignalRef(signalId);

      startEvent.getEventDefinitions().add(signalEventDefinition);

      signals.add(signal);
      startEvents.add(startEvent);
      sequenceFlows.add(new SequenceFlow(startEvent.getId(), subProcess.getId()));
    }

//    for (int i = 0; i < node.getConfig().getEvents().size(); i++) {
//      String startEventId = String.format("%s-%s", node.getName(), i);
//      StartEvent startEvent = new StartEvent();
//      startEvent.setId(startEventId);
//      startEvent.setName(startEventId);
////      startEvent.addExtensionElement(
////          getMetadataExtension(
////                  node.getName(), node.getDisplayName(), node.getDescription()));
//
//      // Attach Listeners
////      attachWorkflowInstanceStageUpdaterListeners(startEvent);
//
//        String signalId = getEntitySignalId(node.getConfig().getEntityType(), event.toString());
//        Signal signal = new Signal();
//        signal.setId(signalId);
//        signal.setName(signalId);
//
//        signals.add(signal);
//
//        SignalEventDefinition signalEventDefinition = new SignalEventDefinition();
//        signalEventDefinition.setSignalRef(signalId);
//
//        startEvent.getEventDefinitions().add(signalEventDefinition);
//    }

    this.signals = signals;
    this.startEvents = startEvents;
    this.sequenceFlows = sequenceFlows;
    this.subProcess = subProcess;
  }


  public void addToWorkflow(BpmnModel model, Process process) {
    for (Signal signal : signals) {
      model.addSignal(signal);
    }
    for (StartEvent startEvent : startEvents) {
      process.addFlowElement(startEvent);
    }
    for (SequenceFlow sequenceFlow : sequenceFlows) {
      process.addFlowElement(sequenceFlow);
    }
    process.addFlowElement(subProcess);
  }

  private String getEntitySignalId(String entityType, String event) {
    return String.format("%s-entity%s", entityType, event);
  }
}
