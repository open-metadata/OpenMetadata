package org.openmetadata.service.governance.workflows.elements.triggers.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;

@Slf4j
public class SetProcessVariableImpl implements JavaDelegate {
  private Expression varNameExpr;
  private Expression varValueExpr;

  @Override
  public void execute(DelegateExecution execution) {
    try {
      String varName = (String) varNameExpr.getValue(execution);
      //            String varValue = (String) varValueExpr.getValue(execution);
      execution.setVariable(varName, varValueExpr.getValue(execution));
    } catch (Exception exc) {
      LOG.error(
          String.format(
              "[%s] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId())),
          exc);
      execution.setVariable(EXCEPTION_VARIABLE, exc.toString());
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }
}
