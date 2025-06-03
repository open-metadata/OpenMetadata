package org.openmetadata.service.governance.workflows.flowable.builders;

import org.flowable.bpmn.model.ParallelGateway;

public class ParallelGatewayBuilder extends FlowableElementBuilder<ParallelGatewayBuilder> {

  private boolean async = true;
  private boolean exclusive = false;

  public ParallelGatewayBuilder setAsync(boolean async) {
    this.async = async;
    return this;
  }

  public ParallelGatewayBuilder exclusive(boolean exclusive) {
    this.exclusive = exclusive;
    return this;
  }

  @Override
  public ParallelGateway build() {
    ParallelGateway gateway = new ParallelGateway();
    gateway.setId(id);
    gateway.setName(id);
    gateway.setAsynchronous(async);
    gateway.setExclusive(exclusive);
    return gateway;
  }
}
