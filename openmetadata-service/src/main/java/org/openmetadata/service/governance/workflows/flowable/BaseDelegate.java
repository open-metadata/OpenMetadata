package org.openmetadata.service.governance.workflows.flowable;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;

@Slf4j
public abstract class BaseDelegate implements JavaDelegate {
  private Expression inputNamespaceMapExpr;
  private Expression configMapExpr;

  protected WorkflowVariableHandler varHandler;
  protected Map<String, String> inputNamespaceMap;
  protected Map<String, Object> configMap;

  protected abstract void innerExecute(DelegateExecution execution);

  @Override
  public void execute(DelegateExecution execution) {
    String workflowName = getProcessDefinitionKeyFromId(execution.getProcessDefinitionId());
    String processInstanceId = execution.getProcessInstanceId();
    String activityId = execution.getCurrentActivityId();
    String delegateClass = this.getClass().getSimpleName();

    varHandler = new WorkflowVariableHandler(execution);
    try {
      inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);
      configMap = JsonUtils.readOrConvertValue(configMapExpr.getValue(execution), Map.class);

      LOG.debug(
          "[DELEGATE_EXECUTE] Workflow: {}, ProcessInstance: {}, Activity: {}, Delegate: {} - Starting delegate execution",
          workflowName,
          processInstanceId,
          activityId,
          delegateClass);

      innerExecute(execution);

      LOG.debug(
          "[DELEGATE_SUCCESS] Workflow: {}, ProcessInstance: {}, Activity: {}, Delegate: {} - Delegate execution completed",
          workflowName,
          processInstanceId,
          activityId,
          delegateClass);
    } catch (Exception exc) {
      LOG.error(
          "[DELEGATE_ERROR] Workflow: {}, ProcessInstance: {}, Activity: {}, Delegate: {} - Delegate execution failed. Error: {}",
          workflowName,
          processInstanceId,
          activityId,
          delegateClass,
          exc.getMessage(),
          exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, exc.toString());
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }
}
