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
    // Skip non-OM-managed instances up-front. Flowable can fire termination on process
    // instances that were never started with a business key (test-time force-cancel,
    // Flowable-internal transitions, legacy rows). UUID.fromString(null) here used to
    // NPE every ~10s in Loki; those aren't errors, so log at DEBUG and return.
    String businessKey = execution.getProcessInstanceBusinessKey();
    if (businessKey == null || businessKey.isBlank()) {
      LOG.debug(
          "[{}] MainWorkflow termination on non-OM-managed instance {} (no business key) - skip",
          getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()),
          execution.getProcessInstanceId());
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
