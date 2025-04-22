package org.openmetadata.service.governance.workflows;

import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;

@Slf4j
public class WorkflowInstanceExecutionIdSetterListener implements JavaDelegate {
  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      String workflowName = getProcessDefinitionKeyFromId(execution.getProcessDefinitionId());
      String relatedEntity =
          (String) varHandler.getNamespacedVariable(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE);
      LOG.debug(
          String.format(
              "New Execution for Workflow '%s'. Related Entity: '%s'",
              workflowName, relatedEntity));

      UUID workflowInstanceExecutionId = UUID.randomUUID();
      execution.setVariable(WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE, workflowInstanceExecutionId);
    } catch (Exception exc) {
      LOG.error(
          String.format(
              "[%s] Failed due to: %s ",
              getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()), exc.getMessage()),
          exc);
    }
  }
}
