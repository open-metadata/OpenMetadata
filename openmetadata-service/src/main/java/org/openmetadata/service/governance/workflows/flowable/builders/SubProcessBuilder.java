package org.openmetadata.service.governance.workflows.flowable.builders;

import org.flowable.bpmn.model.SubProcess;

public class SubProcessBuilder extends FlowableElementBuilder<SubProcessBuilder> {
  @Override
  public SubProcess build() {
    SubProcess subProcess = new SubProcess();
    subProcess.setId(id);
    subProcess.setName(id);
    return subProcess;
  }
}
