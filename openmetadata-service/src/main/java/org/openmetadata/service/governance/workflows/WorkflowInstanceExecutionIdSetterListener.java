package org.openmetadata.service.governance.workflows;

import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;

import java.util.UUID;

import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE;

public class WorkflowInstanceExecutionIdSetterListener implements JavaDelegate {
    @Override
    public void execute(DelegateExecution execution) {
        UUID workflowInstanceExecutionId = UUID.randomUUID();
        execution.setVariable(WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE, workflowInstanceExecutionId);
    }
}
