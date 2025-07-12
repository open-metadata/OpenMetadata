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

    // Fetch workflow definition to check config
    org.openmetadata.service.jdbi3.WorkflowDefinitionRepository workflowDefinitionRepository =
        (org.openmetadata.service.jdbi3.WorkflowDefinitionRepository)
            org.openmetadata.service.Entity.getEntityRepository(
                org.openmetadata.service.Entity.WORKFLOW_DEFINITION);
    org.openmetadata.schema.governance.workflows.WorkflowDefinition workflowDefinition =
        workflowDefinitionRepository.getByName(
            null,
            workflowDefinitionName,
            org.openmetadata.service.util.EntityUtil.Fields.EMPTY_FIELDS);
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
      WorkflowInstanceStateRepository workflowInstanceStateRepository) {
    // Fetch workflow definition to check config
    String workflowDefinitionName =
        getProcessDefinitionKeyFromId(execution.getProcessDefinitionId());
    UUID workflowInstanceId = UUID.fromString(execution.getProcessInstanceBusinessKey());
    org.openmetadata.service.jdbi3.WorkflowDefinitionRepository workflowDefinitionRepository =
        (org.openmetadata.service.jdbi3.WorkflowDefinitionRepository)
            org.openmetadata.service.Entity.getEntityRepository(
                org.openmetadata.service.Entity.WORKFLOW_DEFINITION);
    org.openmetadata.schema.governance.workflows.WorkflowDefinition workflowDefinition =
        workflowDefinitionRepository.getByName(
            null,
            workflowDefinitionName,
            org.openmetadata.service.util.EntityUtil.Fields.EMPTY_FIELDS);
    boolean storeStageStatus = workflowDefinition.getConfig().getStoreStageStatus();

    if (storeStageStatus) {
      // Existing logic: update WorkflowInstanceStateRepository
      UUID workflowInstanceStateId =
          (UUID) varHandler.getNodeVariable(STAGE_INSTANCE_STATE_ID_VARIABLE);
      workflowInstanceStateRepository.updateStage(
          workflowInstanceStateId, System.currentTimeMillis(), execution.getVariables());
    } else {
      handleUpdateStageInInstance(workflowInstanceId, execution);
    }
  }

  // Helper for adding a stage to the instance's stages array
  private void handleAddStageInInstance(
      WorkflowVariableHandler varHandler,
      UUID workflowInstanceId,
      UUID workflowInstanceExecutionId,
      org.openmetadata.schema.governance.workflows.WorkflowDefinition workflowDefinition,
      String stage) {
    org.openmetadata.service.jdbi3.WorkflowInstanceRepository workflowInstanceRepository =
        (org.openmetadata.service.jdbi3.WorkflowInstanceRepository)
            org.openmetadata.service.Entity.getEntityTimeSeriesRepository(
                org.openmetadata.service.Entity.WORKFLOW_INSTANCE);
    org.openmetadata.schema.governance.workflows.WorkflowInstance instance =
        workflowInstanceRepository.getById(workflowInstanceId);
    if (instance.getStages() == null) {
      instance.setStages(new java.util.ArrayList<>());
    }
    org.openmetadata.schema.governance.workflows.Stage stageObj =
        new org.openmetadata.schema.governance.workflows.Stage()
            .withName(stage)
            .withStartedAt(System.currentTimeMillis());
    org.openmetadata.schema.governance.workflows.WorkflowInstanceState state =
        new org.openmetadata.schema.governance.workflows.WorkflowInstanceState()
            .withStage(stageObj)
            .withWorkflowInstanceExecutionId(workflowInstanceExecutionId)
            .withWorkflowInstanceId(workflowInstanceId)
            .withWorkflowDefinitionId(workflowDefinition.getId())
            .withTimestamp(System.currentTimeMillis())
            .withStatus(
                org.openmetadata.schema.governance.workflows.WorkflowInstance.WorkflowStatus
                    .RUNNING);
    instance.getStages().add(state);
    workflowInstanceRepository
        .getTimeSeriesDao()
        .update(org.openmetadata.schema.utils.JsonUtils.pojoToJson(instance), instance.getId());
    // Optionally set a dummy UUID for STAGE_INSTANCE_STATE_ID_VARIABLE
    varHandler.setNodeVariable(STAGE_INSTANCE_STATE_ID_VARIABLE, state.getId());
  }

  // Helper for updating the last stage in the instance's stages array
  private void handleUpdateStageInInstance(UUID workflowInstanceId, DelegateExecution execution) {
    org.openmetadata.service.jdbi3.WorkflowInstanceRepository workflowInstanceRepository =
        (org.openmetadata.service.jdbi3.WorkflowInstanceRepository)
            org.openmetadata.service.Entity.getEntityTimeSeriesRepository(
                org.openmetadata.service.Entity.WORKFLOW_INSTANCE);
    org.openmetadata.schema.governance.workflows.WorkflowInstance instance =
        workflowInstanceRepository.getById(workflowInstanceId);
    if (instance.getStages() != null && !instance.getStages().isEmpty()) {
      // Find the last stage with matching executionId (or just last)
      org.openmetadata.schema.governance.workflows.WorkflowInstanceState lastStage =
          instance.getStages().getLast();
      lastStage.getStage().setEndedAt(System.currentTimeMillis());
      lastStage.getStage().setVariables(execution.getVariables());
      lastStage.setStatus(
          org.openmetadata.schema.governance.workflows.WorkflowInstance.WorkflowStatus.FINISHED);
      // Optionally handle failure/exception as in the state repo
      if (execution.getVariables().containsKey(FAILURE_VARIABLE)) {
        lastStage.setStatus(
            org.openmetadata.schema.governance.workflows.WorkflowInstance.WorkflowStatus.FAILURE);
      }
      // Exception handling
      if (execution
          .getVariables()
          .containsKey(
              org.openmetadata.service.governance.workflows.WorkflowVariableHandler
                  .getNamespacedVariableName(
                      org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE,
                      org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE))) {
        lastStage.setException(
            (String)
                execution
                    .getVariables()
                    .get(
                        org.openmetadata.service.governance.workflows.WorkflowVariableHandler
                            .getNamespacedVariableName(
                                org.openmetadata.service.governance.workflows.Workflow
                                    .GLOBAL_NAMESPACE,
                                org.openmetadata.service.governance.workflows.Workflow
                                    .EXCEPTION_VARIABLE)));
        lastStage.setStatus(
            org.openmetadata.schema.governance.workflows.WorkflowInstance.WorkflowStatus.EXCEPTION);
      }
      workflowInstanceRepository
          .getTimeSeriesDao()
          .update(org.openmetadata.schema.utils.JsonUtils.pojoToJson(instance), instance.getId());
    }
  }
}
