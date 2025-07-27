package org.openmetadata.service.governance.workflows.flowable;

import lombok.Getter;
import org.flowable.bpmn.model.BpmnModel;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.service.governance.workflows.elements.TriggerFactory;
import org.openmetadata.service.governance.workflows.elements.TriggerInterface;

@Getter
public class TriggerWorkflow {
  private final BpmnModel model;
  private final String workflowName;

  public TriggerWorkflow(WorkflowDefinition workflowDefinition) {
    BpmnModel model = new BpmnModel();
    model.setTargetNamespace("");
    TriggerInterface trigger = TriggerFactory.createTrigger(workflowDefinition);
    trigger.addToWorkflow(model);

    this.model = model;
    this.workflowName = trigger.getTriggerWorkflowId();
  }
}
