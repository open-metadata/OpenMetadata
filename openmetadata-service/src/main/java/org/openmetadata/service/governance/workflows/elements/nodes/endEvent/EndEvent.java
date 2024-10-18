package org.openmetadata.service.governance.workflows.elements.nodes.endEvent;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.Process;
import org.openmetadata.schema.governance.workflows.elements.nodes.endEvent.EndEventDefinition;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;

public class EndEvent implements NodeInterface {
  private final org.flowable.bpmn.model.EndEvent endEvent;

  public EndEvent(EndEventDefinition nodeDefinition) {
    this.endEvent = new EndEventBuilder().id(nodeDefinition.getName()).build();
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(endEvent);
  }
}
