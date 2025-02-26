package org.openmetadata.service.governance.workflows.flowable.builders;

import org.flowable.bpmn.model.ParallelGateway;

public class ParallelGatewayBuilder extends FlowableElementBuilder<ParallelGatewayBuilder> {

  private boolean async = true;

  public ParallelGatewayBuilder setAsync(boolean async) {
    this.async = async;
    return this;
  }

  @Override
  public ParallelGateway build() {
    ParallelGateway gateway = new ParallelGateway();
    gateway.setId(id);
    gateway.setName(id);
    gateway.setAsynchronous(async);
    return gateway;
  }
}
