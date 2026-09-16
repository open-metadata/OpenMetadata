package org.openmetadata.service.governance.workflows;

import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;

@Slf4j
public class MainWorkflowTerminationListener implements JavaDelegate {
  @Override
  public void execute(DelegateExecution execution) {
    // businessKey identifies the OM WorkflowInstance; a null key means the process was not
    // started through the OM trigger path so there is no WorkflowInstance row to update.
    String businessKey = execution.getProcessInstanceBusinessKey();
    if (businessKey == null || businessKey.isBlank()) {
      return;
    }

    try {
      WorkflowInstanceRepository workflowInstanceRepository =
          (WorkflowInstanceRepository)
              Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE);

      UUID workflowInstanceId = UUID.fromString(businessKey);
      workflowInstanceRepository.updateWorkflowInstance(
          workflowInstanceId, System.currentTimeMillis(), execution.getVariables());
    } catch (Exception exc) {
      LOG.error(
          "[{}] Failed due to: {} ",
          getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()),
          exc.getMessage(),
          exc);
    }
  }
}
