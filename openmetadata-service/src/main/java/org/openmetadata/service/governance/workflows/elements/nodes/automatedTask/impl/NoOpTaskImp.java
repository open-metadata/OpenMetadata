package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.PAYLOAD;

import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;

@Slf4j
public class NoOpTaskImp implements JavaDelegate {
  private Expression statusExpr;

  @Override
  public void execute(DelegateExecution execution) {
    String payload = (String) execution.getVariable(PAYLOAD);
    System.out.println("NoOpTaskImp: " + payload);
  }
}
