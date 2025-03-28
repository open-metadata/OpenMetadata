package org.openmetadata.service.governance.workflows.elements.nodes.userTask.manualRetry;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.governance.workflows.WorkflowHandler;

@Slf4j
public class ManualRetryImpl {
  public void execute(String executionId, String stepToRetry) {
    WorkflowHandler.getInstance().retryFromStep(executionId, stepToRetry);
  }
}
