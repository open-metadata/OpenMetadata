package org.openmetadata.service.governance.workflows;

import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository;

import java.util.Optional;
import java.util.UUID;

import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;
@Slf4j
public class WorkflowInstanceStageUpdaterListener implements JavaDelegate {
    @Override
    public void execute(DelegateExecution execution) {
        WorkflowInstanceStateRepository workflowInstanceStateRepository = (WorkflowInstanceStateRepository) Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE_STATE);

        switch (execution.getEventName()) {
            case "start" -> addNewStage(execution, workflowInstanceStateRepository);
            case "end" -> updateStage(execution, workflowInstanceStateRepository);
            default -> LOG.debug(String.format("WorkflowStageUpdaterListener does not support listening for the event: '%s'", execution.getEventName()));
        }
    }

    private void addNewStage(DelegateExecution execution, WorkflowInstanceStateRepository workflowInstanceStateRepository) {
        String processDefinitionKey = getProcessDefinitionKeyFromId(execution.getProcessDefinitionId());
        String processInstanceBusinessKey = execution.getProcessInstanceBusinessKey();
        String stage = Optional.ofNullable(execution.getCurrentActivityId()).orElse(processDefinitionKey);
        UUID workflowInstanceStateId = workflowInstanceStateRepository.addNewStageToInstance(stage, processInstanceBusinessKey, processDefinitionKey, System.currentTimeMillis());
        execution.setVariable("stageInstanceStateId", workflowInstanceStateId);
    }

    private void updateStage(DelegateExecution execution, WorkflowInstanceStateRepository workflowInstanceStateRepository) {
        UUID workflowInstanceStateId = (UUID) execution.getVariable("stageInstanceStateId");
        workflowInstanceStateRepository.updateStage(workflowInstanceStateId, System.currentTimeMillis(), execution.getVariables());
    }
}
