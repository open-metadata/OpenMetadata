package org.openmetadata.service.governance.workflows.elements.nodes.userTask.manualRetry;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RETRY_LOCK_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.STEP_TO_RETRY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class ManualRetryDelegate implements JavaDelegate {
  private Expression inputNamespaceMapExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      Map<String, String> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);

      String stepToRetry =
          (String)
              varHandler.getNamespacedVariable(
                  inputNamespaceMap.get(STEP_TO_RETRY_VARIABLE), STEP_TO_RETRY_VARIABLE);

      new ManualRetryImpl().execute(execution.getParentId(), stepToRetry);

    } catch (Exception exc) {
      LOG.error(
          String.format(
              "[%s] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId())),
          exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    } finally {
      varHandler.removeGlobalVariable(RETRY_LOCK_VARIABLE);
      varHandler.removeGlobalVariable(STEP_TO_RETRY_VARIABLE);
    }
  }
}
