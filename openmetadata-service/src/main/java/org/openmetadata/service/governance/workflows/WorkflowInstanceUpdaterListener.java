package org.openmetadata.service.governance.workflows;

import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository;

import java.util.UUID;

import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

@Slf4j
public class WorkflowInstanceUpdaterListener implements JavaDelegate {
    @Override
    public void execute(DelegateExecution execution) {
        WorkflowInstanceRepository workflowInstanceRepository = (WorkflowInstanceRepository) Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE);

        switch (execution.getEventName()) {
            case "start" -> addNewStage(execution, workflowInstanceRepository);
            case "end" -> updateStage(execution, workflowInstanceRepository);
            default -> LOG.debug(String.format("WorkflowStageUpdaterListener does not support listening for the event: '%s'", execution.getEventName()));
        }
    }

    private void updateBusinessKey(String processInstanceId) {
        UUID workflowInstanceBusinessKey = UUID.randomUUID();
        WorkflowHandler.getInstance().updateBusinessKey(processInstanceId, workflowInstanceBusinessKey);
    }

    private void addNewStage(DelegateExecution execution, WorkflowInstanceRepository workflowInstanceRepository) {
        updateBusinessKey(execution.getProcessInstanceId());

        String workflowDefinitionName = getProcessDefinitionKeyFromId(execution.getProcessDefinitionId());
        UUID workflowInstanceId = UUID.fromString(execution.getProcessInstanceBusinessKey());

        workflowInstanceRepository.addNewWorkflowInstance(workflowDefinitionName, workflowInstanceId, System.currentTimeMillis());
    }

    private void updateStage(DelegateExecution execution, WorkflowInstanceRepository workflowInstanceRepository) {
        UUID workflowInstanceId = UUID.fromString(execution.getProcessInstanceBusinessKey());
        workflowInstanceRepository.updateWorkflowInstance(workflowInstanceId, System.currentTimeMillis());
    }
}
