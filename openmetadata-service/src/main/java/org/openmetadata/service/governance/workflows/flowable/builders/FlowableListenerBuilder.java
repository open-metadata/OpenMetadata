package org.openmetadata.service.governance.workflows.flowable.builders;

import java.util.ArrayList;
import java.util.List;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.FlowableListener;

public class FlowableListenerBuilder {
  private String event;
  private String implementation;
  private String implementationType = "class";
  private final List<FieldExtension> fieldExtensions = new ArrayList<>();

  public FlowableListenerBuilder event(String event) {
    this.event = event;
    return this;
  }

  public FlowableListenerBuilder implementation(String implementation) {
    this.implementation = implementation;
    return this;
  }

  public FlowableListenerBuilder implementationType(String implementationType) {
    this.implementationType = implementationType;
    return this;
  }

  public FlowableListenerBuilder addFieldExtension(FieldExtension fieldExtension) {
    this.fieldExtensions.add(fieldExtension);
    return this;
  }

  public FlowableListener build() {
    FlowableListener listener = new FlowableListener();
    listener.setEvent(event);
    listener.setImplementationType(implementationType);
    listener.setImplementation(implementation);

    for (FieldExtension fieldExtension : fieldExtensions) {
      listener.getFieldExtensions().add(fieldExtension);
    }
    return listener;
  }
}
