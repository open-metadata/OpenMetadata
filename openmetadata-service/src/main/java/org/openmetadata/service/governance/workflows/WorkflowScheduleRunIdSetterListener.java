package org.openmetadata.service.governance.workflows;

import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_SCHEDULE_RUN_ID_VARIABLE;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;

@Slf4j
public class WorkflowScheduleRunIdSetterListener implements JavaDelegate {
  @Override
  public void execute(DelegateExecution execution) {
    if (execution.getVariable(WORKFLOW_SCHEDULE_RUN_ID_VARIABLE) != null) {
      return;
    }
    UUID scheduleRunId = UUID.randomUUID();
    execution.setVariable(WORKFLOW_SCHEDULE_RUN_ID_VARIABLE, scheduleRunId);
    LOG.debug(
        "[SCHEDULE_RUN_ID_SET] ProcessInstance: {} - scheduleRunId: {}",
        execution.getProcessInstanceId(),
        scheduleRunId);
  }
}
