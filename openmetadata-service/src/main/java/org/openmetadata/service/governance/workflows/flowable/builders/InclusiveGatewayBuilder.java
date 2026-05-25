package org.openmetadata.service.governance.workflows.flowable.builders;

import org.flowable.bpmn.model.InclusiveGateway;

public class InclusiveGatewayBuilder extends FlowableElementBuilder<InclusiveGatewayBuilder> {

  private boolean async = false;
  private String defaultFlow;

  public InclusiveGatewayBuilder setAsync(boolean async) {
    this.async = async;
    return this;
  }

  public InclusiveGatewayBuilder defaultFlow(String defaultFlowId) {
    this.defaultFlow = defaultFlowId;
    return this;
  }

  @Override
  public InclusiveGateway build() {
    InclusiveGateway gateway = new InclusiveGateway();
    gateway.setId(id);
    gateway.setName(id);
    gateway.setAsynchronous(async);
    if (defaultFlow != null) {
      gateway.setDefaultFlow(defaultFlow);
    }
    return gateway;
  }
}
