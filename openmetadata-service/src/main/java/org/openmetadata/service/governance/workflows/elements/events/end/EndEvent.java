package org.openmetadata.service.governance.workflows.elements.events.end;

import static org.openmetadata.service.governance.workflows.Workflow.getMetadataExtension;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.Process;

public class EndEvent {
  private final org.flowable.bpmn.model.EndEvent endEvent;

  public EndEvent(org.openmetadata.schema.api.governance.EndEvent endEventConfig) {
    org.flowable.bpmn.model.EndEvent endEvent = new org.flowable.bpmn.model.EndEvent();
    endEvent.setId(endEventConfig.getName());
    endEvent.setName(endEventConfig.getDisplayName());
    endEvent.addExtensionElement(
        getMetadataExtension(endEventConfig.getName(), endEventConfig.getDisplayName(), null));

    this.endEvent = endEvent;
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(endEvent);
  }
}
