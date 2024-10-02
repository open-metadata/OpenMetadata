package org.openmetadata.service.governance.workflows;

import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.governance.workflows.WorkflowInstanceState;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository;

import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;


public class WorkflowStartListener implements JavaDelegate {
    @Override
    public void execute(DelegateExecution execution) {
        String processDefinitionKey = getProcessDefinitionKeyFromId(execution.getProcessDefinitionId());
        String processInstanceId = execution.getProcessInstanceId();

        WorkflowInstanceStateRepository workflowInstanceStateRepository = (WorkflowInstanceStateRepository) Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE_STATE);
        workflowInstanceStateRepository.addNewStateToInstance(WorkflowInstanceState.State.CREATED, processInstanceId, processDefinitionKey);
    }
}
