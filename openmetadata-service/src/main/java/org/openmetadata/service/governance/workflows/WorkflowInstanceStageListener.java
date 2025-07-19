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
import org.openmetadata.schema.governance.workflows.Stage;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.governance.workflows.WorkflowInstanceState;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class WorkflowInstanceStageListener implements JavaDelegate {
  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      WorkflowInstanceStateRepository workflowInstanceStateRepository =
          (WorkflowInstanceStateRepository)
              Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE_STATE);
      WorkflowDefinition workflowDefinition = getWorkflowDefinition(execution);

      switch (execution.getEventName()) {
        case "start" -> addNewStage(
            varHandler, execution, workflowInstanceStateRepository, workflowDefinition);
        case "end" -> updateStage(
            varHandler, execution, workflowInstanceStateRepository, workflowDefinition);
        default -> LOG.debug(
            "WorkflowStageUpdaterListener does not support listening for the event: '{}'",
            execution.getEventName());
      }
    } catch (Exception exc) {
      LOG.error(
          "[{}] Failed due to: {} ",
          getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()),
          exc.getMessage(),
          exc);
    }
  }

  // Helper to fetch WorkflowDefinition by execution
  private WorkflowDefinition getWorkflowDefinition(DelegateExecution execution) {
    String workflowDefinitionName =
        getProcessDefinitionKeyFromId(execution.getProcessDefinitionId());
    WorkflowDefinitionRepository workflowDefinitionRepository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    return workflowDefinitionRepository.getByName(
        null, workflowDefinitionName, EntityUtil.Fields.EMPTY_FIELDS);
  }

  // Helper to get optimistic lock max retries from config
  private int getOptimisticLockMaxRetries(WorkflowDefinition workflowDefinition) {
    Integer maxRetries = workflowDefinition.getConfig().getOptimisticLockMaxRetries();
    return (maxRetries == null || maxRetries < 1) ? 3 : maxRetries;
  }

  private void addNewStage(
      WorkflowVariableHandler varHandler,
      DelegateExecution execution,
      WorkflowInstanceStateRepository workflowInstanceStateRepository,
      WorkflowDefinition workflowDefinition) {
    execution.removeTransientVariable(FAILURE_VARIABLE);
    String workflowDefinitionName =
        getProcessDefinitionKeyFromId(execution.getProcessDefinitionId());
    UUID workflowInstanceId = UUID.fromString(execution.getProcessInstanceBusinessKey());
    UUID workflowInstanceExecutionId =
        (UUID) execution.getVariable(WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE);
    String stage =
        Optional.ofNullable(execution.getCurrentActivityId()).orElse(workflowDefinitionName);

    boolean storeStageStatus = workflowDefinition.getConfig().getStoreStageStatus();

    if (storeStageStatus) {
      // Existing logic: write to WorkflowInstanceStateRepository
      UUID workflowInstanceStateId =
          workflowInstanceStateRepository.addNewStageToInstance(
              stage,
              workflowInstanceExecutionId,
              workflowInstanceId,
              workflowDefinitionName,
              System.currentTimeMillis());
      varHandler.setNodeVariable(STAGE_INSTANCE_STATE_ID_VARIABLE, workflowInstanceStateId);
    } else {
      handleAddStageInInstance(
          varHandler, workflowInstanceId, workflowInstanceExecutionId, workflowDefinition, stage);
    }
  }

  private void updateStage(
      WorkflowVariableHandler varHandler,
      DelegateExecution execution,
      WorkflowInstanceStateRepository workflowInstanceStateRepository,
      WorkflowDefinition workflowDefinition) {
    boolean storeStageStatus = workflowDefinition.getConfig().getStoreStageStatus();
    UUID workflowInstanceId = UUID.fromString(execution.getProcessInstanceBusinessKey());

    if (storeStageStatus) {
      // Existing logic: update WorkflowInstanceStateRepository
      UUID workflowInstanceStateId =
          (UUID) varHandler.getNodeVariable(STAGE_INSTANCE_STATE_ID_VARIABLE);
      workflowInstanceStateRepository.updateStage(
          workflowInstanceStateId, System.currentTimeMillis(), execution.getVariables());
    } else {
      handleUpdateStageInInstance(workflowInstanceId, execution, workflowDefinition);
    }
  }

  // Helper for adding a stage to the instance's stages array
  private void handleAddStageInInstance(
      WorkflowVariableHandler varHandler,
      UUID workflowInstanceId,
      UUID workflowInstanceExecutionId,
      WorkflowDefinition workflowDefinition,
      String stage) {
    WorkflowInstanceRepository workflowInstanceRepository =
        (WorkflowInstanceRepository) Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE);
    int maxRetries = getOptimisticLockMaxRetries(workflowDefinition);
    int maxStages = 100;
    if (workflowDefinition.getConfig().getMaxStagesPerInstance() != null
        && workflowDefinition.getConfig().getMaxStagesPerInstance() > 0) {
      maxStages = workflowDefinition.getConfig().getMaxStagesPerInstance();
    }
    int retries = 0;
    boolean updated = false;
    WorkflowInstance instance = null;
    while (retries < maxRetries && !updated) {
      instance = workflowInstanceRepository.getById(workflowInstanceId);
      if (instance.getStages() == null) {
        instance.setStages(new java.util.ArrayList<>());
      }
      // Enforce maxStages limit
      while (instance.getStages().size() >= maxStages) {
        instance.getStages().removeFirst(); // Remove oldest
      }
      Stage stageObj =
          new org.openmetadata.schema.governance.workflows.Stage()
              .withName(stage)
              .withStartedAt(System.currentTimeMillis());
      WorkflowInstanceState state =
          new org.openmetadata.schema.governance.workflows.WorkflowInstanceState()
              .withStage(stageObj)
              .withWorkflowInstanceExecutionId(workflowInstanceExecutionId)
              .withWorkflowInstanceId(workflowInstanceId)
              .withWorkflowDefinitionId(workflowDefinition.getId())
              .withTimestamp(System.currentTimeMillis())
              .withStatus(WorkflowInstance.WorkflowStatus.RUNNING);
      instance.getStages().add(state);
      int expectedVersion = instance.getVersion() != null ? instance.getVersion() : 0;
      updated = workflowInstanceRepository.updateIfVersionMatches(instance, expectedVersion);
      if (!updated) {
        retries++;
      }
    }
    if (!updated) {
      throw new RuntimeException(
          "Failed to update workflow instance after retries (optimistic locking)");
    }
    // Optionally set a dummy UUID for STAGE_INSTANCE_STATE_ID_VARIABLE
    varHandler.setNodeVariable(
        STAGE_INSTANCE_STATE_ID_VARIABLE, instance.getStages().getLast().getId());
  }

  // Helper for updating the last stage in the instance's stages array
  private void handleUpdateStageInInstance(
      UUID workflowInstanceId, DelegateExecution execution, WorkflowDefinition workflowDefinition) {
    WorkflowInstanceRepository workflowInstanceRepository =
        (WorkflowInstanceRepository) Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE);
    int maxRetries = getOptimisticLockMaxRetries(workflowDefinition);
    int retries = 0;
    boolean updated = false;
    WorkflowInstance instance;
    java.util.UUID currentExecutionId =
        (java.util.UUID) execution.getVariable(WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE);
    while (retries < maxRetries && !updated) {
      instance = workflowInstanceRepository.getById(workflowInstanceId);
      WorkflowInstanceState targetStage = null;
      if (instance.getStages() != null && !instance.getStages().isEmpty()) {
        // Find the stage with matching executionId (search from end for efficiency)
        for (int i = instance.getStages().size() - 1; i >= 0; i--) {
          WorkflowInstanceState stage = instance.getStages().get(i);
          if (stage.getWorkflowInstanceExecutionId() != null
              && stage.getWorkflowInstanceExecutionId().equals(currentExecutionId)) {
            targetStage = stage;
            break;
          }
        }
      }
      if (targetStage != null) {
        targetStage.getStage().setEndedAt(System.currentTimeMillis());
        targetStage.getStage().setVariables(execution.getVariables());
        targetStage.setStatus(WorkflowInstance.WorkflowStatus.FINISHED);
        if (execution.getVariables().containsKey(FAILURE_VARIABLE)) {
          targetStage.setStatus(WorkflowInstance.WorkflowStatus.FAILURE);
        }
        if (execution
            .getVariables()
            .containsKey(
                WorkflowVariableHandler.getNamespacedVariableName(
                    Workflow.GLOBAL_NAMESPACE, Workflow.EXCEPTION_VARIABLE))) {
          targetStage.setException(
              (String)
                  execution
                      .getVariables()
                      .get(
                          WorkflowVariableHandler.getNamespacedVariableName(
                              Workflow.GLOBAL_NAMESPACE, Workflow.EXCEPTION_VARIABLE)));
          targetStage.setStatus(WorkflowInstance.WorkflowStatus.EXCEPTION);
        }
        int expectedVersion = instance.getVersion() != null ? instance.getVersion() : 0;
        updated = workflowInstanceRepository.updateIfVersionMatches(instance, expectedVersion);
        if (!updated) {
          retries++;
        }
      } else {
        // No matching stage found for this execution context
        LOG.warn(
            "No stage found for executionId {} in workflowInstance {}. Skipping update.",
            currentExecutionId,
            workflowInstanceId);
        break;
      }
    }
    if (!updated) {
      throw new RuntimeException(
          "Failed to update workflow instance after retries (optimistic locking)");
    }
  }
}
