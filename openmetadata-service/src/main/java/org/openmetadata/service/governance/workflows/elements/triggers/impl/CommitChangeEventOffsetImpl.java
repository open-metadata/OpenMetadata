package org.openmetadata.service.governance.workflows.elements.triggers.impl;

import static org.openmetadata.service.governance.workflows.elements.triggers.impl.FetchChangeEventsImpl.MAX_PROCESSED_OFFSET_VARIABLE;

import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;

@Slf4j
public class CommitChangeEventOffsetImpl implements JavaDelegate {

  private Expression workflowFqnExpr;
  private Expression entityTypeExpr;

  @Override
  public void execute(DelegateExecution execution) {
    String workflowFqn = (String) workflowFqnExpr.getValue(execution);
    String entityType = (String) entityTypeExpr.getValue(execution);
    Long maxProcessedOffset = (Long) execution.getVariable(MAX_PROCESSED_OFFSET_VARIABLE);
    ChangeEventOffsetUtils.commitOffset(workflowFqn, entityType, maxProcessedOffset);
  }
}
