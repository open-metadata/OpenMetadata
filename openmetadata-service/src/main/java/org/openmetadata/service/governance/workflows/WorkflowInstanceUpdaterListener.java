package org.openmetadata.service.governance.workflows;

import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository;

import java.util.UUID;

import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

@Slf4j
public class WorkflowInstanceUpdaterListener implements JavaDelegate {
    @Override
    public void execute(DelegateExecution execution) {
        WorkflowInstanceStateRepository workflowInstanceStateRepository = (WorkflowInstanceStateRepository) Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE_STATE);
        updateBusinessKey(execution.getProcessInstanceId());

        switch (execution.getEventName()) {
            case "start" -> addNewStage(execution, workflowInstanceStateRepository);
            case "end" -> updateStage(execution, workflowInstanceStateRepository);
            default -> LOG.debug(String.format("WorkflowStageUpdaterListener does not support listening for the event: '%s'", execution.getEventName()));
        }
    }

    private void updateBusinessKey(String processInstanceId) {
        UUID workflowInstanceBusinessKey = UUID.randomUUID();
        WorkflowHandler.getInstance().updateBusinessKey(processInstanceId, workflowInstanceBusinessKey);
    }

    private void addNewStage(DelegateExecution execution, WorkflowInstanceStateRepository workflowInstanceStateRepository) {
        String processDefinitionKey = getProcessDefinitionKeyFromId(execution.getProcessDefinitionId());
        String processInstanceBusinessKey = execution.getProcessInstanceBusinessKey();
        String stage = "Workflow";

        UUID workflowInstanceStateId = workflowInstanceStateRepository.addNewStageToInstance(stage, processInstanceBusinessKey, processDefinitionKey, System.currentTimeMillis());
        execution.setVariable("workflowInstanceStateId", workflowInstanceStateId);
    }

    private void updateStage(DelegateExecution execution, WorkflowInstanceStateRepository workflowInstanceStateRepository) {
        UUID workflowInstanceStateId = (UUID) execution.getVariable("workflowInstanceStateId");
        workflowInstanceStateRepository.updateStage(workflowInstanceStateId, System.currentTimeMillis(), execution.getVariables());
    }
}
