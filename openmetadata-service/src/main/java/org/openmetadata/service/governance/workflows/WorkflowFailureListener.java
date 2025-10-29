package org.openmetadata.service.governance.workflows;

import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.api.delegate.event.FlowableEngineEventType;
import org.flowable.common.engine.api.delegate.event.FlowableEvent;
import org.flowable.common.engine.api.delegate.event.FlowableEventListener;

@Slf4j
public class WorkflowFailureListener implements FlowableEventListener {

  @Override
  public void onEvent(FlowableEvent event) {
    if (FlowableEngineEventType.JOB_EXECUTION_FAILURE.equals(event.getType())) {
      LOG.error("[WorkflowFailure] JOB_EXECUTION_FAILURE: {}", event);
    }
  }

  @Override
  public boolean isFailOnException() {
    // Return true if the listener should fail the operation on an exception
    return false;
  }

  @Override
  public boolean isFireOnTransactionLifecycleEvent() {
    return false;
  }

  @Override
  public String getOnTransaction() {
    return null;
  }
}
