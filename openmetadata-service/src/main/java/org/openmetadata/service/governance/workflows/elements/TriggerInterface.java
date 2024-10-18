package org.openmetadata.service.governance.workflows.elements;

import org.flowable.bpmn.model.BpmnModel;

public interface TriggerInterface {
  String getTriggerWorkflowId();

  void addToWorkflow(BpmnModel model);
}
