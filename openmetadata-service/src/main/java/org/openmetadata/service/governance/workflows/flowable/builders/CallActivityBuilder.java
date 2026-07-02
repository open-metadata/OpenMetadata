package org.openmetadata.service.governance.workflows.flowable.builders;

import org.flowable.bpmn.model.CallActivity;

public class CallActivityBuilder extends FlowableElementBuilder<CallActivityBuilder> {
  private String calledElement;
  private boolean inheritBusinessKey;
  private boolean inheritVariables;

  public CallActivityBuilder calledElement(String calledElement) {
    this.calledElement = calledElement;
    return this;
  }

  public CallActivityBuilder inheritBusinessKey(boolean inheritBusinessKey) {
    this.inheritBusinessKey = inheritBusinessKey;
    return this;
  }

  public CallActivityBuilder inheritVariables(boolean inheritVariables) {
    this.inheritVariables = inheritVariables;
    return this;
  }

  @Override
  public CallActivity build() {
    CallActivity callActivity = new CallActivity();
    callActivity.setId(id);
    callActivity.setName(id);
    callActivity.setCalledElement(calledElement);
    callActivity.setInheritBusinessKey(inheritBusinessKey);
    callActivity.setInheritVariables(inheritVariables);
    return callActivity;
  }
}
