package org.openmetadata.service.governance.workflows.flowable.builders;

import org.flowable.bpmn.model.ParallelGateway;

public class ParallelGatewayBuilder extends FlowableElementBuilder<ParallelGatewayBuilder> {
  @Override
  public ParallelGateway build() {
    ParallelGateway parallelGateway = new ParallelGateway();
    parallelGateway.setId(id);
    parallelGateway.setName(id);
    return parallelGateway;
  }
}
