package org.openmetadata.service.governance.workflows.flowable.builders;

import org.flowable.bpmn.model.SubProcess;

public class SubProcessBuilder extends FlowableElementBuilder<SubProcessBuilder> {

  private boolean async = false;
  private boolean exclusive = true;

  public SubProcessBuilder setAsync(boolean async) {
    this.async = async;
    return this;
  }

  public SubProcessBuilder exclusive(boolean exclusive) {
    this.exclusive = exclusive;
    return this;
  }

  @Override
  public SubProcess build() {
    SubProcess subProcess = new SubProcess();
    subProcess.setId(id);
    subProcess.setName(id);
    subProcess.setAsynchronous(async);
    subProcess.setExclusive(exclusive);
    return subProcess;
  }
}
