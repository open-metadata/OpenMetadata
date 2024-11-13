package org.openmetadata.service.governance.workflows.flowable.builders;

import org.flowable.bpmn.model.FlowableListener;

public class FlowableListenerBuilder {
  private String event;
  private String implementation;

  public FlowableListenerBuilder event(String event) {
    this.event = event;
    return this;
  }

  public FlowableListenerBuilder implementation(String implementation) {
    this.implementation = implementation;
    return this;
  }

  public FlowableListener build() {
    FlowableListener listener = new FlowableListener();
    listener.setEvent(event);
    listener.setImplementationType("class");
    listener.setImplementation(implementation);
    return listener;
  }
}
