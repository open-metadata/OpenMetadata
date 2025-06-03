package org.openmetadata.service.governance.workflows.elements.nodes.startEvent;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.Process;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.startEvent.StartEventDefinition;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;

public class StartEvent implements NodeInterface {
  private final org.flowable.bpmn.model.StartEvent startEvent;

  public StartEvent(StartEventDefinition nodeDefinition, WorkflowConfiguration config) {
    this.startEvent = new StartEventBuilder().id(nodeDefinition.getName()).build();
    attachWorkflowInstanceExecutionIdSetterListener(startEvent);

    if (config.getStoreStageStatus()) {
      attachWorkflowInstanceStageListeners(startEvent);
    }
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(startEvent);
  }
}
