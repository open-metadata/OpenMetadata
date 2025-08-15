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
    String workflowName = getProcessDefinitionKeyFromId(execution.getProcessDefinitionId());
    String processInstanceId = execution.getProcessInstanceId();

    // CRITICAL: Always set the execution ID first - this is mandatory for stage tracking
    UUID workflowInstanceExecutionId = UUID.randomUUID();
    execution.setVariable(WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE, workflowInstanceExecutionId);
    LOG.info(
        "[WORKFLOW_EXEC_ID_SET] Workflow: {}, ProcessInstance: {}, ExecutionId: {} - Execution ID initialized",
        workflowName,
        processInstanceId,
        workflowInstanceExecutionId);

    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      String relatedEntity =
          (String) varHandler.getNamespacedVariable(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE);

      if (relatedEntity == null || relatedEntity.isEmpty()) {
        LOG.error(
            "[WORKFLOW_MISSING_ENTITY] Workflow: {}, ProcessInstance: {}, ExecutionId: {} - RELATED_ENTITY variable is null/empty. Workflow will likely fail.",
            workflowName,
            processInstanceId,
            workflowInstanceExecutionId);
        execution.setVariable(Workflow.FAILURE_VARIABLE, true);
        execution.setVariable("startupError", "Missing required variable: relatedEntity");
      } else {
        LOG.info(
            "[WORKFLOW_EXEC_STARTED] Workflow: {}, ProcessInstance: {}, ExecutionId: {}, RelatedEntity: {} - Workflow execution initialized successfully",
            workflowName,
            processInstanceId,
            workflowInstanceExecutionId,
            relatedEntity);
      }
    } catch (Exception exc) {
      LOG.error(
          "[WORKFLOW_INIT_ERROR] Workflow: {}, ProcessInstance: {}, ExecutionId: {} - Failed to retrieve relatedEntity variable. Error: {}",
          workflowName,
          processInstanceId,
          workflowInstanceExecutionId,
          exc.getMessage(),
          exc);
      // Set failure indicator but don't prevent workflow from starting
      execution.setVariable(Workflow.FAILURE_VARIABLE, true);
      execution.setVariable("startupError", "Failed to get relatedEntity: " + exc.getMessage());
    }
  }
}
