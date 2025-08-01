package org.openmetadata.service.governance.workflows;

import static org.openmetadata.service.governance.workflows.Workflow.FAILURE_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.STAGE_INSTANCE_STATE_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository;

@Slf4j
public class WorkflowInstanceStageListener implements JavaDelegate {
  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      WorkflowInstanceStateRepository workflowInstanceStateRepository =
          (WorkflowInstanceStateRepository)
              Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE_STATE);

      switch (execution.getEventName()) {
        case "start" -> addNewStage(varHandler, execution, workflowInstanceStateRepository);
        case "end" -> updateStage(varHandler, execution, workflowInstanceStateRepository);
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

  private void addNewStage(
      WorkflowVariableHandler varHandler,
      DelegateExecution execution,
      WorkflowInstanceStateRepository workflowInstanceStateRepository) {
    execution.removeTransientVariable(FAILURE_VARIABLE);
    String workflowDefinitionName =
        getProcessDefinitionKeyFromId(execution.getProcessDefinitionId());
    UUID workflowInstanceId = UUID.fromString(execution.getProcessInstanceBusinessKey());
    UUID workflowInstanceExecutionId =
        (UUID) execution.getVariable(WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE);
    String stage =
        Optional.ofNullable(execution.getCurrentActivityId()).orElse(workflowDefinitionName);
    UUID workflowInstanceStateId =
        workflowInstanceStateRepository.addNewStageToInstance(
            stage,
            workflowInstanceExecutionId,
            workflowInstanceId,
            workflowDefinitionName,
            System.currentTimeMillis());
    varHandler.setNodeVariable(STAGE_INSTANCE_STATE_ID_VARIABLE, workflowInstanceStateId);
  }

  private void updateStage(
      WorkflowVariableHandler varHandler,
      DelegateExecution execution,
      WorkflowInstanceStateRepository workflowInstanceStateRepository) {
    UUID workflowInstanceStateId =
        (UUID) varHandler.getNodeVariable(STAGE_INSTANCE_STATE_ID_VARIABLE);
    workflowInstanceStateRepository.updateStage(
        workflowInstanceStateId, System.currentTimeMillis(), execution.getVariables());
  }
}
