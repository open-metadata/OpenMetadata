package org.openmetadata.service.governance.workflows;

import java.util.UUID;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;

public class MainWorkflowHasFinishedListener implements JavaDelegate {
  @Override
  public void execute(DelegateExecution execution) {
    WorkflowInstanceRepository workflowInstanceRepository =
        (WorkflowInstanceRepository) Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE);

    UUID workflowInstanceId = UUID.fromString(execution.getProcessInstanceBusinessKey());
    workflowInstanceRepository.updateWorkflowInstance(
        workflowInstanceId, System.currentTimeMillis());
  }
}
