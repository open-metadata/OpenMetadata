package org.openmetadata.service.governance.workflows.elements.triggers.impl;

import java.util.HashMap;
import java.util.Map;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.service.governance.workflows.WorkflowHandler;

public class TriggerEntityWorkflowImpl implements JavaDelegate {
  private Expression workflowNameExpr;

  @Override
  public void execute(DelegateExecution execution) {
    String workflowName = (String) workflowNameExpr.getValue(execution);
    String entityLinkStr = (String) execution.getVariable("relatedEntity");

    WorkflowHandler workflowHandler = WorkflowHandler.getInstance();
    triggerWorkflow(
        workflowHandler, execution.getProcessInstanceBusinessKey(), entityLinkStr, workflowName);
  }

  private void triggerWorkflow(
      WorkflowHandler workflowHandler,
      String businessKey,
      String entityLinkStr,
      String workflowName) {
    Map<String, Object> variables = new HashMap<>();
    variables.put("relatedEntity", entityLinkStr);
    workflowHandler.triggerByKey(workflowName, businessKey, variables);
  }
}
