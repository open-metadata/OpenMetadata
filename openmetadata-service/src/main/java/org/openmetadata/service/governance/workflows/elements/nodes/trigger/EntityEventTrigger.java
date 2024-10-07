package org.openmetadata.service.governance.workflows.elements.nodes.trigger;

import static org.openmetadata.service.governance.workflows.Workflow.getMetadataExtension;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.Signal;
import org.flowable.bpmn.model.SignalEventDefinition;
import org.flowable.bpmn.model.StartEvent;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.service.governance.workflows.elements.WorkflowNodeInterface;
import org.openmetadata.schema.governance.workflows.elements.nodes.trigger.EntityEventTriggerDefinition;

public class EntityEventTrigger implements WorkflowNodeInterface {
  private final StartEvent startEvent;
  private final Signal signal;

  public EntityEventTrigger(WorkflowNodeDefinitionInterface nodeDefinition) {
    EntityEventTriggerDefinition node = (EntityEventTriggerDefinition) nodeDefinition;

    StartEvent startEvent = new StartEvent();
    startEvent.setId(node.getName());
    startEvent.setName(node.getDisplayName());
    startEvent.addExtensionElement(
        getMetadataExtension(
                node.getName(), node.getDisplayName(), node.getDescription()));

    // Attach Listeners
    attachWorkflowInstanceStageUpdaterListeners(startEvent);

    String signalId = getEntitySignalId(node.getConfig().getEntityType(), node.getConfig().getEvent().toString());
    Signal signal = new Signal();
    signal.setId(signalId);
    signal.setName(signalId);

    SignalEventDefinition signalEventDefinition = new SignalEventDefinition();
    signalEventDefinition.setSignalRef(signalId);
    startEvent.getEventDefinitions().add(signalEventDefinition);

    this.signal = signal;
    this.startEvent = startEvent;
  }


  public void addToWorkflow(BpmnModel model, Process process) {
    model.addSignal(signal);
    process.addFlowElement(startEvent);
  }

  private String getEntitySignalId(String entityType, String event) {
    return String.format("%s-entity%s", entityType, event);
  }
}
