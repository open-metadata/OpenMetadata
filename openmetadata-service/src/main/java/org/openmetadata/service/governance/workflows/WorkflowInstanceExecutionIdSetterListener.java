package org.openmetadata.service.governance.workflows;

import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;

import java.util.UUID;

public class WorkflowInstanceExecutionIdSetterListener implements JavaDelegate {
    @Override
    public void execute(DelegateExecution execution) {
        UUID workflowInstanceExecutionId = UUID.randomUUID();
        execution.setVariable("workflowInstanceExecutionId", workflowInstanceExecutionId);
    }
}
