package org.openmetadata.service.governance.workflows.flowable.builders;

import org.flowable.bpmn.model.ExclusiveGateway;

public class ExclusiveGatewayBuilder extends FlowableElementBuilder<ExclusiveGatewayBuilder> {

  private boolean async = true;
  private boolean exclusive = true;
  private String name;

  public ExclusiveGatewayBuilder setAsync(boolean async) {
    this.async = async;
    return this;
  }

  public ExclusiveGatewayBuilder exclusive(boolean exclusive) {
    this.exclusive = exclusive;
    return this;
  }

  public ExclusiveGatewayBuilder name(String name) {
    this.name = name;
    return this;
  }

  @Override
  public ExclusiveGateway build() {
    ExclusiveGateway gateway = new ExclusiveGateway();
    gateway.setId(id);
    gateway.setName(name);
    gateway.setAsynchronous(async);
    gateway.setExclusive(exclusive);
    return gateway;
  }
}
