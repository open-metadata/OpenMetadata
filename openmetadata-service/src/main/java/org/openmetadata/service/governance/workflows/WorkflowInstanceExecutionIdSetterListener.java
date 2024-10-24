package org.openmetadata.service.governance.workflows;

import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE;

import java.util.UUID;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;

public class WorkflowInstanceExecutionIdSetterListener implements JavaDelegate {
  @Override
  public void execute(DelegateExecution execution) {
    UUID workflowInstanceExecutionId = UUID.randomUUID();
    execution.setVariable(WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE, workflowInstanceExecutionId);
  }
}
