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
          LOG.info(
              "[WORKFLOW_INSTANCE_START] Workflow: {}, ProcessInstance: {} - Creating workflow instance record",
              workflowName,
              processInstanceId);
          addWorkflowInstance(execution, workflowInstanceRepository);
        }
        case "end" -> {
          LOG.info(
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
      LOG.error(
          "[WORKFLOW_INSTANCE_ERROR] Workflow: {}, ProcessInstance: {}, Event: {} - Failed to process workflow instance. Error: {}",
          workflowName,
          processInstanceId,
          eventName,
          exc.getMessage(),
          exc);

      // CRITICAL: Even on failure, we must record the state in the database
      if ("end".equals(eventName) && workflowInstanceRepository != null) {
        try {
          String businessKey = execution.getProcessInstanceBusinessKey();
          if (businessKey != null && !businessKey.isEmpty()) {
            UUID workflowInstanceId = UUID.fromString(businessKey);
            java.util.Map<String, Object> errorVariables = new java.util.HashMap<>();
            errorVariables.put("status", "FAILURE");
            errorVariables.put("error", exc.getMessage());
            errorVariables.put("errorClass", exc.getClass().getSimpleName());
            workflowInstanceRepository.updateWorkflowInstance(
                workflowInstanceId, System.currentTimeMillis(), errorVariables);
            LOG.warn(
                "[WORKFLOW_INSTANCE_FAILED] Workflow: {}, ProcessInstance: {}, InstanceId: {} - Workflow marked as FAILED in database",
                workflowName,
                processInstanceId,
                workflowInstanceId);
          } else {
            LOG.error(
                "[WORKFLOW_INSTANCE_NO_KEY] Workflow: {}, ProcessInstance: {} - Cannot update workflow status, business key is missing",
                workflowName,
                processInstanceId);
          }
        } catch (Exception updateExc) {
          LOG.error(
              "[WORKFLOW_INSTANCE_DB_ERROR] Workflow: {}, ProcessInstance: {} - Failed to record workflow failure in database. Error: {}",
              workflowName,
              processInstanceId,
              updateExc.getMessage(),
              updateExc);
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
    LOG.info(
        "[WORKFLOW_INSTANCE_CREATED] Workflow: {}, InstanceId: {}, ProcessInstance: {} - Workflow instance record created successfully",
        workflowDefinitionName,
        workflowInstanceId,
        execution.getProcessInstanceId());
  }

  private void updateWorkflowInstance(
      DelegateExecution execution, WorkflowInstanceRepository workflowInstanceRepository) {
    String workflowDefinitionName =
        getMainWorkflowDefinitionNameFromTrigger(
            getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()));
    UUID workflowInstanceId = UUID.fromString(execution.getProcessInstanceBusinessKey());

    // Capture all variables including any failure indicators
    java.util.Map<String, Object> variables = new java.util.HashMap<>(execution.getVariables());

    // Determine final status based on what happened during execution
    String status = "FINISHED"; // Default
    if (Boolean.TRUE.equals(variables.get(Workflow.FAILURE_VARIABLE))) {
      status = "FAILURE";
    } else if (variables.containsKey(Workflow.EXCEPTION_VARIABLE)) {
      status = "EXCEPTION";
    }
    variables.put("status", status);

    workflowInstanceRepository.updateWorkflowInstance(
        workflowInstanceId, System.currentTimeMillis(), variables);

    if ("FAILURE".equals(status) || "EXCEPTION".equals(status)) {
      LOG.warn(
          "[WORKFLOW_INSTANCE_COMPLETED_WITH_ERRORS] Workflow: {}, InstanceId: {}, Status: {} - Workflow completed with errors",
          workflowDefinitionName,
          workflowInstanceId,
          status);
    } else {
      LOG.info(
          "[WORKFLOW_INSTANCE_COMPLETED] Workflow: {}, InstanceId: {}, Status: {} - Workflow completed successfully",
          workflowDefinitionName,
          workflowInstanceId,
          status);
    }
  }

  private String getMainWorkflowDefinitionNameFromTrigger(String triggerWorkflowDefinitionName) {
    return triggerWorkflowDefinitionName.replaceFirst("Trigger$", "");
  }
}
