package org.openmetadata.service.governance.workflows;

import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;

@Slf4j
public class WorkflowInstanceListener implements JavaDelegate {

  private static final String STATUS_VARIABLE_KEY = "status";

  @Override
  public void execute(DelegateExecution execution) {
    String workflowName = getProcessDefinitionKeyFromId(execution.getProcessDefinitionId());
    String processInstanceId = execution.getProcessInstanceId();
    String eventName = execution.getEventName();

    WorkflowInstanceRepository workflowInstanceRepository = null;
    try {
      workflowInstanceRepository =
          (WorkflowInstanceRepository)
              Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE);

      switch (eventName) {
        case "start" -> {
          LOG.debug(
              "[WORKFLOW_INSTANCE_START] Workflow: {}, ProcessInstance: {} - Creating workflow instance record",
              workflowName,
              processInstanceId);
          addWorkflowInstance(execution, workflowInstanceRepository);
        }
        case "end" -> {
          LOG.debug(
              "[WORKFLOW_INSTANCE_END] Workflow: {}, ProcessInstance: {} - Updating workflow instance status",
              workflowName,
              processInstanceId);
          updateWorkflowInstance(execution, workflowInstanceRepository);
        }
        default -> LOG.debug(
            "[WORKFLOW_INSTANCE_EVENT] Workflow: {}, ProcessInstance: {} - Unsupported event: {}",
            workflowName,
            processInstanceId,
            eventName);
      }
    } catch (Exception exc) {
      LOG.warn(
          "[WORKFLOW_INSTANCE_ERROR] Workflow: {}, ProcessInstance: {}, Event: {}: {}",
          workflowName,
          processInstanceId,
          eventName,
          exc.getMessage());

      if ("end".equals(eventName) && workflowInstanceRepository != null) {
        try {
          String businessKey = execution.getProcessInstanceBusinessKey();
          if (businessKey != null && !businessKey.isEmpty()) {
            UUID workflowInstanceId = UUID.fromString(businessKey);
            java.util.Map<String, Object> errorVariables = new java.util.HashMap<>();
            errorVariables.put(
                STATUS_VARIABLE_KEY, WorkflowInstance.WorkflowStatus.FAILURE.value());
            errorVariables.put("error", exc.getMessage());
            errorVariables.put("errorClass", exc.getClass().getSimpleName());
            workflowInstanceRepository.updateWorkflowInstance(
                workflowInstanceId, System.currentTimeMillis(), errorVariables);
            LOG.debug(
                "[WORKFLOW_INSTANCE_FAILED] Workflow: {}, InstanceId: {}",
                workflowName,
                workflowInstanceId);
          } else {
            LOG.warn(
                "[WORKFLOW_INSTANCE_NO_KEY] Workflow: {}, ProcessInstance: {}",
                workflowName,
                processInstanceId);
          }
        } catch (Exception updateExc) {
          LOG.warn(
              "[WORKFLOW_INSTANCE_DB_ERROR] Workflow: {}, ProcessInstance: {}: {}",
              workflowName,
              processInstanceId,
              updateExc.getMessage());
        }
      }
    }
  }

  private void updateBusinessKey(String processInstanceId) {
    UUID workflowInstanceBusinessKey = UUID.randomUUID();
    WorkflowHandler.getInstance().updateBusinessKey(processInstanceId, workflowInstanceBusinessKey);
  }

  private void addWorkflowInstance(
      DelegateExecution execution, WorkflowInstanceRepository workflowInstanceRepository) {
    String processKey = getProcessDefinitionKeyFromId(execution.getProcessDefinitionId());
    String workflowDefinitionName = getMainWorkflowDefinitionNameFromTrigger(processKey);
    if (workflowDefinitionName.equals(processKey)) {
      LOG.debug(
          "[WORKFLOW_INSTANCE_SKIP] ProcessInstance: {} - process key '{}' is not an OM trigger workflow, skipping",
          execution.getProcessInstanceId(),
          processKey);
      return;
    }
    updateBusinessKey(execution.getProcessInstanceId());
    UUID workflowInstanceId = UUID.fromString(execution.getProcessInstanceBusinessKey());

    workflowInstanceRepository.addNewWorkflowInstance(
        workflowDefinitionName,
        workflowInstanceId,
        System.currentTimeMillis(),
        execution.getVariables());
    LOG.debug(
        "[WORKFLOW_INSTANCE_CREATED] Workflow: {}, InstanceId: {}, ProcessInstance: {} - Workflow instance record created successfully",
        workflowDefinitionName,
        workflowInstanceId,
        execution.getProcessInstanceId());
  }

  private void updateWorkflowInstance(
      DelegateExecution execution, WorkflowInstanceRepository workflowInstanceRepository) {
    String processKey = getProcessDefinitionKeyFromId(execution.getProcessDefinitionId());
    String workflowDefinitionName = getMainWorkflowDefinitionNameFromTrigger(processKey);
    if (workflowDefinitionName.equals(processKey)) {
      LOG.debug(
          "[WORKFLOW_INSTANCE_SKIP] ProcessInstance: {} - process key '{}' is not an OM trigger workflow, skipping",
          execution.getProcessInstanceId(),
          processKey);
      return;
    }
    UUID workflowInstanceId = UUID.fromString(execution.getProcessInstanceBusinessKey());

    // Capture all variables including any failure indicators
    java.util.Map<String, Object> variables = new java.util.HashMap<>(execution.getVariables());

    WorkflowInstance.WorkflowStatus status = computeFinalStatus(variables);
    variables.put(STATUS_VARIABLE_KEY, status.value());
    workflowInstanceRepository.updateWorkflowInstance(
        workflowInstanceId, System.currentTimeMillis(), variables);
    LOG.debug(
        "[WORKFLOW_INSTANCE_COMPLETED] Workflow: {}, InstanceId: {}, Status: {}",
        workflowDefinitionName,
        workflowInstanceId,
        status);
  }

  private WorkflowInstance.WorkflowStatus computeFinalStatus(
      java.util.Map<String, Object> variables) {
    WorkflowInstance.WorkflowStatus status = WorkflowInstance.WorkflowStatus.FINISHED;
    if (Boolean.TRUE.equals(variables.get(Workflow.FAILURE_VARIABLE))) {
      status = WorkflowInstance.WorkflowStatus.FAILURE;
    } else if (variables.containsKey(Workflow.EXCEPTION_VARIABLE)
        && variables.get(Workflow.EXCEPTION_VARIABLE) != null) {
      status = WorkflowInstance.WorkflowStatus.EXCEPTION;
    }
    return status;
  }

  private String getMainWorkflowDefinitionNameFromTrigger(String triggerWorkflowDefinitionName) {
    // Handle PeriodicBatchEntityTrigger format: WorkflowNameTrigger-entityType
    // Remove both the "Trigger" suffix and any entity type suffix
    String withoutTrigger = triggerWorkflowDefinitionName.replaceFirst("Trigger(-.*)?$", "");

    // If that didn't work, try just removing "Trigger" at the end
    if (withoutTrigger.equals(triggerWorkflowDefinitionName)) {
      withoutTrigger = triggerWorkflowDefinitionName.replaceFirst("Trigger$", "");
    }

    return withoutTrigger;
  }
}
