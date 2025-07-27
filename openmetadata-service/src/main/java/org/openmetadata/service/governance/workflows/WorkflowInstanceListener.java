package org.openmetadata.service.governance.workflows;

import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;

@Slf4j
public class WorkflowInstanceListener implements JavaDelegate {
  @Override
  public void execute(DelegateExecution execution) {
    try {
      WorkflowInstanceRepository workflowInstanceRepository =
          (WorkflowInstanceRepository)
              Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE);

      switch (execution.getEventName()) {
        case "start" -> addWorkflowInstance(execution, workflowInstanceRepository);
        case "end" -> updateWorkflowInstance(execution, workflowInstanceRepository);
        default -> LOG.debug(
            String.format(
                "WorkflowStageUpdaterListener does not support listening for the event: '%s'",
                execution.getEventName()));
      }
    } catch (Exception exc) {
      LOG.error(
          String.format(
              "[%s] Failed due to: %s ",
              getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()), exc.getMessage()),
          exc);
    }
  }

  private void updateBusinessKey(String processInstanceId) {
    UUID workflowInstanceBusinessKey = UUID.randomUUID();
    WorkflowHandler.getInstance().updateBusinessKey(processInstanceId, workflowInstanceBusinessKey);
  }

  private void addWorkflowInstance(
      DelegateExecution execution, WorkflowInstanceRepository workflowInstanceRepository) {
    updateBusinessKey(execution.getProcessInstanceId());

    String workflowDefinitionName =
        getMainWorkflowDefinitionNameFromTrigger(
            getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()));
    UUID workflowInstanceId = UUID.fromString(execution.getProcessInstanceBusinessKey());

    workflowInstanceRepository.addNewWorkflowInstance(
        workflowDefinitionName,
        workflowInstanceId,
        System.currentTimeMillis(),
        execution.getVariables());
    LOG.debug(
        String.format(
            "Workflow '%s' Triggered. Instance: '%s'", workflowDefinitionName, workflowInstanceId));
  }

  private void updateWorkflowInstance(
      DelegateExecution execution, WorkflowInstanceRepository workflowInstanceRepository) {
    String workflowDefinitionName =
        getMainWorkflowDefinitionNameFromTrigger(
            getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()));
    UUID workflowInstanceId = UUID.fromString(execution.getProcessInstanceBusinessKey());
    workflowInstanceRepository.updateWorkflowInstance(
        workflowInstanceId, System.currentTimeMillis(), execution.getVariables());
    LOG.debug(
        String.format(
            "Workflow '%s' Finished. Instance: '%s'", workflowDefinitionName, workflowInstanceId));
  }

  private String getMainWorkflowDefinitionNameFromTrigger(String triggerWorkflowDefinitionName) {
    return triggerWorkflowDefinitionName.replaceFirst("Trigger$", "");
  }
}
