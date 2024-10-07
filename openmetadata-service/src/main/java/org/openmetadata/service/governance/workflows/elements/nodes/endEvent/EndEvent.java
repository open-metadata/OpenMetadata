package org.openmetadata.service.governance.workflows.elements.nodes.endEvent;

import static org.openmetadata.service.governance.workflows.Workflow.getMetadataExtension;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.Process;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.service.governance.workflows.elements.WorkflowNodeInterface;

public class EndEvent implements WorkflowNodeInterface {
  private final org.flowable.bpmn.model.EndEvent endEvent;

  public EndEvent(WorkflowNodeDefinitionInterface nodeDefinition) {
    org.flowable.bpmn.model.EndEvent endEvent = new org.flowable.bpmn.model.EndEvent();
    endEvent.setId(nodeDefinition.getName());
    endEvent.setName(nodeDefinition.getDisplayName());
    endEvent.addExtensionElement(
        getMetadataExtension(nodeDefinition.getName(), nodeDefinition.getDisplayName(), null));

    // Attach Listeners
    attachWorkflowInstanceStageUpdaterListeners(endEvent);

    this.endEvent = endEvent;
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(endEvent);
  }
}
