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
    String workflowName = getProcessDefinitionKeyFromId(execution.getProcessDefinitionId());
    String processInstanceId = execution.getProcessInstanceId();
    String eventName = execution.getEventName();
    String currentActivity = execution.getCurrentActivityId();

    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      WorkflowInstanceStateRepository workflowInstanceStateRepository =
          (WorkflowInstanceStateRepository)
              Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE_STATE);

      switch (eventName) {
        case "start" -> {
          LOG.info(
              "[STAGE_START] Workflow: {}, ProcessInstance: {}, Activity: {} - Creating new stage record",
              workflowName,
              processInstanceId,
              currentActivity);
          addNewStage(varHandler, execution, workflowInstanceStateRepository);
        }
        case "end" -> {
          LOG.info(
              "[STAGE_END] Workflow: {}, ProcessInstance: {}, Activity: {} - Updating stage completion",
              workflowName,
              processInstanceId,
              currentActivity);
          updateStage(varHandler, execution, workflowInstanceStateRepository);
        }
        default -> LOG.debug(
            "[STAGE_EVENT] Workflow: {}, ProcessInstance: {}, Activity: {} - Unsupported event: {}",
            workflowName,
            processInstanceId,
            currentActivity,
            eventName);
      }
    } catch (Exception exc) {
      LOG.error(
          "[STAGE_ERROR] Workflow: {}, ProcessInstance: {}, Activity: {}, Event: {} - Stage processing failed. Error: {}",
          workflowName,
          processInstanceId,
          currentActivity,
          eventName,
          exc.getMessage(),
          exc);

      // CRITICAL: Record the stage failure in the database even if processing failed
      if ("end".equals(eventName)) {
        try {
          WorkflowInstanceStateRepository workflowInstanceStateRepository =
              (WorkflowInstanceStateRepository)
                  Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE_STATE);

          String businessKey = execution.getProcessInstanceBusinessKey();
          if (businessKey != null && !businessKey.isEmpty()) {
            UUID workflowInstanceId = UUID.fromString(businessKey);
            UUID executionId =
                (UUID) execution.getVariable(WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE);
            if (executionId == null) {
              // Use Flowable's execution ID as fallback
              executionId = UUID.nameUUIDFromBytes(execution.getId().getBytes());
              LOG.warn(
                  "[STAGE_FALLBACK_ID] Workflow: {}, ProcessInstance: {} - Using fallback execution ID: {}",
                  workflowName,
                  processInstanceId,
                  executionId);
            }

            String stage = Optional.ofNullable(currentActivity).orElse(workflowName);

            // Create a failed stage record
            UUID stageId =
                workflowInstanceStateRepository.addNewStageToInstance(
                    stage + "_failed",
                    executionId,
                    workflowInstanceId,
                    workflowName,
                    System.currentTimeMillis());

            java.util.Map<String, Object> failureData = new java.util.HashMap<>();
            failureData.put("status", "FAILED");
            failureData.put("error", exc.getMessage());
            failureData.put("errorClass", exc.getClass().getSimpleName());

            workflowInstanceStateRepository.updateStage(
                stageId, System.currentTimeMillis(), failureData);

            LOG.warn(
                "[STAGE_FAILED_RECORDED] Workflow: {}, ProcessInstance: {}, Stage: {}, StageId: {} - Failed stage recorded in database",
                workflowName,
                processInstanceId,
                stage,
                stageId);
          } else {
            LOG.error(
                "[STAGE_NO_BUSINESS_KEY] Workflow: {}, ProcessInstance: {} - Cannot record stage failure, business key is missing",
                workflowName,
                processInstanceId);
          }
        } catch (Exception recordExc) {
          LOG.error(
              "[STAGE_DB_ERROR] Workflow: {}, ProcessInstance: {} - Failed to record stage failure in database. Error: {}",
              workflowName,
              processInstanceId,
              recordExc.getMessage(),
              recordExc);
        }
      }
    }
  }

  private void addNewStage(
      WorkflowVariableHandler varHandler,
      DelegateExecution execution,
      WorkflowInstanceStateRepository workflowInstanceStateRepository) {
    execution.removeTransientVariable(FAILURE_VARIABLE);
    String workflowDefinitionName =
        getProcessDefinitionKeyFromId(execution.getProcessDefinitionId());
    String processInstanceId = execution.getProcessInstanceId();

    // Check business key first - critical for stage tracking
    String businessKey = execution.getProcessInstanceBusinessKey();
    if (businessKey == null || businessKey.isEmpty()) {
      LOG.error(
          "[STAGE_MISSING_KEY] Workflow: {}, ProcessInstance: {} - Business key is missing for stage creation",
          workflowDefinitionName,
          processInstanceId);
      throw new IllegalStateException(
          String.format(
              "Business key is missing for stage creation in workflow: %s",
              workflowDefinitionName));
    }
    UUID workflowInstanceId = UUID.fromString(businessKey);

    // Get or create workflow instance execution ID
    UUID workflowInstanceExecutionId =
        (UUID) execution.getVariable(WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE);
    if (workflowInstanceExecutionId == null) {
      // This should have been set by WorkflowInstanceExecutionIdSetterListener
      LOG.error(
          "[STAGE_MISSING_EXEC_ID] Workflow: {}, ProcessInstance: {}, InstanceId: {} - Workflow instance execution ID is null",
          workflowDefinitionName,
          processInstanceId,
          workflowInstanceId);
      // Use Flowable's execution ID as fallback
      workflowInstanceExecutionId = UUID.nameUUIDFromBytes(execution.getId().getBytes());
      execution.setVariable(WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE, workflowInstanceExecutionId);
      LOG.warn(
          "[STAGE_CREATED_FALLBACK] Workflow: {}, ProcessInstance: {} - Created fallback execution ID: {}",
          workflowDefinitionName,
          processInstanceId,
          workflowInstanceExecutionId);
    }

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
    LOG.info(
        "[STAGE_CREATED] Workflow: {}, ProcessInstance: {}, Stage: {}, StageId: {} - Stage record created successfully",
        workflowDefinitionName,
        processInstanceId,
        stage,
        workflowInstanceStateId);
  }

  private void updateStage(
      WorkflowVariableHandler varHandler,
      DelegateExecution execution,
      WorkflowInstanceStateRepository workflowInstanceStateRepository) {
    String workflowDefinitionName =
        getProcessDefinitionKeyFromId(execution.getProcessDefinitionId());
    String processInstanceId = execution.getProcessInstanceId();
    String stage =
        Optional.ofNullable(execution.getCurrentActivityId()).orElse(workflowDefinitionName);

    UUID workflowInstanceStateId =
        (UUID) varHandler.getNodeVariable(STAGE_INSTANCE_STATE_ID_VARIABLE);

    if (workflowInstanceStateId == null) {
      LOG.error(
          "[STAGE_UPDATE_NO_ID] Workflow: {}, ProcessInstance: {}, Stage: {} - Cannot update stage, state ID is null",
          workflowDefinitionName,
          processInstanceId,
          stage);
      return;
    }

    workflowInstanceStateRepository.updateStage(
        workflowInstanceStateId, System.currentTimeMillis(), execution.getVariables());

    LOG.info(
        "[STAGE_UPDATED] Workflow: {}, ProcessInstance: {}, Stage: {}, StageId: {} - Stage completion recorded",
        workflowDefinitionName,
        processInstanceId,
        stage,
        workflowInstanceStateId);
  }
}
