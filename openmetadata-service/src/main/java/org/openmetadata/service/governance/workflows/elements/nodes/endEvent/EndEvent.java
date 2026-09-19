package org.openmetadata.service.governance.workflows.elements.nodes.endEvent;

import lombok.Getter;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.TerminateEventDefinition;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.endEvent.EndEventDefinition;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;

@Getter
public class EndEvent implements NodeInterface {
  private final org.flowable.bpmn.model.EndEvent endEvent;

  public EndEvent(String id) {
    this(id, false);
  }

  public EndEvent(String id, boolean terminateAll) {
    this.endEvent = new EndEventBuilder().id(id).build();
    if (terminateAll) {
      addTerminationDefinition();
    }
  }

  public EndEvent(EndEventDefinition nodeDefinition, WorkflowConfiguration config) {
    this(nodeDefinition.getName(), Boolean.TRUE.equals(nodeDefinition.getTerminateAll()));

    if (config.getStoreStageStatus()) {
      attachWorkflowInstanceStageListeners(endEvent);
    }
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(endEvent);
  }

  private void addTerminationDefinition() {
    TerminateEventDefinition termination = new TerminateEventDefinition();
    termination.setTerminateAll(true);
    endEvent.addEventDefinition(termination);
  }
}
