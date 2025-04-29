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
    try {
      WorkflowInstanceRepository workflowInstanceRepository =
          (WorkflowInstanceRepository)
              Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE);

      UUID workflowInstanceId = UUID.fromString(execution.getProcessInstanceBusinessKey());
      workflowInstanceRepository.updateWorkflowInstance(
          workflowInstanceId, System.currentTimeMillis(), execution.getVariables());
    } catch (Exception exc) {
      LOG.error(
          String.format(
              "[%s] Failed due to: %s ",
              getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()), exc.getMessage()),
          exc);
    }
  }
}
