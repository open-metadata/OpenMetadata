package org.openmetadata.service.governance.workflows.flowable.builders;

import org.flowable.bpmn.model.ParallelGateway;

public class ParallelGatewayBuilder extends FlowableElementBuilder<ParallelGatewayBuilder> {
  @Override
  public ParallelGateway build() {
    ParallelGateway gateway = new ParallelGateway();
    gateway.setId(id);
    gateway.setName(id);
    return gateway;
  }
}
